---
phase: 21-per-domain-chart-visualizations
plan: 01
subsystem: ui
tags: [chart.js, vue-chartjs, per-domain, png-capture, props-driven]

# Dependency graph
requires:
  - phase: 13-multi-domain-results
    provides: DomainResult with compute and storage per domain
provides:
  - Per-domain Cores, RAM, Storage charts embedded in DomainResultCard
  - PNG capture via uiStore.chartImages[domainId] for PPTX export
affects: [22-pptx-export]

# Tech tracking
tech-stack:
  added: []
  patterns: [props-driven chart components, Chart.getChart(canvasId) PNG capture, animation:false for reliable toBase64Image]

key-files:
  created: []
  modified:
    - src/components/results/charts/CoresChart.vue
    - src/components/results/charts/RamChart.vue
    - src/components/results/charts/StorageChart.vue
    - src/components/results/DomainResultCard.vue

key-decisions:
  - "Chart components refactored from singleton store-reading to props-driven per-domain"
  - "Canvas IDs use string concat pattern (type-chart-domainId) to prevent Chart.js collisions"
  - "animation: false on all charts ensures reliable PNG capture via toBase64Image"

patterns-established:
  - "Props-driven chart pattern: chart components accept domain data via props, not store reads"
  - "PNG capture pattern: onMounted + watch with Chart.getChart(canvasId) and registerChartImage"

requirements-completed: [CHART-01]

# Metrics
duration: 4min
completed: 2026-04-11
---

# Phase 21 Plan 01: Per-Domain Chart Visualizations Summary

**Props-driven Cores/RAM/Storage charts in each DomainResultCard with per-domain canvas IDs and PNG capture for PPTX export**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-11T15:36:42Z
- **Completed:** 2026-04-11T15:41:04Z
- **Tasks:** 3 (2 auto + 1 auto-approved checkpoint)
- **Files modified:** 4

## Accomplishments
- Refactored CoresChart, RamChart, StorageChart from singleton store-reading to props-driven per-domain components
- Embedded all three charts in DomainResultCard with responsive 3-column grid
- Added PNG capture via Chart.getChart(canvasId) with animation:false for reliable toBase64Image
- Registered chart PNGs into uiStore.chartImages[domainId] for Phase 22 PPTX consumption
- Removed all useCalculationStore dependencies from chart components

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor chart components to props-driven with PNG capture** - `463346c` (feat)
2. **Task 2: Embed charts in DomainResultCard** - `c200a34` (feat)
3. **Task 3: Human verification of per-domain charts** - Auto-approved (auto-mode)

## Files Created/Modified
- `src/components/results/charts/CoresChart.vue` - Props-driven cores bar chart with PNG capture
- `src/components/results/charts/RamChart.vue` - Props-driven RAM bar chart with PNG capture
- `src/components/results/charts/StorageChart.vue` - Props-driven storage stacked bar chart with PNG capture
- `src/components/results/DomainResultCard.vue` - Imports and renders three per-domain charts

## Decisions Made
- Used Chart.getChart(canvasId) instead of chartRef.value.chart per vue-chartjs #1012 (ref.chart is null in Composition API)
- Set animation: false on all charts per Chart.js #2743 (prevents blank PNG from toBase64Image)
- Canvas IDs derived from domain.id using string concat (not template literals) to avoid i18n confusion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Per-domain chart PNGs are registered in uiStore.chartImages[domainId] ready for Phase 22 PPTX export
- 291 tests passing, type-check and build clean
- No regressions introduced

## Self-Check: PASSED

---
*Phase: 21-per-domain-chart-visualizations*
*Completed: 2026-04-11*
