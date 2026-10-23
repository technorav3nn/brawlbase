import type { Attack, StatsByLevel } from "@brawlbase/cdn";

export interface BrawlerDisplayStat {
	label: string;
	value: string;
}

export interface BrawlerMovementProfile {
	value: string;
	condition: string;
}

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/**
 * Converts a brawler stat value that contains html into plain text
 * @param value The string
 * @returns Formatted string with html removed and html entities decoded
 */
export function brawlerStatText(value: string): string {
	const entities: Record<string, string> = {
		amp: "&",
		quot: '"',
		apos: "'",
		lt: "<",
		gt: ">",
		nbsp: " ",
		times: "×",
		deg: "°",
	};
	return value
		.replace(/<br\s*(?:\/\s*)?>/gi, "\n")
		.replace(/<[^>]*>/g, "")
		.replace(/&(amp|quot|apos|lt|gt|nbsp|times|deg);/g, (_, name: string) => entities[name] ?? "")
		.replace(/&#(x[\da-f]+|\d+);/gi, (match, code: string) => {
			const point = code.toLowerCase().startsWith("x") ? Number.parseInt(code.slice(1), 16) : Number(code);
			return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
		})
		.trim();
}

export function brawlerStatNumber(value: number | null | undefined): string {
	return typeof value === "number" && Number.isFinite(value) ? numberFormat.format(value) : "—";
}

export function brawlerMovementProfiles(value: string): BrawlerMovementProfile[] {
	const text = brawlerStatText(value);
	const profiles = [...text.matchAll(/(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*\(([^)]*)\))?/g)].flatMap((match) => {
		const speed = match[1]?.trim();
		return speed ? [{ value: speed, condition: match[2]?.trim() || "Movement speed" }] : [];
	});

	return profiles.length ? profiles : [{ value: text || "Not listed", condition: "Movement speed" }];
}

export function brawlerLevelStats(stats: StatsByLevel[], level: number): BrawlerDisplayStat[] {
	return stats.map((stat) => ({
		label: stat.name,
		value: brawlerStatNumber(stat.values[stat.levels.indexOf(level)]),
	}));
}

export function brawlerAbilityStats(ability: Attack, level: number): BrawlerDisplayStat[] {
	return [
		...brawlerLevelStats(ability.statsByLevel, level),
		...ability.stats.map((stat) => ({ label: stat.label, value: brawlerStatText(stat.value) })),
	];
}
