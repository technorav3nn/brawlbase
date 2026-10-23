export interface TrackerSettings {
	COLLECTION_ENABLED?: string;
	POLLS_PER_RUN?: string;
	MONTHLY_WRITE_BUDGET?: string;
	DAILY_WRITE_BUDGET?: string;
}
function integer(input: string | undefined, fallback: number, maximum: number) {
	const value = input === undefined ? fallback : Number(input);
	if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error("Invalid tracker limit");
	return value;
}
export function trackerConfig(env: TrackerSettings) {
	return {
		enabled: env.COLLECTION_ENABLED === "true",
		pollsPerRun: integer(env.POLLS_PER_RUN, 2, 2),
		monthlyWrites: integer(env.MONTHLY_WRITE_BUDGET, 500_000, 500_000),
		dailyWrites: integer(env.DAILY_WRITE_BUDGET, 20_000, 20_000),
		minimumIntervalMs: 24 * 60 * 60_000,
	};
}
