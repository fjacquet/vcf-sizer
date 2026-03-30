# Phase 5: vSAN Max Storage Cluster — Research

**Researched:** 2026-03-29
**Domain:** vSAN Max (Storage Clusters) disaggregated topology — TypeScript engine + Vue 3 UI extension
**Confidence:** HIGH (engine patterns, overhead model, RAID scheme, test patterns — all verified against codebase); MEDIUM (ReadyNode hardware minimums — blog-sourced, not yet verified against live compatibility guide)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Profile Picker UX (VMAX-01)**
- Presentation: HTML `<select>` dropdown with format `"{PROFILE} — {TB}/node"` (e.g., "MED — 100 TB/node")
- 5 profiles: XS — 20 TB/node, SM — 50 TB/node, MED — 100 TB/node, LRG — 150 TB/node, XL — 200 TB/node
- CRITICAL: Verify exact profile specs (especially MED/LRG/XL NVMe counts and XS RAM minimum 128 GB) against `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance` before hardcoding constants

**Input Restructure (VMAX-01, VMAX-02)**
- StorageConfigForm.vue: "vSAN Max" added to existing type button group; when active shows profile dropdown + storage nodes slider (min 4, max 64, default 4)
- HostSpecsForm.vue: No structure changes; when vSAN Max selected, show informational note "Host count = compute cluster size when vSAN Max is selected" — no slider relabeling
- New inputStore fields:
  ```typescript
  const vsanMaxProfile = ref<'xs' | 'sm' | 'med' | 'lrg' | 'xl'>('med')
  const vsanMaxStorageNodes = ref(4)
  // hostCount (existing) serves as compute node count when vsanMaxSelected
  ```

**Results Dual Output (VMAX-02)**
- Two separate cards: existing HostCountCard (unchanged) + new VsanMaxClusterCard.vue (vsan-max only)
- VsanMaxClusterCard placement: after HostCountCard, before CoresChart
- Shows: profile, storage node count, raw capacity (TB), usable capacity (TB), warning when nodes < 4

**Capacity Model (VMAX-01)**
- Profile TB = raw capacity per node
- Apply full vSAN overhead stack identical to HCI ESA: RAID overhead, LFS ~13%, metadata pool ~10%, safe slack ~5% (70% net)
- Engine function: `calcVsanMax(inputs: VsanMaxInputs): VsanMaxResult` in `engine/vsanMax.ts`
- `calcStorage()` MUST be converted to exhaustive `switch` with `never` case before adding 'vsan-max' to StorageType union

**Network Speed Input (scoped to Phase 5)**
- New button group in HostSpecsForm.vue: [ 10 GbE ] [ 25 GbE ] [ 100 GbE ]
- New inputStore field: `const networkSpeedGbE = ref<10 | 25 | 100>(25)`
- Wire to dedup eligibility: `dedupEnabled && networkSpeedGbE < 25` → DEDUP_NETWORK_SPEED warning
- Wire to stretch bandwidth cap: `Math.min(stretch.minBandwidthGbps, networkSpeedGbE)`

**Test Strategy**
- Full Vitest coverage for `calcVsanMax()` (all 5 profiles, min node validation, usable capacity formula)
- Validation tests: DEDUP_NETWORK_SPEED warning at 10 GbE with dedup enabled
- URL state round-trip tests: vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE preserved
- TDD order: failing tests first for each new rule

### Claude's Discretion

- Exact Tailwind styling for VsanMaxClusterCard and network speed button group
- Whether to show profile specs tooltip on hover
- Exact RAID scheme for vSAN-SC (to confirm: 4+1 at 4 nodes, or 3+1? — research verifies below)
- Placement of compute cluster informational note in HostSpecsForm
- Zod schema field names and default values (follow existing naming convention)

### Deferred Ideas (OUT OF SCOPE)

- vSAN Max stretched topology (vSAN-SC + stretch) — "Defer to v2.1"
- vSAN OSA legacy calculations — STOR-V2-01
- Network speed interconnect note for vSAN Max (informational only — deferred)
- Speed-based performance multipliers
- Dark mode, localStorage saves, side-by-side comparison — UI v2 backlog
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VMAX-01 | User can select "vSAN Max (Storage Cluster)" as a storage type; 5 ReadyNode profiles (XS/SM/MED/LRG/XL); 20/50/100/150/200 TB per node; sizes storage cluster (node count, raw, usable) | Overhead model confirmed same as ESA HCI; capacity formula uses vsanEsaRaidOverhead() with storageNodeCount |
| VMAX-02 | Compute cluster sized independently from storage cluster — separate host count outputs | Existing HostCountCard unchanged; new VsanMaxClusterCard; CALC-02 pattern (computed-only in calculationStore) verified |
| VMAX-03 | Validation rule fires when vSAN Max storage node count below 4 | Rule 6 in validation.ts following existing ValidationWarning pattern; belowMinNodes also surfaced in VsanMaxResult |
</phase_requirements>

---

## Summary

Phase 5 adds vSAN Max (Storage Clusters) as a new disaggregated storage topology. The codebase is already mature and well-patterned: engine files are pure TypeScript with zero Vue imports, the calculation store exposes only `computed()` values, and URL state uses a Zod schema with three synchronized locations.

The phase requires one new engine file (`engine/vsanMax.ts`), one new result component (`VsanMaxClusterCard.vue`), and targeted additive changes to six existing files. The capacity math reuses the existing `vsanEsaRaidOverhead()` function — confirmed correct because vSAN Storage Clusters use the same ESA overhead stack (LFS ~13%, metadata ~10%, 70% safe slack). The RAID adaptive scheme at 4 nodes is confirmed as the 2+1 scheme (1.5x multiplier), matching the existing `vsanEsaRaidOverhead()` implementation.

The most dangerous implementation task is converting `calcStorage()` from if/else to an exhaustive switch — this must happen before `'vsan-max'` is added to the `StorageType` union, or TypeScript will not catch unhandled variants. The second most dangerous task is updating `useUrlState.ts` at all three synchronized locations atomically; the existing `hydrateFromUrl` explicitly assigns every field by name and any omission silently drops state.

The Nov 2025 Broadcom blog changed the hardware guidance naming to three tiers (SM/MED/LRG) but the ReadyNode program and compatibility guide still lists five profiles (XS/SM/MED/LRG/XL). The locked CONTEXT.md decision to use the 5-profile design is correct and current.

**Primary recommendation:** Build in strict TDD order — test first, then engine, then store wiring, then UI. Convert `calcStorage()` switch in the very first commit before any new type union members are added.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7 (strict) | All engine code | Exhaustive switch `never` case catches missed union variants at compile time |
| Decimal.js | 10.6.0 | All arithmetic | Zero float rounding errors in capacity math |
| Pinia | 3.0.4 | State management | `inputStore` ref fields, `calculationStore` computed-only |
| Zod | 4.3.6 | URL schema validation | `.strip()` on InputStateSchema, three-location sync |
| Vue 3 | 3.5.31 | UI components | `<template v-if>` for conditional rendering |
| vue-i18n | 11.3.0 | Localization | All 4 locales (en/fr/de/it) in same commit as UI |
| Vitest | 4.1.2 | Unit tests | `src/engine/**/*.test.ts` and `src/composables/**/*.test.ts` discovered automatically |

**No new npm packages are required for Phase 5.**

### Installation

```bash
# No new packages needed — all dependencies already in package.json
```

### Version Verification

All versions confirmed from `package.json` in the working repository. No stale versions.

---

## Architecture Patterns

### File Change Map

```
src/
├── engine/
│   ├── types.ts              — ADD: VsanMaxProfile, VsanMaxInputs, VsanMaxResult, StorageType union extension, networkSpeedGbE in ValidationInputs
│   ├── storage.ts            — CONVERT if/else to switch + never; 'vsan-max' routes to calcVsanMax()
│   ├── vsanMax.ts            — NEW: READYNODE_PROFILES constant, calcVsanMax()
│   ├── validation.ts         — ADD Rule 6 DEDUP_NETWORK_SPEED; ADD Rule 7 VSAN_MAX_MIN_NODES
│   ├── vsanMax.test.ts       — NEW: TDD tests before implementation
│   └── validation.test.ts    — ADD tests for Rules 6 and 7
├── stores/
│   ├── inputStore.ts         — ADD: vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE refs
│   └── calculationStore.ts   — ADD: vsanMax computed(); wire networkSpeedGbE to stretch bandwidth cap
├── composables/
│   └── useUrlState.ts        — ADD all 3 new fields at all 3 locations (schema, hydration, serialization)
├── components/
│   ├── input/
│   │   ├── StorageConfigForm.vue    — ADD 'vSAN Max' button + conditional profile dropdown + storage nodes slider
│   │   └── HostSpecsForm.vue        — ADD networkSpeedGbE button group + compute cluster note
│   └── results/
│       ├── VsanMaxClusterCard.vue   — NEW results card
│       └── ResultsPanel.vue         — ADD VsanMaxClusterCard after HostCountCard
└── i18n/locales/
    └── en.json / fr.json / de.json / it.json  — ADD all new keys in same commit as UI
```

### Pattern 1: Pure Engine Function

Every engine function follows this contract: pure TypeScript, zero Vue imports, Decimal.js for all arithmetic, types imported from `./types`.

```typescript
// Source: src/engine/storage.ts + management.ts pattern
import Decimal from 'decimal.js'
import type { VsanMaxInputs, VsanMaxResult } from './types'

export function calcVsanMax(inputs: VsanMaxInputs): VsanMaxResult {
  // All math via Decimal.js
  const rawCapacityTB = new Decimal(inputs.storageNodeCount)
    .times(READYNODE_PROFILES[inputs.profile].rawTbPerNode)
    .toNumber()
  // ... overhead stack
}
```

### Pattern 2: Exhaustive Switch with Never

This is the mandatory refactor before adding `'vsan-max'` to `StorageType`:

```typescript
// Source: src/engine/storage.ts (convert existing if/else)
export function calcStorage(inputs: StorageInputs): StorageResult {
  switch (inputs.storageType) {
    case 'vsan-esa':
      return calcVsanEsaStorage(inputs)
    case 'fc':
    case 'nfs':
      return calcPassThrough(inputs)
    case 'vsan-max':
      // calcVsanMax is called from calculationStore, not from calcStorage
      // calcStorage for vsan-max returns a zero/passthrough result (compute nodes have no vSAN storage)
      return calcPassThrough(inputs)
    default: {
      const _exhaustive: never = inputs.storageType
      throw new Error(`Unhandled storageType: ${_exhaustive}`)
    }
  }
}
```

**Note on architecture:** `calcVsanMax()` is called directly from `calculationStore` as a separate `computed()`, not routed through `calcStorage()`. The `calcStorage()` switch needs `vsan-max` in it only to satisfy TypeScript exhaustiveness — the actual storage sizing is in the separate `vsanMax` computed. This matches the CONTEXT.md design decision.

### Pattern 3: calculationStore Computed (CALC-02)

```typescript
// Source: src/stores/calculationStore.ts — zero ref() pattern
const vsanMax = computed(() =>
  input.storageType === 'vsan-max'
    ? calcVsanMax({
        profile: input.vsanMaxProfile,
        storageNodeCount: input.vsanMaxStorageNodes,
        computeNodeCount: input.hostCount,
      })
    : null
)

// Stretch bandwidth cap (from CONTEXT.md decision)
const stretchWithNetworkCap = computed(() => {
  const s = stretch.value
  const effectiveBandwidthGbps = Math.min(s.minBandwidthGbps, input.networkSpeedGbE)
  return { ...s, minBandwidthGbps: effectiveBandwidthGbps }
})
```

### Pattern 4: URL State Triple-Sync

Every new `inputStore` field must be added at all three locations atomically:

```typescript
// Location 1: Zod schema
const InputStateSchema = z.object({
  // ... existing fields ...
  vsanMaxProfile: z.enum(['xs', 'sm', 'med', 'lrg', 'xl']).default('med'),
  vsanMaxStorageNodes: z.number().int().min(4).max(64).default(4),
  networkSpeedGbE: z.union([z.literal(10), z.literal(25), z.literal(100)]).default(25),
}).strip()

// Location 2: hydrateFromUrl assignment block
store.vsanMaxProfile = state.vsanMaxProfile
store.vsanMaxStorageNodes = state.vsanMaxStorageNodes
store.networkSpeedGbE = state.networkSpeedGbE

// Location 3: generateShareUrl state object
const state: InputState = {
  // ... existing fields ...
  vsanMaxProfile: store.vsanMaxProfile,
  vsanMaxStorageNodes: store.vsanMaxStorageNodes,
  networkSpeedGbE: store.networkSpeedGbE,
}
```

### Pattern 5: Conditional UI Block

```vue
<!-- Source: src/components/input/StorageConfigForm.vue v-if pattern -->
<template v-if="storageType === 'vsan-max'">
  <div class="space-y-1">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ t('storage.vsanMax.profileLabel') }}
    </label>
    <select v-model="vsanMaxProfile" class="w-full px-2 py-1 border ...">
      <option value="xs">{{ t('storage.vsanMax.profileXs') }}</option>
      <!-- ... -->
    </select>
  </div>
  <NumberSliderInput
    v-model="vsanMaxStorageNodes"
    :label="t('storage.vsanMax.storageNodes')"
    :min="4"
    :max="64"
    :step="1"
  />
</template>
```

### Pattern 6: Network Speed Button Group

The DeploymentModelSelector.vue already uses inline button group with the same active/inactive Tailwind classes:

```vue
<!-- Source: src/components/input/DeploymentModelSelector.vue button group pattern -->
<div class="flex gap-2">
  <button
    v-for="speed in [10, 25, 100]"
    :key="speed"
    :class="[
      'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
      networkSpeedGbE === speed
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
    ]"
    @click="networkSpeedGbE = speed"
  >
    {{ speed }} GbE
  </button>
</div>
```

### Anti-Patterns to Avoid

- **if/else for StorageType branching:** Adding `'vsan-max'` without converting to switch means TypeScript will not catch unhandled variants at compile time. The fallthrough currently returns FC/NFS pass-through (wrong result, no error).
- **Partial URL state update:** Adding new `inputStore` ref fields without updating all three locations in `useUrlState.ts` silently discards state on URL load. No error is thrown; `.strip()` simply drops unknown keys.
- **ref() in calculationStore:** The CALC-02 constraint prohibits any `ref()` in `calculationStore.ts`. The `vsanMax` field must be a `computed()`.
- **Calling `calcVsanMax()` from `calcStorage()`:** These are separate concerns. `calcStorage()` handles the HCI cluster; `calcVsanMax()` handles the dedicated storage cluster. Routing through `calcStorage()` confuses the two-cluster topology.
- **Single-locale i18n commit:** All 4 locale files (en, fr, de, it) must be updated in the same commit as the UI components. Missing a locale causes runtime errors on language switch.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal arithmetic | Native JS float math | `Decimal.js` | `0.1 + 0.2 !== 0.3`; storage capacity calculations show misleading results at high TB values |
| URL compression | Custom serializer | `lz-string` + Zod | Already in use; maintains backward compatibility with existing shared URLs |
| RAID overhead | New RAID math | `vsanEsaRaidOverhead()` in storage.ts | Same adaptive RAID-5 scheme applies to vSAN-SC; avoid code duplication |
| TypeScript exhaustiveness | Runtime checks | `switch` with `never` case | Compile-time safety; catches missed union members during `tsc --noEmit` |
| Per-profile validation | Inline guards | Profile constant map `READYNODE_PROFILES` | Single source of truth; avoids scattered if/else checks for each profile |

**Key insight:** The existing `vsanEsaRaidOverhead()` function in `storage.ts` already handles all RAID schemes including the 2+1 adaptive at <6 nodes. Call it with `storageNodeCount` instead of `hostCount` — no new RAID logic needed.

---

## vSAN Max Overhead Model — Confirmed Research

### Capacity Formula (VMAX-01)

The vSAN-SC (Storage Cluster) uses the same ESA overhead stack as HCI.

Source: VMware blog "Capacity Overheads for the ESA in vSAN 8" (confirmed HIGH confidence):

| Step | Factor | Source Confirmation |
|------|--------|---------------------|
| LFS overhead | ~13% of usable after RAID | "will consume an additional 13% (approximate) of the object and replica data written" |
| Metadata pool | ~10% of raw capacity | "typically approximately 10% of the total raw capacity" |
| Safe slack | 30% reserve (keep 70%) | Existing `VSAN_SAFE_SLACK = 0.70` in storage.ts |

These constants are already defined in `storage.ts` as `VSAN_LFS_OVERHEAD = 0.13`, `VSAN_METADATA_PCT = 0.10`, `VSAN_SAFE_SLACK = 0.70`. Import and reuse them in `vsanMax.ts`.

### RAID Scheme for vSAN-SC (Claude's Discretion resolved)

From the Mar 2024 blog "Greater Flexibility with vSAN Max": **"a 4-host vSAN Max cluster will allow data to be stored using RAID-5"** — confirmed as the adaptive 2+1 scheme at <6 nodes.

Adaptive RAID-5 in vSAN ESA (same for vSAN-SC):
- 3–5 nodes: **2+1 scheme → 1.5× overhead** (min cluster: 4 nodes for vSAN Max per VMAX-03)
- 6+ nodes: **4+1 scheme → 1.25× overhead**

**This is the same gate as HCI** (existing `vsanEsaRaidOverhead()` implementation). Call it with `storageNodeCount`.

### Example Calculation (MED Profile, 4 nodes, RAID-5 FTT=1)

```
rawCapacityTB = 4 × 100 = 400 TB
raidMultiplier = 1.5  (2+1 scheme, 4 nodes < 6)
usableAfterRaid = 400 / 1.5 = 266.67 TB
lfsOverhead = 266.67 × 0.13 = 34.67 TB
usableAfterLfs = 266.67 - 34.67 = 232.00 TB
metadataPool = 400 × 0.10 = 40 TB
netUsable = 232.00 - 40 = 192.00 TB
safeUsable = 192.00 × 0.70 = ~134.40 TB
```

(The CONTEXT.md example shows "~255 TB" for 4 × MED — this appears to use a different formula or different RAID scheme. Research suggests the locked decision uses the same ESA stack which yields ~134 TB at 4 nodes, 2+1 RAID-5. The planner should verify the formula against the CONTEXT.md example and flag if there is a discrepancy.)

---

## ReadyNode Profile Constants

### Current Profile Specs (MEDIUM confidence — blog-sourced, verify at implementation against compatibility guide)

From VMware blog Mar 2024 + Nov 2025 update:

| Profile | Raw TB/Node | Min NVMe | Min CPU Cores | Min RAM (GB) | Min NIC |
|---------|-------------|----------|---------------|--------------|---------|
| XS | 20 | 2 | 24 | 384 | 10 GbE |
| SM | 50 | 4 | 32 | 384 | 25 GbE |
| MED | 100 | — | 40 | 512 | 100 GbE |
| LRG | 150 | — | 48 | 768 | 100 GbE |
| XL | 200 | — | 64 | 1024 | 100 GbE |

**Confidence note:** XS/SM NVMe counts and RAM are MEDIUM confidence (Mar 2024 blog, confirmed by Nov 2025 update). MED/LRG/XL NVMe counts are LOW confidence (not published in blog sources — compatibility guide only). The XS 128 GB RAM minimum cited in STATE.md is NOT confirmed; the blog shows 384 GB for XS. The Nov 2025 blog's "16 cores and 128 GB of RAM" baseline appears to describe the new *minimum* for the smallest hardware tier, not the XS ReadyNode profile spec.

**CRITICAL at implementation:** Run `source comment` in `READYNODE_PROFILES` constant with URL and date:
```typescript
// Source: compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance
// Last verified: 2026-03-29. Re-verify before hardcoding if more than 3 months old.
```

### Profile Name Clarification

The Nov 2025 blog introduces "vSAN-SC-SM/MED/LRG" naming for hardware guidance documentation. The actual ReadyNode program still certifies five tiers (XS/SM/MED/LRG/XL) per the 2024 blog and the compatibility guide. The CONTEXT.md decision to use five profiles with lowercase keys `'xs' | 'sm' | 'med' | 'lrg' | 'xl'` is correct and current.

---

## Common Pitfalls

### Pitfall 1: if/else StorageType without Never Case

**What goes wrong:** Adding `'vsan-max'` to the `StorageType` union in `types.ts` while `calcStorage()` still uses `if/else` means TypeScript will NOT emit a compile error for the unhandled case. The function falls through to the FC/NFS pass-through branch, returning raw capacity with zero overhead (massively over-optimistic result, no error thrown).

**Why it happens:** `if/else` chains are not exhaustiveness-checked by TypeScript. Only `switch` with a `default: { const _: never = x }` bottom case triggers a compile error.

**How to avoid:** Convert to exhaustive switch in the very first commit of Phase 5, before modifying `StorageType`. Verify with `npm run build` (which runs `vue-tsc -b`).

**Warning signs:** TypeScript build passes after adding `'vsan-max'` to the union without modifying `calcStorage()` — this is the false green indicating the if/else is not protecting you.

---

### Pitfall 2: URL State Three-Location Drift

**What goes wrong:** Adding `vsanMaxProfile`, `vsanMaxStorageNodes`, `networkSpeedGbE` to `inputStore.ts` but missing any of the three locations in `useUrlState.ts` causes silent state loss on URL load. Zod `.strip()` discards unknown fields without warning; the hydration assignment block ignores fields not explicitly assigned.

**Why it happens:** The hydration block explicitly lists every field by name (lines 73–90 in `useUrlState.ts`). It is a manual maintenance contract.

**How to avoid:** Update schema + hydration + serialization in a single commit. Write a URL round-trip test for each new field before the UI commit.

**Warning signs:** Manually test: set profile to 'xl', click Share, paste URL in new tab — profile defaults back to 'med'.

---

### Pitfall 3: vSAN Max Modelled as a Storage Variant

**What goes wrong:** Routing `calcVsanMax()` through the existing `calcStorage()` function and using `hostCount` (HCI compute hosts) as the storage node count produces wrong capacity and a single host count output that conflates compute and storage.

**Why it happens:** `calcStorage()` already exists and it's tempting to add a new case.

**How to avoid:** `calcVsanMax()` is a standalone `computed()` in `calculationStore`. It takes `storageNodeCount` (from `input.vsanMaxStorageNodes`) and `computeNodeCount` (from `input.hostCount`). These are independent. The existing `storage` computed still runs for the compute cluster's HCI calculation when the HCI storage type matters — but when `storageType === 'vsan-max'`, only `vsanMax.value` carries the authoritative storage result.

---

### Pitfall 4: CALC-02 Violation

**What goes wrong:** Adding a `ref()` in `calculationStore.ts` for intermediate state (e.g., `const vsanMaxResult = ref(null)`). This violates the CALC-02 constraint: calculationStore exposes ONLY `computed()`.

**Why it happens:** It seems natural to cache computed results.

**How to avoid:** Every field returned from `calculationStore` must be a `computed()`. The `vsanMax` field must be `const vsanMax = computed(() => ...)`, not a ref.

---

### Pitfall 5: Formula Discrepancy with CONTEXT.md Example

**What goes wrong:** CONTEXT.md shows `~255 TB` usable for 4 × MED nodes (400 TB raw). Research-derived formula with the existing ESA overhead stack yields ~134 TB at 4 nodes (2+1 RAID-5). These differ significantly.

**Why it happens:** The CONTEXT.md example may use a different RAID gate, a different safe-slack factor, or FTT=2 RAID-6 instead of FTT=1 RAID-5.

**How to avoid:** Before writing tests, manually compute the expected output for 4 × MED nodes with the overhead stack and confirm which RAID scheme and FTT level produces ~255 TB. If RAID-6 (1.5x) at 4 nodes yields different results, decide which scheme is the default for vSAN Max (CONTEXT.md discretion area). Pin the formula in tests once confirmed. If using RAID-6 as default: `usable = (400/1.5) × (1-0.13) - 400×0.10) × 0.70 = ~134 TB` — same result. Check if the ~255 TB example assumes no safe slack applied (raw usable before 70% reserve): `(400/1.5) × (1-0.13) - 40 = 192 TB` — still not 255. May assume only RAID overhead without LFS/metadata: `400/1.5 × 0.70 = 186 TB`. Or with dedup ratio 2x: `800/1.5 × 0.87 - 40 × 0.70 = 295 TB`. The exact formula must be pinned in tests before implementation.

**Warning signs:** Test for MED profile fails on first run with unexpected value.

---

### Pitfall 6: Single-Locale i18n Commit

**What goes wrong:** Adding new i18n keys to `en.json` only. vue-i18n falls back to English without error in dev, but is missing translations for users on FR/DE/IT. Runtime console warning; missing keys silently display raw key strings.

**How to avoid:** Add all new keys to `en.json`, `fr.json`, `de.json`, `it.json` in the same git commit as the UI component that uses them.

---

## Code Examples

### Engine Function Skeleton

```typescript
// Source: pattern from src/engine/storage.ts and management.ts
// engine/vsanMax.ts
import Decimal from 'decimal.js'
import type { VsanMaxInputs, VsanMaxResult, VsanMaxProfile } from './types'

// Source: compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance
// Last verified: 2026-03-29 — re-verify if > 3 months old
const READYNODE_PROFILES: Record<VsanMaxProfile, { rawTbPerNode: number }> = {
  xs:  { rawTbPerNode: 20  },
  sm:  { rawTbPerNode: 50  },
  med: { rawTbPerNode: 100 },
  lrg: { rawTbPerNode: 150 },
  xl:  { rawTbPerNode: 200 },
}

const VSAN_LFS_OVERHEAD = 0.13
const VSAN_METADATA_PCT = 0.10
const VSAN_SAFE_SLACK   = 0.70
const VSAN_MAX_MIN_NODES = 4

export function calcVsanMax(inputs: VsanMaxInputs): VsanMaxResult {
  const { profile, storageNodeCount, computeNodeCount } = inputs
  const belowMinNodes = storageNodeCount < VSAN_MAX_MIN_NODES

  const rawPerNode = READYNODE_PROFILES[profile].rawTbPerNode
  const rawCapacityTB = new Decimal(storageNodeCount).times(rawPerNode).toNumber()

  // Adaptive RAID-5 (same gate as HCI ESA)
  const raidScheme = storageNodeCount >= 6 ? '4+1 (FTT=1 RAID-5)' : '2+1 (FTT=1 RAID-5)'
  const raidMultiplier = storageNodeCount >= 6 ? 1.25 : 1.5

  const rawDecimal = new Decimal(rawCapacityTB)
  const usableAfterRaid = rawDecimal.dividedBy(raidMultiplier)
  const usableAfterLfs = usableAfterRaid.times(1 - VSAN_LFS_OVERHEAD)
  const metadataPool = rawDecimal.times(VSAN_METADATA_PCT)
  const netUsable = usableAfterLfs.minus(metadataPool)
  const usableCapacityTB = netUsable.times(VSAN_SAFE_SLACK).toNumber()

  return {
    rawCapacityTB,
    usableCapacityTB,
    raidScheme,
    storageNodeCount,
    computeNodeCount,
    belowMinNodes,
  }
}
```

### Validation Rule Pattern (from existing validation.ts)

```typescript
// Rule 6: DEDUP_NETWORK_SPEED — add to validateInputs()
// Source: src/engine/validation.ts Rule 2 pattern
const DEDUP_MIN_NETWORK_GBE = 25

if (dedupEnabled && storageType === 'vsan-esa' && networkSpeedGbE < DEDUP_MIN_NETWORK_GBE) {
  errors.push({
    code: 'DEDUP_NETWORK_SPEED',
    severity: 'warning',
    messageKey: 'validation.dedupNetworkSpeed',
  })
}

// Rule 7: VSAN_MAX_MIN_NODES — fire when storageType === 'vsan-max'
const VSAN_MAX_MIN_NODES = 4

if (storageType === 'vsan-max' && vsanMaxStorageNodes !== undefined && vsanMaxStorageNodes < VSAN_MAX_MIN_NODES) {
  errors.push({
    code: 'VSAN_MAX_MIN_NODES',
    severity: 'error',
    messageKey: 'validation.vsanMaxMinNodes',
  })
}
```

### Vitest Test Pattern (from management.test.ts)

```typescript
// Source: src/engine/management.test.ts pattern
/// <reference types="vitest/globals" />
import { calcVsanMax } from './vsanMax'

describe('calcVsanMax — capacity model (VMAX-01)', () => {
  it('MED profile, 4 nodes → correct raw and usable capacity', () => {
    const result = calcVsanMax({ profile: 'med', storageNodeCount: 4, computeNodeCount: 4 })
    expect(result.rawCapacityTB).toBe(400)
    // PIN expected usableCapacityTB after manual formula verification
    expect(result.raidScheme).toBe('2+1 (FTT=1 RAID-5)')
    expect(result.belowMinNodes).toBe(false)
  })

  it('3 nodes → belowMinNodes=true (VMAX-03)', () => {
    const result = calcVsanMax({ profile: 'sm', storageNodeCount: 3, computeNodeCount: 4 })
    expect(result.belowMinNodes).toBe(true)
  })

  it('6 nodes → 4+1 scheme (1.25x multiplier)', () => {
    const result = calcVsanMax({ profile: 'med', storageNodeCount: 6, computeNodeCount: 4 })
    expect(result.raidScheme).toBe('4+1 (FTT=1 RAID-5)')
  })
})
```

### VsanMaxClusterCard Component Pattern (from HostCountCard.vue)

```vue
<!-- Source: src/components/results/HostCountCard.vue structure pattern -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()
const { vsanMax } = storeToRefs(calc)
</script>

<template>
  <div
    v-if="input.storageType === 'vsan-max' && vsanMax"
    class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
  >
    <!-- card content -->
    <div v-if="vsanMax.belowMinNodes" class="text-xs text-red-600 ...">
      {{ t('storage.vsanMax.minNodesWarning') }}
    </div>
  </div>
</template>
```

### i18n Key Structure (from en.json pattern)

```json
{
  "storage": {
    "vsanMax": "vSAN Max (Storage Cluster)",
    "vsanMaxConfig": {
      "profileLabel": "Storage Cluster Profile",
      "profileXs": "XS — 20 TB/node",
      "profileSm": "SM — 50 TB/node",
      "profileMed": "MED — 100 TB/node",
      "profileLrg": "LRG — 150 TB/node",
      "profileXl": "XL — 200 TB/node",
      "storageNodes": "Storage Nodes",
      "computeNote": "Host count = compute cluster size when vSAN Max is selected"
    },
    "vsanMaxResults": {
      "title": "vSAN Max Storage Cluster",
      "profile": "Profile",
      "storageNodes": "Storage nodes",
      "rawCapacity": "Raw capacity",
      "usableCapacity": "Usable capacity",
      "minNodesWarning": "Minimum 4 nodes required for vSAN Max"
    }
  },
  "host": {
    "networkSpeed": "Network Speed"
  },
  "validation": {
    "dedupNetworkSpeed": "Global Deduplication requires 25 GbE or faster networking.",
    "vsanMaxMinNodes": "vSAN Max requires a minimum of 4 storage cluster nodes."
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| vSAN Max ReadyNode profiles SM/MED/LRG only | Five tiers: XS/SM/MED/LRG/XL | Mar 2024 (XS/XL added) | XS enables very small clusters; XL for maximum density |
| vSAN-Max-MED = 300TB+ raw | vSAN-Max-MED = 100TB min raw | Nov 2025 | Lower entry cost; constants in code need to reflect reduced minimums |
| vSAN-Max-LRG = 300TB+ raw | vSAN-Max-LRG = 150TB min raw | Nov 2025 | 50% capacity reduction in profile spec |
| Global Dedup not available in vSAN Storage Clusters | Global Dedup available (VCF 9.0 P01, TQR program) | Jun 2025 | DEDUP_NETWORK_SPEED validation rule is now applicable to vSAN Max |
| Minimum 6 hosts for RAID-5 4+1 in vSAN Max | Minimum 4 hosts for RAID-5 2+1 in vSAN Max | Mar 2024 | 4-node cluster is the minimum and uses adaptive 2+1 scheme |

**Deprecated/outdated:**
- "vSAN Max XS" at 75TB: superseded by 20TB per Nov 2025 update
- "vSAN Max SM" at 150TB: superseded by 50TB per Nov 2025 update

---

## Open Questions

1. **Formula discrepancy: CONTEXT.md ~255 TB vs. research-derived ~134 TB for 4 × MED**
   - What we know: CONTEXT.md example shows `~255 TB` for 4 × MED = 400 TB raw. The existing ESA overhead stack (RAID 1.5x, LFS 13%, metadata 10%, safe slack 70%) yields ~134 TB.
   - What's unclear: Does vSAN Max use a lighter overhead model? Does the CONTEXT.md example use a different RAID scheme or skip some overhead layers?
   - Recommendation: Before writing failing tests, manually verify which formula produces ~255 TB. If the result is `400 / 1.5 * 0.87 * 0.70 - 0` ≈ 163 TB (without metadata), or `400 / 1.25 * 0.87 * 0.70 - 0` ≈ 174 TB (6-node 4+1, no metadata), neither matches. The closest match without safe slack is `400/1.5 * 0.87 - 40 = 232 TB` or without LFS `400/1.5 * 0.70 = 186 TB`. Pin the exact formula in TDD tests before implementation and confirm with CONTEXT.md author or treat as discretionary.

2. **XS ReadyNode 128 GB RAM minimum claim in STATE.md**
   - What we know: Mar 2024 blog shows XS = 384 GB RAM. Nov 2025 blog mentions "as little as 128 GB of RAM" as the new minimum hardware guidance baseline for the entry tier.
   - What's unclear: Is the 128 GB the new XS *ReadyNode* minimum, or just a general "you can now build with" lower bound that doesn't yet have a ReadyNode certification?
   - Recommendation: Use 384 GB for XS in the code constants (blog-sourced). Add a comment: "Verify against compatibility guide — Nov 2025 blog suggests 128 GB may be upcoming." The engine constant does not need to enforce host RAM minimums (that is a ReadyNode certification concern, not a sizer concern).

3. **networkSpeedGbE stretch cap visibility**
   - What we know: CONTEXT.md says surface the bandwidth cap in DeploymentModelSelector if line rate constrains the recommendation.
   - What's unclear: Exact UI treatment (new indicator vs. modifying existing bandwidth display).
   - Recommendation: Add a `bandwidthCappedByNetwork` boolean to the stretch computed result; show an additional indicator next to the bandwidth display similar to `bandwidthFloorApplied` — reuse existing amber indicator pattern.

---

## Environment Availability

Step 2.6: Phase 5 is a pure code/config change. No new external dependencies, no CLI tools, no databases, no services beyond what is already installed. All required tools (Node.js, npm, Vitest) are confirmed present from the passing test suite run.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Vite | Yes | Confirmed (tests pass) | — |
| Vitest | TDD test runs | Yes | 4.1.2 | — |
| Decimal.js | Engine arithmetic | Yes | 10.6.0 | — |
| Zod | URL schema | Yes | 4.3.6 | — |

No missing dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `/Users/fjacquet/Projects/vcf-sizer/vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |
| Test discovery | `src/engine/**/*.test.ts` + `src/composables/**/*.test.ts` |

**Current baseline:** 95 tests, 8 test files, all passing (verified 2026-03-29).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VMAX-01 | calcVsanMax() returns correct raw/usable for all 5 profiles | unit | `npm run test` | ❌ Wave 0 — create `src/engine/vsanMax.test.ts` |
| VMAX-01 | Adaptive RAID: 4–5 nodes = 2+1 (1.5x), 6+ = 4+1 (1.25x) | unit | `npm run test` | ❌ Wave 0 |
| VMAX-02 | calcVsanMax() returns separate storageNodeCount and computeNodeCount | unit | `npm run test` | ❌ Wave 0 |
| VMAX-03 | storageNodeCount < 4 → belowMinNodes = true in result | unit | `npm run test` | ❌ Wave 0 |
| VMAX-03 | validateInputs() fires VSAN_MAX_MIN_NODES error when storageType='vsan-max' and storageNodes < 4 | unit | `npm run test` | ❌ Wave 0 — add to `src/engine/validation.test.ts` |
| (network) | validateInputs() fires DEDUP_NETWORK_SPEED when dedupEnabled + networkSpeedGbE < 25 | unit | `npm run test` | ❌ Wave 0 — add to `src/engine/validation.test.ts` |
| (url) | URL round-trip: vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE survive serialize+deserialize | unit | `npm run test` | ❌ Wave 0 — add to `src/composables/useUrlState.test.ts` (if exists) or create it |
| (switch) | calcStorage('vsan-max') does not throw and does not return wrong ESA overhead | unit | `npm run test` | ❌ Wave 0 — add to `src/engine/storage.test.ts` |

### Sampling Rate

- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/engine/vsanMax.test.ts` — NEW: covers VMAX-01, VMAX-02, VMAX-03 (capacity formula, RAID gate, min nodes)
- [ ] Add DEDUP_NETWORK_SPEED and VSAN_MAX_MIN_NODES tests to `src/engine/validation.test.ts`
- [ ] Add `calcStorage('vsan-max')` exhaustive switch test to `src/engine/storage.test.ts`
- [ ] Create or extend `src/composables/useUrlState.test.ts` — URL round-trip for 3 new fields

---

## Project Constraints (from CLAUDE.md)

The project `CLAUDE.md` does not exist at the project root (`/Users/fjacquet/Projects/vcf-sizer/CLAUDE.md`). The following constraints are derived from inline code comments, REQUIREMENTS.md, and accumulated project decisions:

| Constraint | Source | Rule |
|------------|--------|------|
| CALC-01 | REQUIREMENTS.md + code comments | All engine files: ZERO Vue imports; pure TypeScript + Decimal.js only |
| CALC-02 | REQUIREMENTS.md + calculationStore.ts | `calculationStore` exposes ONLY `computed()` — zero `ref()` |
| Atomic Zod sync | PITFALLS.md + useUrlState.ts | Every new `inputStore` field: update schema + hydration + serialization in one commit |
| Exhaustive switch | PITFALLS.md | Convert `calcStorage()` to switch with `never` case BEFORE adding `'vsan-max'` to `StorageType` |
| 4-locale commit | SUMMARY.md | All i18n keys: add to en/fr/de/it in same commit as UI component |
| Decimal.js | REQUIREMENTS.md (FOUND-04) | ALL arithmetic uses `Decimal.js` — no native JS float math in calculation engine |
| Context7 MCP | REQUIREMENTS.md (CALC-05) | Context7 MCP used to verify all library API calls before implementation |

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `src/engine/storage.ts`, `validation.ts`, `types.ts`, `stretch.ts`, `calculationStore.ts`, `inputStore.ts`, `useUrlState.ts`, `StorageConfigForm.vue`, `HostSpecsForm.vue`, `DeploymentModelSelector.vue`, `HostCountCard.vue`, `ResultsPanel.vue`, all test files — codebase patterns fully verified
- `.planning/phases/05-vsan-max-storage-cluster/05-CONTEXT.md` — locked implementation decisions
- VMware Blog "Capacity Overheads for the ESA in vSAN 8" (2022) — LFS 13%, metadata 10% confirmed
- `.planning/research/SUMMARY.md` — v2.0 research findings

### Secondary (MEDIUM confidence)

- VMware Blog Mar 2024 "Greater Flexibility with vSAN Max" — XS/SM profile specs, 4-node minimum, RAID-5 at 4 nodes confirmed
- VMware Blog Nov 2025 "Driving Down Storage Costs" — updated hardware minimums (SM/MED/LRG naming for guidance); XS/XL still in ReadyNode program
- VMware Blog Jun 2025 "Global Deduplication in vSAN ESA for VCF 9.0" — 25 GbE requirement for dedup confirmed

### Tertiary (LOW confidence — verify at implementation)

- Broadcom Compatibility Guide `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance` — canonical source for MED/LRG/XL NVMe counts (not scraped due to dynamic content); MUST be checked at implementation time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from package.json in repo; no new dependencies
- Engine patterns: HIGH — directly verified in codebase; all patterns confirmed from source files
- Overhead model: HIGH — LFS/metadata confirmed from official VMware blog
- RAID scheme: HIGH — adaptive RAID-5 at 4 nodes (2+1) confirmed from official blog
- ReadyNode capacity (TB): HIGH — 20/50/100/150/200 TB confirmed from Mar 2024 blog + Nov 2025 update
- ReadyNode RAM/NIC/NVMe: MEDIUM — blog-sourced, MED/LRG/XL NVMe counts not published
- Formula ~255 TB example in CONTEXT.md: LOW — discrepancy with derived formula unresolved

**Research date:** 2026-03-29
**Valid until:** 2026-06-29 (stable protocol; 90-day window before re-verifying hardware profile constants)
