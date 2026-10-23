-- Apply only to the standalone STATS_DB, never to NuxtHub's application database.
CREATE TABLE tracked_players (
	tag TEXT PRIMARY KEY,
	seed_source TEXT NOT NULL,
	tracked_since INTEGER NOT NULL,
	next_poll_at INTEGER NOT NULL,
	lease_token TEXT,
	lease_until INTEGER NOT NULL DEFAULT 0,
	last_success_at INTEGER,
	last_battle_at INTEGER,
	consecutive_failures INTEGER NOT NULL DEFAULT 0,
	enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);
CREATE INDEX tracked_players_due ON tracked_players(enabled, next_poll_at, lease_until);

CREATE TABLE seed_sources (
	id TEXT PRIMARY KEY,
	country TEXT NOT NULL,
	brawler_id INTEGER,
	last_success_at INTEGER,
	next_seed_at INTEGER NOT NULL DEFAULT 0,
	lease_token TEXT,
	lease_until INTEGER NOT NULL DEFAULT 0,
	players_seen INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tracker_state (
	id TEXT PRIMARY KEY,
	next_run_at INTEGER NOT NULL DEFAULT 0,
	lease_token TEXT,
	lease_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE collections (
	lease_token TEXT PRIMARY KEY,
	tag TEXT NOT NULL,
	observed_at INTEGER NOT NULL,
	oldest_battle_at INTEGER,
	newest_battle_at INTEGER,
	battles_seen INTEGER NOT NULL,
	eligible_battles INTEGER NOT NULL,
	possible_gap INTEGER NOT NULL CHECK (possible_gap IN (0, 1)),
	archive_key TEXT NOT NULL
);
CREATE INDEX collections_time ON collections(observed_at);

CREATE TABLE collection_daily_stats (
	day INTEGER PRIMARY KEY,
	collection_count INTEGER NOT NULL,
	possible_gaps INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TRIGGER aggregate_collection AFTER INSERT ON collections
BEGIN
	INSERT INTO collection_daily_stats(day, collection_count, possible_gaps, updated_at)
	VALUES ((NEW.observed_at / 86400000) * 86400000, 1, NEW.possible_gap, NEW.observed_at)
	ON CONFLICT(day) DO UPDATE SET collection_count = collection_count + 1,
		possible_gaps = possible_gaps + excluded.possible_gaps, updated_at = MAX(updated_at, excluded.updated_at);
END;

CREATE TABLE matches (
	battle_key TEXT PRIMARY KEY,
	battle_time INTEGER NOT NULL,
	day INTEGER NOT NULL,
	event_id INTEGER NOT NULL,
	map_name TEXT NOT NULL,
	mode TEXT NOT NULL,
	collection_token TEXT NOT NULL
);
CREATE INDEX matches_time ON matches(battle_time);

CREATE TABLE match_participants (
	battle_key TEXT NOT NULL REFERENCES matches(battle_key) ON DELETE CASCADE,
	player_tag TEXT NOT NULL,
	brawler_id INTEGER NOT NULL,
	team INTEGER NOT NULL CHECK (team IN (0, 1)),
	result TEXT NOT NULL CHECK (result IN ('victory', 'defeat', 'draw')),
	PRIMARY KEY (battle_key, player_tag)
);

CREATE TABLE brawler_daily_stats (
	day INTEGER NOT NULL,
	event_id INTEGER NOT NULL,
	map_name TEXT NOT NULL,
	mode TEXT NOT NULL,
	brawler_id INTEGER NOT NULL,
	picks INTEGER NOT NULL DEFAULT 0,
	wins INTEGER NOT NULL DEFAULT 0,
	losses INTEGER NOT NULL DEFAULT 0,
	draws INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, event_id, mode, brawler_id)
);

-- A participant can be inserted once. Its rollup is updated in the same transaction.
CREATE TRIGGER aggregate_brawler_pick AFTER INSERT ON match_participants
BEGIN
	INSERT INTO brawler_daily_stats(day, event_id, map_name, mode, brawler_id, picks, wins, losses, draws)
	SELECT day, event_id, map_name, mode, NEW.brawler_id, 1,
		NEW.result = 'victory', NEW.result = 'defeat', NEW.result = 'draw'
	FROM matches WHERE battle_key = NEW.battle_key
	ON CONFLICT(day, event_id, mode, brawler_id) DO UPDATE SET
		picks = picks + 1, wins = wins + excluded.wins,
		losses = losses + excluded.losses, draws = draws + excluded.draws;
END;
