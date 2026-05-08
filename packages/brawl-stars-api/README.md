# @brawlbase/brawl-stars-api

Brawl Stars official API wrapper

-   TypeScript support
-   Promise based
-   Easy to use
-   100% coverage
-   Uses [ofetch](https://unjs.io/packages/ofetch) for requests

## Installation

```bash
npm install @brawlbase/brawl-stars-api
# or
pnpm install @brawlbase/brawl-stars-api
# or
yarn add @brawlbase/brawl-stars-api
# or
bun install @brawlbase/brawl-stars-api
```

## Usage

```ts
import { BrawlStarsClient } from "@brawlbase/brawl-stars-api";

const client = new BrawlStarsClient("!! PUT YOUR TOKEN HERE !!");

const player = await client.getPlayer("YPJVGUR8L");
console.log(player.name);
```
