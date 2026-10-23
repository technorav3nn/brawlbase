import { SUPPORTED_MODES, TROPHY_RANGES } from "@brawlbase/tracker";
import { z } from "zod";

export const performanceFiltersSchema = z.object({
	days: z.coerce
		.number()
		.pipe(z.union([z.literal(1), z.literal(7), z.literal(30)]))
		.default(7),
	mode: z.enum(SUPPORTED_MODES).optional(),
	trophyRange: z.enum(TROPHY_RANGES).optional(),
	endDate: z.iso
		.date()
		.refine((value) => value <= new Date().toISOString().slice(0, 10), "Future statistics are unavailable")
		.optional(),
});
