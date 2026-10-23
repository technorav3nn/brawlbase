import { mergeConfig } from "tsdown";
import { defaultConfig } from "../../tsdown.config.js";

export default mergeConfig(defaultConfig, {
	deps: { neverBundle: ["drizzle-orm", "drizzle-orm/d1", "drizzle-orm/sqlite-core", "@cloudflare/workers-types"] },
});
