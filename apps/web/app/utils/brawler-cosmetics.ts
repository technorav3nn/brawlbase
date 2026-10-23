import { routes, type Asset, type CdnBrawler, type Skin } from "@brawlbase/cdn";

export type BrawlerCosmeticKind = "skin" | "profileIcon" | "pet" | "pin" | "spray" | "buffieSkin";

export interface BrawlerCosmetic {
	id: string;
	kind: BrawlerCosmeticKind;
	name: string;
	asset: Asset;
	skin?: Skin;
	family: string;
	imageUrl?: string;
	fallbackUrl?: string;
	rarity?: string;
}

export function brawlerSkinName(skin: Skin, brawlerName: string): string {
	if (skin.name === "Default") return brawlerName;
	return skin.name.toLowerCase().includes(brawlerName.toLowerCase()) ? skin.name : `${skin.name} ${brawlerName}`;
}

export function brawlerSkinCollections(skin: Skin): string[] {
	return [
		...new Set(
			(skin.campaign ?? "")
				.split(",")
				.map((name) => name.trim())
				.filter(Boolean)
		),
	];
}

export function brawlerCosmeticSource(asset: Asset): string | undefined {
	try {
		// eslint-disable-next-line n/prefer-global/url -- This utility also runs in the browser, where node:url is unavailable.
		const url = new URL(asset.sourceUrl);
		if (url.protocol !== "https:") return undefined;
		// Fandom transformations can point at small thumbnails. Keep the original artwork.
		if (url.hostname === "static.wikia.nocookie.net") {
			url.pathname = url.pathname.split("/revision/")[0] ?? url.pathname;
			url.search = "";
		}
		return url.href;
	} catch {
		return undefined;
	}
}

function assetName(asset: Asset): string {
	return asset.filename
		.replace(/\.[^.]+$/, "")
		.replace(/-pfp$/i, "")
		.replace(/[_-]+/g, " ")
		.replace(/([a-z])(\d)/gi, "$1 $2")
		.trim();
}

export function brawlerCosmetics(
	brawlerId: number,
	brawlerName: string,
	skins: Skin[],
	extras?: Pick<CdnBrawler, "pins" | "sprays" | "buffieSkins">
): BrawlerCosmetic[] {
	const urls = routes.brawlers(brawlerId);
	const pins = new Set((extras?.pins ?? []).map((pin) => pin.asset.filename));
	const sprays = new Set((extras?.sprays ?? []).map((spray) => spray.asset.filename));
	const entries = new Map<string, BrawlerCosmetic>();
	function add(kind: BrawlerCosmeticKind, asset: Asset, name: string, skin?: Skin, rarity?: string) {
		const id = `${kind}:${asset.filename}`;
		if (entries.has(id)) return entries.get(id);
		const source = brawlerCosmeticSource(asset);
		const imageUrl =
			kind === "skin" && skin
				? urls.skins(skin.name).model
				: kind === "pin" && pins.has(asset.filename)
					? urls.pin(asset.filename)
					: kind === "spray" && sprays.has(asset.filename)
						? urls.spray(asset.filename)
						: kind === "buffieSkin"
							? urls.buffieSkin(asset.filename)
							: source;
		const entry: BrawlerCosmetic = {
			id,
			kind,
			name,
			asset,
			skin,
			rarity,
			imageUrl,
			family: skin ? `skin:${skin.name}` : kind,
			fallbackUrl: imageUrl !== source ? source : undefined,
		};
		entries.set(id, entry);
		return entry;
	}
	for (const skin of skins) {
		const skinName = brawlerSkinName(skin, brawlerName);
		add("skin", skin.asset, skinName, skin, skin.rarity);
		for (const asset of skin.profileIcons) add("profileIcon", asset, assetName(asset), skin);
		for (const pet of skin.petSkins) add("pet", pet.asset, `${skinName} (${pet.for})`, skin);
		for (const pin of skin.pins) add("pin", pin.asset, `${skinName} ${pin.emote || assetName(pin.asset)}`, skin, pin.rarity);
		for (const spray of skin.sprays) add("spray", spray.asset, assetName(spray.asset), skin, spray.rarity);
	}
	for (const pin of extras?.pins ?? []) add("pin", pin.asset, assetName(pin.asset), undefined, pin.rarity);
	for (const spray of extras?.sprays ?? []) add("spray", spray.asset, assetName(spray.asset), undefined, spray.rarity);
	for (const buffieSkin of extras?.buffieSkins ?? []) add("buffieSkin", buffieSkin.asset, assetName(buffieSkin.asset));
	return [...entries.values()];
}

const SKIN_RARITIES: Record<string, { icon: string; color: "success" | "info" | "primary" | "error" | "warning" | "secondary" }> =
	{
		Rare: { icon: "/icons/cosmetics/rare-skin-icon.png", color: "success" },
		"Super Rare": { icon: "/icons/cosmetics/super-rare-skin-icon.png", color: "info" },
		Epic: { icon: "/icons/cosmetics/epic-skin-icon.png", color: "primary" },
		Mythic: { icon: "/icons/cosmetics/mythic-skin-icon.png", color: "error" },
		Legendary: { icon: "/icons/cosmetics/legendary-skin-icon.png", color: "warning" },
		Hypercharge: { icon: "/icons/cosmetics/hypercharge-skin-icon.png", color: "secondary" },
	};

export function brawlerSkinRarity(rarity?: string) {
	return rarity ? SKIN_RARITIES[rarity] : undefined;
}
