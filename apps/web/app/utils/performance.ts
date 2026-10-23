import type { Brawler } from "@brawlbase/brawl-stars-api";
import type { BrawlerPerformance, StatsFilters } from "@brawlbase/tracker";
import type { RouteLocationRaw } from "vue-router";
import type { PerformanceBrawler } from "#shared/types/performance";
export function joinPerformanceBrawlers(
	catalog: Pick<Brawler, "id" | "name">[] | undefined,
	performance: BrawlerPerformance[] | undefined,
	unknownName: (id: number) => string
): PerformanceBrawler[] {
	const rows = new Map<number, PerformanceBrawler>(
		catalog?.map((brawler) => [brawler.id, { id: brawler.id, name: brawler.name }])
	);
	for (const row of performance ?? [])
		rows.set(row.brawlerId, {
			id: row.brawlerId,
			name: rows.get(row.brawlerId)?.name ?? unknownName(row.brawlerId),
			performance: row,
		});
	return [...rows.values()];
}

/** Carry the sample context through navigation, including an explicit all-trophies selection. */
export function brawlerPerformanceLink(brawlerId: number, filters: StatsFilters): RouteLocationRaw {
	return {
		path: `/brawlers/${brawlerId}/stats`,
		query: { ...filters, trophyRange: filters.trophyRange ?? "all" },
	};
}
