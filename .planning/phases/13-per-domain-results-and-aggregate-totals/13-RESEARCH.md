# Phase 13: Per-Domain Results and Aggregate Totals - Research

**Researched:** 2026-03-30
**Domain:** Vue 3 component refactor — per-domain result cards, aggregate totals card, export composable rewiring
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RES-01 | Each workload domain renders its own result card showing domain name, recommended host count, CPU utilization %, RAM utilization %, and storage breakdown | `DomainResult` has all required fields; `v-for` over `calculationStore.domainResults` is the pattern |
| RES-02 | An aggregate totals card summarizes all workload domains: total host count, combined compute demand, combined storage demand | `AggregateTotals` shape confirmed; new component reads `calculationStore.aggregateTotals` |
| RES-03 | Management domain results render in their existing dedicated section, unchanged from v2.x | `ManagementSummary` and `dedicatedMgmtHostCount` already work; no engine changes needed |
</phase_requirements>

---

## Summary

Phase 13 is a pure Vue component layer refactor — the engine and store are already complete. The `calculationStore` already exposes `domainResults: ComputedRef<DomainResult[]>` and `aggregateTotals: ComputedRef<AggregateTotals>` (both written in Phase 10). No new engine functions, no new Pinia state, no new types are needed.

The primary work is: (1) replace the existing single-domain result components with per-domain variants that iterate over `domainResults`, (2) add an `AggregateTotalsCard` component, (3) fix the build-blocking TypeScript errors in `usePptxExport.ts` and `useMarkdownExport.ts` that reference the old flat store API, and (4) fix the 58 test failures in both export composable test files.

The existing chart components (`CoresChart.vue`, `RamChart.vue`, `StorageChart.vue`) and `StretchNetworkChecklist.vue` all reference `calc.compute`, `calc.storage`, `calc.stretch`, and `calc.vsanMax` — properties that no longer exist on `calculationStore` after the Phase 10 refactor. These must be rewritten to read from a specific `DomainResult` entry or hidden pending Phase 14. Charts are listed as deferred to v3.1+ in REQUIREMENTS.md, so the simplest compliant approach is to render charts for the **active domain** only (or defer them entirely).

Management domain results (`ManagementSummary`) already work correctly — it reads `calc.management` which still exists unchanged.

**Primary recommendation:** Create `DomainResultCard.vue` that accepts a `DomainResult` prop; render one per `domainResults`; create `AggregateTotalsCard.vue`; rewrite `HostCountCard`, charts, `StretchNetworkChecklist`, and `VsanMaxClusterCard` to operate on an active-domain basis or remove them from `ResultsPanel` (since per-domain cards replace them). Fix both export composables to use the new `domainResults[0]` / `aggregateTotals` API for the build to pass.

---

## Project Constraints (from CLAUDE.md)

- Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library (CALC-01).
- `calculationStore.ts` must never contain `ref()` — only `computed()` (CALC-02).
- Validation warnings must use i18n message keys, not English strings.
- `VueI18nPlugin` is configured with `include` omitted intentionally — do not add it.
- Tests cover `src/engine/**/*.test.ts` and `src/composables/**/*.test.ts` only.
- `npm run test` runs Vitest in node environment — no DOM environment available.
- `npm run build` must pass (vue-tsc + Vite) — currently fails due to Phase 10 debt.

---

## Current State Inventory

### What currently exists (BROKEN after Phase 10)

| Component / File | Problem | Action |
|-----------------|---------|--------|
| `HostCountCard.vue` | Reads `storeToRefs(calc).compute` — `calc.compute` no longer exists | Rewrite to accept `DomainResult` prop OR remove and replace with per-domain card |
| `CoresChart.vue` | Reads `storeToRefs(calc).compute` — no longer exists | Rewrite to receive a `ComputeResult` prop; wire from active domain |
| `RamChart.vue` | Reads `storeToRefs(calc).compute` — no longer exists | Same as CoresChart |
| `StorageChart.vue` | Reads `storeToRefs(calc).storage` — `calc.storage` no longer exists | Rewrite to receive a `StorageResult` prop; wire from active domain |
| `StretchNetworkChecklist.vue` | Reads `storeToRefs(calc).stretch` AND `input.deploymentMode` (flat) — both gone | Rewrite to accept a `DomainResult` prop; conditionally render when `domainResult.stretch !== null` |
| `VsanMaxClusterCard.vue` | Reads `storeToRefs(calc).vsanMax` AND `storeToRefs(input).storageType` (flat) — both gone | Rewrite to accept a `DomainResult` prop; conditionally render when `domainResult.vsanMax !== null` |
| `usePptxExport.ts` | 28 TypeScript errors — references flat `store.vmCount`, `store.deploymentMode`, `calc.compute`, `calc.storage`, `calc.stretch`, `calc.vsanMax`, `calc.validationErrors` | Rewire to use `domainResults[0]` for single-domain compat bridge (Phase 13); full multi-domain PPTX is Phase 14 |
| `useMarkdownExport.ts` | All 35 tests fail — references flat `store.deploymentMode`, `store.vmCount`, `store.storageType`, `calc.compute`, `calc.storage`, `calc.stretch`, `calc.vsanMax`, `calc.validationErrors` | Same bridge approach as PPTX |

### What currently works (DO NOT TOUCH)

| Component / File | Status |
|-----------------|--------|
| `ManagementSummary.vue` | Reads `calc.management` — still exists, fully working |
| `ResultsPanel.vue` | Just a layout shell; needs its child list updated |
| `calculationStore.ts` | `domainResults`, `aggregateTotals`, `management`, `dedicatedMgmtHostCount` — all correct |
| `inputStore.ts` | `workloadDomains`, `managementDomain`, `managementArchitecture`, `activeDomainIndex` — all correct |
| All engine tests (164 passing) | Engine layer is clean — do not change |

---

## Architecture Patterns

### Pattern 1: Per-Domain Result Card (Prop-Driven)

The correct pattern for Phase 13 is a prop-driven card component rather than components that call `useCalculationStore()` internally. This allows the parent (`ResultsPanel`) to iterate over `domainResults` with `v-for`.

```typescript
// DomainResultCard.vue — receives a DomainResult prop
import type { DomainResult } from '@/engine/types'
const props = defineProps<{ result: DomainResult }>()
// Access: props.result.name, props.result.compute, props.result.storage,
//         props.result.stretch, props.result.vsanMax, props.result.validationErrors
```

### Pattern 2: ResultsPanel iterates domainResults

```typescript
// ResultsPanel.vue
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'
const calc = useCalculationStore()
const { domainResults, aggregateTotals } = storeToRefs(calc)
```

```html
<!-- ResultsPanel.vue template -->
<DomainResultCard
  v-for="result in domainResults"
  :key="result.id"
  :result="result"
/>
<AggregateTotalsCard :totals="aggregateTotals" />
```

Note: `:key="result.id"` must use the domain `id` (crypto.randomUUID()), not array index — consistent with v3.0 locked decision.

### Pattern 3: AggregateTotals Card

```typescript
// AggregateTotalsCard.vue
import type { AggregateTotals } from '@/engine/types'
const props = defineProps<{ totals: AggregateTotals }>()
// Display: props.totals.totalRecommendedHosts (procurement number)
//          props.totals.totalVmCount
//          props.totals.totalRawStorageTB
//          props.totals.totalEffectiveStorageTB
//          props.totals.allValidationErrors (global warning list)
```

The `totalRecommendedHosts` field is the procurement number (workload domains only — management host count is separate via `calc.dedicatedMgmtHostCount`). The card should visually emphasize this number.

### Pattern 4: Chart Components — Active-Domain Bridge

Charts (`CoresChart`, `RamChart`, `StorageChart`) are a complication. They currently read `calc.compute` and `calc.storage` which no longer exist. Options:

1. **Remove charts from Phase 13** — charts are listed as "deferred to v3.1+" in REQUIREMENTS.md (per-domain Chart.js visualizations). Removing them from `ResultsPanel` entirely is valid for Phase 13 and simplifies the scope. The per-domain card shows utilization percentages as text; charts are a visualization bonus.

2. **Bridge to active domain** — read `domainResults[input.activeDomainIndex]` and pass `compute`/`storage` as props. This keeps charts working but ties them to the active tab only.

The deferred-to-v3.1+ note in REQUIREMENTS.md says "per-domain Chart.js visualizations" — this implies charts are OUT OF SCOPE for Phase 13. Option 1 (remove charts from ResultsPanel for now) is cleanest and most aligned with requirements scope.

### Pattern 5: Export Composable Bridge (Phase 13 partial fix)

`usePptxExport.ts` and `useMarkdownExport.ts` both reference the v2.x flat store API. The full multi-domain export rewrite is Phase 14. For Phase 13, the composables must be fixed to **compile and pass tests** — the strategy is to use `domainResults[0]` as the first-domain bridge and `aggregateTotals` for totals.

Key mappings:
- `store.vmCount` → `input.workloadDomains[0].vmCount`
- `store.deploymentMode` → `input.workloadDomains[0].deploymentMode`
- `store.storageType` → `input.workloadDomains[0].storageType`
- `store.vsanMaxProfile` → `input.workloadDomains[0].vsanMaxProfile`
- `store.preferredSiteHosts` → `input.workloadDomains[0].preferredSiteHosts`
- `store.secondarySiteHosts` → `input.workloadDomains[0].secondarySiteHosts`
- `store.gpuVmCount` → `input.workloadDomains[0].gpuVmCount`
- `store.nvmeTieringEnabled` → `input.workloadDomains[0].nvmeTieringEnabled`
- `store.activeMemoryPct` → `input.workloadDomains[0].activeMemoryPct`
- `calc.compute` → `calc.domainResults[0].compute`
- `calc.storage` → `calc.domainResults[0].storage`
- `calc.stretch` → `calc.domainResults[0].stretch`
- `calc.vsanMax` → `calc.domainResults[0].vsanMax`
- `calc.validationErrors` → `calc.aggregateTotals.allValidationErrors`

### Pattern 6: storeToRefs() with domainResults

`domainResults` is a `ComputedRef<DomainResult[]>`. When destructured via `storeToRefs()`, it works correctly. Inside a component template, access via `domainResults` (the ref is unwrapped automatically). In script setup, use `domainResults.value` when reading the array.

### Recommended Component Structure

```
src/components/results/
├── ResultsPanel.vue           # Rewritten: v-for DomainResultCard + AggregateTotalsCard
├── DomainResultCard.vue       # NEW: props.result: DomainResult
├── AggregateTotalsCard.vue    # NEW: props.totals: AggregateTotals
├── VsanMaxClusterCard.vue     # REWRITE: accept DomainResult prop, conditional render
├── StretchNetworkChecklist.vue # REWRITE: accept DomainResult prop
├── HostCountCard.vue          # REMOVE or absorb into DomainResultCard
├── ExportToolbar.vue          # UNCHANGED
└── charts/
    ├── CoresChart.vue         # REMOVE from ResultsPanel (deferred v3.1+) OR rewrite props
    ├── RamChart.vue           # Same
    └── StorageChart.vue       # Same
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive array iteration | Custom reactivity wrapper | `v-for` with `:key="result.id"` over `storeToRefs` computed | Vue's built-in reactivity handles computed array updates |
| Utilization percentage coloring | Custom CSS logic | Tailwind conditional classes `:class="pct > 80 ? 'text-red-600' : 'text-emerald-600'"` | Pattern already used in HostCountCard |
| Validation warning display | Custom warning component | Existing `WarningBanner.vue` already in `src/components/shared/` | Already used in VsanMaxClusterCard |

---

## DomainResult Shape — Full Field Reference

```typescript
interface DomainResult {
  id: string                     // crypto.randomUUID()
  name: string                   // user-editable, e.g. "WLD-1"
  compute: ComputeResult         // recommendedHostCount, coreUtilizationPct, ramUtilizationPct, ...
  storage: StorageResult         // safeUsableCapacityTB, raidScheme, ...
  stretch: StretchResult | null  // non-null only when domain.deploymentMode === 'stretch'
  vsanMax: VsanMaxResult | null  // non-null only when domain.storageType === 'vsan-max'
  validationErrors: ValidationWarning[]
}
```

**ComputeResult fields for RES-01:**
- `recommendedHostCount` — the host count number to display
- `coreUtilizationPct` — CPU utilization %
- `ramUtilizationPct` — RAM utilization %
- `minHostsForCpu`, `minHostsForRam` — supporting data

**StorageResult fields for RES-01:**
- `safeUsableCapacityTB` — the headline storage number
- `raidScheme` — e.g. "2+1 (FTT=1 RAID-5)"
- `rawCapacityTB`, `usableAfterRaidTB`, `lfsOverheadTB`, `metadataOverheadTB`

**AggregateTotals fields for RES-02:**
- `totalRecommendedHosts` — procurement number (workload domains only)
- `totalVmCount` — total VMs across all domains
- `totalRawStorageTB` — combined raw storage
- `totalEffectiveStorageTB` — combined effective capacity
- `allValidationErrors` — flat-mapped from all domains

---

## Common Pitfalls

### Pitfall 1: storeToRefs() on computed array returns ref, not reactive array
**What goes wrong:** Accessing `domainResults` as an array directly in script (not template) without `.value` causes TypeScript errors.
**Why it happens:** `storeToRefs()` wraps computed values in `Ref<T>` — in the template Vue auto-unwraps, but in script you need `.value`.
**How to avoid:** In `<script setup>` use `domainResults.value` for array operations. In template, use `domainResults` directly.

### Pitfall 2: HostCountCard references `calc.compute` which no longer exists
**What goes wrong:** Build fails with TS2339 on `calc.compute`.
**Why it happens:** Phase 10 removed the flat computed properties from calculationStore — only `management`, `domainResults`, `aggregateTotals`, `dedicatedMgmtHostCount` remain.
**How to avoid:** Do not reuse `HostCountCard` — fold its display into `DomainResultCard` or rewrite it to accept a prop.

### Pitfall 3: VsanMaxClusterCard reads `input.vsanMaxProfile` (flat) — no longer exists
**What goes wrong:** TS2339 — `vsanMaxProfile` is now per-domain inside `workloadDomains[]`.
**Why it happens:** Phase 10 moved all per-domain fields into `WorkloadDomainConfig`.
**How to avoid:** Pass the full `DomainResult` as prop; extract `vsanMax` from `result.vsanMax`; the profile label will need to come from a separate lookup or from the domain config passed alongside.

### Pitfall 4: StretchNetworkChecklist reads flat `input.deploymentMode` and `input.preferredSiteHosts`
**What goes wrong:** Both are now per-domain fields.
**How to avoid:** Pass `DomainResult` as prop; render `v-if="result.stretch !== null"`.

### Pitfall 5: Chart components use `storeToRefs(calc).compute` / `.storage`
**What goes wrong:** TS2339 on `calc.compute` and `calc.storage` (both removed in Phase 10).
**How to avoid:** Either remove charts from `ResultsPanel` for Phase 13 (cleanest — per REQUIREMENTS.md deferred scope) or rewrite charts to accept typed props.

### Pitfall 6: Rendering `allValidationErrors` for aggregate — i18n keys not strings
**What goes wrong:** `validationErrors` entries have `messageKey` which is an i18n key (e.g. `'validation.hostCount.tooFew'`), not a human-readable string.
**How to avoid:** Use `t(w.messageKey)` in the template — this is the established pattern from `WarningBanner.vue`.

### Pitfall 7: Export composable test mocks expect old flat API
**What goes wrong:** Tests in `usePptxExport.test.ts` and `useMarkdownExport.test.ts` mock `useInputStore()` and `useCalculationStore()` with flat shape objects — these will fail once the composables are updated.
**How to avoid:** When rewriting composables to use `workloadDomains[0]`, update test mocks to provide `{ workloadDomains: [{ vmCount: ..., ... }], managementArchitecture: '...', managementDomain: {...} }` and `{ domainResults: [{...}], aggregateTotals: {...} }`.

### Pitfall 8: `v-for :key` must use `result.id` not index
**What goes wrong:** Using index as key causes Vue to reuse DOM nodes incorrectly when domains are added/removed.
**How to avoid:** Always `:key="result.id"` — locked v3.0 decision.

---

## Build Order

Phase 13 must be executed in this order to keep the build passing at each step:

1. **Fix export composables first** (`usePptxExport.ts`, `useMarkdownExport.ts`) — eliminates all 28 build-blocking TS errors and the 58 test failures. Build will pass after this step.
2. **Rewrite result components** — `DomainResultCard.vue`, `AggregateTotalsCard.vue`, updated `ResultsPanel.vue`, `VsanMaxClusterCard.vue`, `StretchNetworkChecklist.vue`.
3. **Remove or bridge charts** — remove `CoresChart`, `RamChart`, `StorageChart` from `ResultsPanel` (or wrap them to read active domain only).
4. **Add i18n keys** — `results.domain.*`, `results.aggregate.*` in all 4 locale files.
5. **Verify** — `npm run build` passes, `npm run test` shows 164+ passing (previous engine tests) + new composable tests.

---

## i18n Keys Needed

New keys to add to all 4 locale files (`en.json`, `fr.json`, `de.json`, `it.json`):

```json
{
  "results": {
    "domain": {
      "hostCount": "Recommended Hosts",
      "cpuUtilization": "CPU Utilization",
      "ramUtilization": "RAM Utilization",
      "storageUsable": "Safe Usable Storage",
      "raidScheme": "RAID Scheme",
      "minForCpu": "Min for CPU",
      "minForRam": "Min for RAM"
    },
    "aggregate": {
      "title": "Total Procurement Summary",
      "totalHosts": "Total Host Count",
      "totalVms": "Total VMs",
      "totalRawStorage": "Combined Raw Storage",
      "totalEffectiveStorage": "Combined Effective Storage",
      "procurementNote": "This is the procurement host count"
    }
  }
}
```

Existing keys under `results.hostCount.*`, `results.charts.*` remain — only add, do not remove.

---

## Standard Stack

No new library dependencies are required for this phase. All tools are already in the project.

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Vue 3 | 3.x | `v-for`, `defineProps`, `storeToRefs` | In use |
| Pinia | 2.x | `useCalculationStore().domainResults` | In use |
| vue-i18n | 9.x | `t()` for new result keys | In use |
| Tailwind CSS | 4.x | Card styling, conditional color classes | In use |

---

## Environment Availability

Step 2.6: SKIPPED — this phase is a pure code/component refactor with no external tool dependencies.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RES-01 | Per-domain result card displays correct computed values | unit | `npx vitest run src/composables/useMarkdownExport.test.ts` | ✅ (needs update) |
| RES-02 | Aggregate totals card shows correct sum | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ✅ (needs update) |
| RES-03 | Management results unchanged | manual | Visual inspection in browser | — |

Note: `ResultsPanel.vue` and new card components are Vue components — they run in a DOM environment and are NOT covered by the node-env Vitest setup per CLAUDE.md. The test strategy for RES-01/RES-02 is: fix export composable tests (which exercise the data-mapping helpers that produce the same values the cards display) and verify the build passes.

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run build && npm run test`
- **Phase gate:** `npm run build` passes green + 164+ tests passing before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update `src/composables/useMarkdownExport.test.ts` mock setup to provide `workloadDomains[0]` shape
- [ ] Update `src/composables/usePptxExport.test.ts` mock setup to provide `domainResults[0]` shape

*(No new test files needed — existing test infrastructure covers composable logic. Component visual verification is manual.)*

---

## Open Questions

1. **Charts in Phase 13 scope**
   - What we know: REQUIREMENTS.md defers "per-domain Chart.js visualizations" to v3.1+
   - What's unclear: The existing charts are broken (reference removed store properties); keeping them requires a bridge; removing them reduces Phase 13 scope
   - Recommendation: Remove `CoresChart`, `RamChart`, `StorageChart` from `ResultsPanel` in Phase 13 (leave the files, just don't render them). Add a code comment pointing to v3.1 roadmap item. This unblocks the build without adding scope.

2. **HostCountCard fate**
   - What we know: `HostCountCard.vue` reads `calc.compute` (gone); the new `DomainResultCard` will show host count per domain
   - What's unclear: Whether to delete the file or keep it
   - Recommendation: Absorb its display into `DomainResultCard.vue` and delete `HostCountCard.vue`. Avoids dead-file confusion.

3. **Management host count in aggregate**
   - What we know: `AggregateTotals.totalRecommendedHosts` sums workload domain hosts only (per `calculationStore` implementation). `dedicatedMgmtHostCount` is separate.
   - What's unclear: Whether the aggregate card should add `dedicatedMgmtHostCount` to show a true grand total
   - Recommendation: Show `totalRecommendedHosts` as "Workload Hosts" and `dedicatedMgmtHostCount` (when not null) separately as "Management Hosts", with a "Grand Total" sum. This matches the success criterion ("sum of host counts across all workload domains plus management").

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/stores/calculationStore.ts` — confirmed `domainResults`, `aggregateTotals`, `management`, `dedicatedMgmtHostCount` are the only exported computed values
- Direct code inspection: `src/engine/types.ts` — confirmed full shape of `DomainResult` and `AggregateTotals`
- Direct code inspection: `src/stores/inputStore.ts` — confirmed flat store no longer has per-domain fields
- Build error output: `npm run build` — 28 confirmed TS errors in `usePptxExport.ts`, all are flat-API references
- Test output: `npm run test` — 58 failures (35 in `useMarkdownExport.test.ts`, 23 in `usePptxExport.test.ts`)

### Secondary (MEDIUM confidence)
- `REQUIREMENTS.md` — "Per-domain Chart.js visualizations" listed under Future Requirements (v3.1+)
- `STATE.md` — confirms "58 pre-existing test failures in useMarkdownExport and usePptxExport will be FIXED in Phase 13"

---

## Metadata

**Confidence breakdown:**
- Current component state: HIGH — direct code inspection, build errors confirm broken references
- DomainResult/AggregateTotals shape: HIGH — direct type inspection
- Architecture pattern (prop-driven cards): HIGH — consistent with existing Vue 3 + Pinia patterns in codebase
- Export composable bridge strategy: HIGH — direct mapping from removed flat fields to new array fields
- Chart removal decision: MEDIUM — based on REQUIREMENTS.md deferred note; planner may choose active-domain bridge instead

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable tech stack, low churn expected)
