import type { D1Database } from "@cloudflare/workers-types";
import { and, count, eq, gte, lt, max, min, sum } from "drizzle-orm";
import { statsDatabase } from "./database.ts";
import { buckets, coverage, equipmentDaily, matchRanges, trackedPlayers, trackingPopulation } from "./schema.ts";
import { MIN_TIER_RESULTS, winRateInterval } from "./statistics.ts";
import {
	DAY_MS,
	DEFAULT_STATS_TROPHY_RANGE,
	type BrawlerPerformance,
	type BrawlerStatsView,
	type DailyPerformance,
	type MapStatsView,
	type StatsFilters,
} from "./types.ts";

type Bucket = typeof buckets.$inferSelect;
interface Totals {
	brawlerId: number;
	picks: number;
	wins: number;
	losses: number;
	draws: number;
	trophiesSum: number;
	trophiesSamples: number;
	starPlayers: number;
	starSamples: number;
	durationSum: number;
	durationSamples: number;
}
const countKeys = [
	"picks",
	"wins",
	"losses",
	"draws",
	"trophiesSum",
	"trophiesSamples",
	"starPlayers",
	"starSamples",
	"durationSum",
	"durationSamples",
] as const;
function totals(rows: Bucket[]): Totals {
	const result: Totals = {
		brawlerId: rows[0]?.brawlerId ?? 0,
		picks: 0,
		wins: 0,
		losses: 0,
		draws: 0,
		trophiesSum: 0,
		trophiesSamples: 0,
		starPlayers: 0,
		starSamples: 0,
		durationSum: 0,
		durationSamples: 0,
	};
	for (const row of rows) for (const key of countKeys) result[key] += row[key];
	return result;
}
function group<T>(rows: T[], key: (row: T) => string): T[][] {
	const groups = new Map<string, T[]>();
	for (const row of rows) {
		const id = key(row);
		const list = groups.get(id);
		if (list) list.push(row);
		else groups.set(id, [row]);
	}
	return [...groups.values()];
}
function performance(row: Totals, denominator: number): BrawlerPerformance {
	const interval = winRateInterval(row.wins, row.losses);
	return {
		brawlerId: row.brawlerId,
		picks: row.picks,
		wins: row.wins,
		losses: row.losses,
		draws: row.draws,
		winRate: row.wins + row.losses ? row.wins / (row.wins + row.losses) : null,
		pickRate: denominator ? row.picks / denominator : null,
		confidenceLow: interval?.[0] ?? null,
		confidenceHigh: interval?.[1] ?? null,
		drawRate: row.picks ? row.draws / row.picks : null,
		averageTrophies: row.trophiesSamples ? row.trophiesSum / row.trophiesSamples : null,
		starPlayerRate: row.starSamples ? row.starPlayers / row.starSamples : null,
		averageDuration: row.durationSamples ? row.durationSum / row.durationSamples : null,
	};
}
function window(filters: StatsFilters, now: number) {
	const lastDay = filters.endDate ? Date.parse(`${filters.endDate}T00:00:00Z`) : Math.floor(now / DAY_MS) * DAY_MS;
	return { start: lastDay - (filters.days - 1) * DAY_MS, end: lastDay + DAY_MS };
}
async function dailyRows(binding: D1Database, filters: StatsFilters, now: number) {
	const period = window(filters, now);
	return statsDatabase(binding)
		.select()
		.from(buckets)
		.where(
			and(
				gte(buckets.day, period.start),
				lt(buckets.day, period.end),
				filters.mode ? eq(buckets.mode, filters.mode) : undefined,
				filters.eventId !== undefined ? eq(buckets.eventId, filters.eventId) : undefined
			)
		);
}
async function getPerformanceStats(
	binding: D1Database,
	brawlerId: number | null,
	filters: StatsFilters,
	now = Date.now()
): Promise<BrawlerStatsView> {
	const db = statsDatabase(binding),
		period = window(filters, now);
	const [observed, cover, population, ranges, earliest, disabled] = await Promise.all([
		dailyRows(binding, filters, now),
		db
			.select({
				updatedAt: max(coverage.updatedAt),
				possibleGaps: sum(coverage.possibleGaps),
				collectionCount: sum(coverage.collectionCount),
			})
			.from(coverage)
			.where(and(gte(coverage.day, period.start), lt(coverage.day, period.end)))
			.get(),
		db.select().from(trackingPopulation).where(eq(trackingPopulation.id, 1)).get(),
		filters.trophyRange
			? db
					.select({ matches: sum(matchRanges.matches) })
					.from(matchRanges)
					.where(
						and(
							gte(matchRanges.day, period.start),
							lt(matchRanges.day, period.end),
							eq(matchRanges.trophyRange, filters.trophyRange),
							filters.mode ? eq(matchRanges.mode, filters.mode) : undefined,
							filters.eventId !== undefined ? eq(matchRanges.eventId, filters.eventId) : undefined
						)
					)
					.get()
			: Promise.resolve(undefined),
		db
			.select({ day: min(buckets.day) })
			.from(buckets)
			.get(),
		db.select({ count: count() }).from(trackedPlayers).where(eq(trackedPlayers.enabled, 0)).get(),
	]);
	const rows = filters.trophyRange ? observed.filter((row) => row.trophyRange === filters.trophyRange) : observed;
	const totalPicks = rows.reduce((n, row) => n + row.picks, 0);
	const brawlers = group(rows, (row) => String(row.brawlerId)).map((rows) => performance(totals(rows), totalPicks));
	const maps = group(rows, (row) => `${row.eventId}:${row.mode}`)
		.flatMap((mapRows) => {
			const first = mapRows[0];
			if (!first || brawlerId === null) return [];
			const chosen = mapRows.filter((row) => row.brawlerId === brawlerId);
			if (!chosen.length) return [];
			return [
				{
					eventId: first.eventId,
					map: first.mapName,
					mode: first.mode,
					...performance(
						totals(chosen),
						mapRows.reduce((n, row) => n + row.picks, 0)
					),
				},
			];
		})
		.sort((a, b) => b.picks - a.picks);
	const history: DailyPerformance[] = group(rows, (row) => String(row.day))
		.flatMap((dayRows) => {
			const denominator = dayRows.reduce((n, row) => n + row.picks, 0);
			return group(
				dayRows.filter((row) => brawlerId === null || row.brawlerId === brawlerId),
				(row) => String(row.brawlerId)
			).map((rows) => ({ day: rows[0]?.day ?? 0, ...performance(totals(rows), denominator) }));
		})
		.sort((a, b) => a.day - b.day || a.brawlerId - b.brawlerId);
	return {
		filters,
		windowStart: period.start,
		sampleMatches: filters.trophyRange ? Number(ranges?.matches ?? 0) : totalPicks / 6,
		samplePicks: totalPicks,
		unclassifiedPicks: observed.filter((row) => row.trophyRange === "unknown").reduce((n, row) => n + row.picks, 0),
		availableFrom: earliest?.day ?? null,
		updatedAt: cover?.updatedAt ?? null,
		possibleGaps: Number(cover?.possibleGaps ?? 0),
		collectionCount: Number(cover?.collectionCount ?? 0),
		trackedPlayers: (population?.playerCount ?? 0) - (disabled?.count ?? 0),
		brawlers: brawlers.sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || a.brawlerId - b.brawlerId),
		maps,
		history,
	};
}
export function getBrawlerStats(
	binding: D1Database,
	brawlerId: number,
	filters: StatsFilters,
	now = Date.now()
): Promise<BrawlerStatsView> {
	return getPerformanceStats(binding, brawlerId, filters, now);
}
export async function getMapStats(
	binding: D1Database,
	eventId: number,
	filters: Omit<StatsFilters, "eventId">,
	now = Date.now()
): Promise<MapStatsView> {
	const [sample, metadata] = await Promise.all([
		getPerformanceStats(binding, null, { ...filters, eventId }, now),
		statsDatabase(binding)
			.select({ name: max(buckets.mapName), mode: buckets.mode })
			.from(buckets)
			.where(eq(buckets.eventId, eventId))
			.groupBy(buckets.mode),
	]);
	const { maps: _maps, ...view } = sample;
	return { ...view, map: { eventId, name: metadata[0]?.name ?? null, modes: metadata.map((row) => row.mode) } };
}
export interface PerformanceSummary {
	updatedAt: number;
	days: 7;
	trophyRange: typeof DEFAULT_STATS_TROPHY_RANGE;
	brawlers: BrawlerPerformance[];
	maps: Record<string, BrawlerPerformance[]>;
}
export async function getPerformanceSummary(binding: D1Database, now = Date.now()): Promise<PerformanceSummary> {
	const rows = (await dailyRows(binding, { days: 7 }, now)).filter((row) => row.trophyRange === DEFAULT_STATS_TROPHY_RANGE),
		total = rows.reduce((n, row) => n + row.picks, 0);
	const brawlers = group(rows, (row) => String(row.brawlerId)).map((rows) => performance(totals(rows), total));
	const maps: Record<string, BrawlerPerformance[]> = {};
	for (const mapRows of group(rows, (row) => String(row.eventId))) {
		const denominator = mapRows.reduce((n, row) => n + row.picks, 0);
		const first = mapRows[0];
		if (!first) continue;
		maps[String(first.eventId)] = group(mapRows, (row) => String(row.brawlerId))
			.map((rows) => performance(totals(rows), denominator))
			.filter((row) => row.wins + row.losses >= MIN_TIER_RESULTS)
			.sort((a, b) => (b.confidenceLow ?? -1) - (a.confidenceLow ?? -1) || a.brawlerId - b.brawlerId)
			.slice(0, 5);
	}
	return { updatedAt: now, days: 7, trophyRange: DEFAULT_STATS_TROPHY_RANGE, brawlers, maps };
}
export async function getEquipmentStats(binding: D1Database, brawlerId: number, filters: StatsFilters, now = Date.now()) {
	const period = window(filters, now);
	const rows = await statsDatabase(binding)
		.select({
			kind: equipmentDaily.kind,
			equipmentId: equipmentDaily.equipmentId,
			picks: sum(equipmentDaily.picks),
			wins: sum(equipmentDaily.wins),
			losses: sum(equipmentDaily.losses),
			draws: sum(equipmentDaily.draws),
		})
		.from(equipmentDaily)
		.where(
			and(
				eq(equipmentDaily.brawlerId, brawlerId),
				gte(equipmentDaily.day, period.start),
				lt(equipmentDaily.day, period.end),
				filters.mode ? eq(equipmentDaily.mode, filters.mode) : undefined,
				filters.eventId !== undefined ? eq(equipmentDaily.eventId, filters.eventId) : undefined,
				filters.trophyRange ? eq(equipmentDaily.trophyRange, filters.trophyRange) : undefined
			)
		)
		.groupBy(equipmentDaily.kind, equipmentDaily.equipmentId);
	const samples = rows.map((row) => ({
		...row,
		picks: Number(row.picks),
		wins: Number(row.wins),
		losses: Number(row.losses),
		draws: Number(row.draws),
	}));
	return {
		available: rows.length > 0,
		source: "profile-inferred" as const,
		items: samples.map((row) => ({
			...row,
			winRate: row.wins + row.losses ? row.wins / (row.wins + row.losses) : null,
			useRate:
				row.picks / samples.filter((sample) => sample.kind === row.kind).reduce((sum, sample) => sum + sample.picks, 0),
		})),
	};
}
