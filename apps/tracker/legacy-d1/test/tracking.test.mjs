import assert from "node:assert/strict";
import test from "node:test";
import { collect } from "../src/collect.ts";
import { trackerConfig } from "../src/config.ts";
import { enrichCollection } from "../src/enrich.ts";
import {
	canonicalMatch,
	DAY_MS,
	dispatchDue,
	dispatchOne,
	getBrawlerStats,
	getLease,
	LEASE_MS,
	persistCollection,
	pruneStats,
	releaseFailedJob,
	seedLeaderboards,
	seedPlayers,
} from "../src/index.ts";
import { winRateInterval, winRateTier } from "../src/stats/statistics.ts";
import { LocalD1 } from "./local-d1.mjs";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const TAG = "#P0Y";
const OPPONENT = "#Q0Y";
function battle(result = "victory", time = NOW - 60_000, eventId = 123) {
	return {
		battleTime: new Date(time),
		event: { id: eventId, map: `Map ${eventId}`, mode: "brawlBall" },
		battle: {
			mode: "brawlBall",
			type: "ranked",
			result,
			teams: [
				[TAG, "#P0L", "#P0G"],
				[OPPONENT, "#Q0L", "#Q0G"],
			].map((team, index) =>
				team.map((tag, slot) => ({
					tag,
					name: "Player",
					brawler: { id: index * 3 + slot + 1, name: "Brawler", trophies: 900, power: 11 },
				}))
			),
		},
	};
}

async function setup(tag = TAG, now = NOW) {
	const db = new LocalD1();
	const jobs = [];
	const queue = {
		send: async (job) => {
			jobs.push(job);
		},
	};
	await seedPlayers(db, [tag], "players:global", 5000, now);
	await dispatchOne(db, queue, tag, now);
	return { db, jobs, queue, job: jobs[0] };
}
function count(db, table) {
	return Number(db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
}
const commit = (db, job, entries, now = NOW) => persistCollection(db, job, entries, "test/archive.json", 300_000, now);

test("canonical identity and outcomes survive the opposing perspective and reordered teams", async () => {
	const original = battle();
	const opposing = structuredClone(original);
	opposing.battle.teams.reverse();
	opposing.battle.teams.forEach((team) => team.reverse());
	opposing.battle.result = "defeat";
	opposing.battle.teams[0][0].name = "Renamed";
	opposing.battle.teams[0][0].brawler.trophies = 1200;
	const first = await canonicalMatch(original, TAG);
	const second = await canonicalMatch(opposing, OPPONENT);
	assert.equal(first.key, second.key);
	assert.deepEqual(
		first.participants.map((player) => ({ ...player, trophies: null })),
		second.participants.map((player) => ({ ...player, trophies: null }))
	);
});

test("duplicate deliveries and overlapping player logs count one match and six picks", async () => {
	const { db, job, queue, jobs } = await setup();
	await commit(db, job, [battle(), battle()]);
	await commit(db, job, [battle()]);
	await seedPlayers(db, [OPPONENT], "brawler:1", 5000, NOW);
	await dispatchOne(db, queue, OPPONENT, NOW);
	const opposing = battle("defeat");
	await commit(db, jobs[1], [opposing]);
	assert.equal(count(db, "matches"), 1);
	assert.equal(db.sql.prepare("SELECT json_array_length(participants_json) AS n FROM matches").get().n, 6);
	const stats = await getBrawlerStats(db, 1, { days: 7 }, NOW);
	assert.equal(stats.sampleMatches, 1);
	assert.equal(
		stats.brawlers.reduce((total, row) => total + row.picks, 0),
		6
	);
	assert.equal(stats.brawlers.find((row) => row.brawlerId === 1).winRate, 1);
	assert.equal(stats.brawlers.find((row) => row.brawlerId === 4).winRate, 0);
	assert.equal(stats.brawlers[0].pickRate, 1 / 6);
});

test("draws produce null win rates while remaining in the pick denominator", async () => {
	const { db, job } = await setup();
	await commit(db, job, [battle("draw")]);
	const stats = await getBrawlerStats(db, 1, { days: 7 }, NOW);
	assert.equal(stats.brawlers[0].winRate, null);
	assert.equal(stats.brawlers[0].draws, 1);
	assert.equal(stats.brawlers[0].pickRate, 1 / 6);
});

test("mode, map, and UTC day filters use the corresponding complete sample denominator", async () => {
	const { db, job } = await setup();
	const otherMap = battle("defeat", NOW - 120_000, 456);
	otherMap.battle.teams[0][0].brawler.id = 99;
	const oldDay = battle("victory", NOW - DAY_MS);
	const otherMode = battle("defeat", NOW - 180_000);
	otherMode.battle.mode = "heist";
	await commit(db, job, [battle(), otherMap, oldDay, otherMode]);
	const all = await getBrawlerStats(db, 1, { days: 7 }, NOW);
	assert.equal(all.sampleMatches, 4);
	assert.equal(all.brawlers.find((row) => row.brawlerId === 1).pickRate, 3 / 24);
	const filtered = await getBrawlerStats(db, 1, { days: 1, eventId: 123, mode: "brawlBall" }, NOW);
	assert.equal(filtered.sampleMatches, 1);
	assert.equal(filtered.maps[0].pickRate, 1 / 6);
	assert.equal(filtered.maps[0].winRate, 1);
	assert.equal(filtered.brawlers.find((row) => row.brawlerId === 1).pickRate, 1 / 6);
});

test("mirror brawlers count each participant without merging their results", async () => {
	const { db, job } = await setup();
	const entry = battle();
	entry.battle.teams[1][0].brawler.id = 1;
	await commit(db, job, [entry]);
	const stats = await getBrawlerStats(db, 1, { days: 7 }, NOW);
	const row = stats.brawlers.find((brawler) => brawler.brawlerId === 1);
	assert.equal(row.picks, 2);
	assert.equal(row.winRate, 0.5);
	assert.equal(row.pickRate, 2 / 6);
});

test("friendly, ranked sets, Showdown, Duels, missing results, malformed teams, and missing observers are excluded", async () => {
	for (const modify of [
		(entry) => {
			entry.battle.type = "friendly";
		},
		(entry) => {
			entry.battle.type = "soloRanked";
		},
		(entry) => {
			entry.battle.mode = "soloShowdown";
			entry.battle.rank = 1;
		},
		(entry) => {
			entry.battle.mode = "duels";
		},
		(entry) => {
			delete entry.battle.result;
		},
		(entry) => {
			entry.battle.teams[0].pop();
		},
		(entry) => {
			entry.battle.teams[0][0].tag = "#P0J";
		},
		(entry) => {
			entry.battle.teams[1][0].tag = "#0";
		},
	]) {
		const entry = battle();
		modify(entry);
		assert.equal(await canonicalMatch(entry, TAG), null);
	}
});

test("expired and superseded jobs cannot write matches or clear a newer lease", async () => {
	const { db, job, queue, jobs } = await setup();
	assert.equal(await commit(db, job, [battle()], NOW + LEASE_MS), false);
	await dispatchOne(db, queue, TAG, NOW + LEASE_MS + 1);
	await commit(db, job, [battle()], NOW + LEASE_MS + 2);
	assert.equal(count(db, "matches"), 0);
	assert.ok(await getLease(db, jobs[1], NOW + LEASE_MS + 2));
	await commit(db, jobs[1], [battle()], NOW + LEASE_MS + 3);
	assert.equal(count(db, "matches"), 1);
});

test("a failed aggregate insert rolls back matches, aggregates, collection, and lease release", async () => {
	const { db, job } = await setup();
	db.sql.exec(
		"CREATE TRIGGER fail_participant BEFORE INSERT ON brawler_daily_buckets BEGIN SELECT RAISE(ABORT, 'failure'); END"
	);
	await assert.rejects(commit(db, job, [battle()]));
	assert.equal(count(db, "matches"), 0);
	assert.equal(count(db, "collections"), 0);
	assert.equal(count(db, "brawler_daily_buckets"), 0);
	assert.ok(await getLease(db, job, NOW));
});

test("overlapping schedulers share a dispatch budget and claims; publish failure releases the lease", async () => {
	const db = new LocalD1();
	await seedPlayers(db, [TAG, OPPONENT], "players:global", 5000, NOW);
	const jobs = [];
	const queue = {
		send: async (job) => {
			jobs.push(job);
		},
		sendBatch: async (messages) => {
			jobs.push(...messages.map((message) => message.body));
		},
	};
	await Promise.all([dispatchDue(db, queue, 1, NOW), dispatchDue(db, queue, 1, NOW)]);
	assert.equal(jobs.length, 1);
	await assert.rejects(
		dispatchOne(
			db,
			{
				send: async () => {
					throw new Error("offline");
				},
			},
			OPPONENT,
			NOW
		)
	);
	assert.equal(db.sql.prepare("SELECT lease_until FROM tracked_players WHERE tag = ?").get(OPPONENT).lease_until, 0);
});

test("archive failure prevents a database commit; successful collection records its archive", async () => {
	const { db, job } = await setup();
	const api = { players: { getPlayerBattleLog: async () => [battle()], getPlayer: async () => ({ tag: TAG, brawlers: [] }) } };
	await assert.rejects(
		collect(
			{
				STATS_DB: db,
				STATS_ARCHIVE: {
					put: async () => {
						throw new Error("offline");
					},
				},
			},
			api,
			job,
			300_000,
			() => NOW
		)
	);
	assert.equal(count(db, "matches"), 0);
	const archives = [];
	await collect(
		{
			STATS_DB: db,
			STATS_ARCHIVE: {
				put: async (key, payload) => {
					archives.push({ key, payload });
				},
			},
		},
		api,
		job,
		300_000,
		() => NOW
	);
	assert.equal(count(db, "matches"), 1);
	assert.equal(db.sql.prepare("SELECT archive_key FROM collections").get().archive_key, archives[0].key);
});

test("a non-overlapping log records a possible coverage gap", async () => {
	const { db, job, queue, jobs } = await setup();
	await commit(db, job, [battle()]);
	const later = NOW + 3_600_000;
	await dispatchOne(db, queue, TAG, later);
	await commit(db, jobs[1], [battle("victory", later - 60_000)], later);
	const stats = await getBrawlerStats(db, 1, { days: 7 }, later);
	assert.equal(stats.possibleGaps, 1);
});

test("seed duplicates share one player, preserve poll state, and obey the population cap", async () => {
	const db = new LocalD1();
	await seedPlayers(db, [TAG, TAG.toLowerCase(), OPPONENT], "players:global", 1, NOW);
	await seedPlayers(db, [TAG], "brawler:1", 1, NOW + 1000);
	assert.equal(count(db, "tracked_players"), 1);
	assert.equal(db.sql.prepare("SELECT next_poll_at FROM tracked_players").get().next_poll_at, NOW);
});

test("leaderboard sources rotate, bound requests, deduplicate tags, and refresh daily", async () => {
	const db = new LocalD1();
	const requests = [];
	const api = {
		brawlers: { getBrawlers: async () => [{ id: 1 }, { id: 2 }] },
		rankings: {
			players: {
				getPlayersRanking: async (country, limit) => {
					requests.push([country, limit]);
					return [{ tag: TAG }];
				},
			},
			brawlers: {
				getBrawlersRanking: async (country, brawler, limit) => {
					requests.push([country, brawler, limit]);
					return [{ tag: TAG }, { tag: OPPONENT }];
				},
			},
		},
	};
	const options = { countries: ["global"], playersPerBoard: 40, maxTrackedPlayers: 5000, boardsPerRun: 2 };
	await seedLeaderboards(db, api, options, NOW);
	assert.equal(requests.length, 2);
	assert.deepEqual(requests[0], ["global", 40]);
	assert.equal(count(db, "tracked_players"), 2);
	await seedLeaderboards(db, api, options, NOW + 60_000);
	assert.equal(requests.length, 3);
	await seedLeaderboards(db, api, options, NOW + 120_000);
	assert.equal(requests.length, 3);
});

test("unavailable battle logs, forbidden requests, and rate limits back off without disabling players", async () => {
	for (const status of [404, 403, 429]) {
		const { db, job } = await setup();
		await releaseFailedJob(db, job, status, NOW);
		const row = db.sql.prepare("SELECT * FROM tracked_players").get();
		assert.equal(row.enabled, 1);
		assert.ok(row.next_poll_at > NOW);
		if (status === 404) assert.equal(row.next_poll_at, NOW + 6 * 3_600_000);
	}
});

test("retention cascades participants and prevents old payload replay from re-adding aggregates", async () => {
	const { db, job, queue, jobs } = await setup();
	await commit(db, job, [battle()]);
	const later = NOW + 37 * DAY_MS;
	await pruneStats(db, later);
	assert.equal(count(db, "matches"), 0);
	assert.equal(count(db, "match_participants"), 0);
	assert.equal(count(db, "brawler_daily_buckets"), 6);
	await dispatchOne(db, queue, TAG, later);
	await commit(db, jobs[1], [battle()], later);
	assert.equal(count(db, "matches"), 0);
});

test("configuration bounds collection and write budgets", () => {
	assert.equal(trackerConfig({}).minimumIntervalMs, 24 * 60 * 60_000);
	assert.equal(trackerConfig({}).enabled, false);
	assert.equal(trackerConfig({ COLLECTION_ENABLED: "true" }).enabled, true);
	assert.throws(() => trackerConfig({ POLLS_PER_RUN: "3" }));
	assert.throws(() => trackerConfig({ MONTHLY_WRITE_BUDGET: "500001" }));
	assert.throws(() => trackerConfig({ DAILY_WRITE_BUDGET: "20001" }));
});

test("budget collection does not expand the enrolled population", async () => {
	const { db, job } = await setup();
	await persistCollection(db, job, [battle()], "test/archive.json", 300_000, NOW, 100000);
	assert.equal(count(db, "tracked_players"), 1);
	assert.equal(db.sql.prepare("SELECT player_count FROM tracking_population").get().player_count, 1);
});

test("participant discovery rolls back with a failed collection", async () => {
	const { db, job } = await setup();
	db.sql.exec("CREATE TRIGGER fail_collection BEFORE UPDATE ON tracked_players BEGIN SELECT RAISE(ABORT, 'failure'); END");
	await assert.rejects(persistCollection(db, job, [battle()], "test/archive.json", 300_000, NOW, 100));
	assert.equal(count(db, "tracked_players"), 1);
	assert.equal(db.sql.prepare("SELECT player_count FROM tracking_population").get().player_count, 1);
	assert.equal(count(db, "matches"), 0);
});

test("batched dispatch releases all claimed leases on publish failure and recovers next minute", async () => {
	const db = new LocalD1();
	await seedPlayers(db, [TAG, OPPONENT], "players:global", 100, NOW);
	await assert.rejects(
		dispatchDue(
			db,
			{
				sendBatch: async () => {
					throw new Error("offline");
				},
			},
			100,
			NOW + 5000
		)
	);
	assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM tracked_players WHERE lease_token IS NOT NULL").get().n, 0);
	const jobs = [];
	await dispatchDue(
		db,
		{
			sendBatch: async (messages) => {
				jobs.push(...messages.map((message) => message.body));
			},
		},
		100,
		NOW + 60_000
	);
	assert.equal(jobs.length, 2);
});

test("trophy boundaries use participant trophies and qualifying match counts are not fractional", async () => {
	const { db, job } = await setup();
	const entry = battle();
	const trophies = [0, 499, 500, 999, 1000, 2000];
	entry.battle.teams.flat().forEach((player, index) => {
		player.brawler.trophies = trophies[index];
	});
	entry.battle.duration = 120;
	entry.battle.starPlayer = entry.battle.teams[0][0];
	await commit(db, job, [entry]);
	for (const trophyRange of ["0-499", "500-999", "1000+"]) {
		const view = await getBrawlerStats(db, 1, { days: 7, trophyRange }, NOW);
		assert.equal(view.sampleMatches, 1);
		assert.equal(view.samplePicks, 2);
		assert.equal(
			view.brawlers.reduce((sum, row) => sum + row.pickRate, 0),
			1
		);
	}
	const view = await getBrawlerStats(db, 1, { days: 7, trophyRange: "0-499" }, NOW);
	assert.equal(view.brawlers[0].averageDuration, 120);
	assert.equal(view.brawlers.find((row) => row.brawlerId === 1).starPlayerRate, 1);
	assert.equal(view.brawlers.find((row) => row.brawlerId === 1).averageTrophies, 0);
});

test("archived trophy enrichment is idempotent and preserves global results", async () => {
	const { db, job } = await setup();
	const entry = battle();
	await commit(db, job, [entry]);
	db.sql.exec(
		`DELETE FROM brawler_daily_buckets; DELETE FROM match_daily_ranges;
		INSERT INTO match_participants(battle_key,player_tag,brawler_id,team,result)
		SELECT m.battle_key,json_extract(p.value,'$.tag'),json_extract(p.value,'$.brawlerId'),json_extract(p.value,'$.team'),json_extract(p.value,'$.result') FROM matches m,json_each(m.participants_json) p;
		UPDATE collections SET enriched_at=NULL`
	);
	const before = await getBrawlerStats(db, 1, { days: 7 }, NOW);
	assert.equal(before.unclassifiedPicks, 6);
	const archive = JSON.parse(JSON.stringify({ version: 1, tag: TAG, battles: [entry] }));
	const bindings = { STATS_DB: db, STATS_ARCHIVE: { get: async () => ({ json: async () => archive }) } };
	const archiveJob = { kind: "enrich", collectionToken: job.leaseToken, archiveKey: "test/archive.json" };
	await enrichCollection(bindings, archiveJob, NOW);
	await enrichCollection(bindings, archiveJob, NOW);
	const after = await getBrawlerStats(db, 1, { days: 7, trophyRange: "500-999" }, NOW);
	assert.equal(after.sampleMatches, 1);
	assert.equal(after.samplePicks, 6);
	assert.equal(after.unclassifiedPicks, 0);
	assert.equal(count(db, "matches"), 1);
	assert.equal(db.sql.prepare("SELECT SUM(picks) AS n FROM brawler_daily_buckets").get().n, 6);
	assert.equal(after.brawlers.find((row) => row.brawlerId === 1).winRate, 1);
});

test("daily meta history survives raw retention and can be queried by a past end date", async () => {
	const { db, job } = await setup();
	await commit(db, job, [battle()]);
	const later = NOW + 100 * DAY_MS;
	await pruneStats(db, later);
	assert.equal(count(db, "matches"), 0);
	const history = await getBrawlerStats(db, 1, { days: 1, endDate: "2026-10-23" }, later);
	assert.equal(history.sampleMatches, 1);
	assert.equal(history.history.length, 1);
	assert.equal(history.history[0].winRate, 1);
});

test("conservative tiers use the Wilson lower bound; small samples remain unrated", () => {
	assert.equal(winRateTier(140, 60), "S");
	assert.equal(winRateTier(124, 76), "A");
	assert.equal(winRateTier(120, 80), "B");
	assert.equal(winRateTier(110, 90), "C");
	assert.equal(winRateTier(100, 100), "D");
	assert.equal(winRateTier(90, 110), "F");
	assert.equal(winRateTier(199, 0), null);
	assert.equal(winRateInterval(0, 0), null);
	const interval = winRateInterval(100, 100);
	assert.ok(interval[0] < 0.5 && interval[1] > 0.5);
});
