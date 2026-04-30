# Storage-Driven Host Minimum (minHostsForStorage)

## Purpose
For vSAN ESA, `recommendedHostCount = max(minHostsForCpu, minHostsForRam, minHostsForStorage)`. Previously only CPU/RAM drove the recommendation, which under-sized clusters when workload storage demand exceeded usable capacity.

## Engine API (`src/engine/storage.ts`)
`calcMinHostsForVsanEsa(hostStorageTiB, fttLevel, raidType, dedupEnabled, dedupRatio, deploymentMode, workloadStorageTiB): number`

Formula per host (constant RAID multiplier M, dedup D, stretch S):
```
usablePerHost = H × (0.87×D / M − 0.10) × 0.70 × S
minHosts = ceil(workloadTiB / usablePerHost)
```

## RAID-5 Adaptive Boundary
RAID-5 multiplier changes at 6 hosts (2+1 → 4+1). Algorithm:
1. Compute with 4+1 (M=1.25). If result ≥ 6, use it.
2. Compute with 2+1 (M=1.5). If result ≤ 5, use it.
3. Otherwise return 6 (cross-boundary: 6 hosts with 4+1 is enough).

Always enforce `Math.max(result, minHostsRequired)` (RAID-5 ≥4, RAID-1 FTT=1 ≥3, etc.).

## Wiring Contract
- `minHostsForStorage` is computed in `calculationStore.ts` (NOT the engine's `calcStorage()`), using a local `workloadStorageTiB = vmCount × avgStorageGbPerVm / 1024`.
- Passed into `calcCompute()` via `ComputeInputs.minHostsForStorage` (optional, default 0).
- `StorageResult.workloadStorageRequiredTiB` remains 0 for vSAN ESA — this field is reserved for FC/NFS demand tracking in aggregation.

## UI Display
`DomainResultCard.vue` shows "Min for Storage" row conditionally: `v-if="result.compute.minHostsForStorage > 0"`.
Exports (Markdown, PPTX) also conditional on `> 0`.

## Locale keys
- `results.hostCount.minForStorage` (UI card)
- `export.minHostsStorage` (exports)

All 4 locales (en, fr, de, it).
