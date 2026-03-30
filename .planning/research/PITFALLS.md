# Domain Pitfalls

**Domain:** VCF 9.x Client-Side Sizing Calculator SPA — v3.0 Multi-Domain Array Milestone
**Researched:** 2026-03-30
**Confidence:** HIGH for pitfalls verified against official docs or confirmed GitHub issues; MEDIUM for pitfalls backed by multiple community sources; LOW where flagged

---

## Scope: v3.0 Multi-Workload-Domain Arrays

This document covers pitfalls specific to adding multi-domain array state to the existing Vue 3 + Pinia 3 + Zod 4 SPA. The existing system has a flat `inputStore` of scalar `ref()` values, a computed-only `calculationStore`, and a Zod schema that maps 1:1 to those scalars. The v3.0 milestone replaces the flat workload inputs with `workloadDomains: Array<WorkloadDomainConfig>`, adds management domain host independence, and introduces a tab UI for dynamic add/remove.

Four categories of pitfalls are addressed:
1. Pinia reactive arrays and `computed()` mapping
2. Zod array schemas in URL state (lz-string)
3. Vue 3 tab UI with dynamic add/remove
4. Test migration during major store refactor

---

## Critical Pitfalls

### Pitfall P1-1: Replacing a Pinia `ref([])` Array Reference Breaks Downstream `computed()` Tracking

**What goes wrong:**
When `workloadDomains` is stored as `ref<WorkloadDomainConfig[]>([])` in the setup-style inputStore and a component or action assigns a whole new array (`store.workloadDomains = newArray`), `computed()` properties in `calculationStore` that read `input.workloadDomains` re-evaluate correctly for that one assignment. However, if the new array is itself reactive (e.g. came from `reactive([])` rather than a plain array), subsequent `.push()` or `.splice()` mutations on the new array may not trigger the computed. The invariant to maintain: always assign a plain JavaScript array (or use `.splice(0, domains.length, ...newDomains)` to mutate in place) rather than constructing a `reactive([])` and swapping references.

**Why it happens:**
Pinia wraps the entire store with `reactive()`. A `ref([])` inside that store is unwrapped, so accessing `store.workloadDomains` gives the inner array directly. Replacing it with another `reactive([])` creates a double-proxy situation where mutation tracking can fail.

**Consequences:**
- `calculationStore.domainResults` (the computed array mapping over domains) silently returns stale data
- UI does not update when domains are added/removed programmatically (e.g. after hydration from URL)
- No runtime error; bug is invisible

**Prevention:**
- Declare `const workloadDomains = ref<WorkloadDomainConfig[]>([])` using `ref`, not `reactive`
- Never assign `store.workloadDomains = reactive([...])` — assign plain arrays only
- For bulk replacement (e.g. URL hydration): use `store.workloadDomains = [...parsedDomains]` (spread into new plain array)
- For mutations: use `.push()`, `.splice()`, `.pop()` directly on `store.workloadDomains` — these are all tracked by Vue 3's Proxy-based reactivity

**Detection:**
- After URL hydration, calculationStore results do not update until a manual slider change
- Vitest: `store.workloadDomains.push(domain)` followed by reading a computed returns unchanged output

**Phase to address:** Phase 1 (inputStore migration) — establish the mutation pattern before any computed() reads the array.

**Sources:** [Pinia State docs](https://pinia.vuejs.org/core-concepts/state.html); [Ref vs Reactive in Stores — Mastering Pinia](https://masteringpinia.com/blog/ref-vs-reactive-in-stores); [Pinia Discussion #1448](https://github.com/vuejs/pinia/discussions/1448) — MEDIUM confidence (verified against multiple sources)

---

### Pitfall P1-2: `computed()` Inside `calculationStore` Must Call `useInputStore()` At Top Level, Not Inside the Map Callback

**What goes wrong:**
The existing `calculationStore` already demonstrates the correct pattern — `const input = useInputStore()` is called once at the top of the store function. When adding a computed that maps over `input.workloadDomains`, there is a temptation to call engine functions inside the `.map()` callback by dereferencing nested properties of each domain. This is safe. What is NOT safe is calling `useInputStore()` or any other composable inside the `.map()` callback.

**Why it happens:**
Vue's `getCurrentInstance()` context (required for composable calls) is only available synchronously at the top of a setup function or store factory. Calling `useInputStore()` inside a `.map()` callback — which runs lazily when the computed is first accessed — throws a "getCurrentInstance() was called outside of setup" error in production, even though it may work in some test environments.

**Consequences:**
- Runtime error in production builds
- Silent pass in unit tests where Pinia is initialized globally

**Prevention:**
```typescript
// CORRECT — useInputStore() at top level of store factory
export const useCalculationStore = defineStore('calculation', () => {
  const input = useInputStore()

  const domainResults = computed(() =>
    input.workloadDomains.map(domain =>
      calcCompute({ ...domain })     // pure engine call — fine inside map
    )
  )
  return { domainResults }
})

// WRONG — calling useInputStore() inside computed callback
const domainResults = computed(() =>
  useInputStore().workloadDomains.map(...)  // throws outside setup context
)
```

**Detection:**
- "getCurrentInstance() was called outside of setup" console error on first computed access
- Works in Vitest because test setup creates a Pinia instance early; fails in browser

**Phase to address:** Phase 2 (calculationStore mapping). The CALC-02 constraint (zero `ref()` in calculationStore) is unchanged; this pitfall is about composable call location.

**Sources:** [Vue.js Computed Properties — Official Docs](https://vuejs.org/guide/essentials/computed.html); existing `calculationStore.ts` comment "call useInputStore() at TOP LEVEL — not inside computed() (Pinia pattern)" — HIGH confidence (verified in existing codebase)

---

### Pitfall P1-3: Mutating Array Items In-Place Does Not Trigger `computed()` Reactivity Without Deep Tracking

**What goes wrong:**
With `workloadDomains = ref<WorkloadDomainConfig[]>([])`, mutating a nested property of an existing item — e.g. `store.workloadDomains[0].vmCount = 200` — DOES trigger reactivity in Vue 3 because `ref([...])` creates a deep reactive proxy. This is the correct behavior and is safe.

The pitfall is the reverse: developers sometimes assume deep mutation tracking means they can safely write `store.workloadDomains[0] = { ...domain, vmCount: 200 }` (item replacement by index). Index-assignment on a `ref([])` array IS tracked by Vue 3's Proxy (unlike Vue 2), but only if the assignment goes through the store's reactive proxy, not through a destructured reference.

**Why it happens:**
`const { workloadDomains } = storeToRefs(inputStore)` creates a ref wrapping. Reading `workloadDomains.value[0].vmCount = 200` is tracked. But `const domains = inputStore.workloadDomains` (non-destructured, non-storeToRefs) gives the raw array proxy — mutations work. The trap is calling `storeToRefs()` and then trying to push to the `.value` array vs. pushing directly on the store property.

**Prevention:**
- In components: always access through the store directly (`inputStore.workloadDomains.push(...)`) or through `storeToRefs` consistently — do not mix patterns
- In `useUrlState.ts` hydration: assign the whole array at once after Zod parsing, not field-by-field with index access in a loop

**Phase to address:** Phase 1 (inputStore) and Phase 3 (URL state hydration).

**Sources:** [Pinia Discussion #1448](https://github.com/vuejs/pinia/discussions/1448); [storeToRefs API](https://pinia.vuejs.org/api/pinia/functions/storeToRefs.html) — MEDIUM confidence

---

### Pitfall P2-1: Zod v4 `.default([])` Combined With `.min(1)` Does Not Enforce Minimum When Field Is Absent

**What goes wrong:**
With Zod v4 (this project uses `"zod": "^4.3.6"`), the schema:
```typescript
workloadDomains: z.array(WorkloadDomainSchema).min(1).default([])
```
does NOT reject `undefined` input with a "minimum 1 item" error. When the field is absent from the URL payload, Zod v4 applies the default (`[]`) and skips subsequent refinements including `.min(1)`. The result is a valid parse result containing an empty domain array, which will then crash calculationStore when it tries to map over zero domains and render tab UI.

**Why it happens:**
Zod v4 changed the semantics of `.default()`: the default value is treated as "valid by definition" and bypasses further validation constraints. This is confirmed in GitHub issues #5525 (Dec 2025) and #4544 (May 2025).

**Consequences:**
- URL payloads from v2.x (which have no `workloadDomains` key) parse successfully but produce an empty array, crashing the tab UI on hydration
- Forward-compatibility edge: a future v3.5 app that omits the domain array falls back to empty instead of injecting the default domain

**Prevention:**
Use `.default()` with a factory that produces at least one domain, not an empty array:
```typescript
workloadDomains: z.array(WorkloadDomainSchema).default(() => [defaultWorkloadDomain()])
```
And separately validate minimum count with `.refine()` if needed:
```typescript
workloadDomains: z.array(WorkloadDomainSchema)
  .default(() => [defaultWorkloadDomain()])
  .refine(arr => arr.length >= 1, { message: 'At least one domain required' })
```
The refine runs AFTER the default is applied in Zod v4, so this correctly catches an explicit `[]` sent in the URL.

**Also:** The existing `.strip()` on the top-level schema discards unknown keys from v2.x payloads. Domains parsed from v2.x URLs will have no `workloadDomains` key, so the `.default()` factory fires — which is the correct upgrade path.

**Phase to address:** Phase 3 (URL state Zod schema migration). Write a failing test first: parse `{}` (empty URL state) and assert exactly one domain is created.

**Sources:** [Zod v4 Issue #5525](https://github.com/colinhacks/zod/issues/5525); [Zod v4 Issue #4544](https://github.com/colinhacks/zod/issues/4544) — HIGH confidence (confirmed by GitHub issues with version-specific behavior)

---

### Pitfall P2-2: Multi-Domain URL Payload Grows Superlinearly — URL Length Budget Is Tight

**What goes wrong:**
The existing URL param (`?c=...`) for the v2.x flat state compresses to roughly 200 chars for a default state payload. With N workload domains, each domain has ~12 fields (vmCount, avgVcpuPerVm, avgVramGbPerVm, avgStorageGbPerVm, cpuOvercommitRatio, ramOvercommitRatio, storageType, fttLevel, raidType, dedupEnabled, dedupRatio, nvmeTieringEnabled, gpuVmCount, vgpuMemoryGB, deploymentMode, hostSpecs...). A 5-domain config serializes to approximately 2,000–3,000 JSON chars before compression. After lz-string compression, the encoded string will likely be 800–1,200 chars. Total URL with base stays within Chrome's practical limit (~2 MB) but may exceed the 2,048-char limit enforced by some enterprise proxies and URL shorteners.

The existing test in `useUrlState.test.ts` asserts `urlParam.length < 1800` for the v2.x single-domain state. That test will need updating and a new multi-domain URL length test should be added.

**Why it happens:**
lz-string compresses well for repetitive JSON but domain arrays with mixed numeric and string values do not compress as efficiently as pure numeric streams. Worst case: N domains each with unique string names and varied enum values.

**Consequences:**
- Share URLs for large (5+ domain) configs may be rejected by corporate email clients and link shorteners
- Enterprise proxy URL-length enforcement (often 2,048 chars) silently truncates the URL, producing a decompression failure on load

**Prevention:**
- Measure: add a Vitest test that generates a 5-domain config and asserts URL length stays under 2,048 chars
- If the 2,048 limit is regularly exceeded: omit defaulted fields from the serialized payload (only write fields that differ from their defaults). This is a significant saving for large arrays where most domains use default host specs
- Set a user-facing domain count limit (e.g., 10) not just for UI clarity but as a URL-safety guarantee

**Phase to address:** Phase 3 (URL state). Add the URL length test before the schema migration is considered done.

**Sources:** [Maximum URL lengths — Baeldung](https://www.baeldung.com/cs/max-url-length); existing `useUrlState.test.ts` line 96–101 — MEDIUM confidence

---

### Pitfall P2-3: URL State Schema Duplication Between `useUrlState.ts` and Its Test File Creates Silent Drift

**What goes wrong:**
The current `useUrlState.test.ts` at lines 9–34 contains a full copy of `InputStateSchema`. This was annotated "Replicated schema (must stay in sync with useUrlState.ts)". With v3.0, the `WorkloadDomainSchema` and the top-level schema both need to be kept in sync across `useUrlState.ts` and `useUrlState.test.ts`. Every time a domain field is added or renamed, the test file copy must be updated manually.

**Why it happens:**
The test file cannot import the schema from `useUrlState.ts` without pulling in the full composable (which depends on `window`, Pinia, and LZString — incompatible with pure unit test environment). The current workaround is copying the schema.

**Prevention:**
Extract the Zod schemas (`InputStateSchema`, `WorkloadDomainSchema`) into a separate file `src/composables/urlStateSchema.ts` that has zero browser API or Pinia dependencies. Both `useUrlState.ts` and `useUrlState.test.ts` import from this single schema file. This is the atomic "schema + hydrate + serialize" triple-sync that already exists — it just needs the schema separated into its own module.

**Phase to address:** Phase 3 (URL state migration). Refactor the schema extraction as the first task.

**Sources:** Existing `useUrlState.test.ts` comment line 9; architectural pattern in CLAUDE.md "URL state: atomic Zod triple-sync (schema + hydrate + serialize)" — HIGH confidence (derived from codebase)

---

### Pitfall P3-1: Using Array Index as `v-for` Key Causes Stale Component State After Domain Reorder or Delete

**What goes wrong:**
```html
<!-- WRONG -->
<DomainTab v-for="(domain, index) in domains" :key="index" :domain="domain" />
```
When a domain at index 0 is deleted and the array shifts, Vue reuses the existing DOM node (keyed `0`) for what is now the second domain. Any local component state (input focus, unsaved text, toggle animation) from the deleted domain bleeds into the component that is now at index 0.

**Why it happens:**
Vue's Virtual DOM diffing algorithm uses the `:key` to determine which DOM nodes are equivalent. Index keys are position-based, not identity-based. When the array shifts, the key `0` still maps to the DOM node that held the old domain — Vue patches the props but preserves local state.

**Consequences:**
- After deleting "Domain A" (index 0), the remaining domain shows Domain A's input validation state or focus
- After reordering domains via drag-and-drop, form inputs show values from the previous occupant

**Prevention:**
Use a stable unique ID as the key:
```html
<DomainTab v-for="domain in domains" :key="domain.id" :domainId="domain.id" />
```
Generate IDs with a counter or `crypto.randomUUID()` at domain creation time. Store the ID as part of `WorkloadDomainConfig.id`. The Zod schema must include `id: z.string().uuid()` (with `.default(() => crypto.randomUUID())` so old URLs with no ID still get fresh IDs on hydration).

**Phase to address:** Phase 1 (WorkloadDomainConfig type definition) — the `id` field must be part of the type from the start, not retrofitted.

**Sources:** [Vue School — Tips and Gotchas for v-for key](https://vueschool.io/articles/vuejs-tutorials/tips-and-gotchas-for-using-key-with-v-for-in-vue-js-3/); [DeepSource — key attribute Vue.js](https://deepsource.com/blog/key-attribute-vue-js) — HIGH confidence (well-documented Vue behavior)

---

### Pitfall P3-2: `activeTabIndex` Becomes Out of Bounds After Domain Deletion Without Guard

**What goes wrong:**
The UI maintains `activeTabIndex` as the currently selected tab. If the user deletes domain at index 2 and there are only 3 domains (indices 0, 1, 2), `activeTabIndex` remains `2` but the array now only has indices 0 and 1. The tab UI renders nothing (or crashes with "Cannot read property 'name' of undefined").

**Why it happens:**
The index is not automatically adjusted by Vue or Pinia when the underlying array shrinks. It must be clamped after every delete operation.

**Consequences:**
- Blank tab panel after deleting the last tab
- `domain.name` access on undefined crashes the component

**Prevention:**
After every domain deletion, clamp `activeTabIndex`:
```typescript
function removeDomain(index: number) {
  store.workloadDomains.splice(index, 1)
  if (activeTabIndex.value >= store.workloadDomains.length) {
    activeTabIndex.value = Math.max(0, store.workloadDomains.length - 1)
  }
}
```
If `activeTabIndex` lives in the store, this logic belongs in the store action. If it is local component state (`ref(0)`), the clamp must be in the component's delete handler.

**Where to track `activeTabIndex`:** Keep it in a component `ref()` rather than the inputStore. It is transient UI state — it does not need to survive URL round-trips or hydration. (Only include it in URL state if the product spec explicitly requires preserving the active tab on share.)

**Phase to address:** Phase 4 (tab UI component). Write a unit test: "after deleting the last domain, activeTabIndex equals 0."

**Sources:** Community consensus; no official Vue source for this since it is application-level logic — MEDIUM confidence

---

### Pitfall P3-3: `<KeepAlive>` on Tab Panels With Domain-Specific Forms Causes Stale Data

**What goes wrong:**
Using `<KeepAlive>` to preserve tab panel DOM across tab switches is tempting for performance. However, when a domain is deleted and a new domain is created at the same position, the cached component instance retains the previous domain's local state (unsaved input values, local `ref()` variables not bound to the store).

**Why it happens:**
`<KeepAlive>` caches by component type (and `:key` if provided). If the `:key` is the domain's stable ID (see P3-1), then deleting a domain and creating a new one with a different ID will create a fresh component — no stale state. But if `:key` is omitted or uses index, the cache will serve the old instance.

**Prevention:**
If using `<KeepAlive>` on tab panels, ALWAYS pair with `:key="domain.id"` on the component inside the `<KeepAlive>`. This forces a fresh instance for each unique domain ID, eliminating stale data. If unsure, omit `<KeepAlive>` entirely — the performance difference for 1–10 domain tabs is negligible.

**Phase to address:** Phase 4 (tab UI). Default to no `<KeepAlive>` unless profiling shows measurable remounting overhead.

**Sources:** [Vue.js KeepAlive official docs](https://vuejs.org/guide/built-ins/keep-alive.html); [Creating Dynamic Tabs in Vue.js with KeepAlive — DEV Community](https://dev.to/webcraft-notes/creating-dynamic-tabs-in-vuejs-with-server-data-and-the-keepalive-component-268j) — HIGH confidence (official Vue docs)

---

## Moderate Pitfalls

### Pitfall P4-1: Vitest Tests for Engine Functions Break During Store Migration Due to Changed Import Paths, Not Logic

**What goes wrong:**
The 182 existing Vitest tests cover `src/engine/*.ts` directly. They import engine functions by path and pass typed inputs manually. This is the correct pattern for engine tests and means they are NOT affected by Pinia store changes. However, the test files for `useUrlState.ts` (which imports `useInputStore`) and `usePptxExport.ts` (which reads from stores) will need updating.

The risk is developers delete engine tests when refactoring the store, thinking they are "store tests." They are not — they are pure-function tests that remain valid even after the entire store shape changes.

**Prevention:**
- Engine tests (`src/engine/*.test.ts`): DO NOT modify these during store migration. They test pure functions that are unchanged.
- `useUrlState.test.ts`: will need the schema expanded for domains and a new `defaultDomain` fixture
- `usePptxExport.test.ts` / `useMarkdownExport.test.ts`: will need domain-array fixtures added
- Add new test files for domain-specific scenarios BEFORE implementation (TDD/Wave 0 pattern already established)
- Run `npm test` after every phase to verify the 182 baseline tests still pass

**Phase to address:** All phases. Establish the "green baseline check" discipline: run `npm test` before starting each task.

**Sources:** CLAUDE.md (project) — "TDD discipline: failing tests before implementation throughout (Wave 0 pattern)"; existing test architecture — HIGH confidence (derived from codebase)

---

### Pitfall P4-2: The Replicated Schema in `useUrlState.test.ts` Will Silently Diverge During Domain Field Additions

**What goes wrong:**
(Cross-reference with P2-3.) If domain fields are added to `WorkloadDomainSchema` but the test file's replica is not updated, the tests continue passing against the old schema while the production code validates against the new schema. New fields will be stripped by the old schema during test round-trips but preserved in production.

**Prevention:**
Execute the schema extraction (P2-3) in Phase 3 before writing any domain tests. Once the schema is in `urlStateSchema.ts`, both production and test import the same definition — drift is impossible.

**Phase to address:** Phase 3 (URL state) — first task.

**Sources:** Existing `useUrlState.test.ts` line 9 comment — HIGH confidence (derived from codebase)

---

### Pitfall P4-3: Per-Domain `computed()` Array Invalidates Entirely on Any Single Domain Change

**What goes wrong:**
```typescript
const domainResults = computed(() =>
  input.workloadDomains.map(domain => calcCompute(domain))
)
```
Changing `vmCount` in domain[0] causes `domainResults` to be marked dirty and re-runs ALL domain calculations on next access. For N=10 domains with complex storage calculations (Decimal.js arithmetic), this may produce visible computation lag on slider drag.

**Why it happens:**
Vue's computed() tracks the `workloadDomains` array as a single dependency. Any mutation — even to a single domain — invalidates the entire computed.

**Consequences:**
- Sluggish UI at higher domain counts if calculation is non-trivial (currently moderate: Decimal.js loops)
- Not a correctness issue; purely a performance concern at scale

**Prevention:**
For v3.0 initial implementation, accept this behavior. The current engine functions run in microseconds for typical VCF sizing inputs. Optimization is only needed if profiling shows real lag. If needed, refactor to per-domain computed refs using `computed(() => calcCompute(input.workloadDomains[i]))` stored in a Map keyed by domain ID — but this requires a more complex reactive structure.

**Phase to address:** Phase 2 (calculationStore). Document the simplest approach first; flag optimization as a future concern.

**Sources:** [Vue.js Computed Properties docs](https://vuejs.org/guide/essentials/computed.html); [Vue Computed as wrong tool — DEV Community](https://dev.to/linusborg/vue-when-a-computed-property-can-be-the-wrong-tool-195j) — MEDIUM confidence

---

### Pitfall P4-4: Management Domain Host Spec Independence Requires a New `managementHostSpec` Object in the Store

**What goes wrong:**
The PROJECT.md requirement states "Management domain with independent host specs decoupled from workload domains." The current inputStore has flat fields (`coresPerSocket`, `socketsPerHost`, `hostRamGB`, etc.) that serve as both the workload host spec and implicitly as the management domain host spec. When workload domains become an array, there must be a decision: does the management domain get its own separate host spec object, or does it inherit from domain[0]?

If the management domain is not given its own host spec, it will silently inherit domain[0] specs when domain[0] is edited, producing incorrect management cluster sizing. This is not immediately obvious because the management calculations are currently based on `management.value.totalCores` / `totalRamGB` — which are VM resource sums independent of host hardware. Only `dedicatedMgmtHostCount` uses `coresPerSocket * socketsPerHost` from inputStore.

**Prevention:**
Define a `managementHostSpec: ref<HostSpec>({ coresPerSocket: 16, socketsPerHost: 2, hostRamGB: 512, ... })` in inputStore as a separate object. The `dedicatedMgmtHostCount` computed then uses `managementHostSpec.coresPerSocket * managementHostSpec.socketsPerHost`. Phase 1 must clarify the type boundary between management host spec and workload domain host specs.

**Phase to address:** Phase 1 (inputStore type design) — must be resolved before any implementation.

**Sources:** PROJECT.md — v3.0 requirements; existing `calculationStore.ts` line 79–82 — HIGH confidence (derived from codebase)

---

### Pitfall P4-5: `$patch()` on the Store Silently Fails to Merge Nested Array-of-Objects

**What goes wrong:**
Pinia's `store.$patch({ workloadDomains: newArray })` replaces the array reference, which works correctly for URL hydration. However, `store.$patch({ workloadDomains: [{ id: '1', vmCount: 200 }] })` with a partial domain object creates a domain that is missing all the other fields. `$patch` does a shallow merge at the top level but does NOT deeply merge array elements.

**Why it happens:**
`$patch` treats arrays as scalar values — it replaces the whole array, it does not merge individual array elements. The shallow merge semantics are documented but easy to misapply when transitioning from the old flat-field pattern (where `$patch` worked field-by-field).

**Prevention:**
Do not use `$patch` for partial domain updates. Use direct property assignment or store actions:
```typescript
// CORRECT — direct mutation
store.workloadDomains[0].vmCount = 200

// ALSO CORRECT — replace whole domain with spread
store.workloadDomains[0] = { ...store.workloadDomains[0], vmCount: 200 }

// WRONG — $patch with partial domain replaces array with incomplete objects
store.$patch({ workloadDomains: [{ id: '1', vmCount: 200 }] })
```

**Phase to address:** Phase 1 (inputStore) — document the mutation pattern in a comment.

**Sources:** [Pinia State docs — $patch](https://pinia.vuejs.org/core-concepts/state.html#mutating-the-state) — HIGH confidence

---

## Minor Pitfalls

### Pitfall P5-1: Export Composables (`useMarkdownExport`, `usePptxExport`) Need Domain-Aware Overloads

**What goes wrong:**
Both export composables currently accept the flat `inputStore` shape (single workload profile). After v3.0, they need to accept `WorkloadDomainConfig[]`. Changing the function signature breaks the existing 182 tests.

**Prevention:**
Use an additive approach: add a new overload or an optional `domains?:` parameter rather than replacing the existing parameter. Keep the single-domain path working for backward compatibility with existing tests. Add domain-array tests separately.

**Phase to address:** Phase 5 (export integration). Do not change export function signatures until store migration is fully tested.

**Sources:** CLAUDE.md — "Export composables: plain TypeScript (no Vue lifecycle hooks), pure data-mapping helpers for testability" — HIGH confidence (derived from codebase)

---

### Pitfall P5-2: i18n Keys for Domain-Specific Validation Warnings Must Be Added to All 4 Locale Files

**What goes wrong:**
The validation engine returns `ValidationWarning` objects with `messageKey` strings. Adding new warnings for domain-level issues (e.g., "Domain 3 has no hosts assigned") requires adding the key to `en.json`, `fr-CH.json`, `de-CH.json`, and `it-CH.json`. Missing keys in any locale produce `[domain.validation.noHosts]` visible as raw key strings in the UI.

**Prevention:**
After adding any new validation warning code/key: add it to all 4 locale files in the same commit. Write a test that calls `validateDomain()` and asserts the returned `messageKey` has a corresponding entry in the English locale file (import the JSON directly in the test).

**Phase to address:** Phase 2 (engine validation) and Phase 5 (UI rendering validation warnings per domain).

**Sources:** CLAUDE.md — "Validation warning messages must use i18n message keys, not English strings"; existing `types.ts` `ValidationWarning.messageKey` — HIGH confidence (derived from codebase)

---

### Pitfall P5-3: `crypto.randomUUID()` Is Not Available in JSDOM/Vitest Environment Without Polyfill

**What goes wrong:**
If domain IDs are generated with `crypto.randomUUID()` at domain creation time, tests run under Vitest's default JSDOM environment will throw "crypto.randomUUID is not a function" because JSDOM does not implement the Web Crypto API by default.

**Prevention:**
Two options:
1. Use a simple counter-based ID generator (`'domain-' + (++idCounter)`) instead of UUID for IDs that do not need to be globally unique
2. Mock `crypto.randomUUID` in `vitest.config.ts` setup: `vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-' + Math.random() })`

Note: The existing test environment is `node` (not JSDOM) as specified in CLAUDE.md — "node environment" — so if UUID generation is in a pure engine file, this issue may not apply. But if UUID generation is in a Vue component or store (which may run under JSDOM), mock it explicitly.

**Phase to address:** Phase 1 (type design) — decide ID generation strategy before writing any domain creation code.

**Sources:** CLAUDE.md — "Tests cover src/engine/**/*.test.ts — no DOM environment needed"; Vitest JSDOM limitations — MEDIUM confidence

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: WorkloadDomainConfig type + inputStore migration | P1-1 (array ref replacement), P3-1 (missing stable ID), P4-4 (management host spec separation) | Define `id` field first; use `ref<[]>` not `reactive([])`; separate management host spec object |
| Phase 2: calculationStore domain mapping | P1-2 (useInputStore in map callback), P4-3 (full array invalidation on single change) | Call store at top level; accept performance trade-off for MVP |
| Phase 3: Zod schema + URL state migration | P2-1 (default bypasses min), P2-2 (URL length), P2-3 (schema duplication) | Extract schema to own file first; use `.default(() => [defaultDomain()])` factory; add URL length test |
| Phase 4: Tab UI with add/remove | P3-1 (index key), P3-2 (out-of-bounds activeTab), P3-3 (KeepAlive stale data) | Use domain.id as key; clamp activeTabIndex after delete; skip KeepAlive initially |
| Phase 5: Export composables | P5-1 (signature breakage), P5-2 (missing i18n keys) | Additive overloads; sync all 4 locale files |
| All phases | P4-1 (engine test preservation), P4-2 (schema drift) | Run `npm test` before every task; extract schema before writing domain tests |

---

## Integration Pitfalls (Cross-Phase)

### The "Atomic Triple-Sync" Discipline Must Scale to Domains

The existing CLAUDE.md documents: "URL state: atomic Zod triple-sync (schema + hydrate + serialize)." In v2.x this means: schema definition, `hydrateFromUrl` assignment block, and `generateShareUrl` serialization block must all be updated together. With domains, this becomes:
1. `urlStateSchema.ts` — `WorkloadDomainSchema` + top-level schema
2. `useUrlState.ts` — `hydrateFromUrl` must assign `store.workloadDomains = result.data.workloadDomains`
3. `useUrlState.ts` — `generateShareUrl` must serialize `store.workloadDomains`

If any one of the three is not updated when a domain field is added, the field will either not be persisted (missing from serialization) or not be restored (missing from hydration) or not be validated (missing from schema). The test for this: round-trip test with the new field set to a non-default value — if the field survives compression/decompression with the correct value, all three are in sync.

---

## Sources

- [Pinia State docs](https://pinia.vuejs.org/core-concepts/state.html)
- [Pinia Ref vs Reactive in Stores — Mastering Pinia](https://masteringpinia.com/blog/ref-vs-reactive-in-stores)
- [Pinia Discussion #1448 — reactivity confusion](https://github.com/vuejs/pinia/discussions/1448)
- [storeToRefs API docs](https://pinia.vuejs.org/api/pinia/functions/storeToRefs.html)
- [Pinia Testing docs](https://pinia.vuejs.org/cookbook/testing.html)
- [Vue.js Computed Properties — Official Docs](https://vuejs.org/guide/essentials/computed.html)
- [Vue.js KeepAlive — Official Docs](https://vuejs.org/guide/built-ins/keep-alive.html)
- [Vue School — Tips and Gotchas for v-for key](https://vueschool.io/articles/vuejs-tutorials/tips-and-gotchas-for-using-key-with-v-for-in-vue-js-3/)
- [Zod v4 Issue #5525 — default bypasses validation](https://github.com/colinhacks/zod/issues/5525)
- [Zod v4 Issue #4544 — default bypasses .min()](https://github.com/colinhacks/zod/issues/4544)
- [Zod Official Docs — Arrays](https://zod.dev/api)
- [Maximum URL lengths — Baeldung](https://www.baeldung.com/cs/max-url-length)
- Existing `calculationStore.ts`, `inputStore.ts`, `useUrlState.ts`, `useUrlState.test.ts` — codebase analysis
- PROJECT.md v3.0 milestone requirements
