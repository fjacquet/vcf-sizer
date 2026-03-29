# Architecture Research — v2.0 Integration

**Domain:** VCF 9.x Sizing Calculator SPA — v2.0 Feature Integration
**Researched:** 2026-03-29
**Confidence:** HIGH for integration patterns (based on direct code inspection); MEDIUM for vSAN Max specs (WebSearch + official blog, not yet in Context7); HIGH for stretch network requirements (Broadcom TechDocs).
**Replaces:** Prior ARCHITECTURE.md (v1 research, 2026-03-28)

---

## Context: What This Document Covers

This is the v2.0 milestone architecture document. It answers four specific integration questions for the roadmapper:

1. Where does vSAN Max fit — new StorageType or separate engine function?
2. Where does Standard vs Consolidated fit — new DeploymentMode, a flag, or validation guidance?
3. Where does the stretch network checklist live?
4. What is the correct build order for these four features?

All answers are grounded in direct inspection of the existing engine code, not assumptions.

---

## Existing Architecture Summary

The engine follows a clean unidirectional pattern:

```
inputStore (ref() only)
    ↓
calculationStore (computed() only — CALC-02 rule)
    ↓
engine/*.ts pure functions (ZERO Vue imports — CALC-01 rule)
```

Current engine surface:
- `types.ts` — type definitions, zero logic
- `management.ts` — `calcManagement(mode: DeploymentMode)`
- `compute.ts` — `calcCompute(inputs: ComputeInputs)`
- `storage.ts` — `calcStorage(inputs: StorageInputs)` + `vsanEsaRaidOverhead()`
- `stretch.ts` — `calcStretch(inputs: StretchInputs)`
- `validation.ts` — `validateInputs(inputs: ValidationInputs)`

Current type surface:
- `DeploymentMode`: `'simple' | 'ha' | 'stretch'`
- `StorageType`: `'vsan-esa' | 'fc' | 'nfs'`
- `StretchResult`: 5 fields — no network checklist yet
- `StorageInputs`: no vSAN Max concept yet

---

## Question 1: vSAN Max — New StorageType or Separate Function?

### Verdict: New StorageType value + new dedicated engine function

**Rationale:**

vSAN Max (officially "vSAN Storage Clusters" in VCF 9.0) is architecturally distinct from vSAN ESA HCI in one critical way: **the storage cluster hosts run storage only, and the compute hosts are decoupled**. This means:

- `calcStorage()` with `storageType: 'vsan-esa'` models HCI hosts (compute + storage combined).
- vSAN Max requires sizing **two separate node pools**: storage cluster nodes (vSAN Max ReadyNodes) and compute cluster nodes (plain vSphere hosts, no vSAN requirements).

Adding `'vsan-max'` as a new value to the existing `StorageType` union type is the correct entry point. However, the logic inside `calcStorage()` for vSAN Max is **entirely different** from the vSAN ESA HCI path — it does not share LFS overhead, metadata overhead, or the RAID threshold logic from the HCI path.

**Recommended split:**

```
types.ts:
  StorageType = 'vsan-esa' | 'fc' | 'nfs' | 'vsan-max'   ← add 'vsan-max'
  VsanMaxInputs { ... }                                    ← new type
  VsanMaxResult { ... }                                    ← new type

engine/vsanMax.ts:
  calcVsanMax(inputs: VsanMaxInputs): VsanMaxResult        ← new pure function

storage.ts:
  calcStorage() gains a guard:
    if (storageType === 'vsan-max') → delegate to calcVsanMax() or return stub
  (Option: keep storage.ts as router, vsanMax.ts as implementation)
```

**Why not extend `calcStorage()` with vSAN Max logic inline?**

`calcStorage()` is already 170 lines; adding a completely different code path for vSAN Max would make it 300+ lines mixing two unrelated models. The existing function's formula stack (rawCapacity, RAID overhead, LFS, metadata, stretch factor) is meaningless for vSAN Max. A dedicated `vsanMax.ts` file is cleaner, independently testable, and consistent with the existing pattern of `stretch.ts` being a separate file.

**What `VsanMaxInputs` needs:**

vSAN Max sizing is based on ReadyNode profiles. The tool should model the storage cluster nodes separately from the compute cluster nodes. Minimum required inputs:

```typescript
export interface VsanMaxInputs {
  // Storage cluster (vSAN Max nodes)
  storageNodeProfile: 'xs' | 'sm' | 'med' | 'lrg' | 'xl'  // maps to ReadyNode profile
  storageNodeCount: number   // minimum 4
  // Compute cluster (client hosts — no vSAN requirement)
  computeNodeCount: number
  computeNodeRamGB: number
  computeNodeCoresPerSocket: number
  computeNodeSocketsPerHost: number
  // Workload
  vmCount: number
  avgStorageGbPerVm: number
}
```

**ReadyNode profile constants (sourced from VMware blog, Nov 2025):**

| Profile | Capacity/host | Min Cores | Min RAM | Network |
|---------|--------------|-----------|---------|---------|
| vSAN-Max-XS | 20 TB | 24 | — | 10 GbE |
| vSAN-Max-SM | 50 TB | 32 | 384 GB | 25 GbE |
| vSAN-Max-MED | 100 TB | 40 | 512 GB | 100 GbE |
| vSAN-Max-LRG | 150 TB | 48 | 768 GB | 100 GbE |
| vSAN-Max-XL | 200 TB | 64 | 1 TB | 100 GbE |

These belong as constants inside `vsanMax.ts`, not in the UI.

**What `VsanMaxResult` should return:**

```typescript
export interface VsanMaxResult {
  // Storage cluster totals
  rawStorageCapacityTB: number
  usableStorageCapacityTB: number   // after RAID-5/6 overhead — same ESA thresholds apply
  storageNodeMinCount: number        // minimum 4
  storageNetworkRequired: string     // e.g. '25 GbE' — derived from profile
  // Compute cluster totals (separate sizing from storage)
  computeAvailableCores: number
  computeAvailableRamGB: number
  computeRecommendedHostCount: number
  // Combined
  minStorageNodeCount: number
}
```

**Key architectural point:** vSAN Max compute cluster hosts do NOT need to satisfy the VCFA 12-core minimum in `validateInputs()` for vSAN compatibility — they only need to satisfy the VCFA host spec for running VCF management VMs. The RAID overhead math (ESA Adaptive RAID-5 thresholds) still applies to the storage cluster nodes themselves.

**Backward compatibility:** `calcStorage()` callers pass `storageType` from `inputStore.storageType`. Adding `'vsan-max'` to the `StorageType` union requires no changes to existing callers as long as `calcStorage()` routes vSAN Max to the new function. The store will expose a new `vsanMax` computed result alongside existing `storage` computed.

---

## Question 2: Standard vs Consolidated Architecture

### Verdict: Validation guidance + suggested minimum host count — NOT a new DeploymentMode

**Rationale:**

Standard vs Consolidated is no longer an official VCF 9.0 architectural designation. Broadcom community discussions confirm the terminology was retired to reduce confusion, and VCF 9.0 instead describes a spectrum from single-cluster (management + workload co-located) to multi-domain (dedicated management cluster + separate workload domains).

However, the sizing impact is concrete and must be modelled: a **dedicated management cluster requires a minimum of 4 hosts** when running all management appliances in HA mode (3 active + 1 for N+1 tolerance during rolling maintenance). This is not a binary toggle — it is a constraint that emerges from the management domain compute requirements.

**Recommended approach:**

1. Add a `managementArchitecture` field to `ComputeInputs` (optional, defaults to `'shared'`):

   ```typescript
   export type ManagementArchitecture = 'shared' | 'dedicated'
   ```

   - `'shared'`: Management VMs co-reside with workload VMs on the same cluster. Tool adds management overhead to workload host count as it does today.
   - `'dedicated'`: Management VMs run on a separate dedicated management cluster. Tool outputs a second host count recommendation specifically for the management cluster.

2. Add a new validation rule in `validateInputs()`:

   ```
   DEDICATED_MGMT_MIN_HOSTS: when managementArchitecture === 'dedicated' && hostCount < 4
   → error: 'validation.dedicatedMgmtMinHosts'
   ```

3. `calcManagement()` already returns the resource totals. For dedicated mode, the calculationStore exposes a `dedicatedMgmtHostCount` computed:

   ```typescript
   const dedicatedMgmtHostCount = computed(() => {
     if (input.managementArchitecture !== 'dedicated') return null
     return Math.max(4, Math.ceil(management.value.totalCores / (input.coresPerSocket * input.socketsPerHost)))
   })
   ```

**Why not a new DeploymentMode?**

`DeploymentMode` (`'simple'|'ha'|'stretch'`) models **HA redundancy behavior**, not cluster topology. Adding `'standard'` or `'consolidated'` as DeploymentMode values would cause these to flow through `calcCompute()`, `calcManagement()`, `calcStretch()`, and `validateInputs()` unchanged or incorrectly. The management architecture concept maps cleanly to validation guidance and a secondary host count output — it does not change the core compute, storage, or stretch formulas.

**New type additions to `types.ts`:**

```typescript
export type ManagementArchitecture = 'shared' | 'dedicated'

// Add to ComputeInputs (optional — all existing callers unaffected):
managementArchitecture?: ManagementArchitecture   // default 'shared'

// Add to ValidationInputs:
managementArchitecture?: ManagementArchitecture   // default 'shared'
dedicatedMgmtHostCount?: number                  // for min-4 check

// New output field in ComputeResult:
dedicatedMgmtRecommendedHosts?: number  // null when 'shared'
```

---

## Question 3: Stretch Network Checklist

### Verdict: Extend `StretchResult` type + surface in the stretch output section — no new component

**Rationale:**

The network checklist (MTU 9000, <5ms RTT, <200ms witness RTT, 10 Gbps floor) is **deterministic derived data** from the stretch configuration. It is not user input. It does not require a new engine function. It belongs in `StretchResult` as additional fields, then displayed in the existing stretch output section.

**Current `StretchResult` gaps:**

The existing `calcStretch()` has a critical bug: `minBandwidthGbps` has no floor. Current formula:
```
minBandwidthGbps = totalWorkloadStorageTB × 0.1
```
For a small workload (e.g. 20 TB), this returns `2 Gbps` — which is below the VCF 9.0 official minimum of 10 Gbps for stretch inter-site links. The bandwidth floor patch is confirmed by Broadcom TechDocs.

**Extended `StretchResult` fields:**

```typescript
export interface StretchResult {
  // Existing fields (unchanged)
  totalHosts: number
  witnessCores: number
  witnessRamGB: number
  minBandwidthGbps: number         // PATCHED: max(computed, 10.0)
  effectivePerSiteStorageTB: number
  storageNote: string

  // New fields (network checklist)
  bandwidthFloorApplied: boolean   // true when formula result < 10 Gbps
  networkChecklist: StretchNetworkChecklist  // i18n keys + values
}

export interface StretchNetworkChecklist {
  minInterSiteBandwidthGbps: number   // always 10 (Broadcom TechDocs minimum)
  maxInterSiteLatencyMs: number       // always 5 (RTT)
  maxWitnessLatencyMs: number         // 200 for ≤10 hosts/site, 100 for 11–15 hosts/site
  jumboFramesRequired: boolean        // true — MTU 9000 recommended for vSAN traffic
  witnessMinBandwidthMbps: number     // 2 Mbps per 1000 components; expose raw value
}
```

**Why in `StretchResult` and not a separate component?**

The existing `StretchClusterPanel.vue` and the stretch section of the output panel already conditionally render when `deploymentMode === 'stretch'`. Adding network checklist fields to `StretchResult` means the display component can simply iterate the checklist — no new store computed, no new engine function. A dedicated `StretchNetworkChecklist.vue` output component is warranted for the UI (reusable, independently testable) but it reads from `calculationStore.stretch.networkChecklist` — no new store slice needed.

**The 10 Gbps floor patch to `calcStretch()`:**

```typescript
// BEFORE (current — incorrect for small workloads):
const minBandwidthGbps = new Decimal(totalWorkloadStorageTB).times(0.1).toNumber()

// AFTER (correct — floor enforced per Broadcom TechDocs):
const STRETCH_MIN_BANDWIDTH_GBPS = 10  // VCF 9.0 absolute minimum
const calculatedBandwidthGbps = new Decimal(totalWorkloadStorageTB).times(0.1).toNumber()
const minBandwidthGbps = Math.max(calculatedBandwidthGbps, STRETCH_MIN_BANDWIDTH_GBPS)
const bandwidthFloorApplied = calculatedBandwidthGbps < STRETCH_MIN_BANDWIDTH_GBPS
```

This is a bug fix, not a new feature. It must happen in the same commit as adding the `bandwidthFloorApplied` field to `StretchResult` so the type change and the behavior change are atomic.

---

## Question 4: Build Order

### Verdict: Bandwidth floor → Stretch checklist → Standard/Consolidated → vSAN Max

**Dependency graph:**

```
Feature A: Bandwidth floor patch (1 function, 1 type change, 1 constant)
    No dependencies — can go first
    Risk: LOW (single formula change + new boolean field)
    Test: calcStretch({ vmCount: 50, avgStorageGbPerVm: 100 }) → minBandwidthGbps === 10

Feature B: Stretch network checklist (extends Feature A's StretchResult)
    Depends on: Feature A (needs bandwidthFloorApplied + extended StretchResult)
    Risk: LOW (data derived from inputs already in StretchInputs)
    Test: calcStretch returns valid StretchNetworkChecklist with all required fields

Feature C: Standard/Consolidated (ManagementArchitecture flag)
    Depends on: types.ts changes (new type), validation.ts (new rule)
    No dependency on A or B
    Risk: LOW (optional field, all existing callers unaffected)
    Parallel to B after A is done

Feature D: vSAN Max (new StorageType + new engine file)
    Depends on: types.ts (StorageType union extension, VsanMaxInputs, VsanMaxResult)
    No dependency on A, B, or C
    Risk: MEDIUM (new engine file, new store computed, new UI section)
    Can parallel C after type foundation is laid
```

**Recommended sequential order:**

```
Step 1 — types.ts foundation
  - Add 'vsan-max' to StorageType
  - Add ManagementArchitecture type
  - Add VsanMaxInputs, VsanMaxResult interfaces
  - Extend StretchResult with bandwidthFloorApplied + StretchNetworkChecklist
  - Extend ComputeInputs + ValidationInputs with optional managementArchitecture
  All type changes are additive — zero breaking changes to existing callers.

Step 2 — Bandwidth floor patch (smallest, highest safety ratio)
  - Patch calcStretch() with STRETCH_MIN_BANDWIDTH_GBPS = 10 constant
  - Add bandwidthFloorApplied to returned StretchResult
  - Unit test: small workload produces 10 Gbps floor + bandwidthFloorApplied=true
  Rationale: This is a correctness bug fix. Ship it before any new features.

Step 3 — Stretch network checklist (extends Step 2)
  - Add StretchNetworkChecklist population to calcStretch()
  - Derive witness latency threshold from per-site host counts (≤10 hosts → 200ms, 11-15 → 100ms)
  - Extend calculationStore to expose stretch.networkChecklist
  - Add StretchNetworkChecklist.vue output component (reads from calculationStore.stretch)
  - i18n keys for all checklist labels

Step 4 — Standard/Consolidated validation (independent of Steps 2-3)
  - Add DEDICATED_MGMT_MIN_HOSTS validation rule to validateInputs()
  - Extend calculationStore with dedicatedMgmtHostCount computed
  - Add managementArchitecture toggle to DeploymentModePanel or HostSpecPanel
  - i18n keys for new validation message

Step 5 — vSAN Max engine (independent of Steps 2-4)
  - Create engine/vsanMax.ts with ReadyNode profile constants + calcVsanMax()
  - Update calcStorage() to route 'vsan-max' to calcVsanMax()
  - Extend inputStore with vsanMaxNodeProfile + vsanMaxNodeCount + vsanMaxComputeNodeCount
  - Extend calculationStore with vsanMax computed
  - Add VsanMaxPanel.vue input component (visible when storageType === 'vsan-max')
  - Add VsanMaxResult.vue output component
  - Validation: vsanMaxNodeCount < 4 → error

Step 6 — Integration + human verification
  - End-to-end scenario test: stretch cluster with small workload shows 10 Gbps floor
  - Verify network checklist renders correctly in all 4 locales
  - Verify dedicated management outputs separate host count recommendation
  - Verify vSAN Max profile selection changes storage capacity correctly
```

---

## Component Boundary Map for v2.0

### Modified files (existing, no renames)

| File | Change Type | What Changes |
|------|------------|--------------|
| `engine/types.ts` | Additive | 4 new types/interfaces, 2 union extensions, optional fields on existing types |
| `engine/stretch.ts` | Bug fix + additive | Bandwidth floor constant, `bandwidthFloorApplied`, `networkChecklist` in return |
| `engine/validation.ts` | Additive | 1 new validation rule (DEDICATED_MGMT_MIN_HOSTS) |
| `engine/storage.ts` | Additive | Guard clause routing `'vsan-max'` to `calcVsanMax()` |
| `stores/inputStore.ts` | Additive | New refs: `managementArchitecture`, `vsanMaxNodeProfile`, `vsanMaxNodeCount`, `vsanMaxComputeNodeCount` |
| `stores/calculationStore.ts` | Additive | New computed: `dedicatedMgmtHostCount`, `vsanMax` |

### New files

| File | Purpose |
|------|---------|
| `engine/vsanMax.ts` | `calcVsanMax()` pure function, ReadyNode profile constants, `VsanMaxInputs`, `VsanMaxResult` |
| `components/output/StretchNetworkChecklist.vue` | Network requirements display, reads from `calculationStore.stretch.networkChecklist` |
| `components/input/VsanMaxPanel.vue` | vSAN Max node profile selector, storage + compute node count inputs |
| `components/output/VsanMaxResult.vue` | Storage cluster + compute cluster sizing output |

### Files with ZERO changes

| File | Reason |
|------|--------|
| `engine/compute.ts` | No change — vSAN Max compute sizing happens in vsanMax.ts |
| `engine/management.ts` | No change — management constants are stable |
| `stores/calculationStore.ts` existing computeds | Existing `management`, `compute`, `storage`, `stretch`, `validationErrors` computeds are unchanged |

---

## Data Flow for New Features

### vSAN Max Flow

```
inputStore.storageType === 'vsan-max'
  + inputStore.vsanMaxNodeProfile (xs|sm|med|lrg|xl)
  + inputStore.vsanMaxNodeCount
  + inputStore.vsanMaxComputeNodeCount
    ↓ (calculationStore)
calcVsanMax(vsanMaxInputs)
    ↓
calculationStore.vsanMax (computed)
    ↓
VsanMaxPanel.vue (input) ← v-model → inputStore
VsanMaxResult.vue (output) ← reads → calculationStore.vsanMax
```

### Standard/Consolidated Flow

```
inputStore.managementArchitecture ('shared'|'dedicated')
    ↓ (calculationStore)
management.value.totalCores (existing)
  + input.coresPerSocket × input.socketsPerHost
  → Math.max(4, Math.ceil(mgmtCores / coresPerHost))
    ↓
calculationStore.dedicatedMgmtHostCount (new computed, null when 'shared')
    ↓
SummaryCard or new DedicatedMgmtCard reads it
```

### Stretch Network Checklist Flow

```
inputStore.preferredSiteHosts + secondarySiteHosts (existing)
inputStore.vmCount + avgStorageGbPerVm (existing)
    ↓ (calcStretch — patched)
StretchResult.bandwidthFloorApplied (new)
StretchResult.networkChecklist (new)
    ↓
calculationStore.stretch (existing computed — now returns extended result)
    ↓
StretchNetworkChecklist.vue reads calculationStore.stretch.networkChecklist
```

---

## Backward Compatibility Analysis

All four changes are **additive-only** to existing types. No existing call site requires modification:

| Change | Additive? | Breaking? | Mitigation |
|--------|-----------|-----------|------------|
| `StorageType` union + `'vsan-max'` | Yes | NO — TypeScript will require exhaustive switch updates only in places that already switch on StorageType | Add `'vsan-max'` branch to all existing switches; `calcStorage()` already handles non-vsan-esa via early return |
| `ManagementArchitecture` optional field | Yes | NO — optional with `? =` default | All existing callers pass no `managementArchitecture` → default `'shared'` → existing behavior preserved |
| `StretchResult` new fields | Yes | NO — new fields added to interface | Existing consumers only destructure fields they need; new fields are ignored |
| `ComputeInputs` optional field | Yes | NO — optional field pattern already established (see `nvmeTieringEnabled?`) | Same pattern used for Phase 3 additions |

---

## Pitfalls Specific to v2.0 Integration

### Pitfall A: vSAN Max RAID overhead reuse confusion

**Risk:** Developer assumes vSAN Max uses the same `vsanEsaRaidOverhead()` function as HCI vSAN ESA. This is partially correct — vSAN Max storage cluster nodes also use ESA Adaptive RAID-5 thresholds — but the input is the **storage node count** not the HCI host count.

**Prevention:** `calcVsanMax()` must call `vsanEsaRaidOverhead(storageNodeCount, ...)`, not the HCI `hostCount`. These are different cluster sizes.

### Pitfall B: Management architecture flag affecting existing stretch logic

**Risk:** If `ManagementArchitecture` is threaded through `calcCompute()` it could accidentally interact with the `stretchMultiplier` (which doubles management overhead for stretch). For dedicated mode, the management cluster is a separate entity and should NOT be doubled.

**Prevention:** `managementArchitecture` must NOT be passed to `calcCompute()` or `calcManagement()`. It only affects `validateInputs()` and the new `dedicatedMgmtHostCount` computed in `calculationStore`. The existing management cost doubling in `calcCompute()` represents the second site's full management stack — this is correct for stretch and must remain unchanged.

### Pitfall C: Bandwidth floor shown as a new feature rather than a bug fix

**Risk:** If the bandwidth floor patch ships in a UI-visible way that suggests the tool previously recommended < 10 Gbps (which it did), it may cause confusion or erode trust in existing shared URLs.

**Prevention:** The patch should be atomic: fix the formula AND add `bandwidthFloorApplied` simultaneously. Display `bandwidthFloorApplied: true` with an info note: "Minimum 10 Gbps floor applied per VCF 9.0 specification." This communicates the correction transparently.

### Pitfall D: StretchNetworkChecklist witness latency thresholds

**Risk:** The witness latency threshold is not constant — it is 200ms for ≤10 hosts/site and 100ms for 11–15 hosts/site. Hardcoding 200ms always is wrong for larger deployments.

**Prevention:** `calcStretch()` must derive `maxWitnessLatencyMs` from `Math.max(preferredSiteHosts, secondarySiteHosts)`:
- ≤ 10 hosts/site → 200ms
- 11–15 hosts/site → 100ms
- > 15 hosts/site → document as "contact VMware" (out of range)

---

## Updated System Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser SPA (No Backend)                     │
├───────────────────────────────┬────────────────────────────────────┤
│         INPUT PANEL           │           OUTPUT PANEL             │
│  ┌────────────────────────┐   │  ┌─────────────────────────────┐   │
│  │  DeploymentModePanel   │   │  │ SummaryCard / DedicatedMgmt │   │
│  │  + MgmtArchToggle (v2) │   │  │ CoreResult / RAMResult      │   │
│  │  HostSpecPanel         │   │  │ StorageResult / VsanMaxResult│   │
│  │  WorkloadPanel         │   │  │ StretchNetworkChecklist (v2) │   │
│  │  StoragePanel          │   │  └─────────────────────────────┘   │
│  │  + VsanMaxPanel   (v2) │   │  ┌─────────────────────────────┐   │
│  │  StretchClusterPanel   │   │  │      ChartPanel              │   │
│  └────────────────────────┘   │  └─────────────────────────────┘   │
├───────────────────────────────┴────────────────────────────────────┤
│                        STATE LAYER (Pinia)                          │
│  ┌──────────────────┐  ┌───────────────────────────────────────┐   │
│  │  inputStore      │  │  calculationStore                     │   │
│  │  + mgmtArch (v2) │  │  + dedicatedMgmtHostCount (v2)        │   │
│  │  + vsanMaxProfile│  │  + vsanMax (v2)                       │   │
│  │  + vsanMaxNodes  │  │  stretch.networkChecklist (v2)        │   │
│  └──────────────────┘  └───────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────────┤
│                     CALCULATION ENGINE (Pure TS)                    │
│  ┌──────────────┐  ┌────────────┐  ┌──────────┐  ┌────────────┐   │
│  │ management   │  │ compute    │  │ storage  │  │ stretch    │   │
│  │ (unchanged)  │  │ (unchanged)│  │ (+ route)│  │ (patched)  │   │
│  └──────────────┘  └────────────┘  └──────────┘  └────────────┘   │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ vsanMax.ts (NEW v2) — ReadyNode profiles + calcVsanMax()      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐                                                   │
│  │ validation   │  ← +DEDICATED_MGMT_MIN_HOSTS rule (v2)           │
│  └──────────────┘                                                   │
└────────────────────────────────────────────────────────────────────┘
```

---

## Phase Structure Recommendation for Roadmapper

Based on the dependency graph and risk analysis above, the four features should map to two phases:

**Phase v2.0-A: Correctness (low risk, bug fixes + additive types)**
- types.ts foundation (all additive changes)
- Bandwidth floor patch in calcStretch() — correctness bug
- Stretch network checklist in StretchResult + StretchNetworkChecklist.vue
- Standard/Consolidated: ManagementArchitecture flag + validation rule + dedicatedMgmtHostCount computed
- i18n keys for new content

**Phase v2.0-B: vSAN Max (medium risk, new engine file + new UI)**
- engine/vsanMax.ts — new pure function, ReadyNode constants
- calcStorage() routing guard
- inputStore new refs, calculationStore new computed
- VsanMaxPanel.vue + VsanMaxResult.vue
- Validation: min 4 storage nodes
- i18n keys

**Rationale for split:** Phase v2.0-A contains only patches and additive type extensions to existing code — it is safe to ship without vSAN Max. Phase v2.0-B introduces a fully new engine subsystem with new UI. Separating them means v2.0-A can be verified and deployed while v2.0-B is still being built without blocking correctness improvements.

---

## Confidence Assessment

| Topic | Confidence | Source |
|-------|------------|--------|
| Integration pattern (additive types) | HIGH | Direct code inspection of all 6 engine files |
| vSAN Max ReadyNode profiles | MEDIUM | VMware blog post (Nov 2025) + search results; not yet verified in Context7 |
| vSAN Max minimum 4 hosts | HIGH | Multiple VMware sources agree |
| 10 Gbps stretch floor | HIGH | Broadcom TechDocs VCF 9.0 bandwidth requirements + independent Medium article |
| Witness latency thresholds | HIGH | Broadcom TechDocs (200ms ≤10 hosts, 100ms 11-15 hosts) |
| Standard vs Consolidated retirement in VCF 9 | MEDIUM | Broadcom community forum + search results; no official TechDocs confirmation found |
| ManagementArchitecture 4-host minimum | MEDIUM | Derived from management overhead math; no explicit "4 dedicated hosts" rule found in VCF 9 official docs |
| Build order (steps 1-6) | HIGH | Derived from dependency analysis of actual code |

---

## Sources

- Direct inspection: `/Users/fjacquet/Projects/vcf-sizer/src/engine/types.ts`
- Direct inspection: `/Users/fjacquet/Projects/vcf-sizer/src/engine/stretch.ts`
- Direct inspection: `/Users/fjacquet/Projects/vcf-sizer/src/engine/storage.ts`
- Direct inspection: `/Users/fjacquet/Projects/vcf-sizer/src/engine/compute.ts`
- Direct inspection: `/Users/fjacquet/Projects/vcf-sizer/src/engine/validation.ts`
- Direct inspection: `/Users/fjacquet/Projects/vcf-sizer/src/engine/management.ts`
- Direct inspection: `/Users/fjacquet/Projects/vcf-sizer/src/stores/calculationStore.ts`
- Direct inspection: `/Users/fjacquet/Projects/vcf-sizer/src/stores/inputStore.ts`
- [Broadcom TechDocs — Bandwidth and Latency Requirements, VCF 9.0](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/vsan-deployment-administration-and-monitoring/vsan-network-design/understanding-vsan-networking/network-requirements-for-vsan/bandwidth-and-latency-requirements.html) — HIGH confidence
- [vSAN HCI or Storage Clusters — VMware Cloud Foundation Blog (2024)](https://blogs.vmware.com/cloud-foundation/2024/01/22/vsan-hci-or-storage-clusters-which-deployment-option-is-right-for-you/) — HIGH confidence
- [Greater Flexibility with vSAN Max through Lower Hardware and Cluster Requirements — VMware Blog (2024)](https://blogs.vmware.com/cloud-foundation/2024/03/13/greater-flexibility-with-vsan-max-through-lower-hardware-and-cluster-requirements/) — MEDIUM confidence (pre-VCF-9.0 article; specs confirmed consistent with Nov 2025 search results)
- [ReadyNode Profiles Certified for vSAN Max — VMware Blog (2023)](https://blogs.vmware.com/cloud-foundation/2023/10/02/readynode-profiles-certified-for-vsan-max/) — MEDIUM confidence
- [Driving Down Storage Costs with Lower Hardware Requirements for vSAN — VMware Blog (Nov 2025)](https://blogs.vmware.com/cloud-foundation/2025/11/14/driving-down-storage-costs-with-lower-hardware-requirements-for-vsan/) — HIGH confidence (current)
- [Strategic Bandwidth Sizing for vSAN Stretched Clusters in VCF 9.0 — Medium (Lubomir Tobek)](https://medium.com/@lubomir-tobek/strategic-bandwidth-sizing-for-vsan-stretched-clusters-in-vcf-9-0-a-roadmap-to-resilience-ce55545b96a2) — MEDIUM confidence (community, consistent with TechDocs)
- [VCF Consolidated/Standard Architecture discussion — Broadcom Community](https://community.broadcom.com/vmware-cloud-foundation/discussion/vcf-consolidatedstandard-architecure) — MEDIUM confidence (community forum, VCF 4.x framing)

---

*Architecture research for: VCF Sizer v2.0 — vSAN Max + Standard/Consolidated + Stretch Fixes*
*Researched: 2026-03-29*
*Scope: Integration architecture for milestone v2.0 — subsequent milestone on existing codebase*
