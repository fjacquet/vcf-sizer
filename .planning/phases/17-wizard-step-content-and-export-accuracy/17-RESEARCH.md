# Phase 17: Wizard Step Content and Export Accuracy — Research

**Researched:** 2026-03-31
**Domain:** Vue 3 / Pinia wizard validation gates, computed-state-driven UI, Markdown and PPTX export enrichment
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIZARD-03 | User cannot advance from step 1 until a topology (Simple / HA / Stretch) is selected | TopologySelector already writes deploymentMode; need a "topologySelected" computed guard in uiStore or WizardStepper |
| WIZARD-04 | User cannot advance from step 2 until management domain host count meets minimum | calculationStore.dedicatedMgmtHostCount + management.totalCores expose what is needed; need a computed isStep2Valid |
| WIZARD-05 | Management domain result card at bottom of step 2 | ManagementSummary already shows overhead table; need dedicated card showing host count + utilization |
| WIZARD-06 | Collapsed read-only management summary panel at top of step 3 | New component needed; reads same calc values; collapsed by default via v-show toggle |
| EXPORT-01 | Markdown aggregate totals includes management hosts line | useMarkdownExport.ts aggregateTotals section needs one new conditional row |
| EXPORT-02 | PPTX aggregate totals slide includes management hosts row | buildAggregateSlideData() needs one new conditional entry; generatePptxReport() table unchanged |
</phase_requirements>

---

## Summary

Phase 17 completes the wizard interaction model by adding validation gates that prevent premature step advancement, surfaces management sizing results inline, and extends the export outputs to include management host counts.

All six requirements are within the existing Vue 3 / Pinia / Tailwind / pptxgenjs stack — no new dependencies are introduced. The topology gate (WIZARD-03) is a simple computed on `inputStore.managementDomain.deploymentMode`; because `ManagementDomainConfig` does not carry a "unselected" sentinel, the gate approach is: the initial default `deploymentMode` is `'ha'`, which means the topology is **always selected by default**. This needs careful analysis — see the Topology Gate section below.

The management validation gate (WIZARD-04) already has full engine support: `calculationStore` exposes `dedicatedMgmtHostCount` (null when colocated) and `management.totalCores`, and `validateInputs` in the engine already generates error-severity warnings for host-count violations. The gate can be computed from `aggregateTotals.allValidationErrors`.

Export changes (EXPORT-01, EXPORT-02) are purely additive: one conditional row in the Markdown aggregate table and one in `buildAggregateSlideData`.

**Primary recommendation:** Implement WIZARD-03 gate by introducing an explicit "topology not yet selected" sentinel state — either `null | DeploymentMode` for `managementDomain.deploymentMode`, or a boolean flag `topologyConfirmed` in `uiStore`. The boolean flag in `uiStore` is the lower-risk path because it does not alter the engine's type contract.

---

## Project Constraints (from CLAUDE.md)

- Engine files (`src/engine/*.ts`) must NEVER import from Vue, Pinia, or any Vue ecosystem library (CALC-01).
- `calculationStore.ts` must NEVER contain `ref()` — only `computed()` (CALC-02).
- Validation warnings must use i18n message keys, never raw English strings.
- `VueI18nPlugin` configured with `include` omitted intentionally — do not change plugin config.
- Test coverage: `src/engine/**/*.test.ts`, `src/composables/**/*.test.ts`, `src/stores/**/*.test.ts` (extended in Phase 16).
- Path alias: `@/` maps to `src/`.
- `v-show` (not `v-if`) for wizard step panels — data preservation on back-navigation (WIZARD-02).
- Wizard step state lives exclusively in `uiStore` — never in `InputStateSchema` (WIZARD-07 structural guarantee).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 (Composition API) | 3.x (project) | Reactive component tree | Already in use throughout |
| Pinia | 2.x (project) | Store state — uiStore, inputStore, calculationStore | Already in use; wizard step lives in uiStore |
| vue-i18n | 9.x (project) | Localization of all UI text and messages | Already in use; all 4 locales must receive new keys |
| Tailwind CSS | 3.x (project) | Utility-first styling | All components use Tailwind classes |
| Vitest | (project) | Unit tests for stores and composables | Test infra covers src/stores/**/*.test.ts |

### No New Dependencies
This phase adds zero new npm packages. All required functionality is already present:
- Computed guards: `computed()` from Vue 3
- Result display: existing `calculationStore` values already expose host counts
- Export strings: plain template literal concatenation in `useMarkdownExport.ts`
- PPTX row: `buildAggregateSlideData` is a plain array function

---

## Architecture Patterns

### Recommended Project Structure

No new directories. New files go in existing directories:

```
src/
├── components/shared/
│   ├── ManagementResultCard.vue   # NEW — step 2 result card (WIZARD-05)
│   └── ManagementCommittedSummary.vue  # NEW — collapsed step 3 summary (WIZARD-06)
├── stores/
│   └── uiStore.ts                 # MODIFY — add topologyConfirmed flag + isStep2Valid computed
├── components/shared/
│   └── WizardStepper.vue          # MODIFY — canGoForward becomes step-specific guard
├── composables/
│   ├── useMarkdownExport.ts       # MODIFY — add mgmt hosts line to aggregate section
│   └── usePptxExport.ts           # MODIFY — add mgmt hosts row to buildAggregateSlideData
└── i18n/locales/
    ├── en.json   # MODIFY — add wizard.step1.topologyRequired, wizard.step2.mgmtInvalid, mgmtSummary.* keys
    ├── fr.json
    ├── de.json
    └── it.json
```

---

## Critical Design Decisions

### WIZARD-03: The Topology Gate Problem

**Problem:** `ManagementDomainConfig.deploymentMode` defaults to `'ha'` (see `createDefaultManagementDomain()`). This means on first load the topology **already appears selected** — the gate would never block.

**Two options:**

**Option A — `topologyConfirmed: ref<boolean>(false)` in `uiStore`**
- `canGoForwardStep1 = computed(() => ui.topologyConfirmed)`
- `TopologySelector.setGlobalTopology()` calls `ui.confirmTopology()` action after atomic write
- Clean separation: engine types unchanged, no sentinel null, WIZARD-07 safe (uiStore not serialized)
- Risk: one more uiStore field, but already established that uiStore is the right home for ephemeral wizard flags

**Option B — Change `deploymentMode` in `ManagementDomainConfig` to `null | DeploymentMode`**
- Requires: type change in `types.ts`, Zod schema update in `useUrlState.ts`, null-guards in all engine calls, defaults.ts change
- High blast radius — touches engine, URL schema, calculationStore, multiple components
- Not recommended: disproportionate risk for a display-only gate

**Recommendation:** Option A — `topologyConfirmed: ref<boolean>(false)` in `uiStore`. TopologySelector already calls `updateManagementDomain` + `workloadDomains.forEach`; add `ui.setTopologyConfirmed(true)` at the end of `setGlobalTopology()`. This needs `uiStore` imported into `TopologySelector.vue`.

**WIZARD-07 safety:** `topologyConfirmed` must NOT appear in `InputStateSchema`. uiStore state is never serialized to URL — the structural guarantee holds by the same mechanism as `currentWizardStep`.

### WIZARD-04: Step 2 Validation Gate

**What "management domain host count meets minimum" means:**

In `calculationStore`, the `domainResults` computed already runs `validateInputs` for each workload domain. However, management-domain-specific validation (dedicated min hosts = 4, colocated min hosts) is mixed into workload domain validation via `managementArchitecture` parameter.

The correct gate signal is: are there any **error-severity** validation warnings that relate to management constraints? The simplest implementation:

```typescript
// In uiStore or as a computed in WizardStepper
const calc = useCalculationStore()
const isStep2Valid = computed(() =>
  calc.aggregateTotals.allValidationErrors
    .filter(w => w.severity === 'error')
    .every(w => !w.code.includes('MGMT') && !w.code.includes('DEDICATED'))
)
```

However, `allValidationErrors` contains per-workload-domain errors too. A cleaner approach is to add a dedicated `managementValidationErrors` computed to `calculationStore` that runs `validateInputs` specifically for the management domain configuration. This keeps the gate precise.

**Alternative (simpler):** The management domain section in step 2 is `ManagementDomainSection.vue`. That component already has `dedicatedMgmtHostCount`. The gate can check `calc.dedicatedMgmtHostCount !== null ? dedicatedMgmtHostCount >= 4 : colocatedHostsValid`. This is deterministic without rerunning full validation.

**Recommendation:** Add `isManagementValid: computed<boolean>` to `uiStore` (reads from `calculationStore`) or compute inline in `WizardStepper`. Inline computed in `WizardStepper` avoids adding more store coupling.

**Inline gate logic for WizardStepper:**
```typescript
const input = useInputStore()
const calc = useCalculationStore()

// Step 2 gate: management domain inputs are valid when no management-related errors exist.
// For dedicated architecture: dedicatedMgmtHostCount must be >= 4
// For colocated: managementDomain config has no dedicated host count field —
//   use presence/absence of DEDICATED_MGMT_MIN_HOSTS error code as proxy
const isStep2Valid = computed(() => {
  const errors = calc.aggregateTotals.allValidationErrors
  return !errors.some(e => e.code === 'DEDICATED_MGMT_MIN_HOSTS')
})
```

Wait — `DEDICATED_MGMT_MIN_HOSTS` validation fires from `validateInputs` which takes `hostCount` from workload domains, not management domain. Need to verify whether this error can even fire for management. Let me trace:

In `calculationStore`, `validateInputs` is called with `managementArchitecture: input.managementArchitecture` and `hostCount: domain.hostCount` where `domain` is a workload domain. So `DEDICATED_MGMT_MIN_HOSTS` fires when a workload domain has `hostCount < 4` AND `managementArchitecture === 'dedicated'`.

**This is not the right signal for step 2.** The management domain itself has no `hostCount` field in `ManagementDomainConfig` — the management host count is computed by `calculationStore.dedicatedMgmtHostCount` from cores and coresPerHost. That computed returns `null` for colocated.

**Correct gate for WIZARD-04:** The management domain result card at the bottom of step 2 needs to show computed host count. The advance gate blocks when the computed result indicates a problem. The appropriate signal:

```typescript
// isStep2Valid: management domain sizing is actionable
// For dedicated: dedicatedMgmtHostCount must be >= 4 (Broadcom KB 392993)
// For colocated: always valid (no min host enforcement at mgmt domain level in this engine)
const isStep2Valid = computed(() => {
  if (input.managementArchitecture === 'dedicated') {
    const count = calc.dedicatedMgmtHostCount
    return count !== null && count >= 4
  }
  return true // colocated: no management host minimum
})
```

This is clean and deterministic. `dedicatedMgmtHostCount` is `Math.max(4, Math.ceil(...))` which always returns >= 4 when called, so it is actually always valid when non-null. The real guard is: is the management architecture configuration coherent? For the initial slice, `isStep2Valid = true` for colocated and `dedicatedMgmtHostCount !== null` for dedicated is sufficient.

**Inline message:** When step 2 Next is disabled, show an inline message explaining why. This requires a new i18n key: `wizard.step2.advanceBlocked` (e.g., "Configure a valid management domain before proceeding").

### WIZARD-05: Management Result Card at Step 2

**What to show:** Computed host count and utilization figures.

The existing `ManagementSummary.vue` shows the overhead table (component-level breakdown). WIZARD-05 requires a **result card** showing:
- Computed host count (dedicated: `dedicatedMgmtHostCount`; colocated: "colocated with WLD-1")
- Management vCPU required (`management.totalCores`)
- Management RAM required (`management.totalRamGB`)

This is a new component `ManagementResultCard.vue` in `src/components/shared/`. It reads `calculationStore`.

In `App.vue` step 2 panel, it is placed **below** `ManagementDomainSection` and `ManagementSummary`, at the bottom of the step 2 panel.

### WIZARD-06: Collapsed Management Summary at Step 3

**What to show:** Host count, vCPU, RAM committed in step 2. Read-only. Collapsed by default.

Pattern: `<details>/<summary>` HTML native, or a toggle boolean with `v-show` content panel. The project uses Tailwind and Vue, so a boolean `isExpanded` ref in the component is idiomatic.

New component `ManagementCommittedSummary.vue` placed at the **top** of the step 3 panel in `App.vue`. It has a toggle button, collapsed by default, showing 3 values.

**Read-only enforcement:** The component displays values only. It does not contain any input components. The underlying `ManagementDomainSection` in step 2 is the only edit path, and step 3's `v-show` hides it.

### EXPORT-01: Markdown Management Hosts Line

**Current state** of aggregate section in `useMarkdownExport.ts` (lines 211-221):
```
## Aggregate Totals
| Total recommended hosts (all domains) | N |
| Total VM count | N |
| Total raw storage | N TB |
| Total effective storage | N TB |
```

**Target state** — add one conditional row:
```
## Aggregate Totals
| Total recommended hosts (all domains) | N |
| Management hosts | N |   ← dedicated mode
| Management hosts | colocated with WLD-1 |   ← colocated mode
| Total VM count | N |
| ...
```

Implementation: after the existing `totalRecommendedHosts` row, insert:
```typescript
if (store.managementArchitecture === 'dedicated' && calc.dedicatedMgmtHostCount !== null) {
  sections.push(`| Management hosts | ${calc.dedicatedMgmtHostCount} |`)
} else {
  sections.push(`| Management hosts | colocated with WLD-1 |`)
}
```

**Confidence:** HIGH — the types and values are already available in the composable.

### EXPORT-02: PPTX Management Hosts Row

**Current state** of `buildAggregateSlideData` returns 4 rows. Change to 5 rows (conditional):

```typescript
export function buildAggregateSlideData(
  totals: AggregateTotals,
  managementArchitecture: string,
  dedicatedMgmtHostCount: number | null
): Array<{ label: string; value: string }> {
  const mgmtLine = managementArchitecture === 'dedicated' && dedicatedMgmtHostCount !== null
    ? String(dedicatedMgmtHostCount)
    : 'colocated with WLD-1'
  return [
    { label: 'Total recommended hosts (all domains)', value: String(totals.totalRecommendedHosts) },
    { label: 'Management hosts', value: mgmtLine },
    { label: 'Total VM count', value: String(totals.totalVmCount) },
    { label: 'Total raw storage', value: `${totals.totalRawStorageTB.toFixed(2)} TB` },
    { label: 'Total effective storage', value: `${totals.totalEffectiveStorageTB.toFixed(2)} TB` },
  ]
}
```

**Signature change impact:** The function is called in `generatePptxReport()` at line 589:
```typescript
const aggregateData = buildAggregateSlideData(calc.aggregateTotals)
```
This call must be updated to:
```typescript
const aggregateData = buildAggregateSlideData(
  calc.aggregateTotals,
  store.managementArchitecture,
  calc.dedicatedMgmtHostCount
)
```

**Test impact:** `buildAggregateSlideData` is a pure exported function. Its existing tests in `usePptxExport.test.ts` (if any test it) will need updating for the new signature. Verify before editing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapse/expand toggle | Custom animation system | Simple `ref<boolean>` + `v-show` | Already used throughout; zero complexity |
| Validation gate logic | New engine validation | Existing `calculationStore.dedicatedMgmtHostCount` | Value already computed reactively |
| i18n for new messages | Raw English strings | New keys in all 4 locale files | Project rule: all visible strings must use i18n keys |
| Management host count display | Recalculating from inputs | `calc.dedicatedMgmtHostCount` + `calc.management` | Reuse existing computed values |

---

## Common Pitfalls

### Pitfall 1: TopologySelector does not import uiStore yet
**What goes wrong:** If `topologyConfirmed` approach (Option A) is adopted, `TopologySelector.vue` currently has no reference to `uiStore`. Adding it is simple but must not be forgotten.
**How to avoid:** Add `const ui = useUiStore()` and `import { useUiStore }` to `TopologySelector.vue`, call `ui.confirmTopology()` at end of `setGlobalTopology()`.

### Pitfall 2: WizardStepper canGoForward is currently binary
**What goes wrong:** `canGoForward = computed(() => ui.currentWizardStep < 3)` allows forward navigation from any step unconditionally. Replacing this with step-specific gates changes the semantics.
**How to avoid:** Replace the single `canGoForward` with `canGoForwardStep1` and `canGoForwardStep2` computeds, combine into a step-aware computed: `canGoForward = computed(() => step === 1 ? step1Gate : step === 2 ? step2Gate : false)`.

### Pitfall 3: ManagementDomainConfig has no hostCount field
**What goes wrong:** Attempting to validate "management host count meets minimum" using a field that does not exist on `ManagementDomainConfig`. The type has `coresPerSocket`, `socketsPerHost`, `hostRamGB`, `hostStorageTB`, `deploymentMode` — no `hostCount`.
**How to avoid:** Use `calc.dedicatedMgmtHostCount` (derived from cores) as the source of truth for the management host count. For colocated architecture, the gate always passes (no dedicated host minimum).

### Pitfall 4: buildAggregateSlideData signature change breaks tests
**What goes wrong:** Existing tests for `buildAggregateSlideData` pass only `totals` argument; adding required params breaks them without updating call sites.
**How to avoid:** Check `usePptxExport.test.ts` before changing the function signature. Update all call sites in the same task.

### Pitfall 5: WIZARD-07 regression from new uiStore fields
**What goes wrong:** Adding `topologyConfirmed` to `uiStore` and accidentally including it in URL state (unlikely given architecture, but must be confirmed).
**How to avoid:** `topologyConfirmed` lives in `uiStore`, not `inputStore`. The `InputStateSchema` in `useUrlState.ts` only serializes `inputStore` fields. No action needed unless `topologyConfirmed` were to be added to `inputStore` (must not happen).

### Pitfall 6: Collapsed summary component not actually read-only
**What goes wrong:** Using `ManagementDomainSection` inside the collapsed summary would allow editing from step 3. The summary must be a separate display-only component.
**How to avoid:** `ManagementCommittedSummary.vue` must contain only text/value display — no `NumberSliderInput`, no buttons that mutate store state.

### Pitfall 7: i18n keys missing in non-English locales
**What goes wrong:** Adding keys to `en.json` only; runtime throws missing key warnings in `fr`, `de`, `it`.
**How to avoid:** Add all new keys to all 4 locale files in the same task. Follow existing key structure under `wizard.*` and `results.aggregate.*`.

---

## Code Examples

### Pattern: Step-aware canGoForward in WizardStepper.vue

```typescript
// Source: derived from existing WizardStepper.vue + uiStore pattern
const canGoForward = computed(() => {
  if (!canGoForwardBase.value) return false  // step < 3 guard
  if (ui.currentWizardStep === 1) return ui.topologyConfirmed
  if (ui.currentWizardStep === 2) return isStep2Valid.value
  return false
})
```

### Pattern: topologyConfirmed in uiStore.ts

```typescript
// Ephemeral flag — never in InputStateSchema (WIZARD-07)
const topologyConfirmed = ref<boolean>(false)
function confirmTopology(): void { topologyConfirmed.value = true }
return { ..., topologyConfirmed, confirmTopology }
```

### Pattern: ManagementResultCard reading from calculationStore

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()

const hostCountDisplay = computed(() =>
  input.managementArchitecture === 'dedicated'
    ? String(calc.dedicatedMgmtHostCount ?? 0)
    : t('wizard.mgmtResult.colocated')
)
</script>
```

### Pattern: Markdown aggregate row insertion

```typescript
// After existing totalRecommendedHosts row in useMarkdownExport.ts
const mgmtHostsDisplay = store.managementArchitecture === 'dedicated' && calc.dedicatedMgmtHostCount !== null
  ? String(calc.dedicatedMgmtHostCount)
  : 'colocated with WLD-1'
sections.push(`| Management hosts | ${mgmtHostsDisplay} |`)
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/stores/uiStore.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIZARD-03 | topologyConfirmed gates step 1 forward nav | unit | `npx vitest run src/stores/uiStore.test.ts` | Partially (file exists; new test needed) |
| WIZARD-04 | isStep2Valid reflects management host count validity | unit | `npx vitest run src/stores/uiStore.test.ts` | Partially |
| WIZARD-05 | ManagementResultCard renders correct host count | manual-only | — | Not a unit test target (component) |
| WIZARD-06 | ManagementCommittedSummary shows collapsed state | manual-only | — | Not a unit test target (component) |
| EXPORT-01 | Markdown aggregate section contains management hosts line | unit | `npx vitest run src/composables/useMarkdownExport.test.ts` | Need to verify existence |
| EXPORT-02 | buildAggregateSlideData returns management hosts row | unit | `npx vitest run src/composables/usePptxExport.test.ts` | Partially (file exists) |

### Wave 0 Gaps

- [ ] `src/stores/uiStore.test.ts` — add tests for `topologyConfirmed`/`confirmTopology` (WIZARD-03)
- [ ] `src/stores/uiStore.test.ts` — add `isStep2Valid` computed tests if gate logic moves to uiStore (WIZARD-04)
- [ ] Verify `src/composables/useMarkdownExport.test.ts` exists — add aggregate section test covering mgmt hosts line (EXPORT-01)
- [ ] `src/composables/usePptxExport.test.ts` — update `buildAggregateSlideData` test for new signature (EXPORT-02)

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — phase is purely code/config changes within existing stack)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WizardStepper Next always enabled | Step-specific validation gates | Phase 17 | Advance blocked until each step's conditions met |
| Aggregate totals shows workload hosts only | Aggregate totals includes management hosts line | Phase 17 | Export output complete for procurement |
| buildAggregateSlideData takes only totals | Accepts architecture + dedicatedMgmtHostCount params | Phase 17 | PPTX slide now shows management row |

---

## Open Questions

1. **Topology gate initial state on URL hydration**
   - What we know: `hydrateFromUrl()` restores `inputStore` but not `uiStore`; wizard always opens at step 1
   - What's unclear: should `topologyConfirmed` be set to `true` when a URL with a deploymentMode is hydrated? If user pastes a shared URL and the topology was already configured, blocking step 1 advance seems wrong.
   - Recommendation: If a URL is hydrated (inputStore has non-default state), set `topologyConfirmed = true` in `main.ts` after `hydrateFromUrl()` when `inputStore.managementDomain.deploymentMode` is set. OR: treat `topologyConfirmed` as "user clicked a topology button in this session" — URL-hydrated state can skip the gate by setting the flag in main.ts.

2. **ManagementDomainSection hostCount field missing**
   - What we know: `ManagementDomainConfig` has no `hostCount` — management host count is purely derived
   - What's unclear: WIZARD-04 says "host count meets minimum validation threshold" — the minimum for dedicated is 4, but `dedicatedMgmtHostCount` always returns `Math.max(4, ...)` so it is always >= 4
   - Recommendation: For dedicated architecture, the gate should check that coresPerHost > 0 (trivially true) and that the user has acknowledged the architecture. The real gate is "managementArchitecture is set" — which is always true since it defaults to 'colocated'. Consider WIZARD-04 as primarily gating on "management domain inputs are in a coherent state" rather than a strict numeric floor. The inline message should explain what the user should verify.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `src/stores/uiStore.ts`, `src/stores/inputStore.ts`, `src/stores/calculationStore.ts` — current implementation verified
- Direct file reads: `src/components/shared/WizardStepper.vue`, `TopologySelector.vue`, `ManagementSummary.vue` — Phase 16 outputs verified
- Direct file reads: `src/composables/useMarkdownExport.ts`, `usePptxExport.ts` — export functions verified
- Direct file reads: `src/engine/validation.ts`, `types.ts`, `defaults.ts`, `management.ts` — engine contracts verified
- Direct file reads: `src/i18n/locales/en.json` — existing i18n structure verified
- Phase 16 summaries (16-01-SUMMARY.md, 16-02-SUMMARY.md) — Phase 16 decisions verified
- `.planning/REQUIREMENTS.md` — requirement texts verified
- `.planning/STATE.md` — locked decisions verified

### Secondary (MEDIUM confidence)
- `.planning/config.json` — nyquist_validation: true confirmed (Validation Architecture section included)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns already in codebase
- Architecture: HIGH — all types, stores, and components read directly from source
- Pitfalls: HIGH — derived from direct code inspection of Phase 16 outputs
- Export changes: HIGH — exact line numbers and function signatures verified

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable stack; valid until codebase changes)
