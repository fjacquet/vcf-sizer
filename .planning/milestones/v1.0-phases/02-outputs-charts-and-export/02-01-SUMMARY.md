---
phase: 02-outputs-charts-and-export
plan: "01"
subsystem: ui-visualization
tags: [chart.js, vue-chartjs, tailwind-v4, split-screen, results-panel]
dependency_graph:
  requires:
    - "01-xx (calculationStore, inputStore, engine types)"
  provides:
    - "ResultsPanel component with HostCountCard + 3 live charts"
    - "Split-screen layout (md:grid-cols-2 CSS Grid)"
    - "Tailwind v4 print variant activated"
  affects:
    - "src/App.vue (layout refactored)"
    - "src/i18n/locales/*.json (results.* keys added)"
tech_stack:
  added:
    - "vue-chartjs@5.3.3 (Vue 3 wrapper for Chart.js)"
    - "chart.js@4.5.1 (canvas charting engine)"
    - "lz-string@1.5.0 (URL state compression, for plan 02-02)"
    - "zod@4.3.6 (schema validation, for plan 02-02)"
    - "@vueuse/core@14.2.1 (clipboard utils, for plan 02-02)"
  patterns:
    - "computed() returning new object reference bound to vue-chartjs :data prop"
    - "storeToRefs(calc) for reactive store decomposition in chart components"
    - "@custom-variant print in Tailwind v4 style.css entry point"
key_files:
  created:
    - "src/components/results/ResultsPanel.vue"
    - "src/components/results/HostCountCard.vue"
    - "src/components/results/charts/CoresChart.vue"
    - "src/components/results/charts/RamChart.vue"
    - "src/components/results/charts/StorageChart.vue"
  modified:
    - "src/App.vue (split-screen layout, ResultsPanel import)"
    - "src/style.css (@custom-variant print added)"
    - "src/i18n/locales/en.json (results.hostCount.*, results.charts.* keys)"
    - "src/i18n/locales/fr.json (results.* keys — FR translations)"
    - "src/i18n/locales/de.json (results.* keys — DE translations)"
    - "src/i18n/locales/it.json (results.* keys — IT placeholder translations)"
    - "package.json (5 new dependencies)"
decisions:
  - "Used computed() + vue-chartjs declarative :data prop — not shallowRef+triggerRef — for chart reactivity (per CONTEXT.md D-VIZ-07 and RESEARCH.md Pattern 1)"
  - "Used storeToRefs(calc) consistent with existing ManagementSummary.vue pattern"
  - "HostCountCard green threshold: recommendedHostCount <= both minHostsForCpu AND minHostsForRam (most conservative correct interpretation)"
  - "Chart components created in Task 2 execution to satisfy ResultsPanel import requirements before build verification"
metrics:
  duration: "6 minutes"
  completed: "2026-03-29"
  tasks_completed: 3
  files_created: 5
  files_modified: 8
---

# Phase 2 Plan 01: Split-Screen Layout, HostCountCard, and Chart Components Summary

**One-liner:** CSS Grid split-screen with Chart.js 4.x/vue-chartjs 5.x real-time bar charts and HostCountCard driven by computed() props from calculationStore.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install dependencies and add Tailwind v4 print variant | ff5476e | package.json, package-lock.json, src/style.css |
| 2 | Refactor App.vue + build ResultsPanel and HostCountCard | dea3a3e | src/App.vue, ResultsPanel.vue, HostCountCard.vue, 4x locale JSON |
| 3 | Build CoresChart, RamChart, and StorageChart | 862f2e5 | CoresChart.vue, RamChart.vue, StorageChart.vue |

## What Was Built

### Split-Screen Layout (VIZ-01)

`src/App.vue` refactored from single-column `max-w-2xl` to `grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-56px)]`. Left pane has `border-r print:hidden` with all input components. Right pane has `bg-gray-50 print:col-span-2` with `ResultsPanel`. Sticky header also gets `print:hidden`.

### Print CSS Variant (EXPORT-04 preparation)

`src/style.css` now has `@custom-variant print (@media print);` — activates `print:hidden` and `print:col-span-2` Tailwind utility classes under Tailwind v4 (where print is not built-in).

### HostCountCard (VIZ-05)

Displays `recommendedHostCount` in `text-5xl font-bold` with conditional color: `text-emerald-600` when host count covers both CPU and RAM minimums, `text-red-600` otherwise. Also shows `minHostsForCpu` and `minHostsForRam` as secondary info. Uses `storeToRefs(calc)` + `computed()` for reactive status color.

### CoresChart and RamChart (VIZ-02, VIZ-03)

Both are grouped bar charts via `vue-chartjs Bar` component. Data is a `computed()` returning a new `ChartData<'bar'>` object reference — vue-chartjs built-in watcher calls `chart.update()` on each new reference. Colors: teal when safe (required <= available), red when over-capacity. ChartJS modules registered at module level.

### StorageChart (VIZ-04)

Stacked bar chart with three datasets from `storage` computed ref: `safeUsableCapacityTB` (teal), `lfsOverheadTB` (amber), `metadataOverheadTB` (slate). Stacking enabled via `scales.x.stacked + scales.y.stacked`. Legend shown at bottom.

## Verification

- `npm run build`: PASS (0 TypeScript errors, 81 modules)
- `npm run test`: PASS (30/30 tests)
- All 5 new component files created under `src/components/results/`
- `@custom-variant print` in `src/style.css`
- No `shallowRef` used for chart data (only `computed()`)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note:** Chart components (Task 3) were created during Task 2 execution because `ResultsPanel.vue` imports them at the top level. Creating them as stubs would have required a second pass; creating them fully in Task 2 was more efficient. This is an ordering optimization, not a plan deviation.

## Known Stubs

None. All chart components are fully wired to live store data via `storeToRefs(calc)` + `computed()`. HostCountCard displays real `recommendedHostCount`. No placeholder text or hardcoded empty data.

## Self-Check: PASSED

Files verified present:
- FOUND: src/components/results/ResultsPanel.vue
- FOUND: src/components/results/HostCountCard.vue
- FOUND: src/components/results/charts/CoresChart.vue
- FOUND: src/components/results/charts/RamChart.vue
- FOUND: src/components/results/charts/StorageChart.vue
- FOUND: @custom-variant print in src/style.css
- FOUND: md:grid-cols-2 in src/App.vue

Commits verified present:
- ff5476e: chore(02-01): install dependencies + print variant
- dea3a3e: feat(02-01): split-screen + ResultsPanel + HostCountCard
- 862f2e5: feat(02-01): CoresChart + RamChart + StorageChart
