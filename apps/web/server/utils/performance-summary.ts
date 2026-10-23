import { getPerformanceSummary } from "@brawlbase/tracker";
import type { H3Event } from "h3";
import { getStatsDatabase } from "./brawler-stats";

export const getCachedPerformanceSummary = defineCachedFunction(
	async (event: H3Event) => getPerformanceSummary(getStatsDatabase(event)),
	{ name: "clickhouse-performance-summary-v1", maxAge: 900, swr: true, getKey: () => "seven-days-1000-plus-wilson" }
);
