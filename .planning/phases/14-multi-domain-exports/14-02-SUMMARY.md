---
phase: 14-multi-domain-exports
plan: "02"
subsystem: exports
tags: [pptx, multi-domain, vsan, composables, tdd, workload-domain, aggregate-totals]

requires:
  - phase: 14-multi-domain-exports
    plan: "01"
    provides: for-loop pattern over store.workloadDomains for export composables
  - phase: 13-per-domain-results-and-aggregate-totals
    provides: domainResults computed array, aggregateTotals, first-domain bridge in usePptxExport.ts

provides:
  - Full multi-domain PPTX export loop in usePptxExport.ts
  - Per-domain slide groups with config, workload, compute, storage, and conditional slides
  - Aggregate Totals slide after all domain slide groups (EXP-04)
  - buildAggregateSlideData replacing buildRecommendationsData (4 metric rows from AggregateTotals)
  - All PPTX helper functions accepting WorkloadDomainConfig directly (EXP-03)

affects:
  - usePptxExport.ts consumers (ExportToolbar.vue)
  - Phase 15+ (engine correctness fix; exports reflect corrected aggregate totals)

tech-stack:
  added: []
  patterns:
    - "Per-domain slide group: config + workload + compute + storage + conditional slides per domain"
    - "Domain loop: for (const domain of store.workloadDomains) + domainResults.find(r => r.id === domain.id)!"
    - "Aggregate slide after loop using buildAggregateSlideData(calc.aggregateTotals)"
    - "Helper function accepts domain: WorkloadDomainConfig directly — no store.workloadDomains[0] bridge"

key-files:
  created: []
  modified:
    - src/composables/usePptxExport.ts
    - src/composables/usePptxExport.test.ts

key-decisions:
  - "buildAggregateSlideData(totals) replaces buildRecommendationsData — summarizes all domains in 4 rows instead of single-domain read"
  - "All PPTX helper functions now accept WorkloadDomainConfig directly — no store bridge pattern in export composable"
  - "buildTitleSlideData(domainCount) returns domainCount (not deploymentMode) — title shows total domain count"
  - "Aggregate Totals slide placed after domain loop, before (optional) Validation Warnings — always second-to-last or last"
  - "Validation Warnings remains the final slide, sourcing allValidationErrors from calc.aggregateTotals (flattened across all domains)"

patterns-established:
  - "PPTX helper pattern: export function buildXSlideData(domain: WorkloadDomainConfig, ...): Array<{label, value}>"
  - "TDD RED/GREEN for export helper updates: test file updated first, production file updated second"

requirements-completed:
  - EXP-03
  - EXP-04

duration: 15min
completed: "2026-03-30"
---

# Phase 14 Plan 02: Multi-Domain PPTX Export Summary

**Full multi-domain PPTX loop with per-domain slide groups, aggregate totals slide, and all helpers accepting WorkloadDomainConfig directly (EXP-03, EXP-04)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-30T15:30:00Z
- **Completed:** 2026-03-30T15:45:00Z
- **Tasks:** 2 (TDD: Task 1 helper signatures + tests, Task 2 multi-domain loop)
- **Files modified:** 2

## Accomplishments

- Updated all 6 PPTX helper functions to accept `WorkloadDomainConfig` directly (no `store.workloadDomains[0]` bridge)
- Replaced `buildRecommendationsData` with `buildAggregateSlideData(totals: AggregateTotals)` returning 4 metric rows
- Updated `buildTitleSlideData` to accept `domainCount: number` instead of reading store
- Replaced single-domain slides in `generatePptxReport()` with per-domain loop: config + workload + compute + storage + 4 conditional slides per domain
- Added Aggregate Totals slide after domain loop using `buildAggregateSlideData(calc.aggregateTotals)`
- All 235 tests pass; `npm run build` clean (no type errors)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Update PPTX helper tests to use WorkloadDomainConfig directly** - `045330b` (test)
2. **Task 1 GREEN: Update PPTX helper signatures and add buildAggregateSlideData** - `ccc91dd` (feat)

**Plan metadata:** (committed with final docs commit)

_Note: Task 1 used TDD (RED then GREEN). Task 2 (multi-domain loop) was implemented as part of the GREEN phase since helpers and loop are tightly coupled._

## Files Created/Modified

- `src/composables/usePptxExport.ts` - Updated all helper signatures; replaced `buildRecommendationsData` with `buildAggregateSlideData`; replaced first-domain bridge with multi-domain loop + aggregate totals slide
- `src/composables/usePptxExport.test.ts` - Updated all test call sites to pass `WorkloadDomainConfig` directly; added multi-domain tests; replaced `buildRecommendationsData` tests with `buildAggregateSlideData` tests

## Decisions Made

- `buildAggregateSlideData(totals: AggregateTotals)` replaces `buildRecommendationsData` — the old function read a single domain result; the new one summarizes all domains in 4 rows from `AggregateTotals`
- All PPTX helper functions now accept `domain: WorkloadDomainConfig` directly — eliminates the `store.workloadDomains[0]` bridge pattern established in Phase 13 as a temporary measure
- `buildTitleSlideData` changed from `buildTitleSlideData(store)` to `buildTitleSlideData(domainCount: number)` — title slide shows total domain count, not deployment mode of domain 1
- Slide order: Title → Management Domain Overhead → [per-domain: Config + Workload + Compute + Storage + GPU? + NVMe? + Stretch? + vSAN Max?] → Aggregate Totals → Validation Warnings?
- `defineSlideMaster()` called once before the domain loop (Pitfall 2: must precede any `addSlide()`)

## Deviations from Plan

None - plan executed exactly as written. Both helper signature updates and multi-domain loop were pre-implemented.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 14 complete: Both Markdown and PPTX exports are fully multi-domain
- EXP-01, EXP-02, EXP-03, EXP-04 all validated
- v3.0 Multi-Domain Support milestone complete
- Phase 15 (engine correctness fix) and Phase 16 (wizard scaffold) can proceed
- Export composables will automatically reflect corrected aggregate totals once Phase 15 engine fix lands

---
_Phase: 14-multi-domain-exports_
_Completed: 2026-03-30_
