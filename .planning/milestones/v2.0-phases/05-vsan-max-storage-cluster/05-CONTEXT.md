# Phase 5: vSAN Max Storage Cluster — Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add vSAN Max (vSAN Storage Clusters) as a new storage type — a disaggregated topology where storage nodes
(selected from 5 ReadyNode profiles) and compute cluster hosts are sized independently. Phase 5 does NOT add
vSAN OSA, vSAN Max stretched topology, or new export formats. The phase is complete when an architect can
select "vSAN Max", choose a profile, specify storage node count and compute host count, and receive two
separate cluster outputs with minimum node validation and a shared URL that restores the full state.

</domain>

<decisions>
## Implementation Decisions

### Profile Picker UX (VMAX-01)

**Presentation:** HTML `<select>` dropdown with format `"{PROFILE} — {TB}/node"` (e.g., "MED — 100 TB/node").

Rationale: 5 profiles are already a lot for a button group. Dropdown is compact and consistent with the FTT
level selector already in StorageConfigForm.

**Profiles and raw TB per node:**

- XS — 20 TB/node
- SM — 50 TB/node
- MED — 100 TB/node
- LRG — 150 TB/node
- XL — 200 TB/node

**CRITICAL:** Verify exact profile specs (especially MED/LRG/XL NVMe counts and XS RAM minimum 128 GB)
against `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance` before hardcoding
constants in `engine/vsanMax.ts`. This is flagged as a blocker in STATE.md.

### Input Restructure (VMAX-01, VMAX-02)

**StorageConfigForm.vue gets:**

1. "vSAN Max" added to the existing type button group (next to vSAN ESA / FC / NFS)
2. When `storageType === 'vsan-max'` is active:
   - Profile dropdown: `<select>` with 5 profiles + raw TB/node labels
   - Storage nodes: `NumberSliderInput` (min 4, max 64, default 4)
3. When vSAN Max NOT active: profile dropdown and storage nodes are hidden (no DOM impact)

**HostSpecsForm.vue:** No changes to structure. When vSAN Max is selected:

- The existing `hostCount` slider implicitly becomes the compute cluster host count
- A small informational note appears: "Host count = compute cluster size when vSAN Max is selected"
- No relabeling of the slider — too complex, confusing for non-vSAN-Max modes

**New inputStore fields:**

```typescript
const vsanMaxProfile = ref<'xs' | 'sm' | 'med' | 'lrg' | 'xl'>('med')
const vsanMaxStorageNodes = ref(4)
// hostCount (existing) serves as compute node count when vsanMaxSelected
```

### Results Dual Output (VMAX-02)

**Two separate cards:**

1. **Existing HostCountCard** — no changes; shows compute cluster host recommendation (driven by compute engine)
2. **New VsanMaxClusterCard.vue** — appears only when `storageType === 'vsan-max'`:
   - Shows: selected profile, storage node count, raw capacity (TB), usable capacity (TB)
   - Validation: red indicator when storage nodes < 4
   - Placement in ResultsPanel: after HostCountCard, before CoresChart

**VsanMaxClusterCard content:**

```
[ vSAN Max Storage Cluster ]
  Profile: MED (100 TB/node)    Storage nodes: 4
  Raw capacity: 400 TB
  Usable capacity: ~255 TB
  ⚠ Minimum 4 nodes required   (shown only when < 4)
```

### Capacity Model (VMAX-01)

**Profile TB = raw capacity.** Apply full vSAN overhead stack identical to HCI ESA:

- RAID overhead: Adaptive RAID-5 scheme (same gate as HCI: 4+1 at 4+ nodes)
- LFS overhead: ~13% (`LFS_OVERHEAD_FACTOR`)
- Metadata pool: ~10% (`METADATA_OVERHEAD_FACTOR`)
- Safe slack: ~5% (`VSAN_SAFE_SLACK`)

Rationale: Consistent with existing `calcStorage()` engine. Broadcom TechDocs research at plan time should
confirm whether vSAN-SC uses the same overhead model or a distinct one — if different, adjust constants.

**Engine function:** `calcVsanMax(inputs: VsanMaxInputs): VsanMaxResult`

```typescript
// engine/vsanMax.ts
export interface VsanMaxInputs {
  profile: VsanMaxProfile         // 'xs' | 'sm' | 'med' | 'lrg' | 'xl'
  storageNodeCount: number        // min 4
  computeNodeCount: number        // from inputStore.hostCount
}

export interface VsanMaxResult {
  rawCapacityTB: number
  usableCapacityTB: number
  raidScheme: string
  storageNodeCount: number
  computeNodeCount: number
  belowMinNodes: boolean          // storageNodeCount < 4
}
```

`calcStorage()` MUST be converted to an exhaustive `switch` with a `never` case before `'vsan-max'`
is added to the `StorageType` union (roadmap constraint).

### Network Speed Input (new — scoped to Phase 5)

**New global input in HostSpecsForm.vue:**

```
Network speed: [ 10 GbE ] [ 25 GbE ] [ 100 GbE ]   ← button group
```

**New inputStore field:**

```typescript
const networkSpeedGbE = ref<10 | 25 | 100>(25)   // default 25 GbE
```

**Wire to two effects:**

1. **vSAN dedup eligibility (STOR-05)** — STOR-05 states Global Dedup requires ≥25 GbE. Currently the
   dedup toggle has no network validation. With `networkSpeedGbE`, add validation rule:
   - If `dedupEnabled && networkSpeedGbE < 25`: fire `DEDUP_NETWORK_SPEED` warning (severity: 'warning')
   - Message key: `'validation.dedupNetworkSpeed'`

2. **Stretch bandwidth upper bound (STRCH-05)** — The cross-site bandwidth recommendation from
   `calcStretch()` cannot exceed the physical line rate. Apply:

   ```typescript
   const effectiveBandwidthGbps = Math.min(stretch.minBandwidthGbps, networkSpeedGbE)
   ```

   Surface in DeploymentModelSelector if capped by line rate.

**NOT in scope for Phase 5:**

- vSAN Max interconnect note based on speed (informational, deferred)
- Speed-based performance multipliers

### Test Strategy

- `engine/vsanMax.ts` gets full Vitest coverage: `calcVsanMax()` with all 5 profiles, min node
  validation, usable capacity formula
- Validation tests: `DEDUP_NETWORK_SPEED` warning at 10 GbE with dedup enabled
- URL state round-trip tests: `vsanMaxProfile`, `vsanMaxStorageNodes`, `networkSpeedGbE` preserved
- TDD order: failing tests first for each new rule before implementation

### Claude's Discretion

- Exact Tailwind styling for VsanMaxClusterCard and network speed button group
- Whether to show profile specs tooltip on hover (name + TB + notes)
- Exact RAID scheme for vSAN-SC (to confirm: 4+1 at 4 nodes, or 3+1? — research should verify)
- Placement of compute cluster informational note in HostSpecsForm
- Zod schema field names and default values (follow existing naming convention)

</decisions>

<canonical_refs>

## Canonical References

- `.planning/REQUIREMENTS.md` — Phase 5: VMAX-01, VMAX-02, VMAX-03
- `.planning/STATE.md` — Pending todo: verify ReadyNode profile constants at implementation time
- `.planning/research/SUMMARY.md` — vSAN Max two-cluster topology, no new npm dependencies
- `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance` — ReadyNode profile specs (verify before hardcoding)

### Phase 1–4 outputs extended by Phase 5

- `src/engine/types.ts` — add VsanMaxProfile type, VsanMaxInputs, VsanMaxResult interfaces; add 'vsan-max' to StorageType union; add networkSpeedGbE to ComputeInputs/ValidationInputs
- `src/engine/storage.ts` — convert calcStorage() to exhaustive switch with never case
- `src/engine/vsanMax.ts` — NEW: calcVsanMax(), READYNODE_PROFILES constant, VsanMaxProfile type
- `src/engine/validation.ts` — add DEDUP_NETWORK_SPEED rule (Rule 6)
- `src/stores/inputStore.ts` — add vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE refs
- `src/stores/calculationStore.ts` — add vsanMax computed, wire networkSpeedGbE to stretch
- `src/composables/useUrlState.ts` — add vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE (ALL THREE locations atomic)
- `src/components/input/StorageConfigForm.vue` — add vSAN Max button + profile dropdown + storage nodes slider
- `src/components/input/HostSpecsForm.vue` — add network speed selector, compute cluster note
- `src/components/results/VsanMaxClusterCard.vue` — NEW results card
- `src/components/results/ResultsPanel.vue` — wire VsanMaxClusterCard
- `src/i18n/locales/{en,fr,de,it}.json` — all new keys in all 4 locales in same commit as UI

</canonical_refs>

<code_context>

## Existing Code Insights

### StorageConfigForm.vue — extension point

Current type selector: button group for vSAN ESA / FC / NFS (lines 21–25 in component).
`storageType` is `ref<'vsan-esa' | 'fc' | 'nfs'>`. Will extend to include 'vsan-max'.
Template uses `v-if="storageType === 'vsan-esa'"` — same pattern for vSAN Max section.

### HostSpecsForm.vue — network speed addition

Currently: coresPerSocket, socketsPerHost, hostRamGB, hostStorageTB, hostCount.
Add networkSpeedGbE button group (10/25/100) after hostStorageTB, before hostCount.
Button group already established in DeploymentModelSelector for managementArchitecture toggle.

### calcStorage() in storage.ts — must convert to switch

Currently uses if/else chain for storage type branching. Roadmap requires exhaustive switch with
`never` case before 'vsan-max' is added to StorageType union. This is a required refactor task.

### VsanMaxClusterCard placement

ResultsPanel.vue currently: HostCountCard → CoresChart → RamChart → StorageChart → StretchNetworkChecklist → ExportToolbar.
Insert VsanMaxClusterCard after HostCountCard (before charts), guarded by `v-if="input.storageType === 'vsan-max'"`.

### CALC-02 constraint

calculationStore must have zero ref() — only computed(). vsanMax result must be a computed() that
reads from input store refs. Same pattern as existing stretch computed.

### URL state triple-sync

Any new inputStore field needs atomic update in useUrlState.ts at all three locations:

1. InputStateSchema Zod object
2. hydrateFromUrl assignment block
3. generateShareUrl state object

</code_context>

<deferred>
## Out of Phase 5

- vSAN Max stretched topology (vSAN-SC + stretch) — ROADMAP: "Defer to v2.1" (Out of Scope table)
- vSAN OSA legacy calculations — STOR-V2-01
- Network speed interconnect note for vSAN Max (informational only — deferred)
- Speed-based performance multipliers
- Dark mode, localStorage saves, side-by-side comparison — UI v2 backlog

</deferred>

---
*Phase: 05-vsan-max-storage-cluster*
*Context gathered: 2026-03-29*
