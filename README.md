# Nuxt Starter Template

[![Nuxt UI](https://img.shields.io/badge/Made%20with-Nuxt%20UI-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)

Use this template to get started with [Nuxt UI](https://ui.nuxt.com) quickly.

- [Live demo](https://starter-template.nuxt.dev/)
- [Documentation](https://ui.nuxt.com/docs/getting-started/installation/nuxt)

<a href="https://starter-template.nuxt.dev/" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://ui.nuxt.com/assets/templates/nuxt/starter-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://ui.nuxt.com/assets/templates/nuxt/starter-light.png">
    <img alt="Nuxt Starter Template" src="https://ui.nuxt.com/assets/templates/nuxt/starter-light.png" width="830" height="466">
  </picture>
</a>

> The starter template for Vue is on https://github.com/nuxt-ui-templates/starter-vue.

## Quick Start

```bash [Terminal]
npm create nuxt@latest -- -t ui
```

## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-name=starter&repository-url=https%3A%2F%2Fgithub.com%2Fnuxt-ui-templates%2Fstarter&demo-image=https%3A%2F%2Fui.nuxt.com%2Fassets%2Ftemplates%2Fnuxt%2Fstarter-dark.png&demo-url=https%3A%2F%2Fstarter-template.nuxt.dev%2F&demo-title=Nuxt%20Starter%20Template&demo-description=A%20minimal%20template%20to%20get%20started%20with%20Nuxt%20UI.)

## Setup

Install [proto](https://moonrepo.dev/docs/proto/install), then install the repository's pinned Node, Yarn, Moon, and Rust/Cargo toolchains and dependencies:

```bash
proto install
yarn install
```

Rust tasks use Moon's managed toolchain; no separate manual Cargo installation is needed. Run `moon run fandom-scraper-v2:build` from the repository root to build the scraper, or `yarn workspace @brawlbase/cdn types:generate` to regenerate CDN types.

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Production

Build the application for production:

```bash
pnpm build
```

Locally preview production build:

```bash
pnpm preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## GitHub Actions

CI runs on pushes and pull requests. It installs the versions pinned in `.prototools`, installs dependencies with Yarn's immutable mode, and runs JavaScript/TypeScript linting and formatting checks, Rust formatting and Clippy, the web typecheck, and scraper tests through Moon.

The deployment workflows require a repository secret named `CLOUDFLARE_API_TOKEN` with permission to deploy Workers in the configured Cloudflare account:

- **Web Worker:** deploys on pushes to `main` and through the `Deploy web worker` workflow's manual trigger. Moon builds the web app and its workspace dependencies first.
- **Tracker Worker:** deploys on pushes to `main` when the tracker or one of its workspace dependencies changes, and through the `Deploy tracker worker` manual trigger. Moon builds the tracker and its dependencies first.
- **CDN assets:** every Sunday at 05:17 UTC, or through the `Refresh and deploy CDN` manual trigger, the workflow builds and runs the Rust Fandom scraper in strict mode, then deploys its `out/` assets with the existing `apps/fandom-scraper-v2/wrangler.jsonc` configuration.

The CDN currently uses Wrangler Workers Static Assets (`brawlbase-cdn`), as configured in that Wrangler file. Runtime secrets for the web and tracker Workers remain configured in Cloudflare; the workflows do not put application credentials in build logs or repository files.

All workflows share `.github/actions/setup`: Proto is pinned in `.moon/toolchains.yml`; Node, Yarn, Moon, and Rust versions come from `.prototools`. Tools are installed explicitly to avoid discovering unrelated plugins. Rustup files are cached alongside Proto's install records, and setup ensures that the compiler, Cargo, Clippy, and rustfmt are present before running Moon tasks.

Deployment workflows have a `dry_run` manual input. With `dry_run=true`, they execute the same builds and validate the resulting Wrangler deployment without uploading it. `act` also automatically uses this mode. For example, with Docker running:

```sh
docker build -t brawlbase-act-runner:local .github/act
act push -W .github/workflows/ci.yml -P ubuntu-latest=brawlbase-act-runner:local --pull=false
act workflow_dispatch -W .github/workflows/deploy-tracker.yml --input dry_run=true -P ubuntu-latest=brawlbase-act-runner:local --pull=false
act workflow_dispatch -W .github/workflows/deploy-web.yml --input dry_run=true -P ubuntu-latest=brawlbase-act-runner:local --pull=false
act workflow_dispatch -W .github/workflows/deploy-cdn.yml --input dry_run=true -P ubuntu-latest=brawlbase-act-runner:local --pull=false
```

For Colima, add `--container-daemon-socket -` because these jobs do not need a Docker socket inside their containers. On Apple Silicon, add `--container-architecture linux/arm64` for an ARM runner image. Give the VM at least 6 GB of memory and run the workflows serially. The CDN dry run still scrapes the live catalog; it needs network access and can take substantially longer than the build jobs. An expired or insufficient Cloudflare token can only be detected by an authenticated deployment.

## Renovate integration

Install [Renovate GitHub app](https://github.com/apps/renovate/installations/select_target) on your repository and you are good to go.
