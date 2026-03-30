# Architecture Patterns — v3.0 Multi-Domain Refactor

**Domain:** VCF 9.x Sizing Calculator SPA — Multi-Domain Store Refactor
**Researched:** 2026-03-30
**Confidence:** HIGH (grounded in direct codebase inspection + established Pinia/Zod patterns)
**Replaces:** v2.1 export architecture (2026-03-29)

---

## Context: What This Document Covers

This is the v3.0 milestone architecture document. It answers six specific questions for the roadmapper:

1. How to restructure `inputStore.ts` to hold an array of workload domains without violating CALC-02
2. How `calculationStore.ts` maps over the domain array while remaining `computed()`-only
3. How the Zod URL schema handles variable-length `z.array()` with safe defaults
4. What the new TypeScript domain types look like and where they live
5. What the exact file change inventory is (new vs modified vs unchanged)
6. What the correct build order is across phases

---

## Established Constraints (Non-Negotiable)

These constraints come from `CLAUDE.md` and `PROJECT.md` and must be preserved throughout v3.0:

| Constraint | Rule | Location |
|------------|------|----------|
| CALC-01 | Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library | CLAUDE.md |
| CALC-02 | `calculationStore.ts` must contain ZERO `ref()` — only `computed()` | CLAUDE.md |
| URL-SYNC | Zod schema + hydrate + serialize must remain atomically consistent (change one, change all three) | useUrlState.ts pattern |
| I18N | Validation warning `messageKey` must be an i18n key, never a raw English string | engine/types.ts |

---

## New Data Model

### WorkloadDomain Type

A new type must be added to `src/engine/types.ts` (pure TypeScript, no Vue imports — CALC-01 compliant):

```typescript
export interface WorkloadDomain {
  id: string            // uuid-like, generated at creation (e.g. crypto.randomUUID())
  name: string          // user-editable label ("Workload Domain 1")

  // Host specification (mirrors current flat fields)
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTB: number
  hostCount: number

  // NVMe Memory Tiering
  nvmeTieringEnabled: boolean
  activeMemoryPct: number

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

  // Deployment topology (per domain — stretch is per-domain not global)
  deploymentMode: DeploymentMode
  preferredSiteHosts: number
  secondarySiteHosts: number

  // Storage configuration
  storageType: StorageType
  fttLevel: FttLevel
  raidType: RaidType
  dedupEnabled: boolean
  dedupRatio: number
  vsanMaxProfile: VsanMaxProfile
  vsanMaxStorageNodes: number
  networkSpeedGbE: 10 | 25 | 100
}
```

```typescript
export interface ManagementDomain {
  // Independent host specs for management domain hardware
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTB: number
  // managementArchitecture is a global toggle, not per management domain
}
```

The default factory function (also in `src/engine/types.ts` or a sibling `src/engine/defaults.ts`):

```typescript
export function createDefaultWorkloadDomain(index: number): WorkloadDomain {
  return {
    id: crypto.randomUUID(),
    name: `Workload Domain ${index + 1}`,
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTB: 3.84,
    hostCount: 4,
    nvmeTieringEnabled: false,
    activeMemoryPct: 50,
    vmCount: 100,
    avgVcpuPerVm: 4,
    avgVramGbPerVm: 8,
    avgStorageGbPerVm: 100,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    gpuVmCount: 0,
    vgpuMemoryGB: 16,
    deploymentMode: 'ha',
    preferredSiteHosts: 3,
    secondarySiteHosts: 3,
    storageType: 'vsan-esa',
    fttLevel: 1,
    raidType: 'raid5',
    dedupEnabled: false,
    dedupRatio: 2,
    vsanMaxProfile: 'med',
    vsanMaxStorageNodes: 4,
    networkSpeedGbE: 25,
  }
}
```

---

## inputStore.ts Restructure

### Before (flat — current)

```typescript
const deploymentMode = ref<'simple' | 'ha' | 'stretch'>('ha')
const coresPerSocket = ref(16)
// ... 20+ more flat refs
```

### After (structured — v3.0)

```typescript
export const useInputStore = defineStore('input', () => {
  // Global (non-domain-specific)
  const managementArchitecture = ref<'shared' | 'dedicated'>('shared')
  const managementDomain = ref<ManagementDomain>({
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTB: 3.84,
  })

  // Array of workload domains — one domain minimum, N maximum
  const workloadDomains = ref<WorkloadDomain[]>([createDefaultWorkloadDomain(0)])

  // Active tab index — UI state only, NOT serialized to URL
  const activeDomainIndex = ref(0)

  // Domain mutations
  function addDomain() {
    workloadDomains.value.push(createDefaultWorkloadDomain(workloadDomains.value.length))
    activeDomainIndex.value = workloadDomains.value.length - 1
  }

  function removeDomain(id: string) {
    const idx = workloadDomains.value.findIndex(d => d.id === id)
    if (idx === -1 || workloadDomains.value.length === 1) return // minimum 1
    workloadDomains.value.splice(idx, 1)
    activeDomainIndex.value = Math.min(activeDomainIndex.value, workloadDomains.value.length - 1)
  }

  function updateDomain(id: string, patch: Partial<WorkloadDomain>) {
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

**Critical detail:** `workloadDomains` is a single `ref<WorkloadDomain[]>`. Vue 3 tracks mutations to nested reactive objects inside a `ref()` array. Individual property mutations via `Object.assign(domain, patch)` trigger reactivity correctly because `ref([])` wraps the array in a reactive proxy. This is confirmed Vue 3 behavior (HIGH confidence).

**`activeDomainIndex` is NOT serialized to URL** — it is ephemeral UI state. When a shared URL is loaded, the first domain tab becomes active. This avoids stale index references when the URL recipient's domain array has a different length.

---

## calculationStore.ts — Computed-Only Array Mapping

CALC-02 requires zero `ref()`. The solution is to use `computed()` that maps over the reactive array.

### Pattern: computed() over a ref() array

```typescript
export const useCalculationStore = defineStore('calculation', () => {
  const input = useInputStore()

  // Management overhead — global, computed once
  const management = computed(() => calcManagement(input.managementArchitecture))

  // Per-domain results — maps over the array, returns a new array each recompute
  // This is CALC-02 compliant: computed() is the only reactive primitive used here
  const domainResults = computed(() =>
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

  // Aggregate totals — a second computed() that reduces domainResults
  const aggregateTotals = computed(() => ({
    totalRecommendedHosts: domainResults.value.reduce(
      (sum, d) => sum + d.compute.recommendedHostCount, 0
    ),
    totalVmCount: input.workloadDomains.reduce(
      (sum, d) => sum + d.vmCount, 0
    ),
    totalRawStorageTB: domainResults.value.reduce(
      (sum, d) => sum + d.storage.rawCapacityTB, 0
    ),
    totalEffectiveStorageTB: domainResults.value.reduce(
      (sum, d) => sum + d.storage.effectiveCapacityTB, 0
    ),
    allValidationErrors: domainResults.value.flatMap(d => d.validationErrors),
  }))

  // Management domain dedicated host count (unchanged from v2.x)
  const dedicatedMgmtHostCount = computed<number | null>(() => {
    if (input.managementArchitecture !== 'dedicated') return null
    // Use managementDomain host specs for the calculation
    const coresPerHost = input.managementDomain.coresPerSocket * input.managementDomain.socketsPerHost
    return Math.max(4, Math.ceil(management.value.totalCores / coresPerHost))
  })

  // ZERO ref() — CALC-02 compliant
  return { management, domainResults, aggregateTotals, dedicatedMgmtHostCount }
})
```

**Why this works with CALC-02:** `computed()` can contain any logic — loops, `.map()`, `.reduce()`, conditionals. The constraint is on the reactive primitive used, not on the complexity of the derivation function. Returning an array from `computed()` is standard Vue 3 (HIGH confidence).

**Reactivity depth note:** `input.workloadDomains` is `ref<WorkloadDomain[]>`. When `Object.assign(domain, patch)` mutates a domain's property, Vue 3 tracks this because `ref([])` uses `reactive()` internally for nested objects. The `computed(() => input.workloadDomains.map(...))` will re-run. This is confirmed Vue 3 deep reactivity behavior (HIGH confidence).

---

## useUrlState.ts — Zod Array Schema

### The Schema Change

`InputStateSchema` must be restructured from flat fields to nested objects with `z.array()`.

```typescript
// New domain schema — mirrors WorkloadDomain type
const WorkloadDomainSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default('Workload Domain 1'),
  coresPerSocket: z.number().int().min(1).max(256).default(16),
  socketsPerHost: z.number().int().min(1).max(8).default(2),
  hostRamGB: z.number().positive().default(512),
  hostStorageTB: z.number().positive().default(3.84),
  hostCount: z.number().int().min(1).max(64).default(4),
  nvmeTieringEnabled: z.boolean().default(false),
  activeMemoryPct: z.number().min(0).max(100).default(50),
  vmCount: z.number().int().min(0).default(100),
  avgVcpuPerVm: z.number().positive().default(4),
  avgVramGbPerVm: z.number().positive().default(8),
  avgStorageGbPerVm: z.number().positive().default(100),
  cpuOvercommitRatio: z.number().positive().max(20).default(4),
  ramOvercommitRatio: z.number().positive().max(4).default(1),
  gpuVmCount: z.number().int().min(0).default(0),
  vgpuMemoryGB: z.number().positive().default(16),
  deploymentMode: z.enum(['simple', 'ha', 'stretch']).default('ha'),
  preferredSiteHosts: z.number().int().min(1).default(3),
  secondarySiteHosts: z.number().int().min(1).default(3),
  storageType: z.enum(['vsan-esa', 'fc', 'nfs', 'vsan-max']).default('vsan-esa'),
  fttLevel: z.union([z.literal(1), z.literal(2)]).default(1),
  raidType: z.enum(['raid1', 'raid5', 'raid6']).default('raid5'),
  dedupEnabled: z.boolean().default(false),
  dedupRatio: z.number().min(1).max(10).default(2),
  vsanMaxProfile: z.enum(['xs', 'sm', 'med', 'lrg', 'xl']).default('med'),
  vsanMaxStorageNodes: z.number().int().min(4).max(64).default(4),
  networkSpeedGbE: z.union([z.literal(10), z.literal(25), z.literal(100)]).default(25),
}).strip()

const ManagementDomainSchema = z.object({
  coresPerSocket: z.number().int().min(1).max(256).default(16),
  socketsPerHost: z.number().int().min(1).max(8).default(2),
  hostRamGB: z.number().positive().default(512),
  hostStorageTB: z.number().positive().default(3.84),
}).strip()

const InputStateSchema = z.object({
  managementArchitecture: z.enum(['shared', 'dedicated']).default('shared'),
  managementDomain: ManagementDomainSchema.default({}),
  workloadDomains: z
    .array(WorkloadDomainSchema)
    .min(1)
    .default([]),  // hydration will call createDefaultWorkloadDomain(0) if array is empty
}).strip()
```

**Variable-length array safety rules:**

1. `z.array(WorkloadDomainSchema).min(1)` — enforce at least one domain at the Zod layer. If the URL contains an empty array, it fails validation and the fallback default (one domain) is used.
2. `.strip()` on both `WorkloadDomainSchema` and `InputStateSchema` — unknown keys from future versions are silently dropped (forward compatibility via `.strip()` is the existing project pattern).
3. Each domain object defaults all fields independently — a partial domain object from a future URL still hydrates safely.
4. `id` uses a callable `.default(() => crypto.randomUUID())` — Zod 4 supports factory functions as defaults so each domain gets a fresh UUID on parse, not a shared one.

### hydration change

```typescript
export function hydrateFromUrl(): void {
  // ... decompress + parse unchanged ...

  const store = useInputStore()
  const state = result.data

  store.managementArchitecture = state.managementArchitecture
  store.managementDomain = state.managementDomain

  // Ensure minimum 1 domain after URL parse
  const domains = state.workloadDomains.length > 0
    ? state.workloadDomains
    : [createDefaultWorkloadDomain(0)]
  store.workloadDomains = domains
}
```

### serialization change

```typescript
export function generateShareUrl(): string {
  const store = useInputStore()
  const state = {
    managementArchitecture: store.managementArchitecture,
    managementDomain: { ...store.managementDomain },
    // activeDomainIndex is NOT serialized — ephemeral UI state
    workloadDomains: store.workloadDomains.map(d => ({ ...d })),
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(state))
  // ... URL construction unchanged ...
}
```

**Spread `{ ...d }` rationale:** Pinia reactive objects are proxies. Spreading creates a plain object for JSON serialization, avoiding proxy serialization artifacts. This is the same discipline as the existing `generateShareUrl()` which reads individual fields explicitly.

**URL length concern:** A single domain produces ~600-800 bytes of JSON before compression. lz-string typically achieves 60-70% compression on JSON. Two domains = ~1400 bytes uncompressed → ~500 bytes compressed → ~670 base64 chars. Well within browser URL limits (2000+ chars safe). Ten domains = ~6000 bytes uncompressed → ~2100 bytes compressed → ~2800 chars — still within modern browser limits (8000+). This is LOW risk for realistic workloads (2-5 domains).

---

## Component Architecture Changes

### New Tab-Based Domain UI

A new top-level component `DomainTabs.vue` orchestrates the tab interface. It replaces the current single-domain form layout.

```
App.vue (or layout root)
  ├── DomainTabs.vue              NEW — tab bar + add/remove buttons
  │     ├── DomainTabPanel.vue    NEW — renders one domain's input forms
  │     │     ├── HostSpecsForm.vue         MODIFIED — takes domainId prop
  │     │     ├── WorkloadProfileForm.vue   MODIFIED — takes domainId prop
  │     │     ├── StorageConfigForm.vue     MODIFIED — takes domainId prop
  │     │     └── DeploymentModelSelector.vue MODIFIED — takes domainId prop
  │     └── ManagementDomainPanel.vue       NEW — management domain host specs
  │
  └── ResultsPanel.vue            MODIFIED — renders per-domain + aggregate
        ├── DomainResultCard.vue  NEW — per-domain host count + utilization
        ├── AggregateCard.vue     NEW — summed totals across domains
        ├── HostCountCard.vue     MODIFIED — receives domain result as prop
        ├── CoresChart.vue        MODIFIED — multi-series or per-domain
        ├── RamChart.vue          MODIFIED — multi-series or per-domain
        └── StorageChart.vue      MODIFIED — multi-series or per-domain
```

### Component prop pattern for domain-scoped inputs

Input form components must stop reading directly from the flat `inputStore` global and instead receive a `domainId` prop:

```typescript
// HostSpecsForm.vue — v3.0 prop pattern
const props = defineProps<{ domainId: string }>()
const input = useInputStore()
const domain = computed(() => input.workloadDomains.find(d => d.id === props.domainId)!)

// Reading: domain.value.coresPerSocket
// Writing: input.updateDomain(props.domainId, { coresPerSocket: newValue })
```

This keeps components as thin projections of store state, maintains reactivity, and avoids prop-drilling the entire domain object (which would break reactivity tracking).

**Writable computed alternative:** For v-model compatibility with existing `NumberSliderInput`, a writable computed per field is cleaner:

```typescript
const coresPerSocket = computed({
  get: () => domain.value.coresPerSocket,
  set: (v) => input.updateDomain(props.domainId, { coresPerSocket: v }),
})
```

This preserves `v-model="coresPerSocket"` on `NumberSliderInput` without touching the child component.

---

## Data Flow Diagram

```
inputStore (ref() state)
  ├── managementArchitecture: ref<'shared'|'dedicated'>
  ├── managementDomain: ref<ManagementDomain>
  ├── workloadDomains: ref<WorkloadDomain[]>     ← N items
  ├── activeDomainIndex: ref<number>             ← UI only, not serialized
  ├── addDomain()                                 ← action (mutates ref)
  ├── removeDomain(id)                            ← action (mutates ref)
  └── updateDomain(id, patch)                    ← action (mutates ref)
         ↓ reactive read
calculationStore (computed() state)
  ├── management: computed → MgmtDomainResult
  ├── domainResults: computed → Array<DomainResult>   ← maps over workloadDomains
  ├── aggregateTotals: computed → AggregateTotals      ← reduces domainResults
  └── dedicatedMgmtHostCount: computed → number|null
         ↓ read
Components (Vue SFCs)
  ├── DomainTabs.vue              reads activeDomainIndex, workloadDomains.length
  ├── DomainTabPanel.vue          renders by domainId, reads domain from workloadDomains
  ├── Input forms (per domain)    read/write via updateDomain(id, patch)
  └── Results (per domain + agg)  read domainResults[i] + aggregateTotals
         ↓ read
useUrlState.ts (plain TS composable)
  ├── hydrateFromUrl()            writes to inputStore on startup
  └── generateShareUrl()          reads inputStore, serializes workloadDomains array

useMarkdownExport.ts (plain TS composable)
  └── generateMarkdownReport()    reads inputStore + calculationStore
                                  now iterates over domainResults array

usePptxExport.ts (plain TS composable)
  └── generatePptx()              reads inputStore + calculationStore
                                  now generates per-domain slide sections
```

---

## File Change Inventory

### New Files

| File | Purpose |
|------|---------|
| `src/engine/defaults.ts` | `createDefaultWorkloadDomain()` and `createDefaultManagementDomain()` factory functions |
| `src/components/input/DomainTabs.vue` | Tab bar with add/remove domain controls |
| `src/components/input/DomainTabPanel.vue` | Renders one domain's full input form set |
| `src/components/input/ManagementDomainPanel.vue` | Management domain host specs form |
| `src/components/results/DomainResultCard.vue` | Per-domain compute + storage results |
| `src/components/results/AggregateCard.vue` | Cross-domain aggregate totals |

### Modified Files (substantial changes)

| File | Change Summary |
|------|---------------|
| `src/engine/types.ts` | Add `WorkloadDomain`, `ManagementDomain`, `DomainResult`, `AggregateTotals` interfaces |
| `src/stores/inputStore.ts` | Replace flat refs with `managementDomain`, `workloadDomains` array, `activeDomainIndex`; add `addDomain`, `removeDomain`, `updateDomain` actions |
| `src/stores/calculationStore.ts` | Replace flat computeds with `domainResults` (mapped array) + `aggregateTotals` (reduced) |
| `src/composables/useUrlState.ts` | Zod schema restructure: `WorkloadDomainSchema`, `ManagementDomainSchema`, `InputStateSchema` with `z.array()`; rewrite `hydrateFromUrl` and `generateShareUrl` |
| `src/composables/useMarkdownExport.ts` | Iterate over `domainResults` to generate per-domain sections |
| `src/composables/usePptxExport.ts` | Generate per-domain slide sections |
| `src/components/input/HostSpecsForm.vue` | Accept `domainId` prop; read/write via writable computeds |
| `src/components/input/WorkloadProfileForm.vue` | Accept `domainId` prop; read/write via writable computeds |
| `src/components/input/StorageConfigForm.vue` | Accept `domainId` prop; read/write via writable computeds |
| `src/components/input/DeploymentModelSelector.vue` | Accept `domainId` prop; read/write via writable computeds |
| `src/components/results/ResultsPanel.vue` | Render `DomainResultCard` per domain + `AggregateCard` |
| `src/components/results/HostCountCard.vue` | Accept `ComputeResult` as prop rather than reading from store directly |
| `src/components/results/charts/CoresChart.vue` | Multi-domain data series or per-domain chart |
| `src/components/results/charts/RamChart.vue` | Multi-domain data series or per-domain chart |
| `src/components/results/charts/StorageChart.vue` | Multi-domain data series or per-domain chart |

### Unchanged Files

| File | Reason |
|------|--------|
| `src/engine/compute.ts` | Pure function — CALC-01 compliant, called per domain without changes |
| `src/engine/storage.ts` | Pure function — CALC-01 compliant, called per domain without changes |
| `src/engine/stretch.ts` | Pure function — CALC-01 compliant, called per domain without changes |
| `src/engine/management.ts` | Pure function — called once with `managementArchitecture` |
| `src/engine/vsanMax.ts` | Pure function — called per domain when `storageType === 'vsan-max'` |
| `src/engine/validation.ts` | Pure function — called per domain without changes |
| `src/engine/*.test.ts` | Engine tests are pure function tests — no store coupling |
| `src/stores/uiStore.ts` | Locale switching is unaffected |
| `src/components/shared/*.vue` | `NumberSliderInput`, `WarningBanner`, `LanguageSwitcher` unchanged |
| `src/i18n/` | New domain-related i18n keys added but no structural change |

---

## Build Order for Phases

Dependencies flow downward. Each step must be stable before the next begins (TDD discipline: tests first).

### Phase 1 — Foundation: Types + Store Refactor

**Rationale:** Everything downstream depends on this. Must be done first.

1. Add `WorkloadDomain`, `ManagementDomain`, `DomainResult`, `AggregateTotals` to `src/engine/types.ts`
2. Create `src/engine/defaults.ts` with factory functions
3. Rewrite `src/stores/inputStore.ts` (new shape, add/remove/update actions)
4. Rewrite `src/stores/calculationStore.ts` (`domainResults` computed array, `aggregateTotals`)
5. Write unit tests for the new store shape (test that `computed()` maps correctly over array)

**Gate:** `npm run type-check` passes, existing engine tests still pass.

### Phase 2 — URL State: Zod Schema Refactor

**Rationale:** URL state must be updated before the UI is touched. If hydration is broken, sharing breaks. Easier to test in isolation before UI complexity is added.

1. Rewrite `useUrlState.ts`: new `WorkloadDomainSchema`, `InputStateSchema` with `z.array()`
2. Update `hydrateFromUrl()` and `generateShareUrl()`
3. Update `useUrlState.test.ts` — test round-trip for 1 domain, 3 domains, empty array coercion

**Gate:** `npx vitest run src/composables/useUrlState.test.ts` passes.

### Phase 3 — Input UI: Per-Domain Forms

**Rationale:** Input components must be refactored before results can be tested end-to-end. New tab infrastructure is needed for the domain-scoped form components.

1. Add `domainId` prop to all four input form components; replace direct store reads with writable computeds
2. Create `DomainTabs.vue` (tab bar + add/remove)
3. Create `DomainTabPanel.vue` (renders one domain's forms)
4. Create `ManagementDomainPanel.vue` (management host specs)
5. Update layout/App component to render `DomainTabs.vue`

**Gate:** Single-domain UI works identically to v2.x UI. Adding a second domain produces independent inputs.

### Phase 4 — Results UI: Per-Domain + Aggregate

**Rationale:** Results components depend on `domainResults` array shape from Phase 1.

1. Create `DomainResultCard.vue` (reads `domainResults[i]`)
2. Create `AggregateCard.vue` (reads `aggregateTotals`)
3. Modify `ResultsPanel.vue` to iterate over domains
4. Modify chart components for multi-domain data or per-domain rendering
5. Modify `HostCountCard.vue` to accept `ComputeResult` prop

**Gate:** Per-domain results display correctly; aggregate totals match sum.

### Phase 5 — Export: Markdown and PPTX

**Rationale:** Export composables depend on the final shape of `domainResults` from Phase 1 and the store shape from Phase 1-2.

1. Update `useMarkdownExport.ts` — iterate over `domainResults` for per-domain sections
2. Update `usePptxExport.ts` — generate per-domain slide sections
3. Update composable tests

**Gate:** Markdown report contains one section per domain. PPTX contains per-domain slides.

### Phase 6 — i18n Keys

**Rationale:** New UI strings for domain tabs, domain labels, aggregate section headers. Can be done in parallel with Phase 3-4, but gating on other phases ensures all strings are known.

1. Add keys to all four locale files: `domains.add`, `domains.remove`, `domains.management`, `domains.workload`, `domains.aggregate`, etc.
2. Use i18n keys in all new components (never raw English strings — existing project rule)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: ref() in calculationStore

**What:** Adding `ref<DomainResult[]>([])` to `calculationStore.ts` and syncing it from a watcher.
**Why bad:** Violates CALC-02. Creates a second source of truth. Watchers introduce timing bugs.
**Instead:** `computed(() => input.workloadDomains.map(...))` — Vue recomputes on demand, no sync needed.

### Anti-Pattern 2: Per-field computed array in calculationStore

**What:** Creating separate `const domainComputes = computed(...)`, `const domainStorages = computed(...)` arrays.
**Why bad:** Multiplies recomputations. `domainResults` as a single `computed()` that returns a full result object per domain is recomputed atomically once when any domain input changes.
**Instead:** One `domainResults` computed that returns the full enriched domain object per domain.

### Anti-Pattern 3: Spreading reactive store objects into props

**What:** `<DomainTabPanel v-bind="workloadDomains[i]" />` — spreading the domain object as props.
**Why bad:** Vue loses reactivity tracking. Deep mutations no longer trigger updates.
**Instead:** Pass `domainId` as the only prop. Components look up their domain from the store reactively.

### Anti-Pattern 4: Serializing activeDomainIndex to URL

**What:** Including `activeDomainIndex` in the Zod schema and URL state.
**Why bad:** The URL recipient may have a different number of domains loaded. An index of `2` pointing to a non-existent domain causes a silent undefined reference.
**Instead:** Active tab is ephemeral UI state — always resets to index 0 on URL load.

### Anti-Pattern 5: Zod .parse() instead of .safeParse() for URL hydration

**What:** Using `InputStateSchema.parse(parsed)` in `hydrateFromUrl()`.
**Why bad:** `.parse()` throws on invalid input. URL hydration must be silent-fail. Existing code correctly uses `.safeParse()` — must be preserved.
**Instead:** Keep `.safeParse()`. Log warnings to console. Fall back to store defaults.

---

## Scalability Considerations

| Concern | Single Domain (v2.x) | 2-5 Domains (v3.0 target) | 10+ Domains (edge case) |
|---------|---------------------|--------------------------|------------------------|
| `domainResults` recompute cost | One calcCompute call | 2-5 calcCompute calls | 10+ calls — negligible, all synchronous |
| URL length | ~300 chars compressed | ~500-1000 chars compressed | ~2800 chars — still in safe range |
| Tab UI rendering | N/A | Standard tab strip | Scrollable tab strip needed |
| Chart series | 1-series | Multi-series or per-domain toggle | Per-domain toggle recommended |

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| Vue 3 deep reactivity of ref([]) arrays | HIGH | Vue 3 official docs, direct codebase patterns |
| computed() mapping over reactive arrays | HIGH | Vue 3 official docs, established Pinia pattern |
| Zod 4 z.array() with .min() and per-field defaults | HIGH | Zod 4 official docs (zod.dev/api) |
| Zod 4 callable .default(() => fn()) | MEDIUM | Zod docs confirm factory defaults; verify against exact Zod 4.x.x installed |
| lz-string URL length budget | MEDIUM | Manual calculation; actual compression ratio varies with input entropy |
| WritableComputed for v-model in domain forms | HIGH | Vue 3 computed setter pattern, confirmed working in existing codebase |
| storeToRefs() compatibility with array ref | HIGH | Pinia 3 docs confirm storeToRefs() wraps all ref() and reactive() state |

---

## Sources

- Vue 3 Reactivity Fundamentals: https://vuejs.org/guide/essentials/reactivity-fundamentals.html
- Vue 3 Computed Properties (writable): https://vuejs.org/guide/essentials/computed.html#writable-computed
- Pinia Setup Stores: https://pinia.vuejs.org/core-concepts/
- Pinia State: https://pinia.vuejs.org/core-concepts/state.html
- Zod 4 Arrays: https://zod.dev/api (z.array section)
- Zod 4 Object .strip(): https://zod.dev/api (z.object section)
- Existing codebase: direct inspection of inputStore.ts, calculationStore.ts, useUrlState.ts, engine/types.ts
