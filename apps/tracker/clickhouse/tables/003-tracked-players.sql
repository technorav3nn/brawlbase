CREATE TABLE IF NOT EXISTS brawlbase_stats.tracked_players
(
	tag String,
	seed_source LowCardinality(String),
	added_at_ms UInt64,
	enabled UInt8
)
ENGINE = ReplacingMergeTree(added_at_ms)
ORDER BY tag
