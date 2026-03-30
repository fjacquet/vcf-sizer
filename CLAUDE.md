# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server at http://localhost:5173
npm run build        # type-check (vue-tsc) then Vite production build → dist/
npm run test         # run all tests (Vitest, node environment)
npm run type-check   # run vue-tsc without emitting (included in build)
npm run preview      # preview production build locally
```

Run a single test file:

```bash
npx vitest run src/engine/storage.test.ts
```

Tests cover `src/engine/**/*.test.ts` and `src/composables/**/*.test.ts` only — no DOM environment needed.

## Architecture

### Strict Layer Separation (enforced by convention)

**Engine layer** (`src/engine/`) — Pure TypeScript, **zero Vue imports** (CALC-01). All sizing formulas are plain functions that accept typed inputs and return typed results. This is what the tests cover.

**Store layer** (`src/stores/`) — Two stores with a hard separation:

- `inputStore.ts` — all `ref()` mutable state (slider values, toggles)
- `calculationStore.ts` — **zero `ref()`** (CALC-02); only `computed()` values that call engine functions. Read-only derived state.
- `uiStore.ts` — locale switching and UI flags

**Component layer** (`src/components/`) — split into `input/` (forms), `results/` (display), `shared/` (reusable). Components read from stores, never call engine functions directly.

**Composables** (`src/composables/`) — plain TypeScript modules (no Vue lifecycle hooks). `useUrlState.ts` handles lz-string URL compression + Zod validation for shareable links. `useMarkdownExport.ts` generates Markdown/PDF export.

### i18n

4 locales: `en` (bundled), `fr-CH`, `de-CH`, `it-CH` (lazy-loaded on demand via `uiStore.setLocale`). All validation warning messages use i18n keys — never raw English strings. Swiss locales define explicit `numberFormats` (do not inherit from parent locale `fr`/`de`/`it`).

### URL State

`useUrlState.ts` serializes `inputStore` to JSON, compresses with lz-string, and appends as a URL query param. On load, `main.ts` calls `hydrateFromUrl()` which decompresses and validates through a Zod schema (`.strip()` discards unknown keys). The Zod schema mirrors `inputStore` with all fields optional + defaults.

### Path Alias

`@/` maps to `src/` throughout the project (configured in both `vite.config.ts` and `tsconfig.app.json`).

## Key Constraints

- Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library.
- `calculationStore.ts` must never contain `ref()` — only `computed()`.
- Validation warnings must use i18n message keys (e.g. `'validation.hostCount.tooFew'`), not English strings.
- `VueI18nPlugin` is configured with `include` omitted intentionally to avoid a rolldown/JSON conflict with Vite 8.

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`. Triggers on push to `maincd` branch (not `main`). Build output goes to `dist/`. The Vite `base` is `/vcf-sizer/`.
