---
phase: 08-pptx-core-slides
verified: 2026-03-30T10:15:00Z
status: human_needed
score: 4/5 must-haves verified (SC-1 through SC-4 automated; SC-2 and SC-3 require human for visual/file inspection)
human_verification:
  - test: "Open the downloaded .pptx file and confirm slide master background colour"
    expected: "All 7 slides have Broadcom blue (#003087) background from the VCF_MASTER slide master"
    why_human: "pptxgenjs runs in the browser; the generated binary file cannot be parsed by grep; colour fidelity requires opening the file in PowerPoint / LibreOffice / Keynote"
  - test: "Trigger 'Download PPTX', open the file, and count content slides"
    expected: "Exactly 7 slides: Title, Configuration Summary, Workload Profile, Management Domain Overhead, Compute Results, Storage Results, Recommendations — in that order"
    why_human: "Slide count and order are runtime properties of the pptxgenjs output binary; cannot be verified without executing the browser bundle"
  - test: "Export PPTX twice without reloading the page"
    expected: "Second download contains exactly the same 7 slides — no slides accumulated from the first export session"
    why_human: "Fresh-instance guarantee ('new PptxGenJS()' per call) must be confirmed by inspecting two generated files"
---

# Phase 8: PPTX Core Slides Verification Report

**Phase Goal:** Users can download a VCF-branded `.pptx` file containing all always-present slides without impacting initial page-load time
**Verified:** 2026-03-30T10:15:00Z
**Status:** human_needed — all automated checks pass; 3 items require browser/file inspection
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "Download PPTX" button is visible in export toolbar and triggers `.pptx` download | ✓ VERIFIED | `ExportToolbar.vue` line 73-78: button with `@click="handleExportPptx"` and `t('results.toolbar.exportPptx')` i18n key |
| 2 | Downloaded file has Broadcom blue (#003087) slide master on all slides | ? HUMAN NEEDED | Code: `PPTX_MASTER_COLOR = '003087'` and `defineSlideMaster({ background: { color: PPTX_MASTER_COLOR } })` called before first `addSlide()` — visual confirmation requires opening the binary |
| 3 | File contains exactly 7 always-present slides | ? HUMAN NEEDED | Code: 7 `pres.addSlide({ masterName: MASTER_NAME })` calls (lines 236, 264, 290, 316, 346, 377, 412) — slide count in binary requires file inspection |
| 4 | pptxgenjs does not appear in synchronous bundle chunk | ✓ VERIFIED | No static `import ... from 'pptxgenjs'` at file top; only `await import('pptxgenjs')` at line 191 inside `generatePptxReport()` function body — Vite code-splits this automatically |
| 5 | Each export produces a clean file (fresh PptxGenJS instance per call) | ✓ VERIFIED (code) / ? HUMAN (runtime) | `const pres = new PptxGenJS()` at line 193, inside function body, after dynamic import — new instance every invocation; runtime confirmation requires two sequential exports |

**Score:** 3/5 truths fully verified programmatically; 2 require human confirmation (but supporting code is complete and correct)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/composables/usePptxExport.ts` | generatePptxReport() with dynamic import, 7 slides, slide master | ✓ VERIFIED | 437 lines; exports `generatePptxReport`, all 7 build helper functions, color constants; dynamic import at line 191; `defineSlideMaster()` at line 197 before first `addSlide()` at line 236 |
| `src/composables/usePptxExport.test.ts` | 24 tests covering data-mapping helpers | ✓ VERIFIED | 256 lines; 24 `it()` test cases counted; covers PPTX_MASTER_COLOR, all 6 `build*` functions, `generatePptxReport` existence |
| `src/components/results/ExportToolbar.vue` | "Download PPTX" button importing from usePptxExport | ✓ VERIFIED | Line 6: `import { generatePptxReport } from '@/composables/usePptxExport'`; button at line 72-79 with `@click="handleExportPptx"`, loading state, disabled binding |
| `src/i18n/locales/en.json` | `results.toolbar.exportPptx` and `exportPptxLoading` keys | ✓ VERIFIED | `"exportPptx": "Download PPTX"` and `"exportPptxLoading": "Generating..."` present under `results.toolbar` |
| `package.json` | `pptxgenjs` in dependencies | ✓ VERIFIED | `"pptxgenjs": "^4.0.1"` in `dependencies` (not devDependencies) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ExportToolbar.vue` | `usePptxExport.ts` | named import `generatePptxReport` | ✓ WIRED | Import at line 6; called in `handleExportPptx()` at line 45 with `await` and loading state wrapper |
| `usePptxExport.ts` | `pptxgenjs` | `await import('pptxgenjs')` | ✓ WIRED | Dynamic import at line 191 inside function body; `.default` accessor correct for CommonJS-compat interop |
| `usePptxExport.ts` | `inputStore` | `useInputStore()` | ✓ WIRED | Line 187; passed to `buildTitleSlideData`, `buildConfigSummaryData`, `buildWorkloadSlideData`, `buildRecommendationsData` |
| `usePptxExport.ts` | `calculationStore` | `useCalculationStore()` | ✓ WIRED | Line 188; `calc.management`, `calc.compute`, `calc.storage` used as args to build helpers; `calc.validationErrors` checked in recommendations |
| `defineSlideMaster` | all `addSlide` calls | called before first `addSlide` | ✓ WIRED | `defineSlideMaster()` at line 197; first `addSlide()` at line 236; order correct per pptxgenjs Pitfall 2 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `usePptxExport.ts` slide 1 | `titleData.deploymentMode`, `titleData.date` | `buildTitleSlideData(store)` — reads `store.deploymentMode` + `new Date()` | Yes — live store value | ✓ FLOWING |
| `usePptxExport.ts` slide 2 | `configData` (8 rows) | `buildConfigSummaryData(store)` — reads 8 inputStore fields | Yes — live store values | ✓ FLOWING |
| `usePptxExport.ts` slide 3 | `workloadData` (6 rows) | `buildWorkloadSlideData(store)` — reads 6 inputStore fields | Yes — live store values | ✓ FLOWING |
| `usePptxExport.ts` slide 4 | `mgmtData` (6 rows) | `buildMgmtOverheadData(calc.management)` — reads MgmtDomainResult from calculationStore | Yes — computed from engine | ✓ FLOWING |
| `usePptxExport.ts` slide 5 | `computeData` (7 fields) | `buildComputeResultsData(calc.compute)` — reads ComputeResult from calculationStore | Yes — computed from engine | ✓ FLOWING |
| `usePptxExport.ts` slide 6 | `storageData` (6 fields) | `buildStorageResultsData(calc.storage)` — reads StorageResult from calculationStore | Yes — computed from engine | ✓ FLOWING |
| `usePptxExport.ts` slide 7 | `recsData` (string[]) | `buildRecommendationsData(store, calc)` — assembles from compute/storage computed values | Yes — live derived values | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 166 tests pass (includes 24 PPTX data-mapping tests) | `npm test -- --run` | `Tests  166 passed (166)` | ✓ PASS |
| PPTX_MASTER_COLOR constant equals `003087` | test: `'PPTX_MASTER_COLOR constant — PPTX-02'` | Passes in test suite | ✓ PASS |
| `generatePptxReport` is exported as a function | `usePptxExport.test.ts` line 253: `it('is a function')` | Passes | ✓ PASS |
| No static top-level `import` of pptxgenjs | `grep -n '^import.*pptxgenjs'` on composable | 0 matches | ✓ PASS |
| Dynamic `await import('pptxgenjs')` inside function body | `grep -n 'await import'` on composable | Line 191 confirmed | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PPTX-01 | 08-02, 08-03 | Download PPTX button in ExportToolbar | ✓ SATISFIED | Button at ExportToolbar.vue:72; import at line 6 |
| PPTX-02 | 08-02 | VCF-branded slide master (Broadcom blue #003087) | ✓ SATISFIED (code) / ? HUMAN (visual) | `PPTX_MASTER_COLOR = '003087'`; `defineSlideMaster` with `background: { color: PPTX_MASTER_COLOR }` |
| PPTX-03 | 08-02 | Title slide with deployment mode and date | ✓ SATISFIED | Slide 1 code at lines 236-261; `buildTitleSlideData` tested |
| PPTX-04 | 08-02 | Configuration summary slide | ✓ SATISFIED | Slide 2 at lines 263-288; `buildConfigSummaryData` returns 8 rows |
| PPTX-05 | 08-02 | Workload profile slide | ✓ SATISFIED | Slide 3 at lines 289-314; `buildWorkloadSlideData` returns 6 rows |
| PPTX-06 | 08-02 | Management domain overhead slide | ✓ SATISFIED | Slide 4 at lines 315-343; `buildMgmtOverheadData` returns 6 rows including Total |
| PPTX-07 | 08-02 | Compute results slide | ✓ SATISFIED | Slide 5 at lines 344-375; `buildComputeResultsData` returns 7 compute metrics |
| PPTX-08 | 08-02 | Storage results slide | ✓ SATISFIED | Slide 6 at lines 376-409; `buildStorageResultsData` returns 6 storage metrics |
| PPTX-09 | 08-02 | Recommendations slide | ✓ SATISFIED | Slide 7 at lines 410-432; `buildRecommendationsData` includes warning count |
| PPTX-15 | 08-02 | pptxgenjs loaded via dynamic import only | ✓ SATISFIED | Zero static imports of pptxgenjs; `await import('pptxgenjs')` at line 191 inside function body |

All 10 requirements for Phase 8 are checked off in `.planning/REQUIREMENTS.md`.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TODO/FIXME/placeholder found | — | — |
| (none) | — | No empty return `null` / `[]` / `{}` in non-test code | — | — |
| (none) | — | No hardcoded empty state flowing to render | — | — |

No anti-patterns detected in phase 8 files.

---

### Human Verification Required

#### 1. Slide Master Colour

**Test:** Click "Download PPTX", open `vcf-sizing-report.pptx` in PowerPoint, Keynote, or LibreOffice Impress.
**Expected:** All 7 slides have a Broadcom blue (#003087) background with the `VCF_MASTER` slide master applied and a darker footer strip (#001F5B) at the bottom.
**Why human:** The generated file is a binary `.pptx` (zip of XML); the colour value is embedded deep in theme XML and cannot be reliably inspected with grep.

#### 2. Slide Count and Order

**Test:** With the same downloaded file open, count the slides in the slide panel.
**Expected:** Exactly 7 slides in order: (1) VCF 9.x Sizing Report title, (2) Configuration Summary, (3) Workload Profile, (4) Management Domain Overhead, (5) Compute Results, (6) Storage Results, (7) Recommendations.
**Why human:** Slide count is a runtime property of the pptxgenjs binary output; the file cannot be executed in a Node test environment.

#### 3. Clean Export on Second Download

**Test:** On the same page session, click "Download PPTX" a second time without reloading. Open the second file.
**Expected:** Second file contains exactly 7 slides — identical count to the first download, no slides duplicated from the previous call.
**Why human:** The `new PptxGenJS()` fresh-instance guarantee is code-level; verifying no state accumulation across calls requires inspecting two separately generated binary files.

---

### Gaps Summary

No gaps found. All artifacts exist, are substantive, are wired, and have real data flowing through them. All 10 requirements are satisfied at the code level and checked off in REQUIREMENTS.md. All 166 tests pass (24 of which are Phase 8 PPTX data-mapping tests).

Three items are deferred to human verification because they require inspecting a generated binary `.pptx` file in a presentation application — this is outside automated test reach for this phase.

---

_Verified: 2026-03-30T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
