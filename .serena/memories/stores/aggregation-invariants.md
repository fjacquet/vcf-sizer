# CalculationStore — Aggregation Invariants

## effectiveHostCount vs recommendedHostCount
`aggregateTotals.totalRecommendedHosts` sums `d.compute.effectiveHostCount` (user-set cluster size), NOT `recommendedHostCount` (demand-driven minimum).

`effectiveHostCount`:
- `simple`/`ha`: equals `domain.hostCount`
- `stretch`: `preferredSiteHosts + secondarySiteHosts`

`recommendedHostCount = max(minHostsForCpu, minHostsForRam, minHostsForStorage)` — can exceed or fall below actual host count.

**Tests comparing totals must sum `effectiveHostCount`**, not `recommendedHostCount`.

## Storage Aggregation Type-Differentiation
`totalRawStorageTiB` and `totalEffectiveStorageTiB` use conditional on `workloadStorageRequiredTiB > 0`:

```typescript
totalRawStorageTiB: domainResults.reduce((sum, d) =>
  sum + (d.storage.workloadStorageRequiredTiB > 0
    ? d.storage.workloadStorageRequiredTiB  // FC/NFS: demand
    : d.storage.rawCapacityTiB), 0)         // vSAN: physical
```

This differentiation relies on **vSAN ESA always returning `workloadStorageRequiredTiB: 0`**. If vSAN ESA also populated this field, aggregation would incorrectly use demand instead of physical capacity.

## Management Host Integration (ENGINE-03)
`totalRecommendedHosts = workloadHosts + mgmtHosts`
- `workloadHosts` = sum of `effectiveHostCount` across all domains
- `mgmtHosts` = `dedicatedMgmtHostCount ?? 0` (0 when colocated)

## Default Domain Triggers Storage Constraint
Default fixture: 100 VMs × 100 GB = 9.77 TiB vSAN ESA demand.
With 4 hosts × 3.84 TiB raw, ~5.16 TiB safe usable → `minHostsForStorage ≈ 8`.
Tests asserting `recommendedHostCount = 4` for defaults broke after minHostsForStorage landed.
