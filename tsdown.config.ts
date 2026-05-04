import { defineConfig } from "tsdown";

export const defaultConfig = defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "es2022",
	minify: false,
	dts: true,
	sourcemap: true,
});
