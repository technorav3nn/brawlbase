import type { StatsFilters } from "@brawlbase/tracker";
export const useEquipmentPerformanceQuery = defineQueryOptions(
	({ brawlerId, filters }: { brawlerId: number; filters: StatsFilters }) => ({
		key: [
			"performance",
			"equipment",
			"clickhouse-v1",
			brawlerId,
			filters.days,
			filters.mode ?? null,
			filters.eventId ?? null,
			filters.trophyRange ?? null,
			filters.endDate ?? null,
		],
		query: async () => {
			try {
				return await $fetch(`/api/brawlers/${brawlerId}/equipment`, { query: filters });
			} catch {
				throw createError({ statusCode: 503, statusMessage: "Equipment statistics unavailable" });
			}
		},
		staleTime: 900_000,
		ssrCatchError: true,
	})
);
