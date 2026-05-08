import { mergeConfig } from "tsdown";
import { defaultConfig } from "../../tsdown.config.js";

export default mergeConfig(defaultConfig, {
	dts: true,
	entry: ["src/index.ts", "src/browser.ts", "src/crypto.ts"],
	format: ["esm", "cjs"],
	treeshake: true,
});
