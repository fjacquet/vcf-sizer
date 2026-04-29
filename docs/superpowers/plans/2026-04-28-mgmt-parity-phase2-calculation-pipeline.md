# Mgmt Parity Phase 2 — Calculation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the full management-domain calculation pipeline that consumes P1's types/constants/profiles to produce a complete `MgmtDomainResult` from a `(ManagementDomainConfig, WorkloadDomainConfig[])` input — and refactor the legacy `engine/management.ts` shim to be a thin wrapper around it.

**Architecture:** Five new pure-TS files under `src/engine/mgmt/` (`hostMath.ts`, `storage.ts`, `appliances.ts`, `wldOverhead.ts`, `validation.ts`), plus a `calcManagementFull(config, wlds)` orchestrator added to `mgmt/index.ts`. Each file has one clear responsibility with focused tests. The legacy `calcManagement(mode)` shim in `engine/management.ts` becomes a one-line wrapper that builds a default config from `mode` and delegates. All arithmetic uses `Decimal.js` (PITFALLS #1). All validation messages are i18n keys (existing convention). CALC-01 (no Vue imports) and CALC-02 (no `ref()` in `calculationStore`) preserved.

**Tech Stack:** TypeScript 5, Vitest (node env), `decimal.js` for arithmetic. Reuses existing engine helpers `calcMinHostsForVsanEsa` (from `src/engine/storage.ts`) and `calcVsanMax` (from `src/engine/vsanMax.ts`) without modification.

**Reference spec:** `docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md` — §5 (calculation pipeline, the source of truth for every formula), §8 (validation rules table), Appendix B (profile presets — already locked in P1).

**Total tasks:** 7. Estimated total time: 1–2 days.

---

## Naming decisions locked here

- **New orchestrator name:** `calcManagementFull(config, wlds)`. The legacy `calcManagement(mode)` keeps its name in `engine/management.ts`. The two functions have incompatible signatures and live in different modules, so the names must differ during the migration window. After P3 migrates stores onto `calcManagementFull` and the legacy shim is no longer needed, a rename pass (likely in P5/P6) will drop the `Full` suffix and delete the shim.
- **HA-fanout helper:** `applyHaFanout(deploymentMode, category, baseNodeCount)` — applied inside `appliances.ts` to four categories (`nsxManager`, `vrops`, `automation`, `vrli`). Profiles set `nodeCount: 1`; the helper multiplies by 3 in `'ha' | 'stretch'` mode.
- **WLD-overhead pickers:** `pickVcenterSize(vmCount, hostCount)` and `pickNsxSize(hostCount)` — pure functions in `wldOverhead.ts`. Tables baked in per spec §5 step 2.

---

## File Structure (created or modified in this phase)

```
src/engine/mgmt/
├── hostMath.ts            # NEW (Task 1)
├── hostMath.test.ts       # NEW (Task 1)
├── storage.ts             # NEW (Task 2)
├── storage.test.ts        # NEW (Task 2)
├── appliances.ts          # NEW (Task 3)
├── appliances.test.ts     # NEW (Task 3)
├── wldOverhead.ts         # NEW (Task 4)
├── wldOverhead.test.ts    # NEW (Task 4)
├── validation.ts          # NEW (Task 5)
├── validation.test.ts     # NEW (Task 5)
└── index.ts               # MODIFIED (Task 6 — add calcManagementFull orchestrator)

src/engine/
└── management.ts          # MODIFIED (Task 7 — refactor legacy shim to wrap calcManagementFull)
```

`types.ts`, `constants.ts`, `profiles.ts` are NOT modified in this phase. Tests in `constants.test.ts` and `profiles.test.ts` are NOT modified.

---

## Task 1 — `hostMath.ts`: per-host requirements (N-1 model, dual oversubscription)

**Files:**
- Create: `src/engine/mgmt/hostMath.ts`
- Create: `src/engine/mgmt/hostMath.test.ts`

Pure math: given totals + cluster size + oversubscription ratios + storage type, compute per-host CPU/RAM/storage and the external-pool requirement for FC/NFS. No external dependencies beyond `Decimal.js` and the `StorageType` from existing engine types.

- [ ] **Step 1: Write the failing test file `src/engine/mgmt/hostMath.test.ts`**

```ts
/// <reference types="vitest/globals" />
import { perHostRequirements } from './hostMath'

describe('perHostRequirements — N-1 capacity model', () => {
  it('divides total demand by (hosts−1) and applies CPU/RAM oversubscription separately', () => {
    const r = perHostRequirements({
      totalCores: 100,
      totalRamGB: 200,
      storageDemandGB: 1024,
      storageDemandTiB: 1,
      hosts: 5,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'vsan-esa',
    })
    // n = 4; cpu = ceil(100/4/2) = 13; ram = ceil(200/4/1) = 50; storage = ceil(1024/4) = 256
    expect(r.perHostCores).toBe(13)
    expect(r.perHostRamGB).toBe(50)
    expect(r.perHostStorageGB).toBe(256)
  })

  it('FC: zero per-host storage; full demand surfaces as externalPoolRequiredTiB', () => {
    const r = perHostRequirements({
      totalCores: 50,
      totalRamGB: 100,
      storageDemandGB: 2048,
      storageDemandTiB: 2,
      hosts: 4,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'fc',
    })
    expect(r.perHostStorageGB).toBe(0)
    expect(r.externalPoolRequiredTiB).toBe(2)
  })

  it('NFS: same FC behavior — external pool, zero per-host storage', () => {
    const r = perHostRequirements({
      totalCores: 50,
      totalRamGB: 100,
      storageDemandGB: 1024,
      storageDemandTiB: 1,
      hosts: 4,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'nfs',
    })
    expect(r.perHostStorageGB).toBe(0)
    expect(r.externalPoolRequiredTiB).toBe(1)
  })

  it('vSAN Max: per-host storage zero (compute hosts only); demand routed through storage cluster', () => {
    const r = perHostRequirements({
      totalCores: 50,
      totalRamGB: 100,
      storageDemandGB: 5120,
      storageDemandTiB: 5,
      hosts: 4,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'vsan-max',
    })
    // vSAN Max compute hosts contribute zero local storage; demand flows to disaggregated cluster (P2 routing)
    expect(r.perHostStorageGB).toBe(0)
    expect(r.externalPoolRequiredTiB).toBe(0)
  })

  it('floor of 1 host on n: single-host cluster does not divide by 0', () => {
    const r = perHostRequirements({
      totalCores: 10,
      totalRamGB: 20,
      storageDemandGB: 100,
      storageDemandTiB: 1,
      hosts: 1,
      cpuOversubscription: 1,
      ramOversubscription: 1,
      storageType: 'vsan-esa',
    })
    // n = max(1−1, 1) = 1; cpu = ceil(10/1/1) = 10
    expect(r.perHostCores).toBe(10)
    expect(r.perHostRamGB).toBe(20)
    expect(r.perHostStorageGB).toBe(100)
  })

  it('CPU oversubscription applied independently from RAM oversubscription', () => {
    const r = perHostRequirements({
      totalCores: 80,
      totalRamGB: 80,
      storageDemandGB: 0,
      storageDemandTiB: 0,
      hosts: 3,
      cpuOversubscription: 4,
      ramOversubscription: 1,
      storageType: 'vsan-esa',
    })
    // n = 2; cpu = ceil(80/2/4) = 10; ram = ceil(80/2/1) = 40
    expect(r.perHostCores).toBe(10)
    expect(r.perHostRamGB).toBe(40)
  })

  it('rejects non-positive oversubscription', () => {
    expect(() => perHostRequirements({
      totalCores: 10, totalRamGB: 10, storageDemandGB: 0, storageDemandTiB: 0,
      hosts: 4, cpuOversubscription: 0, ramOversubscription: 1, storageType: 'vsan-esa',
    })).toThrow(/oversubscription/i)
    expect(() => perHostRequirements({
      totalCores: 10, totalRamGB: 10, storageDemandGB: 0, storageDemandTiB: 0,
      hosts: 4, cpuOversubscription: 2, ramOversubscription: -1, storageType: 'vsan-esa',
    })).toThrow(/oversubscription/i)
  })
})

describe('perHostRequirements — minHostsForCpu/Ram helpers', () => {
  it('exposes minHostsForCpu computed from totals and per-host capacity', () => {
    const r = perHostRequirements({
      totalCores: 100,
      totalRamGB: 200,
      storageDemandGB: 0,
      storageDemandTiB: 0,
      hosts: 5,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'vsan-esa',
      coresPerHost: 32,
      ramPerHost: 128,
    })
    // minHostsCpu = ceil(100 / 32 / 2) = 2
    // minHostsRam = ceil(200 / 128 / 1) = 2
    expect(r.minHostsForCpu).toBe(2)
    expect(r.minHostsForRam).toBe(2)
  })

  it('coresPerHost/ramPerHost optional — minHosts fields are 0 when omitted', () => {
    const r = perHostRequirements({
      totalCores: 100,
      totalRamGB: 200,
      storageDemandGB: 0,
      storageDemandTiB: 0,
      hosts: 5,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'vsan-esa',
    })
    expect(r.minHostsForCpu).toBe(0)
    expect(r.minHostsForRam).toBe(0)
  })
})
```

- [ ] **Step 2: Run the failing test**

```bash
npx vitest run src/engine/mgmt/hostMath.test.ts
```

Expected: FAIL with "Cannot find module './hostMath'".

- [ ] **Step 3: Implement `src/engine/mgmt/hostMath.ts`**

```ts
// VCF 9.x Management Domain — per-host capacity math (N-1 model)
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All arithmetic uses Decimal.js to avoid IEEE 754 drift (PITFALLS #1)
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 step 6

import Decimal from 'decimal.js'
import type { StorageType } from '../types'

export interface PerHostInputs {
  totalCores: number
  totalRamGB: number
  storageDemandGB: number       // total mgmt storage demand (after FTT × reserve × growth)
  storageDemandTiB: number      // same value in TiB (for externalPoolRequiredTiB)
  hosts: number
  cpuOversubscription: number   // > 0
  ramOversubscription: number   // > 0
  storageType: StorageType
  coresPerHost?: number         // optional — drives minHostsForCpu when present
  ramPerHost?: number           // optional — drives minHostsForRam when present
}

export interface PerHostResult {
  perHostCores: number
  perHostRamGB: number
  perHostStorageGB: number      // 0 for fc/nfs/vsan-max
  externalPoolRequiredTiB: number   // > 0 only for fc/nfs
  minHostsForCpu: number        // 0 when coresPerHost not supplied
  minHostsForRam: number        // 0 when ramPerHost not supplied
}

const VSAN_LOCAL_STORAGE: ReadonlySet<StorageType> = new Set<StorageType>(['vsan-esa'])
// vsan-max compute hosts hold no local storage — demand is satisfied by the
// disaggregated storage cluster, sized separately via calcVsanMax.

export function perHostRequirements(inputs: PerHostInputs): PerHostResult {
  if (inputs.cpuOversubscription <= 0 || inputs.ramOversubscription <= 0) {
    throw new Error('oversubscription must be > 0')
  }

  const n = Math.max(inputs.hosts - 1, 1)

  const perHostCores = new Decimal(inputs.totalCores)
    .div(n)
    .div(inputs.cpuOversubscription)
    .ceil()
    .toNumber()
  const perHostRamGB = new Decimal(inputs.totalRamGB)
    .div(n)
    .div(inputs.ramOversubscription)
    .ceil()
    .toNumber()

  let perHostStorageGB = 0
  let externalPoolRequiredTiB = 0
  if (VSAN_LOCAL_STORAGE.has(inputs.storageType)) {
    perHostStorageGB = new Decimal(inputs.storageDemandGB).div(n).ceil().toNumber()
  } else if (inputs.storageType === 'fc' || inputs.storageType === 'nfs') {
    externalPoolRequiredTiB = inputs.storageDemandTiB
  }
  // vsan-max: both stay 0 (storage cluster handles demand)

  const minHostsForCpu = inputs.coresPerHost
    ? new Decimal(inputs.totalCores).div(inputs.coresPerHost).div(inputs.cpuOversubscription).ceil().toNumber()
    : 0
  const minHostsForRam = inputs.ramPerHost
    ? new Decimal(inputs.totalRamGB).div(inputs.ramPerHost).div(inputs.ramOversubscription).ceil().toNumber()
    : 0

  return {
    perHostCores,
    perHostRamGB,
    perHostStorageGB,
    externalPoolRequiredTiB,
    minHostsForCpu,
    minHostsForRam,
  }
}
```

- [ ] **Step 4: Run the test, confirm pass**

```bash
npx vitest run src/engine/mgmt/hostMath.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Run full suite + type-check + build**

```bash
npm run test && npm run type-check && npm run build
```

Expected: 412 + 9 = 421 passing; type-check + build clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/mgmt/hostMath.ts src/engine/mgmt/hostMath.test.ts
git commit -m "feat(mgmt): phase 2.1 — perHostRequirements (N-1 model, dual oversubscription)

Pure capacity math: divide totals by (hosts−1), apply CPU/RAM
oversubscription separately, and route storage per type
(vSAN ESA: per-host disk; FC/NFS: external pool TiB; vSAN Max:
neither, since the storage cluster handles demand).

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 step 6"
```

---

## Task 2 — `storage.ts`: mgmt-domain storage demand

**Files:**
- Create: `src/engine/mgmt/storage.ts`
- Create: `src/engine/mgmt/storage.test.ts`

Storage demand = `(diskGB + swapGB) × FTT-multiplier × (1 + reserve%) × (1 + growth%)`. Per spec §5 step 5: vSAN ESA + vSAN Max use ×1.5; FC + NFS use ×1 (array handles redundancy). Returns both GB (for per-host computation) and TiB (for external-pool reporting).

- [ ] **Step 1: Write failing test file `src/engine/mgmt/storage.test.ts`**

```ts
/// <reference types="vitest/globals" />
import { mgmtStorageDemand } from './storage'

describe('mgmtStorageDemand — vSAN ESA (×1.5 FTT multiplier)', () => {
  it('applies 1.5× FTT, then 30% reserve, then 10% growth', () => {
    // diskGB + swapGB = 1000; raw = 1500; reserve = 1500 × 1.3 = 1950; growth = 1950 × 1.1 = 2145
    const r = mgmtStorageDemand({
      totalDiskGB: 500,
      totalRamGB: 500,   // = swap demand
      storageType: 'vsan-esa',
      reservePct: 30,
      growthPct: 10,
    })
    expect(r.storageDemandGB).toBe(2145)
    expect(r.storageDemandTiB).toBeCloseTo(2145 / 1024, 5)
  })
})

describe('mgmtStorageDemand — vSAN Max (ESA-class ×1.5 multiplier)', () => {
  it('uses 1.5× multiplier same as ESA', () => {
    const r = mgmtStorageDemand({
      totalDiskGB: 500,
      totalRamGB: 500,
      storageType: 'vsan-max',
      reservePct: 30,
      growthPct: 10,
    })
    expect(r.storageDemandGB).toBe(2145)
  })
})

describe('mgmtStorageDemand — FC/NFS (×1, array handles redundancy)', () => {
  it('FC: ×1, then reserve, then growth', () => {
    // diskGB + swapGB = 1000; raw = 1000; reserve = 1300; growth = 1430
    const r = mgmtStorageDemand({
      totalDiskGB: 500,
      totalRamGB: 500,
      storageType: 'fc',
      reservePct: 30,
      growthPct: 10,
    })
    expect(r.storageDemandGB).toBe(1430)
  })

  it('NFS: same as FC', () => {
    const r = mgmtStorageDemand({
      totalDiskGB: 500,
      totalRamGB: 500,
      storageType: 'nfs',
      reservePct: 30,
      growthPct: 10,
    })
    expect(r.storageDemandGB).toBe(1430)
  })
})

describe('mgmtStorageDemand — reserve and growth are additive percentages', () => {
  it('zero reserve + zero growth: just the raw multiplier', () => {
    const r = mgmtStorageDemand({
      totalDiskGB: 1000,
      totalRamGB: 0,
      storageType: 'fc',
      reservePct: 0,
      growthPct: 0,
    })
    expect(r.storageDemandGB).toBe(1000)
  })

  it('reserve then growth, in that order (compound, not sum)', () => {
    // raw = 100; reserve = 100 × 1.5 = 150; growth = 150 × 1.5 = 225 (NOT 100 × 2.0)
    const r = mgmtStorageDemand({
      totalDiskGB: 100,
      totalRamGB: 0,
      storageType: 'fc',
      reservePct: 50,
      growthPct: 50,
    })
    expect(r.storageDemandGB).toBe(225)
  })
})

describe('mgmtStorageDemand — swap calculation', () => {
  it('swapGB equals totalRamGB (mgmt VM swap demand = RAM)', () => {
    const r = mgmtStorageDemand({
      totalDiskGB: 0,
      totalRamGB: 100,
      storageType: 'fc',
      reservePct: 0,
      growthPct: 0,
    })
    // diskGB + swapGB = 0 + 100 = 100
    expect(r.storageDemandGB).toBe(100)
    expect(r.swapGB).toBe(100)
    expect(r.diskAndSwapGB).toBe(100)
  })
})

describe('mgmtStorageDemand — invalid input', () => {
  it('rejects negative reserve', () => {
    expect(() => mgmtStorageDemand({
      totalDiskGB: 100, totalRamGB: 0, storageType: 'fc', reservePct: -1, growthPct: 0,
    })).toThrow(/reserve|growth/i)
  })
  it('rejects negative growth', () => {
    expect(() => mgmtStorageDemand({
      totalDiskGB: 100, totalRamGB: 0, storageType: 'fc', reservePct: 0, growthPct: -1,
    })).toThrow(/reserve|growth/i)
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
npx vitest run src/engine/mgmt/storage.test.ts
```

Expected: FAIL with "Cannot find module './storage'".

- [ ] **Step 3: Implement `src/engine/mgmt/storage.ts`**

```ts
// VCF 9.x Management Domain — storage demand
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All arithmetic uses Decimal.js to avoid IEEE 754 drift (PITFALLS #1)
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 step 5

import Decimal from 'decimal.js'
import type { StorageType } from '../types'

export interface StorageDemandInputs {
  totalDiskGB: number       // sum of all appliance disk
  totalRamGB: number        // sum of all appliance RAM (= swap demand)
  storageType: StorageType
  reservePct: number        // ≥ 0 (e.g. 30 for 30%)
  growthPct: number         // ≥ 0 (e.g. 10 for 10%)
}

export interface StorageDemandResult {
  diskAndSwapGB: number     // totalDiskGB + totalRamGB (swap = RAM)
  swapGB: number            // = totalRamGB; surfaced for reporting
  rawDemandGB: number       // diskAndSwapGB × FTT-multiplier
  withReserveGB: number     // rawDemandGB × (1 + reservePct/100)
  storageDemandGB: number   // withReserveGB × (1 + growthPct/100)
  storageDemandTiB: number  // storageDemandGB / 1024
  fttMultiplier: number     // for diagnostics / explainers
}

function fttMultiplierFor(storageType: StorageType): number {
  switch (storageType) {
    case 'vsan-esa':
    case 'vsan-max':
      return 1.5    // ESA-class architecture
    case 'fc':
    case 'nfs':
      return 1      // array handles redundancy
  }
}

export function mgmtStorageDemand(inputs: StorageDemandInputs): StorageDemandResult {
  if (inputs.reservePct < 0 || inputs.growthPct < 0) {
    throw new Error('reserve/growth percentages must be ≥ 0')
  }

  const swapGB = inputs.totalRamGB
  const diskAndSwapGB = inputs.totalDiskGB + swapGB

  const fttMultiplier = fttMultiplierFor(inputs.storageType)
  const rawDemandGB = new Decimal(diskAndSwapGB).times(fttMultiplier).toNumber()
  const withReserveGB = new Decimal(rawDemandGB).times(1 + inputs.reservePct / 100).toNumber()
  const storageDemandGB = new Decimal(withReserveGB).times(1 + inputs.growthPct / 100).toNumber()
  const storageDemandTiB = new Decimal(storageDemandGB).div(1024).toNumber()

  return {
    diskAndSwapGB,
    swapGB,
    rawDemandGB,
    withReserveGB,
    storageDemandGB,
    storageDemandTiB,
    fttMultiplier,
  }
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npx vitest run src/engine/mgmt/storage.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Full suite + type-check + build**

```bash
npm run test && npm run type-check && npm run build
```

Expected: 421 + 9 = 430 passing; type-check + build clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/mgmt/storage.ts src/engine/mgmt/storage.test.ts
git commit -m "feat(mgmt): phase 2.2 — mgmtStorageDemand (FTT × reserve × growth)

Storage demand = (disk + swap) × FTT-multiplier × (1 + reserve%) ×
(1 + growth%). vSAN ESA + vSAN Max use ×1.5 (ESA-class
architecture); FC + NFS use ×1 (array handles redundancy). Swap
demand = total RAM (mgmt VM swap files = RAM allocation).

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 step 5"
```

---

## Task 3 — `appliances.ts`: resolve all sized appliances + validated solutions

**Files:**
- Create: `src/engine/mgmt/appliances.ts`
- Create: `src/engine/mgmt/appliances.test.ts`

Walks all 13 user-overridable categories: looks up profile default, merges override, applies HA fanout, multiplies per-node specs by `nodeCount`. Also emits SDDC Manager (always-on, fixed) and Fleet Manager (always-on, fixed). Plus a separate `calcValidatedSolutions(config.validatedSolutions)` helper for the 4 solution toggles.

Returns `ApplianceLine[]` with `source` correctly tagged (`'profile'` if no override; `'override'` if any field was overridden; `'validated-solution'` for the validated-solution lines).

- [ ] **Step 1: Write failing test file `src/engine/mgmt/appliances.test.ts`**

```ts
/// <reference types="vitest/globals" />
import { calcAppliances, calcValidatedSolutions } from './appliances'
import type { ManagementDomainConfig } from './types'

function baseConfig(): ManagementDomainConfig {
  return {
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 8,
    deploymentMode: 'simple',
    profile: 'standard',
    overrides: {},
    validatedSolutions: {
      siteProtection: { included: false },
      ransomwareOnPrem: { included: false },
      ransomwareCloud: { included: false },
      crossCloudMobility: { included: false },
    },
    cpuOversubscription: 2,
    ramOversubscription: 1,
    reservePct: 30,
    growthPct: 10,
    storageType: 'vsan-esa',
  }
}

describe('calcAppliances — Standard profile + Simple mode', () => {
  it('emits SDDC Manager always (4/16/914 × 1)', () => {
    const lines = calcAppliances(baseConfig())
    const sddc = lines.find(l => l.category === 'sddcManager')
    expect(sddc).toBeDefined()
    expect(sddc!.cores).toBe(4)
    expect(sddc!.ramGB).toBe(16)
    expect(sddc!.diskGB).toBe(914)
    expect(sddc!.nodeCount).toBe(1)
    expect(sddc!.totalCores).toBe(4)
  })

  it('emits Fleet Manager always (4/12/194 × 1)', () => {
    const lines = calcAppliances(baseConfig())
    const fm = lines.find(l => l.category === 'fleetManager')
    expect(fm).toBeDefined()
    expect(fm!.cores).toBe(4)
    expect(fm!.ramGB).toBe(12)
    expect(fm!.diskGB).toBe(194)
    expect(fm!.nodeCount).toBe(1)
  })

  it('vCenter Medium × 1 in Simple mode', () => {
    const lines = calcAppliances(baseConfig())
    const vc = lines.find(l => l.category === 'vcenter')
    expect(vc).toBeDefined()
    expect(vc!.cores).toBe(8)         // Medium spec
    expect(vc!.ramGB).toBe(30)
    expect(vc!.diskGB).toBe(908)
    expect(vc!.nodeCount).toBe(1)
    expect(vc!.totalCores).toBe(8)
    expect(vc!.totalRamGB).toBe(30)
    expect(vc!.source).toBe('profile')
  })

  it('NSX Manager Medium × 1 in Simple mode (no HA fanout)', () => {
    const lines = calcAppliances(baseConfig())
    const nsx = lines.find(l => l.category === 'nsxManager')
    expect(nsx).toBeDefined()
    expect(nsx!.nodeCount).toBe(1)     // Simple mode
    expect(nsx!.totalCores).toBe(6)    // Medium spec × 1
    expect(nsx!.totalRamGB).toBe(24)
  })

  it('NSX Edge Large × 2 (always pair, regardless of mode)', () => {
    const lines = calcAppliances(baseConfig())
    const edge = lines.find(l => l.category === 'nsxEdge')
    expect(edge).toBeDefined()
    expect(edge!.nodeCount).toBe(2)
    expect(edge!.totalCores).toBe(16)  // 8 × 2
    expect(edge!.totalRamGB).toBe(64)  // 32 × 2
  })

  it('AVI LB Small × 3 (always cluster, regardless of mode)', () => {
    const lines = calcAppliances(baseConfig())
    const avi = lines.find(l => l.category === 'aviLb')
    expect(avi).toBeDefined()
    expect(avi!.nodeCount).toBe(3)
    expect(avi!.totalCores).toBe(18)   // 6 × 3
    expect(avi!.totalRamGB).toBe(96)   // 32 × 3
  })

  it('vROps Medium × 1 in Simple mode (no HA fanout)', () => {
    const lines = calcAppliances(baseConfig())
    const vrops = lines.find(l => l.category === 'vrops')
    expect(vrops).toBeDefined()
    expect(vrops!.nodeCount).toBe(1)
    expect(vrops!.totalCores).toBe(8)  // Medium × 1
  })

  it('excludes vropsCollector / identityBroker / ssp by default in Standard', () => {
    const lines = calcAppliances(baseConfig())
    expect(lines.find(l => l.category === 'vropsCollector')).toBeUndefined()
    expect(lines.find(l => l.category === 'identityBroker')).toBeUndefined()
    expect(lines.find(l => l.category === 'ssp')).toBeUndefined()
  })

  it('does not emit lines for excluded categories', () => {
    const lines = calcAppliances(baseConfig())
    // Standard profile excludes: vropsCollector, vrniCollector, identityBroker, ssp
    // Standard includes: vcenter, nsxManager, nsxEdge, aviLb, vrops, vrli, vrni, automation, fleetManager
    // Plus always: sddcManager
    // So 9 + 1 = 10 lines
    expect(lines.length).toBe(10)
  })
})

describe('calcAppliances — HA fanout (mode = "ha")', () => {
  it('NSX Manager fans out to nodeCount=3 in HA mode', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const nsx = lines.find(l => l.category === 'nsxManager')!
    expect(nsx.nodeCount).toBe(3)
    expect(nsx.totalCores).toBe(18)   // 6 × 3
    expect(nsx.totalRamGB).toBe(72)   // 24 × 3
  })

  it('vROps fans out to 3 in HA mode', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const vrops = lines.find(l => l.category === 'vrops')!
    expect(vrops.nodeCount).toBe(3)
    expect(vrops.totalCores).toBe(24) // 8 × 3
  })

  it('VCF Automation fans out to 3 in HA mode', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const auto = lines.find(l => l.category === 'automation')!
    expect(auto.nodeCount).toBe(3)
    expect(auto.totalCores).toBe(72)  // 24 × 3
  })

  it('vRLI fans out to 3 in HA mode', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const vrli = lines.find(l => l.category === 'vrli')!
    expect(vrli.nodeCount).toBe(3)
  })

  it('Fleet Manager stays nodeCount=1 in HA (singleton — MGMT-04 invariant)', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const fm = lines.find(l => l.category === 'fleetManager')!
    expect(fm.nodeCount).toBe(1)
  })

  it('Stretch mode behaves like HA for fanout', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'stretch' as const }
    const lines = calcAppliances(cfg)
    const nsx = lines.find(l => l.category === 'nsxManager')!
    expect(nsx.nodeCount).toBe(3)
  })
})

describe('calcAppliances — overrides', () => {
  it('size override changes the spec, source becomes "override"', () => {
    const cfg = baseConfig()
    cfg.overrides = { vcenter: { size: 'large' } }
    const lines = calcAppliances(cfg)
    const vc = lines.find(l => l.category === 'vcenter')!
    expect(vc.cores).toBe(16)         // Large spec
    expect(vc.ramGB).toBe(39)
    expect(vc.diskGB).toBe(1358)
    expect(vc.source).toBe('override')
  })

  it('included=false override removes the appliance line', () => {
    const cfg = baseConfig()
    cfg.overrides = { vrli: { included: false } }
    const lines = calcAppliances(cfg)
    expect(lines.find(l => l.category === 'vrli')).toBeUndefined()
  })

  it('included=true override on a profile-OFF category emits the line', () => {
    const cfg = baseConfig()
    cfg.overrides = { ssp: { included: true, size: 'medium' } }
    const lines = calcAppliances(cfg)
    const ssp = lines.find(l => l.category === 'ssp')
    expect(ssp).toBeDefined()
    expect(ssp!.cores).toBe(112)
    expect(ssp!.source).toBe('override')
  })

  it('nodeCount override: AVI from 3 to 1', () => {
    const cfg = baseConfig()
    cfg.overrides = { aviLb: { nodeCount: 1 } }
    const lines = calcAppliances(cfg)
    const avi = lines.find(l => l.category === 'aviLb')!
    expect(avi.nodeCount).toBe(1)
    expect(avi.totalCores).toBe(6)    // 6 × 1
    expect(avi.source).toBe('override')
  })
})

describe('calcAppliances — Lab profile', () => {
  it('Lab excludes Edge / AVI / vRLI / vRNI', () => {
    const cfg = { ...baseConfig(), profile: 'lab' as const }
    const lines = calcAppliances(cfg)
    expect(lines.find(l => l.category === 'nsxEdge')).toBeUndefined()
    expect(lines.find(l => l.category === 'aviLb')).toBeUndefined()
    expect(lines.find(l => l.category === 'vrli')).toBeUndefined()
    expect(lines.find(l => l.category === 'vrni')).toBeUndefined()
  })

  it('Lab vCenter is Small (not Medium)', () => {
    const cfg = { ...baseConfig(), profile: 'lab' as const }
    const lines = calcAppliances(cfg)
    const vc = lines.find(l => l.category === 'vcenter')!
    expect(vc.cores).toBe(4)          // Small spec
    expect(vc.ramGB).toBe(21)
  })
})

describe('calcValidatedSolutions', () => {
  it('returns empty array when all toggles are false', () => {
    const cfg = baseConfig()
    expect(calcValidatedSolutions(cfg.validatedSolutions, cfg.deploymentMode)).toEqual([])
  })

  it('emits Site Protection / SRM line when enabled', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions.siteProtection = { included: true, mgmtSize: 'standard' }
    const lines = calcValidatedSolutions(cfg.validatedSolutions, cfg.deploymentMode)
    expect(lines.length).toBe(1)
    expect(lines[0].category).toBe('siteRecovery')
    expect(lines[0].cores).toBe(8)    // SRM Standard
    expect(lines[0].ramGB).toBe(24)
    expect(lines[0].diskGB).toBe(800)
    expect(lines[0].source).toBe('validated-solution')
  })

  it('emits multiple lines when multiple solutions enabled', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions.siteProtection = { included: true, mgmtSize: 'standard' }
    cfg.validatedSolutions.crossCloudMobility = { included: true }
    const lines = calcValidatedSolutions(cfg.validatedSolutions, cfg.deploymentMode)
    expect(lines.length).toBe(2)
    const cats = lines.map(l => l.category).sort()
    expect(cats).toEqual(['crossCloudMobility', 'siteRecovery'])
  })

  it('SRM size defaults to "standard" if not specified', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions.siteProtection = { included: true }   // no mgmtSize
    const lines = calcValidatedSolutions(cfg.validatedSolutions, cfg.deploymentMode)
    expect(lines[0].cores).toBe(8)    // Standard
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
npx vitest run src/engine/mgmt/appliances.test.ts
```

Expected: FAIL with "Cannot find module './appliances'".

- [ ] **Step 3: Implement `src/engine/mgmt/appliances.ts`**

```ts
// VCF 9.x Management Domain — appliance resolution
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// Walks all 13 user-overridable categories: profile default → merge override
// → apply HA fanout (×3 for nsxManager/vrops/automation/vrli in HA/Stretch)
// → multiply per-node specs by nodeCount → emit ApplianceLine.
// Always-on: SDDC Manager + Fleet Manager.
// Validated solutions handled by calcValidatedSolutions().
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 steps 1 + 3

import {
  getApplianceSpec,
  SDDC_MANAGER_SPEC,
  FLEET_MANAGER_SPEC,
  VALIDATED_SOLUTIONS_SPECS,
} from './constants'
import { resolveProfileEntry } from './profiles'
import type {
  ManagementDomainConfig,
  ApplianceLine,
  MgmtApplianceCategory,
  ApplianceOverride,
  ProfileEntry,
  ApplianceSpec,
  ValidatedSolutionsConfig,
  SrmSize,
} from './types'
import type { DeploymentMode } from '../types'

const HA_FANOUT_CATEGORIES: ReadonlySet<MgmtApplianceCategory> = new Set<MgmtApplianceCategory>([
  'nsxManager',
  'vrops',
  'automation',
  'vrli',
])

const ALL_CATEGORIES: readonly MgmtApplianceCategory[] = [
  'vcenter', 'nsxManager', 'nsxEdge', 'aviLb',
  'vrops', 'vropsCollector', 'vrli', 'vrni', 'vrniCollector',
  'automation', 'fleetManager', 'identityBroker', 'ssp',
]

function applyHaFanout(
  category: MgmtApplianceCategory,
  baseNodeCount: number,
  mode: DeploymentMode,
): number {
  if (HA_FANOUT_CATEGORIES.has(category) && (mode === 'ha' || mode === 'stretch')) {
    return baseNodeCount * 3
  }
  return baseNodeCount
}

function mergeOverride(base: ProfileEntry, ovr: ApplianceOverride | undefined): ProfileEntry {
  if (!ovr) return base
  return {
    included: ovr.included ?? base.included,
    size: ovr.size ?? base.size,
    nodeCount: ovr.nodeCount ?? base.nodeCount,
  }
}

function buildLine(
  category: ApplianceLine['category'],
  spec: ApplianceSpec,
  nodeCount: number,
  source: ApplianceLine['source'],
): ApplianceLine {
  return {
    category,
    nodeCount,
    cores: spec.cores,
    ramGB: spec.ramGB,
    diskGB: spec.diskGB,
    totalCores: spec.cores * nodeCount,
    totalRamGB: spec.ramGB * nodeCount,
    totalDiskGB: spec.diskGB * nodeCount,
    source,
  }
}

export function calcAppliances(config: ManagementDomainConfig): ApplianceLine[] {
  const profile = config.profile ?? 'standard'
  const mode = config.deploymentMode
  const overrides = config.overrides ?? {}

  const lines: ApplianceLine[] = []

  // Always-on: SDDC Manager
  lines.push(buildLine('sddcManager', SDDC_MANAGER_SPEC, 1, 'profile'))

  // 13 user-overridable categories. Fleet Manager is special (no size variants).
  for (const category of ALL_CATEGORIES) {
    const base = resolveProfileEntry(profile, category)
    const merged = mergeOverride(base, overrides[category])
    if (!merged.included) continue

    const nodeCount = applyHaFanout(category, merged.nodeCount, mode)
    const wasOverridden = overrides[category] !== undefined &&
      Object.keys(overrides[category]!).length > 0

    if (category === 'fleetManager') {
      lines.push(buildLine(category, FLEET_MANAGER_SPEC, nodeCount, wasOverridden ? 'override' : 'profile'))
      continue
    }

    const spec = getApplianceSpec(category, merged.size)
    lines.push(buildLine(category, spec, nodeCount, wasOverridden ? 'override' : 'profile'))
  }

  return lines
}

export function calcValidatedSolutions(
  config: ValidatedSolutionsConfig,
  _mode: DeploymentMode,
): ApplianceLine[] {
  const lines: ApplianceLine[] = []

  if (config.siteProtection.included) {
    const size: SrmSize = config.siteProtection.mgmtSize ?? 'standard'
    const spec = VALIDATED_SOLUTIONS_SPECS.siteProtection[size]
    lines.push(buildLine('siteRecovery', spec, 1, 'validated-solution'))
  }
  if (config.ransomwareOnPrem.included) {
    lines.push(buildLine('ransomwareOnPrem', VALIDATED_SOLUTIONS_SPECS.ransomwareOnPrem, 1, 'validated-solution'))
  }
  if (config.ransomwareCloud.included) {
    lines.push(buildLine('ransomwareCloud', VALIDATED_SOLUTIONS_SPECS.ransomwareCloud, 1, 'validated-solution'))
  }
  if (config.crossCloudMobility.included) {
    lines.push(buildLine('crossCloudMobility', VALIDATED_SOLUTIONS_SPECS.crossCloudMobility, 1, 'validated-solution'))
  }

  return lines
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npx vitest run src/engine/mgmt/appliances.test.ts
```

Expected: all 22 tests PASS.

- [ ] **Step 5: Full suite + type-check + build**

```bash
npm run test && npm run type-check && npm run build
```

Expected: 430 + 22 = 452 passing.

- [ ] **Step 6: Commit**

```bash
git add src/engine/mgmt/appliances.ts src/engine/mgmt/appliances.test.ts
git commit -m "feat(mgmt): phase 2.3 — calcAppliances + calcValidatedSolutions

Resolves all 13 user-overridable appliance categories: profile
default → override merge → HA fanout → ApplianceLine. HA fanout
(×3) applies to nsxManager/vrops/automation/vrli only. SDDC
Manager and Fleet Manager are always-on singletons. Validated
solutions emitted separately by calcValidatedSolutions, tagged
with source='validated-solution' in the result.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 steps 1, 3"
```

---

## Task 4 — `wldOverhead.ts`: auto-derive per-WLD vCenter + NSX overhead

**Files:**
- Create: `src/engine/mgmt/wldOverhead.ts`
- Create: `src/engine/mgmt/wldOverhead.test.ts`

For each `WorkloadDomainConfig`, emits exactly two `ApplianceLine`s tagged `source: 'auto-derived'`: one vCenter (sized via `pickVcenterSize(vmCount, hostCount)`) and one NSX Manager cluster (sized via `pickNsxSize(hostCount)`, with `nodeCount = 1` in `simple` else `3`).

- [ ] **Step 1: Write failing test file `src/engine/mgmt/wldOverhead.test.ts`**

```ts
/// <reference types="vitest/globals" />
import { calcWldOverhead, pickVcenterSize, pickNsxSize } from './wldOverhead'
import type { WorkloadDomainConfig } from '../types'

function wld(overrides: Partial<WorkloadDomainConfig> = {}): WorkloadDomainConfig {
  return {
    id: 'w01',
    name: 'wld-01',
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 8,
    externalStorageUsableTiB: 0,
    hostCount: 4,
    nvmeTieringEnabled: false,
    activeMemoryPct: 50,
    preferredSiteHosts: 4,
    secondarySiteHosts: 4,
    vmCount: 100,
    avgVcpuPerVm: 2,
    avgVramGbPerVm: 4,
    avgStorageGbPerVm: 100,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    gpuVmCount: 0,
    vgpuMemoryGB: 16,
    storageType: 'vsan-esa',
    fttLevel: 1,
    raidType: 'raid5',
    dedupEnabled: false,
    dedupRatio: 1,
    vsanMaxProfile: 'med',
    vsanMaxStorageNodes: 4,
    networkSpeedGbE: 25,
    deploymentMode: 'simple',
    ...overrides,
  }
}

describe('pickVcenterSize — VMware Supported Limits table', () => {
  it('≤ 10 hosts AND ≤ 100 VMs → Tiny', () => {
    expect(pickVcenterSize(100, 10)).toBe('tiny')
  })
  it('≤ 100 hosts AND ≤ 1000 VMs → Small', () => {
    expect(pickVcenterSize(1000, 100)).toBe('small')
  })
  it('≤ 400 hosts AND ≤ 4000 VMs → Medium', () => {
    expect(pickVcenterSize(4000, 400)).toBe('medium')
  })
  it('≤ 1000 hosts AND ≤ 10000 VMs → Large', () => {
    expect(pickVcenterSize(10000, 1000)).toBe('large')
  })
  it('> 1000 hosts OR > 10000 VMs → XLarge', () => {
    expect(pickVcenterSize(10001, 1000)).toBe('xlarge')
    expect(pickVcenterSize(10000, 1001)).toBe('xlarge')
  })
  it('takes the larger required size when host vs VM disagree', () => {
    // 50 hosts (Small), 5000 VMs (Medium) → must satisfy both → Medium
    expect(pickVcenterSize(5000, 50)).toBe('medium')
  })
})

describe('pickNsxSize — NSX Manager support tiers by host count', () => {
  it('≤ 128 hosts → Medium', () => {
    expect(pickNsxSize(128)).toBe('medium')
    expect(pickNsxSize(1)).toBe('medium')
  })
  it('≤ 1024 hosts → Large', () => {
    expect(pickNsxSize(129)).toBe('large')
    expect(pickNsxSize(1024)).toBe('large')
  })
  it('> 1024 hosts → XLarge', () => {
    expect(pickNsxSize(1025)).toBe('xlarge')
  })
})

describe('calcWldOverhead — empty input', () => {
  it('zero WLDs → empty array', () => {
    expect(calcWldOverhead([])).toEqual([])
  })
})

describe('calcWldOverhead — single WLD, default-sized', () => {
  it('emits 1 vCenter Small + 1 NSX Manager Medium (Simple → nodeCount=1)', () => {
    const lines = calcWldOverhead([wld({ hostCount: 4, vmCount: 100, deploymentMode: 'simple' })])
    expect(lines.length).toBe(2)
    const vc = lines.find(l => l.category === 'wldVcenter')
    const nsx = lines.find(l => l.category === 'wldNsxManager')
    expect(vc).toBeDefined()
    expect(nsx).toBeDefined()
    expect(vc!.cores).toBe(2)         // Tiny: 4 hosts ≤ 10 AND 100 VMs ≤ 100
    expect(nsx!.cores).toBe(6)        // Medium NSX
    expect(nsx!.nodeCount).toBe(1)    // Simple
    expect(vc!.source).toBe('auto-derived')
    expect(nsx!.source).toBe('auto-derived')
  })

  it('HA WLD: NSX Manager nodeCount = 3', () => {
    const lines = calcWldOverhead([wld({ deploymentMode: 'ha' })])
    const nsx = lines.find(l => l.category === 'wldNsxManager')!
    expect(nsx.nodeCount).toBe(3)
    expect(nsx.totalCores).toBe(18)   // 6 × 3
  })

  it('Stretch WLD: NSX Manager nodeCount = 3 (same as HA)', () => {
    const lines = calcWldOverhead([wld({ deploymentMode: 'stretch' })])
    const nsx = lines.find(l => l.category === 'wldNsxManager')!
    expect(nsx.nodeCount).toBe(3)
  })
})

describe('calcWldOverhead — multiple WLDs', () => {
  it('5 WLDs → 10 lines (1 vCenter + 1 NSX Manager cluster per WLD)', () => {
    const lines = calcWldOverhead([
      wld({ id: 'w01' }), wld({ id: 'w02' }), wld({ id: 'w03' }),
      wld({ id: 'w04' }), wld({ id: 'w05' }),
    ])
    expect(lines.length).toBe(10)
    expect(lines.filter(l => l.category === 'wldVcenter').length).toBe(5)
    expect(lines.filter(l => l.category === 'wldNsxManager').length).toBe(5)
  })

  it('large WLD: vCenter Medium + NSX Manager Large × 3 in HA', () => {
    const lines = calcWldOverhead([
      wld({ vmCount: 3000, hostCount: 200, deploymentMode: 'ha' }),
    ])
    const vc = lines.find(l => l.category === 'wldVcenter')!
    const nsx = lines.find(l => l.category === 'wldNsxManager')!
    expect(vc.cores).toBe(8)          // Medium
    expect(nsx.cores).toBe(12)        // Large per-node
    expect(nsx.nodeCount).toBe(3)
    expect(nsx.totalCores).toBe(36)
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
npx vitest run src/engine/mgmt/wldOverhead.test.ts
```

Expected: FAIL with "Cannot find module './wldOverhead'".

- [ ] **Step 3: Implement `src/engine/mgmt/wldOverhead.ts`**

```ts
// VCF 9.x Management Domain — workload-domain overhead
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// Each workload domain contributes 1 vCenter + 1 NSX Manager cluster onto
// the management cluster. Sizes auto-derived from VMware's "Supported
// Limits" tables: vCenter sized by max(hostCount, vmCount); NSX Manager
// sized by hostCount. NSX Manager nodeCount = 1 in 'simple' mode, else 3.
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 step 2

import { getApplianceSpec } from './constants'
import type { ApplianceLine, ApplianceSize } from './types'
import type { WorkloadDomainConfig } from '../types'

interface VcenterSizeRow {
  maxHosts: number
  maxVms: number
  size: ApplianceSize
}

const VCENTER_LIMITS: readonly VcenterSizeRow[] = [
  { maxHosts: 10,    maxVms: 100,   size: 'tiny' },
  { maxHosts: 100,   maxVms: 1000,  size: 'small' },
  { maxHosts: 400,   maxVms: 4000,  size: 'medium' },
  { maxHosts: 1000,  maxVms: 10000, size: 'large' },
]

export function pickVcenterSize(vmCount: number, hostCount: number): ApplianceSize {
  for (const row of VCENTER_LIMITS) {
    if (hostCount <= row.maxHosts && vmCount <= row.maxVms) {
      return row.size
    }
  }
  return 'xlarge'
}

export function pickNsxSize(hostCount: number): ApplianceSize {
  if (hostCount <= 128) return 'medium'
  if (hostCount <= 1024) return 'large'
  return 'xlarge'
}

export function calcWldOverhead(wlds: readonly WorkloadDomainConfig[]): ApplianceLine[] {
  const lines: ApplianceLine[] = []

  for (const wld of wlds) {
    // vCenter: always nodeCount=1
    const vcSize = pickVcenterSize(wld.vmCount, wld.hostCount)
    const vcSpec = getApplianceSpec('vcenter', vcSize)
    lines.push({
      category: 'wldVcenter',
      nodeCount: 1,
      cores: vcSpec.cores,
      ramGB: vcSpec.ramGB,
      diskGB: vcSpec.diskGB,
      totalCores: vcSpec.cores,
      totalRamGB: vcSpec.ramGB,
      totalDiskGB: vcSpec.diskGB,
      source: 'auto-derived',
    })

    // NSX Manager: nodeCount = 1 in simple, 3 in HA/Stretch
    const nsxSize = pickNsxSize(wld.hostCount)
    const nsxSpec = getApplianceSpec('nsxManager', nsxSize)
    const nsxNodeCount = wld.deploymentMode === 'simple' ? 1 : 3
    lines.push({
      category: 'wldNsxManager',
      nodeCount: nsxNodeCount,
      cores: nsxSpec.cores,
      ramGB: nsxSpec.ramGB,
      diskGB: nsxSpec.diskGB,
      totalCores: nsxSpec.cores * nsxNodeCount,
      totalRamGB: nsxSpec.ramGB * nsxNodeCount,
      totalDiskGB: nsxSpec.diskGB * nsxNodeCount,
      source: 'auto-derived',
    })
  }

  return lines
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npx vitest run src/engine/mgmt/wldOverhead.test.ts
```

Expected: all 14 tests PASS.

- [ ] **Step 5: Full suite + type-check + build**

```bash
npm run test && npm run type-check && npm run build
```

Expected: 452 + 14 = 466 passing.

- [ ] **Step 6: Commit**

```bash
git add src/engine/mgmt/wldOverhead.ts src/engine/mgmt/wldOverhead.test.ts
git commit -m "feat(mgmt): phase 2.4 — calcWldOverhead (auto-derived per-WLD)

Each WLD adds 1 vCenter + 1 NSX Manager cluster to the management
cluster. vCenter sized via VMware's Supported Limits
(host/VM count); NSX Manager via host count. NSX nodeCount=1 in
simple, 3 in HA/Stretch. Lines tagged source='auto-derived' so
the UI can group them separately from user-configured appliances.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 step 2"
```

---

## Task 5 — `validation.ts`: mgmt-specific validation rules

**Files:**
- Create: `src/engine/mgmt/validation.ts`
- Create: `src/engine/mgmt/validation.test.ts`

Implements the 8 rules from spec §8 — all return `ValidationWarning[]` with `messageKey` strings (no English). Rules check the `(config, result)` pair, so this runs after the appliances + storage + host-math have produced a draft result.

- [ ] **Step 1: Write failing test file `src/engine/mgmt/validation.test.ts`**

```ts
/// <reference types="vitest/globals" />
import { validateMgmt } from './validation'
import type { ManagementDomainConfig, MgmtDomainResult, ApplianceLine } from './types'

function baseConfig(): ManagementDomainConfig {
  return {
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 8,
    deploymentMode: 'simple',
    profile: 'standard',
    overrides: {},
    validatedSolutions: {
      siteProtection: { included: false },
      ransomwareOnPrem: { included: false },
      ransomwareCloud: { included: false },
      crossCloudMobility: { included: false },
    },
    cpuOversubscription: 2,
    ramOversubscription: 1,
    reservePct: 30,
    growthPct: 10,
    storageType: 'vsan-esa',
  }
}

function baseResult(overrides: Partial<MgmtDomainResult> = {}): MgmtDomainResult {
  return {
    appliances: [],
    wldOverhead: [],
    totalCores: 50,
    totalRamGB: 200,
    totalDiskGB: 1000,
    totalSwapGB: 200,
    perHostCores: 0,
    perHostRamGB: 0,
    perHostStorageGB: 0,
    storageDemandTiB: 0,
    minHostsForStorage: 0,
    externalPoolRequiredTiB: 0,
    recommendedHostCount: 4,
    validationWarnings: [],
    ...overrides,
  }
}

function appliance(category: string, nodeCount: number): ApplianceLine {
  return {
    category: category as ApplianceLine['category'],
    nodeCount, cores: 1, ramGB: 1, diskGB: 0,
    totalCores: nodeCount, totalRamGB: nodeCount, totalDiskGB: 0,
    source: 'profile',
  }
}

describe('validateMgmt — MGMT-EDGE-PAIR (warning)', () => {
  it('flags when nsxEdge included with nodeCount < 2', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('nsxEdge', 1)] })
    const warns = validateMgmt(cfg, result)
    expect(warns.find(w => w.code === 'MGMT-EDGE-PAIR')).toMatchObject({
      severity: 'warning',
      messageKey: 'validation.mgmt.edgePairRequired',
    })
  })

  it('does not flag when nsxEdge nodeCount >= 2', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('nsxEdge', 2)] })
    const warns = validateMgmt(cfg, result)
    expect(warns.find(w => w.code === 'MGMT-EDGE-PAIR')).toBeUndefined()
  })

  it('does not flag when nsxEdge is excluded', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [] })
    const warns = validateMgmt(cfg, result)
    expect(warns.find(w => w.code === 'MGMT-EDGE-PAIR')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-AVI-CLUSTER (warning)', () => {
  it('flags when aviLb nodeCount < 3', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('aviLb', 2)] })
    const warns = validateMgmt(cfg, result)
    expect(warns.find(w => w.code === 'MGMT-AVI-CLUSTER')).toMatchObject({
      severity: 'warning',
      messageKey: 'validation.mgmt.aviClusterRequired',
    })
  })

  it('does not flag when aviLb nodeCount = 3', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('aviLb', 3)] })
    expect(validateMgmt(cfg, result).find(w => w.code === 'MGMT-AVI-CLUSTER')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-SSP-HOSTS (error)', () => {
  it('errors when ssp included and recommendedHostCount < 8', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('ssp', 1)], recommendedHostCount: 4 })
    const warns = validateMgmt(cfg, result)
    expect(warns.find(w => w.code === 'MGMT-SSP-HOSTS')).toMatchObject({
      severity: 'error',
      messageKey: 'validation.mgmt.sspMinHosts',
    })
  })

  it('does not error when ssp included and recommendedHostCount >= 8', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('ssp', 1)], recommendedHostCount: 8 })
    expect(validateMgmt(cfg, result).find(w => w.code === 'MGMT-SSP-HOSTS')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-OVERSUB-RANGE (warning)', () => {
  it('flags when cpuOversubscription > 4', () => {
    const cfg = { ...baseConfig(), cpuOversubscription: 5 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-OVERSUB-RANGE'))
      .toMatchObject({ severity: 'warning' })
  })

  it('flags when ramOversubscription > 1.5', () => {
    const cfg = { ...baseConfig(), ramOversubscription: 2 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-OVERSUB-RANGE'))
      .toMatchObject({ severity: 'warning' })
  })

  it('does not flag default 2:1 / 1:1', () => {
    const cfg = baseConfig()
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-OVERSUB-RANGE')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-RESERVE-RANGE (warning)', () => {
  it('flags reservePct < 15', () => {
    const cfg = { ...baseConfig(), reservePct: 10 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-RESERVE-RANGE'))
      .toMatchObject({ severity: 'warning' })
  })

  it('flags reservePct > 50', () => {
    const cfg = { ...baseConfig(), reservePct: 60 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-RESERVE-RANGE'))
      .toMatchObject({ severity: 'warning' })
  })

  it('does not flag reservePct in range [15, 50]', () => {
    expect(validateMgmt({ ...baseConfig(), reservePct: 30 }, baseResult())
      .find(w => w.code === 'MGMT-RESERVE-RANGE')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-FC-NEEDS-POOL (error)', () => {
  it('errors when storageType is fc and externalStorageUsableTiB is undefined', () => {
    const cfg = { ...baseConfig(), storageType: 'fc' as const, externalStorageUsableTiB: undefined }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-FC-NEEDS-POOL'))
      .toMatchObject({ severity: 'error', messageKey: 'validation.mgmt.externalPoolRequired' })
  })

  it('errors when storageType is nfs and externalStorageUsableTiB is undefined', () => {
    const cfg = { ...baseConfig(), storageType: 'nfs' as const, externalStorageUsableTiB: undefined }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-FC-NEEDS-POOL'))
      .toMatchObject({ severity: 'error' })
  })

  it('does not error when fc/nfs and externalStorageUsableTiB is provided', () => {
    const cfg = { ...baseConfig(), storageType: 'fc' as const, externalStorageUsableTiB: 10 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-FC-NEEDS-POOL')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-VSANMAX-NODES (error)', () => {
  it('errors when vsan-max and storage nodes < 4', () => {
    const cfg = { ...baseConfig(), storageType: 'vsan-max' as const, vsanMaxStorageNodes: 3 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-VSANMAX-NODES'))
      .toMatchObject({ severity: 'error' })
  })

  it('does not error when vsan-max and >= 4 nodes', () => {
    const cfg = { ...baseConfig(), storageType: 'vsan-max' as const, vsanMaxStorageNodes: 4 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-VSANMAX-NODES')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-VALIDATED-COUNT (warning)', () => {
  it('flags when ≥ 3 validated solutions enabled', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions.siteProtection.included = true
    cfg.validatedSolutions.ransomwareOnPrem.included = true
    cfg.validatedSolutions.crossCloudMobility.included = true
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-VALIDATED-COUNT'))
      .toMatchObject({ severity: 'warning' })
  })

  it('does not flag when 2 enabled', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions.siteProtection.included = true
    cfg.validatedSolutions.crossCloudMobility.included = true
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-VALIDATED-COUNT')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
npx vitest run src/engine/mgmt/validation.test.ts
```

Expected: FAIL with "Cannot find module './validation'".

- [ ] **Step 3: Implement `src/engine/mgmt/validation.ts`**

```ts
// VCF 9.x Management Domain — validation rules
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All messages use i18n keys, NEVER raw English (project convention)
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §8

import type { ManagementDomainConfig, MgmtDomainResult } from './types'
import type { ValidationWarning } from '../types'

export function validateMgmt(
  config: ManagementDomainConfig,
  result: MgmtDomainResult,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // MGMT-EDGE-PAIR
  const edge = result.appliances.find(l => l.category === 'nsxEdge')
  if (edge && edge.nodeCount < 2) {
    warnings.push({
      code: 'MGMT-EDGE-PAIR',
      severity: 'warning',
      messageKey: 'validation.mgmt.edgePairRequired',
    })
  }

  // MGMT-AVI-CLUSTER
  const avi = result.appliances.find(l => l.category === 'aviLb')
  if (avi && avi.nodeCount < 3) {
    warnings.push({
      code: 'MGMT-AVI-CLUSTER',
      severity: 'warning',
      messageKey: 'validation.mgmt.aviClusterRequired',
    })
  }

  // MGMT-SSP-HOSTS
  const ssp = result.appliances.find(l => l.category === 'ssp')
  if (ssp && result.recommendedHostCount < 8) {
    warnings.push({
      code: 'MGMT-SSP-HOSTS',
      severity: 'error',
      messageKey: 'validation.mgmt.sspMinHosts',
    })
  }

  // MGMT-OVERSUB-RANGE
  const cpuOver = config.cpuOversubscription ?? 2
  const ramOver = config.ramOversubscription ?? 1
  if (cpuOver > 4 || ramOver > 1.5) {
    warnings.push({
      code: 'MGMT-OVERSUB-RANGE',
      severity: 'warning',
      messageKey: 'validation.mgmt.oversubAggressive',
    })
  }

  // MGMT-RESERVE-RANGE
  const reserve = config.reservePct ?? 30
  if (reserve < 15 || reserve > 50) {
    warnings.push({
      code: 'MGMT-RESERVE-RANGE',
      severity: 'warning',
      messageKey: 'validation.mgmt.reserveOutOfRange',
    })
  }

  // MGMT-FC-NEEDS-POOL
  if ((config.storageType === 'fc' || config.storageType === 'nfs') &&
      config.externalStorageUsableTiB === undefined) {
    warnings.push({
      code: 'MGMT-FC-NEEDS-POOL',
      severity: 'error',
      messageKey: 'validation.mgmt.externalPoolRequired',
    })
  }

  // MGMT-VSANMAX-NODES
  if (config.storageType === 'vsan-max' &&
      (config.vsanMaxStorageNodes ?? 0) < 4) {
    warnings.push({
      code: 'MGMT-VSANMAX-NODES',
      severity: 'error',
      messageKey: 'validation.mgmt.vsanMaxMinNodes',
    })
  }

  // MGMT-VALIDATED-COUNT
  const vs = config.validatedSolutions
  const enabledCount = vs ? [
    vs.siteProtection.included,
    vs.ransomwareOnPrem.included,
    vs.ransomwareCloud.included,
    vs.crossCloudMobility.included,
  ].filter(Boolean).length : 0
  if (enabledCount >= 3) {
    warnings.push({
      code: 'MGMT-VALIDATED-COUNT',
      severity: 'warning',
      messageKey: 'validation.mgmt.validatedSolutionsHeavy',
    })
  }

  return warnings
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npx vitest run src/engine/mgmt/validation.test.ts
```

Expected: all 19 tests PASS.

- [ ] **Step 5: Full suite + type-check + build**

```bash
npm run test && npm run type-check && npm run build
```

Expected: 466 + 19 = 485 passing.

- [ ] **Step 6: Commit**

```bash
git add src/engine/mgmt/validation.ts src/engine/mgmt/validation.test.ts
git commit -m "feat(mgmt): phase 2.5 — validateMgmt (8 rules)

Implements the 8 validation rules from spec §8: MGMT-EDGE-PAIR
(warn <2 edge nodes), MGMT-AVI-CLUSTER (warn <3 avi nodes),
MGMT-SSP-HOSTS (err if SSP and <8 hosts), MGMT-OVERSUB-RANGE
(warn aggressive cpu/ram oversub), MGMT-RESERVE-RANGE (warn
<15% or >50%), MGMT-FC-NEEDS-POOL (err if fc/nfs without
externalStorageUsableTiB), MGMT-VSANMAX-NODES (err if vsan-max
<4 storage nodes), MGMT-VALIDATED-COUNT (warn ≥3 solutions
enabled). All messages use i18n keys.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §8"
```

---

## Task 6 — Orchestrator: `calcManagementFull` in `mgmt/index.ts`

**Files:**
- Modify: `src/engine/mgmt/index.ts` (add the orchestrator alongside the existing barrel re-exports)
- Create: `src/engine/mgmt/index.test.ts` (integration tests for the orchestrator)

The orchestrator runs the full pipeline end-to-end. It also computes `recommendedHostCount` (the missing top-level math, since `perHostRequirements` returns `minHostsForCpu`/`minHostsForRam` and `mgmtStorageDemand` returns demand TiB — the orchestrator combines these with `calcMinHostsForVsanEsa` from the existing storage engine and the deployment floor).

- [ ] **Step 1: Write failing test file `src/engine/mgmt/index.test.ts`**

```ts
/// <reference types="vitest/globals" />
import { calcManagementFull } from './index'
import type { ManagementDomainConfig } from './types'
import type { WorkloadDomainConfig } from '../types'

function baseConfig(): ManagementDomainConfig {
  return {
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 8,
    deploymentMode: 'simple',
    profile: 'standard',
    overrides: {},
    validatedSolutions: {
      siteProtection: { included: false },
      ransomwareOnPrem: { included: false },
      ransomwareCloud: { included: false },
      crossCloudMobility: { included: false },
    },
    cpuOversubscription: 2,
    ramOversubscription: 1,
    reservePct: 30,
    growthPct: 10,
    storageType: 'vsan-esa',
  }
}

describe('calcManagementFull — Standard / Simple / vSAN-ESA / no WLDs', () => {
  it('produces non-empty appliances array with SDDC + Fleet + Standard set', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.appliances.length).toBeGreaterThan(5)
    expect(r.appliances.find(l => l.category === 'sddcManager')).toBeDefined()
    expect(r.appliances.find(l => l.category === 'fleetManager')).toBeDefined()
  })

  it('wldOverhead empty when no WLDs', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.wldOverhead).toEqual([])
  })

  it('totals = sum of all appliance lines + wldOverhead lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    const expectedCores = r.appliances.reduce((s, l) => s + l.totalCores, 0)
    const expectedRam = r.appliances.reduce((s, l) => s + l.totalRamGB, 0)
    const expectedDisk = r.appliances.reduce((s, l) => s + l.totalDiskGB, 0)
    expect(r.totalCores).toBe(expectedCores)
    expect(r.totalRamGB).toBe(expectedRam)
    expect(r.totalDiskGB).toBe(expectedDisk)
  })

  it('totalSwapGB = totalRamGB', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.totalSwapGB).toBe(r.totalRamGB)
  })

  it('per-host metrics are non-zero for vSAN-ESA', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.perHostCores).toBeGreaterThan(0)
    expect(r.perHostRamGB).toBeGreaterThan(0)
    expect(r.perHostStorageGB).toBeGreaterThan(0)
    expect(r.externalPoolRequiredTiB).toBe(0)
  })

  it('recommendedHostCount respects the simple/HA floor of 4', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.recommendedHostCount).toBeGreaterThanOrEqual(4)
  })

  it('validationWarnings include no errors for a clean Standard config', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.validationWarnings.filter(w => w.severity === 'error')).toEqual([])
  })
})

describe('calcManagementFull — FC routing', () => {
  it('FC config: per-host storage = 0; externalPoolRequiredTiB > 0', () => {
    const cfg = { ...baseConfig(), storageType: 'fc' as const, externalStorageUsableTiB: 10 }
    const r = calcManagementFull(cfg, [])
    expect(r.perHostStorageGB).toBe(0)
    expect(r.externalPoolRequiredTiB).toBeGreaterThan(0)
    expect(r.minHostsForStorage).toBe(0)
  })

  it('FC without externalStorageUsableTiB raises MGMT-FC-NEEDS-POOL error', () => {
    const cfg = { ...baseConfig(), storageType: 'fc' as const, externalStorageUsableTiB: undefined }
    const r = calcManagementFull(cfg, [])
    expect(r.validationWarnings.find(w => w.code === 'MGMT-FC-NEEDS-POOL')).toBeDefined()
  })
})

describe('calcManagementFull — Stretch deployment floor of 8', () => {
  it('stretch mode: recommendedHostCount ≥ 8', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'stretch' as const }
    const r = calcManagementFull(cfg, [])
    expect(r.recommendedHostCount).toBeGreaterThanOrEqual(8)
  })
})

describe('calcManagementFull — WLD overhead routing', () => {
  function wld(overrides: Partial<WorkloadDomainConfig> = {}): WorkloadDomainConfig {
    return {
      id: 'w01', name: 'wld-01', coresPerSocket: 32, socketsPerHost: 2,
      hostRamGB: 512, hostStorageTiB: 8, externalStorageUsableTiB: 0,
      hostCount: 4, nvmeTieringEnabled: false, activeMemoryPct: 50,
      preferredSiteHosts: 4, secondarySiteHosts: 4,
      vmCount: 100, avgVcpuPerVm: 2, avgVramGbPerVm: 4, avgStorageGbPerVm: 100,
      cpuOvercommitRatio: 4, ramOvercommitRatio: 1,
      gpuVmCount: 0, vgpuMemoryGB: 16,
      storageType: 'vsan-esa', fttLevel: 1, raidType: 'raid5',
      dedupEnabled: false, dedupRatio: 1,
      vsanMaxProfile: 'med', vsanMaxStorageNodes: 4,
      networkSpeedGbE: 25, deploymentMode: 'simple',
      ...overrides,
    }
  }

  it('1 WLD adds 2 lines to wldOverhead and contributes to totals', () => {
    const without = calcManagementFull(baseConfig(), [])
    const withOne = calcManagementFull(baseConfig(), [wld()])
    expect(withOne.wldOverhead.length).toBe(2)
    expect(withOne.totalCores).toBeGreaterThan(without.totalCores)
  })

  it('5 WLDs add 10 lines', () => {
    const wlds = [wld({ id: 'w01' }), wld({ id: 'w02' }), wld({ id: 'w03' }), wld({ id: 'w04' }), wld({ id: 'w05' })]
    const r = calcManagementFull(baseConfig(), wlds)
    expect(r.wldOverhead.length).toBe(10)
  })
})

describe('calcManagementFull — validated solutions', () => {
  it('enabling siteProtection adds an appliance line with source=validated-solution', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions.siteProtection = { included: true, mgmtSize: 'standard' }
    const r = calcManagementFull(cfg, [])
    const sr = r.appliances.find(l => l.category === 'siteRecovery')
    expect(sr).toBeDefined()
    expect(sr!.source).toBe('validated-solution')
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
npx vitest run src/engine/mgmt/index.test.ts
```

Expected: FAIL with "calcManagementFull is not exported from './index'" (or similar — the function doesn't exist yet).

- [ ] **Step 3: Implement the orchestrator in `src/engine/mgmt/index.ts`**

Replace the current contents of `src/engine/mgmt/index.ts` with:

```ts
// VCF 9.x Management Domain — public barrel + orchestrator
//
// P1 surface: types + sizing tables + profiles.
// P2 surface (this commit): adds calcManagementFull(config, wlds) — the
// full pipeline that consumes profiles + constants + appliances/storage/
// host-math/validation modules to produce a complete MgmtDomainResult.
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5

export type {
  MgmtProfile,
  ApplianceSize,
  NsxEdgeSize,
  SspSize,
  SrmSize,
  CollectorSize,
  AnyApplianceSize,
  MgmtApplianceCategory,
  AutoApplianceCategory,
  ApplianceLineCategory,
  ApplianceSpec,
  ProfileEntry,
  ApplianceOverride,
  ValidatedSolutionsConfig,
  ManagementDomainConfig,
  ApplianceLine,
  MgmtDomainResult,
} from './types'

export {
  getApplianceSpec,
  SDDC_MANAGER_SPEC,
  FLEET_MANAGER_SPEC,
  VALIDATED_SOLUTIONS_SPECS,
} from './constants'

export {
  PROFILES,
  resolveProfileEntry,
} from './profiles'

// ─── Orchestrator (P2) ────────────────────────────────────────────────────

import { calcAppliances, calcValidatedSolutions } from './appliances'
import { calcWldOverhead } from './wldOverhead'
import { mgmtStorageDemand } from './storage'
import { perHostRequirements } from './hostMath'
import { validateMgmt } from './validation'
import { calcMinHostsForVsanEsa } from '../storage'
import type { ManagementDomainConfig, MgmtDomainResult } from './types'
import type { WorkloadDomainConfig } from '../types'

const DEPLOYMENT_FLOOR = { simple: 4, ha: 4, stretch: 8 } as const

/**
 * Run the full management-domain calculation pipeline.
 *
 * Steps (per spec §5):
 *   1-3. Resolve appliances (profile + overrides + HA fanout) + WLD overhead
 *        + validated solutions.
 *   4.   Sum totals (cores, RAM, disk).
 *   5.   Compute storage demand (FTT × reserve × growth).
 *   6.   Compute per-host requirements (N-1 model, dual oversubscription).
 *   7.   Compute recommendedHostCount = max(minHostsCpu, minHostsRam,
 *        minHostsStorage, deploymentFloor).
 *   8.   Run validation rules; attach warnings.
 */
export function calcManagementFull(
  config: ManagementDomainConfig,
  wlds: readonly WorkloadDomainConfig[],
): MgmtDomainResult {
  // Step 1-3: appliance resolution
  const baseAppliances = calcAppliances(config)
  const validatedLines = calcValidatedSolutions(
    config.validatedSolutions ?? {
      siteProtection: { included: false },
      ransomwareOnPrem: { included: false },
      ransomwareCloud: { included: false },
      crossCloudMobility: { included: false },
    },
    config.deploymentMode,
  )
  const appliances = [...baseAppliances, ...validatedLines]
  const wldOverhead = calcWldOverhead(wlds)

  // Step 4: totals
  const allLines = [...appliances, ...wldOverhead]
  const totalCores = allLines.reduce((s, l) => s + l.totalCores, 0)
  const totalRamGB = allLines.reduce((s, l) => s + l.totalRamGB, 0)
  const totalDiskGB = allLines.reduce((s, l) => s + l.totalDiskGB, 0)
  const totalSwapGB = totalRamGB

  // Step 5: storage demand
  const storage = mgmtStorageDemand({
    totalDiskGB,
    totalRamGB,
    storageType: config.storageType ?? 'vsan-esa',
    reservePct: config.reservePct ?? 30,
    growthPct: config.growthPct ?? 10,
  })

  // Step 6: per-host requirements
  const coresPerHost = config.coresPerSocket * config.socketsPerHost
  const ramPerHost = config.hostRamGB
  const perHost = perHostRequirements({
    totalCores,
    totalRamGB,
    storageDemandGB: storage.storageDemandGB,
    storageDemandTiB: storage.storageDemandTiB,
    hosts: 4,   // floor; recomputed in step 7
    cpuOversubscription: config.cpuOversubscription ?? 2,
    ramOversubscription: config.ramOversubscription ?? 1,
    storageType: config.storageType ?? 'vsan-esa',
    coresPerHost,
    ramPerHost,
  })

  // Step 7: recommendedHostCount
  let minHostsForStorage = 0
  if ((config.storageType ?? 'vsan-esa') === 'vsan-esa') {
    minHostsForStorage = calcMinHostsForVsanEsa(
      config.hostStorageTiB,
      1,             // FTT level — mgmt domain default; future: read from config if added
      'raid5',       // RAID type — mgmt domain default
      false,         // dedup — mgmt domain default
      1,             // dedupRatio — mgmt domain default
      config.deploymentMode,
      storage.storageDemandTiB,
    )
  }
  const floor = DEPLOYMENT_FLOOR[config.deploymentMode]
  const recommendedHostCount = Math.max(
    perHost.minHostsForCpu,
    perHost.minHostsForRam,
    minHostsForStorage,
    floor,
  )

  // Recompute per-host using the actual recommended host count
  const perHostFinal = perHostRequirements({
    totalCores,
    totalRamGB,
    storageDemandGB: storage.storageDemandGB,
    storageDemandTiB: storage.storageDemandTiB,
    hosts: recommendedHostCount,
    cpuOversubscription: config.cpuOversubscription ?? 2,
    ramOversubscription: config.ramOversubscription ?? 1,
    storageType: config.storageType ?? 'vsan-esa',
  })

  // Build draft result, run validation
  const draft: MgmtDomainResult = {
    appliances,
    wldOverhead,
    totalCores,
    totalRamGB,
    totalDiskGB,
    totalSwapGB,
    perHostCores: perHostFinal.perHostCores,
    perHostRamGB: perHostFinal.perHostRamGB,
    perHostStorageGB: perHostFinal.perHostStorageGB,
    storageDemandTiB: storage.storageDemandTiB,
    minHostsForStorage,
    externalPoolRequiredTiB: perHostFinal.externalPoolRequiredTiB,
    recommendedHostCount,
    validationWarnings: [],
  }

  return {
    ...draft,
    validationWarnings: validateMgmt(config, draft),
  }
}
```

- [ ] **Step 4: Run integration test, confirm pass**

```bash
npx vitest run src/engine/mgmt/index.test.ts
```

Expected: all 13 tests PASS.

- [ ] **Step 5: Full suite + type-check + build**

```bash
npm run test && npm run type-check && npm run build
```

Expected: 485 + 13 = 498 passing.

- [ ] **Step 6: Commit**

```bash
git add src/engine/mgmt/index.ts src/engine/mgmt/index.test.ts
git commit -m "feat(mgmt): phase 2.6 — calcManagementFull orchestrator

Wires the full P2 pipeline: appliance resolution + WLD overhead
+ validated solutions → totals → storage demand → per-host (N-1)
→ recommendedHostCount (max of CPU/RAM/storage min + deployment
floor) → validation. Returns a complete MgmtDomainResult.

Storage routing:
- vSAN-ESA: per-host disk + minHostsForStorage via existing
  calcMinHostsForVsanEsa helper (RAID-5 adaptive boundary at 6
  hosts is preserved).
- vSAN-Max: zero local storage (compute hosts only); demand flows
  to disaggregated cluster (sized separately, not in this phase).
- FC/NFS: per-host = 0; externalPoolRequiredTiB = full demand.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5"
```

---

## Task 7 — Refactor `engine/management.ts` legacy shim

**Files:**
- Modify: `src/engine/management.ts`

The current `calcManagement(mode)` returns the merged shape with placeholder zeros for new fields. After Task 6, the new orchestrator can populate every field correctly. Refactor the legacy shim to be a one-liner that builds a default config from the legacy `mode` argument and delegates to `calcManagementFull`.

This still preserves the legacy flat fields (`vcenterCores`, `sddcCores`, etc.) on the result for `usePptxExport.ts` consumers — those are computed from the new `appliances` array.

- [ ] **Step 1: Read the existing test file `src/engine/management.test.ts`**

The current tests exercise specific values returned by `calcManagement(mode)`:
- Simple: vcenter 4/21, sddc 4/16, nsx 6/24, ops total 12/44, automation 24/96 → totals 50/201.
- HA: nsx 18/72, ops 20/76, automation 72/288 → totals 118/473.

These tests cover the LEGACY behavior. The refactor must preserve them — the legacy shim's totals must match. The current test value `vcenter 4/21` corresponds to `Small` profile in our new constants (vCenter Small = 4/21/694). So the legacy mode → config mapping should use `profile: 'lab'` for both Simple and HA (since Lab is the only profile where vCenter is Small AND the existing tests pin to that value).

But `Lab` profile excludes vRLI, AVI, NSX Edge, etc. — none of which appear in the legacy result. Good.

However the HA test expects ops total = 12+4+4 = 20 cores (vROps small ×3 = 12, plus Fleet=4, plus Collector=4). In Lab profile, Collector is excluded — so the new calc would give ops = vROps×3 + Fleet = 12+4 = 16, NOT 20.

To preserve legacy test values exactly, the shim needs a **special-case config** that mirrors the legacy hardcoded values rather than any of our profiles. Build a synthetic config:

- vcenter included Small (4/21)
- sddc — always included by orchestrator (4/16) ✓
- nsx Manager included Medium (6/24) — fanout ×3 in HA
- vROps included Small (4/16) — fanout ×3 in HA → 12/48 (matches 'OPS scales with HA' from legacy)
- Fleet always-on (4/12) ✓
- Collector — legacy code has it as 4/16 always-on singleton. New constants have vROps Collector Small (4/16/264) and Standard (8/48/264). Use Small for backward compat. **Force-include via override** (Lab profile excludes it).
- Automation included Small per spec — but legacy 24/96 matches BOTH Small and Medium in our constants (Automation Small = 24/96/455, Medium = 24/96/334; identical cores+RAM, only disk differs). Either is fine for cores/RAM.
- Edge / AVI / vRLI / vRNI / Identity Broker / SSP — all excluded in legacy.

Build the shim with overrides for Collector inclusion, and assert legacy test values still pass.

- [ ] **Step 2: Replace the existing `src/engine/management.ts` body**

Open `src/engine/management.ts` and replace its contents with:

```ts
// VCF 9.x Management Domain — legacy shim
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// This file maintains the legacy `calcManagement(mode: DeploymentMode)` API
// for callers that haven't migrated to `calcManagementFull(config, wlds)`.
// It builds a synthetic ManagementDomainConfig that reproduces the historical
// component set (vCenter Small, NSX Mgr Medium, vROps Small + Fleet + Collector,
// Automation Small) and delegates to the orchestrator.
//
// Migration plan: as P3 wires stores onto calcManagementFull directly, this
// shim becomes dead code and is deleted. The legacy flat fields on the result
// (vcenterCores, sddcCores, etc.) are populated from the new `appliances`
// array so usePptxExport.ts continues to compile during the transition.

import { calcManagementFull } from './mgmt'
import type { DeploymentMode, MgmtDomainResult } from './types'
import type { ManagementDomainConfig, ApplianceLine } from './mgmt/types'

function buildLegacyConfig(mode: DeploymentMode): ManagementDomainConfig {
  return {
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 8,
    deploymentMode: mode,
    profile: 'lab',          // closest match: Small vCenter / NSX Mgr Medium / vROps Small / Auto Small
    overrides: {
      // Legacy MGMT-04 invariant: vROps Collector is always included as a Small singleton.
      vropsCollector: { included: true, size: 'small', nodeCount: 1 },
      // Legacy default included NSX Manager (Lab profile already includes it,
      // but force size='medium' since constants.ts has no NSX 'small' size).
      nsxManager: { size: 'medium' },
    },
    validatedSolutions: {
      siteProtection: { included: false },
      ransomwareOnPrem: { included: false },
      ransomwareCloud: { included: false },
      crossCloudMobility: { included: false },
    },
    cpuOversubscription: 2,
    ramOversubscription: 1,
    reservePct: 30,
    growthPct: 10,
    storageType: 'vsan-esa',
  }
}

function sumByCategory(lines: ApplianceLine[], categories: string[]): { cores: number; ramGB: number } {
  const matching = lines.filter(l => categories.includes(l.category))
  return {
    cores: matching.reduce((s, l) => s + l.totalCores, 0),
    ramGB: matching.reduce((s, l) => s + l.totalRamGB, 0),
  }
}

export function calcManagement(mode: DeploymentMode): MgmtDomainResult {
  const result = calcManagementFull(buildLegacyConfig(mode), [])

  // Populate legacy flat fields from the new appliances array so existing
  // consumers (usePptxExport.ts) keep working unchanged.
  const vcenter = sumByCategory(result.appliances, ['vcenter'])
  const sddc = sumByCategory(result.appliances, ['sddcManager'])
  const nsx = sumByCategory(result.appliances, ['nsxManager'])
  const ops = sumByCategory(result.appliances, ['vrops', 'vropsCollector', 'fleetManager'])
  const automation = sumByCategory(result.appliances, ['automation'])

  return {
    ...result,
    vcenterCores: vcenter.cores,
    vcenterRamGB: vcenter.ramGB,
    sddcCores: sddc.cores,
    sddcRamGB: sddc.ramGB,
    nsxCores: nsx.cores,
    nsxRamGB: nsx.ramGB,
    opsCores: ops.cores,
    opsRamGB: ops.ramGB,
    automationCores: automation.cores,
    automationRamGB: automation.ramGB,
  }
}
```

- [ ] **Step 3: Run the existing test, expect it to pass**

```bash
npx vitest run src/engine/management.test.ts
```

Expected: all existing tests still pass — the legacy values are preserved.

If tests fail, the most likely cause is a value-mismatch in the legacy config. Inspect the failure carefully:
- "Expected vcenterCores: 4, got 8" → vCenter is being sized as Medium (Standard) instead of Small (Lab); double-check `profile: 'lab'`.
- "Expected opsCores: 12, got 16" (Simple mode) → Lab Profile excludes Collector, but the override should re-include it. Check the override is applied.
- "Expected nsxCores: 18, got 0" → NSX Manager size mismatch; constants.ts has no `small` size for nsxManager. The override `size: 'medium'` is required.

If you cannot reconcile a legacy test value, **STOP and report `BLOCKED`** with the specific value mismatch. Do NOT modify the legacy test file to make it pass — that defeats the purpose.

- [ ] **Step 4: Full suite + type-check + build**

```bash
npm run test && npm run type-check && npm run build
```

Expected: 498 + 0 = 498 passing (no new tests; existing management.test.ts continues to pass).

The deprecation warnings on `usePptxExport.ts` reading legacy flat fields are still expected and intentional — they're the migration target marker.

- [ ] **Step 5: Commit**

```bash
git add src/engine/management.ts
git commit -m "refactor(mgmt): phase 2.7 — legacy calcManagement shim wraps calcManagementFull

The legacy calcManagement(mode) function was returning the merged
MgmtDomainResult shape with placeholder zeros for new fields. Now
that calcManagementFull is available, the shim builds a synthetic
ManagementDomainConfig that reproduces the legacy component set
(Lab profile + vropsCollector force-included + nsxManager forced
to medium since the workbook has no 'small' NSX size) and
delegates to the orchestrator.

Legacy flat fields (vcenterCores, sddcCores, nsxCores, opsCores,
automationCores + matching RAM) are populated by summing the new
appliances array by category — usePptxExport.ts continues to
compile unchanged via the @deprecated optional fields.

All existing management.test.ts assertions still pass.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §3 backward-compat shim"
```

---

## Phase 2 — Acceptance criteria

After all 7 tasks complete:

- `src/engine/mgmt/{hostMath,storage,appliances,wldOverhead,validation}.ts` exist + their `.test.ts` files.
- `src/engine/mgmt/index.ts` exports `calcManagementFull(config, wlds)` alongside the existing barrel re-exports.
- `src/engine/management.ts` is refactored to delegate to `calcManagementFull` while preserving the legacy `calcManagement(mode)` API and legacy flat fields on the result.
- `npm run test` is green (~498 tests; ≈ +86 from P1).
- `npm run type-check` clean.
- `npm run build` clean.
- Git log shows 7 atomic commits, one per task.
- **Existing tests** (`management.test.ts`) **still pass without modification** — legacy callers see the same values.
- **No callsite changes** in `inputStore`, `calculationStore`, or components beyond the P1.1 review fixes already in place.

This phase produces no user-visible UI change. The orchestrator is callable from store/UI layers but no caller exists yet. P3 is the layer that wires `calculationStore` onto `calcManagementFull` and updates the URL Zod schema.

---

## Notes for the implementer

- **`Decimal.js` is critical** — every multiplication, division, or addition that crosses GB↔TiB boundaries or applies oversubscription/reserve/growth must go through `Decimal`. IEEE float drift at the 6th decimal place will fail snapshot tests in P6.
- **CALC-01 constraint** — every file in `src/engine/mgmt/` and the engine layer must NOT import Vue, Pinia, or any Vue ecosystem library. The implementer subagent should grep their own work before committing: `grep -E "from ['\"]vue|pinia" <file>` should return zero hits.
- **The deprecation warnings on `usePptxExport.ts`** (10 warnings reading legacy flat fields) are **intentional** — they signal the migration path for P3/P4. Do not attempt to suppress or migrate them in this phase.
- When debugging a failing test, prefer `npx vitest run <single-file>` over `npm run test` — much faster feedback loop.
- The `rtk` CLI proxy (token-optimization wrapper) sometimes mangles `npx vitest run` output to "PASS (N) FAIL (M)" only. If you need full output, drop the `rtk` prefix and run plain `npx vitest`.
- **Task 7's reliance on the existing `management.test.ts`** is by design — it's a regression alarm for the legacy shim. If the existing tests start passing for the wrong reasons (e.g., placeholder zeros happen to equal legacy values), the implementer should add a sanity check that the new shape's `appliances` array is non-empty and `recommendedHostCount > 0`.
