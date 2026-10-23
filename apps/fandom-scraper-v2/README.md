# fandom-scraper-v2

Rust replacement for `../fandom-scraper`. The original project is unchanged. The default command writes the same brawler data, gear data, directory names, and WebP assets into `./out`.

```sh
# From the repository root, install all pinned tools (including Rust/Cargo).
proto install
moon run fandom-scraper-v2:build

# Run the built scraper.
cd apps/fandom-scraper-v2
./target/release/fandom-scraper-v2
```

Rust is pinned in the root `.prototools` and `rust-toolchain.toml`. Moon provisions the pinned toolchain for Rust tasks; a separate manual Cargo installation is unnecessary. Proto uses rustup internally, storing Rust under `~/.rustup` rather than `~/.proto`. Direct `cargo` commands require `~/.cargo/bin` on PATH; Moon tasks handle locating Cargo. See the [official Rust toolchain guide](https://moonrepo.dev/docs/guides/rust/handbook).

Requires libvips. On this checkout, the executable automatically finds the libvips library already supplied by Sharp in the root `node_modules/@img` directory; Node is not used at runtime. A standalone installation can use system libvips or set `FANDOM_LIBVIPS_PATH` to its shared library. The image parity fixtures were generated with Sharp 0.35.4, libvips 8.18.6, and its bundled codecs. Use the same library/codecs for identical encoded bytes. System codec versions can change WebP encoding.

```sh
# Optional controls; omitting these processes the full catalog and gears.
./target/release/fandom-scraper-v2 --out ./out --concurrency 4 --asset-concurrency 12
./target/release/fandom-scraper-v2 --brawler Shelly --skip-gears

# Repair existing output: refresh profileIcons and download icons without redownloading models.
# Existing stats, skins, and gear enrichment are preserved.
./target/release/fandom-scraper-v2 --profile-icons-only --strict
```

Paths are relative to the working directory, as in the old command. Moon discovers the project through the existing `apps/*` glob; build, start, and test tasks are included in `moon.yml`.

## Output compatibility

```text
out/
  brawlers/<numeric-id>/
    data.json
    model.webp
    portrait.webp
    icon.webp
    skins/<skin-name>/model.webp
    skins/<skin-name>/profile-icon.webp
  gadgets/<numeric-id>.webp
  star-powers/<numeric-id>.webp
  hypercharges/<brawler-id>.webp
  gears/<normalized-name>/
    icon.webp
    info.json
  gears/all-info.json
```

The implementation preserves optional-field omission, array ordering, accessory IDs as strings, attribution URLs, UTC history dates, and the existing `brawlersAvaliableTo` spelling. It includes the Larry & Lawrie ordering, Buzz Lightyear exclusion, Jae-Yong and Mr. P image names, Kaze forms, Lumi's `23000907` download override, pet skins, skin attachment matching, and the existing fuzzy-match threshold and tie breakers.

Compatibility also preserves quirks that affect output: Kaze's missing scalar health becomes eleven null values; ordinary skin-template secondary keys are handled as the old parser handles them; each applicable gear resets the brawler's gear array, so the final applicable gear wins. Image conversion uses the same libvips engine as Sharp, including the initial trim, quality-85 encoding, color tolerance, second decode/trim/quality-80 encoding, and the three-channel fallback that leaves the initial WebP intact. Gear icons resize to **width** 80 while preserving aspect ratio.

Profile icons intentionally correct the old scraper's empty arrays. Extraction ignores MediaWiki edit controls and supports wrapped headings. Base, rank, Hypercharge, and Prestige icons are associated with the Default skin; cosmetic icons are associated with their matching skin. `brawlers/<id>/icon.webp` always uses `<Brawler>1-pfp.png`, regardless of table order. The Default skin's `profile-icon.webp` uses that same base icon. Profile URLs discard CDN transformations and request `format=original`, retaining the cache buster. Profile images use a threshold-50 libvips trim and **lossless WebP** encoding to remove the noisy near-black frame while preserving the original pixels inside the crop. They retain their source resolution and aspect ratio. Missing base icons report an error rather than silently substituting a variant.

Timing and failure handling improve: independent work runs concurrently, the per-asset 200 ms sleep is removed, and transient HTTP/network/MediaWiki failures retry up to four attempts with backoff and `Retry-After` handling. Requests have connection and overall timeouts. JSON and images use temporary files followed by atomic rename. Repeated writes to one path remain ordered. Asset failures are logged and other assets finish, retaining the old command’s exit behavior. Add `--strict` to return a failing exit status if assets remain missing. API/data failures return contextual errors. Existing files are never treated as a cache.

The old gear module invokes itself when imported and then runs again from `main()`, creating a race against brawler output. V2 runs the gear phase once after brawler files finish. The end-to-end reference harness disables only that accidental import-time invocation.

Image progress is printed to stderr by default. Each download prints its source URL and destination, followed by `[images completed/total] Saved ...` with elapsed time, or an explicit failure. The batch summary reports saved/failed counts and total duration. Gear images also print their destination, encoded byte count, and elapsed time.

## Verification

```sh
cargo test --locked
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
```

The committed corpus contains **108 brawlers**, **three game modes**, **485 fuzzy matching cases**, and image inputs/outputs from the old Sharp downloader. Brawler fixtures contain captured raw wikitext, HTML, explicit accessory catalogs, and complete expected objects produced by the unchanged TypeScript parser. Legacy fields remain compared against those snapshots; expanded `profileIcons`, pins, sprays, and voice lines have separate assertions. Separate tests require a base icon and the correct download path for all 108 brawlers, check skin associations and heading variants, and compare real Shelly, Crow, and 8-Bit crops against Sharp reference WebPs. Each object's attribution identifies its source wiki page. These are regression snapshots, not a substitute for testing future wiki changes.

Production uses `api.brawlapi.com` for the brawler catalog and game CSV data. The checked endpoints are:

- `https://api.brawlapi.com/v1/brawlers`: `{ "list": [...] }`, with numeric brawler/accessory IDs and `starPowers` / `gadgets` arrays.
- `https://api.brawlapi.com/game/csv_logic/gear_boosts`
- `https://api.brawlapi.com/game/localization/texts`
- `https://api.brawlapi.com/game/csv_logic/characters`

The `/game/{path}` responses are bare objects keyed by CSV row name, without a metadata/data envelope. All three CSV endpoints returned HTTP 200, and their row data matched the previous CSV snapshots. The catalog remains on **v1**. The captured API contract test covers 109 catalog entries, their 436 accessories, and all 19 gear rows with localization and character references; it checks that the gear JSON remains identical after this migration. `--game-api URL` overrides the CSV base URL; `--raw-api URL` remains an alias for existing invocations, and metadata/data envelopes are accepted for those overrides. The default CSV flow uses `/game` exclusively.

The original wiki-parser snapshots use explicit deterministic accessory catalogs because the former Brawlify host returned HTTP 403 when they were captured. They remain unchanged as compatibility references. A live strict run for Vince succeeded using the default BrawlAPI catalog and real accessory IDs, producing 47 files including all 19 gear icons through the `/game` CSV flow. A full-roster live production run is still unverified. A live redirected page request verified the combined HTML/wikitext API response; actual wiki images also matched the old pipeline byte for byte in conversion checks.

With this repository's Node dependencies installed, these scripts compare directly with the old source:

```sh
node scripts/verify.mjs        # Fresh old-parser results vs Rust for all captured brawlers
node scripts/images.mjs       # Synthetic image comparisons against old Downloader
node scripts/images.mjs --live
node scripts/e2e.mjs          # Full local run: output tree, JSON, image bytes, runtime
node scripts/benchmark.mjs 20 # CPU-only parsing comparison
```

Scripts use `target/debug/fandom-scraper-v2` for parser/image verification and `target/release/fandom-scraper-v2` for benchmarks and the end-to-end run. Set `FANDOM_BINARY` to override. Only capture scripts and `images.mjs --live` use external services; the other checks run offline. HTTP tests and the end-to-end script bind a local loopback port.

To refresh snapshots deliberately:

```sh
node scripts/capture.mjs Shelly Kaze 'Larry & Lawrie'
node scripts/capture.mjs --all # Adds category pages without an existing snapshot
node scripts/modes.mjs
node scripts/fuzzy.mjs
```

## Performance evidence

A controlled end-to-end run with three brawlers, gears, 20 ms local HTTP latency, and 70 output files took **14,253 ms** in the old implementation and **490 ms** in Rust: **29.09× faster**. The resulting file paths, JSON values, and WebP bytes matched. A separate five-brawler CPU-only parsing comparison (20 rounds per brawler) measured **8.01×** aggregate speedup. Scripts save detailed results under `target/`.

The end-to-end benchmark uses one generated image for downloads and tests scheduling and output equivalence. It does not predict full live runtime, which depends on image sizes, network latency, server rate limits, and catalog availability. No tenfold live-speed guarantee is established by this benchmark.

## TypeScript types

`src/output.rs` defines the JSON output contracts. `ts-rs` generates `packages/cdn/src/generated/fandom.ts`, exported by `@brawlbase/cdn`. Types cover brawlers, modes, gears, assets, skins and pet skins, pins, sprays, voice lines, accessories, attacks, stats, and history. The existing CDN type names and `Kind` enum remain exported.

```sh
cargo run --locked -- generate-types
cargo run --locked -- generate-types --check
```

The output path is resolved relative to the Rust project, independent of the working directory. From the repository root, the equivalent commands are `yarn workspace @brawlbase/cdn types:generate` and `yarn workspace @brawlbase/cdn types:check`. Generated declarations are committed; CDN consumers and ordinary CDN builds do not need Rust. Tests detect stale generated types and deserialize actual fixture outputs into the contracts, including missing fields, nullable numbers, JSON date strings, and the gear-enriched brawler shape. Scraping continues to serialize the original objects, preserving output behavior.

## Layout

`src/index.rs` orchestrates the run; `scraper.rs` parses brawlers and modes; `wiki.rs` handles the wiki syntax consumed by that parser; `fuzzy_dict.rs` matches accessory catalogs; `downloader.rs` manages downloads and atomic writes; `images.rs` calls libvips directly; `scrape_gears.rs` builds gear outputs; and `http.rs` manages connections, request limits, and retries. This is a scraper-specific wiki parser, not a complete replacement for every feature of `wtf_wikipedia`.

The combined page request uses the documented [MediaWiki parse API](https://www.mediawiki.org/wiki/API:Parsing_wikitext). Native trimming uses [libvips find_trim](https://www.libvips.org/API/current/method.Image.find_trim.html), with the extra alpha-bound calculation used by Sharp.

## Expanded collectibles and audio

Brawler `data.json` now includes complete `pins`, `sprays`, `voicelines`, `buffies`, and `buffieSkins` arrays. These remain empty when the page has no entries. Skin-level pins and sprays retain their existing shape and association. The brawler-level collections retain entries even when there is no matching skin model. Buffies include the affected ability name, kind, quoted effect, and available artwork. Buffie skins include their gallery name and asset. Voice lines include their table trigger, description (including rendered translations), original audio asset, and an optional variant label such as Normal or Cyber. Default skin voice lines include only unlabeled/Normal entries; variant audio remains available in the complete brawler collection without guessing a cosmetic association.

Downloads are written beneath `brawlers/<id>/{pins,sprays,buffies,buffie-skins}/<source-stem>.webp` and `brawlers/<id>/voicelines/<original-filename>`. Audio bytes and extensions are preserved. Image sources discard wiki thumbnail transformations. Duplicate pin/spray filenames are emitted once. These local output changes do not upload or publish anything.
