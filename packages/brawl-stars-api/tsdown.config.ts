import { mergeConfig } from "tsdown";
import { defaultConfig } from "../../tsdown.config.js";

export default mergeConfig(defaultConfig, {
	clean: false,
	target: false,
});
