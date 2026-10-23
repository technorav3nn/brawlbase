import type { Battlelog } from "@brawlbase/brawl-stars-api";
import type { D1Database } from "@cloudflare/workers-types";
import { and, count, eq, exists, inArray, lt, sql } from "drizzle-orm";
import { statsDatabase } from "./database.ts";
import { canonicalMatch } from "./identity.ts";
import type { InferredEquipment } from "./loadouts.ts";
import { getLease, leaseFence, nextPollAt } from "./scheduling.ts";
import { buckets, collections, equipmentDaily, equipmentSamples, matches, matchRanges, trackedPlayers } from "./schema.ts";
import { DAY_MS, RAW_RETENTION_DAYS, type CanonicalMatch, type PollJob } from "./types.ts";

export async function persistCollection(
	binding: D1Database,
	job: PollJob,
	battles: Battlelog[],
	archiveKey: string,
	minimumIntervalMs: number,
	now = Date.now(),
	_maxTrackedPlayers?: number,
	loadouts?: Map<number, InferredEquipment[]>
): Promise<boolean> {
	const tracked = await getLease(binding, job, now);
	if (!tracked) return false;
	if (battles.length > 50) throw new Error("Unexpected battle log size");
	const times = battles.map((entry) => entry.battleTime.getTime());
	if (times.some((time) => !Number.isFinite(time) || time > now + 60_000)) throw new Error("Invalid battle time");
	const oldest = times.length ? Math.min(...times) : null,
		newest = times.length ? Math.max(...times) : tracked.last_battle_at;
	const cutoff = Math.floor(now / DAY_MS) * DAY_MS - RAW_RETENTION_DAYS * DAY_MS;
	const canonical = (await Promise.all(battles.map((entry) => canonicalMatch(entry, job.tag)))).filter(
		(match): match is CanonicalMatch => match !== null && match.battleTime >= cutoff && match.battleTime <= now
	);
	const db = statsDatabase(binding);
	const fence = exists(db.select({ tag: trackedPlayers.tag }).from(trackedPlayers).where(leaseFence(job, now)));
	const collection = db
		.insert(collections)
		.select(
			db
				.select({
					leaseToken: sql<string>`${job.leaseToken}`.as("leaseToken"),
					tag: sql<string>`${job.tag}`.as("tag"),
					observedAt: sql<number>`${now}`.as("observedAt"),
					oldestBattleAt: sql<number | null>`${oldest}`.as("oldestBattleAt"),
					newestBattleAt: sql<number | null>`${newest}`.as("newestBattleAt"),
					battlesSeen: sql<number>`${battles.length}`.as("battlesSeen"),
					eligibleBattles: sql<number>`${canonical.length}`.as("eligibleBattles"),
					possibleGap: sql<number>`${
						tracked.last_battle_at !== null && oldest !== null && oldest > tracked.last_battle_at ? 1 : 0
					}`.as("possibleGap"),
					archiveKey: sql<string>`${archiveKey}`.as("archiveKey"),
					enrichedAt: sql<number>`${now}`.as("enrichedAt"),
					enrichmentUntil: sql<number>`0`.as("enrichmentUntil"),
				})
				.from(sql`(SELECT 1)`)
				.where(fence)
		)
		.onConflictDoNothing();
	const matchPayload = JSON.stringify(
		canonical.map((match) => ({ ...match, day: Math.floor(match.battleTime / DAY_MS) * DAY_MS }))
	);
	const inserted = db
		.insert(matches)
		.select(
			db
				.select({
					battleKey: sql<string>`json_extract(value,'$.key')`.as("battleKey"),
					battleTime: sql<number>`json_extract(value,'$.battleTime')`.as("battleTime"),
					day: sql<number>`json_extract(value,'$.day')`.as("day"),
					eventId: sql<number>`json_extract(value,'$.eventId')`.as("eventId"),
					mapName: sql<string>`json_extract(value,'$.map')`.as("mapName"),
					mode: sql<string>`json_extract(value,'$.mode')`.as("mode"),
					collectionToken: sql<string>`${job.leaseToken}`.as("collectionToken"),
					participantsJson: sql<string>`json_extract(value,'$.participants')`.as("participantsJson"),
				})
				.from(sql`json_each(${matchPayload})`)
				.where(fence)
		)
		.onConflictDoNothing();
	const participant = sql`json_each(${matches.participantsJson}) participant`;
	const trophyRange = sql<string>`CASE WHEN json_extract(participant.value,'$.trophies') IS NULL THEN 'unknown' WHEN json_extract(participant.value,'$.trophies')<500 THEN '0-499' WHEN json_extract(participant.value,'$.trophies')<1000 THEN '500-999' ELSE '1000+' END`;
	const selected = and(
		inArray(
			matches.battleKey,
			canonical.map((match) => match.key)
		),
		eq(matches.collectionToken, job.leaseToken),
		fence
	);
	const rollup = db
		.select({
			day: matches.day,
			eventId: matches.eventId,
			mapName: sql<string>`MAX(${matches.mapName})`.as("mapName"),
			mode: matches.mode,
			brawlerId: sql<number>`json_extract(participant.value,'$.brawlerId')`.as("brawlerId"),
			trophyRange: trophyRange.as("trophy_range"),
			picks: count().as("picks"),
			wins: sql<number>`SUM(json_extract(participant.value,'$.result')='victory')`.as("wins"),
			losses: sql<number>`SUM(json_extract(participant.value,'$.result')='defeat')`.as("losses"),
			draws: sql<number>`SUM(json_extract(participant.value,'$.result')='draw')`.as("draws"),
			trophiesSum: sql<number>`SUM(COALESCE(json_extract(participant.value,'$.trophies'),0))`.as("trophiesSum"),
			trophiesSamples: sql<number>`SUM(json_extract(participant.value,'$.trophies') IS NOT NULL)`.as("trophiesSamples"),
			starPlayers: sql<number>`SUM(COALESCE(json_extract(participant.value,'$.starPlayer'),0))`.as("starPlayers"),
			starSamples: sql<number>`SUM(json_extract(participant.value,'$.starPlayer') IS NOT NULL)`.as("starSamples"),
			durationSum: sql<number>`SUM(COALESCE(json_extract(participant.value,'$.duration'),0))`.as("durationSum"),
			durationSamples: sql<number>`SUM(json_extract(participant.value,'$.duration') IS NOT NULL)`.as("durationSamples"),
		})
		.from(matches)
		.innerJoin(participant, sql`true`)
		.where(selected)
		.groupBy(matches.day, matches.eventId, matches.mode, sql`json_extract(participant.value,'$.brawlerId')`, trophyRange);
	const aggregate = db
		.insert(buckets)
		.select(rollup)
		.onConflictDoUpdate({
			target: [buckets.day, buckets.eventId, buckets.mode, buckets.brawlerId, buckets.trophyRange],
			set: {
				picks: sql`${buckets.picks}+excluded.picks`,
				wins: sql`${buckets.wins}+excluded.wins`,
				losses: sql`${buckets.losses}+excluded.losses`,
				draws: sql`${buckets.draws}+excluded.draws`,
				trophiesSum: sql`${buckets.trophiesSum}+excluded.trophies_sum`,
				trophiesSamples: sql`${buckets.trophiesSamples}+excluded.trophies_samples`,
				starPlayers: sql`${buckets.starPlayers}+excluded.star_players`,
				starSamples: sql`${buckets.starSamples}+excluded.star_samples`,
				durationSum: sql`${buckets.durationSum}+excluded.duration_sum`,
				durationSamples: sql`${buckets.durationSamples}+excluded.duration_samples`,
			},
		});
	const distinctRanges = db
		.selectDistinct({
			battleKey: matches.battleKey,
			day: matches.day,
			eventId: matches.eventId,
			mode: matches.mode,
			trophyRange: trophyRange.as("trophy_range"),
		})
		.from(matches)
		.innerJoin(participant, sql`true`)
		.where(selected)
		.as("distinct_ranges");
	const ranges = db
		.insert(matchRanges)
		.select(
			db
				.select({
					day: distinctRanges.day,
					eventId: distinctRanges.eventId,
					mode: distinctRanges.mode,
					trophyRange: distinctRanges.trophyRange,
					matches: count().as("matches"),
				})
				.from(distinctRanges)
				.where(sql`true`)
				.groupBy(distinctRanges.day, distinctRanges.eventId, distinctRanges.mode, sql`${distinctRanges.trophyRange}`)
		)
		.onConflictDoUpdate({
			target: [matchRanges.day, matchRanges.eventId, matchRanges.mode, matchRanges.trophyRange],
			set: { matches: sql`${matchRanges.matches}+excluded.matches` },
		});
	const samples = canonical.flatMap((match) =>
		match.participants
			.filter((player) => player.tag === job.tag)
			.flatMap((player) =>
				(loadouts?.get(player.brawlerId) ?? []).map((item) => ({
					battleKey: match.key,
					playerTag: player.tag,
					kind: item.kind,
					equipmentId: item.id,
					day: Math.floor(match.battleTime / DAY_MS) * DAY_MS,
					eventId: match.eventId,
					mode: match.mode,
					brawlerId: player.brawlerId,
					trophyRange:
						player.trophies === null
							? "unknown"
							: player.trophies < 500
								? "0-499"
								: player.trophies < 1000
									? "500-999"
									: "1000+",
					result: player.result,
					collectionToken: job.leaseToken,
					profileObservedAt: now,
				}))
			)
	);
	const kitSamples = db
		.insert(equipmentSamples)
		.select(
			db
				.select({
					battleKey: sql<string>`json_extract(value,'$.battleKey')`.as("battleKey"),
					playerTag: sql<string>`json_extract(value,'$.playerTag')`.as("playerTag"),
					kind: sql<"gadget" | "starPower" | "gear">`json_extract(value,'$.kind')`.as("kind"),
					equipmentId: sql<number>`json_extract(value,'$.equipmentId')`.as("equipmentId"),
					day: sql<number>`json_extract(value,'$.day')`.as("day"),
					eventId: sql<number>`json_extract(value,'$.eventId')`.as("eventId"),
					mode: sql<string>`json_extract(value,'$.mode')`.as("mode"),
					brawlerId: sql<number>`json_extract(value,'$.brawlerId')`.as("brawlerId"),
					trophyRange: sql<string>`json_extract(value,'$.trophyRange')`.as("trophyRange"),
					result: sql<string>`json_extract(value,'$.result')`.as("result"),
					collectionToken: sql<string>`${job.leaseToken}`.as("collectionToken"),
					profileObservedAt: sql<number>`${now}`.as("profileObservedAt"),
				})
				.from(sql`json_each(${JSON.stringify(samples)})`)
				.where(
					and(
						fence,
						exists(
							db
								.select({ key: matches.battleKey })
								.from(matches)
								.where(eq(matches.battleKey, sql`json_extract(value,'$.battleKey')`))
						)
					)
				)
		)
		.onConflictDoNothing();
	const kitRollup = db
		.select({
			day: equipmentSamples.day,
			eventId: equipmentSamples.eventId,
			mode: equipmentSamples.mode,
			brawlerId: equipmentSamples.brawlerId,
			trophyRange: equipmentSamples.trophyRange,
			kind: equipmentSamples.kind,
			equipmentId: equipmentSamples.equipmentId,
			picks: count().as("picks"),
			wins: sql<number>`SUM(${equipmentSamples.result}='victory')`.as("wins"),
			losses: sql<number>`SUM(${equipmentSamples.result}='defeat')`.as("losses"),
			draws: sql<number>`SUM(${equipmentSamples.result}='draw')`.as("draws"),
		})
		.from(equipmentSamples)
		.where(and(eq(equipmentSamples.collectionToken, job.leaseToken), fence))
		.groupBy(
			equipmentSamples.day,
			equipmentSamples.eventId,
			equipmentSamples.mode,
			equipmentSamples.brawlerId,
			equipmentSamples.trophyRange,
			equipmentSamples.kind,
			equipmentSamples.equipmentId
		);
	const kits = db
		.insert(equipmentDaily)
		.select(kitRollup)
		.onConflictDoUpdate({
			target: [
				equipmentDaily.day,
				equipmentDaily.eventId,
				equipmentDaily.mode,
				equipmentDaily.brawlerId,
				equipmentDaily.trophyRange,
				equipmentDaily.kind,
				equipmentDaily.equipmentId,
			],
			set: {
				picks: sql`${equipmentDaily.picks}+excluded.picks`,
				wins: sql`${equipmentDaily.wins}+excluded.wins`,
				losses: sql`${equipmentDaily.losses}+excluded.losses`,
				draws: sql`${equipmentDaily.draws}+excluded.draws`,
			},
		});
	const complete = db
		.update(trackedPlayers)
		.set({
			lastSuccessAt: now,
			lastBattleAt:
				newest === null ? tracked.last_battle_at : sql`MAX(COALESCE(${trackedPlayers.lastBattleAt},0),${newest})`,
			nextPollAt: nextPollAt(newest, minimumIntervalMs, now),
			consecutiveFailures: 0,
			leaseToken: null,
			leaseUntil: 0,
		})
		.where(leaseFence(job, now));
	const result = await db.batch([collection, inserted, aggregate, ranges, kitSamples, kits, complete]);
	return (result[0].meta.changes ?? 0) > 0;
}
/** Run at most once per day. History never expires; only bounded raw batches are removed. */
export async function pruneStats(binding: D1Database, now = Date.now()): Promise<number> {
	const db = statsDatabase(binding),
		cutoff = Math.floor(now / DAY_MS) * DAY_MS - RAW_RETENTION_DAYS * DAY_MS;
	const results = await db.batch([
		db
			.delete(matches)
			.where(
				inArray(
					matches.battleKey,
					db.select({ key: matches.battleKey }).from(matches).where(lt(matches.battleTime, cutoff)).limit(50)
				)
			),
		db
			.delete(collections)
			.where(
				inArray(
					collections.leaseToken,
					db
						.select({ key: collections.leaseToken })
						.from(collections)
						.where(lt(collections.observedAt, cutoff))
						.limit(50)
				)
			),
	]);
	return results.at(-1)?.meta.size_after ?? 0;
}
