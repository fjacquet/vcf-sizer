---
phase: 06-markdown-extraction-and-enrichment
plan: "01"
subsystem: composables/testing
tags: [tdd, red-state, pinia, markdown-export, wave-0]
dependency_graph:
  requires: []
  provides: [failing-test-suite-for-useMarkdownExport]
  affects: [src/composables/useMarkdownExport.test.ts]
tech_stack:
  added: []
  patterns: [createPinia+setActivePinia test isolation, Pinia-backed composable testing]
key_files:
  created: []
  modified:
    - src/composables/useMarkdownExport.test.ts
decisions:
  - "Tests call generateMarkdownReport() directly through real Pinia stores — no engine function imports"
  - "11 describe blocks with setActivePinia(createPinia()) in every beforeEach for full isolation"
  - "Wave 0 gate: file intentionally fails import (useMarkdownExport.ts does not exist yet)"
metrics:
  duration: "1min"
  completed_date: "2026-03-30"
  tasks_completed: 1
  files_modified: 1
requirements:
  - MD-01
  - MD-02
  - MD-03
  - MD-04
  - MD-05
  - MD-06
  - MD-07
  - MD-08
  - MD-09
---

# Phase 06 Plan 01: Rewrite useMarkdownExport.test.ts (Wave 0 TDD Gate) Summary

**One-liner:** Pinia-backed failing test suite with 11 describe blocks covering all 9 MD requirements — RED state TDD gate before implementation.

## What Was Built

Completely rewrote `src/composables/useMarkdownExport.test.ts` from an engine-direct test using manually assembled reference strings to a proper Pinia-backed test suite. The new file:

- Imports `generateMarkdownReport` from `./useMarkdownExport` (the target composable that does not exist yet)
- Uses `createPinia()` + `setActivePinia()` in every `beforeEach` for complete test isolation
- Contains 11 describe blocks covering all 9 MD requirements (MD-01 through MD-09)
- Never imports engine functions (calcManagement, calcCompute, calcStorage)
- Exits with non-zero status (RED) because `useMarkdownExport.ts` does not exist yet

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Rewrite useMarkdownExport.test.ts with full failing test suite | 0a5c312 | src/composables/useMarkdownExport.test.ts |

## Describe Blocks

| Block | MD Requirement | Tests |
|-------|---------------|-------|
| always-present sections | MD-01 | title, 4 section headers, workload, network, footer, no-undefined |
| MD-02 Workload Profile | MD-02 | VM count row, vCPU per VM row |
| MD-03 Management Architecture | MD-03 | arch row, dedicated absent when shared, present when dedicated |
| MD-04 NVMe Tiering | MD-04 | absent when disabled, present when enabled |
| MD-05 AI/GPU | MD-05 | absent when gpuVmCount=0, present when gpuVmCount=5, GPU VM count row |
| MD-06 Stretch Cluster | MD-06 | absent when ha, present when stretch, bandwidth row, witness rows |
| MD-07 vSAN Max | MD-07 | absent when vsan-esa, present when vsan-max, ReadyNode profile row |
| MD-08 Validation Warnings | MD-08 | absent with valid inputs, present when hostCount=1 triggers warning |
| MD-09 Network Configuration | MD-09 | section present, network speed row, dedup row |
| table structure | — | at least 10 markdown table rows |
| no regression | — | Recommended Host Count, Safe usable capacity, CPU utilization format |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan only produces test code (RED state). The composable implementation (`useMarkdownExport.ts`) is the stub — it does not exist yet and is created in Plan 02.

## Self-Check: PASSED

- [x] src/composables/useMarkdownExport.test.ts exists and has 237 lines (> 120 minimum)
- [x] Commit 0a5c312 exists in git log
- [x] Tests exit non-zero (RED state confirmed)
- [x] No engine function imports in test file
- [x] 11 `setActivePinia(createPinia())` calls (one per describe block)
