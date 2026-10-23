import type { BrawlStarsClient } from "@brawlbase/brawl-stars-api";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { getLease, normalizeTag, persistCollection, type PollJob } from "./stats/index.ts";
import { inferProfileLoadouts, type InferredEquipment } from "./stats/loadouts.ts";

export interface CollectionBindings {
	STATS_DB: D1Database;
	STATS_ARCHIVE: R2Bucket;
}

export async function collect(
	env: CollectionBindings,
	api: Pick<BrawlStarsClient, "players">,
	job: PollJob,
	minimumIntervalMs: number,
	clock: () => number = Date.now,
	maxTrackedPlayers?: number
): Promise<void> {
	if (!(await getLease(env.STATS_DB, job, clock()))) return;
	const [battles, profile] = await Promise.all([
		api.players.getPlayerBattleLog(job.tag),
		api.players.getPlayer(job.tag).catch(() => null),
	]);
	const loadouts =
		profile && normalizeTag(profile.tag) === job.tag ? inferProfileLoadouts(profile) : new Map<number, InferredEquipment[]>();
	const observedAt = clock();
	const date = new Date(observedAt).toISOString().slice(0, 10);
	const key = `brawler-stats/${date}/${job.tag.slice(1)}/${job.leaseToken}/${crypto.randomUUID()}.json`;
	await env.STATS_ARCHIVE.put(
		key,
		JSON.stringify({ version: 1, tag: job.tag, observedAt, battles, inferredLoadouts: [...loadouts] }),
		{
			httpMetadata: { contentType: "application/json" },
		}
	);
	// Archives can outlive a failed/superseded attempt; only committed collections are facts.
	await persistCollection(env.STATS_DB, job, battles, key, minimumIntervalMs, clock(), maxTrackedPlayers, loadouts);
}
