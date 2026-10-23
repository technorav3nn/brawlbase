import { getBrawlerStats } from "@brawlbase/tracker";
import { z } from "zod";
import { getStatsDatabase } from "../../../utils/brawler-stats";
import { performanceFiltersSchema } from "../../../utils/performance-filters";

const querySchema = performanceFiltersSchema.extend({
	eventId: z.coerce.number().int().positive().max(2_147_483_647).optional(),
});

export default defineCachedEventHandler(
	async (event) => {
		const brawlerId = z.coerce.number().int().positive().max(2_147_483_647).safeParse(getRouterParam(event, "id"));
		const filters = querySchema.safeParse(getQuery(event));
		if (!brawlerId.success || !filters.success) {
			throw createError({ statusCode: 400, statusMessage: "Invalid brawler statistics filters" });
		}
		const view = await getBrawlerStats(getStatsDatabase(event), brawlerId.data, filters.data).catch(() => {
			console.warn("Brawler statistics query failed", { brawlerId: brawlerId.data });
			throw createError({ statusCode: 503, statusMessage: "Brawler statistics are unavailable" });
		});
		setHeader(event, "Cache-Control", "public, max-age=900, s-maxage=900");
		return view;
	},
	{ name: "clickhouse-brawler-stats-v1", maxAge: 900, swr: true }
);
