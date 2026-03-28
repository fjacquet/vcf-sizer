---
phase: 01-foundation-engine-and-inputs
plan: 01
subsystem: ui
tags: [vue3, vite, tailwind, pinia, vue-i18n, typescript, vitest, i18n, swiss-locales]

# Dependency graph
requires: []
provides:
  - Vite 8 + Vue 3 + TypeScript project scaffold with GitHub Pages deploy workflow
  - Tailwind CSS v4 zero-config setup via @tailwindcss/vite plugin
  - vue-i18n v11 with legacy: false (Composition API), four Swiss locales, explicit numberFormats
  - Pinia inputStore with all user input refs (deployment, host, workload, storage)
  - Pinia uiStore with browser locale detection and setLocale action
  - LanguageSwitcher component (EN/FR/DE/IT buttons)
  - WarningBanner component (error/warning severity)
  - Vitest configured for pure Node engine tests
  - Decimal.js installed for future arithmetic engine

affects:
  - 01-02 (calculation engine will import from inputStore, uses Decimal.js)
  - 01-03 (input panel components import from inputStore, use i18n keys, use WarningBanner)
  - All future phases (all depend on inputStore contract and i18n key namespace)

# Tech tracking
tech-stack:
  added:
    - vite@8.0.3 (Rolldown-powered build tool)
    - vue@3.5.31
    - "@vitejs/plugin-vue"
    - "@tailwindcss/vite@4.2.2 + tailwindcss@4.2.2"
    - pinia@3.0.4
    - vue-i18n@11.3.0
    - "@intlify/unplugin-vue-i18n@6.0.8"
    - decimal.js@10.6.0
    - vue-router@5.0.4
    - vitest@4.1.2
    - vue-tsc@2.x
    - typescript@5.7+
  patterns:
    - Tailwind v4 zero-config (no postcss.config.js, no tailwind.config.js, single @import "tailwindcss")
    - vue-i18n Composition API mode (legacy: false mandatory)
    - Explicit Swiss locale numberFormats (fr-CH, de-CH, it-CH, en — no inheritance)
    - Pinia setup stores (composition API style with ref() and return {})
    - Lazy-loading non-EN locale files via dynamic import
    - Engine test files excluded from app tsconfig, tested by vitest with globals: true

key-files:
  created:
    - vite.config.ts
    - tsconfig.app.json
    - tsconfig.node.json
    - vitest.config.ts
    - src/style.css
    - src/main.ts
    - src/App.vue
    - src/vite-env.d.ts
    - src/i18n/index.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
    - src/stores/inputStore.ts
    - src/stores/uiStore.ts
    - src/components/shared/LanguageSwitcher.vue
    - src/components/shared/WarningBanner.vue
    - src/engine/placeholder.test.ts
    - .github/workflows/deploy.yml
  modified: []

key-decisions:
  - "Used @tailwindcss/vite plugin only — no PostCSS config, no tailwind.config.js (Tailwind v4 zero-config pattern)"
  - "Dropped @intlify/unplugin-vue-i18n include pattern — plugin with include breaks rolldown (Vite 8 JSON handler conflict); locale files chunked natively by rolldown"
  - "Swiss locales use full BCP47 codes (fr-CH, de-CH, it-CH) in vue-i18n — not short codes — to get correct Intl formatting"
  - "Engine test files excluded from tsconfig.app.json to avoid TS errors for vitest globals (describe/it/expect)"

patterns-established:
  - "Pattern 1: All Pinia stores use composition API (setup stores) — never options API"
  - "Pattern 2: Engine test files live in src/engine/*.test.ts, excluded from app tsconfig, run by vitest node environment"
  - "Pattern 3: vue-i18n numberFormats defined explicitly for all four locales — never rely on locale inheritance"

requirements-completed:
  - FOUND-01
  - FOUND-02
  - FOUND-03
  - FOUND-04
  - FOUND-05
  - FOUND-06
  - I18N-01
  - I18N-02
  - I18N-03
  - I18N-04
  - I18N-05

# Metrics
duration: 35min
completed: 2026-03-29
---

# Phase 1 Plan 01: Foundation Scaffold Summary

**Vite 8 + Vue 3 + Tailwind v4 project scaffold with vue-i18n v11 (Composition API, four Swiss locales), Pinia inputStore/uiStore, and language switcher**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-28T22:38:50Z
- **Completed:** 2026-03-29T00:15:00Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Complete Vite 8 project scaffold with TypeScript strict mode, path aliases, and GitHub Pages deploy workflow
- Tailwind v4 zero-config pattern: only `@import "tailwindcss"` in CSS, no PostCSS or tailwind config files
- vue-i18n v11 with `legacy: false`, explicit numberFormats for all four Swiss locales (fr-CH, de-CH, it-CH, en), lazy-loading of non-EN locales
- Pinia inputStore with all 18 user input refs (deployment, host specs, workload profile, storage config)
- Pinia uiStore with browser locale auto-detection (navigator.language) and setLocale action
- LanguageSwitcher component and WarningBanner component wired and working
- Vitest configured for pure Node engine tests; placeholder test passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold project and install all dependencies** - `f4ac759` (feat)
2. **Task 2: Wire vue-i18n v11 with four Swiss locales** - `6d44b05` (feat)
3. **Task 3: Create Pinia stores, main.ts, App.vue, components** - `67152e3` (feat)
4. **Auto-fix: Exclude test files from tsconfig.app.json** - `276cb8d` (fix)

## Files Created/Modified

- `vite.config.ts` - Vite 8 config with @tailwindcss/vite, @vitejs/plugin-vue, @intlify/unplugin-vue-i18n (no include)
- `tsconfig.app.json` - Strict TypeScript, bundler moduleResolution, path aliases, engine tests excluded
- `src/style.css` - Single line: `@import "tailwindcss"` (Tailwind v4 zero-config)
- `src/i18n/index.ts` - createI18n with legacy: false, all 4 Swiss numberFormats, loadLocale() lazy-loader
- `src/i18n/locales/en.json` - Source-of-truth EN keys (app, language, deployment, host, workload, storage, warnings, management)
- `src/i18n/locales/fr.json` - Complete French translations
- `src/i18n/locales/de.json` / `it.json` - EN fallback (translations complete in Phase 3)
- `src/stores/inputStore.ts` - 18 user input refs: deploymentMode, host specs, workload profile, storage config
- `src/stores/uiStore.ts` - locale ref, browser detection on init, setLocale async action
- `src/components/shared/LanguageSwitcher.vue` - EN/FR/DE/IT buttons, active state highlight
- `src/components/shared/WarningBanner.vue` - error/warning severity banner, role="alert"
- `src/App.vue` - Minimal shell with header, title via $t(), LanguageSwitcher
- `src/main.ts` - createPinia() + i18n + App mounted in correct order
- `vitest.config.ts` - Node environment, globals: true, src/engine/**/*.test.ts
- `.github/workflows/deploy.yml` - GitHub Actions: npm ci + build + deploy-pages

## Decisions Made

- **Dropped @intlify/unplugin-vue-i18n `include` option:** The plugin with `include: ['src/i18n/locales/**']` crashes rolldown (Vite 8 bundler) with "expected value at line 1 column 1" on pre-compiled JSON. Rolldown processes JSON locale files natively and correctly chunks them for lazy-loading. Plugin retained without `include` for future SFC `<i18n>` block support.
- **Used @tailwindcss/vite (not PostCSS):** Per Tailwind v4 design — no config files needed.
- **vue-i18n Swiss locale keys use full BCP47 codes:** fr-CH, de-CH, it-CH in numberFormats to avoid inheriting European separators from parent locales.
- **Engine test files excluded from tsconfig.app.json:** vitest `globals: true` provides describe/it/expect without type declarations in app tsconfig.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @intlify/unplugin-vue-i18n v6 crashes with Vite 8/rolldown when include pattern is set**
- **Found during:** Task 1 verification (build)
- **Issue:** Plugin pre-compiles JSON locale files into a format that rolldown's built-in JSON handler cannot parse, resulting in 4 "expected value at line 1 column 1" errors
- **Fix:** Removed the `include` option from VueI18nPlugin config. Rolldown handles JSON natively and correctly splits locale files into separate chunks for lazy loading. Plugin kept for future SFC `<i18n>` block support.
- **Files modified:** vite.config.ts
- **Verification:** `npm run build` exits 0, locale files appear as separate chunks in dist/
- **Committed in:** `f4ac759` (Task 1 commit, then refined in final vite.config.ts)

**2. [Rule 1 - Bug] vitest globals (describe/it/expect) not recognized by TypeScript**
- **Found during:** Task 3 verification (full `npm run build` including vue-tsc)
- **Issue:** placeholder.test.ts included in tsconfig.app.json compilation — vitest types not declared, causing TS2582/TS2304 errors
- **Fix:** Added `exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"]` to tsconfig.app.json
- **Files modified:** tsconfig.app.json
- **Verification:** `npm run build` exits 0, `npm run test` passes 1/1
- **Committed in:** `276cb8d`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes required for the build to succeed. No scope creep. Core functionality unchanged.

## Issues Encountered

- `npm create vite@latest` is interactive and cannot be run non-interactively in this environment — all scaffold files were created manually (same result, just different method)

## Known Stubs

None — this plan creates infrastructure only (no data-display components). Placeholder test is intentional and documented.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- inputStore contract is locked: 18 refs covering all VCF sizing inputs; Plan 02 (calculation engine) can import these directly
- i18n key namespace established in en.json; Plan 03 (input panels) adds component-specific keys to this namespace
- vitest configuration ready for Plan 02 engine tests
- WarningBanner component available for Plan 03's VCFA core blocker warning

## Self-Check: PASSED

All 17 files verified present. All 4 task commits verified in git history.

---
*Phase: 01-foundation-engine-and-inputs*
*Completed: 2026-03-29*
