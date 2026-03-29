---
phase: 05-vsan-max-storage-cluster
plan: 02
subsystem: ui
tags: [vsan-max, ui, vue3, tailwind, i18n, input-forms, results-card, validation]
dependency_graph:
  requires: [05-01]
  provides: [vsanMax-ui, vsan-max-input-controls, VsanMaxClusterCard, network-speed-selector]
  affects: [StorageConfigForm, HostSpecsForm, ResultsPanel, DeploymentModelSelector, all-locale-files]
tech_stack:
  added: [VsanMaxClusterCard.vue]
  patterns: [storeToRefs, computed-validation, v-if-conditional-sections, button-group-selector]
key_files:
  created:
    - src/components/results/VsanMaxClusterCard.vue
  modified:
    - src/components/input/StorageConfigForm.vue
    - src/components/input/HostSpecsForm.vue
    - src/components/results/ResultsPanel.vue
    - src/components/input/DeploymentModelSelector.vue
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
decisions:
  - "DEDUP_NETWORK_SPEED warning placed inside vSAN ESA dedup section (not HostSpecsForm) per UI-SPEC"
  - "effectiveBandwidthGbps = Math.min(stretch.minBandwidthGbps, networkSpeedGbE) caps stretch bandwidth display"
  - "i18n keys use flat naming (storage.vsanMaxProfile) per PLAN.md spec, not nested (storage.vsanMax.profile) from UI-SPEC"
  - "bandwidthLineRateCap placed inside stretchSites object in locale files for correct nesting"
metrics:
  duration: "12min"
  completed: "2026-03-29"
  tasks_completed: 3
  files_modified: 9
---

# Phase 05 Plan 02: vSAN Max UI Layer Summary

Complete UI layer for vSAN Max storage cluster: storage type button + profile dropdown + storage nodes slider in StorageConfigForm, network speed button group + compute cluster note in HostSpecsForm, new VsanMaxClusterCard in ResultsPanel, stretch bandwidth line-rate cap in DeploymentModelSelector, and all Phase 5 i18n keys in all 4 locale files.

## What Was Built

### New Files

**src/components/results/VsanMaxClusterCard.vue** — vSAN Max storage cluster results card (follows HostCountCard pattern)
- Visible only when `storageType === 'vsan-max' && vsanMax` (conditional mount via `v-if`)
- Shows storage node count as large 48px number (emerald when >= 4, red when below minimum)
- Shows computed `profileLabel` (e.g. "MED (100 TB/node)") from READYNODE_PROFILES
- Data grid: raw capacity, usable capacity (green), RAID scheme
- WarningBanner with severity=error when `vsanMax.belowMinNodes`
- Imports `READYNODE_PROFILES` from engine for profile label computation

### Modified Files

**src/components/input/StorageConfigForm.vue** — Extended for vSAN Max
- Added `vsanMaxProfile`, `vsanMaxStorageNodes`, `networkSpeedGbE` to storeToRefs
- Added `vsanMax` to storeToRefs from calculationStore
- Added `vsanMaxMinNodesError` and `dedupNetworkSpeedError` computed properties
- Added `{ value: 'vsan-max', labelKey: 'storage.vsanMax' }` to storageTypes array
- Added `<template v-if="storageType === 'vsan-max'">` section with profile dropdown (5 options: XS/SM/MED/LRG/XL) and storage nodes slider (min=4, max=64)
- Added DEDUP_NETWORK_SPEED warning banner inside dedup section
- Added VSAN_MAX_MIN_NODES error banner inside vSAN Max section
- Updated storage capacity summary: raw capacity uses vsanMax.rawCapacityTB when vSAN Max active; added `v-else-if` for vSAN Max showing raidScheme and usableCapacityTB

**src/components/input/HostSpecsForm.vue** — Network speed + compute note
- Added `networkSpeedGbE`, `storageType` to storeToRefs
- Added network speed button group (10/25/100 GbE, `sm:col-span-2`) after hostStorageTB slider
- Added informational note `v-if="storageType === 'vsan-max'"` after hostCount slider

**src/components/results/ResultsPanel.vue** — VsanMaxClusterCard wiring
- Added `import VsanMaxClusterCard`
- Inserted `<VsanMaxClusterCard />` after `<HostCountCard />` and before `<CoresChart />`

**src/components/input/DeploymentModelSelector.vue** — Stretch bandwidth line-rate cap
- Added `networkSpeedGbE` to storeToRefs
- Added `effectiveBandwidthGbps = Math.min(stretch.minBandwidthGbps, networkSpeedGbE)` computed
- Added `bandwidthCappedByLineRate` computed (true when formula result > line rate)
- Replaced `stretch.minBandwidthGbps` display with `effectiveBandwidthGbps`
- Added `bandwidthLineRateCap` indicator span below existing `bandwidthFloorApplied` indicator

**Locale files (en/fr/de/it)** — All Phase 5 i18n keys added
- `storage.vsanMax`, `storage.vsanMaxProfile`, `storage.vsanMaxStorageNodes`
- `host.networkSpeed`, `host.vsanMaxComputeNote`
- `validation.vsanMaxMinNodes`, `validation.dedupNetworkSpeed`
- `results.vsanMaxTitle`, `results.vsanMaxStorageNodes`, `results.vsanMaxProfile`
- `results.vsanMaxRawCapacity`, `results.vsanMaxUsableCapacity`, `results.vsanMaxRaidScheme`
- `deployment.stretchSites.bandwidthLineRateCap`

## Test Results

120 tests pass (unchanged from plan 05-01), 0 failures.
`npx tsc --noEmit` exits 0.

## Verification Results

Task 3 (checkpoint:human-verify) auto-approved — auto_advance=true in config.json.

## Deviations from Plan

### Key Naming Alignment

**Issue:** PLAN.md specifies flat i18n keys (`storage.vsanMaxProfile`) while UI-SPEC.md uses nested keys (`storage.vsanMax.profile`).

**Resolution:** Followed PLAN.md flat naming since it is the authoritative task specification. Components use flat keys consistently across all 4 locale files.

**Impact:** None — both patterns are valid Vue-i18n nested object access. Flat keys match the existing project conventions (e.g., `storage.vsanEsa`, `storage.fttLevel`).

Otherwise — plan executed exactly as written.

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | feat(05-02): add vSAN Max input controls and i18n keys | 8f56b4a |
| 2 | feat(05-02): add VsanMaxClusterCard, wire ResultsPanel, cap stretch bandwidth | b8ce196 |

## Known Stubs

None. All components read live computed data from calculationStore. VsanMaxClusterCard reads `vsanMax` computed which returns real VsanMaxResult or null. No placeholder text.

## Self-Check: PASSED
