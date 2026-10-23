import type { BattleResult } from "@brawlbase/brawl-stars-api";

export const DAY_MS = 86_400_000;
export const BATTLE_LOOKBACK_DAYS = 7;
export const TROPHY_RANGES = ["0-499", "500-999", "1000+"] as const;
export type TrophyRange = (typeof TROPHY_RANGES)[number];
export const DEFAULT_STATS_TROPHY_RANGE = "1000+" satisfies TrophyRange;
export const SUPPORTED_MODES = ["gemGrab", "brawlBall", "bounty", "heist", "hotZone", "knockout", "wipeout"] as const;

export interface MatchParticipant {
	tag: string;
	brawlerId: number;
	team: number;
	result: BattleResult;
	trophies: number | null;
	starPlayer: boolean | null;
	duration: number | null;
}

export interface CanonicalMatch {
	key: string;
	battleTime: number;
	eventId: number;
	map: string;
	mode: string;
	participants: MatchParticipant[];
}

export interface StatsFilters {
	days: 1 | 7 | 30;
	mode?: string;
	eventId?: number;
	trophyRange?: TrophyRange;
	endDate?: string;
}

export interface BrawlerPerformance {
	brawlerId: number;
	picks: number;
	wins: number;
	losses: number;
	draws: number;
	/** Wins / (wins + losses). Null when no decisive results have been observed. */
	winRate: number | null;
	/** Share of all six player slots in the filtered sample, from zero to one. */
	pickRate: number | null;
	confidenceLow: number | null;
	confidenceHigh: number | null;
	drawRate: number | null;
	averageTrophies: number | null;
	starPlayerRate: number | null;
	averageDuration: number | null;
}

export interface DailyPerformance extends BrawlerPerformance {
	day: number;
}

export interface MapPerformance extends BrawlerPerformance {
	eventId: number;
	map: string;
	mode: string;
}

export interface BrawlerStatsView {
	filters: StatsFilters;
	windowStart: number;
	sampleMatches: number;
	samplePicks: number;
	unclassifiedPicks: number;
	availableFrom: number | null;
	history: DailyPerformance[];
	updatedAt: number | null;
	trackedPlayers: number;
	possibleGaps: number;
	collectionCount: number;
	brawlers: BrawlerPerformance[];
	maps: MapPerformance[];
}

export interface MapStatsView extends Omit<BrawlerStatsView, "maps"> {
	map: {
		eventId: number;
		name: string | null;
		modes: string[];
	};
}
