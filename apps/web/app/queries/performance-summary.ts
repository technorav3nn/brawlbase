export const usePerformanceSummary = defineQuery({
	key: ["performance", "summary", "clickhouse-v1", "1000-plus-wilson"],
	query: async () => {
		try {
			return await $fetch("/api/stats/summary");
		} catch {
			throw createError({ statusCode: 503, statusMessage: "Statistics summary unavailable" });
		}
	},
	staleTime: 15 * 60_000,
	ssrCatchError: true,
});
