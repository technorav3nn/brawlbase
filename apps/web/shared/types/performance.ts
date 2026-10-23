import type { BrawlerPerformance } from "@brawlbase/tracker";

export interface PerformanceBrawler {
	id: number;
	name: string;
	performance?: BrawlerPerformance;
}
