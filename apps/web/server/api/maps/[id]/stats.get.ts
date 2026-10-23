import { getMapStats } from "@brawlbase/tracker";
import { z } from "zod";
import { getStatsDatabase } from "../../../utils/brawler-stats";
import { performanceFiltersSchema } from "../../../utils/performance-filters";

const querySchema = performanceFiltersSchema;

export default defineCachedEventHandler(
	async (event) => {
		const mapId = z.coerce.number().int().positive().max(2_147_483_647).safeParse(getRouterParam(event, "id"));
		const filters = querySchema.safeParse(getQuery(event));
		if (!mapId.success || !filters.success) {
			throw createError({ statusCode: 400, statusMessage: "Invalid map statistics filters" });
		}
		const view = await getMapStats(getStatsDatabase(event), mapId.data, filters.data).catch(() => {
			console.warn("Map statistics query failed", { mapId: mapId.data });
			throw createError({ statusCode: 503, statusMessage: "Map statistics are unavailable" });
		});
		setHeader(event, "Cache-Control", "public, max-age=900, s-maxage=900");
		return view;
	},
	{ name: "clickhouse-map-stats-v1", maxAge: 900, swr: true }
);
