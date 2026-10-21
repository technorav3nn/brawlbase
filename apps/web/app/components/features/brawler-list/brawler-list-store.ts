import type { BrawlApiBrawler } from "@brawlbase/brawl-api";
import { acceptHMRUpdate, defineStore } from "pinia";
type Mode = "Class" | "None" | "Rarity";

export const useBrawlerListStore = defineStore("brawler-list", () => {
	const search = ref("");
	const groupingMode = ref<Mode | "">("");
	const brawlers = ref<BrawlApiBrawler[]>([]);

	const groupedBrawlers = computed(() => {
		if (brawlers.value?.length === 0) return [];
		const searchedBrawlers = brawlers.value.filter((brawler) =>
			brawler.name.toLowerCase().includes(search.value.toLowerCase())
		);
		if (groupingMode.value === "None" || groupingMode.value === "") return searchedBrawlers;
		if (groupingMode.value === "Rarity") {
			const group = Object.groupBy(searchedBrawlers, (brawler) => brawler.rarity.name);
			// sort the object keys, so that the rarities are in order of rarity
			const sortedGroup = Object.fromEntries(
				Object.entries(group).sort((a, b) => {
					const rarityOrder = ["Ultra Legendary", "Legendary", "Mythic", "Epic", "Rare", "Super Rare", "Common"];
					return rarityOrder.indexOf(a[0]) - rarityOrder.indexOf(b[0]);
				})
			);
			return sortedGroup;
		}

		if (groupingMode.value === "Class") {
			return Object.groupBy(searchedBrawlers, (brawler) => brawler.class.name);
		}
	});

	return {
		setBrawlers: (newBrawlers: BrawlApiBrawler[]) => (brawlers.value = newBrawlers),
		search,
		groupedBrawlers,
		groupingMode,
	};
});

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useBrawlerListStore, import.meta.hot));
}
