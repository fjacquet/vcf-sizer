---
phase: 02-outputs-charts-and-export
verified: 2026-03-28T07:33:00Z
status: gaps_found
score: 4/5 must-haves verified
re_verification: false
gaps:
  - truth: "User sees a storage chart showing raw capacity vs. usable capacity with a breakdown of each overhead layer"
    status: partial
    reason: "StorageChart.vue stacks safeUsableCapacityTB + lfsOverheadTB + metadataOverheadTB but omits the RAID overhead layer (rawCapacityTB - usableAfterRaidTB). The stacked bar total does not reach rawCapacityTB, so the chart does not visually represent raw vs. usable. The RAID overhead layer is not exposed as a named field in StorageResult, so the chart cannot render it without a computed derivation."
    artifacts:
      - path: "src/components/results/charts/StorageChart.vue"
        issue: "Missing RAID overhead dataset. Three datasets shown: safeUsableCapacityTB, lfsOverheadTB, metadataOverheadTB. Missing: (storage.rawCapacityTB - storage.usableAfterRaidTB) as a fourth RAID overhead band. Also missing: the 30% slack reserve as a fifth band. Net effect: chart height != rawCapacityTB, making 'raw vs usable' invisible."
    missing:
      - "Add a fourth dataset to StorageChart.vue: label='RAID Overhead', data=[storage.rawCapacityTB - storage.usableAfterRaidTB], color=orange/red"
      - "Optionally add a fifth dataset: label='Slack Reserve', data=[netUsableTB * 0.30] to make the bar reach rawCapacityTB"
      - "Verify that sum of all datasets equals storage.rawCapacityTB for visual accuracy"
human_verification:
  - test: "Confirm storage chart renders correctly in browser at various host/storage configurations"
    expected: "Stacked bar reaches raw capacity height; each overhead band is visually distinct and labeled"
    why_human: "Chart rendering and visual proportions cannot be verified without a browser"
  - test: "Share URL round-trip in a real browser"
    expected: "Copy URL from Share button, open in new tab, all inputs restore identically"
    why_human: "navigator.clipboard and window.location.search require a real browser environment"
  - test: "Print to PDF: click Print button and verify layout"
    expected: "Input panel and header hidden; results panel fills full width; no overflow/clipping"
    why_human: "Browser print CSS (@media print) cannot be exercised in a Node test"
---

# Phase 2: Outputs, Charts and Export — Verification Report

**Phase Goal:** Architects can read a complete sizing recommendation from a visual results panel, share the configuration via URL, and export a formatted report
**Verified:** 2026-03-28T07:33:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Split-screen layout (input left, results right), responsive on mobile | VERIFIED | `App.vue` line 21: `grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-56px)]`; left pane `print:hidden`; right pane `print:col-span-2` |
| 2 | Cores and RAM charts update in real time as inputs change | VERIFIED | `CoresChart.vue` and `RamChart.vue` use `computed()` returning new `ChartData<'bar'>` object bound to `:data` prop — vue-chartjs 5 built-in watcher calls `chart.update()` on new references |
| 3 | Storage chart shows raw vs. usable with per-layer overhead breakdown | PARTIAL | Chart shows `safeUsableCapacityTB + lfsOverheadTB + metadataOverheadTB` stacked but RAID overhead (`rawCapacityTB - usableAfterRaidTB`) is absent; stacked bar total != `rawCapacityTB` |
| 4 | Shareable URL restores all input state in a new tab | VERIFIED | `useUrlState.ts`: lz-string compress → `?c=` param; `hydrateFromUrl()` called in `main.ts` after pinia, before `app.mount()`; Zod schema validates all 17 input fields; 56/56 tests pass including round-trip tests |
| 5 | Markdown export works; PDF via browser print with no additional dependency | VERIFIED | `ExportToolbar.vue`: Blob + URL.createObjectURL download for `.md`; `window.print()` for PDF; `@custom-variant print` in `style.css` hides input panel; no html2canvas/jsPDF dependency |

**Score:** 4/5 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/results/ResultsPanel.vue` | Orchestrates results UI | VERIFIED | 17 lines, imports and renders HostCountCard, CoresChart, RamChart, StorageChart, ExportToolbar |
| `src/components/results/HostCountCard.vue` | Displays recommendedHostCount with color | VERIFIED | `text-5xl font-bold`, `text-emerald-600`/`text-red-600` conditional, reads from `storeToRefs(calc)` |
| `src/components/results/charts/CoresChart.vue` | Real-time cores bar chart | VERIFIED | `computed()` ChartData bound to `Bar :data`, reads `compute.totalCoresRequired` + `compute.availableCores` |
| `src/components/results/charts/RamChart.vue` | Real-time RAM bar chart | VERIFIED | Same pattern as CoresChart, reads `compute.totalRamRequiredGB` + `compute.availableRamGB` |
| `src/components/results/charts/StorageChart.vue` | Storage overhead breakdown chart | PARTIAL | Stacked bar with 3 datasets; missing RAID overhead dataset; stacked total != rawCapacityTB |
| `src/composables/useUrlState.ts` | URL state composable | VERIFIED | Exports `hydrateFromUrl`, `generateShareUrl`, `generateMarkdownReport`; lz-string + Zod; 185 lines |
| `src/components/results/ExportToolbar.vue` | Share/export buttons | VERIFIED | Share URL (Copied! feedback), Markdown Blob download, `window.print()` PDF; `print:hidden` class |
| `src/main.ts` | App entry with URL hydration | VERIFIED | `hydrateFromUrl()` called after `app.use(pinia)`, before `app.mount('#app')` |
| `src/style.css` | Tailwind v4 print variant | VERIFIED | Line 3: `@custom-variant print (@media print);` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CoresChart.vue` | `calculationStore.compute` | `storeToRefs(calc).compute` + `computed()` | WIRED | Reads `totalCoresRequired`, `availableCores` |
| `RamChart.vue` | `calculationStore.compute` | `storeToRefs(calc).compute` + `computed()` | WIRED | Reads `totalRamRequiredGB`, `availableRamGB` |
| `StorageChart.vue` | `calculationStore.storage` | `storeToRefs(calc).storage` + `computed()` | WIRED | Reads `safeUsableCapacityTB`, `lfsOverheadTB`, `metadataOverheadTB`; does NOT read `rawCapacityTB` or `usableAfterRaidTB` |
| `HostCountCard.vue` | `calculationStore.compute` | `storeToRefs(calc).compute` + `computed()` | WIRED | Reads `recommendedHostCount`, `minHostsForCpu`, `minHostsForRam` |
| `ExportToolbar.vue` | `useUrlState.ts` | direct import of `generateShareUrl`, `generateMarkdownReport` | WIRED | Named imports confirmed in file |
| `main.ts` | `useUrlState.ts` | `import { hydrateFromUrl }` | WIRED | Called on line 12, before `app.mount()` |
| `hydrateFromUrl` | `inputStore` | `useInputStore()` + field-by-field assignment | WIRED | All 17 fields assigned individually |
| `generateMarkdownReport` | `calculationStore` | `useCalculationStore()` | WIRED | Reads `calc.compute`, `calc.storage`, `calc.management` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CoresChart.vue` | `compute.totalCoresRequired`, `compute.availableCores` | `calculationStore.compute` ← `calcCompute()` ← `inputStore` | Yes — pure engine function, Decimal.js arithmetic | FLOWING |
| `RamChart.vue` | `compute.totalRamRequiredGB`, `compute.availableRamGB` | `calculationStore.compute` ← `calcCompute()` ← `inputStore` | Yes — pure engine function | FLOWING |
| `StorageChart.vue` | `storage.safeUsableCapacityTB`, `storage.lfsOverheadTB`, `storage.metadataOverheadTB` | `calculationStore.storage` ← `calcStorage()` ← `inputStore` | Yes — real vSAN ESA formulas with Decimal.js | FLOWING (partial data only) |
| `HostCountCard.vue` | `compute.recommendedHostCount` | `calculationStore.compute` ← `calcCompute()` ← `inputStore` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run build` exits 0 | `npm run build` | `✓ built in 243ms`, 161 modules | PASS |
| All 56 tests pass | `npm run test` | `Tests 56 passed (56)`, 7 test files | PASS |
| lz-string round-trip preserves data | `node -e "const LZ=require(...)..."` | `round-trip OK: true`, URL param 85 chars | PASS |
| `hydrateFromUrl` called before `app.mount()` | Read `main.ts` | Line 12 `hydrateFromUrl()` precedes line 13 `app.mount()` | PASS |
| `@custom-variant print` present | grep `src/style.css` | Found on line 3 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VIZ-01 | 02-01 | Split-screen layout, responsive mobile | SATISFIED | `md:grid-cols-2` in App.vue, single column default |
| VIZ-02 | 02-01 | Bar/gauge chart: Cores Required vs. Available | SATISFIED | `CoresChart.vue` with grouped bar, real-time `computed()` |
| VIZ-03 | 02-01 | Bar/gauge chart: RAM Required vs. Available | SATISFIED | `RamChart.vue` with grouped bar, real-time `computed()` |
| VIZ-04 | 02-01 | Storage chart: Raw vs. Usable with overhead breakdown | PARTIAL | Chart shows 3 of 4+ overhead layers; RAID overhead missing; bar total != rawCapacityTB |
| VIZ-05 | 02-01 | Host count summary card prominently displayed | SATISFIED | `HostCountCard.vue`: `text-5xl font-bold`, green/red conditional |
| VIZ-06 | 02-01 | Charts update in real-time (no submit button) | SATISFIED | All charts use `computed()` + reactive `:data` binding |
| VIZ-07 | 02-01 | Chart.js + vue-chartjs with `computed()` returning new refs | SATISFIED | Confirmed pattern in all three chart components; no `shallowRef` used |
| EXPORT-01 | 02-02 | Shareable URL with lz-string + Base64URL | SATISFIED | `generateShareUrl()` uses `LZString.compressToEncodedURIComponent` |
| EXPORT-02 | 02-02 | Loading shared URL restores all input state | SATISFIED | `hydrateFromUrl()` wired in `main.ts` before mount; Zod validates |
| EXPORT-03 | 02-02 | Export to Markdown with all computed values | SATISFIED | `generateMarkdownReport()` produces 5-section MD with tables; 13 markdown tests pass |
| EXPORT-04 | 02-02 | PDF via browser print, no additional dependency | SATISFIED | `window.print()` + `@custom-variant print` CSS; left pane `print:hidden`, right pane `print:col-span-2` |

**Requirements summary:** 10/11 satisfied, 1 partial (VIZ-04)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/results/charts/StorageChart.vue` | 28-42 | Missing RAID overhead dataset in stacked bar; stacked total does not equal `rawCapacityTB` | Warning | SC-3 partial: "raw vs. usable" not visually accurate — RAID cost is invisible to user |

No `TODO`, `FIXME`, placeholder text, empty return values, or hardcoded empty data found in Phase 2 files.

### Human Verification Required

#### 1. Storage Chart Visual Accuracy

**Test:** Open the app in a browser, set storage type to vSAN ESA, enter 6 hosts at 3.84 TB each (FTT=1 RAID-5), observe the storage chart.
**Expected:** Chart shows a full "raw capacity = 23.04 TB" bar height broken into colored bands for RAID overhead, LFS overhead, metadata overhead, and usable space
**Why human:** Chart rendering requires a browser canvas; stacked proportions cannot be verified in Node

#### 2. Share URL Round-Trip

**Test:** Enter a specific configuration (e.g., 8 hosts, HA deployment, 200 VMs), click "Share URL", copy the URL, open in a new incognito tab, verify all inputs match
**Expected:** All 17 input fields restore exactly; charts show same values
**Why human:** `navigator.clipboard` and `window.location.search` require real browser context

#### 3. PDF Print Layout

**Test:** Click "Print / PDF" button in a browser, preview the print layout
**Expected:** Input panel (left) is hidden; results panel fills full width; header/toolbar hidden; charts and HostCountCard visible
**Why human:** `@media print` CSS requires browser print preview

#### 4. Copied! Feedback on Share Button

**Test:** Click the "Share URL" button
**Expected:** Button label changes to "Copied!" for ~1.5 seconds then reverts to "Share URL"
**Why human:** `setTimeout` UI feedback requires browser rendering

### Gaps Summary

**One gap blocks full goal achievement:** The storage chart (VIZ-04, success criterion 3) is wired to real data but displays an incomplete overhead breakdown. The chart renders `safeUsableCapacityTB + lfsOverheadTB + metadataOverheadTB` as a stacked bar, but the RAID overhead — the single largest cost in vSAN ESA (25-50% of raw capacity) — is absent. The stacked bar total falls short of `rawCapacityTB`, making the "raw vs. usable" comparison impossible to read visually.

The fix is surgical: add a fourth dataset to `StorageChart.vue` computing `storage.rawCapacityTB - storage.usableAfterRaidTB` (both fields are already in `StorageResult`). An optional fifth dataset for the 30% slack reserve would complete the picture.

All other success criteria are fully implemented and verified: split-screen layout, real-time charts (cores, RAM), complete URL sharing with Zod validation, Markdown export, and PDF print CSS.

---

_Verified: 2026-03-28T07:33:00Z_
_Verifier: Claude (gsd-verifier)_
