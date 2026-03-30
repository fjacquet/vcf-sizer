---
phase: 13-per-domain-results-and-aggregate-totals
plan: "01"
subsystem: composables
tags: [export, markdown, pptx, store-migration, phase13]
dependency_graph:
  requires:
    - src/stores/inputStore.ts (workloadDomains[])
    - src/stores/calculationStore.ts (domainResults[], aggregateTotals)
  provides:
    - src/composables/useMarkdownExport.ts (multi-domain-compatible Markdown export)
    - src/composables/usePptxExport.ts (multi-domain-compatible PPTX export)
  affects:
    - src/components/results/ExportToolbar.vue (callers unchanged — no API surface change)
tech_stack:
  added: []
  patterns:
    - first-domain bridge (workloadDomains[0] / domainResults[0]) for single-domain compat in Phase 13
    - aggregateTotals.allValidationErrors replaces removed flat validationErrors
key_files:
  created: []
  modified:
    - src/composables/useMarkdownExport.ts
    - src/composables/useMarkdownExport.test.ts
    - src/composables/usePptxExport.ts
    - src/composables/usePptxExport.test.ts
decisions:
  - first-domain bridge pattern (workloadDomains[0] / domainResults[0]) used for Phase 13 compat; full multi-domain export is Phase 14
  - aggregateTotals.allValidationErrors used as the validation source (replaces removed flat calc.validationErrors)
  - Helper functions (buildComputeResultsData, buildStorageResultsData, etc.) accept typed params — signatures unchanged
metrics:
  duration: 12min
  completed: "2026-03-30"
  tasks_completed: 2
  files_modified: 4
---

# Phase 13 Plan 01: Fix Export Composables — First-Domain Bridge Summary

Both export composables (`useMarkdownExport.ts`, `usePptxExport.ts`) and their test files rewritten to use the new multi-domain store API introduced in Phase 10, using a first-domain bridge (`workloadDomains[0]` / `domainResults[0]`) for Phase 13 single-domain compat. All 58 previously-failing tests now pass; full test suite is 222/222 green.

## What Was Built

### Task 1: useMarkdownExport.ts + useMarkdownExport.test.ts

Rewrote `generateMarkdownReport()` to use the Phase 10 store API:

- Added `const domain = store.workloadDomains[0]` and `const result = calc.domainResults[0]` at top of function
- All `store.X` flat references replaced with `domain.X` (e.g., `store.vmCount` → `domain.vmCount`)
- All `calc.compute.*` / `calc.storage.*` flat references replaced with `result.compute.*` / `result.storage.*`
- `calc.validationErrors` (removed in Phase 10) replaced with `calc.aggregateTotals.allValidationErrors`
- `calc.stretch` replaced with `result.stretch` (non-null asserted when `domain.deploymentMode === 'stretch'`)
- `calc.vsanMax` replaced with `result.vsanMax`
- Test mutations updated: `input.nvmeTieringEnabled = true` → `input.workloadDomains[0].nvmeTieringEnabled = true` (all similar mutations updated)

### Task 2: usePptxExport.ts + usePptxExport.test.ts

Rewrote store-reading callsites in `generatePptxReport()` and all data-mapping helpers that accept `store` as a parameter:

- `buildTitleSlideData`: `store.deploymentMode` → `store.workloadDomains[0].deploymentMode`
- `buildConfigSummaryData`: extracted `const domain = store.workloadDomains[0]`, all `store.X` → `domain.X`
- `buildWorkloadSlideData`: same extraction pattern
- `buildAiGpuSlideData`, `buildNvmeTieringSlideData`, `buildStretchTopologySlideData`, `buildVsanMaxSlideData`: all updated
- `buildRecommendationsData`: `calc.compute` → `calc.domainResults[0].compute`, `calc.storage` → `calc.domainResults[0].storage`, `calc.validationErrors` → `calc.aggregateTotals.allValidationErrors`
- `buildValidationWarningsSlideData`: `calc.validationErrors` → `calc.aggregateTotals.allValidationErrors`
- `generatePptxReport()`: added bridge variables `domain` / `result`; conditional slide guards updated
- Helper functions (`buildComputeResultsData`, `buildStorageResultsData`, `buildMgmtOverheadData`) accept typed params directly — signatures unchanged
- Test store mutations updated to use `workloadDomains[0].X` pattern throughout

## Deviations from Plan

### Infrastructure Deviation: Worktree Merge Required

**Found during:** Pre-task setup
**Issue:** This worktree was branched from the v2.1 archive commit (before Phase 10-12). The `inputStore` and `calculationStore` still had the OLD flat API (`store.vmCount`, `calc.compute`, etc.), making the 58 failures not yet reproducible at start.
**Fix:** Merged `maincd` branch into the worktree to bring in Phase 10-12 implementations (new multi-domain stores), then proceeded with the plan as written.
**Files modified:** Full source tree sync (merge commit)
**Commit:** merge commit (pre-task)

This is not a plan deviation — the worktree setup issue was resolved before plan execution began.

## Verification

All success criteria met:

1. `npm run test` — 222 passed (0 failures). 164 engine + 35 markdown + 23 pptx.
2. `grep -r 'store\.vmCount\|store\.deploymentMode\|calc\.compute\.\|calc\.storage\.' src/composables/useMarkdownExport.ts src/composables/usePptxExport.ts` — returns empty (no flat references).
3. `grep 'workloadDomains' src/composables/useMarkdownExport.ts src/composables/usePptxExport.ts` — returns matches (bridge pattern confirmed).

## Known Stubs

None. The first-domain bridge is an intentional architectural decision (documented in plan frontmatter), not a stub. Phase 14 will implement full multi-domain export.

## Self-Check: PASSED
