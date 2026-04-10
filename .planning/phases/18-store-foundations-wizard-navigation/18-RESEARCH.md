# Phase 18: Store Foundations + Wizard Navigation - Research

**Researched:** 2026-04-10
**Domain:** Vue 3 + Pinia store additions, WizardStepper click handler, landing view
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIZARD-01 | User can click any completed WizardStepper step badge to jump back to that step | `setWizardStep()` already exists in uiStore; template change to completed step pills only |
| WIZARD-02 | User sees a landing/intro view on first load before the wizard starts | New `isLandingVisible` ref in uiStore; `dismissLanding()` action; `LandingView.vue` component; `App.vue` conditional |
</phase_requirements>

---

## Summary

Phase 18 is the store-foundations phase for the v3.3 milestone. It delivers two user-facing features (WIZARD-01: clickable completed steps; WIZARD-02: first-load landing view) plus the store scaffolding (chartImages registry, dismissLanding) consumed by phases 21 and 22 downstream.

The codebase inspection confirms that `uiStore.ts` already has `setWizardStep()`, `currentWizardStep`, `topologyConfirmed`, and `confirmTopology()` — all prerequisites for WIZARD-01 and the landing-view bypass logic are already in place. WIZARD-01 is a pure template change to `WizardStepper.vue`: completed step pills gain a `@click` handler with a backward-only guard. No store changes needed for WIZARD-01.

WIZARD-02 requires three coordinated changes: (1) `isLandingVisible ref<boolean>(true)` + `dismissLanding()` added to `uiStore.ts`; (2) `App.vue` wraps its `<main>` with `v-if/v-else` on `ui.isLandingVisible`; (3) `main.ts` calls `uiStore.dismissLanding()` on the existing `window.location.search.includes('s=')` path so URL-hydrated sessions skip the landing. A new `LandingView.vue` component in `src/components/shared/` provides the intro content.

The phase also adds the `chartImages` registry and `registerChartImage()` action to `uiStore` — these are not wired to any UI in this phase but must exist before Phase 21 (per-domain charts) can register images.

**Primary recommendation:** Implement all store additions first (uiStore: isLandingVisible + dismissLanding + chartImages registry), then wire WIZARD-01 (WizardStepper template), then build LandingView + App.vue integration (WIZARD-02). Tests for store additions should pass before any component work begins.

---

## Standard Stack

### Core (all already installed — zero new dependencies for Phase 18)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pinia` | `^3.0.4` | Store additions (`ref`, action pattern) | Already the project store layer [VERIFIED: package.json] |
| `vue` | `^3.5.32` | `ref<boolean>`, `computed`, `v-if/v-else`, template syntax | SPA framework [VERIFIED: package.json] |
| `vue-i18n` | `^11.3.0` | `t()` for LandingView copy | Already installed, locale system established [VERIFIED: package.json] |

### No New Dependencies

Phase 18 adds zero npm packages. All required primitives (`ref`, `computed`, `defineStore`, Tailwind CSS) are already installed and configured. [VERIFIED: package.json codebase inspection]

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
  stores/
    uiStore.ts            # ADD: isLandingVisible, dismissLanding, chartImages, registerChartImage
  components/
    shared/
      WizardStepper.vue   # MODIFY: completed step pills gain @click handler
      LandingView.vue     # NEW: first-load intro screen
  App.vue                 # MODIFY: v-if/v-else on isLandingVisible wrapping <main>
  main.ts                 # MODIFY: call dismissLanding() on URL-hydrated path
```

### Pattern 1: uiStore Additions (Pinia Composition API style)

**What:** Add ephemeral UI state refs and actions to the existing uiStore using the same pattern as `currentWizardStep` and `topologyConfirmed`.

**When to use:** All ephemeral UI flags that must never appear in URL state (WIZARD-07 structural guarantee).

**Example — uiStore additions:**
```typescript
// Source: direct codebase inspection — matches existing uiStore pattern
const isLandingVisible = ref<boolean>(true)

function dismissLanding(): void {
  isLandingVisible.value = false
}

// Chart image registry — consumed by Phase 21/22, wired here but not populated in Phase 18
type ChartType = 'cores' | 'ram' | 'storage'
const chartImages = ref<Record<string, Record<ChartType, string>>>({})

function registerChartImage(domainId: string, chartType: ChartType, dataUrl: string): void {
  if (!chartImages.value[domainId]) {
    chartImages.value[domainId] = {} as Record<ChartType, string>
  }
  chartImages.value[domainId][chartType] = dataUrl
}

// Expose alongside existing returns:
return { ..., isLandingVisible, dismissLanding, chartImages, registerChartImage }
```

**Constraint:** `isLandingVisible` and `chartImages` must NOT appear in `InputStateSchema` in `useUrlState.ts`. The schema uses `.strip()` which discards unknown keys, but the types must never be added. [VERIFIED: codebase inspection of useUrlState.ts]

### Pattern 2: WizardStepper Click-Back (WIZARD-01)

**What:** Completed step pills (where `ui.currentWizardStep > s.step`) gain a `@click` handler calling `ui.setWizardStep(s.step)`, plus cursor-pointer styling.

**When to use:** Only when the target step is already completed (strictly less than current step). Never for the active step or future steps.

**Current state of WizardStepper.vue:** The step indicator `div` in the `v-for` loop has no `@click` handler. The green completed-step condition is `ui.currentWizardStep > s.step`. [VERIFIED: codebase inspection of WizardStepper.vue]

**Template change:**
```html
<!-- Source: WizardStepper.vue existing template — add @click and cursor class -->
<div
  :class="['flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border font-medium',
    ui.currentWizardStep === s.step
      ? 'bg-blue-600 text-white border-blue-600'
      : ui.currentWizardStep > s.step
        ? 'bg-green-100 text-green-700 border-green-400 dark:bg-green-900 dark:text-green-300 dark:border-green-700 cursor-pointer hover:ring-2 hover:ring-green-400'
        : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700']"
  @click="ui.currentWizardStep > s.step ? ui.setWizardStep(s.step) : undefined"
>
```

**Key guard:** The `@click` only fires for completed (green) steps (`currentWizardStep > s.step`). Future steps (grey, `currentWizardStep < s.step`) have no click action — this satisfies success criterion 4 (forward-jump attempts have no effect).

### Pattern 3: Landing View — Boolean Flag + App.vue Conditional

**What:** `App.vue` shows `<LandingView>` when `ui.isLandingVisible === true`, otherwise shows the normal `<main>` two-pane layout. Uses `v-if/v-else` so only one subtree is mounted at a time.

**Design rationale (NOT step 0):** Using a separate boolean flag avoids widening `currentWizardStep` to `0 | 1 | 2 | 3`, which would require updating every guard in WizardStepper and App.vue. [VERIFIED: ARCHITECTURE.md Anti-Pattern 3]

**App.vue change:**
```html
<!-- Source: ARCHITECTURE.md Feature 2 pattern -->
<!-- Wrap existing template content -->
<LandingView v-if="ui.isLandingVisible" @start="ui.dismissLanding()" />
<div v-else class="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans">
  <!-- existing header + main content unchanged -->
</div>
```

**Alternative — inline v-else:** The landing view could replace just the `<main>` area while keeping the `<header>` visible. Either approach is acceptable; full-screen overlay (replacing entire app) is cleaner for a first-load intro.

### Pattern 4: Landing View Bypass for URL-Hydrated Sessions

**What:** `main.ts` already calls `uiStore.confirmTopology()` when `window.location.search.includes('s=')`. The same block must also call `uiStore.dismissLanding()` so URL-hydrated sessions bypass the landing.

**Gating on topologyConfirmed vs. separate logic:** The architectural decision (PITFALL-13, STATE.md) is to gate landing on `topologyConfirmed`, not on `localStorage`. Implementation options:

Option A (Preferred): Call `uiStore.dismissLanding()` explicitly in `main.ts` alongside the existing `uiStore.confirmTopology()` call. Direct, explicit, no indirect coupling.

Option B: Compute `isLandingVisible` as `!topologyConfirmed` in uiStore instead of a separate ref. Simpler but removes the independent control surface needed when a user navigates back (landing should not re-appear when topology is already confirmed).

**Recommendation:** Option A. Keep `isLandingVisible` as an independent `ref<boolean>(true)`, dismiss it explicitly from `main.ts` on URL hydration. [ASSUMED — Option A is cleaner for future control surface; both are valid]

**main.ts change (minimal):**
```typescript
// Source: main.ts existing URL hydration block
if (window.location.search.includes('s=')) {
  const uiStore = useUiStore()
  uiStore.confirmTopology()
  uiStore.dismissLanding()   // ADD THIS LINE
}
```

### Pattern 5: LandingView Component Structure

**What:** New `src/components/shared/LandingView.vue`. Renders a full-screen intro explaining the 3-step VCF sizing flow. Has a "Start Sizing" CTA button.

**Communication pattern:** LandingView does NOT own dismissal logic — it calls `uiStore.dismissLanding()` directly (store is already used throughout the component layer). No need for emits. [VERIFIED: ARCHITECTURE.md Feature 2 — "calls uiStore.dismissLanding() on the CTA button click"]

**Minimal structure:**
```html
<!-- Source: ARCHITECTURE.md Feature 2 — LandingView spec -->
<script setup lang="ts">
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from 'vue-i18n'
const ui = useUiStore()
const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
    <!-- Product tagline + 3-step flow summary -->
    <!-- "Start Sizing" button: @click="ui.dismissLanding()" -->
  </div>
</template>
```

**i18n keys needed:** New `landing.*` key namespace in all 4 locale files (en, fr.json, de.json, it.json). Minimum keys: `landing.title`, `landing.subtitle`, `landing.step1`, `landing.step2`, `landing.step3`, `landing.cta`. All strings must use i18n keys — never raw English strings per CLAUDE.md constraint.

### Anti-Patterns to Avoid

- **Step 0 for landing view:** Do NOT widen `currentWizardStep` type to `0 | 1 | 2 | 3`. Use `isLandingVisible` boolean flag. [VERIFIED: ARCHITECTURE.md Anti-Pattern 3]
- **localStorage for landing "has seen" flag:** Do NOT persist landing state to localStorage. PITFALL-13 documents how this breaks URL-shared links. Gate on `topologyConfirmed` / explicit `dismissLanding()` call only.
- **ref() in calculationStore:** All new `ref()` additions go in `uiStore` only. `calculationStore` must remain zero `ref()` (CALC-02). [VERIFIED: CLAUDE.md]
- **Forward clicks on WizardStepper:** Clicking a future (grey) step must have no effect. The `@click` guard must check `ui.currentWizardStep > s.step` before calling `setWizardStep`. [VERIFIED: success criterion 4]
- **chartImages in InputStateSchema:** The `chartImages` registry is ephemeral session state. It must never appear in the Zod `InputStateSchema` in `useUrlState.ts`. [VERIFIED: ARCHITECTURE.md Store Map]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Step navigation | Custom nav stack | `uiStore.setWizardStep()` (already exists) | Already implemented, tested, type-safe |
| URL bypass for landing | Custom URL parser | `window.location.search.includes('s=')` (already in main.ts) | Pattern already established |
| LandingView full-screen overlay | Custom portal/teleport | Plain `v-if/v-else` in App.vue | No DOM stacking context issues at top level |
| i18n for LandingView | Hardcoded English strings | `vue-i18n t()` via `useI18n()` hook | CLAUDE.md mandates i18n keys for all UI strings |

**Key insight:** Phase 18 avoids custom infrastructure entirely. Every needed primitive (store, navigation, URL check, i18n) already exists. The phase is additive extension, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Forward Jump Not Prevented (WIZARD-01)
**What goes wrong:** Clicking a future (grey) step activates it, bypassing topology or management validation gates.
**Why it happens:** Missing guard on the `@click` handler — all step pills become clickable instead of only completed ones.
**How to avoid:** The `@click` condition must be `ui.currentWizardStep > s.step` (strictly greater). The active step (`=== s.step`) and future steps (`< s.step`) must not trigger `setWizardStep`.
**Warning signs:** Clicking step 3 from step 1 navigates to step 3 without topology confirmation.

### Pitfall 2: Landing View Showing on URL-Hydrated Sessions (PITFALL-13)
**What goes wrong:** A user following a shared URL sees the landing page before their configuration loads.
**Why it happens:** `isLandingVisible` initializes to `true`; the URL hydration path forgets to call `dismissLanding()`.
**How to avoid:** Add `uiStore.dismissLanding()` to the `window.location.search.includes('s=')` block in `main.ts`. `hydrateFromUrl()` is called before this block, so the store is ready. [VERIFIED: main.ts inspection]
**Warning signs:** Opening any `?s=...` URL shows the landing intro instead of the configured sizing state.

### Pitfall 3: isLandingVisible Accidentally Added to URL Schema
**What goes wrong:** The landing view appears on fresh page loads after a page refresh (persisted to URL), or the Zod schema validation strips it causing subtle bugs.
**Why it happens:** Inadvertently adding `isLandingVisible` to `InputStateSchema` in `useUrlState.ts`.
**How to avoid:** `InputStateSchema` must not contain `isLandingVisible` or `chartImages`. The `.strip()` call discards unknown keys, so even accidental addition would be silently dropped — but the type audit must explicitly exclude them.
**Warning signs:** `isLandingVisible` appears in the URL query string after sharing.

### Pitfall 4: chartImages Type Not Exported
**What goes wrong:** Phase 21 attempts to import the `ChartType` union type and cannot find it.
**Why it happens:** Defining `ChartType = 'cores' | 'ram' | 'storage'` as a local type inside uiStore without exporting it.
**How to avoid:** Export `ChartType` from uiStore.ts or from `@/engine/types.ts` so Phase 21 components can import it for the `registerChartImage()` call signature.
**Warning signs:** TypeScript error in Phase 21 chart components when calling `ui.registerChartImage()`.

### Pitfall 5: LandingView Displayed Over Header
**What goes wrong:** The sticky `<header>` (LanguageSwitcher) disappears when landing is shown because the entire app root is replaced.
**Why it happens:** Wrapping the entire `<div class="min-h-screen">` (including header) inside `v-else`.
**How to avoid:** Decide on scope before coding: either (a) landing replaces only `<main>` (header remains visible — allows locale switching before starting), or (b) landing is full-screen (header hidden). Choice A is friendlier for Swiss multi-locale users. [ASSUMED — no explicit spec in requirements]

---

## Code Examples

### uiStore.ts — Full Return Object After Phase 18

```typescript
// Source: direct codebase inspection of uiStore.ts — additive pattern
return {
  locale, setLocale,
  currentWizardStep, setWizardStep,
  topologyConfirmed, confirmTopology,
  // Phase 18 additions:
  isLandingVisible, dismissLanding,
  chartImages, registerChartImage,
}
```

### WizardStepper.vue — Step Pill Click Guard

```html
<!-- Source: WizardStepper.vue template inspection + ARCHITECTURE.md Feature 1 -->
<div
  v-for="(s, index) in steps"
  :key="s.step"
  :class="[
    'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border font-medium transition-colors',
    ui.currentWizardStep === s.step
      ? 'bg-blue-600 text-white border-blue-600'
      : ui.currentWizardStep > s.step
        ? 'bg-green-100 text-green-700 border-green-400 dark:bg-green-900 dark:text-green-300 dark:border-green-700 cursor-pointer hover:ring-2 hover:ring-green-400'
        : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700'
  ]"
  @click="ui.currentWizardStep > s.step && ui.setWizardStep(s.step)"
>
```

### main.ts — URL Hydration + Landing Bypass

```typescript
// Source: main.ts codebase inspection — add dismissLanding() to existing block
if (window.location.search.includes('s=')) {
  const uiStore = useUiStore()
  uiStore.confirmTopology()
  uiStore.dismissLanding()  // Phase 18 addition
}
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `rtk vitest run src/stores/uiStore.test.ts` |
| Full suite command | `rtk vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIZARD-01 | Clicking completed step N calls setWizardStep(N) | unit (store) | `rtk vitest run src/stores/uiStore.test.ts` | Partial — uiStore.test.ts exists but no isLandingVisible tests |
| WIZARD-01 | Clicking active or future step does NOT call setWizardStep | unit (store) | `rtk vitest run src/stores/uiStore.test.ts` | Partial |
| WIZARD-02 | isLandingVisible initializes to true | unit (store) | `rtk vitest run src/stores/uiStore.test.ts` | Wave 0 gap |
| WIZARD-02 | dismissLanding() sets isLandingVisible to false | unit (store) | `rtk vitest run src/stores/uiStore.test.ts` | Wave 0 gap |
| WIZARD-02 | isLandingVisible is false after dismissLanding() | unit (store) | `rtk vitest run src/stores/uiStore.test.ts` | Wave 0 gap |
| chartImages | chartImages initializes to empty object | unit (store) | `rtk vitest run src/stores/uiStore.test.ts` | Wave 0 gap |
| chartImages | registerChartImage() stores dataUrl at correct key | unit (store) | `rtk vitest run src/stores/uiStore.test.ts` | Wave 0 gap |
| chartImages | registerChartImage() handles multiple domains correctly | unit (store) | `rtk vitest run src/stores/uiStore.test.ts` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `rtk vitest run src/stores/uiStore.test.ts`
- **Per wave merge:** `rtk vitest run`
- **Phase gate:** Full suite green (271+ tests passing) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/stores/uiStore.test.ts` — add `describe('uiStore — landing view (WIZARD-02)')` block covering: `isLandingVisible` init, `dismissLanding()`, idempotency
- [ ] `src/stores/uiStore.test.ts` — add `describe('uiStore — chartImages registry')` block covering: init empty, `registerChartImage()` single domain, `registerChartImage()` multiple domains, overwrite same key
- [ ] `src/i18n/locales/en.json` — add `landing.*` key namespace before LandingView component is built
- [ ] `src/i18n/locales/fr.json`, `de.json`, `it.json` — add matching `landing.*` translations

*(Note: No new test files needed — all store tests extend the existing `uiStore.test.ts`)*

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — Phase 18 is pure code changes within the existing SPA project with no new npm packages, external services, or CLI tools required).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | not applicable (client-only SPA, no auth) |
| V3 Session Management | no | no sessions |
| V4 Access Control | no | no access control |
| V5 Input Validation | no | Phase 18 adds no user text inputs |
| V6 Cryptography | no | no crypto in this phase |

**Security note:** `isLandingVisible` is ephemeral session state only. No XSS surface in LandingView (static marketing copy + i18n keys; no user-supplied content rendered via `v-html`). No security concerns in Phase 18. [VERIFIED: requirements scope — WIZARD-01 and WIZARD-02 only]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | LandingView should preserve the sticky header so users can switch locale before starting | Common Pitfalls §5 | If full-screen landing is preferred, App.vue structure changes slightly |
| A2 | `ChartType` union should be exported from uiStore.ts (or engine/types.ts) for downstream phase reuse | Architecture Patterns §1 | Phase 21 may need to declare the type locally if not exported; low risk |
| A3 | Option A (explicit dismissLanding() in main.ts) preferred over deriving isLandingVisible from topologyConfirmed | Architecture Patterns §4 | Option B (computed derivation) also works; only matters if behavior diverges in edge cases |

---

## Open Questions

1. **LandingView scope: full-screen vs. header-preserved**
   - What we know: ARCHITECTURE.md spec says "full-screen overlay or replacing the main content"
   - What's unclear: Whether the `LanguageSwitcher` in the header should remain accessible before the user dismisses landing
   - Recommendation: Preserve the header so Swiss users can switch to their preferred locale before entering the wizard. Landing replaces only `<main>`.

2. **LandingView content: what text?**
   - What we know: "product tagline, topology quick summary, Start Sizing button" (ARCHITECTURE.md)
   - What's unclear: Exact copy for the 3-step explanations and tagline
   - Recommendation: Use placeholder i18n keys (e.g., `landing.tagline`, `landing.step1desc`) and fill copy in the plan; the structural work is independent of final wording.

---

## Project Constraints (from CLAUDE.md)

| Directive | Scope | Enforcement |
|-----------|-------|-------------|
| Engine files must never import from Vue, Pinia, or any Vue ecosystem library | CALC-01 | Not applicable — Phase 18 touches only stores + components |
| `calculationStore.ts` must never contain `ref()` — only `computed()` | CALC-02 | Phase 18 adds refs to `uiStore` only — compliance confirmed |
| Validation warning `messageKey` must be an i18n key, never a raw English string | I18N | LandingView must use `landing.*` i18n keys |
| `VueI18nPlugin` configured with `include` omitted | Build config | No change to vite.config.ts needed |
| `currentWizardStep` must NEVER appear in `InputStateSchema` | WIZARD-07 | `isLandingVisible` and `chartImages` equally excluded |
| Wizard step never serialized to URL | WIZARD-07 | Enforced — `isLandingVisible`, `chartImages` excluded from InputStateSchema |
| Always prefix commands with `rtk` | RTK tool | Applied in all test commands above |

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection:
  - `src/stores/uiStore.ts` — confirmed existing API: `currentWizardStep`, `setWizardStep()`, `topologyConfirmed`, `confirmTopology()`; return object shape
  - `src/components/shared/WizardStepper.vue` — confirmed completed step condition (`ui.currentWizardStep > s.step`), no existing `@click` on step pills
  - `src/main.ts` — confirmed existing URL hydration block and `uiStore.confirmTopology()` call location
  - `src/App.vue` — confirmed two-pane layout structure; confirmed `v-show` usage for wizard steps (data preserved across steps)
  - `src/stores/inputStore.ts` — confirmed existing domain mutation actions; no `duplicateDomain` yet
  - `src/stores/uiStore.test.ts` — confirmed existing test coverage; no landing view or chartImages tests yet
  - `src/stores/inputStore.test.ts` — confirmed test patterns for store additions
  - `src/i18n/index.ts` — confirmed `i18n` singleton export and `loadLocale()` pattern
  - `src/i18n/locales/en.json` — confirmed top-level namespaces; no `landing` namespace yet
  - `package.json` — confirmed zero new dependencies needed for Phase 18
  - `vitest.config.ts` — confirmed test environment (`node`), include glob, alias
  - `.planning/config.json` — confirmed `nyquist_validation: true`

- `.planning/research/ARCHITECTURE.md` (2026-04-10) — Feature 1 and Feature 2 integration analysis, anti-pattern list, data flow diagrams
- `.planning/research/PITFALLS.md` (2026-04-10) — PITFALL-6, PITFALL-13 directly applicable
- `.planning/STATE.md` — confirmed v3.3 decisions and architectural constraints
- `CLAUDE.md` — confirmed coding conventions, CALC-01/02, i18n mandates

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md` (2026-04-10) — Phase ordering rationale, feature dependency constraints

### Tertiary (LOW confidence)

- None. All claims in this research are verified against codebase inspection or established project research documents.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new dependencies; all libraries verified in package.json
- Architecture: HIGH — grounded in direct file inspection of all affected files
- Pitfalls: HIGH — PITFALL-6 and PITFALL-13 sourced from PITFALLS.md with documented mitigations

**Research date:** 2026-04-10
**Valid until:** Stable — Phase 18 touches only store additions and 3 component files; no fast-moving ecosystem concerns
