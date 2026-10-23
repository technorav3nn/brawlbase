import type { Buffie } from "@brawlbase/cdn";
import { brawlerStatText } from "./brawler-stats";

export type BrawlerBuffieKind = "gadget" | "starpower" | "hypercharge";

function normalizedName(name: string): string {
	return name
		.normalize("NFKC")
		.toLowerCase()
		.replace(/^hypercharge\s*:\s*/, "")
		.replace(/[^\p{L}\p{N}]/gu, "");
}

export function brawlerBuffieKind(kind: string): BrawlerBuffieKind | undefined {
	switch (kind.toLowerCase().replace(/[\s_-]/g, "")) {
		case "gadget":
			return "gadget";
		case "star":
		case "starpower":
			return "starpower";
		case "hyper":
		case "hypercharge":
			return "hypercharge";
		default:
			return undefined;
	}
}

export function brawlerAbilityBuffie(buffies: Buffie[], kind: BrawlerBuffieKind, name: string): Buffie | undefined {
	return buffies.find(
		(buffie) => brawlerBuffieKind(buffie.kind) === kind && normalizedName(buffie.name) === normalizedName(name)
	);
}

export function brawlerBuffieEffect(buffie: Buffie): string {
	// Older CDN records include the base ability followed by an unclosed Quote template.
	// The final Quote contains the Buffie effect; clean records already contain just that text.
	const quotes = [...buffie.description.matchAll(/\{\{?\s*Quote\s*\|/gi)];
	const lastQuote = quotes.at(-1);
	const effect = lastQuote
		? (buffie.description.slice(lastQuote.index + lastQuote[0].length).split("}}")[0] ?? "")
		: buffie.description;
	return brawlerStatText(effect)
		.replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
		.replace(/\{\{[^{}]*\}\}/g, "")
		.replace(/[{}]/g, "")
		.replace(/'{2,3}/g, "")
		.trim();
}
