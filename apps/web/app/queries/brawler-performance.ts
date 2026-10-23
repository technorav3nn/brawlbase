import type { BrawlerStatsView, StatsFilters } from "@brawlbase/tracker";

interface BrawlerPerformanceQueryInput {
	brawlerId: number;
	filters: StatsFilters;
}

export const useBrawlerPerformanceQuery = defineQueryOptions(({ brawlerId, filters }: BrawlerPerformanceQueryInput) => ({
	key: [
		"brawlers",
		brawlerId,
		"performance",
		"clickhouse-v1",
		filters.days,
		filters.mode ?? null,
		filters.eventId ?? null,
		filters.trophyRange ?? null,
		filters.endDate ?? null,
	],
	query: async () => {
		try {
			return await $fetch<BrawlerStatsView>(`/api/brawlers/${brawlerId}/stats`, { query: filters });
		} catch {
			// Nuxt can serialize this error across SSR; ofetch's FetchError carries non-serializable fields.
			throw createError({ statusCode: 503, statusMessage: "Brawler statistics are unavailable" });
		}
	},
	staleTime: 60_000,
	ssrCatchError: true,
}));
