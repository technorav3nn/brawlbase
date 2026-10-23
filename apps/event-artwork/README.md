# Event artwork extractor

A standalone Rust CLI for extracting Brawl Stars event banners directly from SC v5 assets. It reads the same export names and pinned source URL as the web app's `shared/data/event-artwork.json`. No Python, external decoder, or image editor is required.

## Generate the website banners

From the repository root:

```sh
moon run event-artwork:start -- --output ../web/public/images/events/environments
```

Moon runs the command from `apps/event-artwork`. Alternatively, from the repository root:

```sh
cargo run --release --locked --manifest-path apps/event-artwork/Cargo.toml -- \
    --output apps/web/public/images/events/environments
```

The program downloads the single HTTPS SC source pinned in the manifest and renders the five configured exports. Network failures return an error. Use a local file for repeatable offline runs:

```sh
cargo run --release --locked --manifest-path apps/event-artwork/Cargo.toml -- \
    --input /path/to/events.sc \
    --output apps/web/public/images/events/environments
```

Select one banner with `--export event_airhockey_banner`, or list all names with `--list`. Use `--manifest /path/to/event-artwork.json` for a different export mapping. The default output directory is `out` in the current working directory.

## Image quality

- Decodes the embedded **high-resolution** KTX ASTC atlases; it refuses to silently fall back to low-resolution textures.
- Renders the scene directly into a **1600 × 512** canvas. There is no enlarged intermediate screenshot or small sprite.
- Uses Catmull-Rom bicubic texture sampling with premultiplied alpha and four coverage samples per pixel. This avoids the previous nearest-neighbor steps and dark edges around transparent pixels.
- Preserves transforms, first-frame ordering, color transforms, alpha masks, and normal/additive blending.
- Writes lossless RGBA PNGs through temporary files and atomic replacement. Existing files remain intact if rendering or encoding fails.

The viewport is centered on the scene origin and spans 200 × 64 game units. To change output density without changing framing, pass both `--width` and `--height` in the same 25:8 ratio, e.g. `--width 2400 --height 768`. Update the corresponding width/height metadata in the web manifest when publishing a different size.

Larger output dimensions do **not** recover detail missing from the original textures. This archive's two native atlases are 4096 × 4096 and 2560 × 3832, shared by many sprites and already compressed as ASTC. The renderer preserves that available detail and improves sampling; source artwork can still look soft when enlarged beyond its native resolution.

## Supported input

This tool targets the pinned Brawl Stars 69.230 SC v5 archive with zero-based string references, embedded KTX 1 ASTC textures, internal float/half matrix banks, and regular first-frame elements. Empty runtime text labels are ignored. External textures/banks, visible text, compressed frame elements, unknown blend modes, and other SC versions return contextual errors rather than silently dropping visible content. This is a banner extractor, not a general game animation player.

Input, decompression, texture pixels, output size, and scene recursion have explicit limits. Corrupt offsets and missing references return errors.

Format references: [SupercellFlash schemas](https://github.com/sc-workshop/SupercellFlash/tree/main/supercell-flash/sc2_schemas), [SC5 format research](https://github.com/obus-globus/sc5-parser), and the [Rust texture decoder](https://docs.rs/texture2ddecoder/0.1.2/texture2ddecoder/). Original game artwork belongs to Supercell; exact asset sources are recorded in the web manifest.

## Checks

```sh
cargo test --locked --manifest-path apps/event-artwork/Cargo.toml
cargo fmt --check --manifest-path apps/event-artwork/Cargo.toml
cargo clippy --locked --manifest-path apps/event-artwork/Cargo.toml --all-targets -- -D warnings
```

The synthetic offline fixture checks zero-based export lookup, ASTC channel order, complete quad rendering without diagonal seams, dimensions, and CLI extraction. Unit tests also cover invalid input, matrix composition, transparent texture interpolation, and masking. The CLI write-failure test verifies that an existing PNG and another writer's temporary file are preserved.
