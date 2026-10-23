export type WinRateTier = "S" | "A" | "B" | "C" | "D" | "F";
export const MIN_TIER_RESULTS = 200;
export const S_TIER_WIN_RATE = 0.62;

/** Approximate 95% Wilson interval for decisive participant results, not a skill-adjusted rating. */
export function winRateInterval(wins: number, losses: number): [number, number] | null {
	const n = wins + losses;
	if (!n) return null;
	const z = 1.959963984540054;
	const rate = wins / n;
	const denominator = 1 + (z * z) / n;
	const center = (rate + (z * z) / (2 * n)) / denominator;
	const margin = (z * Math.sqrt((rate * (1 - rate)) / n + (z * z) / (4 * n * n))) / denominator;
	return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

/** Lower endpoint of the approximate 95% Wilson interval; use rate is never an input. */
export function winRateScore(wins: number, losses: number): number | null {
	if (wins + losses < MIN_TIER_RESULTS) return null;
	return winRateInterval(wins, losses)?.[0] ?? null;
}

/** Tier thresholds apply to the conservative score. Small samples remain unrated. */
export function winRateTier(wins: number, losses: number): WinRateTier | null {
	const score = winRateScore(wins, losses);
	if (score === null) return null;
	if (score >= S_TIER_WIN_RATE) return "S";
	if (score >= 0.55) return "A";
	if (score >= 0.5) return "B";
	if (score >= 0.45) return "C";
	if (score >= 0.4) return "D";
	return "F";
}
