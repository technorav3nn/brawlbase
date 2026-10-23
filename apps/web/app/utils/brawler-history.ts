import type { History } from "@brawlbase/cdn";
import { brawlerStatText } from "./brawler-stats";

export type BrawlerChangeKind = "Buff" | "Nerf" | "Neutral";

export interface BrawlerChange {
	id: string;
	kind: BrawlerChangeKind;
	description: string;
	timestamp: number;
	dateKey: string;
	dateLabel: string;
	year: string;
}

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function normalizeBrawlerHistory(history: History[]): BrawlerChange[] {
	return history.map((entry, index): BrawlerChange => {
		const timestamp = Date.parse(entry.date);
		const date = Number.isFinite(timestamp) ? new Date(timestamp) : null;
		const kind = entry.kind.toLowerCase();
		return {
			id: `${entry.date}-${index}`,
			kind: kind === "buff" ? "Buff" : kind === "nerf" ? "Nerf" : "Neutral",
			description: brawlerStatText(entry.description ?? "") || "No further details listed.",
			timestamp: date ? timestamp : Number.NEGATIVE_INFINITY,
			dateKey: date?.toISOString().slice(0, 10) ?? "undated",
			dateLabel: date ? dateFormat.format(date) : "Date not listed",
			year: date ? String(date.getUTCFullYear()) : "undated"
		};
	}).sort((a, b) => b.timestamp - a.timestamp);
}

export function groupBrawlerHistory(changes: BrawlerChange[]) {
	const groups = new Map<string, { key: string; label: string; changes: BrawlerChange[] }>();
	for (const change of changes) {
		let group = groups.get(change.dateKey);
		if (!group) {
			group = { key: change.dateKey, label: change.dateLabel, changes: [] };
			groups.set(change.dateKey, group);
		}
		group.changes.push(change);
	}
	return [...groups.values()];
}
