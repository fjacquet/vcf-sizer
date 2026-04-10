# Phase 19: Topology Confirmation + Domain Duplication - Research

**Researched:** 2026-04-10
**Domain:** Vue 3 + Pinia — confirmation dialog pattern, reactive clone, store action additions
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIZARD-03 | User is prompted to confirm before changing topology after workloads have been configured | `pendingTopology` local ref captures intent BEFORE any store write; `ConfirmationDialog.vue` new shared component; `TopologySelector.vue` modified to intercept click when domains have data |
| DOMAIN-01 | User can duplicate a workload domain ("Copy domain") with all its settings cloned and a new name assigned | `duplicateDomain(id)` action on `inputStore`; `structuredClone(toRaw(domain))` is the canonical safe clone; new UUID assigned; name appended with ` (copy)`; tab inserted immediately after original |
</phase_requirements>

---

## Summary

Phase 19 delivers two user-facing features: topology-change confirmation (WIZARD-03) and domain duplication (DOMAIN-01). Both are self-contained store + component changes with zero new npm dependencies.

**WIZARD-03** requires intercepting the existing `setGlobalTopology()` call in `TopologySelector.vue`. The current implementation writes to the store immediately on button click. Phase 19 changes this to: (1) check whether any workload domain has non-default data; (2) if yes, capture `pendingTopology` in a local `ref` and show a `ConfirmationDialog.vue` component; (3) only write to the store and call `confirmTopology()` when the user confirms. If the user cancels, `pendingTopology` is cleared and the topology selector visually stays unchanged. The dialog is a new shared component styled with the existing Tailwind palette — no external dialog library needed.

**DOMAIN-01** requires a `duplicateDomain(id)` action on `inputStore`. The canonical clone pattern is `structuredClone(toRaw(domain))` — `toRaw()` strips the Pinia reactive proxy before `structuredClone()` runs, avoiding the Pinia #1412 bug where bare `structuredClone()` on a reactive proxy throws or produces an uncloneable object. The duplicate gets a new `crypto.randomUUID()`, the name suffixed with ` (copy)`, and is spliced into `workloadDomains` immediately after the original. `activeDomainIndex` advances to the new domain's index. The "Copy domain" button lives in `DomainTabStrip.vue` (per-tab action, not a global "+" button).

The STATE.md already documents both canonical patterns as architectural decisions (PITFALL-5 and the `structuredClone(toRaw())` note), so these are locked choices — no alternatives to research.

**Primary recommendation:** Implement in two sequential plans: Plan 01 = store action additions (`duplicateDomain`) + TDD tests + `ConfirmationDialog.vue` + `TopologySelector.vue` modified guard. Plan 02 = `DomainTabStrip.vue` copy button + i18n keys for all 4 locales.

---

## Project Constraints (from CLAUDE.md)

- Engine layer (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library (CALC-01).
- `calculationStore.ts` must never contain `ref()` — only `computed()` (CALC-02).
- Validation warnings must use i18n message keys, never raw English strings.
- `VueI18nPlugin` configured with `include` omitted intentionally (rolldown/JSON conflict with Vite 8).
- Path alias: `@/` maps to `src/`.

---

## Standard Stack

### Core (zero new dependencies — all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pinia` | `^3.0.4` | `duplicateDomain()` action; store reads for topology guard | Already the project store layer [VERIFIED: package.json] |
| `vue` | `^3.5.32` | `ref`, `toRaw`, `computed`, SFC template directives | SPA framework [VERIFIED: package.json] |
| `vue-i18n` | `^11.3.0` | All dialog and button copy via `t()` | Already installed [VERIFIED: package.json] |

### No New Dependencies

Phase 19 adds zero npm packages. [VERIFIED: codebase inspection — all required primitives (`ref`, `toRaw`, `structuredClone`, `crypto.randomUUID`, Tailwind CSS) are already available]

**Installation:** none required.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
  stores/
    inputStore.ts             # ADD: duplicateDomain(id) action
    inputStore.test.ts        # ADD: duplicateDomain() test suite
  components/
    shared/
      ConfirmationDialog.vue  # NEW: reusable modal dialog (WIZARD-03)
      TopologySelector.vue    # MODIFY: intercept click, show dialog when domains have data
      DomainTabStrip.vue      # MODIFY: add "Copy" button per tab (DOMAIN-01)
  i18n/locales/
    en.json                   # ADD: topology.confirmTitle, topology.confirmMessage,
                              #      topology.confirmCta, topology.cancelCta,
                              #      domain.copyDomain, domain.copyNameSuffix
    fr.json                   # ADD: same keys in French
    de.json                   # ADD: same keys in German
    it.json                   # ADD: same keys in Italian
```

### Pattern 1: Topology Intercept with Local Pending Ref (PITFALL-5)

**What:** Capture pending topology choice in a local `ref` BEFORE any store write. Only commit to the store after user confirmation.

**When to use:** Any user action that would destructively overwrite existing data in the store.

**Critical rule (STATE.md PITFALL-5):** Never write to the store first then try to undo — there is no undo mechanism. Capture intent → show dialog → commit or discard.

**Example — TopologySelector.vue modified pattern:**
```typescript
// Source: STATE.md PITFALL-5 + codebase inspection of existing TopologySelector.vue
import { ref, computed } from 'vue'
import { useInputStore } from '@/stores/inputStore'
import { useUiStore } from '@/stores/uiStore'
import { createDefaultWorkloadDomain } from '@/engine/defaults'

const input = useInputStore()
const ui = useUiStore()

const pendingTopology = ref<'simple' | 'ha' | 'stretch' | null>(null)
const showConfirmDialog = ref(false)

// Check if ANY workload domain has non-default data
function hasConfiguredDomains(): boolean {
  const defaults = createDefaultWorkloadDomain(0)
  const skip = new Set(['id', 'name', 'deploymentMode'])
  return input.workloadDomains.some(domain =>
    (Object.keys(defaults) as Array<keyof typeof defaults>)
      .filter(k => !skip.has(k))
      .some(k => domain[k] !== defaults[k])
  )
}

function requestTopologyChange(mode: 'simple' | 'ha' | 'stretch') {
  // Guard: only prompt if topology is changing AND domains have data
  if (mode === input.managementDomain.deploymentMode) return  // no-op: same topology
  if (hasConfiguredDomains() && input.workloadDomains.length >= 1) {
    pendingTopology.value = mode
    showConfirmDialog.value = true
  } else {
    applyTopology(mode)
  }
}

function applyTopology(mode: 'simple' | 'ha' | 'stretch') {
  input.updateManagementDomain({ deploymentMode: mode })
  input.workloadDomains.forEach(d => input.updateDomain(d.id, { deploymentMode: mode }))
  ui.confirmTopology()
  pendingTopology.value = null
  showConfirmDialog.value = false
}

function onConfirm() {
  if (pendingTopology.value) applyTopology(pendingTopology.value)
}

function onCancel() {
  pendingTopology.value = null
  showConfirmDialog.value = false
}
```

**Key insight:** `currentMode` computed stays bound to `input.managementDomain.deploymentMode` — it does NOT change until `applyTopology()` is called. So the selector visually shows the old topology if the user cancels.

### Pattern 2: Domain Clone with toRaw (Pinia #1412)

**What:** Deep-clone a Pinia reactive domain object without hitting the reactive proxy barrier.

**When to use:** Every time a `WorkloadDomainConfig` object is cloned from the store for duplication, export, or snapshot.

**Critical rule (STATE.md):** `structuredClone(toRaw(domain))` — always both together. Bare `structuredClone(domain)` throws on Pinia's reactive proxy.

**Example — duplicateDomain action in inputStore.ts:**
```typescript
// Source: STATE.md canonical pattern + Vue 3 docs (toRaw strips reactive proxy)
// toRaw import: from 'vue'
import { ref } from 'vue'
import { toRaw } from 'vue'

function duplicateDomain(id: string): void {
  const idx = workloadDomains.value.findIndex(d => d.id === id)
  if (idx === -1) return

  const source = workloadDomains.value[idx]
  // toRaw() required before structuredClone() — bare clone throws on Pinia reactive proxy (Pinia #1412)
  const clone = structuredClone(toRaw(source))

  // New identity — UUID and name are the only fields that differ from source
  clone.id = crypto.randomUUID()
  clone.name = `${source.name} (copy)`

  // Insert immediately after the original (splice at idx + 1)
  workloadDomains.value.splice(idx + 1, 0, clone)
  // Activate the new domain tab
  activeDomainIndex.value = idx + 1
}
```

**Field count verification:** `WorkloadDomainConfig` has 28 fields total. Identity fields (id, name) = 2. Configuration fields cloned faithfully = 26. This matches the ROADMAP success criterion. [VERIFIED: src/engine/types.ts inspection]

### Pattern 3: ConfirmationDialog.vue — Shared Reusable Component

**What:** A slot-less modal overlay component driven by props and emits. No third-party dialog library.

**API surface:**
```typescript
// Props
defineProps<{
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
}>()

// Emits
defineEmits<{
  confirm: []
  cancel: []
}>()
```

**Template structure (Tailwind only — matches existing palette):**
```html
<!-- Fixed overlay — z-50 so it sits above sticky header (z-10) -->
<div v-if="visible"
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
  @click.self="$emit('cancel')"
>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4
              border border-gray-200 dark:border-gray-700">
    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
    <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ message }}</p>
    <div class="mt-4 flex justify-end gap-2">
      <button @click="$emit('cancel')"
        class="px-4 py-2 text-sm rounded border border-gray-300 dark:border-gray-600
               bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300
               hover:border-gray-400 font-medium transition-colors">
        {{ cancelLabel }}
      </button>
      <button @click="$emit('confirm')"
        class="px-4 py-2 text-sm rounded bg-blue-600 text-white border border-blue-600
               hover:bg-blue-700 font-medium transition-colors">
        {{ confirmLabel }}
      </button>
    </div>
  </div>
</div>
```

**Accessibility requirements:**
- Dialog `div` should have `role="dialog"` and `aria-modal="true"`.
- Cancel on backdrop click (`.self` modifier on outer div).
- Escape key support: `@keydown.escape` on the dialog div or document-level listener.

### Pattern 4: "Copy Domain" Button Placement in DomainTabStrip

**What:** A small icon or text button inside each domain tab, beside the existing delete `×` button.

**Placement:** After the domain name label, before the delete button (or after it — see UI spec decision below).

**Trigger:** `@click.stop` to prevent the click from also activating the tab.

**Action:** Calls `input.duplicateDomain(domain.id)` — the store action handles tab activation.

**Example addition to DomainTabStrip.vue:**
```html
<!-- Copy button — shown when more than 0 domains (always shown) -->
<button
  class="ml-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded focus:outline-none"
  :aria-label="t('domain.copyDomain', { name: domain.name })"
  @click.stop="input.duplicateDomain(domain.id)"
>
  <!-- copy icon: two overlapping squares, rendered as text character or inline SVG -->
  &#x2398;
</button>
```

Note: The exact icon character or SVG is a UI spec decision. The text `t('domain.copyDomain')` key is mandatory for screen reader support.

### Pattern 5: Wizard Reset on Topology Confirm

**What:** When the user confirms a topology change, wizard step should reset to 1 and topology confirmed flag should reflect the new selection.

**Behavior per ROADMAP success criterion 3:** "User who confirms the topology change sees the new topology applied and the wizard reset to step 1."

**Implementation:** After `applyTopology()` calls `input.updateManagementDomain(...)` and the per-domain updates, also call `ui.setWizardStep(1)`. The `ui.confirmTopology()` call stays (topology is confirmed, just different now).

**Note:** `topologyConfirmed` was already `true` before the user clicked a new topology (they confirmed one earlier). Resetting to step 1 plus re-confirming is the correct sequence — calling `confirmTopology()` again is idempotent per the existing test suite. [VERIFIED: uiStore.test.ts line 81]

### Anti-Patterns to Avoid

- **Writing to store before showing confirmation:** `input.updateManagementDomain({ deploymentMode: mode })` must NOT happen until after user clicks the confirm button. [STATE.md PITFALL-5]
- **Bare `structuredClone(domain)` without `toRaw()`:** Throws on Pinia reactive proxy. Always wrap: `structuredClone(toRaw(domain))`. [STATE.md + Pinia #1412]
- **Using `$patch()` to splice arrays:** Pinia `$patch` uses shallow merge and breaks array operations. Use direct `workloadDomains.value.splice(...)`. [VERIFIED: existing inputStore.ts comment]
- **Resetting `topologyConfirmed` to false on topology change:** Do not reset — call `confirmTopology()` again (idempotent). Resetting to false would break the step 1 → step 2 forward gate.
- **Putting `pendingTopology` in the store:** It must be local `ref` inside `TopologySelector.vue`. It is component-local intent state, not shared application state.
- **Using `window.confirm()` for topology dialog:** REQUIREMENTS.md (Future section) explicitly notes `window.confirm()` replacement is a future goal — Phase 19 is the first real dialog and establishes the `ConfirmationDialog.vue` pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep-clone reactive Pinia object | Custom recursive copy function | `structuredClone(toRaw(obj))` | Handles all primitives, nested objects, and edge cases; one liner |
| Unique domain ID generation | UUID v4 implementation | `crypto.randomUUID()` | Already used throughout the codebase; built-in browser API |
| Modal overlay | External dialog library (Headless UI, Radix Vue) | Hand-rolled Tailwind component | Zero new deps; existing `z-10` header stacking context well-understood |
| Non-default data detection for topology guard | Comparing serialized JSON strings | Field-by-field comparison skipping `id`, `name`, `deploymentMode` | More readable, avoids ordering issues with JSON.stringify |

**Key insight:** This phase is entirely in the Vue/Pinia composition layer. All primitives exist. Adding any new npm dependency for a simple dialog or clone would be over-engineering for this codebase size.

---

## Common Pitfalls

### Pitfall 1: Store Write Before Confirmation (PITFALL-5)
**What goes wrong:** `setGlobalTopology()` in `TopologySelector.vue` currently writes to the store immediately. If you just add a dialog `v-if` after the write, the store is already mutated and the cancel path has no rollback.
**Why it happens:** Intuitive refactor — "add a dialog, then cancel undoes it" — but Pinia has no built-in undo.
**How to avoid:** Introduce `pendingTopology = ref(null)` BEFORE touching any store method. Gate the store write inside the confirm handler only.
**Warning signs:** If you find yourself writing `input.updateManagementDomain` in the same function that sets `showConfirmDialog.value = true`, you have the wrong order.

### Pitfall 2: Bare structuredClone on Pinia Reactive Proxy (Pinia #1412)
**What goes wrong:** `structuredClone(workloadDomains.value[idx])` throws `DataCloneError: Failed to execute 'structuredClone' on 'Window': Value at index 0 does not transfer.`
**Why it happens:** Pinia's reactive proxy wraps objects with `Proxy` traps that `structuredClone` cannot traverse.
**How to avoid:** Always: `structuredClone(toRaw(domain))`. Import `toRaw` from `vue`.
**Warning signs:** `DataCloneError` in console during duplication. Alternatively: the clone appears to succeed but returns the same reference (proxy pass-through edge case).

### Pitfall 3: toRaw Not Imported from Vue
**What goes wrong:** `toRaw is not defined` runtime error.
**Why it happens:** `toRaw` is a named export from `vue` — not a global. Easy to forget to add to the import statement.
**How to avoid:** Add `toRaw` to the Vue import in `inputStore.ts`: `import { ref, toRaw } from 'vue'`.
**Warning signs:** TypeScript will catch this at compile time if strict mode is on.

### Pitfall 4: activeDomainIndex Out of Bounds After Splice
**What goes wrong:** After `splice(idx + 1, 0, clone)`, the `activeDomainIndex` is set to `idx + 1`. But if the user later removes the original domain (at `idx`), the activeDomainIndex logic in `removeDomain()` correctly clamps. No extra guard needed — existing `removeDomain()` already does `Math.min(activeDomainIndex.value, workloadDomains.value.length - 1)`.
**Why it happens:** Not actually a bug — documenting it so the planner does not add unnecessary guards.
**How to avoid:** No action needed. Existing splice + clamp pattern is correct.

### Pitfall 5: Copy Button Fires Tab Switch AND Copy
**What goes wrong:** The copy button lives inside the tab div which has `@click="input.activeDomainIndex = index"`. Without `.stop`, clicking the copy button fires both the tab switch and the copy action.
**Why it happens:** Event bubbling. The tab's outer `<div>` has a click handler.
**How to avoid:** Use `@click.stop` on the copy button. [VERIFIED: existing delete button in DomainTabStrip.vue uses the same `@click.stop` pattern at line 96]

### Pitfall 6: Topology Confirmation Fires on Same-Topology Click
**What goes wrong:** User clicks the currently-active topology button (e.g., clicks "HA" when HA is already selected). This fires `requestTopologyChange('ha')`, detects non-default data, shows the confirmation dialog, and the user is confused.
**Why it happens:** No guard for "same as current" in the intercept logic.
**How to avoid:** Early return in `requestTopologyChange(mode)` when `mode === input.managementDomain.deploymentMode`.

### Pitfall 7: main.ts `s=` vs `c=` Param Mismatch (Pre-Existing Bug)
**What goes wrong:** `main.ts` checks `window.location.search.includes('s=')` but `useUrlState.ts` uses `?c=` param. URL-hydrated sessions do not trigger `confirmTopology()` or `dismissLanding()`.
**Why it happens:** The param name was changed from `s=` to `c=` during URL state compression implementation, and the comment/guard in `main.ts` was not updated.
**How to avoid:** Phase 19 should NOT fix this (out of scope). Document as a known pre-existing bug. The fix (change `'s='` to `'c='`) is trivial but would need its own plan with test coverage.
**Warning signs:** Users arriving via a shared URL land on the landing view and see step 1 with no data, then the URL data hydrates but topology confirmation is missing.

---

## Code Examples

Verified patterns from codebase inspection:

### Existing `addDomain()` Pattern (reference for `duplicateDomain()` splice)
```typescript
// Source: src/stores/inputStore.ts — verified codebase inspection
function addDomain() {
  workloadDomains.value.push(createDefaultWorkloadDomain(workloadDomains.value.length))
  activeDomainIndex.value = workloadDomains.value.length - 1
}
```
`duplicateDomain()` mirrors this but uses `splice(idx + 1, 0, clone)` instead of `push()`.

### Existing Delete Confirmation with window.confirm (to be superseded)
```typescript
// Source: src/components/shared/DomainTabStrip.vue line 51-55
function requestDelete(domain: WorkloadDomainConfig) {
  if (hasNonDefaultData(domain)) {
    const confirmed = window.confirm(t('domain.deleteConfirm', { name: domain.name }))
    if (!confirmed) return
  }
  input.removeDomain(domain.id)
}
```
Phase 19 builds `ConfirmationDialog.vue` — the Future Requirements in REQUIREMENTS.md note that `window.confirm()` in domain delete should eventually use the shared dialog. Phase 19 does NOT need to migrate the delete confirmation (out of scope).

### Existing hasNonDefaultData Pattern (reuse in TopologySelector)
```typescript
// Source: src/components/shared/DomainTabStrip.vue lines 42-48
function hasNonDefaultData(domain: WorkloadDomainConfig): boolean {
  const defaults = createDefaultWorkloadDomain(0)
  const skip = new Set<keyof WorkloadDomainConfig>(['id', 'name'])
  return (Object.keys(defaults) as Array<keyof WorkloadDomainConfig>)
    .filter(k => !skip.has(k))
    .some(k => domain[k] !== defaults[k])
}
```
For the topology guard, the skip set should also include `deploymentMode` (since topology change will update deploymentMode — we don't want that field to count as "non-default data for purposes of showing the warning"). The component-level function can import `createDefaultWorkloadDomain` from `@/engine/defaults`.

### Existing topologyConfirmed + confirmTopology() (already implemented in Phase 18)
```typescript
// Source: src/stores/uiStore.ts — verified codebase inspection
const topologyConfirmed = ref<boolean>(false)
function confirmTopology(): void {
  topologyConfirmed.value = true
}
```
Phase 19 does NOT add new uiStore state. `confirmTopology()` is called after the user confirms a topology change — it is idempotent (calling when already true is safe per tests).

---

## i18n Keys Required

All 4 locale files need these new keys. The planner must include tasks to add keys in en.json, fr.json, de.json, it.json.

| Key | Namespace | English Value | Purpose |
|-----|-----------|---------------|---------|
| `topology.confirmTitle` | `topology` | "Change topology?" | Dialog heading |
| `topology.confirmMessage` | `topology` | "Changing the topology will reset all workload domain settings. This cannot be undone." | Dialog body |
| `topology.confirmCta` | `topology` | "Change topology" | Confirm button label |
| `topology.cancelCta` | `topology` | "Keep current" | Cancel button label |
| `domain.copyDomain` | `domain` | "Copy domain \"{name}\"" | Aria-label for copy button |
| `domain.copyNameSuffix` | `domain` | "(copy)" | Suffix appended to cloned domain name |

**Alternative for name suffix:** Some implementations hardcode ` (copy)` in the action. Using an i18n key (`domain.copyNameSuffix`) is preferred so the suffix is localized (e.g., French: " (copie)"). The store action should call `t()` — but `inputStore.ts` cannot use `useI18n()` (store context, not component context). Options:
1. Hardcode `" (copy)"` in the store action and accept non-localized suffix (simpler, acceptable for v1).
2. Pass the generated name as a parameter to `duplicateDomain(id, suggestedName)` and let the calling component call `t('domain.copyNameSuffix')`.

**Recommendation:** Option 2 — caller computes the name using `t()`, passes it to `duplicateDomain(id, newName)`. This keeps `inputStore.ts` free of i18n imports (composable purity) and allows localized copy names.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/stores/inputStore.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOMAIN-01 | `duplicateDomain(id)` inserts clone after original | unit | `npx vitest run src/stores/inputStore.test.ts` | Wave 0 (new describe block) |
| DOMAIN-01 | Clone has new UUID different from source | unit | `npx vitest run src/stores/inputStore.test.ts` | Wave 0 |
| DOMAIN-01 | Clone name is `"${original.name} (copy)"` or parameterized equivalent | unit | `npx vitest run src/stores/inputStore.test.ts` | Wave 0 |
| DOMAIN-01 | Clone has all 26 config fields equal to source (deep equality) | unit | `npx vitest run src/stores/inputStore.test.ts` | Wave 0 |
| DOMAIN-01 | `activeDomainIndex` advances to new domain after duplication | unit | `npx vitest run src/stores/inputStore.test.ts` | Wave 0 |
| DOMAIN-01 | `duplicateDomain('nonexistent')` is a no-op | unit | `npx vitest run src/stores/inputStore.test.ts` | Wave 0 |
| WIZARD-03 | Topology guard: same-topology click is no-op (no dialog shown) | component | manual / visual | N/A |
| WIZARD-03 | Cancel leaves store and selector unchanged | unit (store snapshot) | `npx vitest run src/stores/inputStore.test.ts` | Wave 0 |
| WIZARD-03 | Confirm updates deploymentMode on management + all workload domains | unit | `npx vitest run src/stores/inputStore.test.ts` | Wave 0 |

**Note on WIZARD-03 store tests:** The confirmation dialog logic lives in `TopologySelector.vue` (component), not in the store. Pure store tests can verify: "after calling `updateManagementDomain` and `updateDomain` for all domains with a new deploymentMode, all domains reflect the new mode." Component-level guard behavior (showing/hiding the dialog, cancelling) is not unit-testable in the node environment without DOM. The vitest environment is `node` (verified: `vitest.config.ts`). Component tests for dialog visibility would require jsdom — that is out of scope for this phase.

### Sampling Rate
- **Per task commit:** `npx vitest run src/stores/inputStore.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite (279+ tests) green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/stores/inputStore.test.ts` — add `describe('inputStore — duplicateDomain (DOMAIN-01)')` block with 6 test cases listed above
- [ ] No new test files required — extend existing `inputStore.test.ts`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — client-only SPA, no auth |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | no | no new user inputs in this phase |
| V6 Cryptography | no | `crypto.randomUUID()` is browser built-in, no hand-roll |

No security-specific concerns for this phase. The confirmation dialog takes no user text input. The domain clone operates only on in-memory store objects.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `window.confirm()` for destructive actions | Styled `ConfirmationDialog.vue` | Phase 19 (this phase) | Consistent UX; enables future reuse for domain delete |
| Immediate topology write on button click | Intercept + pending ref + dialog | Phase 19 (this phase) | Data safety guard per WIZARD-03 |
| No domain copy | `duplicateDomain()` store action | Phase 19 (this phase) | Reduces re-entry burden for similar domain profiles |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The topology guard triggers when "at least one workload domain has non-default data" — interpreted as: any field in `WorkloadDomainConfig` except `id`, `name`, `deploymentMode` differs from `createDefaultWorkloadDomain(0)` defaults | Architecture Patterns Pattern 1 | If the trigger condition is too sensitive (user sees dialog on fresh load after only changing host count), they may find it annoying. If too permissive, data is silently cleared. Consider: is `deploymentMode` the only field to skip, or should the guard check only "workload-meaningful" fields (vmCount, storageType, etc.)? |
| A2 | `duplicateDomain(id, newName)` parameterized API (caller computes name) is preferred over `duplicateDomain(id)` with hardcoded ` (copy)` suffix | i18n Keys section | Low risk — either approach works. Parameterized is cleaner for i18n but adds one parameter to the store action. |
| A3 | `ConfirmationDialog.vue` uses a `v-if` visible prop (not teleport to body) | Architecture Patterns Pattern 3 | The `z-50` fixed overlay approach works when no parent has `transform`, `filter`, or `will-change` CSS that would create a new stacking context. The current codebase uses none of these on ancestor elements. If a future phase adds transforms, the dialog may clip. Using `<Teleport to="body">` is safer long-term. |

---

## Open Questions

1. **Topology guard trigger condition: which field changes count?**
   - What we know: ROADMAP says "after configuring at least one workload domain" — this means any meaningful config change.
   - What's unclear: Should `hostCount` change alone trigger the guard? The current `hasNonDefaultData()` in DomainTabStrip skips only `id` and `name`. For the topology guard, should `deploymentMode` also be skipped (since that IS what we're changing)?
   - Recommendation: Skip `id`, `name`, AND `deploymentMode` in the topology guard's non-default check. A user who only changed `deploymentMode` via a prior topology selection (i.e., confirmed topology once already) should see the guard again if they try to change it.

2. **Wizard reset on topology confirm: reset to step 1 or stay on current step?**
   - What we know: ROADMAP criterion 3 says "wizard reset to step 1." This is explicit.
   - What's unclear: Should the left pane content also reset (clear management domain data)? ROADMAP says topology applied and wizard reset — it does NOT say clear management data.
   - Recommendation: Reset wizard step to 1 via `ui.setWizardStep(1)`. Do NOT clear management domain data. The user will reconfigure step 2 from the existing management domain values (they may be still valid for the new topology). Only `deploymentMode` changes on management + all workload domains.

3. **`<Teleport>` for ConfirmationDialog — use it or not?**
   - What we know: Vue 3 ships `<Teleport to="body">` for exactly this use case. Avoids stacking context issues.
   - What's unclear: Phase 18 UI spec did not use Teleport anywhere. Introducing it now adds a new pattern.
   - Recommendation: Use `<Teleport to="body">` for `ConfirmationDialog.vue`. It is the standard Vue 3 approach for modals. No new dependency — it's a Vue core primitive. [ASSUMED — not verified via Context7 but is well-known Vue 3 feature]

---

## Environment Availability

Step 2.6: SKIPPED — Phase 19 is pure Vue/TypeScript component and store additions with no external tool dependencies. All required primitives (`ref`, `toRaw`, `structuredClone`, `crypto.randomUUID`, Tailwind CSS, Vitest) are already available in the project environment.

---

## Sources

### Primary (HIGH confidence)
- `src/stores/inputStore.ts` — direct codebase inspection: existing action patterns, `workloadDomains` splice behavior
- `src/stores/uiStore.ts` — direct codebase inspection: `topologyConfirmed`, `confirmTopology()` already implemented
- `src/components/shared/TopologySelector.vue` — direct codebase inspection: current immediate-write pattern to be replaced
- `src/components/shared/DomainTabStrip.vue` — direct codebase inspection: `hasNonDefaultData`, delete button pattern, `@click.stop` usage
- `src/engine/types.ts` — direct codebase inspection: `WorkloadDomainConfig` 28 fields (26 config fields)
- `src/engine/defaults.ts` — direct codebase inspection: `createDefaultWorkloadDomain` factory function
- `.planning/STATE.md` — locked decisions: PITFALL-5 (topology capture pattern), `structuredClone(toRaw())` canonical clone
- `.planning/ROADMAP.md` — phase success criteria (canonical source of truth for acceptance conditions)
- `vitest.config.ts` — direct inspection: node environment, test file glob patterns

### Secondary (MEDIUM confidence)
- Vue 3 `toRaw()` API: strips reactive proxy from Pinia-managed objects — well-established Vue 3 composition API pattern; matches documented STATE.md decision [ASSUMED — consistent with training knowledge and STATE.md decision, not re-verified via Context7 in this session]

### Tertiary (LOW confidence)
- Pinia #1412 (`structuredClone` on reactive proxy): referenced in STATE.md as the reason for `toRaw()` requirement. Not independently verified against current Pinia 3.x changelog in this session. [ASSUMED — STATE.md documents this as a known bug]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all libraries verified in package.json
- Architecture: HIGH — patterns directly derived from existing codebase + locked STATE.md decisions
- Pitfalls: HIGH — most derived from existing code inspection and STATE.md explicitly documented pitfalls
- i18n key design: MEDIUM — key names and English values are recommendations; planner should confirm naming with project convention

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable Vue 3 / Pinia 3 — no imminent breaking changes expected)
