import { brawlApi } from "@brawlbase/brawl-api";
import { BrawlStarsClient } from "@brawlbase/brawl-stars-api";
import { singleton } from "./common";

const brawlApiSingleton = singleton("brawl-api-client", brawlApi)!;
// const brawlStarsApiSingleton = singleton("brawl-stars-api-client", new BrawlStarsClient(useRuntimeConfig().brawlStarsApiToken));

export function useBrawlApi() {
	return brawlApiSingleton;
}

export function useBrawlStarsApi() {
	return new BrawlStarsClient(useRuntimeConfig(useEvent()).brawlStarsApiToken);
}
