CREATE VIEW IF NOT EXISTS brawlbase_stats.daily_buckets AS
SELECT day, event_id AS eventId, any(map_name) AS mapName, mode,
	brawler_id AS brawlerId, trophy_range AS trophyRange,
	count() AS picks,
	countIf(result = 'victory') AS wins,
	countIf(result = 'defeat') AS losses,
	countIf(result = 'draw') AS draws,
	sum(ifNull(trophies, 0)) AS trophiesSum,
	count(trophies) AS trophiesSamples,
	sum(ifNull(star_player, 0)) AS starPlayers,
	count(star_player) AS starSamples,
	sum(ifNull(duration, 0)) AS durationSum,
	count(duration) AS durationSamples
FROM brawlbase_stats.participant_facts
GROUP BY day, eventId, mode, brawlerId, trophyRange
