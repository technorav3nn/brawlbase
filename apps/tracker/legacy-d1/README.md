# Archived D1 implementation

This is the preserved implementation from before the ClickHouse migration. Its instructions describe the retired D1 pipeline. See the current tracker README for active configuration.

# BrawlBase statistics

The statistics implementation now lives in **`apps/tracker`**: Cloudflare entry point, Drizzle schema and queries, collection, scheduling, usage limits, migrations, and existing regression fixtures. Nuxt imports the public `@brawlbase/tracker` library for read operations and contracts; it contains no Nuxt auto-imports. The authentication database remains separate.

## Layout

| Location                | Responsibility                                            |
| ----------------------- | --------------------------------------------------------- |
| `src/worker.ts`         | Scheduled collection and retired-queue drain              |
| `src/collect.ts`        | Fetch battle log/profile and archive the observation      |
| `src/stats/schema.ts`   | Drizzle SQLite schema                                     |
| `src/stats/persist.ts`  | Atomic match deduplication and grouped aggregate writes   |
| `src/stats/read.ts`     | Filtered performance, summary, history, equipment queries |
| `src/stats/budget.ts`   | Atomic write reservations and D1 metadata accounting      |
| `src/stats/loadouts.ts` | Inference from single-item profile ownership              |
| `src/stats/seeding.ts`  | Explicit maintenance operations; never scheduled          |
| `src/enrich.ts`         | Explicit legacy archive maintenance; never scheduled      |
| `migrations/`           | Append-only SQL migrations for `STATS_DB`                 |
| `test/`                 | Existing SQLite/collection regression fixtures            |

Drizzle builds application queries, including inserts, selects, updates, deletes, and batches. JSON expansion and aggregate arithmetic use parameterized Drizzle `sql` expressions. SQL migrations preserve database triggers and applied schema history.

## Resource limits

The previous 400 polls/minute plus 20 archive jobs/minute were paused before this change. The replacement runs **every 15 minutes**, directly processes at most **two players**, and publishes **no Queue messages**. Its existing queue consumer only acknowledges outstanding deliveries, without API, R2, or D1 work. Automatic leaderboard refresh, participant enrollment, and archive enrichment are disabled. The 100,000 enrolled players and all recorded daily history remain intact; the much smaller polling budget means slower coverage and more missed logs.

| Variable               | Default and maximum | Meaning                                              |
| ---------------------- | ------------------- | ---------------------------------------------------- |
| `COLLECTION_ENABLED`   | `true`              | Set `false` to stop scheduled collection immediately |
| `POLLS_PER_RUN`        | `2`                 | Maximum players per 15-minute invocation             |
| `MONTHLY_WRITE_BUDGET` | `500000`            | Collector write allowance per UTC calendar month     |
| `DAILY_WRITE_BUDGET`   | `20000`             | Collector write allowance per UTC day                |

Each invocation atomically reserves 12,000 writes before work. Actual `meta.rows_written` includes indexed rows and trigger writes; successful completion refunds unused reservation with conservative ledger overhead. Unknown database failures retain the whole reservation. Crashes also retain reservations, and a run is refused when the remaining allowance cannot cover a complete reservation. Daily counters share the same atomic monthly row, protecting overlapping invocations. Budget checks themselves consume a small number of reads; public reads, manual maintenance/migrations, and other Cloudflare services are outside this collector ledger.

These are application limits, **not an account-wide billing cap**. They do not undo past usage, include other applications, or align automatically with Cloudflare's subscription renewal date. Check the account dashboard before changing limits. Cloudflare's [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) documents included reads, writes, storage, and overage charges.

One compact JSON participant payload is stored per new match. Daily aggregates are updated once per grouped bucket, without inserting six participant rows or maintaining the redundant legacy rollup. Existing raw records remain readable for audit. Raw cleanup runs at most daily and removes at most 50 old matches and 50 collections inside the collection budget. Daily history is not deleted. Ingestion and pruning use the same seven-UTC-day cutoff, preventing expired identities from being counted again. Monitor storage; bounded cleanup does not guarantee that old backlog shrinks quickly.

The web app caches performance responses for 15 minutes. `/api/stats/summary` supplies all directory rates and qualified map recommendations in one shared cached query. Card components never fetch their own summaries. Public performance reads scan the matching daily buckets once and aggregate them in memory; the tracked-player counter replaces repeated scans of 100,000 tags.

## Statistical definitions

- Only supported trophy 3v3 modes with explicit results and six valid participants are counted. Ranked sets, Showdown, friendly games, unknown modes, and malformed outcomes are excluded.
- Canonical identity preserves the original v1 fingerprint: time, event ID, mode, match type, sorted tags/brawler IDs. Names, trophies, results, and equipment are excluded. This remains a heuristic because the upstream API supplies no match ID.
- Win rate is **wins / (wins + losses)**. Draws are shown separately. Use rate never changes win rate or tiers.
- Use rate is the brawler's share of eligible player slots in the same map/mode/trophy/date sample; mirror picks count separately.
- Trophy bands are **0–499, 500–999, 1000+**, using each participant's battle-log trophy value. Legacy unknown values are excluded from trophy filters. Automatic archive backfill is paused.
- Periods contain 1, 7, or 30 UTC calendar days, ending today or at `endDate`. Daily aggregates survive raw-log cleanup. Late observations can add to earlier days; missing days remain absent.
- Trophy-filtered match counts count a match once if it contains any qualifying participant. A match can appear in several bands, so band match counts are not additive.
- Tiers and event recommendations use the **lower endpoint of the approximate 95% Wilson interval**, requiring **200 decisive results**. S/A/B/C/D/F thresholds are 62/55/50/45/40 percent of this conservative score. Observed win rates remain wins / (wins + losses); use rate enters neither calculation. Small samples remain unrated.
- Stats pages default to **1000+ brawler trophies**; other trophy bands and all-trophy overview totals remain available. Tier lists require a specific trophy band. Event recommendations select up to five qualifying brawlers by conservative score in the seven-day, 1000+ map sample, with ID ties. Directory rates use the same trophy band. Links preserve trophy band, period, mode, and selected map. Unknown trophy observations remain outside trophy-specific samples.
- Conservative scores address sample size, not player-skill, bot, matchmaking, or leaderboard-selection bias. Participants and repeat players are not independent, so the Wilson interval remains an approximation. Existing daily counters supply the score; no new collection, writes, or schema migration is needed.
- Extra metrics and approximate Wilson intervals use recorded fields only. They do not correct player skill, ownership, matchmaking, bot, or leaderboard sampling bias.

## Equipment inference

The collector fetches one profile alongside each polled player's battle log. For each of that player's brawlers, it infers a gadget, star power, or gear only when the current profile owns **exactly one** of that type. Other participants are not assigned that player's equipment. Items with unknown or multiple ownership are excluded. A profile does not prove what was equipped in a historical battle, whether the item was equipped, or whether it was owned at battle time; the API and UI label the sample **profile-inferred**.

The first inferred sample is unique by match fingerprint + player tag + item type. Repeated polls, queue redeliveries, or later profile changes cannot count the same player/battle/type twice. Profile observation time is retained with the sample. Equipment win rate uses only that inferred item's wins/losses. Equipment use rate divides its samples by all inferred samples for the same brawler and item type under identical filters. The denominator excludes unknown loadouts and is not the global equipment usage rate. Profile ownership introduces substantial cohort bias.

## Commands

From the repository root:

```sh
yarn workspace @brawlbase/tracker build
yarn workspace @brawlbase/tracker typecheck
yarn workspace @brawlbase/tracker bundle
yarn workspace @brawlbase/web typecheck
yarn workspace @brawlbase/web build
```

`build` produces the public library; `bundle` is a Wrangler dry run. Neither deploys. Existing regression fixtures can be run explicitly with `yarn workspace @brawlbase/tracker test`; fixture paths now belong to this project.

```sh
yarn workspace @brawlbase/tracker exec wrangler d1 migrations apply STATS_DB --remote
yarn workspace @brawlbase/tracker deploy
yarn workspace @brawlbase/tracker exec wrangler tail brawlbase-tracker
```

Migration `0004_collection_budget.sql` adds compact match payloads, inferred-equipment tables, and the usage ledger. It stops the redundant legacy aggregate trigger without copying or deleting historical observations. Apply it before deploying the new collector. The original migrations retain their names, so existing databases recognize them after relocation.

The existing resources remain: private Worker `brawlbase-tracker`, D1 `brawlbase-stats` (`be62c185-6a7f-47b6-8430-77572dd895a7`), and the private `brawlbase` R2 bucket with the `brawler-stats/` archive prefix. The RoyaleAPI proxy is `https://bsproxy.royaleapi.dev/v1`; the API token stays in the Worker secret. No public Worker HTTP route is enabled.

Localhost's `STATS_DB` binding still reads live statistics. For isolated collection use the tracker's local bindings and `apps/web/.wrangler/state`; its `.dev.vars` is ignored. Never switch collection development to remote production bindings. The Nuxt app's existing authentication bindings are unchanged.
