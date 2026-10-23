import { StatsDatabase } from "@brawlbase/tracker";
import type { H3Event } from "h3";
import { z } from "zod";

const connectionSchema = z.object({
	clickhouseUrl: z.url(),
	clickhouseUsername: z.string().min(1),
	clickhousePassword: z.string().min(1),
	clickhouseDatabase: z.string().regex(/^[a-z_]\w*$/i),
});

export function getStatsDatabase(event: H3Event): StatsDatabase {
	const connection = connectionSchema.safeParse(useRuntimeConfig(event));
	if (!connection.success) throw createError({ statusCode: 503, statusMessage: "Brawler statistics are unavailable" });
	const config = connection.data;
	return new StatsDatabase({
		url: config.clickhouseUrl,
		username: config.clickhouseUsername,
		password: config.clickhousePassword,
		database: config.clickhouseDatabase,
	});
}
