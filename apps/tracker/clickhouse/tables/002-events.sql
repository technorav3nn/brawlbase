-- The sorting key identifies a fact independently of collector, file, and retry.
-- Earliest observation wins, including profile-inferred equipment ownership.
CREATE TABLE IF NOT EXISTS brawlbase_stats.events
(
	schema_version UInt8,
	kind LowCardinality(String),
	event_key String,
	match_key String,
	battle_time_ms UInt64,
	observed_at_ms UInt64,
	event_id UInt32,
	map_name String,
	mode LowCardinality(String),
	player_tag String,
	brawler_id UInt32,
	team UInt8,
	result LowCardinality(String),
	trophies Nullable(UInt32),
	star_player Nullable(UInt8),
	duration Nullable(UInt32),
	equipment_kind LowCardinality(String),
	equipment_id UInt32,
	possible_gap UInt8,
	battles_seen UInt16,
	eligible_battles UInt16,
	population UInt32,
	version UInt64 MATERIALIZED 9007199254740991 - observed_at_ms
)
ENGINE = ReplacingMergeTree(version)
PARTITION BY toYYYYMM(fromUnixTimestamp64Milli(toInt64(battle_time_ms), 'UTC'))
ORDER BY (kind, toDate(fromUnixTimestamp64Milli(toInt64(battle_time_ms), 'UTC')), event_id, mode, event_key)
