import type { Battlelog, BattleResult } from "@brawlbase/brawl-stars-api";
import { formatTag, verifyTag } from "@brawlbase/supercell-api-utils";
import { SUPPORTED_MODES, type CanonicalMatch, type MatchParticipant } from "./types.ts";

const supportedModes = new Set<string>(SUPPORTED_MODES);

export function normalizeTag(input: string): string {
	const tag = formatTag(input.trim());
	if (tag.length > 32 || !verifyTag(tag)) throw new Error("Invalid player tag");
	return tag;
}

/** Only explicitly supported trophy 3v3 matches have unambiguous team outcomes here. */
export async function canonicalMatch(entry: Battlelog, observer: string): Promise<CanonicalMatch | null> {
	const { battle, event } = entry;
	if (battle.type !== "ranked" || !supportedModes.has(battle.mode)) return null;
	if (!battle.teams || battle.teams.length !== 2 || battle.teams.some((team) => team.length !== 3)) return null;
	if (battle.result !== "victory" && battle.result !== "defeat" && battle.result !== "draw") return null;
	if (!Number.isSafeInteger(event.id) || event.id <= 0 || typeof event.map !== "string" || !event.map.trim()) return null;
	const battleTime = entry.battleTime.getTime();
	if (!Number.isFinite(battleTime)) throw new Error("Invalid battle time");
	const teams = battle.teams.map((team) =>
		team.map((player) => {
			if (!player.brawler || player.brawlers?.length || !Number.isSafeInteger(player.brawler.id) || player.brawler.id <= 0)
				return null;
			try {
				const trophies = player.brawler.trophies;
				return {
					tag: normalizeTag(player.tag),
					brawlerId: player.brawler.id,
					trophies: Number.isSafeInteger(trophies) && trophies >= 0 ? trophies : null,
				};
			} catch {
				// Bot/sentinel tags cannot provide a stable player identity for this sample.
				return null;
			}
		})
	);
	if (teams.some((team) => team.includes(null))) return null;
	const validTeams = teams.map((team) => team.filter((player) => player !== null).sort((a, b) => a.tag.localeCompare(b.tag)));
	validTeams.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
	if (new Set(validTeams.flat().map((player) => player.tag)).size !== 6) return null;
	const observerTeam = validTeams.findIndex((team) => team.some((player) => player.tag === normalizeTag(observer)));
	if (observerTeam < 0) return null;
	const result = battle.result;
	const opposite: Record<BattleResult, BattleResult> = { victory: "defeat", defeat: "victory", draw: "draw" };
	const participants: MatchParticipant[] = validTeams.flatMap((team, teamIndex) =>
		team.map((player) => ({
			...player,
			team: teamIndex,
			result: teamIndex === observerTeam ? result : opposite[result],
			starPlayer: battle.starPlayer ? player.tag === formatTag(battle.starPlayer.tag) : null,
			duration:
				typeof battle.duration === "number" && Number.isSafeInteger(battle.duration) && battle.duration >= 0
					? battle.duration
					: null,
		}))
	);
	// No upstream match ID exists here. Exclude perspective, names, power, trophies, and results.
	// Preserve v1 fingerprints exactly: enrichment must never change match identity.
	const identityTeams = validTeams.map((team) => team.map(({ tag, brawlerId }) => ({ tag, brawlerId })));
	const identity = JSON.stringify([battleTime, event.id, battle.mode, battle.type, identityTeams]);
	// Workers provide this Web API without a Node compatibility dependency.
	// eslint-disable-next-line n/prefer-global/text-encoder
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
	const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
	return { key, battleTime, eventId: event.id, map: event.map, mode: battle.mode, participants };
}
