-- Preserve existing aggregates and raw records. New logs store one JSON payload per match.
ALTER TABLE matches ADD COLUMN participants_json TEXT;
-- The replacement collector updates the trophy buckets directly, once per batch.
-- Stop maintaining the redundant legacy rollup (the original table remains for audit).
DROP TRIGGER IF EXISTS aggregate_brawler_pick;
CREATE TABLE stats_usage_budget (period TEXT PRIMARY KEY, writes INTEGER NOT NULL DEFAULT 0, reads INTEGER NOT NULL DEFAULT 0, day TEXT NOT NULL DEFAULT '', daily_writes INTEGER NOT NULL DEFAULT 0);
CREATE TABLE equipment_daily (
 day INTEGER NOT NULL, event_id INTEGER NOT NULL, mode TEXT NOT NULL, brawler_id INTEGER NOT NULL, trophy_range TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('gadget','starPower','gear')), equipment_id INTEGER NOT NULL,
 picks INTEGER NOT NULL, wins INTEGER NOT NULL, losses INTEGER NOT NULL, draws INTEGER NOT NULL,
 PRIMARY KEY(day,event_id,mode,brawler_id,trophy_range,kind,equipment_id)
);

CREATE TABLE equipment_samples (
 battle_key TEXT NOT NULL REFERENCES matches(battle_key) ON DELETE CASCADE, player_tag TEXT NOT NULL, kind TEXT NOT NULL, equipment_id INTEGER NOT NULL,
 day INTEGER NOT NULL, event_id INTEGER NOT NULL, mode TEXT NOT NULL, brawler_id INTEGER NOT NULL, trophy_range TEXT NOT NULL, result TEXT NOT NULL,
 collection_token TEXT NOT NULL, profile_observed_at INTEGER NOT NULL,
 PRIMARY KEY(battle_key,player_tag,kind)
);
CREATE INDEX equipment_samples_collection ON equipment_samples(collection_token);
