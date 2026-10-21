# Web app

From the repository root:

```sh
proto install
yarn install
yarn workspace @brawlbase/web dev
```

## Internationalization

Nuxt i18n loads English and Spanish from `i18n/locales`. The language selector updates messages and Nuxt UI's locale, and saves the selection in the `i18n_redirected` cookie. URLs retain their existing paths (`no_prefix`). SSR reads the visitor's cookie or browser language; unsupported languages fall back to English. The home page renders per request so one visitor's language is not baked into static HTML for everyone.

Keep locale keys in sync and use reactive translations (`computed` for field labels and navigation arrays). English fallback is configured in `i18n/i18n.config.ts`. Let `@nuxtjs/i18n` manage its matching Intlify dependencies rather than pinning an older internal `@intlify/shared` version.

TypeScript stays on the newest 6.x release because Vue's stable type checker and ESLint require its JavaScript compiler API. Upgrade it to 7.x once those tools support the new compiler API.

### VS Code / Volar

Use the **Vue (Official)** extension. Workspace settings disable the native TypeScript 7 language server and point VS Code at `node_modules/typescript/lib` (TypeScript 6.0.3). This overrides a globally enabled `js/ts.experimental.useTsgo` for this repository. Both the modern and legacy setting names are included for VS Code compatibility.

After installing dependencies, reload the VS Code window. Select **Use Workspace Version** if prompted, or run **TypeScript: Select TypeScript Version** and choose it. This selects the JavaScript TypeScript SDK that Volar needs; running `tsc` successfully with TypeScript 7 alone does not establish Vue editor compatibility. See [Microsoft's embedded-language guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#typescript-and-embedded-languages).

```sh
yarn workspace @brawlbase/web typecheck
yarn workspace @brawlbase/web build
```

When checking locale behavior, load the home/login/signup pages with English and Spanish browser preferences and `i18n_redirected` cookies. Switch languages in the header, navigate, and reload to verify that the selection persists. Keep translation keys in sync between both locale files.
