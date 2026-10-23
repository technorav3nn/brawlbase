import type { Player } from "@brawlbase/brawl-stars-api";

export interface InferredEquipment {
	kind: "gadget" | "starPower" | "gear";
	id: number;
}
/** Current ownership is an inference, never confirmation of a historical battle loadout. */
export function inferProfileLoadouts(profile: Player): Map<number, InferredEquipment[]> {
	const result = new Map<number, InferredEquipment[]>();
	for (const brawler of profile.brawlers) {
		const equipment: InferredEquipment[] = [];
		for (const [kind, owned] of [
			["gadget", brawler.gadgets],
			["starPower", brawler.starPowers],
			["gear", brawler.gears],
		] as const) {
			const only = owned?.length === 1 ? owned[0] : undefined;
			if (only && Number.isSafeInteger(only.id) && only.id > 0) equipment.push({ kind, id: only.id });
		}
		result.set(brawler.id, equipment);
	}
	return result;
}
