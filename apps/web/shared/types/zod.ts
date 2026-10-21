import type { ZodType } from "zod";

export type ToZodSchema<T extends Record<string, any>> = {
	[K in keyof T]-?: ZodType<T[K]>;
};
