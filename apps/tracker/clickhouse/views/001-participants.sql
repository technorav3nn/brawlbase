-- FINAL is required: background merges alone do not guarantee accurate counts.
CREATE VIEW IF NOT EXISTS brawlbase_stats.participant_facts AS
SELECT *,
	intDiv(battle_time_ms, 86400000) * 86400000 AS day,
	multiIf(isNull(trophies), 'unknown', trophies < 500, '0-499', trophies < 1000, '500-999', '1000+') AS trophy_range
FROM brawlbase_stats.events FINAL
WHERE kind = 'participant'
