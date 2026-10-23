import { getEquipmentStats } from "@brawlbase/tracker";
import { z } from "zod";
import { getStatsDatabase } from "../../../utils/brawler-stats";
import { performanceFiltersSchema } from "../../../utils/performance-filters";

export default defineCachedEventHandler(
	async (event) => {
		const id = z.coerce.number().int().positive().safeParse(getRouterParam(event, "id"));
		const filters = performanceFiltersSchema
			.extend({ eventId: z.coerce.number().int().positive().optional() })
			.safeParse(getQuery(event));
		if (!id.success || !filters.success)
			throw createError({ statusCode: 400, statusMessage: "Invalid equipment statistics filters" });
		return getEquipmentStats(getStatsDatabase(event), id.data, filters.data);
	},
	{ name: "clickhouse-equipment-stats-v1", maxAge: 900, swr: true }
);
