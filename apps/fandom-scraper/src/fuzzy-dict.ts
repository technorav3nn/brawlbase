import type { BrawlApiStarPower } from "@brawltracker/brawl-api";
import { search } from "fast-fuzzy";
import { findBestMatch } from "string-similarity";

export class FuzzyDict {
	constructor(private dict: Record<string, string>) {}

	getValue(key: string): string {
		const upperKey = key.toUpperCase();
		const starpowerKeys = Object.keys(this.dict);
		const matches = findBestMatch(upperKey, starpowerKeys);
		const bestMatch = matches.bestMatch.target;
		return this.dict[bestMatch];
	}
}

export function getIdFromName(name: string, array: BrawlApiStarPower[]) {
	return search(name, array, {
		keySelector: (obj) => obj.name,
	})?.[0];
}
