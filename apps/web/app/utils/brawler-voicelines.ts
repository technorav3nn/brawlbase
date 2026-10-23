import { routes, type CdnBrawler, type Voiceline } from "@brawlbase/cdn";
import { brawlerCosmeticSource } from "./brawler-cosmetics";

export interface BrawlerVoiceline extends Voiceline {
	id: string;
	url?: string;
	fallbackUrl?: string;
}

export function brawlerVoicelines(brawlerId: number, data: Pick<CdnBrawler, "voicelines" | "skins">): BrawlerVoiceline[] {
	const entries = new Map<string, BrawlerVoiceline>();
	const downloaded = new Set(data.voicelines.flatMap((line) => line.asset ? [line.asset.filename] : []));
	function add(line: Voiceline, variant = "Normal") {
		const voiceVariant = line.variant || variant;
		const id = line.asset?.filename ?? JSON.stringify([voiceVariant, line.trigger, line.description]);
		if (entries.has(id)) return;
		const source = line.asset ? brawlerCosmeticSource(line.asset) : undefined;
		const url = line.asset && downloaded.has(line.asset.filename)
			? routes.brawlers(brawlerId).voiceline(line.asset.filename)
			: source;
		entries.set(id, { ...line, id, variant: voiceVariant, url, fallbackUrl: url !== source ? source : undefined });
	}
	for (const line of data.voicelines) add(line);
	for (const skin of data.skins) {
		for (const line of skin.voicelines) add(line, skin.name === "Default" ? "Normal" : skin.name);
	}
	return [...entries.values()];
}
