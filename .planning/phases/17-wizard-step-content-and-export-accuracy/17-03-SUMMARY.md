---
phase: 17-wizard-step-content-and-export-accuracy
plan: 3
subsystem: export
tags: [markdown, pptx, export, management-hosts, aggregate-totals, tdd]

requires:
  - phase: 17-01
    provides: wizard step content foundation

provides:
  - Management hosts row in Markdown export aggregate section (EXPORT-01)
  - buildAggregateSlideData() 3-arg function in usePptxExport.ts (EXPORT-02)
  - AggregateTotals interface in engine/types.ts
  - aggregateTotals computed in calculationStore (single-domain bridge)

affects:
  - future multi-domain export phases
  - PPTX aggregate totals slide callers

tech-stack:
  added: []
  patterns:
    - "Management hosts display: dedicated -> numeric count, non-dedicated -> 'colocated with WLD-1'"
    - "buildAggregateSlideData 3-arg signature: (totals, managementArchitecture, dedicatedMgmtHostCount)"
    - "AggregateTotals as bridge type for single-domain to future multi-domain migration"

key-files:
  created:
    - src/engine/types.ts (AggregateTotals interface added)
  modified:
    - src/composables/useMarkdownExport.ts
    - src/composables/usePptxExport.ts
    - src/composables/useMarkdownExport.test.ts
    - src/composables/usePptxExport.test.ts
    - src/stores/calculationStore.ts

key-decisions:
  - "AggregateTotals interface added to engine/types.ts as bridge for single-domain v2.1 -> multi-domain v3.0 migration path"
  - "aggregateTotals computed added to calculationStore as single-domain bridge: totalRecommendedHosts from compute, totalVmCount from input, storage totals from storage result"
  - "Management hosts display logic: === 'dedicated' && dedicatedMgmtHostCount !== null -> numeric; all other cases -> 'colocated with WLD-1'"
  - "Markdown Management hosts row placed in MD-03 Management Architecture section (no separate aggregate section in v2.1)"

patterns-established:
  - "EXPORT-01/02: Management hosts row always present in both export formats, value conditional on architecture"

requirements-completed: [EXPORT-01, EXPORT-02]

duration: 4min
completed: 2026-03-31
---

# Phase 17 Plan 3: Export Accuracy Summary

**Management hosts row added to Markdown and PPTX exports with TDD: shows numeric count (dedicated) or 'colocated with WLD-1' (non-dedicated), backed by new AggregateTotals type and aggregateTotals computed**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T07:32:52Z
- **Completed:** 2026-03-31T07:37:00Z
- **Tasks:** 2
- **Files modified:** 5 (plus 2 source files for types/store)

## Accomplishments

- Added `AggregateTotals` interface to `src/engine/types.ts` with four fields needed for procurement summary rows
- Added `aggregateTotals` computed to `calculationStore` as a single-domain bridge (zero `ref()`, CALC-02 compliant)
- Implemented `| Management hosts |` row in `useMarkdownExport.ts` MD-03 section (EXPORT-01)
- Implemented `buildAggregateSlideData()` 3-arg function in `usePptxExport.ts` returning 5 rows with Management hosts (EXPORT-02)
- TDD discipline maintained: 6 failing tests committed before any implementation, then all 188 tests green

## Task Commits

1. **Task 1: TDD RED — Write failing tests for export management hosts rows** - `3ccc2c0` (test)
2. **Task 2: Implement management hosts row in Markdown and PPTX exports** - `121f1d0` (feat)

## Files Created/Modified

- `src/engine/types.ts` - Added `AggregateTotals` interface
- `src/stores/calculationStore.ts` - Added `aggregateTotals` computed property
- `src/composables/useMarkdownExport.ts` - Management hosts line in MD-03 section (EXPORT-01)
- `src/composables/usePptxExport.ts` - `buildAggregateSlideData()` function with 3-arg signature (EXPORT-02)
- `src/composables/useMarkdownExport.test.ts` - 2 new tests for EXPORT-01
- `src/composables/usePptxExport.test.ts` - 4 new tests for EXPORT-02 + `buildAggregateSlideData` import

## Decisions Made

- `AggregateTotals` placed in `engine/types.ts` (not stores) for CALC-01 compliance — pure TypeScript type, zero Vue imports
- `aggregateTotals` computed placed in `calculationStore` as single-domain bridge mapping `compute.recommendedHostCount`, `input.vmCount`, and `storage` results — aligns with Phase 14 multi-domain model without requiring the full refactor now
- Management hosts row placed in MD-03 section (not a separate aggregate section) since v2.1 has no multi-domain aggregate section — test just uses `toContain()` so location is flexible
- Display logic maps `'shared'` (current default) and any non-`'dedicated'` value to `'colocated with WLD-1'` — forward compatible with Phase 15 rename from `'shared'` to `'colocated'`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added AggregateTotals type and aggregateTotals computed to support tests**
- **Found during:** Task 1 (TDD RED — writing tests)
- **Issue:** Plan's test code references `calc.aggregateTotals` and `AggregateTotals` type, neither of which existed in this v2.1 codebase
- **Fix:** Added `AggregateTotals` interface to `engine/types.ts` and `aggregateTotals` computed to `calculationStore` as single-domain bridge values
- **Files modified:** `src/engine/types.ts`, `src/stores/calculationStore.ts`
- **Verification:** Tests compile and run; `aggregateTotals` is CALC-02 compliant (computed-only)
- **Committed in:** `3ccc2c0` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical foundation for tests)
**Impact on plan:** Required addition enables both test and implementation to work. No scope creep — the type and computed are foundational prerequisites implied by the plan.

## Issues Encountered

None — once `AggregateTotals` and `aggregateTotals` were added as the bridge, the plan executed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EXPORT-01 and EXPORT-02 requirements satisfied
- `buildAggregateSlideData` has the 3-arg signature ready for multi-domain caller update (Phase 14 pattern)
- `aggregateTotals` in calculationStore ready for future multi-domain reducer replacement

---
*Phase: 17-wizard-step-content-and-export-accuracy*
*Completed: 2026-03-31*
