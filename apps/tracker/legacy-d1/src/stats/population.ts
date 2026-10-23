import type { D1Database } from "@cloudflare/workers-types";
import { and, eq, exists, notExists, sql } from "drizzle-orm";
import { statsDatabase } from "./database.ts";
import { leaseFence } from "./scheduling.ts";
import { trackedPlayers, trackingPopulation } from "./schema.ts";
import type { PollJob } from "./types.ts";

/** Manual enrollment only. Automatic population expansion is disabled in the budget collector. */
export function preparePlayerSeeds(
	binding: D1Database,
	tags: string[],
	source: string,
	maxPlayers: number,
	now: number,
	job?: PollJob
) {
	const db = statsDatabase(binding);
	const remaining = db
		.select({ count: sql<number>`${maxPlayers}-${trackingPopulation.playerCount}` })
		.from(trackingPopulation)
		.where(eq(trackingPopulation.id, 1));
	return db
		.insert(trackedPlayers)
		.select(
			db
				.select({
					tag: sql<string>`value`.as("tag"),
					seedSource: sql<string>`${source}`.as("seedSource"),
					trackedSince: sql<number>`${now}`.as("trackedSince"),
					nextPollAt: sql<number>`${now}`.as("nextPollAt"),
					leaseToken: sql<null>`NULL`.as("leaseToken"),
					leaseUntil: sql<number>`0`.as("leaseUntil"),
					lastSuccessAt: sql<null>`NULL`.as("lastSuccessAt"),
					lastBattleAt: sql<null>`NULL`.as("lastBattleAt"),
					consecutiveFailures: sql<number>`0`.as("consecutiveFailures"),
					enabled: sql<number>`1`.as("enabled"),
				})
				.from(sql`json_each(${JSON.stringify(tags)})`)
				.where(
					and(
						notExists(
							db
								.select({ tag: trackedPlayers.tag })
								.from(trackedPlayers)
								.where(eq(trackedPlayers.tag, sql`value`))
						),
						job
							? exists(db.select({ tag: trackedPlayers.tag }).from(trackedPlayers).where(leaseFence(job, now)))
							: undefined,
						sql`CAST(key AS INTEGER)<MAX(0,(${remaining}))`
					)
				)
		)
		.onConflictDoNothing();
}
