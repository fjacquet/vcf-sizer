# Stack Research

**Domain:** Client-side SPA sizing calculator (VCF 9.x)
**Researched:** 2026-03-28
**Confidence:** HIGH (all versions verified against GitHub releases as of 2026-03-28)

---

## Decision: Vue 3 over React

**Use Vue 3 (Composition API).** The project constraints already lean toward Vue 3 + Pinia, and the evidence supports that choice:

- Vue 3's Composition API avoids the React Hooks rules-of-hooks caveats (no conditional hooks, no exhaustive-deps). Sizing calculators have deeply nested reactive computation trees — Vue's fine-grained reactivity is a better fit than React's re-render-everything model.
- `vue-i18n` is the most mature i18n library for Vue by a wide margin; there is no React-equivalent that matches its pluralization, datetime/number formatting, and SFC `<i18n>` block integration.
- Pinia 3 (official Vue state manager, Vue 3 only) is lighter and more type-safe than Zustand. The stores map naturally to the sizing domains (deployment profile, workload inputs, compute summary, storage summary).
- The full Vue ecosystem (Vue Router 5, @vueuse/core, vue-chartjs) forms a tighter integration surface than mixing React with equivalent libraries.

**Do not choose React** unless the team has no Vue experience and a hard preference. The localization ecosystem advantage alone tips the scale.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vue 3 | 3.5.31 | UI framework | Fine-grained reactivity ideal for live sizing math; Composition API provides clean separation of computation logic from templates; 3.6 vapor mode in beta adds future performance headroom |
| Vite 8 | 8.0.3 | Build tool / dev server | Rolldown-powered (Rust bundler): 10-30x faster builds vs Vite 6; built-in tsconfig paths; static deploy with `vite build` produces a single `/dist` folder ready for GitHub Pages / Vercel / Netlify |
| TypeScript | 5.7+ | Type safety | `strict: true` mandatory; `moduleResolution: "bundler"` required for Vite 8; catches sizing formula bugs at compile time |
| Tailwind CSS | 4.2.2 | Utility-first styling | v4 uses Oxide (Rust) engine with `@tailwindcss/vite` plugin — no PostCSS config, no content file declaration, single `@import "tailwindcss"` line; 5x faster full builds, 100x faster incremental; v4.2.2 explicitly supports Vite 8 |
| Pinia | 3.0.4 | State management | Official Vue state manager (Vuex successor); Vue 2 support dropped in v3 — pure Vue 3 focus; composition stores map cleanly to sizing domains; full TypeScript inference; DevTools timeline |
| vue-i18n | 11.3.0 | FR/EN/DE/IT localization | Definitive Vue i18n solution; Composition API (`useI18n()`); `<i18n>` SFC blocks; pluralization, datetime/number formatting with locale-aware Intl; v11 is mainstream (v9/v10 in maintenance mode; v8 EOL 2025) |
| vue-router | 5.0.4 | Client-side routing | Vue 3 official router; v5 merges unplugin-vue-router into core; hash mode for GitHub Pages compatibility with no server rewrite rules |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vue-chartjs | 5.3.3 | Chart.js wrapper for Vue 3 | Bar/doughnut charts for compute vs available, storage raw vs usable; reactive computed props via Composition API; Chart.js 4.x is a peer dep — full version control |
| Chart.js | 4.5.1 | Canvas-based charting engine | Peer dep of vue-chartjs; 11 KB gzipped; Canvas rendering (not SVG) = performant reactive updates on number changes; use for 4-6 charts in this tool |
| jsPDF | 4.2.1 | Client-side PDF export | Pure browser PDF generation; v4.2.x fixes security vulnerabilities (use no earlier version); combine with `html2canvas` for HTML-to-PDF; produces selectable text if you use the jsPDF text API directly rather than html2canvas |
| html2canvas | 1.4.1 | HTML-to-canvas capture | Used alongside jsPDF to export the sizing summary view to PDF; screenshot-style (rasterizes DOM); acceptable fidelity for a results summary page |
| lz-string | 1.5.0 | LZ compression for URL state | Compress JSON sizing config → `compressToEncodedURIComponent()` → URL query param; decompresses client-side on load; keeps URL under typical browser 2048-char limit even for large configs |
| @vueuse/core | 14.2.1 | Vue Composition utilities | `useClipboard`, `useShare`, `useLocalStorage`, `useUrlSearchParams` — accelerate URL state sync and copy-to-clipboard for share links; requires Vue 3.5+ (matches our stack) |
| vue-tsc | 2.x | TypeScript type-check for SFCs | Run `vue-tsc --noEmit` in CI; Vite transpiles TypeScript without type checking — vue-tsc fills this gap |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite 8 (`npm create vite@latest`) | Project scaffold | Use template `vue-ts` for TypeScript; produces clean Vite 8 + Vue 3 + TypeScript baseline |
| ESLint 9 (flat config) | Linting | `eslint-plugin-vue` + `@vue/eslint-config-typescript` + `@vue/eslint-config-prettier`; flat config (`eslint.config.js`) is default in ESLint 9 |
| Prettier | Code formatting | Pair with ESLint's `skipFormatting` option; do not configure formatting rules in ESLint |
| Vitest | Unit testing | Vite-native test runner; shares Vite config; use with `@vue/test-utils` for component tests and `@testing-library/vue` for behavioral tests; supports Browser Mode (4x faster than jsdom) |
| @vue/test-utils | Component test utilities | Official low-level Vue component mounting library; works directly with Vitest |
| vue-devtools (browser ext) | Dev debugging | Pinia store inspector + component tree; essential for sizing formula debugging |
| unplugin-vue-i18n | Vite i18n plugin | Companion to vue-i18n 11; pre-compiles translation files at build time (removes runtime parser overhead); required for production builds |

---

## Installation

```bash
# Scaffold with Vite 8 + Vue 3 + TypeScript
npm create vite@latest vcf-sizer -- --template vue-ts
cd vcf-sizer

# Core runtime dependencies
npm install vue-router@^5.0.4 pinia@^3.0.4
npm install vue-i18n@^11.3.0
npm install vue-chartjs@^5.3.3 chart.js@^4.5.1
npm install jspdf@^4.2.1 html2canvas@^1.4.1
npm install lz-string@^1.5.0
npm install @vueuse/core@^14.2.1

# Tailwind CSS v4 with Vite plugin
npm install tailwindcss@^4.2.2 @tailwindcss/vite@^4.2.2

# Build-time i18n compilation
npm install @intlify/unplugin-vue-i18n@^6.0.0

# Dev dependencies
npm install -D typescript vue-tsc
npm install -D vitest @vitest/ui jsdom
npm install -D @vue/test-utils @testing-library/vue
npm install -D eslint eslint-plugin-vue @vue/eslint-config-typescript @vue/eslint-config-prettier prettier
```

**Tailwind CSS v4 setup** — replace PostCSS config with Vite plugin:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

export default defineConfig({
  base: '/vcf-sizer/', // required for GitHub Pages repo subpath
  plugins: [
    vue(),
    tailwindcss(),
    VueI18nPlugin({ include: './src/locales/**' }),
  ],
  resolve: {
    alias: { '@': '/src' },
    tsconfigPaths: true, // Vite 8 built-in tsconfig paths
  },
})
```

```css
/* src/style.css — single line, no config file needed */
@import "tailwindcss";
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vue 3 + Pinia | React + Zustand | If the team has zero Vue experience and strong React preference; React ecosystem is larger but i18n story is weaker and the reactivity model adds Hooks complexity for deeply computed values |
| vue-i18n 11 | react-i18next / i18next | With React only; i18next is framework-agnostic but lacks SFC `<i18n>` block integration and vue-i18n's localized number/datetime composables |
| Chart.js + vue-chartjs | Recharts | With React; Recharts is SVG-only and React-specific; for Vue use vue-chartjs (Chart.js wrapper) or ApexCharts (heavier but richer) |
| Chart.js + vue-chartjs | ApexCharts | When you need interactive zooming, richer chart types, or built-in annotations; heavier bundle (~120 KB gzip vs ~40 KB for Chart.js); overkill for 4-6 static bar/doughnut charts |
| jsPDF 4 + html2canvas | pdfmake | When document is entirely programmatic/data-driven with no need to match screen layout; pdfmake's declarative JSON model is elegant but cannot overlay elements or reproduce complex CSS layouts |
| jsPDF 4 + html2canvas | html2pdf.js | html2pdf.js wraps html2canvas + jsPDF 2.x; outdated jsPDF dependency (misses security fixes in v4.x); use jsPDF 4 directly instead |
| lz-string | Native btoa/atob | btoa handles JSON state up to ~1 KB cleanly; lz-string needed when config JSON exceeds ~800 bytes after base64 encoding (likely with stretch cluster + AI workload inputs combined) |
| Vite 8 | Vite 6 | Vite 6 is stable and well-documented; choose it if Vite 8 ecosystem compatibility is a concern (e.g., some plugins not yet updated). Vite 8 is recommended here because Tailwind v4.2.2 explicitly supports it and Rolldown builds are substantially faster |
| Vitest | Jest + vue-jest | Jest requires heavy transform configuration for Vue SFCs; Vitest shares Vite config with zero extra setup |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vuex | Officially superseded by Pinia; verbose mutation/action boilerplate; no TypeScript inference without heavy augmentation; Vue team considers it legacy | Pinia 3 |
| vue-i18n v9 / v10 | Both entered maintenance mode July 2025; no new features; v8 is EOL | vue-i18n v11 |
| html2pdf.js | Wraps jsPDF 2.x, missing all security fixes from v3 and v4; last maintained 2021; produces image-only PDFs (non-selectable text) | jsPDF 4 + html2canvas directly |
| Options API (Vue 3) | Harder to share computation logic across components; sizing formulas belong in composables, not component options; Composition API (`<script setup>`) is the 2025 standard | `<script setup>` + Composition API |
| Vuetify / Quasar / PrimeVue | Full component libraries conflict with Tailwind's utility classes; adds 200–400 KB bundle weight for a single-page tool; heavy override ceremony | Tailwind CSS v4 with custom components |
| Vue CLI | Deprecated in favor of Vite; last update 2023; slower dev server; no rolldown support | Vite 8 (`npm create vite@latest`) |
| Moment.js | 67 KB gzip, tree-shaking hostile, in maintenance mode; locale files are large | Native `Intl.DateTimeFormat` (built into all target browsers) |
| Axios | Unnecessary for a zero-backend SPA; only native browser APIs needed for URL sharing and optional static JSON loading | Native `fetch` or `@vueuse/core` composables |

---

## Stack Patterns by Variant

**Deployment target: GitHub Pages**

- Set `base: '/vcf-sizer/'` in `vite.config.ts`
- Use `vue-router` in hash mode (`createWebHashHistory()`) — no server rewrite rules required
- Add `.nojekyll` file at repo root to disable Jekyll processing of `_` directories
- GitHub Actions workflow: `actions/setup-node` → `npm ci` → `npm run build` → `actions/deploy-pages`

**Deployment target: Vercel or Netlify**

- Set `base: '/'`
- Use `createWebHistory()` (HTML5 history mode) — both platforms handle SPA rewrites natively
- Add `vercel.json` or `netlify.toml` with `/* → /index.html` rewrite rule

**Locale strategy: Switzerland four-language**

- Default locale: `en` (fallback chain: `fr` → `en`, `de` → `en`, `it` → `en`)
- Locale files: `src/locales/en.json`, `fr.json`, `de.json`, `it.json`
- Browser-based locale detection: `navigator.language` mapped to supported locales at app init
- Number formatting: use `vue-i18n`'s `n()` composable with `CHF` currency config per locale
- The `unplugin-vue-i18n` Vite plugin pre-compiles all 4 locale files at build time (eliminates runtime `@intlify/message-compiler` dependency)

**URL state sharing**

- Serialize active Pinia store state to JSON → `lz-string.compressToEncodedURIComponent()` → append as `?config=<value>` URL param
- On app load: read `?config=`, `lz-string.decompressFromEncodedURIComponent()`, JSON.parse, hydrate Pinia store
- Use `@vueuse/core`'s `useUrlSearchParams()` for reactive URL param access
- Provide "Copy Link" button with `useClipboard()` from `@vueuse/core`

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vue@3.5.31 | pinia@3.0.4 | Pinia 3 requires Vue 3.5+ |
| vue@3.5.31 | @vueuse/core@14.2.1 | VueUse 14+ requires Vue 3.5+ |
| tailwindcss@4.2.2 | @tailwindcss/vite@4.2.2 | Must keep versions in sync; v4.2.2 explicitly supports Vite 8 |
| vite@8.0.3 | @vitejs/plugin-vue@latest | Use `@vitejs/plugin-vue` v5.x for Vue 3; do not use v4 |
| chart.js@4.5.1 | vue-chartjs@5.3.3 | Chart.js 4.x required as peer dep; Chart.js 5 not yet released |
| vue-i18n@11.3.0 | @intlify/unplugin-vue-i18n@6.x | Companion Vite plugin; must match vue-i18n major; v9/v10 plugins incompatible with v11 |
| jspdf@4.2.1 | html2canvas@1.4.1 | Use together for HTML-to-PDF; jsPDF 4 requires modern browser APIs (all target browsers qualify) |
| typescript@5.7+ | <vue-tsc@2.x> | `vue-tsc` 2.x requires TypeScript 5.x; set `moduleResolution: "bundler"` in tsconfig |

---

## Sources

- Vue 3.5.31 — [github.com/vuejs/core/releases](https://github.com/vuejs/core/releases) — verified 2026-03-28 (HIGH confidence)
- Vue Router 5.0.4 — [github.com/vuejs/router/releases](https://github.com/vuejs/router/releases) — verified 2026-03-28 (HIGH confidence)
- Pinia 3.0.4 — [github.com/vuejs/pinia/releases](https://github.com/vuejs/pinia/releases) — verified 2026-03-28 (HIGH confidence)
- vue-i18n 11.3.0 — [github.com/intlify/vue-i18n/releases](https://github.com/intlify/vue-i18n/releases) + [vue-i18n.intlify.dev](https://vue-i18n.intlify.dev/guide/migration/breaking11) — HIGH confidence
- Tailwind CSS 4.2.2 — [github.com/tailwindlabs/tailwindcss/releases](https://github.com/tailwindlabs/tailwindcss/releases) — HIGH confidence; v4.2.2 confirmed Vite 8 support
- Vite 8.0.3 — [github.com/vitejs/vite/releases](https://github.com/vitejs/vite/releases) + [vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8) — HIGH confidence
- Chart.js 4.5.1 — [github.com/chartjs/Chart.js/releases](https://github.com/chartjs/Chart.js/releases) — HIGH confidence
- vue-chartjs 5.3.3 — [github.com/apertureless/vue-chartjs/releases](https://github.com/apertureless/vue-chartjs/releases) — HIGH confidence
- jsPDF 4.2.1 — [github.com/parallax/jsPDF/releases](https://github.com/parallax/jsPDF/releases) — HIGH confidence; security fixes are why v4.2.x must be used
- @vueuse/core 14.2.1 — [vueuse.org](https://vueuse.org) + npm metadata — MEDIUM confidence (version from npm; Vue 3.5+ requirement from official docs)
- lz-string — [pieroxy.net/blog/pages/lz-string](https://pieroxy.net/blog/pages/lz-string/index.html) — MEDIUM confidence (stable library, no major release in years; version 1.5.0 current)
- Vite 8 + Rolldown announcement — [vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8) — HIGH confidence
- Tailwind CSS v4 + Vite integration — [tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4) + [vueschool.io tailwind 4 for vue](https://vueschool.io/articles/vuejs-tutorials/master-tailwindcss-4-for-vue/) — HIGH confidence
- ESLint 9 flat config for Vue 3 — [eslint.vuejs.org/user-guide](https://eslint.vuejs.org/user-guide/) — HIGH confidence
- Vue 3 vs React comparison — [devurai.com](https://devurai.com/vue-vs-react-in-2025-which-framework-should-you-choose-for-your-front-end/) + [decode.agency](https://decode.agency/article/react-vs-vue/) — MEDIUM confidence (editorial sources)
- PDF library comparison — [joyfill.io/blog/comparing-open-source-pdf-libraries-2025-edition](https://joyfill.io/blog/comparing-open-source-pdf-libraries-2025-edition) + [nutrient.io html-to-pdf comparison](https://www.nutrient.io/blog/html-to-pdf-in-javascript/) — MEDIUM confidence

---

*Stack research for: VCF 9.x sizing calculator (client-side SPA)*
*Researched: 2026-03-28*
