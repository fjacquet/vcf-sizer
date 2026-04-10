---
phase: 18-store-foundations-wizard-navigation
plan: 02
status: complete
completed: 2026-04-10
tests_total: 279
---

# Plan 18-02 Summary — LandingView + App.vue + main.ts (WIZARD-02)

## What was done

**Task 1:** Added `landing.*` i18n namespace to all 4 locale files (en, fr, de, it) with 9 keys each: `title`, `subtitle`, `step1.title`, `step1.desc`, `step2.title`, `step2.desc`, `step3.title`, `step3.desc`, `cta`.

Created `src/components/shared/LandingView.vue`:
- Full-screen centered layout `min-h-[calc(100vh-56px)]`
- Tagline + subtitle + 3-step card grid + "Start Sizing" CTA button
- All text via `t()` — zero raw English strings
- `print:hidden`, `aria-hidden` on decorative badges, `<button>` for CTA
- Calls `ui.dismissLanding()` on CTA click

**Task 2:** Updated `src/App.vue`:
- Imported `LandingView`
- Added `<LandingView v-if="ui.isLandingVisible" />` before `<main>`
- Changed `<main>` to `<main v-else ...>` — wizard layout only shown after landing dismissed
- Header stays unconditional (always visible)

Updated `src/main.ts`:
- Added `uiStore.dismissLanding()` in URL hydration block alongside existing `confirmTopology()`

## Verification

- `rtk vitest run` → 279/279 PASS
- `rtk npm run type-check` → 0 errors
- `rtk npm run build` → 179 modules, clean output
- Human checkpoint auto-approved (--auto flag)
