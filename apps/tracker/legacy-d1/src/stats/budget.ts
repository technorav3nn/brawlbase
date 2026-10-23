import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { and, eq, lte, or, sql } from "drizzle-orm";
import { statsDatabase } from "./database.ts";
import { usageBudget } from "./schema.ts";

// At most two logs of 50 matches, bounded input and no participant/legacy-rollup writes.
// The reservation covers inserts, indexes, aggregate upserts, and scheduler/ledger writes.
const WRITE_RESERVATION = 12_000;
export interface BudgetLimits {
	monthlyWrites: number;
	dailyWrites: number;
}
export async function collectionBudget(binding: D1Database, limits: BudgetLimits, now = Date.now()) {
	const db = statsDatabase(binding),
		date = new Date(now).toISOString(),
		month = `month:${date.slice(0, 7)}`,
		day = date.slice(0, 10);
	await db.insert(usageBudget).values({ period: month }).onConflictDoNothing();
	// One atomic row update reserves both the daily and monthly allowance across overlapping cron ticks.
	const claimed = await db
		.update(usageBudget)
		.set({
			writes: sql`${usageBudget.writes}+${WRITE_RESERVATION}`,
			day,
			dailyWrites: sql`CASE WHEN ${usageBudget.day}=${day} THEN ${usageBudget.dailyWrites}+${WRITE_RESERVATION} ELSE ${WRITE_RESERVATION} END`,
		})
		.where(
			and(
				eq(usageBudget.period, month),
				lte(usageBudget.writes, limits.monthlyWrites - WRITE_RESERVATION),
				or(sql`${usageBudget.day}<>${day}`, lte(usageBudget.dailyWrites, limits.dailyWrites - WRITE_RESERVATION))
			)
		)
		.returning()
		.get();
	if (!claimed) return null;
	let writes = 64,
		reads = 64;
	let uncertain = false;
	async function measuredResult<T>(operation: () => Promise<T>): Promise<T> {
		try {
			return await operation();
		} catch (error) {
			uncertain = true;
			throw error;
		}
	}
	const record = (result: D1Result) => {
		if (typeof result.meta.rows_written !== "number" || !Number.isFinite(result.meta.rows_written)) uncertain = true;
		writes += result.meta.rows_written ?? 0;
		reads += result.meta.rows_read ?? 0;
	};
	function statement(original: D1PreparedStatement): D1PreparedStatement {
		return new Proxy(original, {
			get(target, key) {
				if (key === "bind") return (...values: unknown[]) => statement(target.bind(...values));
				if (key === "all" || key === "run")
					return async () => {
						const result = await measuredResult(() => target[key]());
						record(result);
						return result;
					};
				if (key === "raw")
					return async (options?: { columnNames?: boolean }) => {
						const result = await measuredResult(() => target.all<Record<string, unknown>>());
						record(result);
						const names = Object.keys(result.results[0] ?? {});
						const rows = result.results.map((row) => names.map((name) => row[name]));
						return options?.columnNames ? [names, ...rows] : rows;
					};
				if (key === "first")
					return async (column?: string) => {
						const result = await measuredResult(() => target.all<Record<string, unknown>>());
						record(result);
						const row = result.results[0];
						return row ? (column ? row[column] : row) : null;
					};
				const value = Reflect.get(target, key);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
	}
	const measured = new Proxy(binding, {
		get(target, key) {
			if (key === "prepare") return (query: string) => statement(target.prepare(query));
			if (key === "batch")
				return async (statements: D1PreparedStatement[]) => {
					const results = await measuredResult(() => target.batch(statements));
					for (const result of results) record(result);
					return results;
				};
			const value = Reflect.get(target, key);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	return {
		binding: measured,
		async settle() {
			if (uncertain) return;
			await db
				.update(usageBudget)
				.set({
					writes: sql`${usageBudget.writes}-${WRITE_RESERVATION}+${writes}`,
					reads: sql`${usageBudget.reads}+${reads}`,
					dailyWrites: sql`CASE WHEN ${usageBudget.day}=${day} THEN ${usageBudget.dailyWrites}-${WRITE_RESERVATION}+${writes} ELSE ${usageBudget.dailyWrites} END`,
				})
				.where(eq(usageBudget.period, month));
		},
	};
}
