-- Keep existing totals intact. Historical observations without archived trophy data stay unclassified.
ALTER TABLE match_participants ADD COLUMN trophies INTEGER CHECK (trophies IS NULL OR trophies >= 0);
ALTER TABLE match_participants ADD COLUMN star_player INTEGER CHECK (star_player IS NULL OR star_player IN (0, 1));
ALTER TABLE match_participants ADD COLUMN duration INTEGER CHECK (duration IS NULL OR duration >= 0);
ALTER TABLE collections ADD COLUMN enriched_at INTEGER;
ALTER TABLE collections ADD COLUMN enrichment_until INTEGER NOT NULL DEFAULT 0;
CREATE INDEX collections_enrichment ON collections(enriched_at, enrichment_until, observed_at);
CREATE TABLE brawler_daily_buckets (
 day INTEGER NOT NULL, event_id INTEGER NOT NULL, map_name TEXT NOT NULL, mode TEXT NOT NULL,
 brawler_id INTEGER NOT NULL, trophy_range TEXT NOT NULL CHECK (trophy_range IN ('unknown', '0-499', '500-999', '1000+')),
 picks INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0, trophies_sum INTEGER NOT NULL DEFAULT 0, trophies_samples INTEGER NOT NULL DEFAULT 0, star_players INTEGER NOT NULL DEFAULT 0, star_samples INTEGER NOT NULL DEFAULT 0, duration_sum INTEGER NOT NULL DEFAULT 0, duration_samples INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day, event_id, mode, brawler_id, trophy_range)
);
CREATE INDEX brawler_buckets_map ON brawler_daily_buckets(event_id, day, trophy_range, mode, brawler_id);
INSERT INTO brawler_daily_buckets(day,event_id,map_name,mode,brawler_id,trophy_range,picks,wins,losses,draws)
 SELECT day,event_id,map_name,mode,brawler_id,'unknown',picks,wins,losses,draws FROM brawler_daily_stats;
CREATE TABLE match_daily_ranges (
 day INTEGER NOT NULL, event_id INTEGER NOT NULL, mode TEXT NOT NULL, trophy_range TEXT NOT NULL,
 matches INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,event_id,mode,trophy_range)
);
INSERT INTO match_daily_ranges(day,event_id,mode,trophy_range,matches)
 SELECT day,event_id,mode,'unknown',SUM(picks)/6 FROM brawler_daily_stats GROUP BY day,event_id,mode;

CREATE TRIGGER aggregate_bucket_insert AFTER INSERT ON match_participants
BEGIN
 INSERT INTO brawler_daily_buckets(day, event_id, map_name, mode, brawler_id, trophy_range, picks, wins, losses, draws, trophies_sum, trophies_samples, star_players, star_samples, duration_sum, duration_samples)
 SELECT day, event_id, map_name, mode, NEW.brawler_id, CASE WHEN NEW.trophies IS NULL THEN 'unknown' WHEN NEW.trophies < 500 THEN '0-499' WHEN NEW.trophies < 1000 THEN '500-999' ELSE '1000+' END, 1, NEW.result = 'victory', NEW.result = 'defeat', NEW.result = 'draw', COALESCE(NEW.trophies, 0), NEW.trophies IS NOT NULL, COALESCE(NEW.star_player, 0), NEW.star_player IS NOT NULL, COALESCE(NEW.duration, 0), NEW.duration IS NOT NULL
 FROM matches WHERE battle_key = NEW.battle_key
 ON CONFLICT(day, event_id, mode, brawler_id, trophy_range) DO UPDATE SET
 picks = picks + excluded.picks, wins = wins + excluded.wins, losses = losses + excluded.losses, draws = draws + excluded.draws, trophies_sum = trophies_sum + excluded.trophies_sum, trophies_samples = trophies_samples + excluded.trophies_samples, star_players = star_players + excluded.star_players, star_samples = star_samples + excluded.star_samples, duration_sum = duration_sum + excluded.duration_sum, duration_samples = duration_samples + excluded.duration_samples;
 INSERT INTO match_daily_ranges(day,event_id,mode,trophy_range,matches)
 SELECT day,event_id,mode,CASE WHEN NEW.trophies IS NULL THEN 'unknown' WHEN NEW.trophies < 500 THEN '0-499' WHEN NEW.trophies < 1000 THEN '500-999' ELSE '1000+' END,1 FROM matches WHERE battle_key=NEW.battle_key
 AND (SELECT COUNT(*) FROM match_participants p WHERE p.battle_key=NEW.battle_key AND CASE WHEN p.trophies IS NULL THEN 'unknown' WHEN p.trophies < 500 THEN '0-499' WHEN p.trophies < 1000 THEN '500-999' ELSE '1000+' END=CASE WHEN NEW.trophies IS NULL THEN 'unknown' WHEN NEW.trophies < 500 THEN '0-499' WHEN NEW.trophies < 1000 THEN '500-999' ELSE '1000+' END)=1
 ON CONFLICT(day,event_id,mode,trophy_range) DO UPDATE SET matches=matches+1;
END;

-- Enrichment moves a contribution between bands without counting the match or pick again.
CREATE TRIGGER aggregate_bucket_update AFTER UPDATE OF trophies, star_player, duration ON match_participants
BEGIN
 UPDATE brawler_daily_buckets SET picks = picks - (1), wins = wins - (OLD.result = 'victory'), losses = losses - (OLD.result = 'defeat'), draws = draws - (OLD.result = 'draw'), trophies_sum = trophies_sum - (COALESCE(OLD.trophies, 0)), trophies_samples = trophies_samples - (OLD.trophies IS NOT NULL), star_players = star_players - (COALESCE(OLD.star_player, 0)), star_samples = star_samples - (OLD.star_player IS NOT NULL), duration_sum = duration_sum - (COALESCE(OLD.duration, 0)), duration_samples = duration_samples - (OLD.duration IS NOT NULL)
 WHERE (day,event_id,mode)=(SELECT day,event_id,mode FROM matches WHERE battle_key=OLD.battle_key)
 AND brawler_id=OLD.brawler_id AND trophy_range=CASE WHEN OLD.trophies IS NULL THEN 'unknown' WHEN OLD.trophies < 500 THEN '0-499' WHEN OLD.trophies < 1000 THEN '500-999' ELSE '1000+' END;
 INSERT INTO brawler_daily_buckets(day, event_id, map_name, mode, brawler_id, trophy_range, picks, wins, losses, draws, trophies_sum, trophies_samples, star_players, star_samples, duration_sum, duration_samples)
 SELECT day, event_id, map_name, mode, NEW.brawler_id, CASE WHEN NEW.trophies IS NULL THEN 'unknown' WHEN NEW.trophies < 500 THEN '0-499' WHEN NEW.trophies < 1000 THEN '500-999' ELSE '1000+' END, 1, NEW.result = 'victory', NEW.result = 'defeat', NEW.result = 'draw', COALESCE(NEW.trophies, 0), NEW.trophies IS NOT NULL, COALESCE(NEW.star_player, 0), NEW.star_player IS NOT NULL, COALESCE(NEW.duration, 0), NEW.duration IS NOT NULL
 FROM matches WHERE battle_key = NEW.battle_key
 ON CONFLICT(day, event_id, mode, brawler_id, trophy_range) DO UPDATE SET
 picks = picks + excluded.picks, wins = wins + excluded.wins, losses = losses + excluded.losses, draws = draws + excluded.draws, trophies_sum = trophies_sum + excluded.trophies_sum, trophies_samples = trophies_samples + excluded.trophies_samples, star_players = star_players + excluded.star_players, star_samples = star_samples + excluded.star_samples, duration_sum = duration_sum + excluded.duration_sum, duration_samples = duration_samples + excluded.duration_samples;
 DELETE FROM brawler_daily_buckets WHERE picks=0 AND brawler_id=OLD.brawler_id
 AND (day,event_id,mode)=(SELECT day,event_id,mode FROM matches WHERE battle_key=OLD.battle_key);
 UPDATE match_daily_ranges SET matches=matches-1
 WHERE (day,event_id,mode)=(SELECT day,event_id,mode FROM matches WHERE battle_key=OLD.battle_key)
 AND trophy_range=CASE WHEN OLD.trophies IS NULL THEN 'unknown' WHEN OLD.trophies < 500 THEN '0-499' WHEN OLD.trophies < 1000 THEN '500-999' ELSE '1000+' END AND CASE WHEN OLD.trophies IS NULL THEN 'unknown' WHEN OLD.trophies < 500 THEN '0-499' WHEN OLD.trophies < 1000 THEN '500-999' ELSE '1000+' END<>CASE WHEN NEW.trophies IS NULL THEN 'unknown' WHEN NEW.trophies < 500 THEN '0-499' WHEN NEW.trophies < 1000 THEN '500-999' ELSE '1000+' END
 AND NOT EXISTS(SELECT 1 FROM match_participants p WHERE p.battle_key=NEW.battle_key AND CASE WHEN p.trophies IS NULL THEN 'unknown' WHEN p.trophies < 500 THEN '0-499' WHEN p.trophies < 1000 THEN '500-999' ELSE '1000+' END=CASE WHEN OLD.trophies IS NULL THEN 'unknown' WHEN OLD.trophies < 500 THEN '0-499' WHEN OLD.trophies < 1000 THEN '500-999' ELSE '1000+' END);
 INSERT INTO match_daily_ranges(day,event_id,mode,trophy_range,matches)
 SELECT day,event_id,mode,CASE WHEN NEW.trophies IS NULL THEN 'unknown' WHEN NEW.trophies < 500 THEN '0-499' WHEN NEW.trophies < 1000 THEN '500-999' ELSE '1000+' END,1 FROM matches WHERE battle_key=NEW.battle_key
 AND CASE WHEN OLD.trophies IS NULL THEN 'unknown' WHEN OLD.trophies < 500 THEN '0-499' WHEN OLD.trophies < 1000 THEN '500-999' ELSE '1000+' END<>CASE WHEN NEW.trophies IS NULL THEN 'unknown' WHEN NEW.trophies < 500 THEN '0-499' WHEN NEW.trophies < 1000 THEN '500-999' ELSE '1000+' END
 AND (SELECT COUNT(*) FROM match_participants p WHERE p.battle_key=NEW.battle_key AND CASE WHEN p.trophies IS NULL THEN 'unknown' WHEN p.trophies < 500 THEN '0-499' WHEN p.trophies < 1000 THEN '500-999' ELSE '1000+' END=CASE WHEN NEW.trophies IS NULL THEN 'unknown' WHEN NEW.trophies < 500 THEN '0-499' WHEN NEW.trophies < 1000 THEN '500-999' ELSE '1000+' END)=1
 ON CONFLICT(day,event_id,mode,trophy_range) DO UPDATE SET matches=matches+1;
END;
