# Brawler statistics tracker

The scheduled Cloudflare Worker collects official Brawl Stars battle logs and profile-inferred equipment, then inserts batches directly into ClickHouse Cloud. Nuxt reads ClickHouse through the shared `@brawlbase/tracker` exports. Account authentication remains separate.

## Project layout

| Location                                | Responsibility                                                     |
| --------------------------------------- | ------------------------------------------------------------------ |
| `src/worker.ts`                         | Scheduled entry point                                              |
| `src/coordinator.ts`                    | Poll coordination, player cursors, and retry outbox                |
| `src/collect.ts`                        | Fetch and normalize fresh battle logs and inferred equipment       |
| `src/player-seeds.ts`                   | ClickHouse player registry and initial leaderboard seeding         |
| `src/stats/clickhouse.ts`               | HTTPS queries and acknowledged batch inserts                       |
| `src/stats/read.ts`                     | Filtered performance, summaries, history, and equipment queries    |
| `src/stats/statistics.ts`               | Wilson intervals and conservative tiers                            |
| `clickhouse/tables`, `clickhouse/views` | ClickHouse schema                                                  |
| `clickhouse/cutover.md`                 | Reviewable deployment and configuration changes                    |
| `legacy-d1`                             | Archived original implementation, migrations, and regression suite |

## Collection

The default is **20 players every minute**, with four concurrent player polls, with at most one poll per player per day. The coordinator prevents overlapping runs and saves one batch before inserting it. A 403 or 429 from either profile or battle-log requests pauses the whole collector, with at most the already-started four player polls allowed to finish. Unattempted players remain next in the cursor. `async_insert=1` and `wait_for_async_insert=1` acknowledge only a successful flush. Failures retain the same batch for retry. Match fingerprints, participant keys, and `FINAL` read views prevent repeated observations from inflating results.

A single Durable Object stores scheduling state, a cached 1,000-tag registry page (up to one hour), and the temporary outbox. Seed reads no longer download all 100,000 tags per run. All participant, equipment, collection, and population facts are in ClickHouse. Collection uses no D1, Cloudflare Queues, ClickPipes, or continuous R2 connection. Both retired Queues have no producers or consumers.

Only explicitly supported trophy 3v3 modes are measured. Each accepted match records both teams. Live API logs older than seven days are ignored on ingestion. Recorded ClickHouse history has no expiry. Existing D1 results and archived R2 payloads are not backfilled in this migration.

The player registry can reuse the existing tracked tags as seed configuration. An empty registry bootstraps from the global leaderboard. `MAX_TRACKED_PLAYERS` defaults to 100,000. At 20 polls per minute, up to 28,800 players are polled per day (150 times the original limit). Cycling through 100,000 seeds takes about 3.5 days before failures or upstream cooldowns. The registry size does not increase polling throughput. `COLLECTION_ENABLED=false` stops new polls; `COLLECTION_STOP_AT` optionally sets a UTC stop date.

## Statistics

Observed win rate is **wins / (wins + losses)**; draws are separate. Use rate is the share of player slots in the same trophy, map, mode, and date filters. Unknown trophies are excluded from trophy-specific samples.

Tiers and event recommendations use the lower endpoint of the approximate 95% Wilson interval, with at least **200 decisive results**. S/A/B/C/D/F thresholds are **62/55/50/45/40%** of the conservative score. Use rate affects neither score nor tier. Stats default to **1000+ trophies**, and tier lists require a specific trophy band. The score accounts for sample size, not skill or sampling bias.

Equipment is inferred only for the polled player's brawler when its profile owns exactly one gadget, star power, or gear of the relevant type. Profiles do not prove historical equipment or whether it was equipped. Unknown equipment remains absent. Equipment samples use the earliest observation per match, player, and kind.

## Local and deployment configuration

Read [the ClickHouse setup](clickhouse/README.md) and [the cutover review](clickhouse/cutover.md). Cloud API credentials belong in the ignored `.clickhouse/` directory; they are not application credentials. Nuxt receives a read-only database user. The collector receives a separate user with `SELECT` and `INSERT` only on `brawlbase_stats`.

Use Yarn from the repository root:

- `yarn workspace @brawlbase/tracker build`
- `yarn workspace @brawlbase/tracker typecheck`
- `yarn workspace @brawlbase/tracker dev`
- `yarn workspace @brawlbase/tracker bundle`

The original D1 regression suite is archived with its original source under `legacy-d1/`; it does not validate the ClickHouse implementation.

Public web reads remain cached for 15 minutes. No credentials are sent to the browser. ClickHouse Cloud compute/storage consume credits and may incur charges after trial credits expire. Collection limits and stop dates do not themselves cap Cloud billing.
