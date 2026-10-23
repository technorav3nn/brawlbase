# ClickHouse cutover

The implementation uses direct Worker-to-ClickHouse inserts. No ClickPipes resource is created, and R2 is not connected to ingestion.

## Applied configuration patch

`cutover.patch` records the configuration changes approved and applied on October 23, 2026. It is retained for review; do not apply it again. It changes:

- `apps/web/nuxt.config.ts`: add four private ClickHouse runtime settings.
- `apps/web/wrangler.jsonc`: remove the statistics D1 binding; retain the account/authentication database and the existing KV/R2 app bindings.
- `apps/tracker/wrangler.jsonc`: replace statistics D1/R2/Queue bindings with one collector coordinator; retain the 15-minute schedule and two-player poll limit. ClickHouse URL/database are non-secret variables; username/password are Worker secrets.
- `apps/tracker/package.json`: clearly label the preserved D1 suite as `test:legacy-d1`.

Existing `apps/web/.env` received only new `NUXT_CLICKHOUSE_*` reader settings. Existing `apps/tracker/.dev.vars` received only new `CLICKHOUSE_*` collector settings. Existing secret values were preserved. Dedicated generated credentials are saved privately under `.clickhouse/`; their contents are excluded from this patch.

The downloaded Cloud management credentials were saved to a newly created, ignored `.clickhouse/credentials.json` with mode 0600. Existing authentication configuration was not overwritten.

## Activation

The approved configuration patch and private local settings are applied, and the collector secrets are uploaded. Tracker version `d6767fb3-9a86-4e61-aeec-d330afa75709` replaces the deployed D1 collector with direct ClickHouse collection. No old database, bucket, or Queue was deleted. The retired poll Queue consumer is detached to stop further deliveries to the tracker. The ClickHouse registry contains 100,000 player tags copied as seed configuration; no historical battle results were imported. The web application is prepared locally; publishing the web app is a separate deployment.

The existing service is `My first service` in BrawlBase, AWS us-east-2. At inspection it has two replicas, each with 16–120 GiB autoscaling, and a 15-minute idle timeout. There are $300 in trial credits expiring November 23, 2026. Collection and web queries consume compute/storage credits. Existing Cloud scaling/billing configuration is not changed by this patch. These limits do not guarantee a free ongoing service.

## Verification after activation

Production collection was confirmed on October 23, 2026. At 17:00 UTC, the new database held 138 deduplicated matches, 828 participant facts (414 wins and 414 losses), 16 profile-inferred equipment facts, and six successful player collections, including the local pilot. The registered seed pool contains 100,000 players. This is a pool for gradual polling, not 100,000 completed polls.

Localhost successfully read the production facts. Web and tracker typechecks, targeted ESLint, the web production build, and the Worker deployment passed. Browser checks covered map and brawler pages at desktop and phone widths, keyboard tab navigation, charts, and minimum-sample tier states. No automated test suite was run. An initial production request timed out; subsequent scheduled runs inserted successfully.

Both retired Queues remain intact with zero consumers. Authentication D1 and the original D1 statistics remain untouched. The public web deployment has not been changed; the web configuration is active on localhost.

## Faster collection

The follow-up deployment `24ee2e1b-83b3-429b-9036-e82493b59b99` raises the schedule to every minute and the run limit to 20 players, with four concurrent player polls. This is up to 28,800 polls per day, 150 times the original 192. The coordinator caches one 1,000-player page for up to an hour instead of downloading the full registry on each run. It honors a shared cooldown for upstream 403/429 responses and resumes at the first unattempted seed. Larger outboxes use storage calls of at most 128 keys. Existing pending batches and cursors remain compatible; the new cadence takes effect without retaining the previous 15-minute schedule delay.

The two retired Queues still have zero producers and zero consumers. Faster collection increases Brawl Stars API requests and ClickHouse ingestion/storage; it does not change Cloud billing or scaling settings. Typecheck, targeted ESLint, tracker build, and Worker bundle passed before deployment. No automated test suite was run for this change.

Cloudflare settings confirmed the minute schedule, 20-player limit, four-poll concurrency, and zero Queue bindings. A batch at the new cadence had not yet been observed during the initial propagation window; the 150-times figure is configured polling capacity, not a measured ingestion benchmark.
