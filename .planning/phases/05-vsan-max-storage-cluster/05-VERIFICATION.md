---
phase: 05-vsan-max-storage-cluster
verified: 2026-03-29T18:19:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
---

# Phase 5: vSAN Max Storage Cluster — Verification Report

**Phase Goal:** Architects sizing a disaggregated vSAN Max deployment can select a ReadyNode profile, specify separate storage and compute cluster host counts, and receive independently sized storage cluster and compute cluster outputs with minimum node validation
**Verified:** 2026-03-29T18:19:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 05-01 — Engine Layer)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `calcVsanMax()` returns correct raw and usable capacity for all 5 ReadyNode profiles | VERIFIED | vsanMax.test.ts: 13 tests pass, all 5 profile rawCapacityTB assertions confirmed (XS=80, SM=200, MED=400, LRG=600, XL=800 with 4 nodes) |
| 2 | `calcVsanMax()` uses 2+1 RAID at 4-5 nodes and 4+1 RAID at 6+ nodes | VERIFIED | vsanMax.ts line 41: `vsanEsaRaidOverhead(storageNodeCount, 1, 'raid5')` delegates to existing adaptive scheme; test confirms `raidScheme='2+1 (FTT=1 RAID-5)'` at 4 nodes and contains `'4+1'` at 6 nodes |
| 3 | `calcVsanMax()` sets `belowMinNodes=true` when `storageNodeCount < 4` | VERIFIED | vsanMax.ts line 32; test confirms `belowMinNodes=true` at 3 nodes, `false` at 4 nodes (boundary) |
| 4 | `calcStorage()` compiles with `'vsan-max'` in `StorageType` union via exhaustive switch | VERIFIED | types.ts line 5: `StorageType = 'vsan-esa' | 'fc' | 'nfs' | 'vsan-max'`; storage.ts lines 116-126: `case 'vsan-max'` present; storage.ts lines 192-193: `const _exhaustive: never = storageType` exhaustive guard; `tsc --noEmit` passes |
| 5 | `validateInputs` fires `VSAN_MAX_MIN_NODES` error when `storageType='vsan-max'` and `vsanMaxStorageNodes < 4` | VERIFIED | validation.ts lines 129-137: rule present with `storageType === 'vsan-max' && vsanMaxStorageNodes < VSAN_MAX_MIN_STORAGE_NODES`; 23 validation tests pass |
| 6 | `validateInputs` fires `DEDUP_NETWORK_SPEED` warning when `dedupEnabled=true` and `networkSpeedGbE < 25` | VERIFIED | validation.ts lines 119-127: rule present with `dedupEnabled && networkSpeedGbE < DEDUP_MIN_NETWORK_SPEED_GBE`; 23 validation tests pass |
| 7 | `inputStore` exposes `vsanMaxProfile`, `vsanMaxStorageNodes`, `networkSpeedGbE` refs | VERIFIED | inputStore.ts lines 46-50: all three `ref()` declarations; line 62: all three exported |
| 8 | `calculationStore` exposes `vsanMax` as `computed()` (not `ref`) | VERIFIED | calculationStore.ts line 85: `const vsanMax = computed(...)` returning `VsanMaxResult | null`; line 113: exported; no `ref()` used (CALC-02 satisfied) |
| 9 | URL state round-trip preserves `vsanMaxProfile`, `vsanMaxStorageNodes`, `networkSpeedGbE` | VERIFIED | useUrlState.ts lines 33-35: Zod schema entries with defaults; lines 94-96: read (store←state); lines 124-126: write (state←store); 20 URL state tests pass |

### Observable Truths (Plan 05-02 — UI Layer)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | User can click 'vSAN Max' in the storage type button group and see a profile dropdown + storage nodes slider | VERIFIED | StorageConfigForm.vue line 32: `{ value: 'vsan-max' as const, labelKey: 'storage.vsanMax' }` in storageTypes; line 131: `<template v-if="storageType === 'vsan-max'">` with select (v-model=vsanMaxProfile) and NumberSliderInput (v-model=vsanMaxStorageNodes) |
| 11 | User sees 5 profile options in the dropdown: XS through XL with TB/node labels | VERIFIED | StorageConfigForm.vue: select element inside the vsan-max template block contains all 5 hardcoded option values (xs/sm/med/lrg/xl) with TB/node labels; READYNODE_PROFILES constant used in VsanMaxClusterCard |
| 12 | User sees a VsanMaxClusterCard in the results panel showing profile, node count, raw and usable capacity | VERIFIED | VsanMaxClusterCard.vue exists (74 lines); displays `vsanMax.storageNodeCount`, `vsanMax.rawCapacityTB`, `vsanMax.usableCapacityTB`, `vsanMax.raidScheme`; ResultsPanel.vue imports and renders it |
| 13 | User sees red warning in VsanMaxClusterCard and StorageConfigForm when storage nodes < 4 | VERIFIED | VsanMaxClusterCard.vue line 38: `:class="vsanMax.belowMinNodes ? 'text-red-600' : 'text-emerald-600'"` + WarningBanner v-if; StorageConfigForm.vue line 160: `v-if="vsanMaxMinNodesError"` WarningBanner |
| 14 | User can select network speed (10/25/100 GbE) in HostSpecsForm | VERIFIED | HostSpecsForm.vue lines 83-91: `v-for="speed in [10, 25, 100]"` button loop with `@click="networkSpeedGbE = speed"` and active state tied to `networkSpeedGbE === speed` |
| 15 | User sees DEDUP_NETWORK_SPEED warning in StorageConfigForm dedup section when dedup is enabled at 10 GbE | VERIFIED | StorageConfigForm.vue line 115: `v-if="dedupNetworkSpeedError"` WarningBanner in dedup section; computed `dedupNetworkSpeedError` reads from `validationErrors` (line 24) |
| 16 | User sees a compute cluster informational note in HostSpecsForm when vSAN Max is selected | VERIFIED | HostSpecsForm.vue line 105: `v-if="storageType === 'vsan-max'"` div; line 108: `{{ t('host.vsanMaxComputeNote') }}` |
| 17 | All UI text appears in all 4 locales (en, fr, de, it) | VERIFIED | All 12 Phase 5 keys present in all 4 locale files (verified programmatically via JSON parse) |
| 18 | Stretch bandwidth capped by network line rate | VERIFIED | DeploymentModelSelector.vue: `effectiveBandwidthGbps` computed (Math.min), `bandwidthCappedByLineRate` computed, cap indicator rendered with `bandwidthLineRateCap` i18n key |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/engine/vsanMax.ts` | `calcVsanMax()` function and `READYNODE_PROFILES` constant | VERIFIED | 70 lines; exports both; pure TypeScript, no Vue imports |
| `src/engine/vsanMax.test.ts` | TDD tests for calcVsanMax, min 60 lines | VERIFIED | 92 lines; 13 tests covering all 5 profiles, RAID scheme, belowMinNodes boundary |
| `src/engine/types.ts` | VsanMaxProfile, VsanMaxInputs, VsanMaxResult; StorageType includes 'vsan-max' | VERIFIED | Line 5: StorageType union; lines 6, 129-142: all three interfaces exported |
| `src/engine/storage.ts` | Exhaustive switch with `const _exhaustive: never` | VERIFIED | Lines 116, 192-193: case and never guard both present |
| `src/engine/validation.ts` | DEDUP_NETWORK_SPEED and VSAN_MAX_MIN_NODES rules | VERIFIED | Lines 119-137: both rules implemented with correct conditions |
| `src/stores/inputStore.ts` | vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE refs | VERIFIED | Lines 46-50, 62: all three refs declared and exported |
| `src/stores/calculationStore.ts` | vsanMax computed (not ref), calls calcVsanMax | VERIFIED | Lines 85-93: computed wrapping calcVsanMax; exported line 113 |
| `src/composables/useUrlState.ts` | Triple-synced vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE | VERIFIED | Lines 33-35 (schema), 94-96 (read), 124-126 (write) |
| `src/components/results/VsanMaxClusterCard.vue` | vSAN Max results card, min 40 lines | VERIFIED | 74 lines; reads from calculationStore; renders all required fields |
| `src/components/input/StorageConfigForm.vue` | Extended with vSAN Max section | VERIFIED | Contains `vsan-max` value, profile dropdown, storage nodes slider, two WarningBanners |
| `src/components/input/HostSpecsForm.vue` | Network speed button group + compute cluster note | VERIFIED | networkSpeedGbE in storeToRefs; speed button loop; compute note with v-if guard |
| `src/components/results/ResultsPanel.vue` | VsanMaxClusterCard wired after HostCountCard | VERIFIED | Import line 3; render line 14 (after HostCountCard, before CoresChart) |
| `src/i18n/locales/en.json` | All Phase 5 i18n keys in English | VERIFIED | All 13 keys present in correct sections |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/engine/vsanMax.ts` | `src/engine/storage.ts` | imports `vsanEsaRaidOverhead()` | WIRED | Line 7: `import { vsanEsaRaidOverhead, VSAN_LFS_OVERHEAD, VSAN_METADATA_PCT, VSAN_SAFE_SLACK } from './storage'`; line 41: called |
| `src/stores/calculationStore.ts` | `src/engine/vsanMax.ts` | calls `calcVsanMax()` inside `computed()` | WIRED | Line 11: import; lines 85-93: called inside computed with correct args |
| `src/composables/useUrlState.ts` | `src/stores/inputStore.ts` | reads/writes vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE | WIRED | Lines 94-96 (store write), lines 124-126 (store read) all via `store.vsanMaxProfile` pattern |
| `src/components/results/VsanMaxClusterCard.vue` | `src/stores/calculationStore.ts` | reads vsanMax computed | WIRED | Lines 5, 12, 14: `useCalculationStore()`, `storeToRefs(calc)`, `const { vsanMax }` |
| `src/components/input/StorageConfigForm.vue` | `src/stores/inputStore.ts` | reads/writes vsanMaxProfile, vsanMaxStorageNodes | WIRED | Line 13: in storeToRefs destructure; lines 139, 151: v-model bindings |
| `src/components/input/HostSpecsForm.vue` | `src/stores/inputStore.ts` | reads/writes networkSpeedGbE | WIRED | Line 15: in storeToRefs destructure; lines 87, 91: read and write |
| `src/components/results/ResultsPanel.vue` | `src/components/results/VsanMaxClusterCard.vue` | imports and renders component | WIRED | Line 3: import; line 14: `<VsanMaxClusterCard />` in template |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `VsanMaxClusterCard.vue` | `vsanMax` (from `storeToRefs(calc)`) | `calculationStore.vsanMax` computed → `calcVsanMax()` → pure math on `storageNodeCount * rawTbPerNode` | Yes — mathematical engine with no empty fallback (returns non-null only when storageType==='vsan-max') | FLOWING |
| `StorageConfigForm.vue` | `vsanMax` (for capacity summary), `vsanMaxMinNodesError`, `dedupNetworkSpeedError` | calculationStore.validationErrors computed → `validateInputs()` | Yes — reactive to store state changes | FLOWING |
| `HostSpecsForm.vue` | `networkSpeedGbE`, `storageType` | inputStore refs (user-driven) | Yes — two-way bound via v-model equivalent | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Test | Result | Status |
|----------|------|--------|--------|
| calcVsanMax() returns correct values for all 5 profiles | `npx vitest run src/engine/vsanMax.test.ts` | 13/13 tests pass | PASS |
| VSAN_MAX_MIN_NODES and DEDUP_NETWORK_SPEED validation rules fire | `npx vitest run src/engine/validation.test.ts` | 23/23 tests pass | PASS |
| URL state round-trip preserves 3 new fields | `npx vitest run src/composables/useUrlState.test.ts` | 20/20 tests pass | PASS |
| Full test suite | `npm run test` | 120/120 tests pass (9 test files) | PASS |
| TypeScript type check | `npx tsc --noEmit` | No errors | PASS |
| Production build | `npm run build` | Built in 281ms, no errors | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VMAX-01 | 05-01, 05-02 | User can select "vSAN Max (Storage Cluster)" as a storage type; tool presents 5 ReadyNode profiles (XS/SM/MED/LRG/XL) with capacity per node (20/50/100/150/200 TB); tool sizes storage cluster (node count, raw capacity, usable capacity) using the selected profile and node count | SATISFIED | StorageConfigForm.vue: 'vsan-max' button in storage type group; profile dropdown with 5 options; VsanMaxClusterCard.vue renders node count, raw capacity, usable capacity from calcVsanMax() |
| VMAX-02 | 05-01, 05-02 | When vSAN Max is selected, compute cluster sized independently from storage cluster; compute hosts use standard HCI engine; tool outputs two separate host counts: storage and compute | SATISFIED | storage.ts case 'vsan-max': pass-through (no vSAN overhead on compute); calculationStore: vsanMax computed tracks storageNodeCount separately from hostCount; VsanMaxClusterCard shows storageNodeCount while HostCountCard shows compute hosts; HostSpecsForm note confirms separation |
| VMAX-03 | 05-01, 05-02 | Validation rule fires when vSAN Max storage node count is below 4 | SATISFIED | validation.ts Rule 7: VSAN_MAX_MIN_NODES error when storageType==='vsan-max' && vsanMaxStorageNodes < 4; StorageConfigForm.vue and VsanMaxClusterCard.vue both display the error banner |

All 3 requirement IDs from PLAN frontmatter are accounted for. No orphaned requirements found for Phase 5.

---

### Anti-Patterns Found

No anti-patterns found in any Phase 5 modified files. No TODO/FIXME/HACK/PLACEHOLDER markers. No stub implementations. No hardcoded empty data flowing to rendered output.

---

### Human Verification Required

#### 1. Visual Layout and Profile Dropdown Rendering

**Test:** Run `npm run dev`, click "vSAN Max" button in StorageConfigForm, open the profile dropdown
**Expected:** Dropdown displays all 5 options with exact labels (e.g. "XS — 20 TB/node", "XL — 200 TB/node")
**Why human:** Option text content inside `<select>` elements cannot be verified programmatically without a browser render

#### 2. Real-time Validation Warning Interaction

**Test:** Select "vSAN Max", set storage nodes slider to minimum, confirm no red banner; then manually set to 3 (if slider allows) or trigger via URL
**Expected:** Red VSAN_MAX_MIN_NODES banner appears in both StorageConfigForm and VsanMaxClusterCard when nodes < 4
**Why human:** Reactive UI state transitions require browser rendering to confirm visual feedback

#### 3. DEDUP_NETWORK_SPEED Warning Cross-feature Interaction

**Test:** Switch to "vSAN ESA", enable Global Dedup, select 10 GbE — confirm yellow warning appears; switch to 25 GbE — confirm warning disappears
**Expected:** Warning appears and disappears reactively based on networkSpeedGbE value
**Why human:** Cross-form reactive behavior requires browser interaction to verify

#### 4. Language Switching

**Test:** Switch language to FR, DE, IT using the locale selector; inspect all Phase 5 labels (storage type button, profile dropdown label, network speed label, compute note, result card title)
**Expected:** All labels appear in the selected language with no fallback English keys
**Why human:** i18n rendering with language switching requires browser UI verification

#### 5. Share URL Round-trip

**Test:** Configure vSAN Max with XL profile + 8 storage nodes + 10 GbE, copy share URL, open in new tab
**Expected:** Exact same configuration restored (profile=xl, storageNodes=8, networkSpeed=10)
**Why human:** Browser URL state persistence and restore requires live browser interaction

---

### Gaps Summary

No gaps found. All 18 must-have truths are verified, all 13 required artifacts exist and are substantive and wired, all 7 key links are confirmed, all 3 requirement IDs (VMAX-01, VMAX-02, VMAX-03) are satisfied, the full test suite passes (120/120), TypeScript compiles without errors, and the production build succeeds.

---

_Verified: 2026-03-29T18:19:00Z_
_Verifier: Claude (gsd-verifier)_
