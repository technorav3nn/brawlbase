import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const trackedPlayers = sqliteTable(
	"tracked_players",
	{
		tag: text().primaryKey(),
		seedSource: text("seed_source").notNull(),
		trackedSince: integer("tracked_since").notNull(),
		nextPollAt: integer("next_poll_at").notNull(),
		leaseToken: text("lease_token"),
		leaseUntil: integer("lease_until").notNull().default(0),
		lastSuccessAt: integer("last_success_at"),
		lastBattleAt: integer("last_battle_at"),
		consecutiveFailures: integer("consecutive_failures").notNull().default(0),
		enabled: integer().notNull().default(1),
	},
	(table) => [index("tracked_players_due").on(table.enabled, table.nextPollAt, table.leaseUntil)]
);
export const trackerState = sqliteTable("tracker_state", {
	id: text().primaryKey(),
	nextRunAt: integer("next_run_at").notNull().default(0),
	leaseToken: text("lease_token"),
	leaseUntil: integer("lease_until").notNull().default(0),
});
export const trackingPopulation = sqliteTable("tracking_population", {
	id: integer().primaryKey(),
	playerCount: integer("player_count").notNull(),
});
export const seedSources = sqliteTable("seed_sources", {
	id: text().primaryKey(),
	country: text().notNull(),
	brawlerId: integer("brawler_id"),
	lastSuccessAt: integer("last_success_at"),
	nextSeedAt: integer("next_seed_at").notNull().default(0),
	leaseToken: text("lease_token"),
	leaseUntil: integer("lease_until").notNull().default(0),
	playersSeen: integer("players_seen").notNull().default(0),
});
export const collections = sqliteTable("collections", {
	leaseToken: text("lease_token").primaryKey(),
	tag: text().notNull(),
	observedAt: integer("observed_at").notNull(),
	oldestBattleAt: integer("oldest_battle_at"),
	newestBattleAt: integer("newest_battle_at"),
	battlesSeen: integer("battles_seen").notNull(),
	eligibleBattles: integer("eligible_battles").notNull(),
	possibleGap: integer("possible_gap").notNull(),
	archiveKey: text("archive_key").notNull(),
	enrichedAt: integer("enriched_at"),
	enrichmentUntil: integer("enrichment_until").notNull().default(0),
});
export const coverage = sqliteTable("collection_daily_stats", {
	day: integer().primaryKey(),
	collectionCount: integer("collection_count").notNull(),
	possibleGaps: integer("possible_gaps").notNull(),
	updatedAt: integer("updated_at").notNull(),
});
export const matches = sqliteTable(
	"matches",
	{
		battleKey: text("battle_key").primaryKey(),
		battleTime: integer("battle_time").notNull(),
		day: integer().notNull(),
		eventId: integer("event_id").notNull(),
		mapName: text("map_name").notNull(),
		mode: text().notNull(),
		collectionToken: text("collection_token").notNull(),
		participantsJson: text("participants_json"),
	},
	(table) => [index("matches_time").on(table.battleTime)]
);
export const buckets = sqliteTable(
	"brawler_daily_buckets",
	{
		day: integer().notNull(),
		eventId: integer("event_id").notNull(),
		mapName: text("map_name").notNull(),
		mode: text().notNull(),
		brawlerId: integer("brawler_id").notNull(),
		trophyRange: text("trophy_range").notNull(),
		picks: integer().notNull().default(0),
		wins: integer().notNull().default(0),
		losses: integer().notNull().default(0),
		draws: integer().notNull().default(0),
		trophiesSum: integer("trophies_sum").notNull().default(0),
		trophiesSamples: integer("trophies_samples").notNull().default(0),
		starPlayers: integer("star_players").notNull().default(0),
		starSamples: integer("star_samples").notNull().default(0),
		durationSum: integer("duration_sum").notNull().default(0),
		durationSamples: integer("duration_samples").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.day, table.eventId, table.mode, table.brawlerId, table.trophyRange] }),
		index("brawler_buckets_map").on(table.eventId, table.day, table.trophyRange, table.mode, table.brawlerId),
	]
);
export const matchRanges = sqliteTable(
	"match_daily_ranges",
	{
		day: integer().notNull(),
		eventId: integer("event_id").notNull(),
		mode: text().notNull(),
		trophyRange: text("trophy_range").notNull(),
		matches: integer().notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.day, table.eventId, table.mode, table.trophyRange] })]
);
export const usageBudget = sqliteTable("stats_usage_budget", {
	period: text().primaryKey(),
	writes: integer().notNull().default(0),
	reads: integer().notNull().default(0),
	day: text().notNull().default(""),
	dailyWrites: integer("daily_writes").notNull().default(0),
});
export const equipmentDaily = sqliteTable(
	"equipment_daily",
	{
		day: integer().notNull(),
		eventId: integer("event_id").notNull(),
		mode: text().notNull(),
		brawlerId: integer("brawler_id").notNull(),
		trophyRange: text("trophy_range").notNull(),
		kind: text({ enum: ["gadget", "starPower", "gear"] }).notNull(),
		equipmentId: integer("equipment_id").notNull(),
		picks: integer().notNull(),
		wins: integer().notNull(),
		losses: integer().notNull(),
		draws: integer().notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.day, table.eventId, table.mode, table.brawlerId, table.trophyRange, table.kind, table.equipmentId],
		}),
	]
);

export const equipmentSamples = sqliteTable(
	"equipment_samples",
	{
		battleKey: text("battle_key")
			.notNull()
			.references(() => matches.battleKey, { onDelete: "cascade" }),
		playerTag: text("player_tag").notNull(),
		kind: text({ enum: ["gadget", "starPower", "gear"] }).notNull(),
		equipmentId: integer("equipment_id").notNull(),
		day: integer().notNull(),
		eventId: integer("event_id").notNull(),
		mode: text().notNull(),
		brawlerId: integer("brawler_id").notNull(),
		trophyRange: text("trophy_range").notNull(),
		result: text().notNull(),
		collectionToken: text("collection_token").notNull(),
		profileObservedAt: integer("profile_observed_at").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.battleKey, table.playerTag, table.kind] }),
		index("equipment_samples_collection").on(table.collectionToken),
	]
);

export const matchParticipants = sqliteTable(
	"match_participants",
	{
		battleKey: text("battle_key")
			.notNull()
			.references(() => matches.battleKey, { onDelete: "cascade" }),
		playerTag: text("player_tag").notNull(),
		brawlerId: integer("brawler_id").notNull(),
		team: integer().notNull(),
		result: text().notNull(),
		trophies: integer(),
		starPlayer: integer("star_player"),
		duration: integer(),
	},
	(table) => [primaryKey({ columns: [table.battleKey, table.playerTag] })]
);
