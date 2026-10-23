import type { BasicBrawler } from "./brawlers";
import type { Event, GameModes } from "./events";
import type { BasicPlayer, StarPlayer } from "./players";

export interface Battlelog<T = Date> {
	battle: BattlelogBattle;
	battleTime: T;
	event: Event;
}

export interface BattlelogBattle {
	duration?: number;
	mode: GameModes;
	players?: BattlelogParticipant[] | null;
	result?: BattleResult;
	rank?: number;
	starPlayer?: StarPlayer | null;
	teams?: BattlelogTeam[] | null;
	trophyChange?: number;
	type: BattleTypes;
}

export interface BattlelogParticipant extends Omit<BasicPlayer, "brawler"> {
	brawler?: BasicBrawler;
	brawlers?: BasicBrawler[];
}

export type BattlelogTeam = BattlelogParticipant[];

export interface BattlelogsResponse<T = Date> {
	items: Battlelog<T>[];
}

export type BattleResult = "defeat" | "draw" | "victory";
export type BattleTypes = "friendly" | "ranked" | (string & {});
