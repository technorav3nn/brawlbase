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

export interface CdnBrawler {
	attribution: string;
	shortDescription: string;
	fullDescription: string;
	attack: Attack;
	altAttack: Attack;
	super: Attack;
	altSuper: Attack;
	hypercharge: Attack;
	healthByLevel: number[];
	stats: Stats;
	tips: string[];
	model: Avatar;
	avatar: Avatar;
	skins: Skin[];
	history: History[];
	gadgets: Power[];
	starpowers: Power[];
}

export type Power = Attack & { id: string; cooldown?: string };

export interface Attack {
	name: string;
	description: string;
	stats?: Stat[];
	statsByLevel?: StatsByLevel[];
	asset?: Avatar;
}

export interface Avatar {
	filename: string;
	sourceUrl: string;
}

export interface Stat {
	label: string;
	value: string;
}

export interface StatsByLevel {
	name: string;
	levels: number[];
	values: number[];
}

export interface History {
	kind: Kind;
	date: Date;
	description: string;
}

export enum Kind {
	Buff = "Buff",
	Nerf = "Nerf",
	Neutral = "Neutral",
}

export interface Skin {
	name: string;
	exclusive: boolean;
	seasonal: boolean;
	asset: Avatar;
	petSkins: any[];
	pins: Pin[];
	voicelines: Voiceline[];
	sprays: Spray[];
	profileIcons: Avatar[];
	rarity?: string;
	campaign?: string;
	cost?: string;
}

export interface Pin {
	asset: Avatar;
	rarity: string;
	emote: string;
}

export interface Spray {
	asset: Avatar;
	rarity: string;
}

export interface Voiceline {
	trigger: string;
	description: string;
	asset: Avatar;
}

export interface Stats {
	rarity: string;
	class: string;
	movementspeed: string;
	voiceactor: string;
}
