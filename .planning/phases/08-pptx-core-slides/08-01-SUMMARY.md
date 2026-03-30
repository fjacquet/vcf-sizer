---
phase: 08-pptx-core-slides
plan: "01"
subsystem: composables/pptx-export
tags: [tdd, wave-0, pptx, testing]
dependency_graph:
  requires: []
  provides: [usePptxExport.test.ts]
  affects: [src/composables/usePptxExport.ts]
tech_stack:
  added: []
  patterns: [createPinia+setActivePinia test isolation, TDD Wave 0 RED gate]
key_files:
  created:
    - src/composables/usePptxExport.test.ts
  modified: []
decisions:
  - "[08-01]: Wave 0 test file tests 7 data-mapping helpers as pure functions accepting store/calc instances — avoids pptxgenjs browser-API dependency in Node test environment (Pitfall 7)"
  - "[08-01]: buildRecommendationsData accepts both store and calc to allow combining compute + storage recommendations in one call"
metrics:
  duration: "2min"
  completed: "2026-03-30"
  tasks: 1
  files: 1
requirements:
  - PPTX-01
  - PPTX-02
  - PPTX-03
  - PPTX-04
  - PPTX-05
  - PPTX-06
  - PPTX-07
  - PPTX-08
  - PPTX-09
---

# Phase 08 Plan 01: PPTX Wave 0 TDD Gate Summary

**One-liner:** Failing test suite with 24 test cases for 7 PPTX slide data-mapping helpers + master color constant, establishing RED state before implementation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create failing test file for PPTX data-mapping helpers | d9186b2 | src/composables/usePptxExport.test.ts |

## What Was Built

`src/composables/usePptxExport.test.ts` — 24 test cases organized into 8 describe blocks:

1. **PPTX_MASTER_COLOR constant (PPTX-02):** Asserts value equals `'003087'` (Broadcom blue, no `#` prefix)
2. **buildTitleSlideData (PPTX-03):** 2 tests — deploymentMode default `'ha'`, date format `YYYY-MM-DD`
3. **buildConfigSummaryData (PPTX-04):** 3 tests — array length >= 8, label/value shape, hostCount=4
4. **buildWorkloadSlideData (PPTX-05):** 3 tests — array length >= 6, label/value shape, vmCount=100
5. **buildMgmtOverheadData (PPTX-06):** 4 tests — exactly 6 rows, label/cores/ramGB shape, totalCores match, totalRamGB match
6. **buildComputeResultsData (PPTX-07):** 3 tests — recommendedHostCount, coreUtilizationPct, ramUtilizationPct all numbers
7. **buildStorageResultsData (PPTX-08):** 5 tests — safeUsableCapacityTB, rawCapacityTB, lfsOverheadTB, metadataOverheadTB, usableAfterRaidTB all numbers
8. **buildRecommendationsData (PPTX-09):** 2 tests — non-empty array, all items are strings
9. **generatePptxReport (PPTX-01):** 1 test — is a function

## RED State Confirmation

```
FAIL  src/composables/usePptxExport.test.ts
Error: Cannot find module './usePptxExport' imported from .../usePptxExport.test.ts
Test Files  1 failed (1)
Tests  no tests
Exit code: 1
```

This is the expected Wave 0 outcome. The test file will turn GREEN in Plan 02 (Wave 1: implementation).

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. This plan only creates a test file — no implementation, no stubs.

## Self-Check: PASSED

- [x] `src/composables/usePptxExport.test.ts` exists (256 lines)
- [x] Commit d9186b2 exists
- [x] Test exits non-zero (RED state confirmed)
- [x] File contains 24 `it(` test cases (> 15 minimum)
- [x] All 7 builder function names appear in imports
- [x] File contains `PPTX_MASTER_COLOR`, `createPinia`, `from './usePptxExport'`
