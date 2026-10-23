const BASE_URL = "https://brawlbase-cdn.deathblows.workers.dev";
const BRAWLIFY_URL = `${BASE_URL}/ext`;

function brawlerImageAsset(id: number, directory: string, filename: string): string {
	const stem = filename.replace(/\.[^.]+$/, "");
	return `${BASE_URL}/brawlers/${id}/${directory}/${encodeURIComponent(stem)}.webp`;
}

type PrestigeRank = (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13) & number;
type RankedRank = ("Bronze" | "Silver" | "Gold" | "Diamond" | "Mythic" | "Legendary" | "Masters" | "Pro") & string;

export const routes = {
	brawlers: (id: number) => ({
		data: `${BASE_URL}/brawlers/${id}/data.json`,
		model: `${BASE_URL}/brawlers/${id}/model.webp`,
		portrait: `${BASE_URL}/brawlers/${id}/portrait.webp`,
		icon: `${BASE_URL}/brawlers/${id}/icon.webp`,
		pin: (filename: string) => brawlerImageAsset(id, "pins", filename),
		spray: (filename: string) => brawlerImageAsset(id, "sprays", filename),
		buffie: (filename: string) => brawlerImageAsset(id, "buffies", filename),
		buffieSkin: (filename: string) => brawlerImageAsset(id, "buffie-skins", filename),
		voiceline: (filename: string) => `${BASE_URL}/brawlers/${id}/voicelines/${encodeURIComponent(filename)}`,
		skins: (name: string) => ({
			model: `${BASE_URL}/brawlers/${id}/skins/${encodeURIComponent(name)}/model.webp`,
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
		brawler: (id: number) => ({
			borderless: `${BRAWLIFY_URL}/brawlers/borderless/${id}.png`,
			emoji: `${BRAWLIFY_URL}/brawlers/emoji/${id}.png`,
			portrait: `${BRAWLIFY_URL}/brawlers/portrait/${id}.png`,
			borders: `${BRAWLIFY_URL}/brawlers/borders/${id}.png`,
			portraits: `${BRAWLIFY_URL}/brawlers/portraits/${id}.png`,
			model: `${BRAWLIFY_URL}/brawlers/model/${id}.png`,
		}),

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

export { Kind } from "./generated/fandom";
export type {
	Accessory,
	Asset,
	Attack,
	Avatar,
	BrawlerTip,
	Buffie,
	BuffieSkin,
	CdnBrawler,
	CdnMode,
	FandomBrawlerData,
	FandomModeData,
	Gadget,
	Gear,
	GearCollection,
	GearModifierValue,
	GearRarity,
	History,
	HistoryEntry,
	Hypercharge,
	PetSkin,
	Pin,
	Power,
	Skin,
	Spray,
	StarPower,
	Stat,
	Stats,
	StatsByLevel,
	Voiceline,
} from "./generated/fandom";
