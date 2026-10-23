export interface ClickHouseTrackerSettings {
	COLLECTION_ENABLED?: string;
	POLLS_PER_RUN?: string;
	POLL_CONCURRENCY?: string;
	MAX_TRACKED_PLAYERS?: string;
	COLLECTION_STOP_AT?: string;
}

function integer(input: string | undefined, fallback: number, maximum: number) {
	const value = input === undefined ? fallback : Number(input);
	if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error("Invalid collector setting");
	return value;
}

export function clickhouseTrackerConfig(env: ClickHouseTrackerSettings, now = Date.now()) {
	const stopAt = env.COLLECTION_STOP_AT ? Date.parse(env.COLLECTION_STOP_AT) : null;
	if (stopAt !== null && !Number.isFinite(stopAt)) throw new Error("Invalid collection stop date");
	return {
		enabled: env.COLLECTION_ENABLED === "true" && (stopAt === null || now < stopAt),
		pollsPerRun: integer(env.POLLS_PER_RUN, 20, 20),
		concurrency: integer(env.POLL_CONCURRENCY, 4, 4),
		maxTrackedPlayers: integer(env.MAX_TRACKED_PLAYERS, 100_000, 100_000),
		intervalMs: 60_000,
	};
}
