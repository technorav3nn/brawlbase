// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	modules: [
		"nitro-cloudflare-dev",
		"@nuxthub/core",
		"@nuxt/eslint",
		"@nuxt/ui",
		"motion-v/nuxt",
		"@vueuse/nuxt",
		"@pinia/nuxt",
		"@nuxtjs/turnstile",
		"@nuxt/image",
		"@pinia/colada-nuxt",
	],
	devtools: {
		enabled: true,
	},
	css: ["~/assets/css/main.css"],
	routeRules: {
		"/": { prerender: true },
	},
	hub: {
		db: "sqlite",
		kv: true,
		blob: true,
		cache: true,
	},
	compatibilityDate: "2025-01-15",
	ui: {},
	nitro: {
		preset: "cloudflare_module",
	},
	eslint: {
		config: {
			stylistic: {
				commaDangle: "never",
				braceStyle: "1tbs",
			},
		},
	},
});
