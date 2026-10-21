# @brawlbase/cdn

CDN routes and generated TypeScript types for the Fandom scraper's JSON output.

```ts
import { routes, Kind, type CdnBrawler, type CdnMode, type Gear, type GearCollection } from "@brawlbase/cdn";

const url = routes.brawlers(16000000).data;
```

The package exports brawler and mode data, attacks, hypercharges, gadgets/star powers, skins, pet skins, pins, sprays, voice lines, assets, history entries, stats, individual gears, and the combined gear collection. Existing names such as `Avatar`, `Power`, `History`, and the runtime `Kind` enum remain available.

Types live in [src/generated/fandom.ts](src/generated/fandom.ts) and are re-exported from the package root. They are generated from the Rust output contracts in [output.rs](../../apps/fandom-scraper-v2/src/output.rs); do not edit the generated file manually.

```sh
# From the repository root; installs the pinned tools, including Rust/Cargo.
proto install
yarn workspace @brawlbase/cdn types:generate
yarn workspace @brawlbase/cdn types:check

# Or run the scraper's generator directly.
cargo run --locked --manifest-path apps/fandom-scraper-v2/Cargo.toml -- generate-types
cargo run --locked --manifest-path apps/fandom-scraper-v2/Cargo.toml -- generate-types --check
```

Generated declarations are committed, so normal CDN builds do not require Rust. `types:check` fails if the declarations are stale. The scraper's regression tests also validate its actual brawler, mode, and gear JSON against the Rust contracts.

The Yarn scripts run through Moon, which provisions the Rust version pinned in `.prototools` and locates Cargo without a separate manual installation. Proto's Rust integration uses rustup internally; see the [official toolchain guide](https://moonrepo.dev/docs/guides/rust/handbook). Direct Cargo commands require `~/.cargo/bin` on PATH.

These types describe serialized JSON: history dates are ISO timestamp **strings**, absent properties are optional, health/stat arrays can contain `null`, and accessory IDs are strings. `Gear.brawlersAvaliableTo` preserves the existing JSON spelling. A gear collection maps gear names to `Gear` objects.
