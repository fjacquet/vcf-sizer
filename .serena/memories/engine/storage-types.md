# Storage Engine — Type-specific behavior

## Storage Types
- `vsan-esa`: Local NVMe drives form vSAN cluster. Full overhead stack: RAID → LFS (13%) → metadata (10%) → slack (30%). Host count determines RAID scheme (3-5 hosts: 2+1, 6+: 4+1). Stretch mode halves effective/safe capacity (PFTT=1 mirroring).
- `fc`: External Fibre Channel SAN. Pass-through of `externalStorageUsableTiB`. No RAID/LFS/metadata overhead (SAN handles). `storagePerHost` irrelevant — hosts don't store VM data locally.
- `nfs`: External NAS. Identical behavior to FC — pass-through, no overhead. `storagePerHost` irrelevant.
- `vsan-max`: Disaggregated storage — compute nodes separate from storage nodes. `calcStorage()` is pass-through for compute; `calcVsanMax()` sizes storage cluster separately.

## Key Formula: workloadStorageRequiredTiB
For FC/NFS only: `vmCount × avgStorageGbPerVm / 1024` (Decimal.js)
Same formula used in `calcStretch()` at `stretch.ts:25-28`.
vSAN types set this to 0 (capacity comes from physical drives).

## Files
- `src/engine/storage.ts` — `calcStorage()` main entry, `vsanEsaRaidOverhead()` for RAID schemes
- `src/engine/types.ts` — `StorageInputs`, `StorageResult`, `AggregateTotals`
- `src/engine/stretch.ts` — `calcStretch()` for stretch cluster topology
- `src/engine/vsanMax.ts` — `calcVsanMax()` for vSAN Max storage nodes
