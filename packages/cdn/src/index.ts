const BASE_URL = "https://6f1ace09.brawlbase-cdn.pages.dev";
const BRAWLIFY_URL = `${BASE_URL}/ext`;

type PrestigeRank = (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13) & number;
type RankedRank = ("Bronze" | "Silver" | "Gold" | "Diamond" | "Mythic" | "Legendary" | "Masters" | "Pro") & string;

export const routes = {
	brawlers: (id: number) => ({
		data: `${BASE_URL}/brawlers/${id}/data.json`,
		model: `${BASE_URL}/brawler/${id}/model.webp`,
		portrait: `${BASE_URL}/brawler/${id}/portrait.webp`,
		skins: (name: string) => ({
			model: `${BASE_URL}/brawler/${id}/skin/${encodeURIComponent(name)}/model.webp`,
		}),
	}),
	gadgetIcon: (id: number) => `${BASE_URL}/gadgets/${id}.webp`,
	hyperchargeIcon: (id: number) => `${BASE_URL}/hypercharges/${id}.webp`,
	starPowerIcon: (id: number) => `${BASE_URL}/star-powers/${id}.webp`,
	gear: (name: string) => ({
		icon: `${BASE_URL}/gear/${encodeURIComponent(name)}/icon.webp`,
		data: `${BASE_URL}/gear/${encodeURIComponent(name)}/info.json`,
	}),

	brawlify: {
		prestige: {
			brawler: (id: number, rank: PrestigeRank) => `${BRAWLIFY_URL}/prestiges/brawlers/${id}/${rank}.png`,
			regular: (rank: PrestigeRank) => `${BRAWLIFY_URL}/prestiges/regular/${rank}.png`,
			tiered: (rank: PrestigeRank) => `${BRAWLIFY_URL}/prestiges/tiered/${rank}.png`,
		},
		ranked: {
			regular: (rank: RankedRank) => `${BRAWLIFY_URL}/ranked/regular/${rank}.png`,
			tiered: (rank: RankedRank) => `${BRAWLIFY_URL}/ranked/tiered/${rank}.png`,
		},
		profileIcon: (id: number) => `${BRAWLIFY_URL}/profile-icons/regular/${id}.png`,
		maps: (id: number) => `${BRAWLIFY_URL}/maps/regular/${id}.png`,
		gamemodes: (id: number) => `${BRAWLIFY_URL}/gamemodes/regular/${id}.png`,
		clubBadges: (id: number) => `${BRAWLIFY_URL}/club-badges/regular/${id}.png`,
	},
};
