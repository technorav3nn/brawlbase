import { BrawlStarsClient, SupercellAPIClientError } from "@brawlbase/brawl-stars-api";
import type { DurableObject, DurableObjectState } from "@cloudflare/workers-types";
import { clickhouseTrackerConfig, type ClickHouseTrackerSettings } from "./clickhouse-config.ts";
import { collect } from "./collect.ts";
import { playerSeeds, type PlayerSeedPage } from "./player-seeds.ts";
import { StatsDatabase } from "./stats/clickhouse.ts";
import type { StatisticsEvent } from "./stats/events.ts";

export interface CoordinatorEnvironment extends ClickHouseTrackerSettings {
	CLICKHOUSE_URL: string;
	CLICKHOUSE_USERNAME: string;
	CLICKHOUSE_PASSWORD: string;
	CLICKHOUSE_DATABASE?: string;
	BRAWL_STARS_API_TOKEN: string;
	BRAWL_STARS_API_BASE_URL?: string;
}
interface PlayerCursor {
	lastBattleAt: number | null;
	nextPollAt: number;
	failures: number;
}
interface PendingBatch {
	token: string;
	parts: number;
	cursor: number;
	sequence: number;
	nextRunAt: number;
	intervalMs?: number;
	cooldownUntil?: number;
	players: Record<string, PlayerCursor>;
}
interface CoordinatorCheckpoint {
	cursor: number;
	sequence: number;
	nextRunAt: number;
	intervalMs?: number;
	cooldownUntil?: number;
	pending?: PendingBatch;
}

/** Serializes polling and keeps an outbox until ClickHouse confirms a durable insert. */
export class CollectionCoordinator implements DurableObject {
	private serial: Promise<void> = Promise.resolve();
	private readonly database: StatsDatabase;

	constructor(
		private readonly ctx: DurableObjectState,
		private readonly env: CoordinatorEnvironment
	) {
		this.database = new StatsDatabase({
			url: env.CLICKHOUSE_URL,
			username: env.CLICKHOUSE_USERNAME,
			password: env.CLICKHOUSE_PASSWORD,
			database: env.CLICKHOUSE_DATABASE ?? "brawlbase_stats",
		});
	}

	private exclusive<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.serial.then(operation, operation);
		this.serial = result.then(
			() => undefined,
			() => undefined
		);
		return result;
	}

	async fetch(request: Request): Promise<Response> {
		// eslint-disable-next-line n/prefer-global/url -- URL is a native Cloudflare Workers API.
		if (request.method !== "POST" || new URL(request.url).pathname !== "/poll") return new Response(null, { status: 404 });
		await this.exclusive(() => this.poll());
		return new Response(null, { status: 204 });
	}

	async alarm(): Promise<void> {
		await this.exclusive(() => this.flushPending());
	}

	private async checkpoint(): Promise<CoordinatorCheckpoint> {
		return (await this.ctx.storage.get<CoordinatorCheckpoint>("checkpoint")) ?? { cursor: 0, sequence: 0, nextRunAt: 0 };
	}

	private async commit(batch: PendingBatch): Promise<void> {
		await this.ctx.storage.transaction(async (transaction) => {
			await transaction.put({
				checkpoint: {
					cursor: batch.cursor,
					sequence: batch.sequence,
					nextRunAt: batch.nextRunAt,
					intervalMs: batch.intervalMs,
					cooldownUntil: batch.cooldownUntil,
				},
				...batch.players,
			});
			const keys = this.partKeys(batch);
			for (let offset = 0; offset < keys.length; offset += 128) await transaction.delete(keys.slice(offset, offset + 128));
			await transaction.deleteAlarm();
		});
	}

	private partKeys(pending: PendingBatch): string[] {
		return Array.from({ length: pending.parts }, (_, index) => `outbox:${pending.token}:${index}`);
	}

	private async flushPending(): Promise<void> {
		const state = await this.checkpoint();
		const pending = state.pending;
		if (!pending) return;
		const keys = this.partKeys(pending);
		const parts = new Map<string, string>();
		for (let offset = 0; offset < keys.length; offset += 128) {
			const chunk = await this.ctx.storage.get<string>(keys.slice(offset, offset + 128));
			for (const [key, value] of chunk) parts.set(key, value);
		}
		const payload = keys
			.map((key) => {
				const part = parts.get(key);
				if (part === undefined) throw new Error("Pending ClickHouse batch is missing");
				return part;
			})
			.join("");
		await this.database.insert("events", payload, pending.token);
		await this.commit(pending);
	}

	private async poll(): Promise<void> {
		await this.flushPending();
		const now = Date.now();
		const config = clickhouseTrackerConfig(this.env, now);
		const state = await this.checkpoint();
		if (
			!config.enabled ||
			(state.cooldownUntil ?? 0) > now ||
			(state.intervalMs === config.intervalMs && state.nextRunAt > now)
		)
			return;
		const api = new BrawlStarsClient(this.env.BRAWL_STARS_API_TOKEN, {
			baseURL: this.env.BRAWL_STARS_API_BASE_URL,
			timeout: 10_000,
			retry: 0,
		});
		let page = await this.ctx.storage.get<PlayerSeedPage>("seed-page");
		const loadPage = async (position: number): Promise<PlayerSeedPage> => {
			const index = page ? position % page.total : position;
			if (
				!page ||
				page.limit !== config.maxTrackedPlayers ||
				page.expiresAt <= now ||
				index < page.start ||
				index >= page.start + page.tags.length
			) {
				page = await playerSeeds(this.database, api, config.maxTrackedPlayers, position, now);
				await this.ctx.storage.put("seed-page", page);
			}
			return page;
		};
		const initialPage = await loadPage(state.cursor);
		let cursor = state.cursor % initialPage.total;
		const jobs: { tag: string; key: string; previous: PlayerCursor; cursor: number; population: number }[] = [];
		for (
			let inspected = 0;
			inspected < Math.min(initialPage.total, config.pollsPerRun * 20) && jobs.length < config.pollsPerRun;
			inspected++
		) {
			const seeds = await loadPage(cursor);
			cursor %= seeds.total;
			const position = cursor;
			const tag = seeds.tags[cursor - seeds.start];
			cursor = (cursor + 1) % seeds.total;
			if (!tag) throw new Error("Player seed cursor is out of bounds");
			const key = `player:${tag}`;
			const previous = (await this.ctx.storage.get<PlayerCursor>(key)) ?? {
				lastBattleAt: null,
				nextPollAt: 0,
				failures: 0,
			};
			if (previous.nextPollAt <= now) jobs.push({ tag, key, previous, cursor: position, population: seeds.total });
		}
		let started = 0;
		let blockedUntil = 0;
		const updates: Record<string, PlayerCursor> = {};
		const events: StatisticsEvent[] = [];
		const pollPlayers = async () => {
			while (!blockedUntil && started < jobs.length) {
				const job = jobs[started++];
				if (!job) return;
				const { tag, key, previous, population } = job;
				try {
					const result = await collect(api, tag, population, previous.lastBattleAt);
					events.push(...result.events);
					updates[key] = { lastBattleAt: result.lastBattleAt, nextPollAt: now + 86_400_000, failures: 0 };
				} catch (error) {
					const status = error instanceof SupercellAPIClientError ? error.status : null;
					const base = status === 404 ? 21_600_000 : status === 403 ? 3_600_000 : status === 429 ? 300_000 : 60_000;
					const nextPollAt = Date.now() + Math.min(21_600_000, base * 2 ** Math.min(previous.failures, 6));
					updates[key] = { ...previous, failures: previous.failures + 1, nextPollAt };
					console.warn("Statistics poll failed", { status });
					if (status === 429 || status === 403) blockedUntil = Math.max(blockedUntil, nextPollAt);
				}
			}
		};
		await Promise.all(Array.from({ length: Math.min(config.concurrency, jobs.length) }, pollPlayers));
		// Resume at the first unattempted player if an upstream limit stopped the batch.
		cursor = jobs[started]?.cursor ?? cursor;
		const nextRunAt = Math.max(Math.floor(now / config.intervalMs) * config.intervalMs + config.intervalMs, blockedUntil);
		if (!events.length) {
			await this.ctx.storage.put({
				checkpoint: {
					cursor,
					sequence: state.sequence,
					nextRunAt,
					intervalMs: config.intervalMs,
					cooldownUntil: blockedUntil,
				},
				...updates,
			});
			return;
		}
		const sequence = state.sequence + 1;
		const payload = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
		if (payload.length > 8_000_000) throw new Error("Collection batch is too large; reduce POLLS_PER_RUN");
		const token = crypto.randomUUID();
		const chunks: Record<string, string> = {};
		for (let offset = 0; offset < payload.length; offset += 32_000)
			chunks[`outbox:${token}:${Object.keys(chunks).length}`] = payload.slice(offset, offset + 32_000);
		const pending: PendingBatch = {
			token,
			parts: Object.keys(chunks).length,
			cursor,
			sequence,
			nextRunAt,
			intervalMs: config.intervalMs,
			cooldownUntil: blockedUntil,
			players: updates,
		};
		const entries = Object.entries(chunks);
		for (let offset = 0; offset < entries.length; offset += 128)
			await this.ctx.storage.put(Object.fromEntries(entries.slice(offset, offset + 128)));
		await this.ctx.storage.transaction(async (transaction) => {
			await transaction.put("checkpoint", { ...state, pending });
			await transaction.setAlarm(Date.now() + 60_000);
		});
		await this.flushPending();
		console.info("Statistics batch inserted", { sequence, players: started, records: events.length });
	}
}
