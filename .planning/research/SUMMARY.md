# Project Research Summary

**Project:** VCF Sizer v3.0 — Multi-Domain Support
**Domain:** Client-side SPA infrastructure sizing calculator (Vue 3 + Pinia 3 + Zod 4)
**Researched:** 2026-03-30
**Confidence:** HIGH

## Executive Summary

VCF Sizer v3.0 adds support for N independent workload domains to the existing single-domain calculator. Each VCF workload domain is a fully isolated pool of hosts with its own vCenter, storage config, and lifecycle — so the calculator must model each domain as a fully independent configuration object. The recommended approach is to refactor `inputStore.ts` from a flat collection of 20+ scalar `ref()` fields into a `workloadDomains: ref<WorkloadDomain[]>` array plus a separate `managementDomain: ref<ManagementDomain>` object. No new npm packages are needed: Pinia 3 array stores, Zod 4 `z.array()`, and a custom 50-line Vue 3 tab component cover all requirements cleanly.

The key architectural risk is the breadth of the change: the store refactor cascades through `calculationStore.ts` (must map over domains array while staying `computed()`-only per CALC-02), `useUrlState.ts` (Zod schema becomes a nested array schema with a breaking URL format change), every input form component (must receive `domainId` prop instead of reading flat store globals), and both export composables. The correct build order is types first, then store, then URL state, then input UI, then results UI, then exports — each phase gated by a passing test suite before the next begins.

Three decisions need resolution before Phase 1 starts: (1) whether to inline management domain host spec fields directly in `inputStore.ts` or move workload domains to a new `domainsStore.ts` (both architectures are documented in ARCHITECTURE.md and STACK.md — pick one and enforce it uniformly); (2) whether `deploymentMode` lives per-domain (as ARCHITECTURE.md recommends and as VCF architecture demands) or remains a global field; and (3) the backward compatibility strategy for v2.x shared URLs (research consensus: acceptable to silently reset to default state, documented in release notes).

## Key Findings

### Recommended Stack

No new npm packages are required for v3.0. The existing stack fully covers multi-domain needs: Pinia 3 setup stores with `ref<WorkloadDomain[]>()`, Zod 4 `z.array()` with per-field defaults, lz-string for URL compression, and a custom Vue 3 tab component. The `@headlessui/vue` package (the obvious candidate for accessible tabs) is stuck at v1.7.23 with no v2 for Vue, making it a maintenance liability. Reka UI (formerly Radix Vue) is the modern alternative but is disproportionate for a single tabs use case. A zero-dependency custom tab component is the right call.

**Core technologies:**
- `Pinia 3` + `ref<WorkloadDomain[]>()` — array domain store — standard setup store pattern; `ref()` (not `reactive()`) required to avoid double-proxy wrapping
- `Zod 4 z.array(DomainSchema)` — URL state validation — already at `^4.3.6`; factory default `.default(() => [createDefaultWorkloadDomain(0)])` required (see P2-1 pitfall)
- Custom `DomainTabs.vue` (~50 lines) — tab UI — zero dependency, ARIA-compliant, keyboard navigable
- `crypto.randomUUID()` — stable domain IDs — browser-native, no library needed; verify Vitest node env compatibility in Phase 1
- Existing `lz-string` — URL compression — adequate for up to ~15 domains; UI hint recommended above 6,000-char URL threshold

### Expected Features

**Must have (table stakes):**
- Tab-per-domain UI with add/remove — users cannot reason about N configs in a single scrolling form
- Inline tab rename (double-click) — standard pattern in browsers and IDEs; no modal required
- Per-domain independent full config — host specs, workload profile, storage type, optional features, deployment mode all independent per domain
- Management domain with independent host specs — decoupled from workload domain specs; feeds `dedicatedMgmtHostCount` calculation
- Per-domain results display — active tab shows that domain's host count and utilization
- Aggregate totals panel — total hosts across all domains + management = the procurement number
- Multi-domain URL state — full config survives lz-string round-trip
- Per-domain sections in Markdown and PPTX exports
- Conditional delete confirmation — show modal only when domain has non-default data (`vmCount > 0`); skip for empty/default domains

**Should have (competitive differentiators):**
- Domain duplication ("Copy from...") — common when architects plan multiple similar domains
- Tab overflow scrolling with gradient fade hint — needed at 5+ domains
- Per-domain validation warnings with aggregate warnings panel
- Domain-name-aware export filenames

**Defer to post-v3.0:**
- Drag-to-reorder tabs — significant complexity, minimal user benefit
- Side-by-side domain comparison columns — breaks responsive design, duplicates per-domain tab info
- localStorage persistence — URL sharing is the persistence model; localStorage adds sync bugs
- Import from VCF Planning Workbook — separate feature, out of scope
- Domain color theming — cosmetic, accessibility concerns

### Architecture Approach

The core pattern is: `inputStore` owns a `ref<WorkloadDomain[]>` with `addDomain`, `removeDomain`, `updateDomain` actions; `calculationStore` maps over it with a single `computed(() => domains.map(...))` returning `DomainResult[]` and a second `computed()` reducing to `AggregateTotals` — both CALC-02 compliant (zero `ref()` in calculationStore). Input form components stop reading from flat store globals and instead accept a `domainId` prop, using writable computed getters/setters that route through `updateDomain(id, patch)`. The `activeDomainIndex` is ephemeral UI state — kept in component `ref()`, never serialized to URL.

**Major components:**
1. `src/engine/types.ts` + `src/engine/defaults.ts` — `WorkloadDomain` interface, `ManagementDomain` interface, `createDefaultWorkloadDomain(index)` factory (pure TypeScript, CALC-01 compliant)
2. `src/stores/inputStore.ts` — refactored to hold `workloadDomains: ref<WorkloadDomain[]>`, `managementDomain: ref<ManagementDomain>`, `managementArchitecture: ref`, domain mutation actions
3. `src/stores/calculationStore.ts` — `domainResults: computed()` mapping array, `aggregateTotals: computed()` reducing array, `dedicatedMgmtHostCount: computed()` — zero `ref()` maintained (CALC-02)
4. `src/composables/urlStateSchema.ts` + updated `useUrlState.ts` — Zod schema extracted to own module (prevents test drift), `hydrateFromUrl` / `generateShareUrl` updated for array state
5. `src/components/input/DomainTabs.vue` + `DomainTabPanel.vue` — custom tab bar with add/remove/rename and one domain's full input form set
6. `src/components/input/ManagementDomainPanel.vue` — management host specs (separate from workload domain tabs)
7. `src/components/results/DomainResultCard.vue` + `AggregateCard.vue` — per-domain and aggregate results display

**File change inventory summary:**
- New files: `defaults.ts`, `urlStateSchema.ts`, `DomainTabs.vue`, `DomainTabPanel.vue`, `ManagementDomainPanel.vue`, `DomainResultCard.vue`, `AggregateCard.vue`
- Major rewrites: `inputStore.ts`, `calculationStore.ts`, `useUrlState.ts`
- Moderate modifications: all 4 input form components (add `domainId` prop), `ResultsPanel.vue`, `HostCountCard.vue`, 3 chart components, `useMarkdownExport.ts`, `usePptxExport.ts`
- Unchanged: all `src/engine/*.ts` pure functions, `uiStore.ts`, shared UI components, 4 locale files (additions only)

### Critical Pitfalls

1. **Zod v4 `.default([])` bypasses `.min(1)` (P2-1, HIGH confidence)** — In Zod v4, a `.default()` value is treated as valid by definition, skipping subsequent refinements. `z.array(DomainSchema).min(1).default([])` parses `undefined` to `[]` — an empty array that crashes the tab UI. Fix: use a factory `.default(() => [createDefaultWorkloadDomain(0)])` so the default always contains one domain. Confirmed in Zod GitHub issues #5525 and #4544.

2. **Array index as `v-for` key causes stale component state after delete (P3-1, HIGH confidence)** — Using `:key="index"` means Vue reuses DOM nodes by position, bleeding local state (focus, unsaved input, toggle animation) from deleted domains onto surviving ones. Fix: `:key="domain.id"` always. The `id` field must be part of `WorkloadDomain` from Phase 1 type definition, not retrofitted.

3. **`activeTabIndex` out-of-bounds after domain deletion (P3-2, MEDIUM confidence)** — Deleting the last tab leaves `activeTabIndex` pointing at a non-existent index, causing a silent undefined crash. Fix: clamp after every delete — `activeDomainIndex = Math.min(activeDomainIndex, workloadDomains.length - 1)`. This belongs in the `removeDomain` action in `inputStore.ts`.

4. **Pinia `$patch` shallow-merges arrays, corrupting partial domain patches (P4-5, HIGH confidence)** — `store.$patch({ workloadDomains: [{ id: '1', vmCount: 200 }] })` replaces the array with a single incomplete domain object. Fix: never use `$patch` for domain mutations; use the `updateDomain(id, patch)` action with `Object.assign(domain, patch)`.

5. **Schema duplication between `useUrlState.ts` and its test file silently drifts (P2-3, HIGH confidence)** — The test file currently replicates `InputStateSchema`. With the domain array schema, drift on any new field means tests pass against an old schema while production validates against the new one. Fix: extract all Zod schemas to `src/composables/urlStateSchema.ts` with zero browser/Pinia dependencies — both production and test import from that single source.

## Implications for Roadmap

Based on the combined research, the dependency chain is rigid: types must precede store, store must precede URL state, URL state and store must precede input UI, input UI must precede results UI, and results UI must precede exports. Six phases follow naturally from this dependency order.

### Phase 1: Foundation — Types, Defaults, and Store Refactor

**Rationale:** Everything downstream depends on the `WorkloadDomain` type and the new store shape. This is the highest-risk phase because it changes the data contract for every consumer. Must be done first and tested thoroughly before any UI work begins. The `id` field (stable key) and management domain separation must be resolved here — retrofitting either later is costly.

**Delivers:** `WorkloadDomain` and `ManagementDomain` interfaces in `types.ts`; `createDefaultWorkloadDomain()` factory in `defaults.ts`; refactored `inputStore.ts` with array state and `addDomain`/`removeDomain`/`updateDomain` actions; refactored `calculationStore.ts` with `domainResults` computed array and `aggregateTotals`; all existing 182 engine tests still passing.

**Addresses:** Per-domain full independence (table stake), management domain independent host specs (table stake)

**Avoids:** P1-1 (array ref replacement pitfall), P3-1 (missing stable ID), P3-2 (clamp in removeDomain action), P4-4 (management host spec separation)

**Gate:** `npm run type-check` passes; `npm test` shows 182+ tests passing.

**Research flag:** Standard Pinia/Vue 3 patterns — no additional research needed. Verify `crypto.randomUUID()` in Vitest node env as first task.

### Phase 2: URL State — Zod Schema Refactor

**Rationale:** URL state must be updated before UI is touched. If hydration breaks, the share-URL persistence model is broken. Easier to isolate and test in a pure TypeScript context before UI complexity is added. Schema extraction to `urlStateSchema.ts` (P2-3 fix) must happen here as the first task in this phase.

**Delivers:** `urlStateSchema.ts` with `WorkloadDomainSchema`, `ManagementDomainSchema`, `InputStateSchema`; updated `hydrateFromUrl()` assigning `store.workloadDomains` from array; updated `generateShareUrl()` serializing domains array with spread (`{...d}`) to avoid proxy serialization artifacts; backward-compat behavior (v2.x URL parse fails gracefully, falls back to single default domain); updated `useUrlState.test.ts` with round-trip tests for 1 domain, 3 domains, and empty-array coercion; URL length test asserting <2,048 chars for 5-domain config.

**Addresses:** Full multi-domain URL state (table stake)

**Avoids:** P2-1 (factory default, not empty default), P2-2 (URL length test), P2-3 (schema in own module), P4-2 (test drift impossible when both import same schema)

**Gate:** `npx vitest run src/composables/useUrlState.test.ts` passes; URL round-trip test for 3 domains passes.

**Research flag:** Standard patterns — no additional research needed. Confirm Zod 4 callable `.default(() => fn())` works with installed `^4.3.6` as first test.

### Phase 3: Input UI — Per-Domain Forms and Tab Component

**Rationale:** Input components must be refactored before results can be exercised end-to-end. The tab infrastructure scaffolds all subsequent UI phases. This phase is lower risk than Phases 1-2 but requires the most component-level changes.

**Delivers:** `DomainTabs.vue` (tab bar with add/remove, ARIA `role="tablist"` / `role="tab"`); `DomainTabPanel.vue` (renders one domain's full form set by `domainId` prop); `ManagementDomainPanel.vue` (management host specs); all four input form components updated with `domainId` prop and writable computed getters/setters routing through `updateDomain(id, patch)`; inline rename (double-click to focus input, blur/Enter commit, Escape cancel, empty-name guard); tab overflow CSS (`overflow-x: auto`, Tailwind `scrollbar-hide`).

**Addresses:** Tab-per-domain UI (table stake), inline tab rename (table stake), add/remove domain (table stake), conditional delete confirmation (differentiator)

**Avoids:** P3-1 (`:key="domain.id"` on all loops), P3-2 (clamp already in store action from Phase 1), P3-3 (no `<KeepAlive>` initially)

**Gate:** Single-domain UI works identically to v2.x. Adding a second domain produces fully independent inputs. Deleting a domain activates left neighbor tab correctly.

**Research flag:** Standard Vue 3 tab pattern — no additional research needed.

### Phase 4: Results UI — Per-Domain and Aggregate Display

**Rationale:** Results components depend on the `domainResults` array shape from Phase 1 and the tab infrastructure from Phase 3. Chart components need a domain-awareness strategy (per-domain chart vs multi-series toggle — decide during implementation).

**Delivers:** `DomainResultCard.vue` (reads `domainResults[i]`, shows host count and utilization per domain); `AggregateCard.vue` (reads `aggregateTotals`, shows total hosts for procurement); `ResultsPanel.vue` updated to iterate over domains; `HostCountCard.vue` updated to accept `ComputeResult` as prop rather than reading store directly; chart components updated for per-domain data.

**Addresses:** Per-domain results (table stake), aggregate totals panel (table stake), per-domain validation warnings (differentiator)

**Avoids:** P4-3 (accept full-array recompute as acceptable for MVP — engine functions are microsecond-fast; optimize only if profiling shows real lag)

**Gate:** Per-domain results display correctly. Aggregate totals match manual sum. Deleting a domain removes it from the results panel immediately.

**Research flag:** Standard Vue 3 computed rendering — no additional research needed.

### Phase 5: Export Refactor — Markdown and PPTX

**Rationale:** Export composables are pure TypeScript with no lifecycle hooks — they are the final consumer layer and must come last. They depend on the stable `domainResults` shape from Phase 1.

**Delivers:** `useMarkdownExport.ts` iterating over `domainResults` for per-domain sections (structure: Overview, Management Domain, Workload Domain 1..N, Summary with shareable URL); `usePptxExport.ts` generating per-domain slide sections (structure: Title, Deployment Overview, Management Domain, Domain 1..N slides, Warnings); composable tests updated with domain-array fixtures; additive overloads preserved to avoid breaking existing test signatures.

**Addresses:** Per-domain sections in Markdown export (table stake), per-domain sections in PPTX export (table stake)

**Avoids:** P5-1 (additive overloads, not signature replacement), P5-2 (new i18n keys added to all 4 locale files in same commit)

**Gate:** Markdown report contains exactly one section per domain. PPTX contains per-domain slides. All 182 baseline tests still pass.

**Research flag:** Standard iteration pattern — no additional research needed.

### Phase 6: i18n Keys and Localization Cleanup

**Rationale:** New UI strings for domain tabs, labels, and section headers accumulate across Phases 3-5. Final cleanup ensures all 4 locales are complete and no raw English strings appear in the UI.

**Delivers:** New i18n keys in all 4 locale files (`en`, `fr-CH`, `de-CH`, `it-CH`): `domains.add`, `domains.remove`, `domains.management`, `domains.workload`, `domains.aggregate`, `domains.rename`, `domains.deleteConfirm.*`; validation message keys for any new domain-level warnings.

**Addresses:** Existing project constraint (all validation warnings use i18n keys, never raw strings)

**Avoids:** P5-2 (missing keys in non-English locales produce raw key strings in UI)

**Gate:** No raw English strings in any new component. All 4 locale files contain identical key sets for new domain-related keys.

**Research flag:** Standard i18n pattern — no research needed.

### Phase Ordering Rationale

- Phases 1 and 2 are strictly ordered by dependency: store shape must be stable before URL state can be tested.
- Phase 3 (input UI) depends on Phase 1 (store actions) and Phase 2 (URL hydration) being stable.
- Phase 4 (results UI) depends on Phase 3 being complete to exercise the full end-to-end flow.
- Phase 5 (exports) is the final consumer layer and must come last.
- Phase 6 (i18n) is parallelizable with Phases 3-5 but is cleanest as a final pass once all new strings are known.
- The build order directly mirrors the layered architecture: engine types → store → URL state → input UI → results UI → exports.

### Research Flags

All six phases use standard, well-documented patterns. No `/gsd:research-phase` is needed for any phase. The only open questions are implementation judgments resolvable during execution:

- **Phase 1:** Verify `crypto.randomUUID()` in Vitest node env — quick one-line test, not a research blocker
- **Phase 2:** Confirm Zod 4 callable `.default(() => fn())` with installed version — first test in the phase
- **Phase 4:** Chart multi-domain strategy (per-domain chart vs multi-series toggle) — visual decision during implementation

### Key Decisions Needed Before Phase 1 Starts

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Store structure | (A) Single `inputStore` with `workloadDomains` array + `managementDomain` (ARCHITECTURE.md) vs (B) Separate `domainsStore` + global fields in `inputStore` (STACK.md) | Option A — fewer stores, simpler URL state serializer to update, consistent with existing store topology |
| `deploymentMode` scope | Per-domain vs global | Per-domain — VCF architecture requires stretch to be per-domain; FEATURES.md lists `deploymentMode` explicitly as a per-domain field |
| `managementArchitecture` placement | Global field vs field on `ManagementDomain` object | Global — it is a deployment-level toggle controlling whether management domain has dedicated hardware; it is not a per-domain setting |
| v2.x URL backward compatibility | (A) Silent reset to default state vs (B) Migrate flat fields to single domain | Option A — acceptable per research; document in release notes; migration code carries field-name mismatch risk |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages are existing; custom tab component pattern is well-documented; Zod v4 `z.array()` API confirmed from official docs |
| Features | HIGH | VCF workload domain architecture verified against Broadcom TechDocs; tab UX patterns from NN/g; delete confirmation patterns from Cloudscape and UX Movement |
| Architecture | HIGH | Patterns grounded in direct codebase inspection + Vue 3/Pinia 3 official docs; `computed()` over `ref([])` is confirmed deep-reactive behavior; writable computed for v-model is established |
| Pitfalls | HIGH (critical pitfalls), MEDIUM (moderate pitfalls) | Critical pitfalls P2-1 (Zod default bypass), P3-1 (index key), P3-2 (out-of-bounds) verified against official docs and GitHub issues; moderate pitfalls are well-understood trade-offs |

**Overall confidence:** HIGH

### Gaps to Address

- **`crypto.randomUUID()` in Vitest node environment (P5-3):** Confirm during Phase 1 by running a test that calls `createDefaultWorkloadDomain()`. If it throws, mock in `vitest.setup.ts` or switch to a counter-based ID generator.

- **Zod 4 callable `.default(() => fn())` exact version compatibility:** ARCHITECTURE.md rates this MEDIUM confidence. Confirm it works with installed `^4.3.6` during Phase 2. Fall back to `.optional().transform(v => v ?? fn())` if needed.

- **Chart multi-domain strategy:** ARCHITECTURE.md flags charts as "multi-series or per-domain toggle" without prescribing an approach. Decide during Phase 4 implementation based on visual output. No blocking research needed.

- **URL length at 5 domains:** Add a Vitest assertion in Phase 2. Research projects ~680–950 chars for 3 domains and ~1,900–2,700 chars for 10 domains. Measure rather than assume.

## Sources

### Primary (HIGH confidence)

- Broadcom TechDocs — Workload Domains in VCF 9.x — domain architecture and independence requirements
- Vue 3 official docs (vuejs.org) — reactivity fundamentals, computed properties, writable computed
- Pinia 3 official docs (pinia.vuejs.org) — setup stores, `ref()` vs `reactive()`, `storeToRefs()`, `$patch` semantics
- Zod 4 official docs (zod.dev/api, zod.dev/v4) — `z.array()`, `.default()`, `.min()`, v4 changelog
- Nielsen Norman Group — Tabs, Used Right — tab UX best practices
- WAI-ARIA 1.1 specification — Tabs pattern (tablist/tab/tabpanel roles)
- Cloudscape Design System — delete with additional confirmation patterns
- Existing VCF Sizer codebase — direct inspection of `inputStore.ts`, `calculationStore.ts`, `useUrlState.ts`, `useUrlState.test.ts`

### Secondary (MEDIUM confidence)

- Zod GitHub issues #5525 and #4544 — `.default([])` bypasses `.min(1)` in Zod v4 — behavior confirmed, fix confirmed
- Pinia Discussion #1448 — `ref()` vs `reactive()` array mutation tracking — community-verified, cross-referenced with official docs
- lz-string URL length projections — manual calculation; actual compression ratio varies with input entropy
- Nutanix Sizer multi-workload patterns — community docs, used for UX pattern inspiration only

### Tertiary (LOW confidence / inference)

- `activeTabIndex` out-of-bounds behavior (P3-2) — application-level defensive programming, no official source needed
- Per-domain computed full-array invalidation performance (P4-3) — accepted as non-issue at 1-10 domains based on microsecond engine timing in v2.x; no profiling data

---
*Research completed: 2026-03-30*
*Ready for roadmap: yes*
