# Management Domain Parity — Design Spec

**Status:** Draft for review
**Date:** 2026-04-28
**Reference:** `docs/vcf-9.0-planning-and-preparation-workbook.xlsx` ("Management Domain Sizing" tab)
**Target milestone:** `v3.5 — Management Domain Parity` (candidate `v4.0` if treated as breaking)

---

## 1. Goal & non-goals

### Goal

Bring `vcf-sizer`'s management-domain model to **full functional parity with VMware's VCF 9.0 Planning and Preparation workbook**, while extending storage flexibility beyond what VMware ships out-of-the-box.

### Non-goals

- Workload-domain sizing rework (untouched).
- IP/DNS/AD planning sheets (out of scope).
- Cluster image / VLCM tooling (out of scope).
- Per-WLD overhead toggles for NSX Edge / AVI / SSP (auto-derive only — see §4.3).

---

## 2. Decisions locked during brainstorming

| # | Decision | Pick |
|---|---|---|
| Q1 | Scope | **D — match-and-extend.** Full component coverage + storage breadth differentiation. |
| Q2 | Sizing UX | **c — hybrid.** Profile preset (Lab / Standard / Large) with per-component overrides for power users. |
| Q3 | Per-WLD overhead | **a — auto-derived.** Each WLD contributes 1 vCenter + 1 NSX Manager cluster, sized from the WLD's existing config. No per-WLD knobs. |
| Q4 | Optional appliance categories | **Standard.** Model 10 categories. ON by default: { NSX Edge, AVI Load Balancer, vRLI, vRNI }. OFF by default: { Identity Broker (WSA), SSP, SRM, Ransomware Recovery on-prem, Ransomware Recovery cloud, HCX }. |
| Q5 | Storage modeling | **e — full matrix.** All 4 of `vsan-esa | fc | nfs | vsan-max` valid for mgmt. Lift the `ManagementStorageType = Exclude<StorageType, 'vsan-max'>` constraint. |
| Q6 | UI placement | **a — extend Step 2 in place** with collapsible sections. Wizard stays at 3 steps. |
| Code structure | Approach | **3 — decomposed `mgmt/` subsystem.** Multiple small files under `src/engine/mgmt/`. |

---

## 3. Architecture & module boundaries

```
src/engine/mgmt/
├── types.ts          # ManagementDomainConfig, MgmtDomainResult, ApplianceLine, MgmtProfile, ApplianceOverride
├── constants.ts      # VMware sizing tables (frozen, sourced from Static Reference Tables sheet)
├── profiles.ts       # 'lab' | 'standard' | 'large' → per-appliance default size + included flag + nodeCount
├── appliances.ts     # calcAppliances(config) → ApplianceLine[] for the 13 modeled categories
├── wldOverhead.ts    # calcWldOverhead(wlds[]) → ApplianceLine[] (1 vCenter + 1 NSX Mgr cluster per WLD, auto-sized)
├── storage.ts        # mgmtStorageDemand(totals, storageType, fttLevel, reservePct, growthPct) → demand TiB / external-pool TiB
├── hostMath.ts       # perHostRequirements({totalCores,totalRam,demand,hosts,oversubCpu,oversubRam}) — N-1 model
├── validation.ts     # mgmt-specific validation rules; returns ValidationWarning[] with i18n message keys
└── index.ts          # public calcManagement(config, wlds) orchestrator
```

### Public API

```ts
function calcManagement(
  config: ManagementDomainConfig,
  wlds: WorkloadDomainConfig[]
): MgmtDomainResult
```

### Engine constraints (preserved)

- Pure TS only — every file in `mgmt/` has zero Vue / Pinia / i18n imports (CALC-01).
- All arithmetic uses `Decimal.js` to avoid IEEE 754 drift (PITFALLS #1).
- Validation messages return `messageKey: string` (i18n key), never raw English (existing convention).
- `calculationStore.ts` stays `computed()`-only (CALC-02).

### File-size targets

Every `mgmt/*.ts` aims for < 200 lines. `constants.ts` may exceed (pure tables). If any file grows past ~250 lines during implementation, split further.

### Backward-compat shim

`src/engine/management.ts` keeps exporting `calcManagement(mode: DeploymentMode)` as a thin wrapper that builds a default `ManagementDomainConfig` from `mode` + Standard profile + Standard appliance defaults, then calls the new API. Existing callers and tests stay green during the transition. The shim is removed only after every callsite migrates.

---

## 4. Data model

### 4.1 `ManagementDomainConfig`

```ts
export type MgmtProfile = 'lab' | 'standard' | 'large'
export type ApplianceSize = 'tiny' | 'small' | 'medium' | 'large' | 'xlarge'
export type NsxEdgeSize = 'small' | 'medium' | 'large' | 'xlarge'
export type SspSize = 'medium' | 'large' | 'xlarge'
export type SrmSize = 'light' | 'standard'

export interface ApplianceOverride {
  included?: boolean      // toggle in/out (defaults from profile)
  size?: ApplianceSize | NsxEdgeSize | SspSize | SrmSize
  nodeCount?: number      // override deployment count
}

export interface ManagementDomainConfig {
  // Hardware
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTiB: number
  deploymentMode: DeploymentMode
  storageType: StorageType            // includes 'vsan-max' (exclusion lifted)

  // FC/NFS-only
  externalStorageUsableTiB?: number

  // vSAN-Max-for-mgmt only
  vsanMaxStorageNodes?: number
  vsanMaxProfile?: VsanMaxProfile

  // Capacity headroom (VMware workbook inputs)
  cpuOversubscription: number         // default 2 (= 2:1)
  ramOversubscription: number         // default 1 (= 1:1)
  reservePct: number                  // default 30
  growthPct: number                   // default 10

  // Sizing UX
  profile: MgmtProfile                // default 'standard'

  // Sparse — empty {} = "use profile defaults everywhere"
  overrides: {
    vcenter?: ApplianceOverride
    nsxManager?: ApplianceOverride
    nsxEdge?: ApplianceOverride
    aviLb?: ApplianceOverride
    vrops?: ApplianceOverride
    vropsCollector?: ApplianceOverride
    vrli?: ApplianceOverride
    vrni?: ApplianceOverride
    vrniCollector?: ApplianceOverride
    automation?: ApplianceOverride
    fleetManager?: ApplianceOverride
    identityBroker?: ApplianceOverride
    ssp?: ApplianceOverride
  }

  // Validated solutions
  validatedSolutions: {
    siteProtection:    { included: boolean; mgmtSize?: SrmSize }
    ransomwareOnPrem:  { included: boolean }
    ransomwareCloud:   { included: boolean }
    crossCloudMobility:{ included: boolean }   // HCX
  }
}
```

### 4.2 `MgmtDomainResult`

```ts
export interface ApplianceLine {
  category: string                    // i18n key, e.g. 'mgmt.appliance.vcenter'
  nodeCount: number
  cores: number                       // per-node
  ramGB: number                       // per-node
  diskGB: number                      // per-node
  totalCores: number                  // nodeCount × cores
  totalRamGB: number
  totalDiskGB: number
  source: 'profile' | 'override' | 'auto-derived' | 'validated-solution'
}

export interface MgmtDomainResult {
  appliances: ApplianceLine[]
  wldOverhead: ApplianceLine[]

  totalCores: number
  totalRamGB: number
  totalDiskGB: number
  totalSwapGB: number                 // = totalRamGB

  perHostCores: number                // ROUNDUP(totalCores / (hosts−1) / cpuOversub)
  perHostRamGB: number
  perHostStorageGB: number

  storageDemandTiB: number            // after FTT × reserve × growth
  minHostsForStorage: number          // ceil(demand / usablePerHost) for vSAN; 0 for FC/NFS
  externalPoolRequiredTiB: number     // FC/NFS demand the array must provide

  recommendedHostCount: number

  validationWarnings: ValidationWarning[]
}
```

### 4.3 Why these shapes

- `overrides: { ... }` is **sparse** — empty object = "use profile defaults everywhere." Keeps URL state compact for the common case.
- `appliances: ApplianceLine[]` is itemized so the UI can render the same table VMware ships, and exports get per-line detail.
- `wldOverhead` is separated from `appliances` so the UI can show "5 WLDs add X cores to mgmt cluster" as a distinct group.
- `validatedSolutions` is a flat object (not a list) — fewer than 5 known solutions, flat shape is clearer.

---

## 5. Calculation pipeline

`calcManagement(config, wlds)` runs this pipeline. All arithmetic uses `Decimal.js`.

### Step 1 — Resolve appliance set

For each of the **13 user-overridable categories** listed in `ManagementDomainConfig.overrides`:

1. Look up `profiles[config.profile][category]` → default `{ included, size, nodeCount }`.
2. Merge `config.overrides[category]` (sparse) on top.
3. If `included === true`, build `ApplianceLine` from `constants[category][size]` × `nodeCount`.

**SDDC Manager** is the 14th appliance line but is **not in `overrides`** — it's always included × 1 at fixed size (4 vCPU / 16 GB / 914 GB) because VCF cannot exist without it. It's resolved unconditionally in `appliances.ts`.

Auto-rules (apply after override merge):
- NSX Manager `nodeCount = 3` for HA/Stretch, `1` for Simple.
- vROps `nodeCount = 3` for HA, `1` for Simple.
- VCF Automation `nodeCount = 3` for HA, `1` for Simple.
- Fleet Manager + VCF Ops Collector are **always** `nodeCount = 1` (singletons — preserves existing MGMT-04 invariant).

### Step 2 — Derive WLD overhead

For each `wld` in `wlds`:

- vCenter size = `pickVcenterSize(wld.vmCount, wld.hostCount)`:
  | Hosts | VMs | Size |
  |---|---|---|
  | ≤ 10 | ≤ 100 | Tiny |
  | ≤ 100 | ≤ 1 000 | Small |
  | ≤ 400 | ≤ 4 000 | Medium |
  | ≤ 1 000 | ≤ 10 000 | Large |
  | else |  | XLarge |
- NSX Manager size = `pickNsxSize(wld.hostCount)`: ≤ 128 → Medium · ≤ 1 024 → Large · else → XLarge.
- NSX Manager `nodeCount = wld.deploymentMode === 'simple' ? 1 : 3`.
- Both lines tagged `source: 'auto-derived'`.

### Step 3 — Append validated solutions

For each enabled toggle, push an `ApplianceLine` from `constants.validatedSolutions[*]`.

### Step 4 — Sum totals

Sum `appliances + wldOverhead` → `totalCores`, `totalRamGB`, `totalDiskGB`. `totalSwapGB = totalRamGB` (per VMware workbook).

### Step 5 — Storage demand

```
diskAndSwap = totalDiskGB + totalSwapGB

  if storageType === 'vsan-esa':    rawDemand = diskAndSwap × 1.5
  elif storageType === 'vsan-max':  rawDemand = diskAndSwap × 1.5   (ESA-class architecture)
  elif storageType in {'fc','nfs'}: rawDemand = diskAndSwap × 1     (array handles redundancy)

withReserve     = rawDemand × (1 + reservePct/100)
storageDemandGB = withReserve × (1 + growthPct/100)
storageDemandTiB = storageDemandGB / 1024
```

`StorageType` in this codebase is `'vsan-esa' | 'fc' | 'nfs' | 'vsan-max'`. We do **not** model `vsan-osa` — VCF 9.x is ESA-only for new deployments, and adding OSA back would expand scope without a real use case.

Routing:
- FC / NFS → `externalPoolRequiredTiB = storageDemandTiB`; `minHostsForStorage = 0`.
- vSAN ESA → feed the **pre-FTT logical** demand (`demandBeforeFttTiB` = `diskAndSwap × reserve × growth / 1024`, **without** the 1.5× FTT factor) into `calcMinHostsForVsanEsa()`, with `deploymentMode = 'simple'` (per-site). `calcMinHostsForVsanEsa()` already applies the RAID protection multiplier and the 30% slack internally — feeding it `storageDemandTiB` would double-count the FTT protection, and passing the stretch mode would double-count the topology ×2 (applied once at Step 8). **Correction (2026-05-25):** the original draft fed `storageDemandTiB` with `config.deploymentMode`, which over-sized stretched vSAN-ESA management (~28 hosts for Standard) — see the host-count regression tests in `mgmt/index.test.ts`.
- vSAN Max → demand routes to the disaggregated storage cluster via `calcVsanMax()`. Mgmt compute hosts contribute zero local storage; the storage cluster sizes against demand independently.

### Step 6 — Per-host requirements (N-1 capacity model)

```
hosts = config.hostCount
n     = max(hosts − 1, 1)   # tolerate one host failure

perHostCores      = ceil(totalCores  / n / cpuOversubscription)
perHostRamGB      = ceil(totalRamGB  / n / ramOversubscription)

if storageType in {'vsan-esa','vsan-max'}:
  perHostStorageGB        = ceil(storageDemandGB / n)
  externalPoolRequiredTiB = 0
else:                       # 'fc' | 'nfs'
  perHostStorageGB        = 0
  externalPoolRequiredTiB = storageDemandTiB
```

VMware uses one shared "oversubscription" pair; we model **CPU and RAM separately** because they're rarely the same in real designs (default 2:1 CPU, 1:1 RAM).

For FC/NFS, `perHostStorageGB` is intentionally `0` — the array provides shared storage, not local disks. The full demand surfaces as `externalPoolRequiredTiB` in the result and the UI/exports.

### Step 7 — Recommended host count

```
minHostsCpu     = ceil(totalCores  / cpuPerHost / cpuOversub)
minHostsRam     = ceil(totalRamGB  / ramPerHost / ramOversub)
minHostsStorage = vSAN ? calcMinHostsForVsanEsa(...) : 0

recommendedHostCount = max(minHostsCpu, minHostsRam, minHostsStorage, deploymentFloor)
```

`recommendedHostCount` is **per-site**; `minHostsStorage` uses `'simple'` (per-site) too. The per-site `deploymentFloor` is **4** for vSAN / **2** for FC-NFS (Broadcom KB 392993 / 416270). For stretch, the per-site count is doubled once at Step 8 (`totalHosts = recommendedHostCount × 2`), so the **total** stretch floor is **8** vSAN / **4** FC-NFS — never apply the ×2 inside `calcMinHostsForVsanEsa` as well.

### Adaptations beyond VMware's workbook

- vSAN Max routing for mgmt — VMware doesn't sell this configuration; we expose it.
- Separate CPU vs RAM oversubscription — VMware uses one knob; we mirror common best practice.
- Storage-driven `minHostsForStorage` integrates with our existing `calcMinHostsForVsanEsa` (RAID-5 adaptive boundary at 6 hosts, etc.).

---

## 6. UI: Step 2 with collapsible sections

```
┌─ Step 2: Management Domain ───────────────────────────────────────────┐
│                                                                       │
│  ▼ Essentials                                          (always open)  │
│    Architecture: ( ) Colocated  (•) Dedicated                         │
│    Storage type: [ vSAN ESA ▾ ]    (now includes vSAN Max)            │
│    Profile:      ( ) Lab  (•) Standard  ( ) Large                     │
│    Hardware:     [cores/socket] [sockets/host] [RAM GB] [Storage TiB] │
│    (Deployment mode shown read-only; locked by Step 1 topology)       │
│                                                                       │
│  ▶ Capacity headroom                                  (collapsed)     │
│    CPU oversubscription [ 2 ]                                         │
│    RAM oversubscription [ 1 ]                                         │
│    Reserve %            [ 30 ]                                        │
│    Growth %             [ 10 ]                                        │
│                                                                       │
│  ▶ Optional appliances                                (collapsed)     │
│    [✓] NSX Edge        Size [ Large ▾ ]   Nodes [ 2 ]                 │
│    [✓] AVI Load Balancer  Size [ Small ▾ ]   Nodes [ 3 ]              │
│    [✓] VCF Operations for Logs (vRLI) ...                             │
│    [✓] VCF Operations for Networks (vRNI) ...                         │
│    [ ] Identity Broker (WSA) ...                                      │
│    [ ] Security Services Platform (SSP)  ⚠ huge — sovereign only      │
│                                                                       │
│  ▶ Validated solutions                                (collapsed)     │
│    [ ] Site Protection / SRM                                          │
│    [ ] Ransomware Recovery (on-prem)                                  │
│    [ ] Ransomware Recovery (cloud)                                    │
│    [ ] Cross-Cloud Mobility (HCX)                                     │
│                                                                       │
│  ▶ Advanced sizing override                           (collapsed)     │
│    Per-appliance: { size dropdown, node count, reset-to-profile }     │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### New Vue components (`src/components/input/`)

- `MgmtCollapsibleSection.vue` — shared collapsible primitive (heading + chevron + slot).
- `MgmtCapacityHeadroom.vue` — 4 numeric inputs.
- `MgmtOptionalAppliances.vue` — checkbox + size + node count per category.
- `MgmtValidatedSolutions.vue` — 4 checkboxes.
- `MgmtAdvancedSizing.vue` — table of per-appliance overrides with "reset to profile" buttons.

### Results panel addition (`src/components/results/`)

- `MgmtSizingTable.vue` — itemized `MgmtDomainResult.appliances + wldOverhead` table with per-line CPU/RAM/disk. Today's totals card stays as the summary above this table.

### Profile selector behavior

When the user clicks Lab/Standard/Large, the inputStore updates `profile` and **clears all overrides** — with a confirm dialog if any override is set: "Switching profile will reset N custom appliance sizes. Continue?". This keeps the mental model clean: profile is the source of truth unless explicitly overridden.

### i18n

Every label, tooltip, and validation message is added to all 4 locales (en, fr-CH, de-CH, it-CH). Swiss locales need explicit number formats per existing convention.

---

## 7. Backward compat & migration

### URL state

All new fields on `ManagementDomainConfig` are **optional with defaults** in the Zod schema:
- `profile: 'standard'`
- `cpuOversubscription: 2`
- `ramOversubscription: 1`
- `reservePct: 30`
- `growthPct: 10`
- `overrides: {}`
- `validatedSolutions`: all four `included: false`

Old shareable URLs hydrate cleanly; user lands on the **Standard profile** with no validated solutions enabled.

### Storage type

`storageType` already accepts `'vsan-max'` in the union. We lift `ManagementStorageType = Exclude<StorageType, 'vsan-max'>` so it equals `StorageType`. Validation gains rules for the disaggregated-cluster sizing case (existing rules from workload domains apply).

### Default migration outcome

Today's implicit "Small profile" (vCenter 4/21, vROps 4/16) becomes the **Standard profile** (vCenter 8/30, vROps 8/32). **Existing users will see larger recommended host counts.** This is the correct outcome — current numbers are undersized — but must be called out in the release notes / changelog.

### Legacy callers

```ts
// src/engine/management.ts (shim)
export function calcManagement(mode: DeploymentMode): MgmtDomainResult {
  return calcManagementFull(buildDefaultConfig(mode), [])
}
```

Existing test file (`management.test.ts`) stays green during the transition. Tests are migrated onto the new API in P3.

---

## 8. Validation rules (new)

All return `messageKey: string`; English labels live in `en.json`.

| Code | Severity | Trigger | Message key |
|---|---|---|---|
| MGMT-EDGE-PAIR | warning | NSX Edge included with `nodeCount < 2` | `validation.mgmt.edgePairRequired` |
| MGMT-AVI-CLUSTER | warning | AVI included with `nodeCount < 3` | `validation.mgmt.aviClusterRequired` |
| MGMT-SSP-HOSTS | error | SSP included and `recommendedHostCount < 8` | `validation.mgmt.sspMinHosts` |
| MGMT-OVERSUB-RANGE | warning | `cpuOversubscription > 4` or `ramOversubscription > 1.5` | `validation.mgmt.oversubAggressive` |
| MGMT-RESERVE-RANGE | warning | `reservePct < 15` or `> 50` | `validation.mgmt.reserveOutOfRange` |
| MGMT-FC-NEEDS-POOL | error | `storageType ∈ {fc,nfs}` and `externalStorageUsableTiB === undefined` | `validation.mgmt.externalPoolRequired` |
| MGMT-VSANMAX-NODES | error | `storageType === 'vsan-max'` and `vsanMaxStorageNodes < 4` | `validation.mgmt.vsanMaxMinNodes` |
| MGMT-VALIDATED-COUNT | warning | ≥ 3 validated solutions enabled (size impact) | `validation.mgmt.validatedSolutionsHeavy` |

---

## 9. Exports

`useMarkdownExport.ts` and `usePptxExport.ts` gain a "Management appliances" section listing the itemized `MgmtDomainResult.appliances + wldOverhead` table with per-line CPU/RAM/disk. Aggregate slide gets `totalDiskGB` and `externalPoolRequiredTiB` (FC/NFS only) added.

PPTX has table-cell limits per slide; large appliance lists may need pagination. Resolution deferred to P6.

---

## 10. Test strategy

- Engine unit tests: `src/engine/mgmt/*.test.ts` — one per module, ≥ 90 % branch coverage.
- Store tests: `src/stores/calculationStore.test.ts` extended with full-config scenarios.
- **Snapshot tests**: locked-in scenarios that mirror the VMware workbook's "Standard / m01 only / Medium / Default" output. Deterministic regression alarm if a sizing constant drifts.

---

## 11. Phase decomposition (roadmap)

The full picture is a **milestone**, not a phase. Each phase below produces a shippable, testable slice with its own `PLAN.md`.

| # | Phase | What lands | Dependencies | Rough size |
|---|---|---|---|---|
| **P1** | Engine foundation | `src/engine/mgmt/` skeleton with `types.ts`, `constants.ts`, `profiles.ts` + their unit tests. No callers wired. | — | M |
| **P2** | Calculation pipeline + shim | `appliances.ts`, `wldOverhead.ts`, `hostMath.ts`, `storage.ts`, `validation.ts`, `index.ts`. Legacy `calcManagement(mode)` shim in `src/engine/management.ts`. All existing tests still green. | P1 | L |
| **P3** | Store wiring + URL Zod migration | `inputStore` gains new fields with defaults; Zod schema accepts them as optional; `calculationStore` calls new API. Old shareable URLs hydrate cleanly. New store tests for full-config scenarios. | P2 | M |
| **P4** | UI Step 2: essentials + capacity headroom + optional appliances | `MgmtCollapsibleSection.vue`, `MgmtCapacityHeadroom.vue`, `MgmtOptionalAppliances.vue`, profile selector, vSAN-Max in storage dropdown, `MgmtSizingTable.vue` in results. All 4 locales. | P3 | L |
| **P5** | Validated solutions + advanced sizing override | `MgmtValidatedSolutions.vue`, `MgmtAdvancedSizing.vue`. All 4 locales. | P4 | M |
| **P6** | Exports + workbook-parity snapshot tests | Markdown / PPTX gain itemized appliance table + external pool TiB. Snapshot suite locks defaults to VMware workbook output for the Standard / Medium / Default scenario. | P5 | M |

**Slice points:**
- After **P3**, engine + stores are complete; can validate engine numbers vs the VMware workbook on a feature branch before any UI work.
- After **P4**, the essentials are user-visible. P5 / P6 are polish.

**Parallelization:** once **P3** is merged, **P4 / P5** can be developed in parallel. **P6** is the only strict tail.

**Total milestone:** ~6 phases.

---

## 12. Risks called out now

- **Default sizing increase** — existing users' recommended host counts will grow. Release note callout required; no code workaround.
- **vSAN Max for mgmt** — no production reference architecture from VMware exists. UI should display "Beyond VMware's official guidance — supported by this tool, not by Broadcom." inline near the storage-type dropdown when vSAN Max is selected for mgmt.
- **PPTX appliance-table pagination** — large appliance lists may overflow a slide; resolved in P6.

---

## 13. Out of scope (explicit non-changes)

- `WorkloadDomainConfig` shape unchanged. WLD overhead is **derived** from existing fields; no new per-WLD knobs.
- `ManagementArchitecture = 'colocated' | 'dedicated'` unchanged.
- Wizard step count unchanged (3 steps).
- Existing storage engine (`storage.ts`, `vsanMax.ts`, `stretch.ts`) unchanged — mgmt domain calls into them.
- Existing validation engine unchanged — `mgmt/validation.ts` adds rules; doesn't replace the global validation pipeline.

---

## Appendix A — VMware workbook reference values

Source: `docs/vcf-9.0-planning-and-preparation-workbook.xlsx`, "Static Reference Tables" sheet, rows 8–267.

Selected sizing constants (full table embedded in `mgmt/constants.ts`):

| Component | Size | CPU | RAM (GB) | Disk (GB) |
|---|---|---|---|---|
| SDDC Manager | — | 4 | 16 | 914 |
| vCenter | Tiny | 2 | 14 | 579 |
| vCenter | Small | 4 | 21 | 694 |
| vCenter | Medium | 8 | 30 | 908 |
| vCenter | Large | 16 | 39 | 1 358 |
| vCenter | XLarge | 24 | 58 | 2 283 |
| NSX Manager | Medium | 6 | 24 | 300 |
| NSX Manager | Large | 12 | 48 | 300 |
| NSX Manager | XLarge | 24 | 96 | 400 |
| NSX Edge | Small | 2 | 4 | 200 |
| NSX Edge | Medium | 4 | 8 | 200 |
| NSX Edge | Large | 8 | 32 | 200 |
| NSX Edge | XLarge | 16 | 64 | 200 |
| AVI LB | Small | 6 | 32 | 512 |
| AVI LB | Large | 16 | 48 | 1 400 |
| AVI LB | X-Large | 16 | 64 | 1 750 |
| VCF Operations | Medium | 8 | 32 | 274 |
| VCF Operations | Large | 16 | 48 | 274 |
| VCF Ops Collector | Standard | 8 | 48 | 264 |
| vRLI | Medium | 8 | 16 | 530 |
| vRLI | Large | 16 | 32 | 530 |
| vRNI | Medium | 8 | 32 | 1 024 |
| vRNI | Large | 12 | 48 | 1 024 |
| WSA (Identity Broker) | Medium | 8 | 16 | 220 |
| SSP | Medium | 112 | 414 | 4 096 |
| SSP | Large | 160 | 606 | 5 120 |
| SSP | XLarge | 192 | 734 | 6 656 |
| VCF Automation | Medium | 24 | 96 | 334 |
| VCF Automation | Large | 32 | 128 | 430 |
| Fleet Manager | — | 4 | 12 | 194 |
| SRM | Standard | 8 | 24 | 800 |
| HCX Connector | — | 4 | 12 | 65 |
| Cloud Ransomware Connector | — | 8 | 12 | 100 |

---

## Appendix B — Profile presets (`profiles.ts`)

| Category | Lab | Standard | Large |
|---|---|---|---|
| SDDC Manager | included, fixed | included, fixed | included, fixed |
| vCenter (mgmt) | Small | **Medium** | Large |
| NSX Manager | Small | **Medium** | Large |
| NSX Edge | excluded | **Large × 2** | XLarge × 2 |
| AVI LB | excluded | **Small × 3** | Large × 3 |
| VCF Operations | Small | **Medium × 3** | Large × 3 |
| VCF Ops Collector | excluded | Standard × 1 | Standard × 1 |
| vRLI | excluded | **Medium × 3** | Large × 3 |
| vRNI | excluded | **Medium × 1** | Medium × 3 |
| vRNI Collector | excluded | excluded | Medium × 1 |
| Identity Broker | excluded | excluded | Medium × 3 |
| SSP | excluded | excluded | excluded (always opt-in) |
| VCF Automation | Small | Medium × 3 | Large × 3 |
| Fleet Manager | included × 1 | included × 1 | included × 1 |

(Bold = ON-by-default for the Standard profile per Q4.)
