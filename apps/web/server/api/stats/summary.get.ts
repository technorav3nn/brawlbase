import { getCachedPerformanceSummary } from "../../utils/performance-summary";

export default defineEventHandler(async (event) => {
	setHeader(event, "Cache-Control", "public, max-age=900, stale-while-revalidate=3600");
	return getCachedPerformanceSummary(event);
});
