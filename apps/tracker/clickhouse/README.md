# Statistics in ClickHouse

`Scheduled Worker → collector coordinator → direct HTTPS batch → ClickHouse`

Only new collection is ingested. Existing D1 statistics and historical R2 battle archives are not imported. The current player tag registry can be reused as seed configuration without importing its old results. If the registry is empty, collection bootstraps from the global leaderboard.

## Persistence and retries

The coordinator is a Durable Object inside the tracker Worker. It stores scheduling cursors, one cached 1,000-tag seed page, and a temporary pending request. It holds the batch until ClickHouse confirms the write, then advances the cursor. It uses no D1 or Queues. There is no continuous R2 or ClickPipes connection.

Inserts use `async_insert=1` and `wait_for_async_insert=1`. Retries reuse the same batch token and fact identities. `ReplacingMergeTree` identifies a participant by match fingerprint and player tag; equipment adds its kind. Views use `FINAL`, so counts stay deduplicated before background merges. The earliest observation wins, including inferred equipment ownership. Daily views retain the complete recorded history; there is no raw-data TTL.

Nuxt uses a separate read-only database user. The collector has only `SELECT` and `INSERT` on `brawlbase_stats`. Cloud management credentials remain local under the ignored `.clickhouse/` directory.

## Schema

Apply `tables/*.sql`, then `views/*.sql`, in filename order using `clickhousectl cloud service query --queries-file <file>`. Each file contains one statement. Existing objects are not dropped or replaced. The original implementation and its applied migrations are archived in `../legacy-d1/`.

The public API contracts, Wilson conservative score, observed win rate, trophy boundaries, and UTC date filters are preserved. SQL parameters are bound through ClickHouse's typed HTTP query parameters. Statistics start again from new collection; old D1 totals are not combined with the new sample.

## Connections

Collector secrets: `CLICKHOUSE_URL`, `CLICKHOUSE_USERNAME`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`. Web server runtime configuration: `NUXT_CLICKHOUSE_URL`, `NUXT_CLICKHOUSE_USERNAME`, `NUXT_CLICKHOUSE_PASSWORD`, `NUXT_CLICKHOUSE_DATABASE`. These are private settings, never public runtime configuration.

Collection defaults to 20 players per minute with `POLL_CONCURRENCY=4`, up to 28,800 polls per day. A player is polled at most daily. `POLLS_PER_RUN` supports 1–20 and `POLL_CONCURRENCY` supports 1–4. A 403 or 429 pauses all new polls until the shared cooldown expires. Only the current seed page is read and cached for up to one hour. The coordinator retries a pending insert before requesting more battles. Collection can be stopped with `COLLECTION_ENABLED=false`, or an optional UTC `COLLECTION_STOP_AT` date. These controls stop collection; they do not cap ClickHouse billing.

ClickHouse Cloud compute and storage consume trial credits and can incur charges after credits expire. Existing Cloud scaling and billing settings are preserved until an explicit configuration change is approved.
