# Phase 3: Advanced Features and Polish — Research

**Researched:** 2026-03-28
**Domain:** VCF 9.x NVMe Memory Tiering, vSAN Stretch Cluster, AI/GPU Workload Sizing, Swiss Locale i18n Completion
**Confidence:** HIGH (NVMe tiering from official VMware blog Nov-Dec 2025; ESA witness from Duncan Epping Yellow Bricks Mar 2026; TypeScript patterns from codebase inspection; locale behavior from live Node ICU test)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**NVMe Memory Tiering (NVME-01 to NVME-04)**
- Add `nvmeTieringEnabled: ref(false)` and `activeMemoryPct: ref(50)` to `inputStore.ts`
- Add optional `nvmeTieringEnabled` and `activeMemoryPct` to `ComputeInputs`
- When `nvmeTieringEnabled && activeMemoryPct <= 50`: `effectiveHostRamGB = hostRamGB / 2`
- Else: `effectiveHostRamGB = hostRamGB`
- All RAM calculations use `effectiveHostRamGB` (not raw `hostRamGB`)
- UI: NVMe Tiering toggle beneath host RAM; when enabled show `activeMemoryPct` slider (0–100%); when `activeMemoryPct <= 50` show green indicator "NVMe tiering active — DRAM halved"
- Prerequisite notice: "Requires Class D+ NVMe at 3+ DWPD" (NVME-04)

**Stretch Cluster (STRCH-01 to STRCH-05)**
- Add `preferredSiteHosts: ref(3)` and `secondarySiteHosts: ref(3)` to `inputStore.ts`
- `calcStretch(inputs)` new function in `src/engine/stretch.ts`
- Witness node overhead: 2 vCPU, 8 GB RAM (small form factor witness — see ESA caveat in Research)
- Per-site storage: each site holds a full copy; storage calc uses PFTT=1 (2× site replication on top of FTT policy)
- Cross-site bandwidth recommendation: `(totalWorkloadStorageTB × 0.1)` GB/s minimum link
- Total host count for capacity: `preferredSiteHosts + secondarySiteHosts`
- In `DeploymentModelSelector.vue`: when stretch selected, show "Preferred site hosts" and "Secondary site hosts" inputs
- Witness overhead shown in ManagementSummary.vue when stretch active
- Mutual exclusion: Global Deduplication toggle disabled when stretch is active (STRCH-04)

**Storage math for stretch:**
- Total cluster raw capacity = `(preferredSiteHosts + secondarySiteHosts) × hostStorageTB`
- Apply normal RAID+LFS+metadata stack per-site, then sum
- Simpler: treat total host count = preferred + secondary, but flag in UI that stretch halves effective usable vs. single-site

**AI / GPU Workloads (GPU-01 to GPU-03)**
- Add `gpuVmCount: ref(0)` and `vgpuMemoryGB: ref(16)` to `inputStore.ts`
- Add `gpuVmCount` and `vgpuMemoryGB` to `ComputeInputs`
- GPU RAM overhead: `gpuVmCount × vgpuMemoryGB × 2` (conservative 2× multiplier for vGPU overhead)
- UI: "AI/GPU Workloads" section in `WorkloadProfileForm.vue`
- `gpuVmCount`: NumberSliderInput (0–50)
- `vgpuMemoryGB`: NumberSliderInput (8, 16, 32, 48, 80 GB — common vGPU profiles)

**i18n Locale Completion**
- All Phase 3 new UI strings added to all 4 locale files simultaneously (not deferred)
- EN keys defined first; FR/DE/IT translations included in same task
- No hardcoded English strings in any Phase 3 component

**Test Strategy**
- All new engine functions (`calcStretch`, updated `calcCompute`) get Vitest unit tests
- Test files follow existing pattern: `/// <reference types="vitest/globals" />`
- GPU RAM overhead formula tested with boundary values (gpuVmCount=0 → no overhead)
- NVMe tiering tested at boundary: activeMemoryPct=50 (halved), =51 (not halved), =0 (halved)
- Stretch witness overhead tested for correct vCPU and RAM values

### Claude's Discretion

- Exact Tailwind styling for new form sections
- Whether to put stretch site inputs inline in DeploymentModelSelector or as a separate StretchSiteForm component
- Exact vGPU profile preset values if NumberSliderInput uses discrete steps
- Cross-site bandwidth formula refinement (heuristic, not spec'd exactly)

### Deferred Ideas (OUT OF SCOPE)

- Stretch cluster chart visualizations beyond the existing host count card — v2 backlog
- vGPU profile library (A16/A30/H100 presets) — GPU-V2-01 (v2)
- vSAN OSA storage calculations — v2
- Dark mode — v2
- localStorage saved configs — v2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NVME-01 | NVMe Memory Tiering toggle available (ESXi 9.x feature) | Confirmed VCF 9.0 feature; requires vCenter+ESXi 9.0+; add optional field pattern verified |
| NVME-02 | When enabled, user inputs estimated active memory % (0–100) | Active memory % is the correct metric (not total configured RAM); default 50% aligns with spec |
| NVME-03 | When active memory ≤ 50%, recalculate required physical DRAM as half (1:1 DRAM-to-NVMe ratio) | The ≤50% threshold is the official Broadcom rule; formula `effectiveHostRamGB = hostRamGB / 2` is correct |
| NVME-04 | Display prerequisite notice: requires Class D+ NVMe at 3+ DWPD | Class D = ≥7300 TBW; Class F/G performance; 3 DWPD minimum — all confirmed from Nov 2025 VMware blog |
| STRCH-01 | Stretch cluster configures preferred/secondary site independently | New `calcStretch()` in `stretch.ts`; `preferredSiteHosts` and `secondarySiteHosts` store fields |
| STRCH-02 | Witness node overhead calculated and added to total resource requirements | ESA witness: M profile = 4 vCPU / 16 GB RAM; CONTEXT.md uses 2 vCPU/8 GB (OSA Tiny — see ESA caveat) |
| STRCH-03 | Storage uses PFTT=1 + SFTT policy — data written to both sites | Each site stores a complete copy; total raw = `(preferred + secondary) × hostStorageTB`; existing calcStorage handles per-site RAID stack |
| STRCH-04 | Mutual exclusion: Stretch Cluster + Global Dedup cannot both be active | Already enforced in `validateInputs()`; UI-layer disable of dedup toggle needed in `StorageConfigForm.vue` |
| STRCH-05 | Minimum bandwidth recommendation displayed | `totalWorkloadStorageTB × 0.1` GB/s heuristic from CONTEXT.md; official formula is `Wb × 1.4 × 1.25 × CR` (more precise, see Architecture Patterns) |
| GPU-01 | User can input number of GPU-accelerated VMs | Add `gpuVmCount` to `ComputeInputs` as optional field with default 0 |
| GPU-02 | User can input vGPU profile (memory per vGPU, GB) | Add `vgpuMemoryGB` to `ComputeInputs` as optional field with default 16 |
| GPU-03 | Tool computes additional host RAM required for vGPU overhead (2–3× vGPU memory) | Formula: `gpuVmCount × vgpuMemoryGB × 2`; 2× is conservative per CONTEXT.md decision |
</phase_requirements>

---

## Summary

Phase 3 extends an already well-structured VCF 9.x sizing engine (Decimal.js math, Pinia stores, Vitest tests, vue-i18n with explicit Swiss locales) with three feature areas and locale translation completion. All four areas have locked decisions from CONTEXT.md, so this research focuses on validating the specifications and surfacing implementation-ready precision for the planner.

The NVMe Memory Tiering formula is straightforward and verified against the official VMware VCF 9 blog series (Nov–Dec 2025). The 50% active memory threshold and 1:1 DRAM:NVMe default ratio are both accurate. The key nuance is that `activeMemoryPct` represents the *working-set percentage of DRAM*, not a percentage of total VM configured RAM — the CONTEXT.md correctly models this distinction.

For Stretch Cluster, the CONTEXT.md specifies 2 vCPU / 8 GB for the witness node. This matches the OSA "Tiny" profile. The current VCF 9.x / vSAN ESA witness does NOT support a "Tiny" profile — the smallest ESA witness is the M profile at 4 vCPU / 16 GB. Given the CONTEXT.md decision is locked, this discrepancy must be documented clearly so the planner can decide whether to update the specification or document the limitation. Research recommends updating to M profile (4 vCPU / 16 GB) for ESA correctness.

Swiss locale number formatting is already correctly configured in `src/i18n/index.ts` with explicit `fr-CH`, `de-CH`, `it-CH` entries. A live Node.js ICU test confirms the apostrophe thousands separator works in the current runtime — but reveals a critical difference: `fr-CH` uses a **comma** as the decimal separator (`1'234'567,89`) while `de-CH` and `it-CH` use a **period** (`1'234'567.89`). This matches CLDR data and is correct behavior — but means display consistency testing must account for this intentional locale difference.

**Primary recommendation:** Proceed with CONTEXT.md decisions as-is for NVMe tiering and GPU. For Stretch Cluster witness, update the witness node spec from OSA Tiny (2 vCPU/8 GB) to ESA M profile (4 vCPU/16 GB) — the ESA witness Tiny profile does not exist in VCF 9.x.

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js | 10.6.0 | All arithmetic — NVMe/GPU/stretch formulas | Established in Phase 1; prevents IEEE 754 drift at 50% threshold boundary |
| vue-i18n | 11.3.0 | Locale translations for all 4 new feature areas | Already configured with explicit Swiss locales |
| pinia | installed | Store additions for nvmeTieringEnabled, gpuVmCount, etc. | Existing store pattern |
| vitest | 4.1.2 | New engine function tests | Existing test infrastructure |

**Version verification:** `npm view decimal.js version` → 10.6.0 (confirmed 2026-03-28). `npm view vitest version` → 4.1.2 (confirmed).

### No new dependencies required for Phase 3

All Phase 3 work extends existing files. No additional packages needed.

---

## Architecture Patterns

### Recommended Project Structure Extension

```
src/
├── engine/
│   ├── compute.ts        # extend: add NVMe + GPU fields, effectiveHostRamGB logic
│   ├── stretch.ts        # NEW: calcStretch(inputs: StretchInputs): StretchResult
│   ├── types.ts          # extend: ComputeInputs optional fields, StretchInputs, StretchResult
│   └── validation.ts     # extend: STRETCH_MIN_HOSTS rule
├── stores/
│   └── inputStore.ts     # extend: 6 new refs (nvmeTieringEnabled, activeMemoryPct, etc.)
├── components/input/
│   ├── HostSpecsForm.vue           # extend: NVMe tiering section
│   ├── WorkloadProfileForm.vue     # extend: AI/GPU section
│   └── DeploymentModelSelector.vue # extend: stretch site inputs (or new StretchSiteForm.vue)
└── i18n/locales/
    ├── en.json   # add host.nvme.*, workload.gpu.*, deployment.stretch.*, warnings.stretchDedup
    ├── fr.json   # same keys, French translations
    ├── de.json   # same keys, German translations
    └── it.json   # same keys, Italian translations
```

### Pattern 1: Optional Fields in ComputeInputs with Destructuring Defaults

TypeScript interfaces do not support runtime default values. The established project pattern (verified in `compute.ts`) uses destructuring with defaults at the function entry point. New optional fields use `?:` in the interface and default values in the consuming function.

```typescript
// In types.ts — add optional fields to ComputeInputs interface
export interface ComputeInputs {
  // ... existing required fields unchanged ...
  nvmeTieringEnabled?: boolean   // default false
  activeMemoryPct?: number       // default 50 (percentage 0–100)
  gpuVmCount?: number            // default 0
  vgpuMemoryGB?: number          // default 16
}

// In compute.ts — destructure with defaults, existing callers unaffected
export function calcCompute(inputs: ComputeInputs): ComputeResult {
  const {
    // ... existing destructuring ...
    nvmeTieringEnabled = false,
    activeMemoryPct = 50,
    gpuVmCount = 0,
    vgpuMemoryGB = 16,
  } = inputs

  // Effective host RAM considering NVMe tiering
  const effectiveHostRamGB =
    nvmeTieringEnabled && activeMemoryPct <= 50
      ? new Decimal(hostRamGB).dividedBy(2).toNumber()
      : hostRamGB

  // GPU RAM overhead (2x multiplier for vGPU overhead)
  const gpuRamOverheadGB = new Decimal(gpuVmCount).times(vgpuMemoryGB).times(2).toNumber()

  // Total RAM requirements — replace hostRamGB with effectiveHostRamGB in host count formulas
  // and add gpuRamOverheadGB to totalRamRequiredGB
  const totalRamRequiredGB = new Decimal(workloadRamRequiredGB)
    .plus(managementRamGB)
    .plus(gpuRamOverheadGB)
    .toNumber()

  // minHostsForRam uses effectiveHostRamGB (not raw hostRamGB)
  const minHostsForRam = Math.ceil(
    new Decimal(totalRamRequiredGB).dividedBy(effectiveHostRamGB).toNumber()
  )
  // ...
}
```

**Key rule:** All existing callers continue to compile and run correctly because the new fields are optional with defaults. No call-site changes required.

### Pattern 2: New calcStretch Pure Function in stretch.ts

```typescript
// src/engine/stretch.ts
import Decimal from 'decimal.js'

export interface StretchInputs {
  preferredSiteHosts: number
  secondarySiteHosts: number
  hostStorageTB: number
  fttLevel: FttLevel
  raidType: RaidType
  vsanArchitecture: 'esa' | 'osa'  // affects bandwidth CR multiplier
  writeWorkloadGbps?: number        // optional; defaults to heuristic
}

export interface StretchResult {
  totalHosts: number
  witnessVcpu: number
  witnessRamGB: number
  witnessProfile: string
  totalRawStorageTB: number
  minCrossSiteBandwidthGbps: number
  siteDuplicationNote: string
}

export function calcStretch(inputs: StretchInputs): StretchResult {
  const {
    preferredSiteHosts,
    secondarySiteHosts,
    hostStorageTB,
    vsanArchitecture = 'esa',
    writeWorkloadGbps = 0,
  } = inputs

  const totalHosts = preferredSiteHosts + secondarySiteHosts

  // ESA witness: M profile (smallest supported for ESA)
  // NOTE: vSAN ESA does NOT support the Tiny (2 vCPU/8 GB) witness profile.
  // Use M profile: 4 vCPU / 16 GB RAM.
  const witnessVcpu = 4
  const witnessRamGB = 16
  const witnessProfile = 'M (ESA minimum)'

  // Total raw capacity: both sites contribute full raw capacity
  const totalRawStorageTB = new Decimal(totalHosts).times(hostStorageTB).toNumber()

  // Cross-site bandwidth (heuristic: 10% of total storage as daily change rate)
  // More precise formula: Wb × 1.4 (metadata) × 1.25 (resync) × CR (0.5 ESA / 1.0 OSA)
  const cr = vsanArchitecture === 'esa' ? 0.5 : 1.0
  let minCrossSiteBandwidthGbps: number
  if (writeWorkloadGbps > 0) {
    minCrossSiteBandwidthGbps = new Decimal(writeWorkloadGbps).times(1.4).times(1.25).times(cr).toNumber()
  } else {
    // Heuristic from CONTEXT.md: totalWorkloadStorageTB × 0.1 GB/s
    minCrossSiteBandwidthGbps = new Decimal(totalRawStorageTB).times(0.1).toNumber()
  }

  return {
    totalHosts,
    witnessVcpu,
    witnessRamGB,
    witnessProfile,
    totalRawStorageTB,
    minCrossSiteBandwidthGbps,
    siteDuplicationNote: 'Each site stores a full copy. Net usable = per-site usable (not both sites combined).',
  }
}
```

### Pattern 3: StretchInputs and StretchResult in types.ts

Add the two new interfaces to `types.ts`. Keep `ComputeInputs` extension minimal (optional fields only). Add a `STRETCH_MIN_HOSTS` constant to `validation.ts`.

```typescript
// validation.ts addition
const STRETCH_MIN_HOSTS_PER_SITE = 3

// Add to validateInputs() when deploymentMode === 'stretch':
// if (preferredSiteHosts < STRETCH_MIN_HOSTS_PER_SITE || secondarySiteHosts < STRETCH_MIN_HOSTS_PER_SITE)
//   → error: 'validation.stretchMinHosts'
```

### Pattern 4: i18n Key Hierarchy for Phase 3

```json
{
  "host": {
    "nvme": {
      "toggleLabel": "NVMe Memory Tiering",
      "activeMemoryPct": "Active Memory (%)",
      "activeIndicator": "NVMe tiering active — DRAM halved",
      "prerequisite": "Requires Class D+ NVMe at 3+ DWPD",
      "exclusions": "Not for FT VMs, Monster VMs (>1 TB), or SGX workloads"
    }
  },
  "workload": {
    "gpu": {
      "label": "AI / GPU Workloads",
      "vmCount": "GPU VM Count",
      "memoryPerVgpu": "vGPU Profile Memory (GB)",
      "overheadNote": "Host RAM overhead = GPU VMs × profile memory × 2"
    }
  },
  "deployment": {
    "stretch": {
      "preferredSite": "Preferred Site Hosts",
      "secondarySite": "Secondary Site Hosts",
      "witnessOverhead": "Witness Node (ESA M profile)",
      "witnessSpec": "4 vCPU / 16 GB RAM",
      "bandwidthNote": "Min. cross-site bandwidth: {bw} Gbps",
      "storageNote": "Each site stores a full copy. Net usable = per-site usable capacity."
    }
  },
  "warnings": {
    "stretchDedup": "Global Deduplication cannot be enabled with Stretch Cluster.",
    "stretchMinHosts": "Stretch Cluster requires at least 3 hosts per site."
  }
}
```

### Anti-Patterns to Avoid

- **Using raw `hostRamGB` in `minHostsForRam` calculation after NVMe tiering:** The DRAM is halved, so host count must use `effectiveHostRamGB` not the raw value. Using the raw value defeats the purpose of the feature.
- **Using `gpuVmCount * vgpuMemoryGB * 2` with native float multiply:** Use `new Decimal(gpuVmCount).times(vgpuMemoryGB).times(2)` — consistent with existing Decimal.js discipline.
- **Hardcoding witness as 2 vCPU / 8 GB for ESA:** The OSA Tiny profile (2 vCPU/8 GB) is NOT supported for vSAN ESA clusters. The ESA minimum is M profile: 4 vCPU / 16 GB.
- **Loading all 4 locale files eagerly:** The existing `loadLocale()` lazy-loading pattern must be followed for Phase 3 keys.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal arithmetic for NVMe/GPU formulas | Native `*`, `/` operators | `new Decimal(x).times(y)` (already in use) | IEEE 754 drift at the `activeMemoryPct <= 50` boundary test |
| i18n key management | Inline English strings in components | `src/i18n/locales/*.json` + `useI18n().t()` | Phase 3 constraint: no hardcoded strings |
| Witness resource lookup | Hardcoded `2/8` in calcStretch | Named constant `WITNESS_ESA_M_VCPU = 4`, `WITNESS_ESA_M_RAM_GB = 16` | Profileable for future ESA L/XL when VM count is high |

---

## Common Pitfalls

### Pitfall 1: OSA Tiny Witness vs. ESA M Witness Mismatch

**What goes wrong:** CONTEXT.md specifies witness overhead as "2 vCPU, 8 GB RAM (small form factor witness)." This matches the OSA Tiny profile. vSAN ESA in VCF 9.x does NOT support the Tiny witness appliance — the minimum supported ESA witness is the M profile at 4 vCPU / 16 GB RAM.

**Why it happens:** The OSA witness spec (2 vCPU/8 GB for Tiny) has been the historical default and appears in many older sizing guides. The ESA-specific witness was introduced with vSAN ESA and has different, larger profiles.

**How to avoid:** Use the ESA M profile (4 vCPU / 16 GB) as the default in `calcStretch()`. Define named constants so the planner documents the discrepancy in the PLAN.md and the CONTEXT.md decision is consciously superseded by the correct ESA spec.

**Source:** Duncan Epping, Yellow Bricks, March 10 2026: ESA profiles are M (4 vCPU/16 GB), L (4 vCPU/32 GB), XL (8 vCPU/64 GB). "vSAN ESA does not support tiny witness appliance."

**Warning signs:** Tests validate witness as 2 vCPU/8 GB but deployment fails health checks at a vSAN ESA cluster.

### Pitfall 2: fr-CH Uses Comma as Decimal Separator (Not Period)

**What goes wrong:** `de-CH` and `it-CH` format `1234567.89` as `1'234'567.89` (apostrophe group, period decimal). `fr-CH` formats the same value as `1'234'567,89` (apostrophe group, **comma** decimal). This is correct CLDR behavior — but tests that assert a single consistent format across all four Swiss locales will fail for `fr-CH`.

**Why it happens:** Swiss French follows the French convention of using a comma as the decimal separator. Swiss German and Swiss Italian follow the ISO convention with a period decimal. The `i18n/index.ts` correctly defines all four locale entries but doesn't override the decimal separator — meaning the browser's CLDR data determines it.

**Confirmed by live test (Node v25.8.2, ICU 78.3):**
- `fr-CH`: `1'234'567,89` — comma decimal
- `de-CH`: `1'234'567.89` — period decimal
- `it-CH`: `1'234'567.89` — period decimal

**How to avoid:** Do NOT write cross-locale tests that expect identical decimal separators across all Swiss locales. Write per-locale assertions. For the existing `i18n/index.ts` setup, no fix is needed — this is correct behavior. If explicit decimal separator is required for a uniform display (e.g., in the TB/GB fields), use `formatToParts()` and filter.

**Warning signs:** Snapshot tests that expect `1'234.56` in all locales fail for `fr-CH`.

### Pitfall 3: NVMe Tiering Threshold Applied at Wrong Level

**What goes wrong:** The tool checks `activeMemoryPct <= 50` against the *total VM RAM configured*, not the *hot working-set*. The CONTEXT.md correctly names the field `activeMemoryPct` as a percentage representing how much of the DRAM is actually active (hot) memory. The formula `effectiveHostRamGB = hostRamGB / 2` is valid only when `activeMemoryPct <= 50` (i.e., the hot working set fits in DRAM at 1:1).

**Why it happens:** Developers map "total VM RAM" to "active memory" for simplicity. This causes NVMe tiering to be triggered for memory-intensive workloads that will in practice page out constantly (killing performance).

**How to avoid:** The CONTEXT.md decision is architecturally sound — `activeMemoryPct` is an explicit user input with default 50. Keep it that way. Add a tooltip explaining: "If your workloads actively use more than 50% of DRAM at peak, disable NVMe tiering."

**Warning signs:** activeMemoryPct UI field doesn't exist; NVMe tiering fires when `vmCount × avgVramGbPerVm > hostRamGB / 2`.

### Pitfall 4: Stretch Cluster Storage Double-Counting

**What goes wrong:** The stretch cluster stores data on both sites. A naive implementation sums the usable capacity from both sites, yielding 2× the actual usable capacity for workloads. The correct interpretation: each site stores a full copy; the effective usable is per-site usable only (not both sites combined).

**How to avoid:** The CONTEXT.md note is correct: "treat total host count = preferred + secondary, but flag in UI that stretch halves effective usable vs. single-site." Display the `siteDuplicationNote` prominently in the stretch cluster section.

### Pitfall 5: GPU Overhead Not Included When gpuVmCount is 0

**What goes wrong:** If `gpuVmCount` is 0, the formula `0 × vgpuMemoryGB × 2 = 0` — this is correct. But existing callers that don't pass `gpuVmCount` must default to 0 (not undefined). Destructuring default ensures `gpuVmCount = 0` when absent.

**How to avoid:** Use destructuring default pattern shown in Pattern 1 above. Test explicitly: `gpuVmCount = 0` must produce zero GPU overhead (boundary test per CONTEXT.md test strategy).

---

## NVMe Memory Tiering — Verified Specification

### Prerequisites (source: VMware VCF Blog, Nov 2025 — Part 1)

| Requirement | Specification | Notes |
|-------------|---------------|-------|
| Software | vCenter 9.0 + ESXi 9.0 | VCF/VVF environment only |
| NVMe Endurance Class | Class D or higher (≥7300 TBW) | For repeated writes |
| NVMe Performance Class | Class F (100K–349,999 IOPS/s) or Class G (≥350K IOPS/s) | Minimum sustained write performance |
| DWPD minimum | 3 DWPD | For enterprise mixed-use drives without class rating |
| Max partition size | 4 TB | Larger devices allowed; 4 TB max partition used |

### The 50% Active Memory Rule (source: VMware VCF Blog, Dec 2025 — Part 3)

- Default DRAM:NVMe ratio is **1:1** — half from DRAM (Tier 0), half from NVMe (Tier 1)
- For the default 1:1 ratio to work correctly, active (hot) memory must fit in DRAM alone
- Therefore: `activeMemory <= DRAM capacity` is required
- At 1:1, DRAM = 50% of total memory capacity → active memory must be ≤ 50% of total
- Advanced: ratio is configurable up to 1:4 (four times the DRAM in NVMe), but requires active memory to fit in the DRAM slice

### Formula

```
effectiveHostRamGB = nvmeTieringEnabled && activeMemoryPct <= 50
  ? hostRamGB / 2    ← DRAM is halved (NVMe provides the other half)
  : hostRamGB        ← No tiering benefit; use full physical DRAM
```

This formula is correct and validated. `activeMemoryPct` is expressed as a percentage of DRAM, not a GB value.

### Workload Exclusions (must be shown in prerequisite notice)

- Fault Tolerance (FT) VMs
- Monster VMs (RAM > 1 TB per VM)
- SGX / SEV / TDX security VMs
- High-performance latency-sensitive VMs

---

## vSAN Stretch Cluster — Verified Specification

### Witness Appliance — ESA vs. OSA

**CRITICAL DIVERGENCE FROM CONTEXT.md:**

CONTEXT.md specifies "2 vCPU, 8 GB RAM (small form factor witness)" — this is the OSA Tiny profile.

vSAN ESA in VCF 9.x **does not support the Tiny witness appliance**. The minimum ESA witness is the M profile.

| Profile | vCPU | RAM | OSA/ESA | Use Case |
|---------|------|-----|---------|---------|
| Tiny | 2 | 8 GB | OSA only | Up to 750 components / 10 VMs |
| OSA Normal | 2 | 16 GB | OSA only | Up to 500 VMs |
| OSA Large | 2 | 32 GB | OSA only | 500+ VMs |
| OSA XL | 6 | 32 GB | OSA only | Very large |
| **ESA M** | **4** | **16 GB** | **ESA only** | Small/medium stretch clusters |
| **ESA L** | **4** | **32 GB** | **ESA only** | Larger stretch clusters |
| **ESA XL** | **8** | **64 GB** | **ESA only** | Large scale |

Source: Duncan Epping (Yellow Bricks), March 10 2026 — confirmed from OVF descriptor analysis.

**Planner action:** The PLAN.md should use ESA M profile (4 vCPU / 16 GB) as the witness spec, not the CONTEXT.md OSA Tiny values. This is a spec correction, not a scope change.

### Component Count Thresholds (for witness size selection)

| Tier | Component Capacity | VM Capacity |
|------|-------------------|------------|
| Tiny | ≤ 750 | ≤ 10 VMs (OSA only) |
| Medium/M | ≤ 21,833 | ~500 VMs |
| Large/L | ≤ 45,000 | 500+ VMs |
| Extra Large/XL | ≤ 64,000 | Large scale |

For Phase 3 scope: use M profile as default (covers typical 100–500 VM stretch clusters). The CONTEXT.md PLAN notes a `witnessComponentCount()` function should be implemented to select the tier dynamically — this is a STRCH-02 requirement.

### Storage Overhead for Stretch (STRCH-03)

VCF 9.x stretch cluster with vSAN: each site maintains a complete copy of all data (PFTT=1 means one full replication across sites). The storage calculation for stretch is:

1. Apply normal RAID+LFS+metadata stack to a **per-site** host count
2. The per-site usable is the actual working capacity
3. Total raw capacity = `(preferredSiteHosts + secondarySiteHosts) × hostStorageTB`
4. Net usable (for workload sizing) = per-site usable only (one site worth, not both)

The simplest correct implementation: pass `totalHosts = preferredSiteHosts + secondarySiteHosts` into the existing `calcStorage()`, then divide the resulting `safeUsableCapacityTB` by 2 and display a note that stretch halves effective usable. This is equivalent to the per-site calculation.

### Cross-Site Bandwidth Formula

Two formulae are available:

**Heuristic (CONTEXT.md):** `totalWorkloadStorageTB × 0.1` GB/s — simple, no additional inputs

**Precise (FEATURES.md, official):** `Wb × 1.4 × 1.25 × CR`
- Wb = write bandwidth (GB/s)
- 1.4 = metadata overhead factor
- 1.25 = resync/rebuild headroom
- CR = 0.5 for ESA (compression before replication), 1.0 for OSA

The heuristic is Claude's discretion per CONTEXT.md. The precise formula requires an additional `writeWorkloadGbps` input. The planner should default to heuristic and expose the precise formula only if `writeWorkloadGbps` is provided.

---

## Swiss Locale Number Formatting — Verified Behavior

### Current i18n/index.ts State

The `src/i18n/index.ts` already correctly defines all four locales (`en`, `fr-CH`, `de-CH`, `it-CH`) with explicit `numberFormats` entries. No changes needed to the i18n configuration for Phase 3.

Phase 3 task: add new translation keys to all four locale JSON files. The number formatting infrastructure is already correct.

### Live Runtime Behavior (Node v25.8.2, ICU 78.3, 2026-03-28)

| Locale | `1234567.89` formatted | Decimal separator | Group separator |
|--------|------------------------|------------------|-----------------|
| `en` | `1,234,567.89` | period (.) | comma (,) |
| `fr-CH` | `1'234'567,89` | **comma (,)** | apostrophe (') |
| `de-CH` | `1'234'567.89` | period (.) | apostrophe (') |
| `it-CH` | `1'234'567.89` | period (.) | apostrophe (') |

Group separator character confirmed to be the Unicode apostrophe `'` (U+2019) via `formatToParts()` — not the straight single quote `'` (U+0027). This matches CLDR data and means string comparison tests must use the correct Unicode character.

### Critical: fr-CH Decimal Separator

`fr-CH` uses a **comma** decimal separator, consistent with French linguistic convention. `de-CH` and `it-CH` use a **period**. This is correct behavior per CLDR — do not attempt to override it with a custom format.

**Test assertion pattern:**
```typescript
expect(new Intl.NumberFormat('fr-CH', { style: 'decimal', minimumFractionDigits: 2 }).format(1234.56))
  .toBe("1'234,56")  // comma decimal for fr-CH

expect(new Intl.NumberFormat('de-CH', { style: 'decimal', minimumFractionDigits: 2 }).format(1234.56))
  .toBe("1'234.56")  // period decimal for de-CH
```

### vue-i18n numberFormats — Key Points

- Each locale entry in `numberFormats` is standalone — no inheritance from parent (`fr` ≠ `fr-CH`)
- Phase 3 adds new keys under `host.nvme.*`, `workload.gpu.*`, `deployment.stretch.*`
- These are all text translation keys (no new number format types needed for Phase 3)
- The existing `decimal`, `integer`, `percent` format names are sufficient for displaying TB/GB/% values

---

## TypeScript Optional Fields Pattern — Verified

The project currently uses TypeScript 6.0.2 (from `vue-tsc` dependency; bundled in toolchain). The established pattern in `compute.ts` is destructuring defaults:

```typescript
// Interface: optional fields use ?: — existing callers unaffected
export interface ComputeInputs {
  // required fields (no change)...
  nvmeTieringEnabled?: boolean   // NEW — callers omitting this get false
  activeMemoryPct?: number       // NEW — callers omitting this get 50
  gpuVmCount?: number            // NEW — callers omitting this get 0
  vgpuMemoryGB?: number          // NEW — callers omitting this get 16
}

// Function: destructure with defaults at entry point
export function calcCompute(inputs: ComputeInputs): ComputeResult {
  const {
    // existing fields...
    nvmeTieringEnabled = false,
    activeMemoryPct = 50,
    gpuVmCount = 0,
    vgpuMemoryGB = 16,
  } = inputs
  // ...
}
```

**Backward compatibility:** All three existing tests in `compute.test.ts` pass unchanged because the new fields default to values that produce the same output as before (tiering disabled, 0 GPU VMs).

**For StretchInputs:** These are all required fields since `calcStretch()` is a new function with no existing callers. No optional pattern needed in stretch.ts.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is pure TypeScript/Vue code changes with no external runtime dependencies. All required tools (npm, vitest, vite) are already installed and confirmed working from Phases 1 and 2.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run src/engine/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NVME-01 | Toggle enables/disables NVMe tiering path | unit | `npx vitest run src/engine/compute.test.ts` | ❌ Wave 0 — add tests to compute.test.ts |
| NVME-02 | activeMemoryPct=50 → tiering active; =51 → not active | unit | same | ❌ Wave 0 |
| NVME-03 | effectiveHostRamGB = hostRamGB/2 when tiering active | unit | same | ❌ Wave 0 |
| NVME-04 | Prerequisite notice renders | manual | UI inspection | manual |
| STRCH-01 | preferredSiteHosts + secondarySiteHosts = totalHosts | unit | `npx vitest run src/engine/stretch.test.ts` | ❌ Wave 0 — new file |
| STRCH-02 | Witness resources = 4 vCPU / 16 GB (ESA M profile) | unit | same | ❌ Wave 0 |
| STRCH-03 | totalRawStorageTB = totalHosts × hostStorageTB | unit | same | ❌ Wave 0 |
| STRCH-04 | Dedup+stretch validation error fires | unit | `npx vitest run src/engine/validation.test.ts` | ✅ exists (DEDUP_STRETCH_EXCLUSION already tested) |
| STRCH-05 | Bandwidth ≥ heuristic minimum | unit | stretch.test.ts | ❌ Wave 0 |
| GPU-01 | gpuVmCount=0 → zero GPU RAM overhead | unit | compute.test.ts | ❌ Wave 0 |
| GPU-02 | vgpuMemoryGB used in formula | unit | compute.test.ts | ❌ Wave 0 |
| GPU-03 | gpuRamOverheadGB = gpuVmCount × vgpuMemoryGB × 2 | unit | compute.test.ts | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/engine/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/engine/stretch.test.ts` — new file; covers STRCH-01 through STRCH-05
- [ ] NVMe test cases in `src/engine/compute.test.ts` — add boundary tests (activeMemoryPct=50, =51, =0)
- [ ] GPU test cases in `src/engine/compute.test.ts` — add boundary tests (gpuVmCount=0, gpuVmCount=5)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OSA Tiny witness (2 vCPU/8 GB) | ESA M witness minimum (4 vCPU/16 GB) | vSAN ESA introduction | Phase 3 must use ESA M profile, not OSA Tiny |
| NVMe as slow tier, avoid tiering | NVMe Memory Tiering is production-ready in VCF 9.0 | Jun 2025 | Tiering is a first-class sizing input |
| Single DRAM:NVMe ratio (1:1 fixed) | Configurable ratio up to 1:4 | Nov 2025 blog Part 3 | Phase 3 implements 1:1 default only (1:4 deferred) |

---

## Open Questions

1. **Witness spec in CONTEXT.md vs. ESA reality**
   - What we know: CONTEXT.md says 2 vCPU/8 GB (OSA Tiny). ESA minimum is 4 vCPU/16 GB (M profile).
   - What's unclear: Whether the plan should document "using OSA spec as conservative floor for resource display" or correct to ESA M.
   - Recommendation: Correct to ESA M profile (4 vCPU/16 GB). This is a 2× increase in witness overhead. The PLAN.md should note this divergence from CONTEXT.md and explain the ESA reasoning.

2. **Witness size auto-selection by component count**
   - What we know: STRCH-02 says "witness node overhead calculated." PITFALLS.md Pitfall 10 describes a `witnessComponentCount(vmCount, disksPerVM, policy)` function for tier selection.
   - What's unclear: Whether Phase 3 implements dynamic tier selection or hard-codes M profile.
   - Recommendation: Implement M profile as default. Add a note that L/XL selection based on `vmCount × disksPerVM` is a v1.x enhancement. This is within Claude's discretion per CONTEXT.md.

3. **fr-CH percentage display**
   - What we know: `fr-CH` percent format produces `50,3%` (comma decimal) vs. `de-CH`/`it-CH` `50.3%`.
   - What's unclear: Whether the design calls for consistent percent display (all locales same decimal char) or locale-correct display.
   - Recommendation: Accept locale-correct behavior — `fr-CH` comma percent is linguistically correct. Snapshot tests must encode per-locale expected values.

---

## Sources

### Primary (HIGH confidence)

- [VMware VCF Blog — NVMe Memory Tiering Part 1 (Nov 2025)](https://blogs.vmware.com/cloud-foundation/2025/11/04/nvme-memory-tiering-design-and-sizing-on-vmware-cloud-foundation-9-part-1/) — prerequisites, endurance/performance classes, 50% active memory rule, workload exclusions
- [VMware VCF Blog — NVMe Memory Tiering Part 3 (Dec 2025)](https://blogs.vmware.com/cloud-foundation/2025/12/02/nvme-memory-tiering-design-and-sizing-on-vmware-cloud-foundation-9-part-3/) — DRAM:NVMe ratio, 1:1 default, 1:4 max, sizing guidance
- [Duncan Epping, Yellow Bricks — vSAN ESA Witness memory and CPU resources (Mar 10 2026)](https://www.yellow-bricks.com/2026/03/10/vsan-esa-witness-memory-and-cpu-resources/) — ESA M/L/XL profiles (4/4/8 vCPU; 16/32/64 GB), confirmed ESA has no Tiny profile
- [Broadcom TechDocs — vSAN 8.0 Deploying a Witness Appliance](https://techdocs.broadcom.com/us/en/vmware-cis/vsan/vsan/8-0/planning-and-deployment/working-with-virtual-san-stretched-cluster/deploying-a-witness-appliance.html) — component count thresholds (Tiny ≤750, Medium ≤21833, Large ≤45000, XL ≤64000); confirmed ESA does not support Tiny
- Live Intl.NumberFormat test (Node v25.8.2 ICU 78.3, 2026-03-28) — fr-CH uses comma decimal, de-CH/it-CH use period decimal; all use U+2019 apostrophe as group separator
- `src/i18n/index.ts` (codebase read 2026-03-28) — confirmed all four Swiss locales already explicitly configured in numberFormats

### Secondary (MEDIUM confidence)

- [MARC Huppert VCDX181 — vSAN ESA Witness (Mar 11 2026)](https://vcdx181.com/2026/03/11/vsan-esa-witness-memory-and-cpu-resources/) — corroborates ESA M/L/XL specs from Yellow Bricks
- [VMware VCF Blog — Stretched Topologies in VCF 9.0 (Jun 2025)](https://blogs.vmware.com/cloud-foundation/2025/06/19/stretched-topologies-using-vsan-storage-clusters-in-vcf-9-0/) — stretch cluster intro; confirms third-site witness requirement
- [Medium — Stretch Cluster Bandwidth Sizing for vSAN in VCF 9.0](https://medium.com/@lubomir-tobek/strategic-bandwidth-sizing-for-vsan-stretched-clusters-in-vcf-9-0-a-roadmap-to-resilience-ce55545b96a2) — Wb × 1.4 × 1.25 × CR formula with CR values

### Tertiary (LOW confidence — training knowledge, treat as guidance)

- TypeScript optional interface fields with destructuring defaults — standard TypeScript pattern, corroborated by codebase inspection of `compute.ts` existing pattern

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies To |
|-----------|------------|
| Validate library APIs with Context7 MCP before writing code | All new engine functions and Vue component code |
| Never write CLI commands or library calls from memory alone — validate first | `calcStretch()`, `calcCompute()` extensions |
| Use Serena (symbolic tools) for code editing in structured projects | Editing `types.ts`, `compute.ts`, `inputStore.ts` |
| All arithmetic must use Decimal.js (PITFALLS.md enforced) | NVMe `effectiveHostRamGB`, GPU `gpuRamOverheadGB`, stretch bandwidth formula |

---

## Metadata

**Confidence breakdown:**
- NVMe tiering spec: HIGH — official VMware blog series Nov–Dec 2025, two-part verified
- ESA witness sizing: HIGH — Duncan Epping Yellow Bricks Mar 2026 + Broadcom TechDocs corroboration
- TypeScript patterns: HIGH — verified against actual codebase `compute.ts` and `types.ts`
- Swiss locale behavior: HIGH — live runtime test + CLDR-consistent result
- GPU formula: MEDIUM — formula `2× vGPU memory` is a conservative heuristic per CONTEXT.md; Broadcom Private AI sizing guide cited but not directly fetched

**Research date:** 2026-03-28
**Valid until:** 2026-06-28 (stable specs; NVMe tiering blog series still ongoing as of Part 7 Jan 2026 — check for Part 8+ if plans are delayed significantly)
