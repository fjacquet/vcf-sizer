# Phase 12: Domain Tab UI and Per-Domain Input Forms — Research

**Researched:** 2026-03-30
**Domain:** Vue 3 component architecture, custom tab UI, per-domain form wiring
**Confidence:** HIGH

---

## Summary

Phase 12 wires the store work from Phases 10-11 into a visible tab-based UI. The inputStore already exposes `workloadDomains`, `activeDomainIndex`, `addDomain()`, `removeDomain()`, and `updateDomain()`. All four input forms (`HostSpecsForm`, `WorkloadProfileForm`, `StorageConfigForm`, `DeploymentModelSelector`) currently use `storeToRefs(input)` against the old flat store shape — they must each be refactored to accept a `domainId: string` prop and read/write through `computed({ get, set })` that calls `updateDomain()`.

There is no third-party tab library in the project. HeadlessUI was explicitly rejected in project decisions. The correct approach is a custom ~50-line tab strip component using plain Tailwind v4 classes, driven by `inputStore.activeDomainIndex`. The `DeploymentModelSelector` component requires the most surgery: it references both per-domain fields (`deploymentMode`, `preferredSiteHosts`, `secondarySiteHosts`) and the global `managementArchitecture` field — the global field stays on `inputStore` directly; the per-domain fields move to `computed({ get, set })` via `domainId`. The `ManagementDomainHostForm` (new component) wires `managementDomain` fields similarly using `updateManagementDomain()` — a mutation not yet in the store.

**Primary recommendation:** Build in wave order: (1) add `renameDomain` and `updateManagementDomain` store mutations, (2) refactor 4 existing forms with `domainId` prop, (3) build `DomainTabStrip` component, (4) build `ManagementDomainHostForm`, (5) wire `App.vue`.

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Tab strip above input panel; clicking switches all forms to that domain | `activeDomainIndex` already in inputStore; DomainTabStrip component reads `workloadDomains` and `activeDomainIndex` |
| UI-02 | "Add Domain" button; new tab "WLD-N" with defaults | `addDomain()` already implemented in inputStore |
| UI-03 | Per-tab delete button; confirmation only for non-default data; last domain undeleteable | `removeDomain()` in inputStore; compare-to-defaults pattern described below |
| UI-04 | Double-click tab label for inline rename; blur/Enter commits, Escape cancels | `updateDomain(id, { name })` in inputStore; inline edit pattern described below |
| UI-05 | Management domain section outside tab strip | `managementDomain` ref exists; needs `updateManagementDomain()` mutation and `ManagementDomainHostForm` component |
| FORM-01 | `HostSpecsForm` accepts `domainId` prop, reads/writes per-domain | Refactor storeToRefs to computed({ get, set }) pattern |
| FORM-02 | `WorkloadProfileForm` accepts `domainId` prop, all VM fields per-domain | Same refactor pattern |
| FORM-03 | `StorageConfigForm` accepts `domainId` prop, all storage fields per-domain | Same refactor; storage capacity summary must read domain-specific `domainResults[i]` not deprecated flat `calc.storage` |
| FORM-04 | `DeploymentModelSelector` accepts `domainId` prop; `deploymentMode` and stretch fields per-domain | Most complex refactor; `managementArchitecture` stays global |
| FORM-05 | NVMe, GPU, vSAN Max are per-domain | Already inside HostSpecsForm and WorkloadProfileForm — covered by FORM-01/02/03 |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library — CALC-01.
- `calculationStore.ts` must never contain `ref()` — only `computed()` — CALC-02.
- Validation warnings must use i18n message keys, not English strings.
- `VueI18nPlugin` configured with `include` omitted intentionally — do not change this.
- Path alias: `@/` maps to `src/` in both `vite.config.ts` and `tsconfig.app.json`.
- Tests cover `src/engine/**/*.test.ts`, `src/composables/**/*.test.ts`, `src/stores/**/*.test.ts` only — no component tests with DOM environment.
- 58 pre-existing composable test failures (useMarkdownExport.test.ts: 35 failed, usePptxExport.test.ts: 23 failed) — do NOT fix in Phase 12. These are Phase 14 scope.

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.5.31 | Component framework | Project foundation |
| Pinia | ^3.0.4 | Store — inputStore already has all needed mutations | Project foundation |
| Tailwind CSS v4 | ^4.2.2 | Utility CSS via `@tailwindcss/vite` | Project foundation |
| vue-i18n | (installed) | All new UI labels need i18n keys | Project requirement |
| Vitest | ^4.1.2 | Unit tests — node env, no DOM | Project foundation |

**No new npm dependencies required for Phase 12.** `@vue/test-utils` is NOT installed and must not be added — the vitest config uses `environment: 'node'` (no DOM). Component behavior is tested via store logic only.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
src/
├── components/
│   ├── input/
│   │   ├── HostSpecsForm.vue          # ADD domainId prop, refactor storeToRefs
│   │   ├── WorkloadProfileForm.vue    # ADD domainId prop, refactor storeToRefs
│   │   ├── StorageConfigForm.vue      # ADD domainId prop, refactor storeToRefs
│   │   ├── DeploymentModelSelector.vue # ADD domainId prop, refactor storeToRefs
│   │   └── ManagementDomainHostForm.vue  # NEW — management domain specs only
│   └── shared/
│       └── DomainTabStrip.vue         # NEW — tab strip + add/delete/rename
├── stores/
│   └── inputStore.ts                  # ADD renameDomain() and updateManagementDomain()
└── App.vue                            # WIRE DomainTabStrip + ManagementDomainHostForm
```

### Pattern 1: Per-Domain Form Wiring with `computed({ get, set })`

**What:** Replace `storeToRefs(input)` flat refs with individual computed properties that read from `workloadDomains.find(d => d.id === domainId)` and write via `updateDomain()`.

**When to use:** Any form component that reads/writes workload domain fields.

**Example — HostSpecsForm.vue:**

```typescript
// BEFORE (flat storeToRefs — v2.x):
const { coresPerSocket, socketsPerHost, hostRamGB } = storeToRefs(input)

// AFTER (per-domain computed({ get, set })):
const props = defineProps<{ domainId: string }>()
const input = useInputStore()

function domainField<K extends keyof WorkloadDomainConfig>(key: K) {
  return computed({
    get: () => {
      const d = input.workloadDomains.find(d => d.id === props.domainId)
      return d ? d[key] : createDefaultWorkloadDomain(0)[key]
    },
    set: (val) => input.updateDomain(props.domainId, { [key]: val }),
  })
}

const coresPerSocket = domainField('coresPerSocket')
const socketsPerHost = domainField('socketsPerHost')
const hostRamGB = domainField('hostRamGB')
```

The helper `domainField()` avoids 26 individual computed declarations. The fallback to `createDefaultWorkloadDomain(0)[key]` prevents null-pointer errors if the domain is deleted and the component hasn't unmounted yet.

### Pattern 2: Accessing Per-Domain Calculation Results in Forms

**What:** Forms that show computed results (StorageConfigForm shows RAID scheme, capacity; DeploymentModelSelector shows stretch bandwidth) must now access `domainResults` array by domain index, not flat `calc.storage`.

**When to use:** Any form that reads a calculated value that is now per-domain.

**Example — StorageConfigForm accessing RAID scheme:**

```typescript
const calc = useCalculationStore()

const domainResult = computed(() =>
  calc.domainResults.find(r => r.id === props.domainId)
)

// Previously: storage.raidScheme
// Now:
const raidScheme = computed(() => domainResult.value?.storage.raidScheme ?? '—')
const storage = computed(() => domainResult.value?.storage)
const vsanMax = computed(() => domainResult.value?.vsanMax ?? null)
const validationErrors = computed(() =>
  domainResult.value?.validationErrors ?? []
)
```

**Note:** `calc.validationErrors` no longer exists as a top-level property after Phase 10. It is now per-domain inside `domainResults[i].validationErrors`. Forms must derive errors from the domain result, not from the store directly.

### Pattern 3: Custom Tab Strip Component

**What:** A self-contained `DomainTabStrip.vue` that renders tabs from `workloadDomains`, handles active state via `inputStore.activeDomainIndex`, and exposes Add/Delete/Rename interactions.

**When to use:** Placed in `App.vue` above the input form section.

**HTML/CSS pattern (Tailwind v4):**

```vue
<template>
  <div class="flex items-end gap-0 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
    <!-- Tab per domain -->
    <div
      v-for="(domain, index) in input.workloadDomains"
      :key="domain.id"
      :class="[
        'relative flex items-center gap-1 px-3 py-2 text-sm border-b-2 cursor-pointer select-none whitespace-nowrap',
        input.activeDomainIndex === index
          ? 'border-blue-600 text-blue-700 dark:text-blue-400 font-semibold bg-white dark:bg-gray-900'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300'
      ]"
      @click="input.activeDomainIndex = index"
    >
      <!-- Inline rename input (shown on double-click) -->
      <input
        v-if="renamingId === domain.id"
        ref="renameInputRef"
        :value="renameBuffer"
        class="w-20 text-sm border border-blue-400 rounded px-1 py-0.5 focus:outline-none bg-white dark:bg-gray-900"
        @input="renameBuffer = ($event.target as HTMLInputElement).value"
        @blur="commitRename(domain.id)"
        @keydown.enter.prevent="commitRename(domain.id)"
        @keydown.escape.prevent="cancelRename()"
      />
      <!-- Normal label (double-click to edit) -->
      <span
        v-else
        class="max-w-[8rem] truncate"
        @dblclick.stop="startRename(domain)"
      >
        {{ domain.name }}
      </span>
      <!-- Delete button — hidden when only 1 domain remains -->
      <button
        v-if="input.workloadDomains.length > 1"
        class="ml-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded focus:outline-none"
        :aria-label="`Remove ${domain.name}`"
        @click.stop="requestDelete(domain)"
      >
        ×
      </button>
    </div>
    <!-- Add Domain button -->
    <button
      class="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 whitespace-nowrap border-b-2 border-transparent"
      @click="input.addDomain()"
    >
      + {{ t('domain.addDomain') }}
    </button>
  </div>
</template>
```

**Key implementation details:**

- `v-for` must use `:key="domain.id"` (never array index) — locked decision.
- Delete button hidden when `workloadDomains.length === 1` (last domain cannot be deleted).
- `activeTabIndex` in inputStore is already named `activeDomainIndex` — use that directly.
- The tab strip does NOT need `@vue/test-utils` — its behavior is driven by store mutations already tested in `inputStore.test.ts`.

### Pattern 4: Inline Rename (Double-Click Tab Label)

**What:** Double-clicking a tab label shows an `<input>` field pre-filled with the domain name. Blur or Enter commits, Escape cancels.

**State:** Local to `DomainTabStrip.vue` — `renamingId: string | null` and `renameBuffer: string`.

**Pitfall:** After `renamingId` is set, the input must receive focus on the next tick. Use `nextTick(() => renameInputRef.value?.focus())`.

**Store action needed:** `renameDomain(id: string, name: string)` — calls `updateDomain(id, { name })`. This is a convenience wrapper that must be added to `inputStore.ts`.

```typescript
// In inputStore.ts — add to return:
function renameDomain(id: string, name: string) {
  const trimmed = name.trim()
  if (trimmed) updateDomain(id, { name: trimmed })
}
```

**Validation:** Empty string is rejected (trim + guard). Names are not forced unique — two domains can share a name (simpler UX, URL state stores name per domain).

### Pattern 5: Confirmation Dialog for Non-Default Data

**What:** Before deleting a domain, compare it to the output of `createDefaultWorkloadDomain(0)`. If any value differs (excluding `id` and `name` which are always different), show a native `window.confirm()` dialog. If the user cancels, abort deletion.

**Why native confirm:** No dialog library is installed. A native `confirm()` is sufficient for this use case and adds zero bundle weight. The project already uses `window.print()` for PDF export — same pragmatic pattern.

**Detection function (pure TypeScript, suitable for engine layer if needed, but can live in component):**

```typescript
import { createDefaultWorkloadDomain } from '@/engine/defaults'

function hasNonDefaultData(domain: WorkloadDomainConfig): boolean {
  const defaults = createDefaultWorkloadDomain(0)
  const skip = new Set<keyof WorkloadDomainConfig>(['id', 'name'])
  return (Object.keys(defaults) as Array<keyof WorkloadDomainConfig>)
    .filter(k => !skip.has(k))
    .some(k => domain[k] !== defaults[k])
}
```

**I18n key needed:** `domain.deleteConfirm` — value: `"Delete domain {name}? All configuration will be lost."`

### Pattern 6: Management Domain Host Form

**What:** A new `ManagementDomainHostForm.vue` component that renders sliders for `coresPerSocket`, `socketsPerHost`, `hostRamGB`, `hostStorageTB` reading from `inputStore.managementDomain`.

**What NOT to include:** `deploymentMode`, `storageType`, or any workload fields. The `managementArchitecture` toggle and its display logic stays in `DeploymentModelSelector.vue` since it is per-deployment (global), not per-domain.

**Store mutation needed:** `updateManagementDomain(patch: Partial<ManagementDomainConfig>)` — must be added to `inputStore.ts`.

```typescript
// In inputStore.ts — add to return:
function updateManagementDomain(patch: Partial<ManagementDomainConfig>) {
  Object.assign(managementDomain.value, patch)
}
```

**Component pattern:**

```typescript
const input = useInputStore()
const coresPerSocket = computed({
  get: () => input.managementDomain.coresPerSocket,
  set: (val) => input.updateManagementDomain({ coresPerSocket: val }),
})
// ... repeat for socketsPerHost, hostRamGB, hostStorageTB
```

### Pattern 7: App.vue Wiring

**What:** `App.vue` becomes the orchestrator. The active domain's `id` is derived from `workloadDomains[activeDomainIndex]?.id`. All four per-domain input forms receive this as `:domainId="activeDomainId"`.

```typescript
const input = useInputStore()
const activeDomainId = computed(
  () => input.workloadDomains[input.activeDomainIndex]?.id ?? input.workloadDomains[0].id
)
```

**Template structure (left pane):**

```
<DomainTabStrip />            <!-- tab strip with add/delete/rename -->
<!-- WORKLOAD DOMAIN FORMS (keyed by activeDomainId) -->
<DeploymentModelSelector :domainId="activeDomainId" />
<HostSpecsForm :domainId="activeDomainId" />
<WorkloadProfileForm :domainId="activeDomainId" />
<StorageConfigForm :domainId="activeDomainId" />
<!-- MANAGEMENT DOMAIN SECTION -->
<section>
  <h2>Management Domain</h2>
  <ManagementDomainHostForm />   <!-- reads managementDomain directly, no domainId prop -->
</section>
```

The `ManagementSummary.vue` (read-only overhead table) stays in its current location and requires no changes.

### Anti-Patterns to Avoid

- **`storeToRefs()` on flat store for per-domain fields:** These refs pointed at properties that no longer exist on the store's `$state`. All per-domain bindings must use `computed({ get, set })` with `findIndex`/`find` on `workloadDomains`.
- **`:key="index"` in v-for on domains:** Locked decision — always `:key="domain.id"`.
- **`@headlessui/vue` for tabs:** Explicitly rejected. Package is abandoned. Use custom implementation.
- **Serializing `activeDomainIndex` to URL:** Locked decision — it is ephemeral UI state only.
- **`calc.storage` or `calc.validationErrors` in forms:** These flat properties no longer exist after Phase 10. Access through `calc.domainResults.find(r => r.id === domainId)?.storage` etc.
- **`calc.stretch` in DeploymentModelSelector:** Same issue — now `calc.domainResults.find(...)?.stretch`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab library | Custom animation system | Custom static tab component | Project already decided — ~50 lines Tailwind classes suffice |
| Dialog/modal | Headless UI Modal | `window.confirm()` | No dialog lib installed; native confirm is adequate for delete confirmation |
| Deep object equality for defaults | Custom deep-equal utility | Field-by-field comparison against `createDefaultWorkloadDomain()` | The defaults factory already exists; compare key-by-key, skip `id` and `name` |
| Reactive domain slot | Per-form Pinia sub-stores | `computed({ get, set })` with `updateDomain()` | Pinia pattern for derived reactive state from array item |

---

## Common Pitfalls

### Pitfall 1: `calc.validationErrors` / `calc.storage` no longer exist

**What goes wrong:** Forms reference flat computed properties removed in Phase 10.
**Why it happens:** `calculationStore` now returns `{ management, domainResults, aggregateTotals, dedicatedMgmtHostCount }` only. The old flat `storage`, `stretch`, `vsanMax`, `validationErrors` computed properties are gone.
**How to avoid:** All form components must use `calc.domainResults.find(r => r.id === props.domainId)` to access per-domain results. Build a local `const domainResult = computed(() => calc.domainResults.find(r => r.id === props.domainId))` at the top of each form's script setup.
**Warning signs:** TypeScript compile error "Property 'validationErrors' does not exist on type ReturnType<useCalculationStore>".

### Pitfall 2: Domain deleted while form still mounted

**What goes wrong:** `workloadDomains.find(d => d.id === props.domainId)` returns `undefined` during the tick between domain removal and component unmount.
**Why it happens:** Vue unmounts on next tick after array mutation; the computed runs during the same tick.
**How to avoid:** All `domainField()` helpers must include a null-guard fallback (e.g., return `createDefaultWorkloadDomain(0)[key]` when domain not found). `domainResult` computed must also gracefully handle `undefined`.
**Warning signs:** Runtime TypeError "Cannot read properties of undefined".

### Pitfall 3: Rename input focus not set on mount

**What goes wrong:** `renamingId` is set but the `<input>` element doesn't receive focus.
**Why it happens:** When a ref is conditionally rendered via `v-if`, it is not in the DOM yet when the reactive state change occurs.
**How to avoid:** Use `nextTick(() => renameInputRef.value?.focus())` after setting `renamingId`.
**Warning signs:** Input renders but is not focused; user must click manually.

### Pitfall 4: `storeToRefs()` double-wrap with `ref<WorkloadDomainConfig[]>`

**What goes wrong:** `storeToRefs(input).workloadDomains` returns a `Ref<WorkloadDomainConfig[]>` — modifying `.value[i].field` works, but calling `storeToRefs` on individual domain fields (which don't exist as top-level store refs) produces undefined refs.
**Why it happens:** Phase 10 decision: "inputStore uses ref<WorkloadDomainConfig[]> NOT reactive([]) to avoid storeToRefs() double-wrap bug". Individual domain field access requires array lookup, not storeToRefs.
**How to avoid:** Never call `storeToRefs` expecting per-domain fields. Use the `domainField()` helper pattern with `computed({ get, set })`.

### Pitfall 5: Management architecture toggle in wrong component

**What goes wrong:** `managementArchitecture` is moved to per-domain scope accidentally.
**Why it happens:** It's currently in `DeploymentModelSelector` which is being refactored to accept `domainId`.
**How to avoid:** Keep `managementArchitecture` as a direct storeToRef binding in `DeploymentModelSelector` — it reads `input.managementArchitecture` directly, not through `domainField()`. Per locked decision: "managementArchitecture remains a global field on inputStore".

### Pitfall 6: `activeDomainIndex` out of bounds after deletion

**What goes wrong:** Removing the last domain tab leaves `activeDomainIndex` pointing to index N where N >= `workloadDomains.length`.
**Why it happens:** User deletes domain at the highest index.
**How to avoid:** `removeDomain()` in inputStore already handles this: `activeDomainIndex.value = Math.min(activeDomainIndex.value, workloadDomains.value.length - 1)`. Do not bypass this via direct array manipulation.

### Pitfall 7: `DeploymentModelSelector` stretch bandwidth computed reads old flat `calc.stretch`

**What goes wrong:** `stretch.value` is undefined (flat computed removed), causing null-pointer in bandwidth display.
**Why it happens:** Component previously used `const { stretch } = storeToRefs(calc)` — `calc.stretch` no longer exists.
**How to avoid:** Derive from `domainResult.value?.stretch` — same pattern as all other per-domain results.

---

## Code Examples

### Full `domainField()` helper pattern

```typescript
// Source: project pattern derived from Phase 10 store contract
import type { WorkloadDomainConfig } from '@/engine/types'
import { createDefaultWorkloadDomain } from '@/engine/defaults'
import { computed } from 'vue'
import { useInputStore } from '@/stores/inputStore'

const props = defineProps<{ domainId: string }>()
const input = useInputStore()

function domainField<K extends keyof WorkloadDomainConfig>(key: K) {
  return computed({
    get: () => {
      const d = input.workloadDomains.find(d => d.id === props.domainId)
      return (d ?? createDefaultWorkloadDomain(0))[key]
    },
    set: (val: WorkloadDomainConfig[K]) => input.updateDomain(props.domainId, { [key]: val } as Partial<WorkloadDomainConfig>),
  })
}
```

### Per-domain calc result access

```typescript
// Source: calculationStore.ts domainResults shape
const calc = useCalculationStore()
const domainResult = computed(() =>
  calc.domainResults.find(r => r.id === props.domainId)
)
const validationErrors = computed(() => domainResult.value?.validationErrors ?? [])
const storage = computed(() => domainResult.value?.storage)
const stretch = computed(() => domainResult.value?.stretch ?? null)
const vsanMax = computed(() => domainResult.value?.vsanMax ?? null)
```

### Inline rename state (local to DomainTabStrip)

```typescript
import { ref, nextTick } from 'vue'
import type { WorkloadDomainConfig } from '@/engine/types'

const renamingId = ref<string | null>(null)
const renameBuffer = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function startRename(domain: WorkloadDomainConfig) {
  renamingId.value = domain.id
  renameBuffer.value = domain.name
  nextTick(() => renameInputRef.value?.focus())
}

function commitRename(id: string) {
  const trimmed = renameBuffer.value.trim()
  if (trimmed) input.updateDomain(id, { name: trimmed })
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}
```

### Store mutations to add (inputStore.ts)

```typescript
// Add to inputStore return — these two are missing from current implementation
function renameDomain(id: string, name: string) {
  const trimmed = name.trim()
  if (trimmed) updateDomain(id, { name: trimmed })
}

function updateManagementDomain(patch: Partial<ManagementDomainConfig>) {
  Object.assign(managementDomain.value, patch)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `storeToRefs(input)` bindings in forms | `computed({ get, set })` via `domainId` prop | Phase 12 | All 4 forms must be refactored |
| `calc.storage`, `calc.stretch`, `calc.validationErrors` flat computed | `calc.domainResults[i].storage/.stretch/.validationErrors` | Phase 10 | All forms reading calc results must update |
| `inputStore` flat scalar fields | `workloadDomains: ref<WorkloadDomainConfig[]>` + `managementDomain: ref<ManagementDomainConfig>` | Phase 10 | Store contract fully changed |
| No active tab concept | `activeDomainIndex: ref(0)` in inputStore | Phase 10 | Tab strip reads this; App.vue derives `activeDomainId` |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 12 is purely frontend component changes. No new external tools, services, CLIs, databases, or runtimes required beyond the existing `npm run dev` / `npm run build` / `npm run test` stack.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/stores/inputStore.test.ts` |
| Full suite command | `npm run test` |

### Critical Constraint: No DOM Tests for Components

`@vue/test-utils` is NOT installed. `vitest.config.ts` sets `environment: 'node'`. Component `.vue` files cannot be mounted in tests. This is by design (CLAUDE.md: "Tests cover `src/engine/**/*.test.ts` and `src/composables/**/*.test.ts` only — no DOM environment needed").

Phase 12 component behavior is validated through:

1. **Store tests** — `inputStore.test.ts` already covers `addDomain`, `removeDomain`, `updateDomain`, `activeDomainIndex`. New mutations (`renameDomain`, `updateManagementDomain`) must have unit tests added.
2. **Build verification** — `npm run build` (vue-tsc type-check) catches prop type mismatches, missing computed properties, and TypeScript errors in all `.vue` files.
3. **Manual browser testing** — Tab strip interactions, inline rename, confirmation dialog.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | activeDomainIndex switches on tab click | unit (store mutation) | `npx vitest run src/stores/inputStore.test.ts` | ✅ |
| UI-02 | addDomain() appends + activates new tab | unit (store mutation) | `npx vitest run src/stores/inputStore.test.ts` | ✅ |
| UI-03 | removeDomain() guards last domain | unit (store mutation) | `npx vitest run src/stores/inputStore.test.ts` | ✅ |
| UI-04 | renameDomain() commits trimmed name | unit (store mutation) | `npx vitest run src/stores/inputStore.test.ts` | ❌ Wave 0 — add test for `renameDomain` |
| UI-05 | updateManagementDomain() patches fields | unit (store mutation) | `npx vitest run src/stores/inputStore.test.ts` | ❌ Wave 0 — add test for `updateManagementDomain` |
| FORM-01..05 | Forms read per-domain values and write via updateDomain | build check (vue-tsc) | `npm run type-check` | N/A — no DOM env |
| FORM-01..05 | Type safety of domainId prop contract | build check | `npm run build` | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run src/stores/inputStore.test.ts`
- **Per wave merge:** `npm run test` (full suite — ignore 58 pre-existing composable failures)
- **Phase gate:** `npm run build` green (type-check passes) AND `npm run test` shows no NEW failures beyond the pre-existing 58

### Wave 0 Gaps

- [ ] `src/stores/inputStore.test.ts` — add `renameDomain()` tests (covers UI-04)
- [ ] `src/stores/inputStore.test.ts` — add `updateManagementDomain()` tests (covers UI-05)
- [ ] `src/stores/inputStore.ts` — add `renameDomain` and `updateManagementDomain` mutations before any component work begins

---

## Build Order for Phase 12

The correct wave order minimizes broken intermediate states:

**Wave 0 (TDD setup):** Add `renameDomain()` and `updateManagementDomain()` to `inputStore.ts`. Write failing tests for both. Then make them pass.

**Wave 1 (Form refactoring):** Refactor all 4 existing input forms to accept `domainId` prop and use `computed({ get, set })` + `domainResult` pattern. This is the largest body of work. After this wave, `npm run build` must pass with zero type errors. The forms are NOT yet connected to any tab UI — they can be temporarily tested by hardcoding `workloadDomains[0].id` in App.vue.

**Wave 2 (DomainTabStrip + ManagementDomainHostForm):** Build `DomainTabStrip.vue` (tab strip with add/delete/rename). Build `ManagementDomainHostForm.vue` (management host specs sliders).

**Wave 3 (App.vue wiring + i18n):** Wire `DomainTabStrip` and `ManagementDomainHostForm` into `App.vue`. Add all new i18n keys to all 4 locale files (`en.json`, `fr.json`, `de.json`, `it.json`). Final `npm run build` + `npm run test` gate.

---

## New i18n Keys Required

All new keys must be added to all 4 locale files simultaneously (i18n rule from CLAUDE.md). Suggested key names:

```json
{
  "domain": {
    "addDomain": "Add Domain",
    "deleteConfirm": "Delete domain \"{name}\"? All configuration will be lost.",
    "managementSection": "Management Domain",
    "managementHostSpecs": "Management Host Specifications"
  }
}
```

Swiss locales (`fr.json`, `de.json`, `it.json`) must include translated values — no English fallbacks left in non-English locales.

---

## Open Questions

1. **Should `DeploymentModelSelector` show the management architecture toggle when `domainId` is active?**
   - What we know: `managementArchitecture` is global; `deploymentMode` is per-domain. The toggle visibility is currently gated on `deploymentMode !== 'simple'`. With per-domain `deploymentMode`, each domain's toggle should control whether the global mgmt arch option is shown.
   - What's unclear: If domain A is HA and domain B is Simple, should the architecture toggle be shown? It's a global setting, so the answer is "show it if ANY domain is non-simple" OR "show it always in the management section".
   - Recommendation: Move architecture toggle out of `DeploymentModelSelector` entirely and into the Management Domain section (UI-05 scope). Simpler UX — management settings live together.

2. **`renameInputRef` and `v-if` scoping in DomainTabStrip**
   - What we know: `v-if="renamingId === domain.id"` renders a different element per tab; `ref="renameInputRef"` in a v-for loop would need special handling.
   - What's unclear: Template refs in v-for return an array; need to target the correct element.
   - Recommendation: Use a callback ref or a map of `Map<string, HTMLInputElement>` rather than a single `ref`. Alternatively, use `renameInputRef.value[index]` with `:ref="el => setRenameRef(domain.id, el)"`.

---

## Sources

### Primary (HIGH confidence)

- `src/stores/inputStore.ts` — actual store API: `addDomain`, `removeDomain`, `updateDomain`, `activeDomainIndex`
- `src/stores/calculationStore.ts` — confirmed `domainResults` is the only array computed; no flat `storage`/`stretch`/`validationErrors` top-level properties
- `src/engine/types.ts` — `WorkloadDomainConfig` (26 fields), `ManagementDomainConfig` (4 fields), `DomainResult`
- `src/engine/defaults.ts` — `createDefaultWorkloadDomain()` and `createDefaultManagementDomain()` factory functions
- `src/components/input/*.vue` — current `storeToRefs` binding patterns that must be refactored
- `.planning/STATE.md` v3.0 decisions — locked decisions: no headlessui, key=domain.id, activeTabIndex ephemeral

### Secondary (MEDIUM confidence)

- Tailwind v4 class patterns — verified from existing components and `style.css` (`@import "tailwindcss"` with `@tailwindcss/vite`)
- Vue 3 `computed({ get, set })` pattern — standard Vue 3 API, confirmed present in project's vue ^3.5.31
- `nextTick` for focus-after-render — standard Vue 3 pattern

### Tertiary (LOW confidence — needs manual verification)

- i18n key naming conventions for new `domain.*` namespace — consistent with existing flat naming (`storage.vsanMaxProfile` pattern), but requires checking all 4 locale files during implementation

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries are already installed; no new deps
- Architecture patterns: HIGH — derived from actual source files, not assumptions
- Pitfalls: HIGH — derived from reading actual store and component code, not speculation
- Build order: HIGH — derived from dependency graph of what breaks what

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable Tailwind v4 + Vue 3 patterns; store contract locked by Phases 10-11)
