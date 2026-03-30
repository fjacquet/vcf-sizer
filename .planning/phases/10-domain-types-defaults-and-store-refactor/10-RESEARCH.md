# Phase 10: Domain Types, Defaults, and Store Refactor — Research

**Researched:** 2026-03-30
**Domain:** Pinia store restructure — flat scalars to typed domain arrays
**Confidence:** HIGH (grounded in direct codebase inspection + verified Pinia/Vue 3/Zod 4 patterns)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOM-01 | `inputStore` refactored from flat structure to `managementDomain: ManagementDomainConfig` + `workloadDomains: WorkloadDomainConfig[]` | inputStore.ts fully audited; restructure pattern documented in Architecture section |
| DOM-02 | `WorkloadDomainConfig` type includes stable `id`, user-editable `name`, all per-domain host specs, workload profile, storage config, and optional feature toggles | All 22 flat fields in inputStore mapped; complete interface shape defined |
| DOM-03 | `ManagementDomainConfig` type contains management host specs and architecture toggle — independent from any workload domain | `managementArchitecture` stays global; management host specs extracted to dedicated type |
| DOM-04 | Default state on first load is one workload domain named "WLD-1" with all existing default values | `createDefaultWorkloadDomain(0)` factory pattern specified with exact defaults |
| DOM-05 | `calculationStore` maps over `workloadDomains` to produce a `domainResults` computed array — zero `ref()` (CALC-02) | `computed(() => domains.map(...))` pattern verified; CALC-02 compliance maintained |
| DOM-06 | `calculationStore` reduces `domainResults` into `aggregateTotals` — zero `ref()` (CALC-02) | `computed(() => domainResults.value.reduce(...))` pattern specified |
</phase_requirements>

---

## Summary

Phase 10 replaces the current flat `inputStore` of 22 scalar `ref()` values with a structured store holding `workloadDomains: ref<WorkloadDomainConfig[]>` (default: one domain named "WLD-1") and `managementDomain: ref<ManagementDomainConfig>`. The `calculationStore` is refactored from individual per-field computeds to a single `domainResults: computed()` that maps over the domain array (calling the unchanged engine functions per domain) and an `aggregateTotals: computed()` that reduces the results.

The engine layer (`src/engine/*.ts`) is entirely unchanged — all engine functions are pure TypeScript with typed inputs and outputs, fully CALC-01 compliant. The 182 existing engine tests continue passing without modification. Phase 10 only touches `src/engine/types.ts` (additive new interfaces), a new `src/engine/defaults.ts` factory file, `src/stores/inputStore.ts` (structural rewrite), and `src/stores/calculationStore.ts` (structural rewrite). The Zod URL state in `useUrlState.ts` is intentionally NOT touched — that is Phase 11's scope.

The critical constraint is maintaining CALC-02: `calculationStore.ts` must contain zero `ref()`. `computed()` that returns an array, loops, `.map()`, and `.reduce()` are all permitted — the constraint is on the reactive primitive used, not the complexity of the derivation function.

**Primary recommendation:** Define types in `src/engine/types.ts` first, then `src/engine/defaults.ts`, then rewrite inputStore, then rewrite calculationStore. Write RED tests before each store change (Wave 0 TDD discipline).

---

## Project Constraints (from CLAUDE.md)

| Constraint | Rule |
|------------|------|
| CALC-01 | Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library |
| CALC-02 | `calculationStore.ts` must contain ZERO `ref()` — only `computed()` |
| Test environment | Vitest, node environment — all tests in `src/engine/**/*.test.ts` and `src/composables/**/*.test.ts` |
| Path alias | `@/` maps to `src/` in both vite.config.ts and tsconfig.app.json |
| Layer separation | Components read stores; stores call engine; engine has no Vue imports |
| i18n keys | Validation warning `messageKey` must be an i18n key string, never raw English |

---

## Standard Stack

### Core (unchanged — no new packages)

| Library | Version | Purpose | Phase 10 Usage |
|---------|---------|---------|----------------|
| Vue 3 | ^3.5.31 | Reactivity primitives | `ref<WorkloadDomainConfig[]>()`, `computed()` |
| Pinia | ^3.0.4 | Store management | Setup store with `defineStore` |
| Zod | ^4.3.6 | URL state schema | NOT touched in Phase 10 (Phase 11 scope) |
| Vitest | ^4.1.2 | Test runner | New store unit tests |
| TypeScript | bundled with vue-tsc | Type safety | New interfaces in types.ts |

**No new npm packages are required for Phase 10.** The existing stack handles all requirements.

**Version verification:** All versions confirmed against package.json on 2026-03-30. Vitest 4.1.2, Pinia 3.0.4, Zod 4.3.6, Vue 3.5.31.

---

## Architecture Patterns

### Exact Field Mapping: inputStore.ts → v3.0

The current inputStore has 22 flat scalar refs. They map to the new structure as follows:

**Fields moving INTO WorkloadDomainConfig (per-domain):**
```
deploymentMode, coresPerSocket, socketsPerHost, hostRamGB, hostStorageTB, hostCount,
nvmeTieringEnabled, activeMemoryPct, preferredSiteHosts, secondarySiteHosts,
vmCount, avgVcpuPerVm, avgVramGbPerVm, avgStorageGbPerVm, cpuOvercommitRatio, ramOvercommitRatio,
gpuVmCount, vgpuMemoryGB,
storageType, fttLevel, raidType, dedupEnabled, dedupRatio,
vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE
```
That is all 26 workload-related fields (current 22 + `name`, `id` added as new fields).

**Fields staying GLOBAL on inputStore:**
```
managementArchitecture   — deployment-level toggle, not per-domain
```

**Fields moving INTO ManagementDomainConfig:**
```
coresPerSocket, socketsPerHost, hostRamGB, hostStorageTB
```
Note: management domain gets its OWN independent copy of host specs. This is required because `dedicatedMgmtHostCount` in calculationStore uses `input.coresPerSocket * input.socketsPerHost` — after refactor it must use `input.managementDomain.coresPerSocket * input.managementDomain.socketsPerHost`.

### New TypeScript Interfaces (src/engine/types.ts additions)

```typescript
// All interfaces live in src/engine/types.ts — pure TypeScript, CALC-01 compliant

export interface WorkloadDomainConfig {
  id: string                          // crypto.randomUUID() — stable v-for key
  name: string                        // user-editable, "WLD-1" by default

  // Host specification
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTB: number
  hostCount: number

  // NVMe Memory Tiering
  nvmeTieringEnabled: boolean
  activeMemoryPct: number

  // Stretch per-site counts (per-domain: stretch topology is per-domain)
  preferredSiteHosts: number
  secondarySiteHosts: number

  // Workload profile
  vmCount: number
  avgVcpuPerVm: number
  avgVramGbPerVm: number
  avgStorageGbPerVm: number
  cpuOvercommitRatio: number
  ramOvercommitRatio: number

  // AI/GPU
  gpuVmCount: number
  vgpuMemoryGB: number

  // Storage configuration
  storageType: StorageType
  fttLevel: FttLevel
  raidType: RaidType
  dedupEnabled: boolean
  dedupRatio: number
  vsanMaxProfile: VsanMaxProfile
  vsanMaxStorageNodes: number

  // Network
  networkSpeedGbE: 10 | 25 | 100

  // Deployment topology
  deploymentMode: DeploymentMode
}

export interface ManagementDomainConfig {
  // Host specs for management cluster hardware — independent of workload domains
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTB: number
  // NOTE: managementArchitecture is NOT here — it stays as a global ref on inputStore
}

// Result shape for one domain — produced by calculationStore.domainResults
export interface DomainResult {
  id: string                          // domain.id passthrough for consumer lookups
  name: string                        // domain.name passthrough
  compute: ComputeResult
  storage: StorageResult
  stretch: StretchResult | null       // null when deploymentMode !== 'stretch'
  vsanMax: VsanMaxResult | null       // null when storageType !== 'vsan-max'
  validationErrors: ValidationWarning[]
}

// Aggregate result — produced by calculationStore.aggregateTotals
export interface AggregateTotals {
  totalRecommendedHosts: number       // sum of compute.recommendedHostCount across all domains
  totalVmCount: number                // sum of vmCount across all domains
  totalRawStorageTB: number           // sum of storage.rawCapacityTB
  totalEffectiveStorageTB: number     // sum of storage.effectiveCapacityTB
  allValidationErrors: ValidationWarning[]  // flatMap of per-domain errors
}
```

### New Factory File (src/engine/defaults.ts)

```typescript
// src/engine/defaults.ts
// Pure TypeScript factory functions — CALC-01 compliant (zero Vue imports)

import type { WorkloadDomainConfig, ManagementDomainConfig } from './types'

export function createDefaultWorkloadDomain(index: number): WorkloadDomainConfig {
  return {
    id: crypto.randomUUID(),
    name: `WLD-${index + 1}`,
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTB: 3.84,
    hostCount: 4,
    nvmeTieringEnabled: false,
    activeMemoryPct: 50,
    preferredSiteHosts: 3,
    secondarySiteHosts: 3,
    vmCount: 100,
    avgVcpuPerVm: 4,
    avgVramGbPerVm: 8,
    avgStorageGbPerVm: 100,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    gpuVmCount: 0,
    vgpuMemoryGB: 16,
    storageType: 'vsan-esa',
    fttLevel: 1,
    raidType: 'raid5',
    dedupEnabled: false,
    dedupRatio: 2,
    vsanMaxProfile: 'med',
    vsanMaxStorageNodes: 4,
    networkSpeedGbE: 25,
    deploymentMode: 'ha',
  }
}

export function createDefaultManagementDomain(): ManagementDomainConfig {
  return {
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTB: 3.84,
  }
}
```

**Default name is "WLD-1" (index 0 → "WLD-1")** — DOM-04 requires exactly "WLD-1" for the first domain.

### New inputStore.ts Structure

```typescript
// src/stores/inputStore.ts — v3.0 shape
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createDefaultWorkloadDomain, createDefaultManagementDomain } from '@/engine/defaults'
import type { WorkloadDomainConfig, ManagementDomainConfig } from '@/engine/types'

export const useInputStore = defineStore('input', () => {
  // GLOBAL (deployment-level, not per-domain)
  const managementArchitecture = ref<'shared' | 'dedicated'>('shared')

  // Management domain host specs — independent of workload domains
  const managementDomain = ref<ManagementDomainConfig>(createDefaultManagementDomain())

  // Workload domains — default: one domain named "WLD-1"
  // Use ref<[]> NOT reactive([]) — avoids storeToRefs() double-wrap bug
  const workloadDomains = ref<WorkloadDomainConfig[]>([createDefaultWorkloadDomain(0)])

  // Active tab index — UI state only, NOT serialized to URL
  const activeDomainIndex = ref(0)

  // Domain mutations — use direct property assignment, NOT $patch() (shallow merge breaks arrays)
  function addDomain() {
    workloadDomains.value.push(createDefaultWorkloadDomain(workloadDomains.value.length))
    activeDomainIndex.value = workloadDomains.value.length - 1
  }

  function removeDomain(id: string) {
    const idx = workloadDomains.value.findIndex(d => d.id === id)
    if (idx === -1 || workloadDomains.value.length === 1) return
    workloadDomains.value.splice(idx, 1)
    activeDomainIndex.value = Math.min(activeDomainIndex.value, workloadDomains.value.length - 1)
  }

  function updateDomain(id: string, patch: Partial<WorkloadDomainConfig>) {
    const domain = workloadDomains.value.find(d => d.id === id)
    if (domain) Object.assign(domain, patch)
  }

  return {
    managementArchitecture,
    managementDomain,
    workloadDomains,
    activeDomainIndex,
    addDomain,
    removeDomain,
    updateDomain,
  }
})
```

**Key decision:** `updateDomain` uses `Object.assign(domain, patch)` — direct mutation on the existing reactive object. This preserves Vue 3 deep reactivity tracking. Never use `workloadDomains.value[idx] = { ...newDomain }` for partial updates as this replaces the reactive proxy reference.

### New calculationStore.ts Structure

```typescript
// src/stores/calculationStore.ts — v3.0 shape
// CRITICAL: ALL returned values are computed() — ZERO mutable state (CALC-02)

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useInputStore } from './inputStore'
import { calcManagement } from '../engine/management'
import { calcCompute } from '../engine/compute'
import { calcStorage } from '../engine/storage'
import { calcVsanMax } from '../engine/vsanMax'
import { calcStretch } from '../engine/stretch'
import { validateInputs } from '../engine/validation'
import type { DomainResult, AggregateTotals } from '../engine/types'

export const useCalculationStore = defineStore('calculation', () => {
  // CRITICAL: call useInputStore() at TOP LEVEL — not inside computed() callback
  const input = useInputStore()

  // Management overhead — global, depends only on managementArchitecture
  const management = computed(() => calcManagement(input.managementArchitecture))

  // dedicatedMgmtHostCount — uses managementDomain host specs (not domain[0] specs)
  const dedicatedMgmtHostCount = computed<number | null>(() => {
    if (input.managementArchitecture !== 'dedicated') return null
    const coresPerHost = input.managementDomain.coresPerSocket * input.managementDomain.socketsPerHost
    return Math.max(4, Math.ceil(management.value.totalCores / coresPerHost))
  })

  // Per-domain results — maps over array, returns new array each recompute
  // CALC-02 compliant: computed() is the only reactive primitive used here
  const domainResults = computed<DomainResult[]>(() =>
    input.workloadDomains.map(domain => {
      const effectiveHostCount =
        domain.deploymentMode === 'stretch'
          ? domain.preferredSiteHosts + domain.secondarySiteHosts
          : domain.hostCount

      return {
        id: domain.id,
        name: domain.name,
        compute: calcCompute({
          deploymentMode: domain.deploymentMode,
          coresPerSocket: domain.coresPerSocket,
          socketsPerHost: domain.socketsPerHost,
          hostRamGB: domain.hostRamGB,
          hostCount: effectiveHostCount,
          vmCount: domain.vmCount,
          avgVcpuPerVm: domain.avgVcpuPerVm,
          avgVramGbPerVm: domain.avgVramGbPerVm,
          cpuOvercommitRatio: domain.cpuOvercommitRatio,
          ramOvercommitRatio: domain.ramOvercommitRatio,
          managementCores: management.value.totalCores,
          managementRamGB: management.value.totalRamGB,
          nvmeTieringEnabled: domain.nvmeTieringEnabled,
          activeMemoryPct: domain.activeMemoryPct,
          gpuVmCount: domain.gpuVmCount,
          vgpuMemoryGB: domain.vgpuMemoryGB,
        }),
        storage: calcStorage({
          storageType: domain.storageType,
          hostCount: effectiveHostCount,
          hostStorageTB: domain.hostStorageTB,
          fttLevel: domain.fttLevel,
          raidType: domain.raidType,
          dedupEnabled: domain.dedupEnabled,
          dedupRatio: domain.dedupRatio,
          deploymentMode: domain.deploymentMode,
        }),
        stretch: domain.deploymentMode === 'stretch'
          ? calcStretch({
              preferredSiteHosts: domain.preferredSiteHosts,
              secondarySiteHosts: domain.secondarySiteHosts,
              hostStorageTB: domain.hostStorageTB,
              vmCount: domain.vmCount,
              avgStorageGbPerVm: domain.avgStorageGbPerVm,
            })
          : null,
        vsanMax: domain.storageType === 'vsan-max'
          ? calcVsanMax({
              profile: domain.vsanMaxProfile,
              storageNodeCount: domain.vsanMaxStorageNodes,
              computeNodeCount: domain.hostCount,
            })
          : null,
        validationErrors: validateInputs({
          deploymentMode: domain.deploymentMode,
          coresPerSocket: domain.coresPerSocket,
          socketsPerHost: domain.socketsPerHost,
          hostCount: domain.hostCount,
          dedupEnabled: domain.dedupEnabled,
          storageType: domain.storageType,
          preferredSiteHosts: domain.preferredSiteHosts,
          secondarySiteHosts: domain.secondarySiteHosts,
          managementArchitecture: input.managementArchitecture,
          networkSpeedGbE: domain.networkSpeedGbE,
          vsanMaxStorageNodes: domain.vsanMaxStorageNodes,
        }),
      }
    })
  )

  // Aggregate totals — reduces domainResults; second computed, zero ref()
  const aggregateTotals = computed<AggregateTotals>(() => ({
    totalRecommendedHosts: domainResults.value.reduce(
      (sum, d) => sum + d.compute.recommendedHostCount, 0
    ),
    totalVmCount: input.workloadDomains.reduce((sum, d) => sum + d.vmCount, 0),
    totalRawStorageTB: domainResults.value.reduce(
      (sum, d) => sum + d.storage.rawCapacityTB, 0
    ),
    totalEffectiveStorageTB: domainResults.value.reduce(
      (sum, d) => sum + d.storage.effectiveCapacityTB, 0
    ),
    allValidationErrors: domainResults.value.flatMap(d => d.validationErrors),
  }))

  // ZERO ref() — CALC-02 compliant
  return { management, domainResults, aggregateTotals, dedicatedMgmtHostCount }
})
```

### Recommended File Change Order

This order minimizes broken intermediate states:

1. **`src/engine/types.ts`** — add `WorkloadDomainConfig`, `ManagementDomainConfig`, `DomainResult`, `AggregateTotals` interfaces (additive, no breakage)
2. **`src/engine/defaults.ts`** — create new file with `createDefaultWorkloadDomain()` and `createDefaultManagementDomain()` factories
3. **`src/stores/inputStore.ts`** — complete structural rewrite (breaks calculationStore and all components — do atomically with step 4)
4. **`src/stores/calculationStore.ts`** — complete structural rewrite (restores type safety broken in step 3)
5. **Run `npm run type-check`** — all TypeScript errors surface; fix before continuing
6. **Verify `npm test`** — all 182 engine tests still pass (they import engine functions directly, no store coupling)

**Note:** Steps 3 and 4 must be done in the same task/commit. After step 3, the project will not type-check until step 4 is complete.

### File Change Inventory

**New files:**
- `src/engine/defaults.ts` — factory functions (CALC-01 compliant)
- `src/stores/calculationStore.test.ts` — new test file for store behavior

**Modified files:**
- `src/engine/types.ts` — additive interface additions
- `src/stores/inputStore.ts` — complete structural rewrite
- `src/stores/calculationStore.ts` — complete structural rewrite

**Unchanged files (all engine pure functions):**
- `src/engine/compute.ts`, `src/engine/storage.ts`, `src/engine/stretch.ts`
- `src/engine/management.ts`, `src/engine/vsanMax.ts`, `src/engine/validation.ts`
- `src/engine/*.test.ts` — all 7 test files unchanged

**Deliberately out of Phase 10 scope:**
- `src/composables/useUrlState.ts` — Phase 11 scope
- `src/components/**` — Phase 12 scope
- `src/i18n/**` — Phase 12 scope

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep reactive array of objects | Custom reactive watcher + sync | `ref<WorkloadDomainConfig[]>([])` | Vue 3 deep reactivity handles nested object mutation automatically |
| Derived array state | `ref<DomainResult[]>([])` + watcher | `computed(() => domains.map(...))` | CALC-02 compliance; avoids double source of truth; Vue recomputes on demand |
| Domain ID generation | npm uuid package | `crypto.randomUUID()` | Built into Node 25.x and all modern browsers; no dependency needed |
| Partial domain updates | `$patch({ workloadDomains: [...] })` | `Object.assign(domain, patch)` | `$patch` shallow-merges arrays — destroys unmentioned fields |
| Management host independence | Inherit from `domain[0]` | `managementDomain: ref<ManagementDomainConfig>` | Silent coupling would cause management sizing to change when workload domain[0] changes |

---

## Common Pitfalls

### Pitfall 1: Assigning `reactive([])` to workloadDomains
**What goes wrong:** `workloadDomains = reactive([])` inside a Pinia setup store causes double-proxy wrapping. `storeToRefs()` returns a `ComputedRef` instead of `Ref` for the array, breaking array mutation tracking.
**Prevention:** Always declare as `ref<WorkloadDomainConfig[]>([])`. Never `reactive([])`.
**Warning signs:** `storeToRefs(inputStore).workloadDomains` has unexpected type; `.push()` does not trigger `domainResults` recompute.

### Pitfall 2: Calling `useInputStore()` inside the `.map()` callback
**What goes wrong:** Vue's `getCurrentInstance()` context is not available during lazy computed evaluation. Calling any composable inside a `.map()` callback throws "getCurrentInstance() was called outside of setup" in production builds.
**Prevention:** `const input = useInputStore()` must be at the TOP LEVEL of the `defineStore('calculation', () => { ... })` factory — already the pattern in the current calculationStore.ts.
**Warning signs:** Error appears in browser but NOT in Vitest (test environment initializes Pinia globally).

### Pitfall 3: Using `$patch()` for partial domain updates
**What goes wrong:** `store.$patch({ workloadDomains: [{ id: '1', vmCount: 200 }] })` replaces the array with a new array containing only one incomplete object — all other fields become `undefined`.
**Prevention:** Use direct property mutation via `Object.assign(domain, patch)` inside the `updateDomain()` action.

### Pitfall 4: `dedicatedMgmtHostCount` inheriting from domain[0] specs
**What goes wrong:** The current `calculationStore` uses `input.coresPerSocket * input.socketsPerHost` for management host sizing. After refactor, `input.coresPerSocket` no longer exists — it is `input.managementDomain.coresPerSocket`. If the developer uses `input.workloadDomains[0].coresPerSocket` instead, management host count silently changes when workload domain[0] specs change.
**Prevention:** `dedicatedMgmtHostCount` must read from `input.managementDomain.coresPerSocket * input.managementDomain.socketsPerHost`.

### Pitfall 5: `crypto.randomUUID()` in engine/defaults.ts (CALC-01 risk)
**What goes wrong:** `crypto` is a web/Node global — NOT a Vue import — so calling it in `src/engine/defaults.ts` does NOT violate CALC-01. CALC-01 only prohibits importing from Vue, Pinia, or Vue ecosystem packages.
**Verification:** Node 25.x (confirmed on this machine) has `crypto.randomUUID()` available as a global without any import. Vitest node environment also has it (no polyfill needed).

### Pitfall 6: Forgetting `effectiveHostCount` logic per domain
**What goes wrong:** The current calculationStore computes `effectiveHostCount` as a separate computed that uses `input.deploymentMode`. After refactor, each domain has its own `deploymentMode`. The domain-level effective host count must be computed INSIDE the `.map()` callback.
**Prevention:** The pattern is: `const effectiveHostCount = domain.deploymentMode === 'stretch' ? domain.preferredSiteHosts + domain.secondarySiteHosts : domain.hostCount` — inline within the map.

---

## Environment Availability

Step 2.6: `crypto.randomUUID()` confirmed available in Node 25.8.2 (verified via `node -e "require('crypto').randomUUID()"` → valid UUID output). Vitest node environment inherits Node globals — no polyfill or mock needed.

All other dependencies are local npm packages already installed. No external services required for Phase 10.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | Inline in vite.config.ts (no separate vitest.config.ts) |
| Quick run command | `npx vitest run src/stores/calculationStore.test.ts` |
| Full suite command | `npm test` |

### Baseline (Must Remain GREEN Throughout)

All 182 existing tests must remain GREEN after every task in Phase 10. Engine tests are pure-function tests with no store coupling — they are unaffected by store restructure.

```bash
npm test   # must show 182 passed before and after each commit
```

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOM-01 | inputStore holds `workloadDomains` ref and `managementDomain` ref; flat scalars removed | unit | `npx vitest run src/stores/calculationStore.test.ts` | ❌ Wave 0 |
| DOM-02 | `WorkloadDomainConfig` has all required fields including stable `id` and `name` | unit (type-check) | `npm run type-check` | N/A (compile-time) |
| DOM-03 | `ManagementDomainConfig` host specs are independent; `dedicatedMgmtHostCount` reads from managementDomain | unit | `npx vitest run src/stores/calculationStore.test.ts` | ❌ Wave 0 |
| DOM-04 | Default store state has exactly one domain named "WLD-1" with correct default values | unit | `npx vitest run src/stores/calculationStore.test.ts` | ❌ Wave 0 |
| DOM-05 | `domainResults` is an array of length N when N domains exist; zero `ref()` in calculationStore | unit | `npx vitest run src/stores/calculationStore.test.ts` | ❌ Wave 0 |
| DOM-06 | `aggregateTotals.totalRecommendedHosts` equals sum of per-domain host counts | unit | `npx vitest run src/stores/calculationStore.test.ts` | ❌ Wave 0 |

### Specific Test Cases (Wave 0 RED before implementation)

New file: `src/stores/calculationStore.test.ts`

```typescript
// Wave 0 RED tests — write these BEFORE touching inputStore.ts or calculationStore.ts

describe('inputStore — v3.0 structure (DOM-01)', () => {
  it('has workloadDomains array ref')     // store.workloadDomains is an array
  it('has managementDomain object ref')  // store.managementDomain has coresPerSocket etc.
  it('has managementArchitecture global ref')  // store.managementArchitecture exists
  it('does NOT have flat coresPerSocket ref')  // old flat scalar is gone
})

describe('createDefaultWorkloadDomain (DOM-02, DOM-04)', () => {
  it('returns object with id, name, and all 26 fields')
  it('name is "WLD-1" when index is 0')
  it('name is "WLD-3" when index is 2')
  it('id is a non-empty string (UUID format)')
  it('two calls produce different ids')  // crypto.randomUUID() called each time
  it('deploymentMode defaults to "ha"')
  it('storageType defaults to "vsan-esa"')
})

describe('calculationStore — domainResults (DOM-05)', () => {
  it('domainResults has length 1 with default store state')
  it('domainResults has length 2 after addDomain()')
  it('domainResults[0].id matches workloadDomains[0].id')
  it('domainResults[0].compute.recommendedHostCount is a positive number')
  it('domainResults[0].stretch is null when deploymentMode is "ha"')
  it('domainResults[0].vsanMax is null when storageType is "vsan-esa"')
})

describe('calculationStore — aggregateTotals (DOM-06)', () => {
  it('totalRecommendedHosts equals sum of per-domain recommendedHostCount')
  it('totalVmCount equals sum of per-domain vmCount')
  it('totalRecommendedHosts doubles after adding second identical domain')
  it('allValidationErrors is flat array combining all domain errors')
})

describe('calculationStore — dedicatedMgmtHostCount (DOM-03)', () => {
  it('reads from managementDomain host specs, not workloadDomains[0]')
  it('is null when managementArchitecture is "shared"')
  it('changing managementDomain.coresPerSocket changes dedicatedMgmtHostCount')
  it('changing workloadDomains[0].coresPerSocket does NOT change dedicatedMgmtHostCount')
})
```

### Sampling Rate

- **Per task commit:** `npx vitest run src/stores/calculationStore.test.ts && npm test`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite GREEN before proceeding to Phase 11

### Wave 0 Gaps

- [ ] `src/stores/calculationStore.test.ts` — covers DOM-01, DOM-02, DOM-03, DOM-04, DOM-05, DOM-06
- [ ] `src/engine/defaults.test.ts` (optional but recommended) — covers `createDefaultWorkloadDomain` factory

No framework install needed — Vitest 4.1.2 already configured and running.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat scalar refs for single workload | `ref<WorkloadDomainConfig[]>` array | Phase 10 | Enables N independent workload domains |
| Single `compute` computed | `domainResults` mapped computed array | Phase 10 | Per-domain results, aggregated totals |
| `input.coresPerSocket` for mgmt sizing | `input.managementDomain.coresPerSocket` | Phase 10 | Management cluster sized independently |

---

## Open Questions

1. **`networkSpeedGbE` on `WorkloadDomainConfig`**
   - What we know: Currently a flat field on inputStore. ARCHITECTURE.md includes it in `WorkloadDomainConfig` (per-domain). It is used in both `validateInputs` (per-domain) and `calcStretch` bandwidth cap (per-domain stretch cluster).
   - What's unclear: Whether a user would ever want different network speeds per domain.
   - Recommendation: Treat as per-domain (already in architecture doc). Each domain can independently declare its network tier.

2. **`hostStorageTB` absence from `managementDomain`**
   - What we know: `ManagementDomainConfig` includes `hostStorageTB` in the architecture docs but the current `dedicatedMgmtHostCount` calculation does not use storage.
   - What's unclear: Whether management domain storage sizing will be needed in a future phase.
   - Recommendation: Include `hostStorageTB` in `ManagementDomainConfig` for completeness and forward-compatibility (Phase 11 Zod schema will need it anyway).

3. **Whether to expose old flat computed aliases for backward compatibility during refactor**
   - What we know: After replacing the flat inputStore, all components reading `input.coresPerSocket` directly will break. Phase 10 intentionally lets those compile errors surface (they are fixed in Phase 12).
   - What's unclear: Whether to add temporary aliases on inputStore to defer component breakage.
   - Recommendation: Do NOT add aliases. The plan should explicitly address component breakage as a known Phase 12 task. This keeps the Phase 10 store shape clean and avoids confusion about which fields are canonical.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/stores/inputStore.ts` — full field inventory (22 flat refs catalogued)
- Direct codebase inspection: `src/stores/calculationStore.ts` — all 7 existing computed() identified
- Direct codebase inspection: `src/engine/types.ts` — all existing interfaces confirmed
- `.planning/research/ARCHITECTURE.md` — v3.0 architecture decisions (domain types, calculationStore pattern)
- `.planning/research/PITFALLS.md` — v3.0 pitfalls (all critical pitfalls incorporated above)
- `.planning/STATE.md` — all v3.0 roadmap decisions confirmed

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — Pinia `ref<[]>` vs `reactive([])` guidance; tab UI decision
- Node 25.8.2 runtime test: `crypto.randomUUID()` available without import

### Tertiary (confirmed by prior planning)
- Zod 4 `.default(() => fn())` factory pattern — noted in STATE.md as requiring verification against exact 4.3.6; deferred to Phase 11 (not needed in Phase 10)

---

## Metadata

**Confidence breakdown:**
- Types and interfaces: HIGH — derived from direct field audit of inputStore.ts + engine/types.ts
- Store restructure pattern: HIGH — matches established Pinia setup store conventions; ARCHITECTURE.md verifies
- calculationStore computed array: HIGH — `computed(() => array.map(...))` is standard Vue 3; existing codebase already uses this pattern per-field
- Pitfalls: HIGH — grounded in PITFALLS.md which cites official Pinia/Vue/Zod docs
- Test strategy: HIGH — derived from existing test infrastructure inspection

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack; short-valid only if Pinia or Vue 3 releases breaking changes)
