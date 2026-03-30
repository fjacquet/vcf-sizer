# Architecture Research — v3.1 Sizing Correctness & Guided Wizard

**Domain:** VCF 9.x Sizing Calculator SPA — Wizard Stepper + Management-First Calculation
**Researched:** 2026-03-30
**Confidence:** HIGH (grounded in direct codebase inspection of all engine, store, and component files)
**Replaces:** v3.0 multi-domain architecture (2026-03-30)

---

## Context: What This Document Covers

This is the v3.1 milestone architecture document. It answers five specific questions for the roadmapper:

1. How wizard step state should be managed in Pinia without violating CALC-02
2. How the engine calculation order changes for the colocated case
3. What `calculationStore.ts` changes are needed while keeping CALC-02 (zero ref())
4. How aggregate totals are restructured for dedicated vs colocated architectures
5. What the integration points are with `useMarkdownExport` and `usePptxExport`

---

## Established Constraints (Non-Negotiable)

| Constraint | Rule | Location |
|------------|------|----------|
| CALC-01 | Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library | CLAUDE.md |
| CALC-02 | `calculationStore.ts` must contain ZERO `ref()` — only `computed()` | CLAUDE.md |
| URL-SYNC | Zod schema + hydrate + serialize must remain atomically consistent | useUrlState.ts pattern |
| I18N | Validation warning `messageKey` must be an i18n key, never a raw English string | engine/types.ts |

---

## Standard Architecture

### System Overview (Current v3.0 baseline)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Component Layer (Vue SFC)                       │
│                                                                      │
│  App.vue                                                             │
│    ├── input/DeploymentModelSelector.vue  (per-domain)               │
│    ├── input/HostSpecsForm.vue            (per-domain)               │
│    ├── input/WorkloadProfileForm.vue      (per-domain)               │
│    ├── input/StorageConfigForm.vue        (per-domain)               │
│    ├── input/ManagementDomainSection.vue  (global, mgmt-only)        │
│    ├── shared/DomainTabStrip.vue          (domain add/remove/rename) │
│    ├── shared/ManagementSummary.vue       (calc.management readout)  │
│    └── results/ResultsPanel.vue                                      │
│         ├── results/DomainResultCard.vue  (per-domain)               │
│         ├── results/AggregateTotalsCard.vue                          │
│         └── results/ExportToolbar.vue                                │
├─────────────────────────────────────────────────────────────────────┤
│                      Store Layer (Pinia)                             │
│                                                                      │
│  inputStore.ts       — all ref() mutable state                       │
│    ├── managementArchitecture: ref<'shared'|'dedicated'>             │
│    ├── managementDomain: ref<ManagementDomainConfig>                 │
│    ├── workloadDomains: ref<WorkloadDomainConfig[]>                  │
│    └── activeDomainIndex: ref<number>                                │
│                                                                      │
│  calculationStore.ts — zero ref(), only computed()                   │
│    ├── management: computed (calls calcManagement)                   │
│    ├── domainResults: computed<DomainResult[]>                       │
│    ├── aggregateTotals: computed<AggregateTotals>                    │
│    └── dedicatedMgmtHostCount: computed<number|null>                 │
│                                                                      │
│  uiStore.ts          — locale switching only                         │
├─────────────────────────────────────────────────────────────────────┤
│                      Engine Layer (Pure TypeScript)                  │
│                                                                      │
│  engine/management.ts  — calcManagement(mode): MgmtDomainResult     │
│  engine/compute.ts     — calcCompute(inputs): ComputeResult          │
│  engine/storage.ts     — calcStorage(inputs): StorageResult          │
│  engine/stretch.ts     — calcStretch(inputs): StretchResult          │
│  engine/vsanMax.ts     — calcVsanMax(inputs): VsanMaxResult          │
│  engine/validation.ts  — validateInputs(inputs): ValidationWarning[] │
│  engine/types.ts       — all shared TypeScript interfaces            │
│  engine/defaults.ts    — default factory functions                   │
└─────────────────────────────────────────────────────────────────────┘
```

### System Overview (Target v3.1 — changes highlighted)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Component Layer (Vue SFC)                       │
│                                                                      │
│  App.vue                      ← MODIFIED: render wizard or flat view │
│    └── WizardStepper.vue      ← NEW: 3-step container                │
│         ├── Step1Topology.vue ← NEW: topology + mgmt arch selection  │
│         ├── Step2Management.vue ← NEW: mgmt domain host specs + result│
│         └── Step3Workloads.vue  ← NEW: domain tabs + results + export │
│                                                                      │
│  (All existing input/* and results/* components are REUSED as-is     │
│   as inner components of the wizard steps — no changes needed)       │
│                                                                      │
│  NEW: components/shared/WizardStepper.vue                            │
│  NEW: components/wizard/Step1Topology.vue                            │
│  NEW: components/wizard/Step2Management.vue                          │
│  NEW: components/wizard/Step3Workloads.vue                           │
├─────────────────────────────────────────────────────────────────────┤
│                      Store Layer (Pinia)                             │
│                                                                      │
│  inputStore.ts       — UNCHANGED except colocated mgmt overhead flag │
│                                                                      │
│  calculationStore.ts — MODIFIED: management-first ordering           │
│    ├── management: computed (SAME — calcManagement first)            │
│    ├── mgmtHostCount: computed<number>  ← RENAMED/EXPANDED           │
│    │     dedicated: max(4, ceil(mgmt.totalCores / coresPerHost))     │
│    │     colocated: 0  (absorbed into WLD-1, not a separate count)   │
│    ├── domainResults: computed<DomainResult[]>                        │
│    │     WLD-1 (colocated): passes mgmt.totalCores/RAM as overhead   │
│    │     WLD-n (all): passes 0 overhead (mgmt already counted once)  │
│    ├── aggregateTotals: computed<AggregateTotals> ← MODIFIED         │
│    │     dedicated: mgmtHostCount + sum(domain.recommendedHostCount)  │
│    │     colocated: sum(domain.recommendedHostCount) [WLD-1 includes] │
│    └── dedicatedMgmtHostCount: computed<number|null>  ← KEPT as-is   │
│                                                                      │
│  uiStore.ts          — MODIFIED: add currentWizardStep: ref<1|2|3>   │
│       OR                                                             │
│  wizardStore.ts (NEW) — currentStep, canAdvance validators           │
├─────────────────────────────────────────────────────────────────────┤
│                      Engine Layer (Pure TypeScript)                  │
│                                                                      │
│  engine/compute.ts   — calcCompute()  ← SIGNATURE UNCHANGED          │
│       (CalcCompute already accepts managementCores/RAM as params;    │
│        colocated passes actual mgmt numbers, dedicated passes 0)     │
│  All other engine files: UNCHANGED                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Recommended Project Structure

```
src/
├── engine/                   # Pure TypeScript — ZERO Vue imports (CALC-01)
│   ├── types.ts              # MODIFIED: add MgmtOverheadMode type
│   ├── compute.ts            # UNCHANGED: already accepts managementCores param
│   ├── management.ts         # UNCHANGED: calcManagement(mode) still correct
│   ├── storage.ts            # UNCHANGED
│   ├── stretch.ts            # UNCHANGED
│   ├── vsanMax.ts            # UNCHANGED
│   ├── validation.ts         # UNCHANGED
│   └── defaults.ts           # UNCHANGED
│
├── stores/
│   ├── inputStore.ts         # UNCHANGED (all state already properly structured)
│   ├── calculationStore.ts   # MODIFIED: management-first aggregation logic
│   ├── uiStore.ts            # MODIFIED: add currentWizardStep (preferred option)
│   └── [wizardStore.ts]      # ALTERNATIVE: new store for wizard step only
│
├── composables/
│   ├── useUrlState.ts        # UNCHANGED (wizard step intentionally not serialized)
│   ├── useMarkdownExport.ts  # MINOR: verify mgmt section appears before domain loop
│   └── usePptxExport.ts      # MINOR: verify mgmt slide appears before domain slides
│
├── components/
│   ├── input/                # ALL UNCHANGED — reused inside wizard steps
│   ├── results/              # ALL UNCHANGED — reused inside wizard steps
│   ├── shared/               # MINOR: WizardStepper.vue added here
│   │   ├── DomainTabStrip.vue         # UNCHANGED
│   │   ├── LanguageSwitcher.vue       # UNCHANGED
│   │   ├── ManagementSummary.vue      # UNCHANGED
│   │   ├── NumberSliderInput.vue      # UNCHANGED
│   │   ├── WarningBanner.vue          # UNCHANGED
│   │   └── WizardStepper.vue          # NEW: step indicator + nav buttons
│   └── wizard/                        # NEW directory
│       ├── Step1Topology.vue          # NEW: DeploymentModelSelector + mgmt arch
│       ├── Step2Management.vue        # NEW: ManagementDomainSection + ManagementSummary
│       └── Step3Workloads.vue         # NEW: DomainTabStrip + all input forms + ResultsPanel
│
└── App.vue                   # MODIFIED: renders WizardStepper instead of flat layout
```

---

## Architectural Patterns

### Pattern 1: Wizard Step as uiStore Extension (RECOMMENDED)

**What:** Add `currentWizardStep: ref<1 | 2 | 3>(1)` and a `setStep(n)` action to the existing `uiStore.ts` rather than creating a new store.

**When to use:** When wizard state is purely ephemeral UI state (not serialized, not driving calculations). This matches `activeDomainIndex` in `inputStore` — same philosophy of keeping transient UI state close to other UI state.

**Why not a new `wizardStore.ts`:** A separate store for a single `ref<number>` adds indirection without benefit. The `uiStore` already holds locale (another ephemeral UI state). Precedent is established.

**Why not `inputStore.ts`:** `inputStore` holds domain data that IS serialized to URL and used by the engine. Wizard step is neither — mixing concerns violates the "inputs = data" contract.

**Trade-offs:**
- PRO: No new file, no new store registration, minimal diff
- PRO: Consistent with existing `uiStore` philosophy (ephemeral UI state only)
- CON: `uiStore` grows slightly; if wizard logic becomes complex, extract later

**Example:**
```typescript
// uiStore.ts — add to existing store
const currentWizardStep = ref<1 | 2 | 3>(1)

function setStep(step: 1 | 2 | 3) {
  currentWizardStep.value = step
}

function nextStep() {
  if (currentWizardStep.value < 3) {
    currentWizardStep.value = (currentWizardStep.value + 1) as 1 | 2 | 3
  }
}

function prevStep() {
  if (currentWizardStep.value > 1) {
    currentWizardStep.value = (currentWizardStep.value - 1) as 1 | 2 | 3
  }
}

return { locale, setLocale, currentWizardStep, setStep, nextStep, prevStep }
```

### Pattern 2: Management-First Calculation Order in calculationStore

**What:** The `management` computed already runs first (it's declared first in the store body). The real problem is in `aggregateTotals` — it does not include dedicated management hosts in the total.

**Current bug:** `aggregateTotals.totalRecommendedHosts` sums only `domainResults` (workload hosts). Management hosts from `dedicatedMgmtHostCount` are never added. Colocated mode does not inject management overhead into WLD-1's compute calculation — it passes `management.value.totalCores` to ALL domains, which is incorrect.

**Analysis of current `calculationStore.ts`:**
```
// Line 57-58: passes management overhead to ALL workload domains
managementCores: management.value.totalCores,  // ← WRONG for dedicated mode
managementRamGB: management.value.totalRamGB,  // ← WRONG for dedicated mode
```

In dedicated mode, the management overhead runs on dedicated management hosts — it should NOT be counted as overhead in workload domain calcCompute calls. The current code double-counts management resources in dedicated mode.

In colocated (shared) mode, the management overhead should be counted only in WLD-1 (domain index 0), not in every workload domain.

**Correct Logic:**

```typescript
// In calculationStore.ts — management-first ordering fix
const domainResults = computed<DomainResult[]>(() =>
  input.workloadDomains.map((domain, index) => {
    // Colocated: management overhead only applies to first workload domain (WLD-1)
    // Dedicated: management overhead applies to NEITHER workload domain (runs on mgmt hosts)
    const isColocated = input.managementArchitecture === 'shared'
    const isFirstDomain = index === 0

    const mgmtCores = isColocated && isFirstDomain ? management.value.totalCores : 0
    const mgmtRamGB = isColocated && isFirstDomain ? management.value.totalRamGB : 0

    return {
      // ...
      compute: calcCompute({
        // ...
        managementCores: mgmtCores,   // correct: 0 for dedicated, 0 for WLD-n, actual for WLD-1
        managementRamGB: mgmtRamGB,
      }),
    }
  })
)
```

**Trade-offs:**
- PRO: Correct VCF 9.x sizing behavior
- PRO: calcCompute() signature unchanged — it already accepts managementCores as a parameter
- PRO: CALC-02 fully preserved — no ref() introduced
- CON: Domain result for WLD-1 will show higher host count than before (correct, not a regression)

### Pattern 3: Aggregate Totals Restructure

**What:** `aggregateTotals.totalRecommendedHosts` must include dedicated management hosts when `managementArchitecture === 'dedicated'`.

**Current bug:** The current aggregateTotals only sums workload domain hosts. In dedicated mode, management hosts from `dedicatedMgmtHostCount` are never counted.

**Correct Logic:**

```typescript
const aggregateTotals = computed<AggregateTotals>(() => {
  const workloadHostSum = domainResults.value.reduce(
    (sum, d) => sum + d.compute.recommendedHostCount, 0
  )
  const mgmtHostCount = input.managementArchitecture === 'dedicated'
    ? (dedicatedMgmtHostCount.value ?? 0)
    : 0  // colocated: mgmt absorbed into WLD-1, already counted in workloadHostSum

  return {
    totalRecommendedHosts: workloadHostSum + mgmtHostCount,
    totalVmCount: input.workloadDomains.reduce((sum, d) => sum + d.vmCount, 0),
    totalRawStorageTB: domainResults.value.reduce(
      (sum, d) => sum + d.storage.rawCapacityTB, 0
    ),
    totalEffectiveStorageTB: domainResults.value.reduce(
      (sum, d) => sum + d.storage.effectiveCapacityTB, 0
    ),
    allValidationErrors: domainResults.value.flatMap(d => d.validationErrors),
  }
})
```

**Trade-offs:**
- PRO: Correct procurement total regardless of architecture mode
- PRO: Zero new ref() — CALC-02 preserved
- PRO: No engine changes required — logic is correctly in the store
- CON: `AggregateTotals` interface may need a `mgmtHostCount` field added for export accuracy

### Pattern 4: WizardStepper Component Architecture

**What:** A container component that renders one of three step panels based on `uiStore.currentWizardStep`. The step panels are thin wrappers that compose existing input components.

**When to use:** When the steps are purely presentational reorganizations of existing inputs — not new data models.

**Step composition:**
```
Step1Topology.vue
  - DeploymentModelSelector (with managementArchitecture toggle)
  - No new components needed; DeploymentModelSelector already has this

Step2Management.vue
  - ManagementDomainSection (existing)
  - ManagementSummary (existing — shows computed mgmt result)
  - NEW: MgmtDomainResultCard (shows host count needed for dedicated mode)

Step3Workloads.vue
  - DomainTabStrip (existing)
  - Per-active-domain: DeploymentModelSelector, HostSpecsForm,
    WorkloadProfileForm, StorageConfigForm (all existing)
  - ResultsPanel (existing)
  - ExportToolbar (existing)
```

**Trade-offs:**
- PRO: No refactoring of existing input components — they are slotted into steps
- PRO: Step 3 is essentially the current App.vue left pane + right pane
- CON: App.vue grows conditional complexity (use v-if on step, not v-show, to avoid rendering all three steps at once)

---

## Data Flow

### Wizard Navigation Flow

```
User arrives
    ↓
App.vue renders WizardStepper
    ↓
uiStore.currentWizardStep === 1
    ↓
Step1Topology.vue renders:
  - DeploymentModelSelector bound to inputStore.managementArchitecture
  - inputStore.managementDomain.deploymentMode (topology for mgmt domain)
    ↓
User clicks "Next"
    ↓
uiStore.nextStep() → currentWizardStep === 2
    ↓
Step2Management.vue renders:
  - ManagementDomainSection (inputStore.managementDomain host specs)
  - ManagementSummary (calc.management — immediate computed result)
    ↓
User clicks "Next"
    ↓
uiStore.nextStep() → currentWizardStep === 3
    ↓
Step3Workloads.vue renders all workload domain forms + ResultsPanel
```

### Calculation Order (Fixed) Data Flow

```
inputStore.managementDomain.deploymentMode
    ↓
calculationStore.management (computed first)
    = calcManagement(mode): MgmtDomainResult {totalCores, totalRamGB}
    ↓
calculationStore.dedicatedMgmtHostCount (computed second)
    = null if shared, max(4, ceil(totalCores / coresPerHost)) if dedicated
    ↓
calculationStore.domainResults (computed third — uses management.value)
    WLD-1 (colocated only): calcCompute({managementCores: management.value.totalCores, ...})
    WLD-1 (dedicated):      calcCompute({managementCores: 0, ...})
    WLD-n (any):            calcCompute({managementCores: 0, ...})
    ↓
calculationStore.aggregateTotals (computed last — reduces domainResults)
    dedicated:  sum(domain.recommendedHostCount) + dedicatedMgmtHostCount
    colocated:  sum(domain.recommendedHostCount)  [WLD-1 already inflated]
```

### Export Integration Data Flow

```
useMarkdownExport.generateMarkdownReport()
    ↓
reads: calc.management          (MgmtDomainResult — first section, unchanged)
reads: calc.dedicatedMgmtHostCount (shown in mgmt architecture section)
reads: calc.domainResults       (per-domain loop — unchanged structure)
reads: calc.aggregateTotals     (final totals — will now include mgmt hosts in dedicated)
    ↓
aggregateTotals section MUST show breakdown:
  - Workload hosts: sum(domain.recommendedHostCount)
  - Management hosts (dedicated): dedicatedMgmtHostCount
  - Total hosts (procurement): totalRecommendedHosts

usePptxExport.generatePptx()
    ↓
Same pattern — management slide before domain slides already exists
Aggregate totals slide must reflect corrected totalRecommendedHosts
```

---

## Component Change Inventory

### New Files

| File | Type | Purpose |
|------|------|---------|
| `src/components/wizard/Step1Topology.vue` | Vue SFC | Wizard step 1: topology + architecture selection |
| `src/components/wizard/Step2Management.vue` | Vue SFC | Wizard step 2: management domain specs + result |
| `src/components/wizard/Step3Workloads.vue` | Vue SFC | Wizard step 3: domain tabs + forms + results |
| `src/components/shared/WizardStepper.vue` | Vue SFC | Step indicator bar + prev/next navigation buttons |

### Modified Files

| File | Change Required | Constraint Impact |
|------|----------------|-------------------|
| `src/stores/uiStore.ts` | Add `currentWizardStep ref<1\|2\|3>`, `setStep`, `nextStep`, `prevStep` | None — uiStore already has ref(), CALC-02 applies to calculationStore only |
| `src/stores/calculationStore.ts` | Fix mgmtCores/mgmtRamGB per-domain logic; fix aggregateTotals to include dedicatedMgmtHostCount | CALC-02: all changes must use computed(), zero ref() |
| `src/engine/types.ts` | Optionally add `mgmtHostCount` field to `AggregateTotals` for export clarity | CALC-01: pure TypeScript only |
| `src/App.vue` | Render `WizardStepper` + step components instead of flat two-column layout | None |
| `src/composables/useMarkdownExport.ts` | Update aggregate section to show mgmt host count breakdown | None |
| `src/composables/usePptxExport.ts` | Update aggregate totals slide to reflect corrected numbers | None |

### Unchanged Files

| File | Reason |
|------|--------|
| `src/engine/compute.ts` | `calcCompute()` already accepts `managementCores` as a parameter — no signature change needed |
| `src/engine/management.ts` | `calcManagement()` is already correct — returns overhead for a given mode |
| `src/engine/storage.ts` | No change to storage calculations |
| `src/engine/stretch.ts` | No change to stretch calculations |
| `src/engine/vsanMax.ts` | No change to vSAN Max calculations |
| `src/engine/validation.ts` | No change to validation logic |
| `src/engine/defaults.ts` | No change to default values |
| `src/stores/inputStore.ts` | Already has correct structure: `managementDomain`, `workloadDomains[]`, `managementArchitecture` |
| `src/composables/useUrlState.ts` | Wizard step is intentionally NOT serialized to URL (ephemeral UI state) |
| `src/components/input/*` | All five input forms are reused inside wizard step components unchanged |
| `src/components/results/*` | All result components are reused inside Step3Workloads unchanged |
| `src/components/shared/DomainTabStrip.vue` | Unchanged — reused in Step3 |
| `src/components/shared/ManagementSummary.vue` | Unchanged — reused in Step2 |
| `src/components/shared/NumberSliderInput.vue` | Unchanged |
| `src/components/shared/LanguageSwitcher.vue` | Unchanged |
| `src/components/shared/WarningBanner.vue` | Unchanged |

---

## Scaling Considerations

This is a client-side SPA with no backend. Scaling concerns are about bundle size and reactivity graph complexity, not servers.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (1 wizard, 3 steps) | uiStore extension is sufficient; no need for dedicated store |
| If wizard gains validation gates (canAdvance logic) | Move to `wizardStore.ts` if uiStore grows beyond 60 lines |
| If steps become independently navigable from URL | Add `?step=N` to URL schema and hydrate via `useUrlState.ts` |

### Scaling Priorities

1. **Reactivity cost:** `domainResults` is a computed that maps an array. Each domain triggers a re-render of `DomainResultCard`. Already efficient — no change needed.
2. **Bundle cost:** Wizard step components are lightweight Vue SFCs. No dynamic import needed (unlike pptxgenjs).

---

## Anti-Patterns

### Anti-Pattern 1: Wizard Step in inputStore

**What people do:** Add `currentWizardStep: ref<number>` to `inputStore.ts` alongside domain data.

**Why it's wrong:** `inputStore` state is serialized to URL via `useUrlState.ts`. Wizard step is ephemeral UI state — it should reset to step 1 on every page load. Mixing it into `inputStore` would either pollute the URL schema or require an explicit exclusion in `generateShareUrl()`.

**Do this instead:** Add to `uiStore.ts` (already handles ephemeral locale state) or a dedicated `wizardStore.ts`.

### Anti-Pattern 2: Passing Management Overhead to All Domains

**What people do:** Pass `management.value.totalCores` and `management.value.totalRamGB` to every `calcCompute()` call in the `domainResults.map()`.

**Why it's wrong:** In dedicated mode, management runs on its own hosts — adding it as overhead to workload host calculations double-counts the hardware. In colocated mode, only WLD-1 absorbs the overhead — adding it to WLD-2, WLD-3, etc. also double-counts.

**Do this instead:** Use an index check inside the map:
```typescript
const mgmtCores = (isColocated && index === 0) ? management.value.totalCores : 0
```

### Anti-Pattern 3: ref() in calculationStore for Colocated Flag

**What people do:** Add `const isColocated = ref(false)` to `calculationStore.ts` to track architecture mode.

**Why it's wrong:** CALC-02 — `calculationStore.ts` must have zero `ref()`. The architecture mode is already in `inputStore.managementArchitecture` (a ref in the right store). `calculationStore` should read it via `input.managementArchitecture`.

**Do this instead:** Read `input.managementArchitecture` directly inside the `computed()` callback — Pinia tracks this dependency automatically.

### Anti-Pattern 4: Wizard v-show Instead of v-if

**What people do:** Use `v-show` to toggle visibility of all three step panels in App.vue or WizardStepper.vue.

**Why it's wrong:** All three step panels mount simultaneously. Step 3 contains the full `ResultsPanel` with Chart.js canvases and the domain tab strip — this incurs unnecessary DOM cost on first load.

**Do this instead:** Use `v-if` keyed on `uiStore.currentWizardStep`. Steps 1 and 2 are lightweight. Step 3 mounts on demand.

### Anti-Pattern 5: Aggregate Totals Forgetting Management Hosts

**What people do:** Keep `aggregateTotals.totalRecommendedHosts` as a pure sum of workload domain host counts.

**Why it's wrong:** In dedicated mode, the procurement order must include management cluster hosts. A sizing tool that outputs the wrong total defeats its core purpose.

**Do this instead:** Add `dedicatedMgmtHostCount.value ?? 0` to the sum when `managementArchitecture === 'dedicated'`.

---

## Integration Points

### Export Composables

Both export composables read from the Pinia stores at call time (snapshot pattern). They do not subscribe to reactive state.

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `useMarkdownExport` ↔ `calculationStore` | Direct store read at function call time | `calc.aggregateTotals.totalRecommendedHosts` will auto-reflect fix once calculationStore is patched |
| `usePptxExport` ↔ `calculationStore` | Same pattern | Aggregate totals slide will auto-reflect fix |
| `useMarkdownExport` ↔ `AggregateTotals` type | If `mgmtHostCount` field is added to interface | Markdown "Aggregate Totals" section should show mgmt host breakdown |
| `usePptxExport` ↔ `AggregateTotals` type | Same | Aggregate slide should show mgmt host breakdown |

### URL State

`useUrlState.ts` serializes `inputStore` only. The `uiStore.currentWizardStep` must NOT be serialized — this is intentional behavior matching `activeDomainIndex` (which is also excluded from URL state per URL-04 in the existing code).

No changes needed to `useUrlState.ts`, `InputStateSchema`, `hydrateFromUrl`, or `generateShareUrl`.

### i18n

New wizard step components will need i18n keys for:
- Step labels: `wizard.step1.label`, `wizard.step2.label`, `wizard.step3.label`
- Navigation: `wizard.next`, `wizard.back`
- Step descriptions (optional UX copy)

The engine layer remains i18n-free. Validation warning messages continue to use existing i18n keys.

---

## Build Order

The following ordering respects engine-before-store-before-UI dependencies and CALC-01/CALC-02:

1. **Engine fix first:** Fix `calculationStore.ts` management-overhead logic (Pattern 2). Write failing tests first (TDD wave 0). This is the highest-risk change — verify via existing 236 tests.

2. **Types second:** If `AggregateTotals` needs a `mgmtHostCount` field, add to `engine/types.ts`. This is CALC-01 safe (pure TypeScript).

3. **Aggregate fix third:** Fix `aggregateTotals` in `calculationStore.ts` to include `dedicatedMgmtHostCount`. Add tests.

4. **uiStore extension fourth:** Add `currentWizardStep` and navigation helpers to `uiStore.ts`. This is independent of the engine fix.

5. **Wizard components fifth:** Build `WizardStepper.vue`, `Step1Topology.vue`, `Step2Management.vue`, `Step3Workloads.vue`. These compose existing input/results components — no new calculation logic.

6. **App.vue integration sixth:** Replace flat two-column layout with `WizardStepper`. Gate on `uiStore.currentWizardStep`.

7. **Export updates last:** Update `useMarkdownExport.ts` and `usePptxExport.ts` aggregate sections to surface `mgmtHostCount` breakdown. These are last because they depend on the type change and corrected values from step 1-3.

---

## Sources

- Direct inspection of `src/engine/compute.ts` — `managementCores` param already exists in `ComputeInputs`
- Direct inspection of `src/stores/calculationStore.ts` — confirmed current bug: all domains receive full mgmt overhead
- Direct inspection of `src/stores/uiStore.ts` — confirmed pattern for ephemeral UI state
- Direct inspection of `src/stores/inputStore.ts` — confirmed `activeDomainIndex` precedent for non-serialized UI state
- Direct inspection of `src/engine/types.ts` — confirmed `AggregateTotals` structure
- Direct inspection of `src/composables/useUrlState.ts` — confirmed `activeDomainIndex` excluded from URL-04
- Pinia docs pattern: `computed()` reading other store state inside `defineStore` with Composition API — HIGH confidence, established pattern throughout this codebase
- Project CLAUDE.md — CALC-01, CALC-02 constraints are hard rules

---
*Architecture research for: VCF 9.x Sizing Calculator — v3.1 Wizard + Management-First Engine*
*Researched: 2026-03-30*
