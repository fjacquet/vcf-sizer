# Phase 16: Wizard Scaffold and State - Research

**Researched:** 2026-03-30
**Domain:** Vue 3 Composition API, Pinia 3, Tailwind CSS v4 — wizard step indicator with ephemeral state
**Confidence:** HIGH

---

## Summary

Phase 16 adds a 3-step horizontal wizard indicator (Topology / Management / Workloads) and the navigation model to move between steps. All data entered in later steps must survive backward navigation. The wizard step position is purely ephemeral UI state: it must never appear in the lz-string URL payload.

The primary implementation vehicle is a new `WizardStepper.vue` component placed in `src/components/shared/`, a `currentWizardStep` ref added to the existing `uiStore.ts`, and a restructured `App.vue` that conditionally renders the three step content panels via `v-show` (keep-alive semantics without `<KeepAlive>`). No new stores, no router, no new dependencies.

The URL exclusion guarantee (WIZARD-07) is already the established pattern in this codebase: `activeDomainIndex` in `inputStore` and the active tab position are both excluded from `generateShareUrl()` and absent from `InputStateSchema`. The same pattern applied to `currentWizardStep` in `uiStore` means it is structurally impossible for it to appear in the URL — `useUrlState.ts` only reads `inputStore`, never `uiStore`.

**Primary recommendation:** Add `currentWizardStep` ref to `uiStore.ts`; create `WizardStepper.vue` in `src/components/shared/`; restructure `App.vue` with three `v-show` panels; add i18n keys in all four locale files.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIZARD-01 | User sees a 3-step horizontal wizard with numbered and labeled steps (1: Topology, 2: Management, 3: Workloads) visible at all times during the sizing workflow | WizardStepper.vue in shared components; step labels need i18n keys in all 4 locales; active/completed/upcoming visual states use existing blue-600/gray pattern from DomainTabStrip.vue and ManagementDomainSection.vue |
| WIZARD-02 | User can navigate back to a previous step without losing any entered data | v-show (not v-if) on step content panels preserves DOM and reactive state; all inputStore data remains mounted; uiStore.currentWizardStep drives visibility only |
| WIZARD-07 | Shareable URL never encodes wizard step position (ephemeral UI state excluded from lz-string payload) | currentWizardStep lives in uiStore; generateShareUrl() only reads inputStore — structural exclusion, no code change needed in useUrlState.ts |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library (CALC-01). **Not affected by this phase.**
- `calculationStore.ts` must never contain `ref()` — only `computed()` (CALC-02). **Not affected by this phase.**
- Validation warnings must use i18n message keys — never raw English strings. **Wizard step labels must use `t('wizard.step1.label')` etc.**
- `VueI18nPlugin` is configured with `include` omitted intentionally — no changes to `vite.config.ts` needed.
- `uiStore.ts` is the designated home for locale switching and UI flags (CLAUDE.md Architecture section, Store layer). **`currentWizardStep` belongs here.**
- Wizard `onMounted` must never call `inputStore.$reset()` — only `uiStore.currentWizardStep = 1`. URL-hydrated state must be preserved (STATE.md Accumulated Context / Decisions).
- Step 1 must write `deploymentMode` to BOTH `managementDomain` AND all `workloadDomains` atomically — mixed topologies are not supported (STATE.md).
- `currentWizardStep` belongs in `uiStore` exclusively — never in `InputStateSchema` or `calculationStore` (STATE.md decisions).

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | 3.5.31 | Component framework | Project-established |
| Pinia | 3.0.4 | State management | Project-established |
| vue-i18n | v11 (in use) | 4-locale text keys | All UI text must use i18n keys |
| Tailwind CSS | v4 (in use) | Utility-class styling | Project-established |
| Vitest | 4.1.2 | Unit test runner | Project-established |

No new npm packages are required for this phase.

**Installation:** None required.

---

## Architecture Patterns

### Existing File Locations to Modify or Create

| File | Status | Change |
|------|--------|--------|
| `src/stores/uiStore.ts` | EXISTS (30 lines) | Add `currentWizardStep` ref + `setWizardStep()` action |
| `src/App.vue` | EXISTS (54 lines) | Import WizardStepper, restructure layout into 3 v-show panels |
| `src/components/shared/WizardStepper.vue` | CREATE | 3-step horizontal indicator with active/completed/upcoming states |
| `src/i18n/locales/en.json` | EXISTS | Add `wizard.*` keys |
| `src/i18n/locales/fr.json` | EXISTS | Add `wizard.*` keys (all 4 locales mandatory) |
| `src/i18n/locales/de.json` | EXISTS | Add `wizard.*` keys |
| `src/i18n/locales/it.json` | EXISTS | Add `wizard.*` keys |

### Recommended Project Structure (additions only)

```
src/
├── stores/
│   └── uiStore.ts           # + currentWizardStep ref, setWizardStep action
├── components/
│   └── shared/
│       └── WizardStepper.vue  # NEW — horizontal 3-step indicator + prev/next nav
└── App.vue                  # Restructured — 3 v-show step panels
```

### Pattern 1: Ephemeral UI State in uiStore

**What:** `currentWizardStep` is a `ref<1 | 2 | 3>` initialized to `1`, stored in `uiStore.ts`.
**When to use:** Any transient UI state that must NOT survive URL sharing. The existing `activeDomainIndex` in `inputStore` is a parallel example — but note that `activeDomainIndex` is in `inputStore` for historical reasons. Wizard step belongs in `uiStore` per the explicit architectural decision in STATE.md.

**Why it provides WIZARD-07 for free:** `generateShareUrl()` in `useUrlState.ts` (line 128) only reads `useInputStore()`. `uiStore` is never touched by that function. The Zod `InputStateSchema` (lines 57-69) has no `currentWizardStep` field. Even if someone added `currentWizardStep` to the URL manually, `.strip()` on the schema would discard it on hydration. URL exclusion is structurally guaranteed, not guarded by a conditional.

```typescript
// Source: existing uiStore.ts pattern + STATE.md architectural decision
// src/stores/uiStore.ts (addition)
const currentWizardStep = ref<1 | 2 | 3>(1)

function setWizardStep(step: 1 | 2 | 3): void {
  currentWizardStep.value = step
}

return { locale, setLocale, currentWizardStep, setWizardStep }
```

### Pattern 2: v-show for Step Panel Visibility (WIZARD-02)

**What:** All three step content panels are mounted in the DOM simultaneously. `v-show` toggles CSS `display:none` — reactive state and DOM nodes are preserved across step switches.
**When to use:** Any case where data preservation across hide/show is required. `v-if` destroys the component tree and loses local state — do NOT use it for wizard panels.

```vue
<!-- src/App.vue — conceptual structure -->
<!-- Step 1: Topology -->
<div v-show="ui.currentWizardStep === 1">
  <!-- DeploymentModelSelector for both management and workload topology -->
</div>

<!-- Step 2: Management -->
<div v-show="ui.currentWizardStep === 2">
  <ManagementDomainSection />
  <ManagementSummary />
</div>

<!-- Step 3: Workloads -->
<div v-show="ui.currentWizardStep === 3">
  <DomainTabStrip />
  <!-- per-domain forms -->
</div>
```

### Pattern 3: Active/Inactive Button Visual State (reuse from existing components)

**What:** The existing toggle button pattern from `ManagementDomainSection.vue` (lines 47-63) and `DomainTabStrip.vue` (lines 65-70) defines the project standard for active/inactive visual states.
**Exact class pattern from ManagementDomainSection.vue lines 53-57:**

```vue
<!-- Source: src/components/input/ManagementDomainSection.vue lines 47-63 -->
:class="[
  'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
  isActive
    ? 'bg-blue-600 text-white border-blue-600'
    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
]"
```

**For the wizard stepper, three visual states are needed:**
- **Active (current step):** `bg-blue-600 text-white border-blue-600` — same as existing toggle active state
- **Completed (step < current):** Distinct from active; suggest `bg-green-100 text-green-700 border-green-400 dark:bg-green-900 dark:text-green-300` or a checkmark icon + muted blue
- **Upcoming (step > current):** `bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700` (muted, non-interactive-looking but still clickable for back-nav to completed steps — note: WIZARD-EXT-01 click-to-jump is deferred to v4+; for now only back navigation via Prev button is required)

### Pattern 4: Step Label i18n Keys

All four locale files require matching keys. The en.json pattern shows top-level sections like `"wizard": { ... }`. Add parallel keys to fr.json, de.json, it.json.

**Proposed i18n keys (en.json addition):**
```json
"wizard": {
  "step1": {
    "number": "1",
    "label": "Topology"
  },
  "step2": {
    "number": "2",
    "label": "Management"
  },
  "step3": {
    "number": "3",
    "label": "Workloads"
  },
  "nav": {
    "previous": "Previous",
    "next": "Next"
  }
}
```

### Pattern 5: Step 1 Topology — What Goes There

**Critical architectural decision (STATE.md):** Step 1 must write `deploymentMode` to BOTH `managementDomain` AND all `workloadDomains` atomically.

This means Step 1 does NOT show the per-workload `DeploymentModelSelector` (which sets per-domain `deploymentMode`). Instead, Step 1 shows a global topology selector that writes to `inputStore.managementDomain.deploymentMode` AND calls `updateDomain` for every `workloadDomain` with the same value.

**Impact on existing `DeploymentModelSelector.vue`:** That component sets `domain.deploymentMode` per domain. In the wizard, Step 1 needs either:
1. A new `TopologySelector.vue` that writes globally (recommended), OR
2. The existing `ManagementDomainSection.vue` deployment mode toggle surfaced alone in Step 1

Option 1 is cleaner and keeps Step 1 focused. The new component reads `managementDomain.deploymentMode` for display, sets it on all domains on click.

### Anti-Patterns to Avoid

- **`v-if` on step panels:** Destroys component tree; loses reactive state, violates WIZARD-02.
- **`currentWizardStep` in `inputStore`:** Violates the architectural decision; would require adding it to `InputStateSchema` to avoid Zod strip silently swallowing it — then it would be in the URL.
- **`inputStore.$reset()` in wizard init:** Destroys URL-hydrated state. Only `uiStore.currentWizardStep = 1` is safe on mount.
- **Raw English strings in wizard labels:** All text must go through `t('wizard.step1.label')` etc. — CLAUDE.md constraint.
- **`<KeepAlive>` wrapper:** Not needed and not applicable — `v-show` already preserves state. `<KeepAlive>` is for `<component :is>` dynamic component swapping.
- **Importing uiStore in engine layer:** Engine layer must remain zero-Vue. The wizard step is consumed only at the App/component level.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Step state persistence across navigation | Custom localStorage or sessionStorage | `ref()` in Pinia uiStore | In-memory Pinia state is sufficient; page reload resets to step 1 (correct behavior per requirements) |
| URL-exclusion logic | Manual filtering in generateShareUrl | Store wizard step in uiStore (never read by useUrlState.ts) | Structural exclusion is safer than runtime filtering |
| Component state preservation | `<KeepAlive>` + `<component :is>` | `v-show` on static panels | v-show is simpler, DOM is always present, no keep-alive complexity |
| Wizard routing | vue-router with `/step/1`, `/step/2` | Pinia ref + v-show | REQUIREMENTS.md Out-of-Scope explicitly rejects router-based wizard steps |

**Key insight:** Wizard step state in a SPA without routing is solved by a single Pinia ref + v-show. All complexity is in layout restructuring, not in new abstractions.

---

## Common Pitfalls

### Pitfall 1: v-if Destroys Entered Data on Back Navigation
**What goes wrong:** Using `v-if="currentWizardStep === 3"` on the Workloads panel means when a user navigates back to Step 2, the entire Step 3 component tree is unmounted. All locally reactive state is gone. On return to Step 3, stores still have the data (Pinia state persists), but any component-local `ref()` state (e.g., rename buffer in DomainTabStrip, form focus state) is lost.
**Why it happens:** `v-if` is the Vue default conditional rendering directive and destroys/recreates DOM.
**How to avoid:** Use `v-show` exclusively for wizard step panels.
**Warning signs:** User reports "my domain rename was cancelled when I went back."

### Pitfall 2: Wizard Step Leaking Into URL via inputStore
**What goes wrong:** Adding `currentWizardStep` to `inputStore` instead of `uiStore`. Even if `generateShareUrl()` excludes it, the Zod schema might validate it from old URLs or someone adds it to the schema later.
**Why it happens:** `inputStore` is the obvious place for "app state."
**How to avoid:** Keep it in `uiStore`. The CLAUDE.md Architecture section explicitly names `uiStore` as the home for "locale switching and UI flags."
**Warning signs:** `InputStateSchema` in useUrlState.ts grows a `currentWizardStep` field.

### Pitfall 3: Mixed Topologies When Step 1 Writes Topology
**What goes wrong:** If Step 1 only updates `managementDomain.deploymentMode` but not `workloadDomains[*].deploymentMode`, the engine may compute management with `ha` but workloads with `simple`, producing inconsistent results.
**Why it happens:** `managementDomain.deploymentMode` and per-domain `deploymentMode` are independent fields.
**How to avoid:** The global topology action in Step 1 MUST call `inputStore.updateManagementDomain({ deploymentMode: val })` AND `inputStore.workloadDomains.forEach(d => inputStore.updateDomain(d.id, { deploymentMode: val }))` atomically.
**Warning signs:** Management host count uses HA formula but workload cards show Simple-mode counts.

### Pitfall 4: i18n Keys Missing in Non-English Locales
**What goes wrong:** Only `en.json` gets wizard keys; fr/de/it show raw key strings like "wizard.step1.label" in the UI.
**Why it happens:** i18n additions are easy to forget for non-primary locales.
**How to avoid:** All four locale files must be updated atomically in the same commit.
**Warning signs:** `[missing "fr.wizard.step1.label" translation]` shown in UI.

### Pitfall 5: onMounted Resetting inputStore State
**What goes wrong:** Adding `inputStore.$reset()` or equivalent to an `onMounted` hook in App.vue when the wizard is introduced.
**Why it happens:** Temptation to "start fresh" at step 1.
**How to avoid:** Only `uiStore.currentWizardStep = 1` on mount. Never reset inputStore. URL-hydrated state must survive.
**Warning signs:** Pasting a shareable URL always loads default values regardless of URL params.

---

## Code Examples

Verified patterns from existing codebase source:

### uiStore.ts Current State (full file — 30 lines)

```typescript
// Source: src/stores/uiStore.ts (current — read 2026-03-30)
// ADD: currentWizardStep ref and setWizardStep action
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n, loadLocale } from '../i18n'

type AppLocale = 'en' | 'fr' | 'de' | 'it'

export const useUiStore = defineStore('ui', () => {
  const browserLocale: AppLocale = ...
  const locale = ref<AppLocale>(browserLocale)
  // + ADD:
  const currentWizardStep = ref<1 | 2 | 3>(1)
  function setWizardStep(step: 1 | 2 | 3): void {
    currentWizardStep.value = step
  }
  // ...
  return { locale, setLocale, currentWizardStep, setWizardStep }
})
```

### generateShareUrl — Why uiStore is Never Included

```typescript
// Source: src/composables/useUrlState.ts lines 128-140
// Only reads inputStore — uiStore fields are structurally absent from the URL
export function generateShareUrl(): string {
  const store = useInputStore()   // <-- only inputStore, never uiStore
  const state = {
    managementArchitecture: store.managementArchitecture,
    managementDomain: { ...store.managementDomain },
    workloadDomains: store.workloadDomains.map(({ id: _id, ...rest }) => rest),
  }
  // currentWizardStep is never referenced here
  ...
}
```

### Active/Inactive Button Pattern (existing — reuse verbatim)

```vue
<!-- Source: src/components/input/ManagementDomainSection.vue lines 47-63 -->
<button
  v-for="arch in [{ value: 'colocated', labelKey: '...' }, ...]"
  :key="arch.value"
  :class="[
    'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
    managementArchitecture === arch.value
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
  ]"
  @click="managementArchitecture = arch.value"
>
```

### Parallel: activeDomainIndex Excluded from URL

```typescript
// Source: src/composables/useUrlState.ts line 118
// activeDomainIndex is NOT assigned — stays at 0 (URL-04).
// Same principle applies to currentWizardStep in uiStore.
```

---

## Key Files Reference (line numbers current as of 2026-03-30)

| File | Relevant Lines | Content |
|------|---------------|---------|
| `src/stores/uiStore.ts` | 1-30 | Full file — only locale state; add currentWizardStep here |
| `src/stores/inputStore.ts` | 17 | `activeDomainIndex = ref(0)` — parallel pattern to wizard step |
| `src/composables/useUrlState.ts` | 57-69 | `InputStateSchema` — no wizard step field; `.strip()` prevents injection |
| `src/composables/useUrlState.ts` | 128-140 | `generateShareUrl()` — reads only inputStore |
| `src/composables/useUrlState.ts` | 80-119 | `hydrateFromUrl()` — line 118 shows activeDomainIndex exclusion comment |
| `src/App.vue` | 26-54 | Current layout — two-pane grid; needs wizard stepper + step panels |
| `src/components/input/ManagementDomainSection.vue` | 47-63 | Active/inactive button pattern to reuse in WizardStepper |
| `src/components/shared/DomainTabStrip.vue` | 65-70 | Active tab border-bottom pattern |
| `src/i18n/locales/en.json` | 158-185 | End of file — append `wizard.*` keys after `"domain"` section |
| `src/main.ts` | 12 | `hydrateFromUrl()` called before mount — must NOT reset wizard step |

---

## App.vue Restructuring Plan

**Current layout (54 lines):** Two-pane grid (left: inputs, right: results). All inputs are in the left pane, unconditionally rendered.

**Target layout:** Same two-pane grid, but the left pane's content switches based on `uiStore.currentWizardStep`. A `WizardStepper` component sits at the top of the left pane (or full-width above both panes — to be decided by planner based on design preference).

**Structural approach:**
```
header (sticky)
  + WizardStepper (below header or inside left pane top)
main (grid)
  left pane:
    WizardStepper (OR here if not in header)
    v-show step === 1: [Topology content]
    v-show step === 2: [ManagementDomainSection, ManagementSummary]
    v-show step === 3: [DomainTabStrip, per-domain forms]
    navigation buttons (Prev / Next)
  right pane:
    ResultsPanel (unchanged — always visible, shows live results regardless of step)
```

**Design note:** The results pane showing live results regardless of wizard step is a feature, not a bug — users can see impact of their inputs in real time.

---

## Environment Availability

Step 2.6: SKIPPED — This phase is purely code/config changes. No external tools, services, CLIs, or runtimes beyond the existing npm toolchain are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (inferred from project — tests run with `npm run test`) |
| Quick run command | `npx vitest run src/stores/uiStore.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIZARD-01 | WizardStepper renders 3 steps with correct labels | unit (component — manual verify) | `npm run build` (type-check) | No — Wave 0 gap |
| WIZARD-02 | Back navigation preserves inputStore data | unit | `npx vitest run src/stores/uiStore.test.ts` | No — Wave 0 gap |
| WIZARD-07 | `generateShareUrl()` output never contains wizard step | unit | `npx vitest run src/composables/useUrlState.test.ts` | Partial — existing file, add test case |

**WIZARD-01 note:** Visual/rendering tests for Vue components require a DOM environment (jsdom/happy-dom). CLAUDE.md states "Tests cover `src/engine/**/*.test.ts` and `src/composables/**/*.test.ts` only — no DOM environment needed." Component visual tests are outside the established test scope — verify manually. The type-check (`npm run build`) validates TypeScript correctness.

**WIZARD-07 test approach:** Existing `useUrlState.ts` test file should exist or be created. The test proves that `generateShareUrl()` output, when decompressed and parsed, contains no `currentWizardStep` key. This is a pure TypeScript test, no DOM required.

**WIZARD-02 test approach:** A Vitest test for `uiStore` can verify: (1) `currentWizardStep` initializes to 1, (2) `setWizardStep(2)` updates it, (3) inputStore data is unaffected by step changes — pure store unit test, no DOM.

### Sampling Rate

- **Per task commit:** `npm run type-check`
- **Per wave merge:** `npm run test`
- **Phase gate:** `npm run test && npm run build` green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/stores/uiStore.test.ts` — covers WIZARD-02 (currentWizardStep init + transitions + inputStore independence)
- [ ] Add WIZARD-07 test case to `src/composables/useUrlState.test.ts` (if file exists) or create it

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat layout (all inputs visible) | 3-step wizard with v-show panels | Phase 16 | App.vue restructured; no engine changes |
| activeDomainIndex in inputStore (UI-state in data store) | currentWizardStep in uiStore (correct store separation) | Phase 16 decision | Cleaner separation; URL exclusion guaranteed by architecture |

**Note:** `activeDomainIndex` in `inputStore` is a legacy placement (added in Phase 10 before the wizard architecture was defined). The decision in STATE.md explicitly puts `currentWizardStep` in `uiStore`. The existing `activeDomainIndex` placement is not changed by this phase (out of scope).

---

## Open Questions

1. **WizardStepper placement: inside left pane or full-width above both panes?**
   - What we know: WIZARD-01 says "visible at all times during the sizing workflow" — could be either placement
   - What's unclear: Whether the results pane (right) should also show the stepper for visual consistency
   - Recommendation: Place inside the left pane, above step content, for simplicity; avoids duplicating stepper across panes

2. **Step 1 content: new TopologySelector.vue or reuse existing components?**
   - What we know: Step 1 must write `deploymentMode` to both `managementDomain` and all `workloadDomains` atomically (STATE.md)
   - What's unclear: Whether a new component is warranted or if `ManagementDomainSection`'s deployment mode toggle can be repurposed
   - Recommendation: Create a minimal `TopologySelector.vue` that reads `managementDomain.deploymentMode` and writes to both stores atomically. This is cleaner than embedding the full `ManagementDomainSection` in Step 1 (which includes host specs that belong in Step 2).

3. **Navigation buttons: inside WizardStepper or separate in each step panel?**
   - What we know: WIZARD-02 requires back navigation. WIZARD-03/04 (step validation gates) are Phase 17.
   - Recommendation: Navigation buttons (Prev/Next) as part of WizardStepper or as a fixed footer in the left pane. Keep them outside individual step panels for layout consistency.

---

## Sources

### Primary (HIGH confidence)

- Direct source read: `src/stores/uiStore.ts` — full file, confirmed no wizard state exists
- Direct source read: `src/composables/useUrlState.ts` — confirmed generateShareUrl only reads inputStore; InputStateSchema uses .strip()
- Direct source read: `src/App.vue` — confirmed current layout is flat two-pane grid
- Direct source read: `src/stores/inputStore.ts` — confirmed activeDomainIndex pattern
- Direct source read: `src/components/input/ManagementDomainSection.vue` — confirmed active/inactive button class pattern
- Direct source read: `.planning/STATE.md` — confirmed architectural decisions: wizard step in uiStore, no $reset on mount, atomic deploymentMode write
- Direct source read: `CLAUDE.md` — confirmed uiStore is home for UI flags; i18n key constraint; CALC-01/02

### Secondary (MEDIUM confidence)

- Vue 3 docs pattern: `v-show` vs `v-if` for keep-alive semantics — well-established, verified against project Vue version 3.5.31

### Tertiary (LOW confidence)

- WizardStepper visual design specifics (completed vs upcoming step indicators) — no official Tailwind/Vue pattern; recommendation based on existing project color palette

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed, exact versions verified
- Architecture: HIGH — decisions locked in STATE.md, existing code patterns confirmed by direct read
- WIZARD-07 URL exclusion: HIGH — structurally guaranteed by uiStore placement + useUrlState.ts code confirmed
- Pitfalls: HIGH — all from direct code inspection and explicit architectural decisions in STATE.md
- i18n key additions: HIGH — pattern confirmed, 4 locale files identified

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack, no fast-moving dependencies)
