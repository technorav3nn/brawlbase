import type { D1Database, Queue } from "@cloudflare/workers-types";
import { and, eq, lte, sql } from "drizzle-orm";
import { statsDatabase } from "./database.ts";
import { trackedPlayers, trackerState } from "./schema.ts";
import type { PollJob, TrackingRow } from "./types.ts";

export const LEASE_MS = 5 * 60_000;
export function leaseFence(job: PollJob, now: number) {
	return and(
		eq(trackedPlayers.tag, job.tag),
		eq(trackedPlayers.leaseToken, job.leaseToken),
		sql`${trackedPlayers.leaseUntil} > ${now}`,
		eq(trackedPlayers.enabled, 1)
	);
}
export async function getLease(binding: D1Database, job: PollJob, now = Date.now()): Promise<TrackingRow | null> {
	const row = await statsDatabase(binding).select().from(trackedPlayers).where(leaseFence(job, now)).get();
	return row
		? {
				tag: row.tag,
				lease_token: row.leaseToken,
				lease_until: row.leaseUntil,
				last_success_at: row.lastSuccessAt,
				last_battle_at: row.lastBattleAt,
			}
		: null;
}
export async function claimDue(binding: D1Database, limit: number, now = Date.now()): Promise<PollJob[]> {
	const db = statsDatabase(binding);
	const candidates = await db
		.select({ tag: trackedPlayers.tag })
		.from(trackedPlayers)
		.where(and(eq(trackedPlayers.enabled, 1), lte(trackedPlayers.nextPollAt, now), lte(trackedPlayers.leaseUntil, now)))
		.orderBy(trackedPlayers.nextPollAt, trackedPlayers.tag)
		.limit(limit);
	const jobs: PollJob[] = [];
	for (const { tag } of candidates) {
		const leaseToken = crypto.randomUUID();
		const claimed = await db
			.update(trackedPlayers)
			.set({ leaseToken, leaseUntil: now + LEASE_MS })
			.where(
				and(
					eq(trackedPlayers.tag, tag),
					eq(trackedPlayers.enabled, 1),
					lte(trackedPlayers.nextPollAt, now),
					lte(trackedPlayers.leaseUntil, now)
				)
			)
			.returning({ tag: trackedPlayers.tag })
			.get();
		if (claimed) jobs.push({ tag, leaseToken });
	}
	return jobs;
}
/** Compatibility helpers for local integrations; the deployed collector does not use Queues. */
export async function dispatchDue(binding: D1Database, queue: Queue<PollJob>, limit: number, now = Date.now()): Promise<void> {
	const db = statsDatabase(binding);
	await db.insert(trackerState).values({ id: "dispatch" }).onConflictDoNothing();
	const budget = await db
		.update(trackerState)
		.set({ nextRunAt: Math.floor(now / 60_000) * 60_000 + 60_000 })
		.where(and(eq(trackerState.id, "dispatch"), lte(trackerState.nextRunAt, now)))
		.returning()
		.get();
	if (!budget) return;
	const jobs = await claimDue(binding, limit, now);
	try {
		for (let offset = 0; offset < jobs.length; offset += 100) {
			await queue.sendBatch(jobs.slice(offset, offset + 100).map((body) => ({ body })));
		}
	} catch (error) {
		for (const job of jobs)
			await db
				.update(trackedPlayers)
				.set({ leaseToken: null, leaseUntil: 0 })
				.where(and(eq(trackedPlayers.tag, job.tag), eq(trackedPlayers.leaseToken, job.leaseToken)));
		throw error;
	}
}
export async function dispatchOne(binding: D1Database, queue: Queue<PollJob>, tag: string, now = Date.now()): Promise<boolean> {
	const db = statsDatabase(binding),
		leaseToken = crypto.randomUUID();
	const claimed = await db
		.update(trackedPlayers)
		.set({ leaseToken, leaseUntil: now + LEASE_MS })
		.where(
			and(
				eq(trackedPlayers.tag, tag),
				eq(trackedPlayers.enabled, 1),
				lte(trackedPlayers.nextPollAt, now),
				lte(trackedPlayers.leaseUntil, now)
			)
		)
		.returning()
		.get();
	if (!claimed) return false;
	try {
		await queue.send({ tag, leaseToken });
	} catch (error) {
		await db
			.update(trackedPlayers)
			.set({ leaseToken: null, leaseUntil: 0 })
			.where(and(eq(trackedPlayers.tag, tag), eq(trackedPlayers.leaseToken, leaseToken)));
		throw error;
	}
	return true;
}
export async function releaseFailedJob(
	binding: D1Database,
	job: PollJob,
	status: number | null,
	now = Date.now()
): Promise<void> {
	const base = status === 404 ? 21_600_000 : status === 403 ? 3_600_000 : status === 429 ? 300_000 : 60_000;
	await statsDatabase(binding)
		.update(trackedPlayers)
		.set({
			leaseToken: null,
			leaseUntil: 0,
			consecutiveFailures: sql`${trackedPlayers.consecutiveFailures}+1`,
			nextPollAt: sql`${now}+MIN(21600000,${base}*(1 << MIN(${trackedPlayers.consecutiveFailures},6)))`,
		})
		.where(leaseFence(job, now));
}
export function nextPollAt(lastBattleAt: number | null, minimumIntervalMs: number, now: number): number {
	const interval = lastBattleAt !== null && now - lastBattleAt < 30 * 60_000 ? 5 * 60_000 : 60 * 60_000;
	return now + Math.max(interval, minimumIntervalMs) + Math.floor(Math.random() * 30_000);
}
