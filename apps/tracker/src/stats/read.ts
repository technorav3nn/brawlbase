import type { QueryParameters, StatsDatabase } from "./clickhouse.ts";
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

interface Bucket extends Totals {
	day: number;
	eventId: number;
	mapName: string;
	mode: string;
	trophyRange: string;
}
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
function queryFilter(filters: StatsFilters, now: number, rangeColumn?: "trophy_range") {
	const period = window(filters, now);
	const conditions = ["day >= {start:UInt64}", "day < {end:UInt64}"];
	const parameters: QueryParameters = { start: period.start, end: period.end };
	if (filters.mode) {
		conditions.push("mode = {mode:String}");
		parameters.mode = filters.mode;
	}
	if (filters.eventId !== undefined) {
		conditions.push("event_id = {eventId:UInt32}");
		parameters.eventId = filters.eventId;
	}
	if (rangeColumn && filters.trophyRange) {
		conditions.push("trophy_range = {trophyRange:String}");
		parameters.trophyRange = filters.trophyRange;
	}
	return { where: conditions.join(" AND "), parameters };
}
async function dailyRows(binding: StatsDatabase, filters: StatsFilters, now: number): Promise<Bucket[]> {
	const period = window(filters, now);
	return binding.query<Bucket>(
		`
 SELECT * FROM daily_buckets
 WHERE day >= {start:UInt64} AND day < {end:UInt64}
 ${filters.mode ? "AND mode = {mode:String}" : ""}
 ${filters.eventId !== undefined ? "AND eventId = {eventId:UInt32}" : ""}
 `,
		{ start: period.start, end: period.end, mode: filters.mode ?? "", eventId: filters.eventId ?? 0 }
	);
}
interface Coverage {
	updatedAt: number | null;
	possibleGaps: number;
	collectionCount: number;
	trackedPlayers: number;
	availableFrom: number | null;
}
async function getPerformanceStats(
	binding: StatsDatabase,
	brawlerId: number | null,
	filters: StatsFilters,
	now = Date.now()
): Promise<BrawlerStatsView> {
	const period = window(filters, now);
	const selected = queryFilter(filters, now, "trophy_range");
	const [observed, metadata, ranges] = await Promise.all([
		dailyRows(binding, filters, now),
		binding.query<Coverage>(
			`
   SELECT maxOrNullIf(observed_at_ms, observed_at_ms >= {start:UInt64} AND observed_at_ms < {end:UInt64}) AS updatedAt,
    sumIf(possible_gap, observed_at_ms >= {start:UInt64} AND observed_at_ms < {end:UInt64}) AS possibleGaps,
    countIf(observed_at_ms >= {start:UInt64} AND observed_at_ms < {end:UInt64}) AS collectionCount,
    argMax(population, observed_at_ms) AS trackedPlayers,
    (SELECT minOrNull(day) FROM participant_facts) AS availableFrom
   FROM events FINAL WHERE kind = 'collection'
  `,
			{ start: period.start, end: period.end }
		),
		binding.query<{ matches: number }>(
			`SELECT uniqExact(match_key) AS matches FROM participant_facts WHERE ${selected.where}`,
			selected.parameters
		),
	]);
	const cover = metadata[0];
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
		sampleMatches: ranges[0]?.matches ?? 0,
		samplePicks: totalPicks,
		unclassifiedPicks: observed.filter((row) => row.trophyRange === "unknown").reduce((n, row) => n + row.picks, 0),
		availableFrom: cover?.availableFrom ?? null,
		updatedAt: cover?.updatedAt ?? null,
		possibleGaps: Number(cover?.possibleGaps ?? 0),
		collectionCount: Number(cover?.collectionCount ?? 0),
		trackedPlayers: cover?.trackedPlayers ?? 0,
		brawlers: brawlers.sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || a.brawlerId - b.brawlerId),
		maps,
		history,
	};
}
export function getBrawlerStats(
	binding: StatsDatabase,
	brawlerId: number,
	filters: StatsFilters,
	now = Date.now()
): Promise<BrawlerStatsView> {
	return getPerformanceStats(binding, brawlerId, filters, now);
}
export async function getMapStats(
	binding: StatsDatabase,
	eventId: number,
	filters: Omit<StatsFilters, "eventId">,
	now = Date.now()
): Promise<MapStatsView> {
	const [sample, metadata] = await Promise.all([
		getPerformanceStats(binding, null, { ...filters, eventId }, now),
		binding.query<{ name: string; mode: string }>(
			`
   SELECT argMax(map_name, observed_at_ms) AS name, mode FROM participant_facts
   WHERE event_id = {eventId:UInt32} GROUP BY mode ORDER BY mode
  `,
			{ eventId }
		),
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
export async function getPerformanceSummary(binding: StatsDatabase, now = Date.now()): Promise<PerformanceSummary> {
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
export async function getEquipmentStats(binding: StatsDatabase, brawlerId: number, filters: StatsFilters, now = Date.now()) {
	const selected = queryFilter(filters, now, "trophy_range");
	const rows = await binding.query<{
		kind: "gadget" | "starPower" | "gear";
		equipmentId: number;
		picks: number;
		wins: number;
		losses: number;
		draws: number;
	}>(
		`
  SELECT equipment_kind AS kind, equipment_id AS equipmentId, count() AS picks,
   countIf(result = 'victory') AS wins, countIf(result = 'defeat') AS losses, countIf(result = 'draw') AS draws
  FROM equipment_facts WHERE brawler_id = {brawlerId:UInt32} AND ${selected.where}
  GROUP BY kind, equipmentId ORDER BY kind, equipmentId
 `,
		{ ...selected.parameters, brawlerId }
	);
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
