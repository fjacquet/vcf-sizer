---
phase: 10-domain-types-defaults-and-store-refactor
plan: 02
subsystem: store
tags: [pinia, vue3, computed, domain-results, aggregate-totals, tdd]

# Dependency graph
requires:
  - phase: 10-01
    provides: "DomainResult and AggregateTotals types in engine/types.ts, inputStore with workloadDomains array and managementDomain object"
provides:
  - "calculationStore.domainResults: computed<DomainResult[]> mapping over workloadDomains"
  - "calculationStore.aggregateTotals: computed<AggregateTotals> reducing domainResults"
  - "calculationStore.dedicatedMgmtHostCount reading from managementDomain (not workloadDomains[0])"
  - "Full TDD test suite for calculationStore with 19 passing tests"
affects: [phase-11, phase-12, phase-13, composables]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "domainResults computed array pattern: input.workloadDomains.map(domain => {...}) returns DomainResult[]"
    - "aggregateTotals computed reducer: domainResults.value.reduce() for cross-domain totals"
    - "effectiveHostCount computed per-domain inside .map() callback (Pitfall 6 avoided)"
    - "managementDomain independence: dedicatedMgmtHostCount reads input.managementDomain, never workloadDomains[0]"

key-files:
  created:
    - src/stores/calculationStore.test.ts
  modified:
    - src/stores/calculationStore.ts

key-decisions:
  - "Old flat computeds (compute, storage, stretch, vsanMax, validationErrors) removed — replaced by domainResults array; Phase 12 fixes components"
  - "Comment text must not contain 'ref(' pattern — regex-based CALC-02 compliance test is sensitive to comments"
  - "management computed uses workloadDomains[0].deploymentMode as baseline since management overhead depends on deployment mode"

patterns-established:
  - "TDD Wave 0 RED gate: 18 failing tests written before implementation, confirmed RED before proceeding to GREEN"
  - "CALC-02 compliance test: readFileSync check in test suite verifies zero ref() at file-read time"

requirements-completed: [DOM-05, DOM-06]

# Metrics
duration: 7min
completed: 2026-03-30
---

# Phase 10 Plan 02: Store Refactor Summary

**calculationStore rewritten with domainResults computed<DomainResult[]> array and aggregateTotals computed<AggregateTotals> reducer, CALC-02 maintained with zero ref()**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-30T10:56:43Z
- **Completed:** 2026-03-30T11:03:43Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Rewrote calculationStore from flat per-field computeds to per-domain domainResults array
- Added aggregateTotals computed reducer combining results from all workload domains
- Fixed dedicatedMgmtHostCount to read from managementDomain specs (not workloadDomains[0])
- TDD: 18 failing RED tests written before implementation; all GREEN after rewrite
- 125 store+engine tests pass with 0 failures; CALC-01 and CALC-02 fully verified

## Task Commits

Each task was committed atomically:

1. **Task 1: Write RED failing tests for calculationStore** - `0d3c5cb` (test)
2. **Task 2: Rewrite calculationStore — per-domain domainResults + aggregateTotals** - `a741a42` (feat)
3. **Task 3: Full regression validation and type-check** - No additional commit (validation only)

## Files Created/Modified

- `src/stores/calculationStore.test.ts` - 19 test cases covering domainResults (DOM-05), aggregateTotals (DOM-06), dedicatedMgmtHostCount isolation (DOM-03), CALC-02 compliance
- `src/stores/calculationStore.ts` - Complete rewrite: domainResults computed array mapping workloadDomains, aggregateTotals reducer, management + dedicatedMgmtHostCount computeds

## Decisions Made

- Old flat computeds (`compute`, `storage`, `stretch`, `vsanMax`, `validationErrors`) removed and replaced by `domainResults` array — Phase 12 will fix components/composables that reference old fields
- Comment text containing `ref()` was changed to avoid false-positive matches from the CALC-02 compliance regex test
- `management` computed uses `workloadDomains[0].deploymentMode` as a baseline since `calcManagement` requires `DeploymentMode`, not `ManagementArchitecture`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed false-positive CALC-02 compliance test failure from ref() in comments**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Comments in calculationStore contained "ref()" text (e.g., "// second computed, zero ref()") which the test regex matched as real ref() calls
- **Fix:** Changed comment wording from "zero ref()" to "no mutable state" / "ZERO mutable state" to avoid regex false-positive
- **Files modified:** src/stores/calculationStore.ts (comment lines only)
- **Verification:** CALC-02 test passes; 32 store tests GREEN
- **Committed in:** a741a42 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — comment text causing regex false-positive)
**Impact on plan:** Minor fix, no scope creep. Preserves intent of CALC-02 check.

## Issues Encountered

- Composable tests (`useMarkdownExport.test.ts`, `usePptxExport.test.ts`) fail (58 tests) because these composables reference the old flat calculationStore API (`calc.compute`, `calc.storage`, `calc.validationErrors`, etc.) and old inputStore flat fields (`store.deploymentMode`, `store.vmCount`, etc.). These are **expected Phase 12 scope** as documented in the plan.
- vue-tsc type errors in component and composable files are also **expected Phase 12 scope** — all errors are in `src/components/**` and `src/composables/` files referencing old flat APIs.
- Store layer (src/stores/) and engine layer (src/engine/) are fully clean: 125 tests pass, 0 failures.

## Verification Results

- CALC-01: PASS — no vue/pinia imports in src/engine/
- CALC-02: PASS — zero ref() calls in calculationStore.ts (4 computed() calls)
- domainResults: PASS — in return statement, computed<DomainResult[]>
- aggregateTotals: PASS — in return statement, computed<AggregateTotals>
- managementDomain.coresPerSocket: PASS — dedicatedMgmtHostCount reads from managementDomain
- Store tests: 125 PASS / 0 FAIL
- Engine tests: 93 PASS / 0 FAIL
- Composable tests: 58 FAIL (expected — Phase 12 scope)

## Known Stubs

None — domainResults and aggregateTotals are fully computed from live input state.

## Next Phase Readiness

- Phase 11 (URL state / Zod schema) can proceed — inputStore shape is stable, calculationStore API is stable
- Phase 12 (component refactor) has the necessary calculationStore API to migrate components from flat fields to domainResults[0]/aggregateTotals
- Phase 13 (per-domain result cards UI) can use domainResults array directly

## Self-Check

Files check:
- `src/stores/calculationStore.ts` — FOUND
- `src/stores/calculationStore.test.ts` — FOUND

Commits check:
- `0d3c5cb` — Task 1 RED tests
- `a741a42` — Task 2 GREEN implementation

---
*Phase: 10-domain-types-defaults-and-store-refactor*
*Completed: 2026-03-30*
