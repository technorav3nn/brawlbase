// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	modules: [
		"nitro-cloudflare-dev",
		"@nuxthub/core",
		"@nuxt/eslint",
		"@nuxt/ui",
		"@nuxtjs/i18n",
		"@nuxt/image",
		"@nuxt/fonts",
		"@nuxtjs/turnstile",
		"motion-v/nuxt",
		"@vueuse/nuxt",
		"@pinia/nuxt",
		"@pinia/colada-nuxt",
	],
	devtools: {
		enabled: true,
	},
	css: ["~/assets/css/main.css", "~/assets/css/global.css"],
	hub: {
		db: "sqlite",
		kv: true,
		blob: true,
		cache: true,
	},
	compatibilityDate: "2025-01-15",
	ui: {
		content: true,
	},
	i18n: {
		strategy: "no_prefix",
		defaultLocale: "en",
		locales: [
			{ code: "en", language: "en-US", name: "English", file: "en.json" },
			{ code: "es", language: "es-ES", name: "Español", file: "es.json" },
		],
		detectBrowserLanguage: {
			useCookie: true,
			cookieKey: "i18n_redirected",
			fallbackLocale: "en",
		},
	},
	turnstile: {
		siteKey: "0x4AAAAAADLmDteGhhNegcV0",
	},
	nitro: {
		preset: "cloudflare_module",
	},
	future: {
		compatibilityVersion: 5,
	},
	experimental: {
		// Existing handlers use Nitro/H3 auto-imports, disabled by Nuxt 5 compatibility defaults.
		nitroAutoImports: true,
		typedPages: true,
		asyncContext: true,
		inlineRouteRules: true,
		viteEnvironmentApi: true,
		typescriptPlugin: true,
	},
	image: {
		domains: [
			"cdn-old.brawlify.com",
			"cdn-fankit.brawlify.com",
			"cdn.deathblows.dev",
			"images.unsplash.com",
			"github.com",
			"brawlstars.inbox.supercell.com",
			"cdn.brawlify.com",
			"cdn.id.supercell.com",
		],
		alias: {
			cdn: "https://cdn.deathblows.dev",
		},
		screens: {
			300: 300,
			600: 600,
		},
		provider: "none",
		cloudflare: {
			baseURL: "https://brawlbase.deathblows.dev",
		},
		// eslint-disable-next-line n/prefer-global/process
		[process.env.NODE_ENV === "development" ? "ipx" : ""]: {},
	},
	fonts: {
		defaults: {
			preload: true,
			weights: [400, 500, 600, 700],
		},
	},
	colorMode: {
		fallback: "dark",
	},
	icon: {
		customCollections: [
			{
				prefix: "local",
				dir: "./src/assets/icons",
				height: 24,
				width: 24,
			},
		],
	},
	imports: {
		presets: [
			{
				from: "@pinia/colada",
				imports: ["defineQuery", "defineMutation", "defineQueryOptions", "defineMutationOptions"],
			},
		],
		dirs: ["queries", "routers"],
	},
	runtimeConfig: {
		clickhouseUrl: "",
		clickhouseUsername: "",
		clickhousePassword: "",
		clickhouseDatabase: "brawlbase_stats",
		betterAuthSecret: "",
		// eslint-disable-next-line n/prefer-global/process
		betterAuthUrl: process.env.NODE_ENV === "production" ? "https://brawlbase.deathblows.dev" : "http://localhost:3000",
		brawlStarsApiToken: "",
		scidAccountToken: "",
		// not private, don't worry im not leaking anything
		scidAccountId: "85-0e066b52-b348-4256-b6c1-4f12a18f54d9",
		turnstile: {
			// This can be overridden at runtime via the NUXT_TURNSTILE_SECRET_KEY
			// environment variable.
			secretKey: "",
		},
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
