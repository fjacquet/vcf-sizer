# Project Research Summary

**Project:** VCF 9.x Sizing Calculator — Milestone v3.1: Sizing Correctness & Guided Workflow
**Domain:** Client-side SPA sizing calculator with wizard UX and engine calculation fixes
**Researched:** 2026-03-30
**Confidence:** HIGH (architecture grounded in direct codebase inspection; MEDIUM for VCF 9.x sizing specifics; LOW for colocated overhead formula)

## Executive Summary

VCF Sizer v3.1 builds on the completed v3.0 multi-domain foundation (Phase 14 complete) to deliver three coordinated capabilities: a 3-step guided wizard UX, a management-first engine calculation order fix, and colocated mode overhead absorption into WLD-1. The project is a Vue 3 + Pinia + Vite SPA with strict layer separation — pure TypeScript engine, computed-only calculation store, and reactive UI components — that is already well-implemented and must be respected throughout v3.1 work.

The core correctness problem is a bug in `calculationStore.ts` that passes management overhead to ALL workload domains unconditionally. In dedicated mode this double-counts management hardware; in colocated mode it inflates WLD-2 through WLD-N. The fix is surgical: a conditional index check inside the `domainResults.map()` call, combined with an updated `aggregateTotals` computed that adds `dedicatedMgmtHostCount` only for dedicated architecture. The engine layer (`calcCompute()`) already accepts `managementCores` as an optional parameter — no engine signature changes are required.

The wizard UX is architecturally straightforward: four new Vue SFC components (WizardStepper, Step1Topology, Step2Management, Step3Workloads) wrapping existing input and result components, with a single `currentWizardStep: ref<1|2|3>(1)` added to `uiStore.ts`. The primary risks are (1) accidentally serializing wizard step to URL state, which must be kept in `uiStore` and never included in `InputStateSchema`, (2) the colocated double-counting that must be prevented by test-first development, and (3) wizard `onMounted` resetting the store after URL hydration. All three are preventable with clear architectural boundaries established before implementation begins.

## Key Findings

### Recommended Stack

The stack for v3.1 is entirely the existing stack — no new npm packages are required. The v3.0 research (multi-domain) similarly added no new packages. This project follows a deliberate zero-new-dependency discipline backed by strong rationale: `@headlessui/vue` is stale at v1.7.23 (no Vue 2.0 release), `jspdf`/`html2canvas` are rejected due to bundle size and quality issues, and `pptxgenjs` (already installed) handles PPTX export via dynamic import.

**Core technologies:**
- Vue 3.5 + `<script setup>` — component layer; all wizard step components are Vue SFCs
- Pinia 3 setup stores — `inputStore` (mutable refs), `calculationStore` (computed-only, zero ref()), `uiStore` (ephemeral UI state including wizard step)
- Zod v4 — URL state schema validation; `.strip()` discards unknown keys enabling safe schema evolution
- lz-string — URL compression for shareable links; adequate for practical domain counts (1-15 domains)
- Vite + vue-tsc — build and type checking; `vue-tsc` enforces TypeScript correctness on SFC props
- pptxgenjs (dynamic import) — PPTX export; loaded only on user trigger, zero initial bundle impact
- Vitest — 236 existing tests that must pass throughout; TDD approach required for engine changes

**Critical version notes:** `zod@^4.3.6` — use `.min(1)` not `.nonempty()` (type inference changed in v4). `pinia@^3.0.4` — return `ref<T[]>()` from setup stores, not `reactive([])`.

### Expected Features

**Must have (table stakes for v3.1 MVP):**
- 3-step wizard with horizontal step indicator (numbered + labeled: Topology / Management / Workloads)
- Completed-step visual differentiation (three states: completed, active, upcoming)
- Forward/back navigation with data persistence across step transitions
- Per-step validation blocking forward advance only (never block back)
- Step 2 to Step 3 gate: management sizing must be complete before advancing
- Management DomainResultCard displayed at end of Step 2
- Engine fix: management overhead applied to WLD-1 only (colocated) or zero domains (dedicated)
- Aggregate totals: `dedicatedMgmtHostCount` added only for dedicated architecture
- Back navigation without data loss (Pinia store preserves state; wizard only controls visibility)

**Should have (differentiators):**
- Domain-aware step ordering enforcing the VCF deployment sequence (Topology then Management then Workloads)
- Management-first result display at Step 2 before workload entry (builds confidence in committed overhead)
- Step 2 summary panel collapsed at top of Step 3 (prevents "where did those hosts go?" confusion)
- Colocated mode explicit display: "Management overhead included in WLD-1 host count: X hosts"
- Aggregate totals recalculated after management-first pass (correct procurement BOM)

**Defer to v3.1.x or later:**
- Step indicator click-to-revisit completed steps (convenience, not correctness)
- Wizard intro/landing view ("Start Sizing" CTA)
- Animated step transitions (zero correctness value)
- Per-step separate URLs / route-based wizard (requires Vue Router, no functional benefit)
- localStorage wizard progress persistence (URL sharing already covers the use case)

### Architecture Approach

The v3.1 architecture adds four new Vue SFC components as thin wrappers around existing input/result components, with minimal changes to two stores and no engine file changes. The established CALC-01/CALC-02 constraints are non-negotiable: engine files never import Vue/Pinia, and `calculationStore` uses zero `ref()`. The wizard step lives in `uiStore.ts` (the correct home for ephemeral UI state), not `inputStore` (serialized to URL) or `calculationStore` (CALC-02 violation).

**Major components and their responsibilities:**
1. `WizardStepper.vue` (new, `components/shared/`) — step indicator bar + prev/next navigation buttons; reads `uiStore.currentWizardStep`; uses `v-if` not `v-show` to avoid mounting all steps simultaneously
2. `Step1Topology.vue` (new, `components/wizard/`) — wraps DeploymentModelSelector; writes `deploymentMode` to BOTH `managementDomain` AND all `workloadDomains` atomically
3. `Step2Management.vue` (new, `components/wizard/`) — wraps ManagementDomainSection + ManagementSummary + MgmtDomainResultCard; shows committed management overhead
4. `Step3Workloads.vue` (new, `components/wizard/`) — wraps existing DomainTabStrip + all input forms + ResultsPanel + ExportToolbar unchanged
5. `calculationStore.ts` (modified) — fixes `domainResults` map to pass `managementCores: 0` for dedicated mode and for WLD-2+; fixes `aggregateTotals` to add `dedicatedMgmtHostCount` conditionally
6. `uiStore.ts` (modified) — adds `currentWizardStep: ref<1|2|3>(1)`, `setStep()`, `nextStep()`, `prevStep()`

**Key patterns to follow:**
- Calculation order in `calculationStore.ts` MUST be preserved: `management` declared before `dedicatedMgmtHostCount` declared before `domainResults` declared before `aggregateTotals` (Vue lazy computed evaluation makes declaration order meaningful)
- Wizard step exclusion from URL state mirrors the existing `activeDomainIndex` exclusion pattern (URL-04)
- Export composables (`useMarkdownExport`, `usePptxExport`) read stores at call time; must be updated in the same commit as any `AggregateTotals` type changes

### Critical Pitfalls

1. **Wizard step serialized to URL (W1)** — Add `currentWizardStep` to `uiStore` exclusively; never add it to `InputStateSchema`. Write a test: decompressed `generateShareUrl()` output must not contain a `wizardStep` key. Add a comment next to the `activeDomainIndex` URL-04 exclusion referencing this rule.

2. **Colocated overhead double-counting (C2/P2)** — The existing code already passes `management.value.totalCores` to ALL domains (a bug). The fix must REPLACE this with `(isColocated && index === 0) ? management.value.totalCores : 0`. Write the two failing tests first: colocated `aggregateTotals.totalRecommendedHosts === domainResults[0].compute.recommendedHostCount`; dedicated WLD-1 does NOT include management cores.

3. **Wizard onMounted resets hydrated store state (W3)** — Wizard `onMounted` must never call `inputStore.$reset()` or any factory-default assignment. Only set `uiStore.currentWizardStep = 1`. If URL state was hydrated, optionally advance to Step 3.

4. **Management/WLD-1 deploymentMode divergence after Step 1 (C3)** — Step 1 must write the selected topology to BOTH `inputStore.managementDomain.deploymentMode` AND every `inputStore.workloadDomains[i].deploymentMode`. A mismatch between management (HA: 118 cores) and workload (Simple) produces incorrect sizing in both directions.

5. **Export composables using pre-refactor field values (E1)** — Export composable updates are mandatory in the same phase/commit as the engine/store refactor. After the `aggregateTotals` fix, run `npx vitest run src/composables/` and verify markdown aggregate hosts match `AggregateTotalsCard` UI values.

## Implications for Roadmap

Based on the combined research, v3.1 breaks cleanly into three sequential phases. The engine fix must land before wizard gating is meaningful; wizard components must land before App.vue integration; exports must update after types are finalized.

### Phase 1: Wizard Scaffold and State Architecture
**Rationale:** Establish all architectural contracts before any implementation — wizard step location, URL exclusion rule, hydration contract, deploymentMode sync contract. Creating these boundaries first prevents all three wizard-related pitfalls (W1, W2, W3) from ever being introduced. This phase is low-risk and high-leverage.
**Delivers:** uiStore wizard step extension with navigation helpers; four new empty/stub wizard component files; `Step1Topology` wiring that writes `deploymentMode` to both management and workload domains; unit tests for URL exclusion and deploymentMode sync; WizardStepper step indicator UI
**Addresses:** Table-stakes wizard features (step indicator, navigation, data persistence, back/next buttons)
**Avoids:** W1 (URL state contamination), W2 (CALC-02 violation), W3 (hydration reset), C3 (deploymentMode divergence)

### Phase 2: Engine Calculation Order Fix (Management-First)
**Rationale:** This is the highest-risk change (touches `calculationStore.ts`, affects 236 tests). Must be done TDD: write failing tests for colocated/dedicated aggregate behavior first, then implement the fix. Engine fix must be complete before Step 2 management result card is meaningful and before Step 2-to-3 gating is correct.
**Delivers:** Correct `domainResults.map()` with conditional management overhead per domain; correct `aggregateTotals` with `dedicatedMgmtHostCount` for dedicated mode; 236+ tests passing; corrected types in `engine/types.ts` if `AggregateTotals` gains `mgmtHostCount` field
**Uses:** Existing `calcCompute()` signature (no engine changes needed); existing `management` computed in `calculationStore`
**Implements:** Patterns 2 and 3 from ARCHITECTURE.md (management-first calculation order; aggregate totals restructure)
**Avoids:** C1 (required parameter breaking tests), C2 (double-counting), P1 (computed order), P2 (overhead applied to all domains)

### Phase 3: Wizard UI Integration and Export Accuracy
**Rationale:** With correct engine output available, the wizard components can surface meaningful management results at Step 2. Export composables must be updated in this phase (same commits as type changes) to prevent UI/export discrepancy. Step 3 is essentially the current App.vue layout recomposed — low risk.
**Delivers:** Step2Management with management DomainResultCard; Step3Workloads composing all existing input/result components; App.vue integration replacing flat two-column layout; updated `useMarkdownExport` and `usePptxExport` aggregate sections showing mgmt host breakdown; Step 2 summary panel at top of Step 3
**Uses:** All existing `input/*` and `results/*` components unchanged (reused inside wizard steps via composition)
**Implements:** Pattern 4 from ARCHITECTURE.md (WizardStepper component architecture)
**Avoids:** E1 (stale export values), E2 (synchronous export after state mutation — requires `await nextTick()` in wizard finish handler)

### Phase Ordering Rationale

- Phase 1 before Phase 2: Architectural contracts (wizard step location, URL exclusion, deploymentMode sync) must be documented and tested before any implementation uses them. The Step 1 deploymentMode write is also fully independent of the engine fix.
- Phase 2 before Phase 3: The wizard Step 2 gate ("management sizing must be complete before advancing") is only meaningful if management results are correctly calculated. Surfacing wrong management overhead at Step 2 would mislead users and undermine the tool's core correctness guarantee.
- Phase 3 is the integration phase: once the engine is correct and the wizard scaffold exists, the UI component assembly and export updates are relatively low-risk compositing work with no new architectural decisions.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** The colocated overhead absorption formula has LOW confidence — no official Broadcom VCF 9 document specifies the exact calculation. The derived logic (add `management.totalCores`/`totalRamGB` to WLD-1 compute inputs, use result as colocated cluster host count) is architecturally sound but must be documented as an engineering decision, not a vendor specification.
- **Phase 2:** VCF 9.x management domain component overhead values (vCPU/RAM per component in simple vs. HA mode) are sourced from community posts (William Lam) and a vendor blog. These are MEDIUM confidence. The existing `calcManagement()` already encodes these values — validation against production deployments may be warranted if the tool is used for production sizing rather than lab/PoC sizing.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Wizard step in uiStore, URL exclusion pattern, and Vue SFC component scaffolding are all well-documented Vue 3 + Pinia patterns with HIGH confidence. No additional research needed.
- **Phase 3:** WizardStepper using `v-if` step switching and composing existing components is standard Vue SFC composition. Export composable updates follow the established snapshot-read-at-call-time pattern already used throughout the codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new packages; all technology decisions grounded in official docs and npm registry verification as of March 2026 |
| Features | MEDIUM | Wizard UX patterns HIGH from multiple authoritative sources; VCF 9.x sizing order MEDIUM from official Broadcom TechDocs; colocated overhead formula LOW — no official spec found |
| Architecture | HIGH | Grounded in direct codebase inspection of all engine, store, and composable files; specific bugs identified with line references |
| Pitfalls | HIGH | All critical pitfalls verified against actual codebase patterns; specific file/line/symbol references given; all are preventable with TDD and code review |

**Overall confidence:** HIGH for implementation approach and architecture; MEDIUM for VCF 9.x domain-specific sizing values

### Gaps to Address

- **Colocated overhead formula (LOW confidence):** No official Broadcom VCF 9 document specifies the formula for calculating colocated management overhead absorption into WLD-1. The implementation will follow the derived logic (add management vCPU/RAM to WLD-1 compute inputs). This must be flagged as an engineering assumption in requirements and in code comments inside `calculationStore.ts`.
- **Production management component overhead values:** The component vCPU/RAM values in `calcManagement()` are sourced from a lab-minimal deployment guide (~48 vCPU / 194 GB RAM simple; ~118 vCPU / ~450 GB RAM HA). A production VCF 9 management domain (25+ VMs, ~234 vCPU, ~825 GB RAM per the WEI blog) significantly exceeds the encoded values. This gap may need a follow-up research ticket if the tool targets production sizing rather than lab/PoC sizing.
- **Step 1 topology scope:** Research assumes Step 1 writes a global `deploymentMode` to both management and workload domains atomically. If the design intent allows mixed topologies (e.g., management HA + WLD-1 Simple), this must be explicitly specified in requirements before Phase 1 implementation begins. The wizard enforces a single topology choice — this is a deliberate simplification that should be documented.

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection: `src/stores/calculationStore.ts` — management pass-through bug (lines 57-58), aggregateTotals reducer
- Codebase direct inspection: `src/stores/uiStore.ts` — ephemeral UI state pattern; basis for wizard step placement recommendation
- Codebase direct inspection: `src/composables/useUrlState.ts` — URL-04 `activeDomainIndex` exclusion; Zod `.strip()` usage
- Codebase direct inspection: `src/engine/types.ts` — `ComputeInputs` optional field pattern; `AggregateTotals` structure
- Codebase direct inspection: `src/engine/compute.ts` — `managementCores` optional parameter already present
- [Pinia setup stores — official docs](https://pinia.vuejs.org/core-concepts/state.html) — `ref<T[]>()` pattern, `storeToRefs()`
- [Zod v4 API](https://zod.dev/api) — array schemas, `.min()`, `.default()` semantics
- [Vue 3 reactivity — nextTick](https://vuejs.org/api/general.html#nexttick) — export composable async pattern
- [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — keyboard navigation standard for stepper/tab components
- [Broadcom KB 392993](https://knowledge.broadcom.com/external/article/392993/minimum-number-of-esxi-hosts-required-on.html) — minimum ESXi host counts (HIGH — official KB)

### Secondary (MEDIUM confidence)
- [Broadcom TechDocs VCF 9.0 — Management Domain Model](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/design/design-library/workload-domain-deployment-models/management-domain-deployment-model.html) — management-first deployment sequence
- [VMware Cloud Foundation Blog — VCF 9.0 Deployment Planning, July 2025](https://blogs.vmware.com/cloud-foundation/2025/07/28/planning-a-successful-vmware-cloud-foundation-9-0-deployment/) — sizing sequence
- [William Lam — Minimal Resources for VCF 9.0 Lab, June 2025](https://williamlam.com/2025/06/minimal-resources-for-deploying-vcf-9-0-in-a-lab.html) — component vCPU/RAM values (community, widely cited)
- [Eleken — Wizard UI Pattern Best Practices](https://www.eleken.co/blog-posts/wizard-ui-pattern-explained) — step indicator and navigation UX patterns
- [Flowbite — Tailwind CSS Stepper](https://flowbite.com/docs/components/stepper/) — stepper component reference implementation
- [Origin UI Vue — Stepper Components](https://www.originui-vue.com/stepper) — Vue 3 + Tailwind stepper reference

### Tertiary (LOW confidence)
- [WEI Blog — What Does It Take to Run VCF 9?](https://www.wei.com/blog/what-does-it-take-to-run-vcf-9/) — production-grade overhead values (234 vCPU, 825 GB RAM for full management domain); vendor blog, not official specification

---
*Research completed: 2026-03-30*
*Ready for roadmap: yes*
