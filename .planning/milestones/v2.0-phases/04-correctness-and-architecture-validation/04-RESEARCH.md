# Phase 4: Correctness and Architecture Validation — Research

**Researched:** 2026-03-29
**Domain:** VCF 9.x stretch cluster correctness (bandwidth floor, network checklist) + management architecture validation (Broadcom KB 392993)
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STRCH-06 | Enforce 10 Gbps minimum inter-site bandwidth floor on `minBandwidthGbps` regardless of workload formula result | `calcStretch()` currently uses raw formula without floor; `Decimal.max()` pattern confirmed from Decimal.js docs; floor constant = 10 per Broadcom TechDocs VCF 9.0 |
| STRCH-07 | Surface `bandwidthFloorApplied` boolean in `StretchResult` when workload formula produces a value below 10 Gbps | New field on existing `StretchResult` interface; formula comparison is pure TypeScript; existing test at line 28–40 in `stretch.test.ts` explicitly tests the pre-floor value and MUST be updated first (TDD order) |
| STRCH-08 | Display stretch network checklist (MTU 9000, site-to-site RTT < 5ms, witness RTT threshold derived from per-site host count) when stretch mode is active | New `StretchNetworkChecklist` interface added to `StretchResult`; witness RTT derived from `Math.max(preferredSiteHosts, secondarySiteHosts)` — ≤10 hosts=200ms, 11-15 hosts=100ms; new `StretchNetworkChecklist.vue` output component |
| ARCH-01 | "Dedicated management cluster" toggle in HA and Stretch modes; validates minimum 4 management hosts (Broadcom KB 392993) | New `ManagementArchitecture = 'shared' \| 'dedicated'` type; new `ref()` in `inputStore`; new `DEDICATED_MGMT_MIN_HOSTS` rule in `validateInputs()`; new `dedicatedMgmtHostCount` computed in `calculationStore` |
| ARCH-02 | Informational note in co-located mode with fewer than 3 hosts (vSAN) or fewer than 2 hosts (FC/NFS) | New validation rule in `validateInputs()`; triggers on `managementArchitecture === 'shared'` with below-minimum host counts per storage type |

</phase_requirements>

---

## Summary

Phase 4 is a correctness and additive-validation phase. Every change is either a bug fix (bandwidth floor) or an additive extension to an existing interface or function — no existing behavior is removed or restructured. The only file that requires a structural change is `engine/types.ts` (new types and interface fields), and this must land first before any other file is touched.

The bandwidth floor bug is the highest-priority item: the current `calcStretch()` formula produces values as low as ~0.097 Gbps for 100 VMs with 100 GB/VM — well below the 10 Gbps VCF 9.0 minimum. The fix is a single `Decimal.max()` call plus a `bandwidthFloorApplied` boolean. However, the existing test in `stretch.test.ts` (line 28–40) explicitly asserts the pre-floor formula value (`~0.097...`), so the TDD constraint is critical: update the failing test assertion first, then add the constant. This is the only test that will break — all other existing stretch tests remain green.

The stretch network checklist and management architecture validation are purely additive. Neither changes existing formulas. Both require new i18n keys in all four locale files (en, fr, de, it) committed atomically with their UI components.

**Primary recommendation:** Build in strict order: (1) types.ts foundation — all additive type changes; (2) TDD: update failing bandwidth test, then add STRETCH_MIN_BANDWIDTH_GBPS constant and apply Decimal.max(); (3) stretch checklist engine + component + i18n; (4) management architecture flag + validation rule + computed + UI toggle + i18n.

---

## Standard Stack

### Core (no new dependencies — all v1 libraries sufficient)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7 (strict) | All new engine code + interface extensions | Strict mode catches missing interface fields at compile time — primary regression guard |
| Decimal.js | 10.6.0 | `Decimal.max(calculatedBandwidthGbps, STRETCH_MIN_BANDWIDTH_GBPS)` for floor enforcement | Already used for all arithmetic per CALC-01 |
| Pinia | 3.0.4 | `ref()` for new `managementArchitecture` input; `computed()` for `dedicatedMgmtHostCount` | CALC-02 rule: zero `ref()` in calculationStore |
| Zod | 4.3.6 | URL schema extension with `managementArchitecture` field | `.strip()` already handles unknown keys; forward/backward compat built in |
| vue-i18n | 11.3.0 | New keys for checklist labels, bandwidth floor indicator, validation messages | All 4 locale files must be updated in the same commit as the consuming component |
| Vitest | 4.1.2 | TDD: update test before adding floor constant; new tests for checklist and validation rule | Config: `src/engine/**/*.test.ts`, `src/composables/**/*.test.ts` |

**Installation:** No new npm packages required. All arithmetic, typing, and i18n needs are met by the existing stack.

---

## Architecture Patterns

### Recommended Project Structure (Phase 4 additions only)

```
src/
├── engine/
│   ├── types.ts          (MODIFIED: additive — new types, new interface fields)
│   ├── stretch.ts        (PATCHED: bandwidth floor + checklist population)
│   └── validation.ts     (ADDITIVE: 2 new rules)
├── stores/
│   ├── inputStore.ts     (ADDITIVE: managementArchitecture ref)
│   └── calculationStore.ts (ADDITIVE: dedicatedMgmtHostCount computed)
├── components/
│   └── output/
│       └── StretchNetworkChecklist.vue  (NEW)
└── i18n/locales/
    ├── en.json  (ADDITIVE: new keys)
    ├── fr.json  (ADDITIVE: new keys)
    ├── de.json  (ADDITIVE: new keys)
    └── it.json  (ADDITIVE: new keys)
```

### Pattern 1: TDD Bandwidth Floor (STRCH-06, STRCH-07)

**What:** Update the failing test assertion before adding the floor constant — ensures the floor is actually enforced, not paper-patched.

**When to use:** Any correctness bug fix that has an existing test pinning the wrong behavior.

**The failing test (stretch.test.ts line 28–40) currently asserts:**

```typescript
// CURRENT (incorrect assertion — pins pre-floor formula value):
it('bandwidth = totalWorkloadStorageTB × 0.1; 100 VMs × 100 GB/VM = 10 TB → 1.0 Gbps', () => {
  const result = calcStretch({ ..., vmCount: 100, avgStorageGbPerVm: 100 })
  const expectedStorageTB = (100 * 100) / 1024
  expect(result.minBandwidthGbps).toBeCloseTo(expectedStorageTB * 0.1, 5)
  // This expects ~0.097... Gbps — WRONG after floor is applied
})
```

**TDD order for the fix:**

```typescript
// STEP 1 — update test to expect the floor (test goes RED):
it('bandwidth floor: 100 VMs × 100 GB/VM → formula ~0.097 Gbps < 10 Gbps floor → returns 10 Gbps', () => {
  const result = calcStretch({ ..., vmCount: 100, avgStorageGbPerVm: 100 })
  expect(result.minBandwidthGbps).toBe(10)
  expect(result.bandwidthFloorApplied).toBe(true)
})

// STEP 2 — add floor to calcStretch() (test goes GREEN):
const STRETCH_MIN_BANDWIDTH_GBPS = 10
const calculatedBandwidthGbps = new Decimal(totalWorkloadStorageTB).times(0.1).toNumber()
const minBandwidthGbps = Math.max(calculatedBandwidthGbps, STRETCH_MIN_BANDWIDTH_GBPS)
const bandwidthFloorApplied = calculatedBandwidthGbps < STRETCH_MIN_BANDWIDTH_GBPS
```

**Additional test to add — floor NOT applied when formula exceeds 10 Gbps:**

```typescript
it('bandwidth floor NOT applied: 200,000 VMs × 1000 GB/VM → formula > 10 Gbps → bandwidthFloorApplied=false', () => {
  const result = calcStretch({ ..., vmCount: 100, avgStorageGbPerVm: 200_000 })
  // 100 × 200000 / 1024 = ~19531 TB × 0.1 = ~1953 Gbps >> 10 Gbps floor
  expect(result.minBandwidthGbps).toBeGreaterThan(10)
  expect(result.bandwidthFloorApplied).toBe(false)
})
```

### Pattern 2: Additive types.ts Extension

**What:** Add new types and optional fields to existing interfaces. All existing callers remain unmodified.

**When to use:** Every Phase 4 type change — new fields are optional (`?`) on all interfaces where they might be absent.

```typescript
// engine/types.ts additions (Phase 4 only):

// New union type for ARCH-01/02:
export type ManagementArchitecture = 'shared' | 'dedicated'

// Extend StretchResult with STRCH-06/07/08 fields:
export interface StretchResult {
  // Existing fields (unchanged):
  totalHosts: number
  witnessCores: number
  witnessRamGB: number
  minBandwidthGbps: number         // PATCHED: now enforces 10 Gbps floor
  effectivePerSiteStorageTB: number
  storageNote: string

  // New fields (Phase 4):
  bandwidthFloorApplied: boolean           // STRCH-07
  networkChecklist: StretchNetworkChecklist // STRCH-08
}

export interface StretchNetworkChecklist {
  minInterSiteBandwidthGbps: number    // always 10 (Broadcom TechDocs minimum)
  maxInterSiteLatencyMs: number        // always 5 (RTT ms, one-way < 5ms = round-trip < 10ms)
  maxWitnessLatencyMs: number          // 200 for ≤10 hosts/site, 100 for 11-15 hosts/site
  jumboFramesRequired: boolean         // true — MTU 9000 for vSAN traffic
  witnessMinBandwidthMbps: number      // 2 Mbps per 1000 components
}

// Extend ValidationInputs with ARCH-01/02 field:
// Add to existing ValidationInputs interface:
managementArchitecture?: ManagementArchitecture   // default 'shared'
hostCount: number  // already present — used by DEDICATED_MGMT_MIN_HOSTS rule
```

### Pattern 3: Validation Rule Addition

**What:** New rules are appended to `validateInputs()` in `validation.ts`. No existing rules are modified.

**When to use:** All ARCH-01 and ARCH-02 validation additions.

```typescript
// Rule 4: DEDICATED_MGMT_MIN_HOSTS — ARCH-01
// Dedicated management cluster requires at least 4 hosts (Broadcom KB 392993 — vSAN mgmt domain min)
const DEDICATED_MGMT_MIN_HOSTS = 4
if (managementArchitecture === 'dedicated' && hostCount < DEDICATED_MGMT_MIN_HOSTS) {
  errors.push({
    code: 'DEDICATED_MGMT_MIN_HOSTS',
    severity: 'error',
    messageKey: 'validation.dedicatedMgmtMinHosts',
  })
}

// Rule 5: COLLOCATED_MIN_HOSTS — ARCH-02
// Co-located (shared) mode informs about minimum hosts for a converged VCF deployment
// vSAN: min 3 hosts; FC/NFS: min 2 hosts (informational, not a blocker)
const COLLOCATED_MIN_HOSTS_VSAN = 3
const COLLOCATED_MIN_HOSTS_FC_NFS = 2
if (managementArchitecture !== 'dedicated') {
  const minHosts = storageType === 'vsan-esa' ? COLLOCATED_MIN_HOSTS_VSAN : COLLOCATED_MIN_HOSTS_FC_NFS
  if (hostCount < minHosts) {
    errors.push({
      code: 'COLLOCATED_MIN_HOSTS',
      severity: 'warning',        // informational note, not an error
      messageKey: 'validation.colocatedMinHosts',
    })
  }
}
```

### Pattern 4: inputStore Additive ref()

**What:** New user input field follows the established `ref()` pattern in `inputStore.ts`.

**When to use:** ARCH-01/02 managementArchitecture toggle.

```typescript
// Add to inputStore.ts (after existing stretch host refs):
// Management architecture (per ARCH-01) — only meaningful in HA and Stretch modes
const managementArchitecture = ref<'shared' | 'dedicated'>('shared')

// Add to the return object:
return {
  // ... existing fields ...
  managementArchitecture,
}
```

**Zod schema update (useUrlState.ts) — must be synchronised:**

```typescript
// Add to InputStateSchema.object({...}):
managementArchitecture: z.enum(['shared', 'dedicated']).default('shared'),

// Add to hydrateFromUrl assignment block:
store.managementArchitecture = state.managementArchitecture

// Add to generateShareUrl state object:
managementArchitecture: store.managementArchitecture,
```

### Pattern 5: calculationStore Additive computed()

**What:** New `computed()` values derived from existing store data. Zero `ref()` added (CALC-02).

**When to use:** `dedicatedMgmtHostCount` for ARCH-01 output.

```typescript
// Add to calculationStore.ts:
const dedicatedMgmtHostCount = computed<number | null>(() => {
  if (input.managementArchitecture !== 'dedicated') return null
  const coresPerHost = input.coresPerSocket * input.socketsPerHost
  return Math.max(4, Math.ceil(management.value.totalCores / coresPerHost))
})

// Add to return:
return { management, compute, storage, validationErrors, stretch, dedicatedMgmtHostCount }
```

### Pattern 6: Stretch Network Checklist Population

**What:** `calcStretch()` derives all checklist values from inputs already in `StretchInputs`.

**When to use:** STRCH-08 implementation.

```typescript
// Derive witness RTT threshold from maximum per-site host count:
const maxSiteHosts = Math.max(preferredSiteHosts, secondarySiteHosts)
let maxWitnessLatencyMs: number
if (maxSiteHosts <= 10) {
  maxWitnessLatencyMs = 200
} else if (maxSiteHosts <= 15) {
  maxWitnessLatencyMs = 100
} else {
  // Out-of-range: VCF 9.0 only specifies thresholds up to 15 hosts/site
  maxWitnessLatencyMs = 100  // conservative fallback; UI should surface a note
}

const networkChecklist: StretchNetworkChecklist = {
  minInterSiteBandwidthGbps: STRETCH_MIN_BANDWIDTH_GBPS,  // 10
  maxInterSiteLatencyMs: 5,
  maxWitnessLatencyMs,
  jumboFramesRequired: true,
  witnessMinBandwidthMbps: 2,  // 2 Mbps per 1000 components (constant spec)
}
```

### Pattern 7: i18n Key Structure

**What:** New keys follow existing namespace conventions. All 4 locale files updated in the same commit as the component that uses them.

**New keys needed (en.json pattern — must replicate across fr, de, it):**

```json
"deployment": {
  "stretchSites": {
    // Existing keys (unchanged)...
    // New keys for STRCH-06/07/08:
    "bandwidthFloorIndicator": "10 Gbps floor applied (VCF 9.0 minimum — formula result was below threshold)",
    "networkChecklist": {
      "title": "Stretch Network Requirements",
      "minBandwidth": "Min inter-site bandwidth",
      "maxLatency": "Max site-to-site RTT",
      "maxWitnessLatency": "Max witness RTT",
      "jumboFrames": "Jumbo frames (MTU 9000)",
      "required": "Required",
      "witnessBandwidth": "Witness min bandwidth"
    }
  }
},
"validation": {
  // Existing keys (unchanged)...
  // New keys for ARCH-01/02:
  "dedicatedMgmtMinHosts": "Dedicated management cluster requires at least 4 hosts (Broadcom KB 392993).",
  "colocatedMinHosts": "Co-located mode: minimum {min} hosts required for this storage type."
},
"deployment": {
  // Existing keys...
  "architecture": {
    "label": "Management Architecture",
    "shared": "Co-located",
    "dedicated": "Dedicated Domains"
  }
}
```

**Note:** `colocatedMinHosts` uses an i18n interpolation parameter `{min}` — the component passes `{ min: computed min value }` to `$t()`.

### Anti-Patterns to Avoid

- **Touching calcManagement() or calcCompute() for ARCH-01:** `managementArchitecture` must NOT flow through these functions. It only affects `validateInputs()` and the new `dedicatedMgmtHostCount` computed. The existing stretch doubling (stretchMultiplier) in `calcCompute()` is correct and must not be disrupted.
- **Hardcoding 200ms witness RTT for all host counts:** The threshold is host-count-dependent. ≤10 hosts = 200ms; 11-15 hosts = 100ms. Derive from `Math.max(preferredSiteHosts, secondarySiteHosts)`.
- **Shipping `bandwidthFloorApplied` without atomic test update:** The test at `stretch.test.ts:28-40` pins `~0.097 Gbps`. Updating test and implementation must be in the same logical unit (update test first in one commit, then fix implementation).
- **Adding new keys to only some locale files:** All 4 locale files (en, fr, de, it) must receive every new key in the same commit as the component that references them. vue-i18n will fall back silently, hiding missing translations.
- **Placing `managementArchitecture` in calculationStore as a `ref()`:** CALC-02 rule prohibits `ref()` in calculationStore. The field belongs in inputStore exclusively.
- **Using 'Standard' / 'Consolidated' labels in UI or i18n keys:** These are retired VCF 5.x terms. Use "Dedicated Domains" / "Co-located" in all UI-facing strings. Engine enum values (`'shared' | 'dedicated'`) remain abbreviated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bandwidth floor enforcement | Custom comparison logic | `Math.max(calculatedBandwidthGbps, STRETCH_MIN_BANDWIDTH_GBPS)` | One line; already using number type from Decimal.toNumber() at this point |
| i18n parametric messages | String interpolation | vue-i18n `$t('key', { min: 3 })` with `{min}` in locale string | Handles all 4 locale formats correctly; already configured |
| URL schema forward-compat | Custom migration logic | Zod `.strip()` + `.default()` already handles it | New fields with `.default('shared')` parse as default from old URLs; no migration code needed |
| Witness RTT range logic | External lookup table | Inline conditional in `calcStretch()` | Only 2 thresholds (≤10 hosts = 200ms, 11-15 = 100ms) — a simple if/else is clearer than a data table |

**Key insight:** Phase 4 is entirely within the existing stack. The patterns needed — `Math.max()`, `Decimal.max()`, Zod defaults, Pinia ref/computed — are already established in the codebase.

---

## Common Pitfalls

### Pitfall 1: Bandwidth Test Regression (most likely to break CI)

**What goes wrong:** Developer adds the `STRETCH_MIN_BANDWIDTH_GBPS` constant and patches `calcStretch()` before updating the test. The test at `stretch.test.ts:28-40` asserts `toBeCloseTo(expectedStorageTB * 0.1, 5)` which expects ~0.097 Gbps. After the floor is applied, the function returns 10. CI goes red.

**Why it happens:** The test was written to document the formula — it pins the exact formula result, including the sub-10-Gbps case that is now a bug.

**How to avoid:** TDD constraint from the roadmap is mandatory. In the same commit: (a) rewrite the test description and assertion to expect 10 Gbps + `bandwidthFloorApplied: true`, then (b) apply the floor in `calcStretch()`. Two-step approach in a single commit is acceptable; two separate commits (test red between them) is also acceptable as long as no one merges the red state.

**Warning signs:** If `npm test` shows a pass after adding only the floor constant without touching the test, the test is either not running or the floor value happened to match the formula — double-check.

### Pitfall 2: Zod Schema / Store Sync (silent data loss)

**What goes wrong:** `managementArchitecture` ref added to `inputStore.ts`, but not added to `InputStateSchema` in `useUrlState.ts`. The field is serialized by `generateShareUrl` but discarded by `.strip()` in `hydrateFromUrl`. Shared URLs silently restore management architecture as 'shared' (the Zod default) regardless of what was set.

**Why it happens:** Three places require synchronisation: (1) `inputStore.ts` ref, (2) Zod schema in `useUrlState.ts`, (3) explicit assignment block in `hydrateFromUrl()`, (4) `generateShareUrl` state object. Missing any one causes silent data loss.

**How to avoid:** The current `useUrlState.ts` has a parallel manual assignment block (lines 72-88). For every new field, add: the Zod schema field, the assignment in `hydrateFromUrl`, and the field in the `generateShareUrl` state object — all in the same commit as the `inputStore.ts` ref addition.

**Warning signs:** A shared URL test — set management architecture to 'dedicated', generate URL, reload in new tab, verify architecture is still 'dedicated'. If it reverts to 'shared', the sync is broken.

### Pitfall 3: managementArchitecture Reaching calcManagement()/calcCompute()

**What goes wrong:** Developer wires `managementArchitecture` through `calcCompute()` or `calcManagement()` hoping to "factor it in." This disrupts the stretch doubling logic: in stretch mode, `calcCompute()` doubles the management overhead to account for both sites. If 'dedicated' mode suppresses this doubling, the stretch site calculation becomes wrong.

**Why it happens:** The management architecture concept superficially feels like it belongs in the compute formula.

**How to avoid:** `managementArchitecture` is ONLY consumed by: `validateInputs()` (new rule ARCH-01/02) and `dedicatedMgmtHostCount` computed in `calculationStore`. It does not change what management overhead is computed — it only changes how the output is presented and whether a validation error fires.

**Warning signs:** Any code path where `managementArchitecture === 'dedicated'` causes `stretchMultiplier` to change or `calcManagement()` to receive a different mode.

### Pitfall 4: Missing i18n Translations

**What goes wrong:** Developer adds new i18n keys to `en.json` but not `fr.json`, `de.json`, `it.json`. vue-i18n falls back to the key string (not the English text) in non-English locales, displaying raw keys like `deployment.stretchSites.networkChecklist.title` in the UI.

**Why it happens:** It is easy to forget the three non-primary locale files when focused on functionality.

**How to avoid:** The project constraint requires all 4 locale files updated in the same commit as the component. Treat this as a commit lint rule. After writing en.json keys, immediately translate into fr/de/it before committing.

**Warning signs:** Switch language to FR/DE/IT and check that checklist labels and validation messages render as human-readable text, not dot-separated key paths.

### Pitfall 5: StretchNetworkChecklist Not Populated for Non-Stretch Modes

**What goes wrong:** `calcStretch()` always returns a `networkChecklist` field. Consumers render the checklist even when `deploymentMode !== 'stretch'`, or the checklist displays stale data from the last stretch configuration.

**Why it happens:** `calculationStore.stretch` is always computed, even when stretch is not active (it is just not rendered). The new `networkChecklist` field will be populated with whatever the current inputs produce.

**How to avoid:** The `StretchNetworkChecklist.vue` component must conditionally render based on `inputStore.deploymentMode === 'stretch'` — the same guard used by the existing stretch output section. `calcStretch()` can always populate the checklist; it is the component's responsibility to show/hide it.

---

## Code Examples

### Existing stretch.ts — current formula (needs patching)

```typescript
// Source: /Users/fjacquet/Projects/vcf-sizer/src/engine/stretch.ts (line 28)
// CURRENT — returns values as low as ~0.097 Gbps for small workloads
const minBandwidthGbps = new Decimal(totalWorkloadStorageTB).times(0.1).toNumber()
```

### Patched stretch.ts — with floor

```typescript
// Source: Derived from Decimal.js docs + Broadcom TechDocs 10 Gbps floor
const STRETCH_MIN_BANDWIDTH_GBPS = 10  // VCF 9.0 absolute minimum (Broadcom TechDocs)
const calculatedBandwidthGbps = new Decimal(totalWorkloadStorageTB).times(0.1).toNumber()
const minBandwidthGbps = Math.max(calculatedBandwidthGbps, STRETCH_MIN_BANDWIDTH_GBPS)
const bandwidthFloorApplied = calculatedBandwidthGbps < STRETCH_MIN_BANDWIDTH_GBPS
```

### Existing validation.ts — rule append pattern

```typescript
// Source: /Users/fjacquet/Projects/vcf-sizer/src/engine/validation.ts (lines 37-76)
// Pattern: destructure inputs, push ValidationWarning with code + severity + messageKey
if (condition) {
  errors.push({
    code: 'DEDICATED_MGMT_MIN_HOSTS',
    severity: 'error',
    messageKey: 'validation.dedicatedMgmtMinHosts',
  })
}
```

### Existing inputStore.ts — ref() pattern

```typescript
// Source: /Users/fjacquet/Projects/vcf-sizer/src/stores/inputStore.ts (lines 19-21)
// Pattern: ref() at top level, returned from store function
const preferredSiteHosts = ref(3)
const secondarySiteHosts = ref(3)
// New field follows same pattern:
const managementArchitecture = ref<'shared' | 'dedicated'>('shared')
```

### Existing calculationStore.ts — computed() pattern

```typescript
// Source: /Users/fjacquet/Projects/vcf-sizer/src/stores/calculationStore.ts (lines 22-27)
// Pattern: computed() only, reading from input store
const effectiveHostCount = computed(() =>
  input.deploymentMode === 'stretch'
    ? input.preferredSiteHosts + input.secondarySiteHosts
    : input.hostCount
)
// New computed follows same pattern:
const dedicatedMgmtHostCount = computed<number | null>(() => {
  if (input.managementArchitecture !== 'dedicated') return null
  const coresPerHost = input.coresPerSocket * input.socketsPerHost
  return Math.max(4, Math.ceil(management.value.totalCores / coresPerHost))
})
```

### useUrlState.ts — sync all three locations for each new field

```typescript
// Source: /Users/fjacquet/Projects/vcf-sizer/src/composables/useUrlState.ts
// Location 1: Zod schema
managementArchitecture: z.enum(['shared', 'dedicated']).default('shared'),

// Location 2: hydrateFromUrl assignment block (lines 72-88)
store.managementArchitecture = state.managementArchitecture

// Location 3: generateShareUrl state object
managementArchitecture: store.managementArchitecture,
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VCF Standard/Consolidated architecture | "Dedicated Domains" / "Co-located" (VCF 9 terminology) | VCF 9.0 (retired in ~2024) | UI labels must NOT use Standard/Consolidated; engine enums can remain 'shared'/'dedicated' |
| Witness node OSA Tiny (2 vCPU/8 GB) | Witness ESA M profile (4 vCPU/16 GB) | vSAN ESA (Phase 3 decision) | Already implemented in stretch.ts; no change needed in Phase 4 |
| Bandwidth sizing as formula-only | Bandwidth floor 10 Gbps (Broadcom TechDocs VCF 9.0) | VCF 9.0 specification | Bug fix: apply floor via Math.max() |

**Deprecated/outdated:**

- Sub-10-Gbps bandwidth recommendations: Any stretch cluster recommendation below 10 Gbps is now spec-incorrect per VCF 9.0. The `bandwidthFloorApplied` indicator communicates this to users who had existing shared URLs.

---

## Open Questions

1. **ARCH-02 validation trigger scope**
   - What we know: The requirement fires "when co-located mode is selected with fewer than 3 hosts (vSAN) or fewer than 2 hosts (FC/NFS)"
   - What's unclear: Does "co-located mode" mean `managementArchitecture === 'shared'` OR is it a separate trigger from `deploymentMode`? The requirement does not specify that HA or Stretch mode is required.
   - Recommendation: Fire the COLLOCATED_MIN_HOSTS warning when `managementArchitecture !== 'dedicated'` AND hostCount is below the storage-type minimum. This covers Simple, HA, and Stretch modes — consistent with the requirement's intent of protecting against under-provisioning in any non-dedicated configuration.

2. **Where the management architecture toggle lives in the UI**
   - What we know: The requirement says "in HA and Stretch modes" for ARCH-01. The existing `DeploymentModelSelector.vue` already handles mode-specific UI visibility.
   - What's unclear: Whether the toggle should be in `DeploymentModelSelector.vue` (next to the mode selector) or a separate `ManagementArchitectureToggle.vue` component.
   - Recommendation: Planner's discretion — both are valid. The toggle is small enough to live inline in `DeploymentModelSelector.vue` with a `v-if="deploymentMode !== 'simple'"` guard.

3. **Witness RTT > 15 hosts/site**
   - What we know: Broadcom TechDocs specifies ≤10 hosts=200ms and 11-15 hosts=100ms. No threshold given for > 15 hosts/site.
   - What's unclear: Should the checklist display "contact Broadcom" or silently use 100ms as a conservative fallback?
   - Recommendation: Use 100ms as the conservative fallback value and add a UI note "Consult Broadcom TechDocs for configurations above 15 hosts/site." This avoids a hard error while communicating the limitation.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is purely code/config changes. All dependencies (TypeScript, Vitest, Vue 3, Pinia, Zod, Decimal.js) are already installed and confirmed running (80 passing tests, `npm run dev` operational from Phase 1/2/3 work).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/engine/stretch.test.ts` |
| Full suite command | `npx vitest run` |

**Current state:** 80 tests passing, 0 failing. All existing stretch tests pass before Phase 4 changes.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STRCH-06 | `minBandwidthGbps` returns 10 for small workload (formula < 10 Gbps) | unit | `npx vitest run src/engine/stretch.test.ts` | ✅ (existing test must be updated) |
| STRCH-07 | `bandwidthFloorApplied: true` when formula < 10; `false` when formula ≥ 10 | unit | `npx vitest run src/engine/stretch.test.ts` | ❌ Wave 0 — new test cases required |
| STRCH-08 | `networkChecklist` all fields populated with correct values for given site host counts | unit | `npx vitest run src/engine/stretch.test.ts` | ❌ Wave 0 — new test cases required |
| ARCH-01 | `DEDICATED_MGMT_MIN_HOSTS` error fires when dedicated + hostCount < 4 | unit | `npx vitest run src/engine/validation.test.ts` | ❌ Wave 0 — new test cases required |
| ARCH-02 | `COLLOCATED_MIN_HOSTS` warning fires when shared + below-minimum hosts for storage type | unit | `npx vitest run src/engine/validation.test.ts` | ❌ Wave 0 — new test cases required |
| URL sync | `managementArchitecture` serialises to URL and deserialises correctly | unit | `npx vitest run src/composables/useUrlState.test.ts` | ❌ Wave 0 — new test case required |

### Sampling Rate

- **Per task commit:** `npx vitest run src/engine/stretch.test.ts` (after bandwidth floor work) or `npx vitest run src/engine/validation.test.ts` (after validation rule work)
- **Per wave merge:** `npx vitest run` (full suite — must be 80+ passing, 0 failing)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/engine/stretch.test.ts` — update existing bandwidth test; add `bandwidthFloorApplied` tests; add `networkChecklist` tests (covers STRCH-06, STRCH-07, STRCH-08)
- [ ] `src/engine/validation.test.ts` — add `DEDICATED_MGMT_MIN_HOSTS` test cases (dedicated + < 4 hosts); add `COLLOCATED_MIN_HOSTS` test cases for vSAN and FC/NFS (covers ARCH-01, ARCH-02)
- [ ] `src/composables/useUrlState.test.ts` — add `managementArchitecture` round-trip URL test

*(Existing test infrastructure — vitest.config.ts, `/// <reference types="vitest/globals" />`, describe/it/expect globals — fully covers all new tests. No framework install needed.)*

---

## Project Constraints (from CLAUDE.md — global rules)

No project-level `CLAUDE.md` exists in `/Users/fjacquet/Projects/vcf-sizer/`. The following constraints are extracted from the Phase 4 roadmap definition and accumulated decisions in `STATE.md`:

| Constraint | Source | Applies To |
|------------|--------|------------|
| All arithmetic uses Decimal.js — no native JS float math | CALC-01 / project convention | `minBandwidthGbps` computation — use `Decimal.times()` before converting to number |
| `calculationStore` exposes only `computed()` — zero `ref()` | CALC-02 | `dedicatedMgmtHostCount` must be `computed()` |
| All engine functions: zero Vue imports | CALC-01 | `stretch.ts`, `validation.ts` — never import from Vue |
| All i18n keys in all 4 locale files in same commit as UI component | Roadmap Phase 4 constraint | Every new key in en.json must appear in fr.json, de.json, it.json simultaneously |
| `engine/types.ts` additive changes land before any other file | Roadmap Phase 4 constraint | types.ts is the first commit of the phase |
| Bandwidth floor test updated before floor constant added (TDD) | Roadmap Phase 4 constraint | `stretch.test.ts` rewrite precedes `stretch.ts` patch |
| UI labels: "Dedicated Domains" / "Co-located"; engine enums: `'shared' \| 'dedicated'` | Roadmap Phase 4 constraint | All i18n keys and component labels |
| Global MCP rule: validate library API with Context7 before writing import statements | Global CLAUDE.md | Any new Decimal.js, Zod, or Pinia API usage |

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `/Users/fjacquet/Projects/vcf-sizer/src/engine/stretch.ts` — current bandwidth formula (line 28), no floor, no checklist
- Direct code inspection: `/Users/fjacquet/Projects/vcf-sizer/src/engine/stretch.test.ts` — test at line 28-40 pins pre-floor value; must be updated first
- Direct code inspection: `/Users/fjacquet/Projects/vcf-sizer/src/engine/types.ts` — current `StretchResult` (5 fields, no checklist); current `ValidationInputs` (no managementArchitecture)
- Direct code inspection: `/Users/fjacquet/Projects/vcf-sizer/src/engine/validation.ts` — existing rule patterns; confirmed `hostCount` is present in `ValidationInputs`
- Direct code inspection: `/Users/fjacquet/Projects/vcf-sizer/src/stores/inputStore.ts` — confirmed `managementArchitecture` is NOT present; existing ref() pattern
- Direct code inspection: `/Users/fjacquet/Projects/vcf-sizer/src/stores/calculationStore.ts` — confirmed CALC-02 compliance; `dedicatedMgmtHostCount` is NOT present; existing computed() pattern
- Direct code inspection: `/Users/fjacquet/Projects/vcf-sizer/src/composables/useUrlState.ts` — confirmed 3-location sync requirement (Zod schema, hydrateFromUrl assignment, generateShareUrl state object); `managementArchitecture` NOT present
- Direct code inspection: `/Users/fjacquet/Projects/vcf-sizer/src/i18n/locales/en.json` — existing key structure; confirmed namespace pattern for new keys
- `.planning/research/ARCHITECTURE.md` (2026-03-29) — v2.0 integration architecture; confirmed build order, type extensions, data flow
- `.planning/research/SUMMARY.md` (2026-03-29) — confirmed stack (zero new dependencies); confirmed pitfalls 11-18
- `.planning/research/PITFALLS.md` (2026-03-29) — pitfalls 11-18 with prevention strategies
- Broadcom TechDocs VCF 9.0 Bandwidth and Latency Requirements (cited in ARCHITECTURE.md) — 10 Gbps floor, RTT thresholds, witness latency, MTU 9000; HIGH confidence
- Broadcom KB 392993 (cited in SUMMARY.md and ARCHITECTURE.md) — minimum 4 ESXi hosts for management domain with vSAN; HIGH confidence

### Secondary (MEDIUM confidence)

- `.planning/phases/03-advanced-features-and-polish/03-CONTEXT.md` — Phase 3 decisions confirm existing stretch inputs structure, i18n approach, and test patterns
- Broadcom Community Forum (cited in SUMMARY.md) — confirms VCF 9 retirement of "Standard/Consolidated" terminology

### Tertiary (LOW confidence)

- None — all Phase 4 implementation decisions are grounded in direct code inspection or HIGH confidence official sources.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — confirmed from direct code inspection; zero new dependencies
- Architecture: HIGH — all patterns derived from existing working code in the repository
- Type extensions: HIGH — additive-only; TypeScript strict mode enforces correctness
- Bandwidth floor spec: HIGH — Broadcom TechDocs VCF 9.0 (cited in prior research at HIGH confidence)
- Witness RTT thresholds: HIGH — Broadcom TechDocs VCF 9.0 (cited in ARCHITECTURE.md)
- Management domain 4-host minimum: MEDIUM-HIGH — Broadcom KB 392993 confirmed by prior research; no direct retrieval in this session
- Pitfalls: HIGH — all pitfalls derived from direct code analysis of affected files

**Research date:** 2026-03-29
**Valid until:** Stable stack — valid for 30 days; Broadcom VCF 9.0 specs valid until next VCF major release
