import type { BrawlApiBrawler } from "@brawlbase/brawl-api";
import type { CdnBrawler } from "@brawlbase/cdn";

export const useBrawlerStore = defineStore("brawler-store", () => {
	const level = ref(11);
	const brawler = ref<BrawlApiBrawler | null>(null);
	const brawlerCdnData = ref<CdnBrawler | null>(null);

	return {
		level,
		setLevel: (newLevel: number) => (level.value = newLevel),
		brawler,
		setBrawler: (newBrawler: BrawlApiBrawler) => (brawler.value = newBrawler),
		brawlerCdnData,
		setBrawlerCdnData: (newBrawlerCdnData: CdnBrawler) => (brawlerCdnData.value = newBrawlerCdnData),
	};
});
