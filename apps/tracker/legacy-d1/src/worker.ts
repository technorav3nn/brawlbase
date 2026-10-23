import { BrawlStarsClient, SupercellAPIClientError } from "@brawlbase/brawl-stars-api";
import type { D1Database, ExportedHandler, R2Bucket } from "@cloudflare/workers-types";
import { and, eq, lte } from "drizzle-orm";
import { collect } from "./collect.ts";
import { trackerConfig, type TrackerSettings } from "./config.ts";
import { collectionBudget } from "./stats/budget.ts";
import { statsDatabase } from "./stats/database.ts";
import { pruneStats } from "./stats/persist.ts";
import { claimDue, releaseFailedJob } from "./stats/scheduling.ts";
import { trackerState } from "./stats/schema.ts";

interface Env extends TrackerSettings {
	STATS_DB: D1Database;
	STATS_ARCHIVE: R2Bucket;
	BRAWL_STARS_API_TOKEN: string;
	BRAWL_STARS_API_BASE_URL?: string;
}

export default {
	async scheduled(_event, env) {
		const config = trackerConfig(env);
		if (!config.enabled) return;
		const budget = await collectionBudget(env.STATS_DB, config);
		if (!budget) return;
		try {
			const db = statsDatabase(budget.binding);
			const now = Date.now();
			await db.insert(trackerState).values({ id: "collection-window" }).onConflictDoNothing();
			const window = await db
				.update(trackerState)
				.set({ nextRunAt: Math.floor(now / 900_000) * 900_000 + 900_000 })
				.where(and(eq(trackerState.id, "collection-window"), lte(trackerState.nextRunAt, now)))
				.returning()
				.get();
			if (!window) return;
			await db.insert(trackerState).values({ id: "raw-cleanup" }).onConflictDoNothing();
			const cleanup = await db
				.update(trackerState)
				.set({ nextRunAt: Math.floor(now / 86_400_000) * 86_400_000 + 86_400_000 })
				.where(and(eq(trackerState.id, "raw-cleanup"), lte(trackerState.nextRunAt, now)))
				.returning()
				.get();
			if (cleanup) await pruneStats(budget.binding, now);
			const api = new BrawlStarsClient(env.BRAWL_STARS_API_TOKEN, {
				baseURL: env.BRAWL_STARS_API_BASE_URL,
				timeout: 10_000,
				retry: 0,
			});
			for (const job of await claimDue(budget.binding, config.pollsPerRun)) {
				try {
					await collect(
						{ STATS_DB: budget.binding, STATS_ARCHIVE: env.STATS_ARCHIVE },
						api,
						job,
						config.minimumIntervalMs
					);
				} catch (error) {
					const status = error instanceof SupercellAPIClientError ? error.status : null;
					await releaseFailedJob(budget.binding, job, status);
					console.warn("Statistics poll failed", { status });
				}
			}
		} finally {
			await budget.settle();
		}
	},
	// Drain deliveries from the retired queue without performing database or upstream work.
	async queue(batch) {
		batch.ackAll();
	},
} satisfies ExportedHandler<Env>;
