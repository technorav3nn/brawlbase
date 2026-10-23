import type { MapStatsView, StatsFilters } from "@brawlbase/tracker";

export const useMapCatalog = defineQuery({
	key: ["maps", "catalog"],
	query: async () => {
		try {
			return await $fetch("/api/maps");
		} catch {
			throw createError({ statusCode: 503, statusMessage: "Map catalog is unavailable" });
		}
	},
	staleTime: 60 * 60 * 1000,
	ssrCatchError: true,
});

interface MapPerformanceQueryInput {
	mapId: number;
	filters: Omit<StatsFilters, "eventId">;
}

export const useMapPerformanceQuery = defineQueryOptions(({ mapId, filters }: MapPerformanceQueryInput) => ({
	key: [
		"maps",
		mapId,
		"performance",
		"clickhouse-v1",
		filters.days,
		filters.mode ?? null,
		filters.trophyRange ?? null,
		filters.endDate ?? null,
	],
	query: async () => {
		try {
			return await $fetch<MapStatsView>(`/api/maps/${mapId}/stats`, { query: filters });
		} catch {
			throw createError({ statusCode: 503, statusMessage: "Map statistics are unavailable" });
		}
	},
	staleTime: 60_000,
	ssrCatchError: true,
}));
