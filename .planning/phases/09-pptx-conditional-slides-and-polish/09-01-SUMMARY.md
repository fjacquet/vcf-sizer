---
phase: 09-pptx-conditional-slides-and-polish
plan: "01"
subsystem: pptx-export
tags: [tdd, wave-0, pptx, testing]
dependency_graph:
  requires: [08-03-SUMMARY.md]
  provides: [failing-tests-for-pptx-conditional-helpers]
  affects: [src/composables/usePptxExport.test.ts]
tech_stack:
  added: []
  patterns: [tdd-red-gate, pinia-test-isolation]
key_files:
  created: []
  modified:
    - src/composables/usePptxExport.test.ts
decisions:
  - "Wave 0 TDD RED gate: import 5 not-yet-exported helpers from usePptxExport to ensure TypeErrors at test time"
  - "Existing Phase 8 tests (24 tests across 9 describe blocks) remain untouched and continue to pass"
  - "buildValidationWarningsSlideData test uses hostCount=1 to reliably trigger validation errors"
metrics:
  duration: 3min
  completed: "2026-03-30"
  tasks: 1
  files: 1
---

# Phase 09 Plan 01: TDD Wave 0 — Failing Tests for Conditional PPTX Slide Helpers Summary

**One-liner:** Extended usePptxExport.test.ts with 5 failing describe blocks (PPTX-10..14) importing non-existent conditional slide helper functions — TDD RED gate established.

## What Was Built

Five new `describe` blocks appended to `src/composables/usePptxExport.test.ts` covering:

| Req ID | Describe Block | Tests | Guard Condition |
|--------|----------------|-------|-----------------|
| PPTX-10 | `buildAiGpuSlideData -- PPTX-10` | 3 | `store.gpuVmCount > 0` |
| PPTX-11 | `buildNvmeTieringSlideData -- PPTX-11` | 3 | `store.nvmeTieringEnabled === true` |
| PPTX-12 | `buildStretchTopologySlideData -- PPTX-12` | 4 | `store.deploymentMode === 'stretch'` |
| PPTX-13 | `buildVsanMaxSlideData -- PPTX-13` | 3 | `store.storageType === 'vsan-max'` |
| PPTX-14 | `buildValidationWarningsSlideData -- PPTX-14` | 3 | `calc.validationErrors.length > 0` |

The import statement on line 10 was extended with the 5 new named imports. All 5 functions do not yet exist in `usePptxExport.ts`, causing `TypeError: ... is not a function` on every new test — the expected TDD RED state.

## Test Results (Expected RED State)

- **Existing Phase 8 tests:** 24 PASS (9 describe blocks, lines 1-261 unchanged)
- **New Phase 9 tests:** 16 FAIL with `TypeError: (0, buildXxx) is not a function`
- **Total:** 24 pass / 16 fail — correct TDD Wave 0 outcome

## Decisions Made

- Import 5 non-exported functions at module level — causes TypeError rather than compile error, which is the correct RED signal in Vitest's ESM environment
- Each describe block uses `beforeEach(() => { setActivePinia(createPinia()) })` for Pinia test isolation (mirrors Phase 8 pattern)
- `buildStretchTopologySlideData` tests set `store.deploymentMode = 'stretch'` then pass `calc.stretch` directly (avoiding null-coalescion issue documented in RESEARCH.md Pitfall 4)
- `buildVsanMaxSlideData` tests use non-null assertion (`calc.vsanMax!`) guarded by `expect(calc.vsanMax).not.toBeNull()` — test will fail at the guard if vsanMax is null before reaching the helper call
- `buildValidationWarningsSlideData` test 3 handles the case where default store state may already have warnings (defensively asserts shape only in that case)

## Deviations from Plan

None — plan executed exactly as written. The import approach and describe block structure match the plan's `<action>` specification and the research patterns verbatim.

## Known Stubs

None — this plan only adds test code. No production stubs introduced.

## Self-Check: PASSED

- [x] `src/composables/usePptxExport.test.ts` modified (file exists, 476 lines)
- [x] `grep -c "describe.*buildAiGpuSlideData"` returns 1
- [x] `grep -c "describe.*buildNvmeTieringSlideData"` returns 1
- [x] `grep -c "describe.*buildStretchTopologySlideData"` returns 1
- [x] `grep -c "describe.*buildVsanMaxSlideData"` returns 1
- [x] `grep -c "describe.*buildValidationWarningsSlideData"` returns 1
- [x] Commit `a6d2b17` exists: `test(09-01): add failing describe blocks for 5 conditional PPTX slide helpers`
- [x] 14 describe blocks total (9 existing + 5 new)
- [x] 24 existing tests pass, 16 new tests fail (RED state confirmed)
