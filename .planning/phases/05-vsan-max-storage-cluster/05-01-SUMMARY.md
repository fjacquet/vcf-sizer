---
phase: 05-vsan-max-storage-cluster
plan: 01
subsystem: engine
tags: [vsan-max, storage-engine, tdd, types, validation, stores, url-state]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [vsanMax-engine, vsan-max-types, validation-rules-6-7, url-state-vsan-max]
  affects: [calculationStore, inputStore, useUrlState]
tech_stack:
  added: [vsanMax.ts engine module]
  patterns: [exhaustive-switch-never, tdd-red-green, adaptive-raid-5, calc-01-pure-ts, calc-02-computed-only]
key_files:
  created:
    - src/engine/vsanMax.ts
    - src/engine/vsanMax.test.ts
  modified:
    - src/engine/types.ts
    - src/engine/storage.ts
    - src/engine/storage.test.ts
    - src/engine/validation.ts
    - src/engine/validation.test.ts
    - src/stores/inputStore.ts
    - src/stores/calculationStore.ts
    - src/composables/useUrlState.ts
    - src/composables/useUrlState.test.ts
decisions:
  - "READYNODE_PROFILES uses 5 profiles (xs/sm/med/lrg/xl) with rawTbPerNode values 20/50/100/150/200"
  - "calcVsanMax() reuses vsanEsaRaidOverhead() + exported storage constants — no formula duplication"
  - "calcStorage() exhaustive switch with never case ensures all future StorageType variants are handled"
  - "vsanMaxStorageNodes Zod min(4) enforces floor in URL state — matches VSAN_MAX_MIN_STORAGE_NODES constant"
metrics:
  duration: "9min"
  completed: "2026-03-29"
  tasks_completed: 2
  files_modified: 10
---

# Phase 05 Plan 01: vSAN Max Engine Layer Summary

Complete engine layer for vSAN Max disaggregated storage cluster sizing: pure TypeScript calcVsanMax() with adaptive RAID scheme, 5 ReadyNode profiles, 2 new validation rules, store wiring, and URL state persistence.

## What Was Built

### New Files

**src/engine/vsanMax.ts** — vSAN Max storage engine (CALC-01 compliant, zero Vue imports)
- `READYNODE_PROFILES` constant: 5 profiles (xs=20TB, sm=50TB, med=100TB, lrg=150TB, xl=200TB per node)
- `calcVsanMax(inputs: VsanMaxInputs): VsanMaxResult` — full overhead stack calculation
- Reuses `vsanEsaRaidOverhead()` for adaptive RAID-5 scheme (same logic as HCI ESA)
- Applies: RAID overhead → LFS 13% → metadata 10% of raw → safe slack 70%
- `belowMinNodes=true` when storageNodeCount < 4

**src/engine/vsanMax.test.ts** — 9 TDD tests covering all 5 profiles, boundary conditions, RAID scheme selection

### Modified Files

**src/engine/types.ts** — Additive type extensions:
- `StorageType` extended: `'vsan-esa' | 'fc' | 'nfs' | 'vsan-max'`
- `VsanMaxProfile = 'xs' | 'sm' | 'med' | 'lrg' | 'xl'`
- `VsanMaxInputs` interface (profile, storageNodeCount, computeNodeCount)
- `VsanMaxResult` interface (rawCapacityTB, usableCapacityTB, raidScheme, counts, belowMinNodes)
- `ValidationInputs` extended with `networkSpeedGbE?: 10 | 25 | 100` and `vsanMaxStorageNodes?: number`

**src/engine/storage.ts** — Two changes:
- Export `VSAN_LFS_OVERHEAD`, `VSAN_METADATA_PCT`, `VSAN_SAFE_SLACK` (previously private)
- Convert `calcStorage()` if/else chain to exhaustive switch with `never` case (catches future StorageType additions)
- Add `case 'vsan-max'` pass-through (compute nodes have no vSAN storage)

**src/engine/validation.ts** — Two new rules:
- Rule 6: `DEDUP_NETWORK_SPEED` warning — fires when `dedupEnabled && networkSpeedGbE < 25` (STOR-05)
- Rule 7: `VSAN_MAX_MIN_NODES` error — fires when `storageType === 'vsan-max' && vsanMaxStorageNodes < 4` (VMAX-03)

**src/stores/inputStore.ts** — Three new refs:
- `vsanMaxProfile = ref<VsanMaxProfile>('med')`
- `vsanMaxStorageNodes = ref(4)`
- `networkSpeedGbE = ref<10 | 25 | 100>(25)`
- `storageType` ref type extended to include `'vsan-max'`

**src/stores/calculationStore.ts** — Two changes:
- `vsanMax = computed(() => ...)` — returns `VsanMaxResult | null` (null when storageType != 'vsan-max')
- `validationErrors` now passes `networkSpeedGbE` and `vsanMaxStorageNodes` to validateInputs

**src/composables/useUrlState.ts** — Triple-sync (all 3 locations updated atomically):
- Zod schema: `storageType` enum extended + 3 new fields with defaults
- `hydrateFromUrl`: assigns `vsanMaxProfile`, `vsanMaxStorageNodes`, `networkSpeedGbE`
- `generateShareUrl`: includes all 3 new fields in state object

**src/composables/useUrlState.test.ts** — 5 new vSAN Max round-trip tests added

## Test Results

120 tests pass (up from 100 pre-plan), 0 failures.
`npx tsc --noEmit` exits 0.

## Verification Results

- `grep 'vsan-max' src/engine/types.ts` — matches line 5 (StorageType union)
- `grep 'calcVsanMax' src/stores/calculationStore.ts` — matches lines 11 (import) and 87 (call)
- `grep -c 'vsanMaxProfile' src/composables/useUrlState.ts` — 3 matches (schema, hydrate, generate)
- `grep 'VSAN_MAX_MIN_NODES' src/engine/validation.ts` — matches (rules 129, 133)
- `grep 'DEDUP_NETWORK_SPEED' src/engine/validation.ts` — matches (rules 119, 123)

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 (RED) | test(05-01): add failing TDD tests for vSAN Max engine layer | 13ee405 |
| 2 (GREEN) | feat(05-01): implement vSAN Max engine layer (GREEN - all tests pass) | ceac2e9 |

## Known Stubs

None. All functions return real computed data.

## Self-Check: PASSED
