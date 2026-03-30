---
phase: 13-per-domain-results-and-aggregate-totals
plan: "02"
subsystem: components/results
tags: [results, per-domain, aggregate, i18n, vue-components, phase13]
dependency_graph:
  requires:
    - src/stores/calculationStore.ts (domainResults[], aggregateTotals, dedicatedMgmtHostCount)
    - src/engine/types.ts (DomainResult, AggregateTotals)
  provides:
    - src/components/results/DomainResultCard.vue (per-domain result card)
    - src/components/results/AggregateTotalsCard.vue (aggregate procurement totals)
    - src/components/results/ResultsPanel.vue (v-for over domainResults)
  affects:
    - src/components/results/StretchNetworkChecklist.vue (prop-based rewrite)
    - src/components/results/VsanMaxClusterCard.vue (prop-based rewrite)
    - src/components/results/charts/CoresChart.vue (first-domain bridge fix)
    - src/components/results/charts/RamChart.vue (first-domain bridge fix)
    - src/components/results/charts/StorageChart.vue (first-domain bridge fix)
tech_stack:
  added: []
  patterns:
    - defineProps<T> typed props for result card components
    - v-for over domainResults computed array with :key="result.id"
    - storeToRefs destructure of domainResults/aggregateTotals/dedicatedMgmtHostCount
    - first-domain bridge (domainResults[0]) in chart components for Phase 13 compat
key_files:
  created:
    - src/components/results/DomainResultCard.vue
    - src/components/results/AggregateTotalsCard.vue
  modified:
    - src/components/results/ResultsPanel.vue
    - src/components/results/StretchNetworkChecklist.vue
    - src/components/results/VsanMaxClusterCard.vue
    - src/components/results/charts/CoresChart.vue
    - src/components/results/charts/RamChart.vue
    - src/components/results/charts/StorageChart.vue
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
  deleted:
    - src/components/results/HostCountCard.vue
decisions:
  - DomainResultCard absorbs HostCountCard layout (big number + min-for-cpu/ram)
  - chart components fixed with first-domain bridge (domainResults[0]) — deferred to Phase 14 for full multi-domain chart support
  - StretchNetworkChecklist uses props.result.stretch.networkChecklist (actual field name, not plan's result.stretch.checklist)
  - VsanMaxClusterCard drops profileLabel display (VsanMaxResult has no profile key) — shows storageNodeCount + capacity + raidScheme
metrics:
  duration: 15min
  completed: "2026-03-30"
  tasks_completed: 3
  files_modified: 11
---

# Phase 13 Plan 02: Per-Domain Result Cards and Aggregate Totals Summary

Per-domain result cards (DomainResultCard) iterating reactively over calculationStore.domainResults[], an aggregate totals card (AggregateTotalsCard) displaying the grand total procurement host count, and prop-based rewrites of StretchNetworkChecklist and VsanMaxClusterCard — all with full i18n support across EN/FR/DE/IT locales.

## What Was Built

### Task 1: Result Components Created and Rewritten

**DomainResultCard.vue** (new):
- `defineProps<{ result: DomainResult }>()` typed prop
- Big number hero: `result.compute.recommendedHostCount` with emerald/red color coding
- CPU/RAM utilization rows with >80% threshold color coding
- Storage rows: safe usable capacity and RAID scheme
- Inline `<StretchNetworkChecklist>` and `<VsanMaxClusterCard>` with `v-if` guards
- Validation warnings rendered via `t(w.messageKey)` pattern

**AggregateTotalsCard.vue** (new):
- `defineProps<{ totals: AggregateTotals; managementHostCount: number | null }>()`
- Grand total computed as `totals.totalRecommendedHosts + (managementHostCount ?? 0)`
- Blue hero number for the procurement total
- Grid rows: workload hosts, management hosts (conditional), total VMs, combined raw/effective storage

**StretchNetworkChecklist.vue** (rewrite):
- Changed from store reads (`storeToRefs(calc)`) to `defineProps<{ result: DomainResult }>()`
- Accesses stretch data via `props.result.stretch.networkChecklist`
- Removed `useCalculationStore()`, `useInputStore()`, and `storeToRefs()` imports

**VsanMaxClusterCard.vue** (rewrite):
- Changed from `storeToRefs(input) + storeToRefs(calc)` to `defineProps<{ result: DomainResult }>()`
- Accesses vSAN Max data via `props.result.vsanMax`
- Removed `useCalculationStore()`, `useInputStore()`, and `storeToRefs()` imports
- Removed computed `profileLabel` (not available in VsanMaxResult interface)

**ResultsPanel.vue** (rewrite):
- Added `DomainResultCard`, `AggregateTotalsCard` imports
- Added `storeToRefs(calc)` destructure of `domainResults`, `aggregateTotals`, `dedicatedMgmtHostCount`
- Template: `<DomainResultCard v-for="result in domainResults" :key="result.id" :result="result" />`
- Removed `HostCountCard`, `CoresChart`, `RamChart`, `StorageChart` imports (charts deferred to v3.1+)

**HostCountCard.vue** (deleted): Layout absorbed into DomainResultCard.

### Task 2: i18n Keys Added to All 4 Locales

Added `results.domain` and `results.aggregate` sections to en/fr/de/it locale files.

New keys: `domain.cpuUtilization`, `domain.ramUtilization`, `domain.storageUsable`, `domain.raidScheme`, `aggregate.title`, `aggregate.totalHosts`, `aggregate.managementHosts`, `aggregate.grandTotal`, `aggregate.totalVms`, `aggregate.totalRawStorage`, `aggregate.totalEffectiveStorage`.

All existing `results.toolbar`, `results.hostCount`, `results.charts`, `results.vsanMax*` keys preserved.

### Task 3: Visual Verification (Auto-approved)

⚡ Auto-approved: Build passes with zero TypeScript errors. 222/222 tests pass. Components verified through static analysis to meet all acceptance criteria.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed chart components using removed calculationStore API**
- **Found during:** Task 1 (build verification)
- **Issue:** `CoresChart.vue`, `RamChart.vue`, `StorageChart.vue` referenced `{ compute }` and `{ storage }` from `storeToRefs(calc)` — these properties were removed in Phase 10 when the store was refactored to `domainResults[]`
- **Fix:** Updated all 3 chart components to use first-domain bridge pattern (`domainResults.value[0]?.compute` / `domainResults.value[0]?.storage`) consistent with Phase 13 pattern established in Plan 01
- **Files modified:** `charts/CoresChart.vue`, `charts/RamChart.vue`, `charts/StorageChart.vue`
- **Commit:** `03c42ce`

**2. [Rule 3 - Blocking] Worktree merge required before execution**
- **Found during:** Pre-task setup
- **Issue:** Worktree branch was on the v2.1 archive commit (before Phase 10-12), lacking `domainResults[]`, `aggregateTotals`, `DomainResult` interface
- **Fix:** `git merge maincd` to sync Phase 10-12 source changes into this worktree
- **Commit:** merge commit (pre-task)

### Implementation Notes

- Plan's `result.stretch.checklist` reference was corrected to `result.stretch.networkChecklist` (actual field name in `StretchResult` interface in `types.ts`)
- Plan's `VsanMaxResult.profileLabel` field doesn't exist — `VsanMaxClusterCard` shows node count, capacity, and RAID scheme instead (all available fields)
- Plan's `ComputeResult` field names `totalCoresAvailable`/`totalRamAvailableGB` corrected to actual field names `availableCores`/`availableRamGB`

## Verification

All success criteria met:

1. `npm run build` exits 0 — zero TypeScript errors
2. `npm run test` — 222/222 tests pass (164 engine + 35 markdown + 23 pptx)
3. `DomainResultCard.vue` exists with `defineProps<{ result: DomainResult }>` — confirmed
4. `AggregateTotalsCard.vue` exists with `defineProps<{ totals: AggregateTotals` — confirmed
5. `ResultsPanel.vue` contains `v-for="result in domainResults"` with `:key="result.id"` — confirmed
6. `ResultsPanel.vue` does NOT contain `HostCountCard`, `CoresChart`, `RamChart`, `StorageChart` — confirmed
7. `StretchNetworkChecklist.vue` uses `defineProps<{ result: DomainResult }>`, no `useCalculationStore`/`storeToRefs` — confirmed
8. `VsanMaxClusterCard.vue` uses `defineProps<{ result: DomainResult }>`, no `useCalculationStore`/`useInputStore` — confirmed
9. `HostCountCard.vue` deleted — confirmed
10. All 4 locale files have `results.domain.cpuUtilization` and `results.aggregate.grandTotal` — confirmed

## Known Stubs

None. All result components are wired to live store data via `domainResults[]` computed array. No hardcoded values or placeholder text.

## Self-Check: PASSED
