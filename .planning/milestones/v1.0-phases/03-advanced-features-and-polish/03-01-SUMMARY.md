# Plan 03-01 Summary — Engine TDD

**Completed:** 2026-03-28
**Status:** DONE

## What was built

- **types.ts**: Extended `ComputeInputs` with 4 optional fields (`nvmeTieringEnabled`, `activeMemoryPct`, `gpuVmCount`, `vgpuMemoryGB`). Added `StretchInputs`, `StretchResult` interfaces. Extended `ValidationInputs` with optional `preferredSiteHosts`, `secondarySiteHosts`.
- **compute.ts**: NVMe tiering branch (`effectiveHostRamGB = hostRamGB/2` when enabled && pct≤50). GPU overhead (`gpuVmCount × vgpuMemoryGB × 2`). Both use `Decimal.js`. All new fields optional — zero breaking changes.
- **stretch.ts**: `calcStretch()` pure function. ESA M witness hardcoded at 4 vCPU/16 GB. Bandwidth = totalStorageTB × 0.1. `effectivePerSiteStorageTB = total/2`.
- **validation.ts**: `STRETCH_MIN_HOSTS` rule — fires when `deploymentMode === 'stretch'` and either site has < 3 hosts.
- **inputStore.ts**: 6 new refs — `nvmeTieringEnabled`, `activeMemoryPct`, `preferredSiteHosts`, `secondarySiteHosts`, `gpuVmCount`, `vgpuMemoryGB`.
- **calculationStore.ts**: `stretch` computed wired to `calcStretch`. `compute` computed passes 4 new fields. `validationErrors` passes stretch site hosts.

## Test results

- 72/72 tests pass
- NVMe boundary: pct=50 → halved ✓, pct=51 → not halved ✓
- GPU overhead: 10×16×2=320 ✓, count=0 → zero overhead ✓
- Stretch witness: 4 vCPU / 16 GB ✓
- STRETCH_MIN_HOSTS fires at < 3 per site ✓
