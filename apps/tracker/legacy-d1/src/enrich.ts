import type { Battlelog, BattlelogParticipant } from "@brawlbase/brawl-stars-api";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { and, eq, sql } from "drizzle-orm";
import { statsDatabase } from "./stats/database.ts";
import { canonicalMatch, SUPPORTED_MODES } from "./stats/index.ts";
import { collections, matchParticipants } from "./stats/schema.ts";

export interface ArchiveJob {
	kind: "enrich";
	collectionToken: string;
	archiveKey: string;
}
interface ArchiveBindings {
	STATS_DB: D1Database;
	STATS_ARCHIVE: R2Bucket;
}
function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
export function isArchiveJob(value: unknown): value is ArchiveJob {
	const job = record(value);
	return (
		job?.kind === "enrich" &&
		typeof job.collectionToken === "string" &&
		/^[\da-f-]{36}$/i.test(job.collectionToken) &&
		typeof job.archiveKey === "string" &&
		job.archiveKey.startsWith("brawler-stats/") &&
		job.archiveKey.length < 1024
	);
}

/** Restore the small, explicitly validated subset used for identity and metadata enrichment. */
function archivedBattle(value: unknown): Battlelog | null {
	const entry = record(value),
		battle = record(entry?.battle),
		event = record(entry?.event);
	const mode = SUPPORTED_MODES.find((mode) => mode === battle?.mode);
	if (
		!entry ||
		!battle ||
		!event ||
		!mode ||
		battle.type !== "ranked" ||
		typeof entry.battleTime !== "string" ||
		typeof event.id !== "number" ||
		typeof event.map !== "string" ||
		!Array.isArray(battle.teams) ||
		(battle.result !== "victory" && battle.result !== "defeat" && battle.result !== "draw")
	)
		return null;
	const teams: BattlelogParticipant[][] = [];
	for (const team of battle.teams) {
		if (!Array.isArray(team)) return null;
		const players: BattlelogParticipant[] = [];
		for (const value of team) {
			const player = record(value),
				brawler = record(player?.brawler);
			if (
				!player ||
				!brawler ||
				typeof player.tag !== "string" ||
				typeof player.name !== "string" ||
				typeof brawler.id !== "number" ||
				typeof brawler.name !== "string" ||
				typeof brawler.power !== "number" ||
				typeof brawler.trophies !== "number"
			)
				return null;
			players.push({
				tag: player.tag,
				name: player.name,
				brawler: { id: brawler.id, name: brawler.name, power: brawler.power, trophies: brawler.trophies },
			});
		}
		teams.push(players);
	}
	const star = record(battle.starPlayer);
	const starPlayer = teams.flat().find((player) => player.tag === star?.tag);
	return {
		battleTime: new Date(entry.battleTime),
		event: { id: event.id, map: event.map, mode },
		battle: {
			type: "ranked",
			mode,
			result: battle.result,
			teams,
			...(typeof battle.duration === "number" ? { duration: battle.duration } : {}),
			...(starPlayer?.brawler
				? { starPlayer: { tag: starPlayer.tag, name: starPlayer.name, brawler: starPlayer.brawler } }
				: {}),
		},
	};
}

export async function enrichCollection(env: ArchiveBindings, job: ArchiveJob, now = Date.now()): Promise<void> {
	const db = statsDatabase(env.STATS_DB);
	const collection = await db
		.select()
		.from(collections)
		.where(and(eq(collections.leaseToken, job.collectionToken), eq(collections.archiveKey, job.archiveKey)))
		.get();
	if (!collection || collection.enrichedAt !== null) return;
	const object = await env.STATS_ARCHIVE.get(job.archiveKey);
	if (!object) throw new Error("Committed statistics archive is missing");
	const archive = record(await object.json<unknown>());
	if (
		archive?.version !== 1 ||
		archive.tag !== collection.tag ||
		!Array.isArray(archive.battles) ||
		archive.battles.length > 50
	)
		throw new Error("Invalid statistics archive");
	const entries = archive.battles.map(archivedBattle).filter((entry): entry is Battlelog => entry !== null);
	const matches = await Promise.all(entries.map((entry) => canonicalMatch(entry, collection.tag)));
	const participants = matches.flatMap((match) =>
		match
			? match.participants.map((participant) => ({
					key: match.key,
					tag: participant.tag,
					trophies: participant.trophies,
					starPlayer: participant.starPlayer,
					duration: participant.duration,
				}))
			: []
	);
	const updates = participants.map((participant) =>
		db
			.update(matchParticipants)
			.set({
				trophies: sql`COALESCE(${matchParticipants.trophies},${participant.trophies})`,
				starPlayer: sql`COALESCE(${matchParticipants.starPlayer},${
					participant.starPlayer === null ? null : Number(participant.starPlayer)
				})`,
				duration: sql`COALESCE(${matchParticipants.duration},${participant.duration})`,
			})
			.where(
				and(
					eq(matchParticipants.battleKey, participant.key),
					eq(matchParticipants.playerTag, participant.tag),
					sql`(${matchParticipants.trophies} IS NULL OR ${matchParticipants.starPlayer} IS NULL OR ${matchParticipants.duration} IS NULL)`
				)
			)
	);
	const complete = db
		.update(collections)
		.set({ enrichedAt: now, enrichmentUntil: 0 })
		.where(eq(collections.leaseToken, job.collectionToken));
	await db.batch([complete, ...updates]);
}
