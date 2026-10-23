# BrawlBase agent guide

## Purpose and scope

BrawlBase is a Brawl Stars companion application for exploring brawlers, player and club information, events, rankings, and game reference material. Brawler reference pages combine API data with scraped Fandom content and game artwork. Account features use Better Auth and Supercell ID integration.

Build accurate, reliable features with a responsive interface that feels native to the project's Brawl Stars visual language. Preserve data contracts, source attribution, image quality, and existing behavior when refactoring. Clearly label preview or dummy content; never present invented values as live game data.

This file applies throughout the repository. Follow more specific `AGENTS.md` files in their directories when present. Explicit user instructions take precedence. Existing code provides context, but inconsistencies and unfinished code are not conventions to copy blindly.

## Repository structure

| Location | Responsibility |
| --- | --- |
| `apps/web` | Nuxt application, Nitro API routes, authentication, database, and UI. |
| `apps/web/app/pages` | File-based routes; nested brawler pages render through their parent route. |
| `apps/web/app/components/app` | Shared application chrome, such as the header and profile controls. |
| `apps/web/app/components/features` | Feature components and their closely related stores. Keep brawler-specific UI in `features/brawlers`. |
| `apps/web/app/composables` | Reusable reactive application behavior. |
| `apps/web/app/queries` | Pinia Colada query and mutation definitions. |
| `apps/web/app/utils` | Client-facing, usually pure presentation and data helpers. |
| `apps/web/app/app.config.ts` | Nuxt UI component defaults and shared component styling. |
| `apps/web/app/assets/css` | Existing Tailwind theme tokens and shared Brawl Stars geometry. |
| `apps/web/public` | Static game artwork, icons, backgrounds, and other assets served from `/`. |
| `apps/web/server/api` | Nitro/H3 API handlers. Method suffixes such as `.get.ts` and `.post.ts` define HTTP methods. |
| `apps/web/server/utils` | Server-only API clients, authentication, session, and request helpers. |
| `apps/web/server/db` | Drizzle SQLite schema and migrations, integrated through NuxtHub. |
| `apps/web/shared` | Types, constants, and pure utilities usable by both application and server code. |
| `apps/web/i18n` | Translation configuration and English/Spanish locale files. |
| `packages/brawl-api` | Typed BrawlAPI catalog, game CSV, and fan-kit helpers. |
| `packages/brawl-stars-api` | Client and types for the official Brawl Stars API. |
| `packages/supercell-id-api` | Supercell ID integration, with separate browser and crypto entry points. |
| `packages/supercell-api-utils` | Shared Supercell tag, date, and API utilities. |
| `packages/cdn` | CDN URL builders and generated scraper output types. |
| `apps/fandom-scraper-v2` | Rust scraper, image processing, output contracts, fixtures, and regression checks. |
| `.moon` and project `moon.yml` files | Workspace task graph and project build dependencies. |

Keep framework-specific application code in the web app. Shared packages should remain usable without Nuxt auto-imports or application stores. Import workspace packages through their public `@brawlbase/*` exports rather than reaching into another package's `src` directory.

## Tooling and commands

Use Yarn workspaces and Moon. The root `packageManager`, `.prototools`, `rust-toolchain.toml`, and `.moon/toolchains.yml` define the toolchain; use their pinned versions. Some starter README and CI examples still mention pnpm or generic Nuxt setup. Prefer the actual manifests and task definitions, and do not introduce a second lockfile.

Run these from the repository root:

| Task | Command |
| --- | --- |
| Install pinned tools | `proto install` |
| Install dependencies | `yarn install` |
| Start the web app | `yarn workspace @brawlbase/web dev` |
| Check the web app's types | `yarn workspace @brawlbase/web typecheck` |
| Lint the workspace | `yarn lint` |
| Lint selected files | `yarn exec eslint <paths>` |
| Build shared packages | `yarn build-packages` |
| Build the web app | `yarn workspace @brawlbase/web build` |
| Build the full task graph | `yarn build` |
| Build one package | `yarn workspace @brawlbase/<package> build` |
| Build the Rust scraper | `moon run fandom-scraper-v2:build` |
| Run scraper regression tests | `moon run fandom-scraper-v2:test` |
| Regenerate CDN declarations | `yarn workspace @brawlbase/cdn types:generate` |
| Check generated CDN declarations | `yarn workspace @brawlbase/cdn types:check` |

Reuse an existing development server where possible. Shared packages export built `dist` files, so rebuild an affected package before checking a consumer that imports it. Do not hand-edit build output to make a consumer work.

The root `format` script rewrites the entire repository. Prefer formatting only changed files with the configured formatter. Some existing scripts reference tools such as Prettier or Vitest without declaring them in the workspace manifests; confirm the tool and suite exist before relying on those commands. Report unavailable checks rather than silently installing an arbitrary version or claiming success.

## TypeScript and code organization

- Use TypeScript and ES modules. Keep strict checking, unused-variable checks, and `noUncheckedIndexedAccess` enabled.
- Prefer inference for straightforward local values. Explicitly type public interfaces, component contracts, external data boundaries, and non-obvious return values.
- Prefer `interface` for object contracts, as required by ESLint. Use `type` for unions, tuples, mapped types, and other compositions. Preserve generated types instead of rewriting them to satisfy a style preference.
- Reuse exported API/CDN types and derive types from schemas or existing contracts. Do not maintain parallel copies of the same payload shape.
- Use `unknown` for unvalidated external values and narrow them. Avoid introducing `any`, double assertions, or non-null assertions to suppress a real uncertainty, even where the current lint configuration permits them.
- Prefer `const`; use `let` only when reassignment is necessary. Use early returns to keep control flow readable.
- Give variables names that describe the domain: `brawlerId`, `selectedKit`, `movementProfiles`, and `powerLevel`, rather than vague names such as `itemData`, `temp`, or `val`. Short callback names are reasonable only when their meaning is immediate.
- Use camelCase for variables and functions, PascalCase for components/classes/interfaces/types, and descriptive `is`, `has`, `can`, or `should` prefixes for booleans. Use SCREAMING_SNAKE_CASE for shared fixed constants where the surrounding module follows that pattern. Do not prefix interfaces with `I` or types with `T` by default.
- Use kebab-case filenames for components, utilities, and feature modules. Composables use descriptive `use...` exports; stores use `use...Store`. Preserve Nuxt route conventions such as `[id].vue`, `index.vue`, and method-suffixed server files.
- Keep related code together. Extract parsing, formatting, and transformations into pure utilities; extract reactive coordination into composables. Create abstractions when they clarify a responsibility or remove meaningful duplication, not merely to shorten a file.
- Keep functions focused and avoid deeply nested conditionals. Comments should explain intent, source quirks, or a constraint rather than narrate the code. Document public APIs when their semantics are not obvious.
- Handle missing and invalid values explicitly. Distinguish `0` from absent data; do not replace missing game stats with plausible numbers. Avoid mutating API payloads or props while computing presentation data.

## Vue and Nuxt

- Use Vue single-file components with `<script setup lang="ts">` followed by `<template>`. Prefer the Composition API.
- Keep setup organized: imports, static options, route/store references and local state, derived state, handlers/effects, and page metadata. Keep parsing and bulky business logic out of templates.
- Use typed `defineProps`, `defineEmits`, and `defineModel` where appropriate. Props flow down and events communicate changes up; do not mutate a parent's object as an implicit update channel.
- Use `ref` for local mutable state and `computed` for derived values. Use `watch` for side effects or explicit synchronization, not to duplicate a value that can be computed.
- Preserve reactivity when destructuring Pinia stores with `storeToRefs`. Keep request data and selection state scoped correctly; avoid module-level reactive state shared between SSR requests.
- Use stable domain keys in `v-for`, such as an ID or a genuinely unique combination. Avoid array indices for lists that can reorder or filter.
- Keep template expressions simple. Prefer named computed values and handlers to repeated searches, parsing, or nested ternaries in markup.
- Rely on configured Nuxt/Vue auto-imports in application code; import feature modules and external contracts explicitly. In the app, `~` points at the app source, `~~` at the Nuxt project root, and `#shared` at `apps/web/shared`.
- Use Nuxt routing primitives (`NuxtLink`, `navigateTo`, `useRoute`, and page metadata) for internal navigation. Keep route-driven data reactive when a page can remain mounted as parameters change.
- Keep server rendering deterministic. Access browser APIs inside client lifecycle hooks or behind client guards; clean up listeners and timers. Use `<ClientOnly>` for genuinely browser-only integrations rather than masking hydration bugs.
- Use the existing Pinia Colada query definitions for shared remote data. Use Nuxt's SSR-aware fetch tools when appropriate for a page-specific request. Do not introduce another query library or fetch repeatedly in separate components for the same page data.
- Include all varying inputs in query keys, including IDs, filters, or locale when the response changes with them. Choose cache/stale durations deliberately and check the library's units.
- Keep public data loading distinct from editable UI state. Use the existing brawler parent route/store for nested brawler pages rather than adding duplicate requests to every tab.
- Provide useful loading, empty, unavailable, and error states. Use `useSeoMeta` for page titles and descriptions, with reactive values when the route data changes.

## UI, styling, and accessibility

- Use Nuxt UI components wherever they fit: forms, inputs, selects, buttons, cards, tabs, tooltips, alerts, and empty/loading states. Do not substitute raw HTML form controls for available Nuxt UI components.
- Use Tailwind utilities and Nuxt UI `ui` slots for page and component styling. Do not add component `<style>` blocks, inline style declarations, or new raw CSS for ordinary UI work. Existing shared theme files are the place for explicitly requested global theme changes.
- Preserve `app.config.ts` component defaults, semantic theme colors, and the shared `brawl-panel` treatment. Do not replace root slot classes in a way that silently removes the global design system.
- Continue the existing Instrument Sans body type and Lilita One `font-brawlstars` display type. Use spacing, hierarchy, artwork, and layout for emphasis. Keep gradient accents restrained.
- Use `UIcon` with Lucide (`i-lucide-*`) for interface symbols. Reuse existing Brawl Stars artwork in `public/icons` and real CDN ability/accessory images for game-specific visuals. Do not draw replacement SVG icons or add another icon library for these purposes.
- Reference public assets with root-relative URLs such as `/icons/speed-icon.png`. Give images dimensions, preserve their aspect ratio, and use `object-contain` for game icons/models. Meaningful images need useful alt text; purely decorative images need `alt=""`.
- Design for narrow screens, long stat values, translated labels, missing artwork, and light/dark modes. Use `min-w-0`, wrapping, and appropriate grid breakpoints rather than allowing horizontal overflow or clipping essential information.
- Keep interactive elements keyboard accessible with visible focus. Label inputs using `UFormField` or equivalent accessible labels. Tooltips must work on focus as well as hover and should explain supplementary information.
- Highlight only stats actually affected by the power selector as level-dependent. Preserve their explanatory tooltip. Keep conditional movement speeds paired with their conditions rather than truncating the source into a misleading single value.
- Add user-facing copy to both `i18n/locales/en.json` and `es.json`; keep keys aligned. Derive translated navigation/options with `computed` so changing locale updates them. Preserve the configured `no_prefix` strategy and language-cookie behavior.

## Nitro, APIs, and persistence

- Keep secrets and privileged API calls in server code. Read secrets through server runtime config; never place tokens in public runtime config, client bundles, URLs, or logs.
- Use the existing H3/Nitro handler conventions and auto-imports. Validate route parameters, query parameters, and request bodies at the boundary; reuse Zod where it fits. Return clear HTTP errors with `createError` and appropriate status codes.
- Check authentication and ownership in server handlers for protected operations. Client middleware improves navigation but does not authorize an API request. Use the existing Better Auth/session helpers.
- Use established server API-client helpers and workspace clients instead of duplicating upstream URL, token, retry, or error logic in components.
- Cache public, reusable API data deliberately. Never cache authenticated responses under a shared public key or let one user's session/configuration leak into another request. Pass request context when resolving request-specific runtime configuration.
- Nitro targets Cloudflare (`cloudflare_module`) and NuxtHub. Avoid filesystem assumptions and Node-only runtime dependencies in deployed handlers unless the configured target supports them. Keep browser-only and server-only package entry points separate.
- Use Drizzle and the existing SQLite schema. Keep schema changes and migrations consistent; do not modify applied migrations or hand-edit generated database metadata as a shortcut. Keep related writes atomic when consistency requires it.
- Treat Fandom text, upstream JSON, and user content as untrusted. Prefer Vue text interpolation to `v-html`; sanitize explicitly if rendering HTML is required. Log useful error context without exposing credentials or personal/session data.

## CDN packages and Rust scraper

- Keep shared package APIs explicit through their `src/index.ts` exports and `package.json` export maps. Respect dedicated browser/crypto entry points. Build/typecheck changes through the affected package.
- Use `@brawlbase/cdn` route builders rather than scattering CDN hosts and paths through the app.
- `apps/fandom-scraper-v2/src/output.rs` is the source of truth for generated CDN declarations. Regenerate `packages/cdn/src/generated/fandom.ts` through the provided command; never edit it manually.
- Preserve serialized shapes: accessory IDs are strings, history dates are ISO strings, absent fields may be omitted, and health/stat arrays may contain `null`. Preserve established contract spellings such as `brawlersAvaliableTo` unless an intentional migration is requested.
- Preserve scraper output directories, array order, source attribution, and compatibility behavior. Use the scraper README and regression fixtures when changing parsing, gear enrichment, image processing, or URL normalization.
- Preserve original image resolution and the documented profile-icon processing. The default profile icon belongs at `brawlers/<id>/icon.webp`. Avoid thumbnail transformations, guessed variant substitutions, or extra lossy conversion when selecting source artwork.
- Keep network concurrency bounded, handle transient failures with contextual errors/retries, and retain atomic output writes. Do not obtain speed improvements by dropping data or silently ignoring failures.
- For Rust changes, use the pinned toolchain, `cargo fmt`, Clippy, and relevant regression tests. From `apps/fandom-scraper-v2`, the documented checks are `cargo test --locked`, `cargo fmt --check`, and `cargo clippy --locked --all-targets -- -D warnings`.
- Prefer offline fixtures for regression checks. Live scrapes, snapshot refreshes, and benchmarks serve different purposes; do not refresh expected output merely to make a failing compatibility check pass.

## Formatting and lint rules

The checked-in configurations are authoritative: `.editorconfig`, `prettier.config.cjs`, and `eslint.config.mjs`.

- Use tabs with a display width of four, LF line endings, and a final newline.
- Use double quotes, semicolons, and the configured 130-character Prettier print width. Prettier's trailing-comma setting is `es5`; avoid imposing a different style across unrelated files.
- Follow ESLint import order: built-ins, external packages, internal modules, parent, sibling, then index imports; alphabetize within the configured groups without blank separators. Use type-only imports and inline type specifiers as configured by ESLint.
- In Node scripts, use explicit `node:` imports for built-ins and respect `eslint-plugin-n` rules about globals such as `process` and `Buffer`. Do not carry Node-only assumptions into Cloudflare handlers.
- Follow Vue attribute ordering and the configured maximum of five attributes on a single line. Break longer elements across lines. Let the Vue lint rules handle self-closing component/HTML conventions.
- ESLint relaxes several unsafe-type rules and permits `any`; this is compatibility with existing code, not a reason to introduce untyped code. Add a lint suppression only when necessary, scoped to the exact rule and explained.
- Run autofixes only on files relevant to the task and inspect the result. Do not weaken lint/type rules, change toolchain versions, or add a dependency merely to bypass an error.

## Validation and completion

- Inspect the existing diff before editing. Preserve unrelated and uncommitted work; keep changes scoped to the user's request.
- For TypeScript/Vue changes, run targeted ESLint and the relevant typecheck. Build affected shared packages before validating their consumers. Run a production build when the change affects bundling, SSR, deployment configuration, or package exports.
- Use meaningful tests for behavioral changes and regressions. Prefer existing suites and targeted fixtures. Do not add tests that only repeat trivial implementation details or create a test framework for a cosmetic edit.
- For UI changes, inspect the affected screen at narrow and wide widths and exercise changed controls when practical. Check long/missing data, keyboard interaction, and locale/theme behavior where relevant.
- For documentation-only changes, check paths, commands, configuration claims, and `git diff --check`; an application build is unnecessary.
- Do not edit `.nuxt`, `.output`, `dist`, `target`, `out`, caches, or generated declarations as source. Do not run deployment tasks or publish changes as part of routine validation.
- Finish by stating the concrete result, checks actually run, and any remaining limitation. Distinguish a passing lint/typecheck from a runtime or browser check; do not claim unperformed verification.
