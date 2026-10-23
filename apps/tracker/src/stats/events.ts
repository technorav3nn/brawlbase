import type { InferredEquipment } from "./loadouts.ts";
import type { CanonicalMatch } from "./types.ts";

/** Flat NDJSON contract for batched, direct ClickHouse inserts. */
export interface StatisticsEvent {
	schema_version: 1;
	kind: "participant" | "equipment" | "collection";
	event_key: string;
	match_key: string;
	battle_time_ms: number;
	observed_at_ms: number;
	event_id: number;
	map_name: string;
	mode: string;
	player_tag: string;
	brawler_id: number;
	team: number;
	result: string;
	trophies: number | null;
	star_player: number | null;
	duration: number | null;
	equipment_kind: string;
	equipment_id: number;
	possible_gap: number;
	battles_seen: number;
	eligible_battles: number;
	population: number;
}

export function collectionEvent(tag: string, token: string, observedAt: number, population: number): StatisticsEvent {
	return {
		schema_version: 1,
		kind: "collection",
		event_key: token,
		match_key: "",
		battle_time_ms: observedAt,
		observed_at_ms: observedAt,
		event_id: 0,
		map_name: "",
		mode: "",
		player_tag: tag,
		brawler_id: 0,
		team: 0,
		result: "",
		trophies: null,
		star_player: null,
		duration: null,
		equipment_kind: "",
		equipment_id: 0,
		possible_gap: 0,
		battles_seen: 0,
		eligible_battles: 0,
		population,
	};
}

export function matchEvents(
	match: CanonicalMatch,
	collection: StatisticsEvent,
	loadouts: Map<number, InferredEquipment[]>
): StatisticsEvent[] {
	return match.participants.flatMap((player) => {
		const participant: StatisticsEvent = {
			...collection,
			kind: "participant",
			event_key: `${match.key}:${player.tag}`,
			match_key: match.key,
			battle_time_ms: match.battleTime,
			event_id: match.eventId,
			map_name: match.map,
			mode: match.mode,
			player_tag: player.tag,
			brawler_id: player.brawlerId,
			team: player.team,
			result: player.result,
			trophies: player.trophies,
			star_player: player.starPlayer === null ? null : Number(player.starPlayer),
			duration: player.duration,
		};
		if (player.tag !== collection.player_tag) return [participant];
		return [
			participant,
			...(loadouts.get(player.brawlerId) ?? []).map(
				(item): StatisticsEvent => ({
					...participant,
					kind: "equipment",
					event_key: `${participant.event_key}:${item.kind}`,
					equipment_kind: item.kind,
					equipment_id: item.id,
				})
			),
		];
	});
}
