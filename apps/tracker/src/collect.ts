import { SupercellAPIClientError, type BrawlStarsClient } from "@brawlbase/brawl-stars-api";
import { collectionEvent, matchEvents, type StatisticsEvent } from "./stats/events.ts";
import { canonicalMatch, normalizeTag } from "./stats/identity.ts";
import { inferProfileLoadouts, type InferredEquipment } from "./stats/loadouts.ts";
import { DAY_MS, BATTLE_LOOKBACK_DAYS, type CanonicalMatch } from "./stats/types.ts";

export interface CollectionResult {
	events: StatisticsEvent[];
	lastBattleAt: number | null;
}

/** Fetches fresh API logs only; old D1 statistics and archived payloads are never read. */
export async function collect(
	api: Pick<BrawlStarsClient, "players">,
	tag: string,
	population: number,
	lastBattleAt: number | null,
	now = Date.now()
): Promise<CollectionResult> {
	const [battles, profile] = await Promise.all([
		api.players.getPlayerBattleLog(tag),
		api.players.getPlayer(tag).catch((error: unknown) => {
			if (error instanceof SupercellAPIClientError && (error.status === 403 || error.status === 429)) throw error;
			return null;
		}),
	]);
	if (battles.length > 50) throw new Error("Unexpected battle log size");
	const times = battles.map((entry) => entry.battleTime.getTime());
	if (times.some((time) => !Number.isFinite(time) || time > now + 60_000)) throw new Error("Invalid battle time");
	const loadouts =
		profile && normalizeTag(profile.tag) === tag ? inferProfileLoadouts(profile) : new Map<number, InferredEquipment[]>();
	const cutoff = Math.floor(now / DAY_MS) * DAY_MS - BATTLE_LOOKBACK_DAYS * DAY_MS;
	const matches = (await Promise.all(battles.map((entry) => canonicalMatch(entry, tag)))).filter(
		(match): match is CanonicalMatch => match !== null && match.battleTime >= cutoff && match.battleTime <= now
	);
	const collection = collectionEvent(tag, crypto.randomUUID(), now, population);
	collection.battles_seen = battles.length;
	collection.eligible_battles = matches.length;
	collection.possible_gap = lastBattleAt !== null && times.length > 0 && Math.min(...times) > lastBattleAt ? 1 : 0;
	return {
		events: [collection, ...matches.flatMap((match) => matchEvents(match, collection, loadouts))],
		lastBattleAt: times.length ? Math.max(lastBattleAt ?? 0, ...times) : lastBattleAt,
	};
}
