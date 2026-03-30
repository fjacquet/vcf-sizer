---
phase: 01-foundation-engine-and-inputs
plan: "02"
subsystem: engine
tags: [engine, tdd, vsan-esa, management-domain, decimal-js, pinia, vitest]
dependency_graph:
  requires:
    - "01-01: project scaffold, Vitest config, inputStore"
  provides:
    - "src/engine/types.ts — DeploymentMode, StorageType, RaidType, FttLevel + result interfaces"
    - "src/engine/management.ts — calcManagement() with locked VCF 9.x constants"
    - "src/engine/compute.ts — calcCompute() total cluster compute requirements"
    - "src/engine/storage.ts — calcStorage() + vsanEsaRaidOverhead() vSAN ESA + FC/NFS"
    - "src/engine/validation.ts — validateInputs() VCFA blocker + dedup/stretch exclusion"
    - "src/stores/calculationStore.ts — useCalculationStore computed-only getters"
  affects:
    - "Plan 03 (input panels): reads calculationStore and inputStore"
    - "Plan 04+ (output/charts): reads calculationStore results"
tech_stack:
  added:
    - "Decimal.js 10.x: all arithmetic in engine files"
  patterns:
    - "TDD: RED → GREEN → REFACTOR"
    - "Pure TS engine functions: zero Vue imports (CALC-01)"
    - "Pinia computed-only store: calculationStore exposes zero ref() (CALC-02)"
    - "Adaptive RAID-5: host-count gate (not drive-count gate from raidy OSA)"
key_files:
  created:
    - src/engine/types.ts
    - src/engine/management.ts
    - src/engine/management.test.ts
    - src/engine/compute.ts
    - src/engine/compute.test.ts
    - src/engine/storage.ts
    - src/engine/storage.test.ts
    - src/engine/validation.ts
    - src/engine/validation.test.ts
    - src/stores/calculationStore.ts
  modified: []
decisions:
  - "Fleet Manager (4 vCPU / 12 GB) and Collector (4 vCPU / 16 GB) are ×1 ALWAYS — not HA-scaled (MGMT-04)"
  - "Adaptive RAID-5 uses HOST COUNT threshold (≥6 hosts = 4+1), not raidy drive-count gate"
  - "Decimal.js used for all arithmetic; .toNumber() called before returning from every engine function to prevent Proxy issues in reactive state"
  - "calculationStore has zero ref() — only computed() over inputStore (CALC-02)"
metrics:
  duration: "4 minutes"
  completed: "2026-03-28"
  tasks_completed: 3
  files_created: 10
  tests_passing: 30
---

# Phase 1 Plan 02: VCF 9.x Calculation Engine Summary

**One-liner:** TDD-implemented VCF 9.x calculation engine with Decimal.js arithmetic, Adaptive RAID-5 thresholds, management domain singletons, and computed-only Pinia store.

## What Was Built

Four pure TypeScript engine modules plus a Pinia calculation store, all implemented via TDD (RED → GREEN → REFACTOR). 30 Vitest tests pass. Zero Vue imports in any engine file.

### Engine Modules

| File | Exports | Verified Values |
|------|---------|-----------------|
| `types.ts` | `DeploymentMode`, `StorageType`, `RaidType`, `FttLevel`, 6 interfaces | — |
| `management.ts` | `calcManagement(mode)` | Simple: 50 vCPU / 201 GB; HA: 118 vCPU / 473 GB |
| `compute.ts` | `calcCompute(inputs)` | Host requirements, utilization %, min hosts |
| `storage.ts` | `calcStorage(inputs)`, `vsanEsaRaidOverhead(h,f,r)` | 5-host=1.5x, 6-host=1.25x RAID-5 |
| `validation.ts` | `validateInputs(inputs)` | VCFA_MIN_CORES fires at <12 cores |

### Management Domain Constants (Locked)

| Component | Simple | HA/Stretch |
|-----------|--------|------------|
| vCenter Server | 4 vCPU / 21 GB | 4 vCPU / 21 GB (×1 always) |
| SDDC Manager | 4 vCPU / 16 GB | 4 vCPU / 16 GB (×1 always) |
| NSX Manager | 6 vCPU / 24 GB | 18 vCPU / 72 GB (×3) |
| VCF Operations | 4 vCPU / 16 GB | 12 vCPU / 48 GB (×3) |
| Fleet Manager | 4 vCPU / 12 GB | 4 vCPU / 12 GB (×1 ALWAYS — singleton) |
| Collector | 4 vCPU / 16 GB | 4 vCPU / 16 GB (×1 ALWAYS — singleton) |
| VCF Automation | 24 vCPU / 96 GB | 72 vCPU / 288 GB (×3) |
| **TOTAL** | **50 vCPU / 201 GB** | **118 vCPU / 473 GB** |

### vSAN ESA Adaptive RAID-5 Results

| Hosts | Scheme | Multiplier |
|-------|--------|------------|
| 3–5 | 2+1 (FTT=1) | 1.5× |
| 6+ | 4+1 (FTT=1) | 1.25× |
| Any | RAID-1 FTT=1 | 2.0× |
| 6+ | RAID-6 FTT=2 | 1.5× |

### vSAN ESA Overhead Stack (4 hosts, 3.84 TB/host, RAID-5 FTT=1)

| Step | Value |
|------|-------|
| Raw capacity | 15.36 TB |
| After RAID-5 (2+1, 1.5×) | 10.24 TB |
| After LFS (−13%) | 8.9088 TB |
| After metadata pool (−10% of raw) | 7.3728 TB |
| Safe usable (70% of net) | ~5.16 TB |

## Commits

| Hash | Phase | Description |
|------|-------|-------------|
| b08b225 | RED | test(01-02): add failing tests for management, storage, validation, compute |
| aaff99b | GREEN | feat(01-02): implement management, storage, validation, compute engine modules |
| 870209a | GREEN | feat(01-02): add calculationStore with computed-only getters wired to engine |

## Deviations from Plan

None — plan executed exactly as written.

The plan specified exact constant values and test assertions. All were implemented as specified. The vSAN overhead stack formula from the plan was verified to produce `safeUsableCapacityTB ≈ 5.16` for the reference inputs, which matches the expected value.

## Verification Results

```
npm run test: 30/30 tests pass (5 test files)
Vue imports in engine: NONE (grep clean)
Decimal in calculationStore: NONE
ref() in calculationStore: NONE
vue-tsc --noEmit: 0 errors
```

## Known Stubs

None — all engine functions return computed values from real inputs with no placeholder data.

## Self-Check: PASSED
