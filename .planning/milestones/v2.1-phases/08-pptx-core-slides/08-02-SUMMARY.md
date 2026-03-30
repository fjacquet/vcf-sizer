---
phase: 08-pptx-core-slides
plan: "02"
subsystem: composables/pptx-export
tags: [pptx, composable, tdd-green, wave-1]
dependency_graph:
  requires: [08-01]
  provides: [src/composables/usePptxExport.ts, pptxgenjs-dependency]
  affects: [package.json, package-lock.json]
tech_stack:
  added: [pptxgenjs@4.0.1]
  patterns: [dynamic-import-code-splitting, pure-data-mapping-helpers, TableCell-namespace-types]
key_files:
  created:
    - src/composables/usePptxExport.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "[08-02]: pptxgenjs TableCell/TableRow types accessed via namespace (PptxGenJS.TableCell) — not named exports — due to export-as-namespace declaration in index.d.ts"
  - "[08-02]: Internal hdrCell() and cell() helpers wrap plain strings into typed TableCell objects to satisfy TS type checker without casting"
  - "[08-02]: type import PptxGenJS from 'pptxgenjs' used for namespace type access only — runtime dynamic import still inside function body (PPTX-15 compliant)"
metrics:
  duration: "11min"
  completed: "2026-03-30"
  tasks: 2
  files: 3
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
  - PPTX-15
---

# Phase 08 Plan 02: pptxgenjs Install + usePptxExport.ts Implementation Summary

**One-liner:** pptxgenjs 4.0.1 installed and usePptxExport.ts composable implemented with 7 data-mapping helpers + generatePptxReport, turning all 24 Wave 0 tests GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install pptxgenjs dependency | fc7e7a7 | package.json, package-lock.json |
| 2 | Implement usePptxExport.ts with all 7 slides and data-mapping helpers | c7d49d1 | src/composables/usePptxExport.ts |

## What Was Built

### Task 1: pptxgenjs Installation
- Installed `pptxgenjs@^4.0.1` as a production dependency in `package.json`
- Verified `npm run build` succeeds (pptxgenjs has zero runtime dependencies; Vite integration via package.json `exports` field is automatic)

### Task 2: usePptxExport.ts Composable

`src/composables/usePptxExport.ts` — 430 lines implementing:

**Exported constants (no `#` prefix per Pitfall 1):**
- `PPTX_MASTER_COLOR = '003087'` (Broadcom blue)
- `PPTX_FOOTER_COLOR = '001F5B'`, `PPTX_WHITE`, `PPTX_LIGHT_TEXT`, `PPTX_HEADER_BG`, `MASTER_NAME`

**7 pure data-mapping helpers:**
1. `buildTitleSlideData(store)` — returns `{ deploymentMode, date }` (PPTX-03)
2. `buildConfigSummaryData(store)` — returns 8 label/value rows for host/config fields (PPTX-04)
3. `buildWorkloadSlideData(store)` — returns 6 label/value rows for workload profile (PPTX-05)
4. `buildMgmtOverheadData(mgmt)` — returns 6 label/cores/ramGB rows (PPTX-06)
5. `buildComputeResultsData(compute)` — returns 7 compute metric fields (PPTX-07)
6. `buildStorageResultsData(storage)` — returns 6 storage metric fields (PPTX-08)
7. `buildRecommendationsData(store, calc)` — returns string[] recommendations (PPTX-09)

**Main function:**
- `generatePptxReport()` — creates 7 slides with `VCF_MASTER` slide master, triggers browser download
- Dynamic import: `(await import('pptxgenjs')).default` inside function body (PPTX-15)
- `defineSlideMaster()` called before any `addSlide()` (Pitfall 2)
- Fresh `new PptxGenJS()` instance per call (Pitfall 6)
- `await pres.writeFile({ fileName: 'vcf-sizing-report.pptx' })` (Pitfall 5)

## Test Results

```
Test Files  10 passed (10)
     Tests  166 passed (166)
```
All 24 Wave 0 usePptxExport tests: GREEN. No regressions in existing suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type errors for pptxgenjs TableCell/TableRow**
- **Found during:** Task 2 — build verification after writing composable
- **Issue:** `TableCell` and `TableRow` are not named exports from `pptxgenjs` — the module uses `export as namespace PptxGenJS` pattern. `fill` in `TableCellProps` must be `ShapeFillProps` object, not a plain string. Plain `string` cannot be used as `TableCell` directly.
- **Fix:** Changed import to `import type PptxGenJS from 'pptxgenjs'` for namespace access. Added type aliases `type TableCell = PptxGenJS.TableCell` and `type TableRow = PptxGenJS.TableRow`. Added internal `hdrCell()` and `cell()` helpers that create properly typed `TableCell` objects. Changed `fill: 'E8E8E8'` to `fill: { color: 'E8E8E8' }` (ShapeFillProps).
- **Files modified:** `src/composables/usePptxExport.ts`
- **Commit:** c7d49d1 (included in Task 2 commit)

## Known Stubs

None. All data-mapping helpers read live store state and return real computed values. `generatePptxReport()` is fully wired to call stores and produce a real .pptx download.

## Self-Check: PASSED
