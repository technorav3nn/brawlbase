import type { BrawlStarsClient } from "@brawlbase/brawl-stars-api";
import type { StatsDatabase } from "./stats/clickhouse.ts";
import { normalizeTag } from "./stats/identity.ts";

const SEED_PAGE_SIZE = 1000;
export interface PlayerSeedPage {
	tags: string[];
	start: number;
	total: number;
	limit: number;
	expiresAt: number;
}

/** Keeps registry reads bounded; the coordinator caches only its current page. */
export async function playerSeeds(
	database: StatsDatabase,
	api: BrawlStarsClient,
	limit: number,
	cursor: number,
	now: number
): Promise<PlayerSeedPage> {
	const count = await database.query<{ total: number }>(
		"SELECT count() AS total FROM (SELECT tag FROM tracked_players FINAL WHERE enabled = 1 LIMIT {limit:UInt32})",
		{ limit }
	);
	let total = count[0]?.total ?? 0;
	if (!total) {
		const board = await api.rankings.players.getPlayersRanking("global", Math.min(limit, 1000));
		const tags = [...new Set(board.map((player) => normalizeTag(player.tag)))].slice(0, limit);
		if (!tags.length) throw new Error("Leaderboard did not provide player seeds");
		const payload =
			tags.map((tag) => JSON.stringify({ tag, seed_source: "players:global", added_at_ms: now, enabled: 1 })).join("\n") +
			"\n";
		await database.insert("tracked_players", payload, crypto.randomUUID());
		total = tags.length;
	}
	const start = Math.floor((cursor % total) / SEED_PAGE_SIZE) * SEED_PAGE_SIZE;
	const saved = await database.query<{ tag: string }>(
		"SELECT tag FROM tracked_players FINAL WHERE enabled = 1 ORDER BY tag LIMIT {size:UInt32} OFFSET {offset:UInt32}",
		{ size: Math.min(SEED_PAGE_SIZE, total - start), offset: start }
	);
	if (!saved.length) throw new Error("Player registry changed during pagination; retry collection");
	return { tags: saved.map((row) => normalizeTag(row.tag)), start, total, limit, expiresAt: now + 3_600_000 };
}
