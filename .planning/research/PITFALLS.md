# Pitfalls Research

**Domain:** VCF 9.x Client-Side Sizing Calculator SPA — v3.1 Wizard UI + Calculation Order Fix
**Researched:** 2026-03-30
**Confidence:** HIGH for pitfalls verified against codebase + Pinia/Vue 3 official docs; MEDIUM for pitfalls backed by community sources and code inspection; LOW where explicitly flagged

---

## Scope: v3.1 Sizing Correctness & Guided Workflow

This document is specific to the v3.1 milestone additions on top of the v3.0 multi-domain codebase (Phase 14 complete). The previous PITFALLS.md covered v3.0 array-state concerns. This document covers five new risk areas:

1. **Wizard state management** — wizard step leaking into URL state or causing hydration bugs
2. **Engine calculation order refactor** — breaking the existing 236 tests while fixing management-first order
3. **Colocated overhead double-counting** — management vCPU/RAM added to WLD-1 AND still counted in dedicated aggregate
4. **Pinia computed() dependency ordering** — management results must be available before WLD-1 computation runs
5. **Export composable staleness** — Markdown/PPTX using pre-refactor calculation values after engine fix

The codebase already has strict contracts established:

- CALC-01: engine files (`src/engine/*.ts`) have zero Vue imports
- CALC-02: `calculationStore.ts` uses only `computed()`, zero `ref()`
- URL-04: `activeDomainIndex` is excluded from URL state (ephemeral)
- Atomic Zod triple-sync: schema + hydrate + serialize must change together

---

## Critical Pitfalls

### Pitfall W1: Wizard Step Persisted to URL State

**What goes wrong:**
A `currentStep` ref (or `wizardStep` signal) is added to `inputStore` to track which of the 3 wizard steps is active. The developer adds it to `InputStateSchema` in `useUrlState.ts` to make the app open on the same step. When a user shares a URL, recipients land mid-wizard (e.g. step 2: Management) with no topology context, and the back-navigation logic produces confusing "incomplete" state. Worse, a bookmarked URL for step 3 causes hydration to skip step 1 validation, allowing domains with no topology decision to be calculated.

**Why it happens:**
The `activeDomainIndex` exclusion pattern (URL-04) is documented in `useUrlState.ts` but the comment is specific to tab index. A developer adding wizard step tracking reuses the same `inputStore` pattern and instinctively includes it in the schema, not recognizing wizard step as equally ephemeral.

**Consequences:**

- URLs shared from step 2 or 3 produce broken entry-point UX
- Hydration skips wizard validation gates, allowing malformed state
- `generateShareUrl()` grows and persists UI-layer state that should be discarded
- Zod schema drift: wizard step requires a default but the default (step 1) is meaningless without running the wizard

**How to avoid:**

- Store wizard step in a separate store (`uiStore.ts`) or as a local `ref()` in the wizard component, never in `inputStore`
- Do NOT add `currentWizardStep` (or any wizard-phase field) to `InputStateSchema`, `WorkloadDomainSchema`, or `ManagementDomainSchema`
- Add an explicit comment in `useUrlState.ts` next to the `activeDomainIndex` exclusion: "wizard step is likewise ephemeral — never serialize"
- Write a Vitest test: `generateShareUrl()` output must not contain a `wizardStep` key after decompression

**Warning signs:**

- `InputStateSchema` gains a `currentStep`, `wizardPhase`, or `activeStep` field
- `generateShareUrl()` reads from `uiStore` or any UI-only ref
- URL compressed string length increases unexpectedly on basic configurations

**Phase to address:** Phase 1 of v3.1 (wizard scaffold) — establish the step-is-ephemeral rule before any state wiring.

---

### Pitfall W2: Wizard Step in inputStore Violates CALC-02 via Accidental `ref()` Creep

**What goes wrong:**
`inputStore` already contains `activeDomainIndex = ref(0)` as an ephemeral UI ref. A developer adds `currentWizardStep = ref(1)` to the same store for convenience. Nothing breaks immediately because `inputStore` is allowed `ref()`. But a later refactor moves wizard step into `calculationStore` (to conditionally show results only at step 3), violating CALC-02 (calculationStore must be zero `ref()`).

**Why it happens:**
`calculationStore` is the natural place to put "are results ready to display" logic, which is tempting to tie to wizard step. The developer forgets that CALC-02 prohibits `ref()` in that store entirely.

**Consequences:**

- `calculationStore` gains mutable state — invalidates the CALC-02 invariant
- `vue-tsc` will not catch this; it is a semantic constraint, not a type error
- Future contributors import wizard-gating logic from `calculationStore` thinking it is a computed value, but it is actually mutable

**How to avoid:**

- Wizard step lives in `uiStore.ts` exclusively
- Any "should results be visible" derived state is a `computed()` in `uiStore` that reads `uiStore.currentWizardStep >= 3`
- `calculationStore` has zero knowledge of wizard state; results are always computed regardless of wizard step
- Add a lint comment to `calculationStore.ts`: `// CALC-02: zero ref() — see constraints. Any new ref must go to inputStore or uiStore.`

**Warning signs:**

- `import { useUiStore }` appears inside `calculationStore.ts`
- A `ref()` call appears in `calculationStore`'s setup function body

**Phase to address:** Phase 1 of v3.1 (wizard scaffold) — define the uiStore boundary before any wizard state is created.

---

### Pitfall W3: Hydration Runs Before Wizard Is Mounted, Then Wizard Resets State

**What goes wrong:**
`hydrateFromUrl()` in `main.ts` runs before `app.mount()` and correctly populates `inputStore`. The new wizard component mounts at step 1 (Topology) and its `onMounted` hook calls `resetToDefaults()` to initialize a "clean" wizard state — overwriting the hydrated `managementDomain` and `workloadDomains` with factory defaults.

**Why it happens:**
Wizard frameworks conventionally initialize their own state on mount. The developer adds initialization logic to the wizard's `onMounted` without checking whether URL hydration already populated the store. The pattern is the same as a form component that "resets to defaults" on mount.

**Consequences:**

- Any shared URL silently loses its state the moment the wizard component mounts
- No error, no warning — the URL is valid but the store is reset over the top of it
- `hydrateFromUrl()` returns void and has no "was hydrated" signal for the wizard to check

**How to avoid:**

- The wizard must never call any `inputStore` reset on mount
- Wizard step initialization must be purely UI — set `uiStore.currentWizardStep = 1` but do not touch `inputStore` state
- If the URL contains valid state, the wizard should advance directly to step 3 (review/results), skipping the guided flow — add a `isHydratedFromUrl` computed to `uiStore` that returns `true` if a `?c=` param was present at startup
- Write a test: `hydrateFromUrl()` → mount wizard component → `inputStore.workloadDomains.length` must equal the hydrated count

**Warning signs:**

- `inputStore.workloadDomains = [createDefaultWorkloadDomain(0)]` appears in any Vue component lifecycle hook
- Wizard `onMounted` or `setup()` calls `store.$reset()` or any factory-default assignment

**Phase to address:** Phase 1 of v3.1 (wizard scaffold) — define the hydration-first initialization contract before the wizard component is implemented.

---

### Pitfall C1: Engine Refactor Changes `calcCompute()` Signature, Breaking All 236 Tests at Once

**What goes wrong:**
The colocated overhead fix requires `calcCompute()` to optionally receive a new flag such as `isColocated: boolean` and conditionally include management overhead. If the developer adds a required parameter instead of an optional one, all existing callers (tests + `calculationStore`) fail to compile. With 236 tests, this can appear as a catastrophic failure that makes the refactor seem broken even when the new logic is correct.

**Why it happens:**
TypeScript interfaces enforce required vs optional properties strictly. `ComputeInputs` (defined in `src/engine/types.ts`) is the interface passed to `calcCompute()`. Adding a required field without a default breaks every spread-pattern call in tests such as `calcCompute({ ...baseInputs, managementCores: 50 })`.

**Consequences:**

- `vue-tsc` fails on every engine test file simultaneously
- The entire test suite goes red before any new logic is validated
- Developer may abandon the refactor or over-patch tests before the logic is correct

**How to avoid:**

- Add any new fields to `ComputeInputs` as optional with `?` and default inside `calcCompute` via destructuring defaults: `const { isColocated = false } = inputs`
- This is the established pattern in the codebase — `nvmeTieringEnabled`, `activeMemoryPct`, `gpuVmCount`, `vgpuMemoryGB` are all optional with defaults in `ComputeInputs`
- Write the new test cases for colocated behavior FIRST (TDD wave 0), confirm they fail for the right reason, THEN add the optional field
- Run `npx vitest run src/engine/compute.test.ts` after each change — not the full suite — to isolate regression from new behavior

**Warning signs:**

- A new field in `ComputeInputs` lacks `?`
- `vue-tsc` reports 50+ errors simultaneously after a single interface change
- `calculationStore.ts` shows TypeScript errors on the `calcCompute({...})` call

**Phase to address:** Phase 2 of v3.1 (engine calculation order fix) — enforce optional-with-default pattern before touching the interface.

---

### Pitfall C2: Colocated Mode Double-Counting Management Overhead

**What goes wrong:**
In colocated mode (`managementArchitecture === 'shared'`), management VMs run inside WLD-1. The engine fix adds `managementCores` and `managementRamGB` to the WLD-1 `calcCompute()` call (already done via `management.value.totalCores`). Then, `aggregateTotals` also adds `dedicatedMgmtHostCount` to `totalRecommendedHosts` — but `dedicatedMgmtHostCount` is only non-null when `managementArchitecture === 'dedicated'`. The bug occurs if that guard is removed or if a new "management host count" field is added to `AggregateTotals` without checking the architecture flag first.

**Current state (from code inspection):** `dedicatedMgmtHostCount` in `calculationStore.ts` already returns `null` when not dedicated. `aggregateTotals.totalRecommendedHosts` sums only `domainResults` (workload domains). This is correct for the current code. The risk is in the v3.1 refactor where a developer adds an explicit `managementHostCount` to `AggregateTotals` for the results display and forgets to conditionally add it only for dedicated mode.

**Why it happens:**
The management overhead for colocated mode is already embedded in WLD-1's `recommendedHostCount` via `managementCores`/`managementRamGB` passed to `calcCompute`. Adding a separate `managementHostCount` field to `AggregateTotals` and summing it unconditionally counts that overhead twice: once through WLD-1's larger host count, once as an additional explicit management host count.

**Consequences:**

- The aggregate host count is inflated (e.g. shows 12 total hosts when correct answer is 8)
- The PPTX and Markdown exports reproduce the inflated number
- Procurement decisions based on the export are incorrect
- No test catches this unless there is an explicit test for colocated aggregate totals

**How to avoid:**

- The correct formula is:
  - Dedicated: `totalRecommendedHosts = sum(domainResults.recommendedHostCount) + dedicatedMgmtHostCount`
  - Colocated: `totalRecommendedHosts = sum(domainResults.recommendedHostCount)` (management overhead already in WLD-1)
- Add a Vitest test that sets `managementArchitecture = 'shared'`, runs the full store, and asserts `aggregateTotals.totalRecommendedHosts === domainResults[0].compute.recommendedHostCount` (no extra hosts added)
- Add a second Vitest test for `managementArchitecture = 'dedicated'` that asserts the dedicated host count is summed in
- Document the formula in `calculationStore.ts` as a comment on `aggregateTotals`

**Warning signs:**

- `AggregateTotals` interface gains a `managementHostCount` field without a guard comment
- `aggregateTotals` computed adds any management-related count without checking `input.managementArchitecture`
- The colocated test configuration shows a host count higher than the workload-only calculation

**Phase to address:** Phase 2 of v3.1 (engine calculation order fix) — write the colocated aggregate test as a failing test before the engine change.

---

### Pitfall C3: Management `deploymentMode` Diverges from WLD-1 `deploymentMode` After Wizard Step 1

**What goes wrong:**
In the current system, the management domain has its own `deploymentMode` in `ManagementDomainConfig`, independent of workload domains. The wizard's Step 1 (Topology selection) sets a global topology (simple/HA/stretch). If Step 1 writes `managementDomain.deploymentMode` but not each `workloadDomain.deploymentMode`, or vice versa, the two can diverge. A user selecting "HA" in Step 1 gets HA management overhead (118 cores) but Simple workload sizing — the recommended host count is wrong in both directions.

**Why it happens:**
`ManagementDomainConfig` and `WorkloadDomainConfig` both have a `deploymentMode` field. They are independent by design (DOM-03). The wizard introduces a single "topology choice" that is expected to affect both, but the wiring must explicitly copy the selected mode to all domains.

**Consequences:**

- Management overhead calculated at HA level (118 cores) but workload hosts sized for Simple — cluster is under-provisioned
- Or: workload domains at stretch but management at simple — wrong management stack size, wrong stretch multiplier
- A shared URL from a post-wizard state is internally consistent, but a URL built by manually editing inputs may not be

**How to avoid:**

- Step 1 of the wizard writes `deploymentMode` to BOTH `managementDomain.deploymentMode` AND every `workloadDomain.deploymentMode` via `inputStore.updateManagementDomain({ deploymentMode })` + `inputStore.workloadDomains.forEach(d => store.updateDomain(d.id, { deploymentMode }))`
- Or: introduce a single `globalDeploymentMode` ref in `inputStore` that both management and workload domains read from (simpler for wizard, but a larger refactor)
- Write a validation function in the engine or store that warns when `managementDomain.deploymentMode !== workloadDomains[0].deploymentMode` (unless the design explicitly allows mixed topologies)

**Warning signs:**

- Wizard Step 1 only calls `updateManagementDomain()` but not `updateDomain()` for workload domains
- `calcManagement()` and `calcCompute()` are called with different `deploymentMode` values in the same render cycle

**Phase to address:** Phase 1 of v3.1 (wizard scaffold) — define the topology-write contract before Step 1 is wired up.

---

### Pitfall P1: Pinia `computed()` Evaluation Order Is Not Guaranteed Across Stores

**What goes wrong:**
`calculationStore` reads `management.value.totalCores` (a computed) to pass into `calcCompute()` for each workload domain. If a developer restructures the store to call `calcManagement()` inline inside `domainResults.computed()` (to avoid cross-store dependency), and that inline call uses `inputStore.managementDomain.deploymentMode`, the result is correct. However, if the developer instead reads `useCalculationStore().management` from inside another computed in a third store or component, they may inadvertently trigger a nested computed evaluation before management's dependencies are fully resolved.

**Why it happens:**
Vue 3's reactivity system evaluates `computed()` lazily — they run when accessed, not in declaration order. When `management` is declared before `domainResults` in `calculationStore`'s setup function, accessing `management.value` inside `domainResults`' getter is safe because Vue tracks the dependency and re-evaluates in topological order. The risk is only when a developer moves `management` after `domainResults` in the file, or calls `useCalculationStore()` in a new store that also calls `useCalculationStore()` (circular dependency).

**Current state (from code inspection):** `calculationStore.ts` already declares `const management = computed(...)` before `const domainResults = computed(...)`. This ordering is safe. Do not change it.

**Consequences:**

- `management.value` could return a stale result the first time `domainResults` is evaluated if the dependency graph is broken
- No runtime error; results appear correct on subsequent reactive updates but wrong on initial render
- Hard to reproduce in tests because Vitest evaluates synchronously

**How to avoid:**

- Preserve the declaration order in `calculationStore.ts`: `management` → `dedicatedMgmtHostCount` → `domainResults` → `aggregateTotals`
- Never re-order these computed declarations. Add a comment: `// ORDER MATTERS: management must be declared before domainResults (dependency graph)`
- Do not add a new store that calls `useCalculationStore()` inside its own setup — this creates a cross-store computed chain that Vue may not resolve correctly in all hydration paths
- If a new store needs management results, have it read from `inputStore.managementDomain.deploymentMode` and call `calcManagement()` directly (pure function, safe to call from anywhere)

**Warning signs:**

- `const domainResults = computed(...)` appears before `const management = computed(...)` in `calculationStore.ts`
- A new store file contains `import { useCalculationStore }` in its setup function body
- Initial page load shows different results than after the first user interaction

**Phase to address:** Phase 2 of v3.1 (engine calculation order fix) — add an ordering comment before touching `calculationStore`.

---

### Pitfall P2: Adding `managementCores` / `managementRamGB` to Colocated WLD-1 When They Are Already Passed

**What goes wrong:**
Looking at `calculationStore.ts` lines 57-58, `calcCompute` is already called with `managementCores: management.value.totalCores` and `managementRamGB: management.value.totalRamGB` for every domain in the `domainResults` computed. The intent for dedicated mode is that only WLD-1 carries management overhead. The v3.1 fix must ensure management overhead is applied ONLY to WLD-1 when colocated, and NOT applied to any domain when dedicated (because dedicated management runs on separate hosts).

The double-application bug: if the developer misreads the current code and thinks management overhead is missing from the calculation (it is already there for every domain), they add it again — now management overhead is counted twice in WLD-1.

**Why it happens:**
The current code passes `management.value.totalCores` to ALL domains unconditionally. This is technically wrong for dedicated mode (management has its own hosts) and partially wrong for colocated (only WLD-1 should carry it). The v3.1 fix needs to CHANGE the logic, not ADD more overhead.

**Correct target logic:**

- Colocated (`shared`): WLD-1 receives `managementCores: management.value.totalCores`, all other WLD-N receive `managementCores: 0`
- Dedicated: all WLD-N receive `managementCores: 0` (management has its own hosts)

**Consequences:**

- Every workload domain beyond WLD-1 is oversized in colocated mode
- In dedicated mode, all workload domains are currently oversized (they carry management overhead that belongs to separate management hosts)
- The test suite for dedicated mode will fail if it checks that WLD-2 does NOT include management overhead

**How to avoid:**

- Before writing any new code, write tests that encode the expected behavior:
  - Test: colocated, WLD-1 `totalCoresRequired` includes management overhead
  - Test: colocated, WLD-2 (if present) `totalCoresRequired` does NOT include management overhead
  - Test: dedicated, WLD-1 `totalCoresRequired` does NOT include management overhead (separate hosts handle it)
- In `domainResults` computed, the management cores passed to each domain should be:

  ```typescript
  const mgmtCores = (input.managementArchitecture === 'shared' && isFirstDomain)
    ? management.value.totalCores : 0
  ```

- The `isFirstDomain` check must use domain index (position 0 in `input.workloadDomains`), not domain ID

**Warning signs:**

- All domains in `domainResults.map()` receive the same non-zero `managementCores`
- WLD-2 result card shows "Management overhead included" in the results display
- The aggregate host count grows linearly with domain count even when management is dedicated

**Phase to address:** Phase 2 of v3.1 (engine calculation order fix) — this is the core fix, must be test-driven.

---

### Pitfall E1: Export Composables Read `calc.management` After Refactor Returns New Field Names

**What goes wrong:**
`useMarkdownExport.ts` and `usePptxExport.ts` read directly from `useCalculationStore()` — specifically `calc.management.totalCores`, `calc.management.totalRamGB`, `calc.dedicatedMgmtHostCount`, and per-domain `result.compute.*` fields. If the v3.1 refactor adds new fields to `MgmtDomainResult` or `ComputeResult` (e.g. a `managementIncluded: boolean` flag, or a new `managementHostCount` on `AggregateTotals`), the exports must be updated simultaneously or they silently omit the new data.

**Why it happens:**
The export composables are plain TypeScript modules (no reactive bindings) that take a snapshot of store state at call time. They are not tested for "completeness" — the tests verify that known fields appear in the output, not that all new fields from the engine are included. A field added to `AggregateTotals` in Phase 2 will not automatically appear in the Markdown report until `useMarkdownExport.ts` is updated.

**Consequences:**

- Markdown and PPTX exports continue to show pre-refactor numbers (e.g. management overhead in every domain instead of only WLD-1)
- The UI results panel (which reads from the store reactively) shows correct numbers, but exports show different numbers — discrepancy erodes user trust
- No TypeScript error if the export reads `result.compute.totalCoresRequired` directly — the field exists but its value is now computed differently

**How to avoid:**

- Treat export composable updates as mandatory in the same phase as the engine/store refactor, not deferred
- After the engine refactor, run the full export test suite and verify numbers: `npx vitest run src/composables/`
- Add a test that explicitly checks the exported management overhead section reflects the post-refactor values (management section appears once, outside the per-domain loop)
- If `AggregateTotals` gains a new `managementHostCount` field, add it to `useMarkdownExport.ts` `## Aggregate Totals` section in the same commit

**Warning signs:**

- A new field is added to `AggregateTotals` or `DomainResult` but `useMarkdownExport.ts` and `usePptxExport.ts` are not modified in the same PR/commit
- The Markdown export test for aggregate totals passes but the computed value of `totalRecommendedHosts` has changed
- "Recommended hosts" in the Markdown output does not match the `AggregateTotalsCard` UI

**Phase to address:** Phase 2 of v3.1 (engine refactor) and Phase 3 (export accuracy) — export updates must be co-committed with store changes.

---

### Pitfall E2: Export Composables Capture Stale Computed Values If Called Before Vue Flushes

**What goes wrong:**
`useMarkdownExport.generateMarkdownReport()` is called synchronously in an `@click` handler in `ExportToolbar.vue`. It calls `useCalculationStore()` which reads `computed()` values. If the click handler is triggered immediately after a store mutation (e.g. the user changes a slider and immediately clicks export), Vue 3's computed values may not yet have been re-evaluated in the same synchronous tick.

**Why it happens:**
Vue 3 batches reactive updates and flushes them asynchronously (via microtask queue). A `computed()` is lazy — it is re-evaluated the next time it is accessed after its dependencies change. In a synchronous export triggered by a button click, the computed values ARE re-evaluated at the time they are read because the click handler runs after the previous microtask batch has flushed. However, if the export is triggered programmatically (e.g. in a wizard "finish" step that also mutates store state), the mutation and the export may happen in the same synchronous call chain before Vue flushes.

**Current risk for v3.1:** The wizard "Finish" button in Step 3 may both mark the wizard as complete AND trigger an auto-export or display a result summary — if the same event handler mutates state and reads export data, there is a risk of stale reads.

**Consequences:**

- Exported report shows results from before the last input change
- The discrepancy is subtle (one slider position off) and may not be caught in manual testing

**How to avoid:**

- Never mutate store state and call `generateMarkdownReport()` / `generatePptxReport()` in the same synchronous function body
- If the wizard finish step needs to both finalize state AND show results, use `await nextTick()` between the state write and the export call
- In tests: after any store mutation that should affect export output, call `await nextTick()` before asserting export string content

**Warning signs:**

- A wizard "onFinish" or "onComplete" handler both calls `store.updateDomain(...)` and `generateMarkdownReport()` without `await nextTick()`
- Export tests intermittently fail on CI but pass locally

**Phase to address:** Phase 3 of v3.1 (export accuracy) — add `nextTick()` guard as a pattern in the wizard completion handler from the start.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store wizard step in `inputStore` instead of `uiStore` | One fewer store to create | Wizard step bleeds into serialization surface; Zod schema grows | Never — uiStore is the correct home |
| Pass management overhead to all domains equally | Simpler `domainResults.map()` | Dedicated mode oversizes every workload domain; colocated mode oversizes WLD-2+ | Never for v3.1+ |
| Skip writing colocated-vs-dedicated aggregate tests | Faster Phase 2 | Double-counting bug survives undetected until a customer report | Never — test must precede implementation |
| Update export composables after engine refactor in a follow-up PR | Smaller Phase 2 diff | Exports show wrong numbers for potentially days/sprints | Acceptable only if exports are blocked by a feature flag |
| Use a required parameter in `ComputeInputs` for new colocated flag | Simpler function signature | All 236 existing tests break at compile time | Never — use optional with default |
| Share one `deploymentMode` field via wizard write to all domains at once | Simple UX, single source | Domains diverge if user manually changes one domain's mode post-wizard | Acceptable if the UI prevents per-domain mode changes after wizard completes |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Wizard step ↔ URL state | Serializing `currentWizardStep` in `generateShareUrl()` | Keep wizard step in `uiStore` only; never pass to `generateShareUrl()` |
| Wizard step ↔ `hydrateFromUrl()` | Wizard `onMounted` resets `inputStore` after `hydrateFromUrl()` ran | Wizard initializes only `uiStore.currentWizardStep`; never touches `inputStore` on mount |
| Management `deploymentMode` ↔ WLD-1 `deploymentMode` | Wizard Step 1 writes only to `managementDomain` | Step 1 writes to BOTH `managementDomain` and all `workloadDomains` |
| `calcCompute()` ↔ colocated overhead | Adding new management overhead on top of existing `managementCores` pass-through | Replace existing unconditional pass with conditional: `isFirstDomain && colocated ? management.value.totalCores : 0` |
| `aggregateTotals` ↔ dedicated host count | Adding `dedicatedMgmtHostCount` to the sum unconditionally | Guard with `input.managementArchitecture === 'dedicated'` before adding |
| Export composable ↔ engine refactor | Exporting before updating the composables to use new field names | Update export composables in the same commit as engine type changes |
| Vue `nextTick()` ↔ wizard finish handler | Mutating store and calling export synchronously | Use `await nextTick()` between final state write and any export or snapshot call |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `domainResults` computed re-evaluates for every wizard step transition | Jank on step navigation if many domains | Wizard transitions must not mutate `inputStore` state gratuitously | Noticeable at 5+ domains with complex storage configs |
| Wizard component mounts all 3 step panels simultaneously (v-if vs v-show) | All 3 steps render on load, increasing DOM nodes and initial parse time | Use `v-if` not `v-show` for wizard steps — unmount inactive steps | Not a real concern at current form complexity, but good practice |
| Management `computed()` called on every domain in `domainResults.map()` via `management.value` | Redundant re-reads if management inputs are stable | `management` is a single `computed()` in `calculationStore` — Vue caches it; reads are O(1) after first evaluation | Not a real concern — Vue's computed caching prevents this |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Wizard "Back" button discards inputs entered in the current step | Users lose management domain specs when navigating back from Step 2 to Step 1 | Wizard back navigation must preserve store state; only topology change on Step 1 reconfirm should prompt "this will reset management inputs" |
| Wizard step indicator shows step 3 as active before step 1 is complete | User confusion about workflow | Step 3 tab/button is disabled or visually locked until Step 2 is complete |
| Wizard "Finish" reveals results panel but export buttons are visible from Step 1 | Users may export before entering data | Export toolbar appears only at Step 3 or is disabled with tooltip "complete all steps first" |
| Colocated mode shows no dedicated management host count but users expect to see it | Architects may assume management hosts are not counted | Results panel for colocated mode shows "Management overhead included in WLD-1 host count: X hosts" — makes the implicit explicit |
| Step 1 topology change after Step 2 management config is entered | User silently loses HA management sizing when switching to Simple | Step 1 topology change after Step 2 completion must show a confirmation dialog warning that management specs will be recalculated |

---

## "Looks Done But Isn't" Checklist

- [ ] **Wizard step exclusion from URL:** `generateShareUrl()` output does not contain `wizardStep`, `currentStep`, or any wizard-phase key — verify by decompressing the output and parsing the JSON
- [ ] **Colocated aggregate correctness:** `aggregateTotals.totalRecommendedHosts` for a colocated single-domain config equals `domainResults[0].compute.recommendedHostCount` (no separate management host count added)
- [ ] **Dedicated aggregate correctness:** `aggregateTotals.totalRecommendedHosts` for dedicated mode equals `domainResults[0].compute.recommendedHostCount + dedicatedMgmtHostCount`
- [ ] **WLD-2 management exclusion:** In colocated multi-domain config, `domainResults[1].compute.totalCoresRequired` does NOT include management cores
- [ ] **Dedicated WLD-1 management exclusion:** In dedicated mode, `domainResults[0].compute.totalCoresRequired` does NOT include management cores
- [ ] **Export parity:** `generateMarkdownReport()` aggregate totals section shows the same host count as `AggregateTotalsCard` UI component
- [ ] **All 236 tests pass:** `npm run test` passes after engine refactor with zero regressions
- [ ] **vue-tsc clean:** `npm run type-check` passes after any `ComputeInputs` or `AggregateTotals` interface change
- [ ] **URL round-trip with wizard present:** A URL generated post-wizard hydrates correctly and the wizard shows Step 3 (or directly shows results) rather than Step 1
- [ ] **Management `deploymentMode` sync:** After wizard Step 1, `inputStore.managementDomain.deploymentMode === inputStore.workloadDomains[0].deploymentMode`

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wizard step accidentally serialized to URL | LOW | Remove field from `InputStateSchema`; the `.strip()` directive discards unknown keys from old URLs automatically — no migration needed |
| Engine refactor breaks 50+ tests simultaneously | MEDIUM | Revert `ComputeInputs` interface change; make the new field optional; rerun tests; proceed with optional field + default |
| Colocated double-counting discovered post-release | HIGH | Requires corrected engine + new export composable + user communication that previous exports were inflated; fix is straightforward (one `if` guard) but trust damage is real |
| Wizard `onMounted` reset overwrites hydration | MEDIUM | Remove the reset; replace with a check `if (!isHydratedFromUrl) { /* initialize defaults */ }` |
| Export composables show pre-refactor numbers | LOW | Update both `useMarkdownExport.ts` and `usePptxExport.ts` to read the new field; covered by existing export test suite |
| `management.value` stale on initial render | LOW | Ensure `management` computed is declared before `domainResults` in `calculationStore.ts`; Vue's topological evaluation handles the rest |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| W1: Wizard step in URL state | Phase 1 (wizard scaffold) | `generateShareUrl()` unit test: decompressed output has no wizardStep key |
| W2: Wizard step in calculationStore | Phase 1 (wizard scaffold) | Code review gate: `calculationStore.ts` has zero `ref()` calls |
| W3: Wizard onMounted resets hydrated state | Phase 1 (wizard scaffold) | Integration test: `hydrateFromUrl()` → mount wizard → store state unchanged |
| C1: Required parameter breaks 236 tests | Phase 2 (engine refactor) | `npm run test` must pass before any new logic is added |
| C2: Colocated double-counting aggregate | Phase 2 (engine refactor) | Vitest: colocated single-domain `totalRecommendedHosts === domainResults[0].compute.recommendedHostCount` |
| C3: Management/WLD deploymentMode divergence | Phase 1 (wizard scaffold) | Vitest: after Step 1 write, both deploymentModes equal the selected topology |
| P1: Computed declaration order | Phase 2 (engine refactor) | Code review: order preserved; comment added to `calculationStore.ts` |
| P2: Management overhead applied to all domains | Phase 2 (engine refactor) | Vitest: WLD-2 `totalCoresRequired` equals workload-only value with `managementCores: 0` |
| E1: Export composables use pre-refactor field values | Phase 2+3 (export accuracy) | Export test: markdown aggregate hosts == store `aggregateTotals.totalRecommendedHosts` |
| E2: Stale computed snapshot on wizard finish | Phase 3 (export accuracy) | Test: state mutation + `await nextTick()` + export call produces current values |

---

## Sources

- Vue 3 Composition API reactivity — <https://vuejs.org/guide/essentials/reactivity-fundamentals.html> (official, HIGH confidence)
- Pinia setup store patterns — <https://pinia.vuejs.org/core-concepts/#setup-stores> (official, HIGH confidence)
- Vue 3 `nextTick()` behavior — <https://vuejs.org/api/general.html#nexttick> (official, HIGH confidence)
- Codebase inspection: `src/stores/calculationStore.ts` — computed ordering, management pass-through, aggregateTotals reducer (direct, HIGH confidence)
- Codebase inspection: `src/composables/useUrlState.ts` — URL-04 exclusion pattern, `activeDomainIndex` not serialized (direct, HIGH confidence)
- Codebase inspection: `src/engine/types.ts` — `ComputeInputs` optional fields pattern (direct, HIGH confidence)
- Codebase inspection: `src/engine/compute.ts` — existing optional-with-default destructuring for `nvmeTieringEnabled`, `gpuVmCount` (direct, HIGH confidence)
- Codebase inspection: `src/composables/useMarkdownExport.ts` — direct store reads, per-domain loop, no reactive bindings (direct, HIGH confidence)
- `.planning/PROJECT.md` — v3.1 milestone scope, CALC-01/02 constraints, URL-04 exclusion documented (direct, HIGH confidence)

---
*Pitfalls research for: VCF 9.x Sizing SPA — v3.1 Wizard UI + Calculation Order Fix*
*Researched: 2026-03-30*
