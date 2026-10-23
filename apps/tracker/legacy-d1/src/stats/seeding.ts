import type { BrawlStarsClient, CountryCodes } from "@brawlbase/brawl-stars-api";
import type { D1Database } from "@cloudflare/workers-types";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { statsDatabase } from "./database.ts";
import { normalizeTag } from "./identity.ts";
import { preparePlayerSeeds } from "./population.ts";
import { LEASE_MS } from "./scheduling.ts";
import { seedSources, trackerState } from "./schema.ts";
import { DAY_MS } from "./types.ts";

export const SEED_COUNTRIES = [
	"global",
	"US",
	"BR",
	"DE",
	"JP",
	"KR",
	"MX",
	"FR",
	"ES",
	"GB",
] as const satisfies readonly CountryCodes[];
export type SeedCountry = (typeof SEED_COUNTRIES)[number];
export interface SeedOptions {
	countries: SeedCountry[];
	playersPerBoard: number;
	maxTrackedPlayers: number;
	boardsPerRun: number;
}
export type SeedApi = Pick<BrawlStarsClient, "brawlers" | "rankings">;
export async function seedPlayers(
	binding: D1Database,
	tags: string[],
	source: string,
	maxPlayers: number,
	now = Date.now()
): Promise<void> {
	const unique = [...new Set(tags.map(normalizeTag))];
	for (let offset = 0; offset < unique.length; offset += 1000)
		await preparePlayerSeeds(binding, unique.slice(offset, offset + 1000), source, maxPlayers, now);
}
/** Explicit maintenance operation; the scheduled collector never refreshes leaderboards. */
export async function seedLeaderboards(binding: D1Database, api: SeedApi, options: SeedOptions, now = Date.now()): Promise<void> {
	const db = statsDatabase(binding),
		token = crypto.randomUUID();
	await db.insert(trackerState).values({ id: "seed-catalog" }).onConflictDoNothing();
	const claimed = await db
		.update(trackerState)
		.set({ leaseToken: token, leaseUntil: now + LEASE_MS })
		.where(and(eq(trackerState.id, "seed-catalog"), lte(trackerState.nextRunAt, now), lte(trackerState.leaseUntil, now)))
		.returning()
		.get();
	if (claimed) {
		try {
			const brawlers = await api.brawlers.getBrawlers();
			const sources = [
				...options.countries.map((country) => ({ id: `players:${country}`, country, brawlerId: null })),
				...brawlers.map((brawler) => ({ id: `brawler:${brawler.id}`, country: "global", brawlerId: brawler.id })),
			];
			for (let offset = 0; offset < sources.length; offset += 20)
				await db
					.insert(seedSources)
					.values(sources.slice(offset, offset + 20))
					.onConflictDoNothing();
			await db
				.update(trackerState)
				.set({ nextRunAt: now + DAY_MS, leaseToken: null, leaseUntil: 0 })
				.where(and(eq(trackerState.id, "seed-catalog"), eq(trackerState.leaseToken, token)));
		} catch (error) {
			await db
				.update(trackerState)
				.set({ nextRunAt: now + 300_000, leaseToken: null, leaseUntil: 0 })
				.where(and(eq(trackerState.id, "seed-catalog"), eq(trackerState.leaseToken, token)));
			throw error;
		}
	}
	const sources = await db
		.select()
		.from(seedSources)
		.where(and(lte(seedSources.nextSeedAt, now), lte(seedSources.leaseUntil, now)))
		.orderBy(asc(sql`COALESCE(${seedSources.lastSuccessAt},0)`), sql`${seedSources.brawlerId} IS NOT NULL`, seedSources.id)
		.limit(options.boardsPerRun);
	for (const source of sources) {
		const country = SEED_COUNTRIES.find((country) => country === source.country);
		if (!country) continue;
		const leaseToken = crypto.randomUUID();
		const locked = await db
			.update(seedSources)
			.set({ leaseToken, leaseUntil: now + LEASE_MS })
			.where(and(eq(seedSources.id, source.id), lte(seedSources.nextSeedAt, now), lte(seedSources.leaseUntil, now)))
			.returning()
			.get();
		if (!locked) continue;
		try {
			const players =
				source.brawlerId === null
					? await api.rankings.players.getPlayersRanking(country, options.playersPerBoard)
					: await api.rankings.brawlers.getBrawlersRanking(country, String(source.brawlerId), options.playersPerBoard);
			await seedPlayers(
				binding,
				players.slice(0, options.playersPerBoard).map((player) => player.tag),
				source.id,
				options.maxTrackedPlayers,
				now
			);
			await db
				.update(seedSources)
				.set({
					lastSuccessAt: now,
					nextSeedAt: now + DAY_MS,
					playersSeen: players.length,
					leaseToken: null,
					leaseUntil: 0,
				})
				.where(and(eq(seedSources.id, source.id), eq(seedSources.leaseToken, leaseToken)));
		} catch (error) {
			await db
				.update(seedSources)
				.set({ nextSeedAt: now + 300_000, leaseToken: null, leaseUntil: 0 })
				.where(and(eq(seedSources.id, source.id), eq(seedSources.leaseToken, leaseToken)));
			throw error;
		}
	}
}
