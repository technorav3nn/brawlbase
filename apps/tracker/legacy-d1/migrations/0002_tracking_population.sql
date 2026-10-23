-- Keep enrollment caps inexpensive as the cohort grows. Existing players remain enrolled.
CREATE TABLE tracking_population (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	player_count INTEGER NOT NULL CHECK (player_count >= 0)
);
INSERT INTO tracking_population(id, player_count) SELECT 1, COUNT(*) FROM tracked_players;

CREATE TRIGGER count_tracked_player_insert AFTER INSERT ON tracked_players
BEGIN
	UPDATE tracking_population SET player_count = player_count + 1 WHERE id = 1;
END;

CREATE TRIGGER count_tracked_player_delete AFTER DELETE ON tracked_players
BEGIN
	UPDATE tracking_population SET player_count = player_count - 1 WHERE id = 1;
END;
