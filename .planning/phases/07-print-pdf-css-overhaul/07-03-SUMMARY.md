---
phase: 07-print-pdf-css-overhaul
plan: 03
subsystem: ui
tags: [css, print, tailwind, vue, charts, pdf]

# Dependency graph
requires:
  - phase: 07-01
    provides: break-inside-avoid and @page rule established
provides:
  - "print:hidden on Chart.js canvas wrapper in all 3 chart components"
  - "hidden print:table fallback data tables in CoresChart, RamChart, StorageChart"
  - "break-inside-avoid on all 3 chart component root divs"
affects:
  - PRINT-06

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "print:hidden on canvas wrapper to hide Chart.js canvas in print media"
    - "hidden print:table on sibling <table> element: hidden on screen, display:table in print"
    - "break-inside-avoid on chart card root div prevents mid-chart page splits"
    - "print:table (not print:block) on <table> elements — preserves semantic table rendering"

key-files:
  created: []
  modified:
    - src/components/results/charts/CoresChart.vue
    - src/components/results/charts/RamChart.vue
    - src/components/results/charts/StorageChart.vue

key-decisions:
  - "Used print:table (not print:block) on <table> elements — display:block on a table breaks semantic rendering"
  - "No script changes needed — compute and storage storeToRefs already in scope in all chart components"
  - "StorageChart RAID overhead row uses same formula as chart dataset: rawCapacityTB - usableAfterRaidTB"

requirements-completed:
  - PRINT-06

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 07 Plan 03: Chart Print Fallback Tables Summary

**Chart.js canvas hidden in print via print:hidden, replaced by semantic data tables using hidden print:table pattern in all three chart components (CoresChart, RamChart, StorageChart)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T07:15:08Z
- **Completed:** 2026-03-30T07:17:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `print:hidden` to the Chart.js canvas wrapper div in CoresChart, RamChart, and StorageChart — prevents blank canvas elements in printed output
- Added `hidden print:table` fallback tables to all 3 chart components — visible only in print, hidden on screen
- CoresChart table: 2-column table (required / available) with `compute.totalCoresRequired` and `compute.availableCores`
- RamChart table: 2-column table (required / available) with `compute.totalRamRequiredGB` and `compute.availableRamGB` (GB unit appended)
- StorageChart table: 4-row table (storageUsable, storageLfs, storageMetadata, storageRaid) with TB values formatted to 2 decimal places
- Added `break-inside-avoid` to root div of all 3 chart components, preventing mid-chart page splits
- All i18n keys already existed in the chart components — no new translation keys needed
- Build passes (170 modules, 473 kB bundle), all 142 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add print fallback tables to CoresChart and RamChart** - `3d8ac4c` (feat)
2. **Task 2: Add print fallback table to StorageChart** - `afe6e90` (feat)

## Files Created/Modified

- `src/components/results/charts/CoresChart.vue` - Added break-inside-avoid, print:hidden on canvas, hidden print:table fallback with required/available cores
- `src/components/results/charts/RamChart.vue` - Added break-inside-avoid, print:hidden on canvas, hidden print:table fallback with required/available RAM
- `src/components/results/charts/StorageChart.vue` - Added break-inside-avoid, print:hidden on canvas, hidden print:table fallback with 4 storage breakdown rows

## Decisions Made

- `print:table` used on `<table>` elements (not `print:block`) — Tailwind's `display: block` on a table element breaks semantic table layout rendering in print
- No script changes were needed in any chart component — `compute` and `storage` are already destructured via `storeToRefs(calc)` in each file, and `t` is in scope from `useI18n()`
- StorageChart RAID overhead row uses `(storage.rawCapacityTB - storage.usableAfterRaidTB).toFixed(2)` — identical formula to the chart dataset definition, ensuring data consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 3 chart components now have proper print/PDF fallback tables satisfying PRINT-06
- Phase 07 (print-pdf-css-overhaul) is now complete: Plans 01 (foundation), 02 (header/footer), and 03 (chart fallback tables) all executed
- All 142 tests pass, build succeeds at 473 kB — no regressions

---
*Phase: 07-print-pdf-css-overhaul*
*Completed: 2026-03-30*

## Self-Check: PASSED

- FOUND: src/components/results/charts/CoresChart.vue
- FOUND: src/components/results/charts/RamChart.vue
- FOUND: src/components/results/charts/StorageChart.vue
- FOUND: .planning/phases/07-print-pdf-css-overhaul/07-03-SUMMARY.md
- FOUND: commit 3d8ac4c (Task 1)
- FOUND: commit afe6e90 (Task 2)
