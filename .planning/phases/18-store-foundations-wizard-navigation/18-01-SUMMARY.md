---
phase: 18-store-foundations-wizard-navigation
plan: 01
status: complete
completed: 2026-04-10
tests_added: 8
tests_total: 279
---

# Plan 18-01 Summary — Store Foundations + WizardStepper Click-Back

## What was done

**Task 1 (TDD):** Added 8 new tests to `uiStore.test.ts` (RED phase), then implemented in `uiStore.ts` (GREEN phase):
- `ChartType` type exported: `'cores' | 'ram' | 'storage'`
- `isLandingVisible` ref initialized to `true`
- `dismissLanding()` action sets it to `false` (idempotent)
- `chartImages` ref initialized to `{}`
- `registerChartImage(domainId, chartType, dataUrl)` action with per-domain key creation

**Task 2:** Updated `WizardStepper.vue` step pill div:
- Added `@click` and `@keydown.enter.space.prevent` with backward-only guard (`currentWizardStep > s.step`)
- Added `cursor-pointer hover:ring-2 hover:ring-green-400 transition-colors` to completed step class
- Added `:role="button"` and `:tabindex="0"` on completed steps (accessibility)

## Verification

- `rtk vitest run src/stores/uiStore.test.ts` → 18/18 PASS
- `rtk vitest run` → 279/279 PASS
- `rtk npm run type-check` → 0 errors
