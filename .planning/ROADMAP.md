# Roadmap: VCF Sizer

## Milestones

- ✅ **v2.0 Architecture Correctness & vSAN Max** — Phases 1-5 (shipped 2026-03-29)
- ✅ **v2.1 Export Quality** — Phases 6-9 (shipped 2026-03-30)
- ✅ **v3.0 Multi-Domain Support** — Phases 10-14 (shipped 2026-03-30)
- 🔄 **v3.1 Sizing Correctness & Guided Workflow** — Phases 15-17 (active)

## Phases

<details>
<summary>✅ v2.0 Architecture Correctness & vSAN Max (Phases 1-5) — SHIPPED 2026-03-29</summary>

- [x] Phase 1: Foundation, Engine and Inputs (3/3 plans) — completed 2026-03-28
- [x] Phase 2: Outputs, Charts and Export (2/2 plans) — completed 2026-03-29
- [x] Phase 3: Advanced Features and Polish (2/2 plans) — completed 2026-03-29
- [x] Phase 4: Correctness and Architecture Validation (2/2 plans) — completed 2026-03-29
- [x] Phase 5: vSAN Max Storage Cluster (2/2 plans) — completed 2026-03-29

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.1 Export Quality (Phases 6-9) — SHIPPED 2026-03-30</summary>

- [x] Phase 6: Markdown Extraction and Enrichment (3/3 plans) — completed 2026-03-30
- [x] Phase 7: Print/PDF CSS Overhaul (3/3 plans) — completed 2026-03-30
- [x] Phase 8: PPTX Core Slides (3/3 plans) — completed 2026-03-30
- [x] Phase 9: PPTX Conditional Slides and Polish (2/2 plans) — completed 2026-03-30

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>✅ v3.0 Multi-Domain Support (Phases 10-14) — SHIPPED 2026-03-30</summary>

- [x] Phase 10: Domain Types, Defaults, and Store Refactor (completed 2026-03-30)
- [x] Phase 11: URL State Schema Refactor (completed 2026-03-30)
- [x] Phase 12: Domain Tab UI and Per-Domain Input Forms (completed 2026-03-30)
- [x] Phase 13: Per-Domain Results and Aggregate Totals (completed 2026-03-30)
- [x] Phase 14: Multi-Domain Exports (completed 2026-03-30)

</details>

### v3.1 Sizing Correctness & Guided Workflow (Phases 15-17) — Active

- [x] **Phase 15: Engine Correctness** — TDD-first fixes to management overhead routing, aggregate totals, and TypeScript diagnostics (completed 2026-03-30)
- [ ] **Phase 16: Wizard Scaffold and State** — WizardStepper shell, uiStore wizard step, navigation, and URL exclusion guarantee
- [ ] **Phase 17: Wizard Step Content and Export Accuracy** — Step validation gates, management result card, management summary panel, and updated exports

---

## Phase Details

### Phase 10: Domain Types, Defaults, and Store Refactor

**Goal**: The application's internal data contract supports N independent workload domains plus an independent management domain
**Depends on**: Nothing (first phase of v3.0 milestone)
**Requirements**: DOM-01, DOM-02, DOM-03, DOM-04, DOM-05, DOM-06
**Success Criteria** (what must be TRUE):

  1. `inputStore` holds `workloadDomains: ref<WorkloadDomainConfig[]>` and `managementDomain: ref<ManagementDomainConfig>` — flat scalar refs replaced
  2. Each `WorkloadDomainConfig` carries a stable `id` (crypto.randomUUID()), a `name`, and fully independent host specs, workload profile, storage config, and optional feature toggles
  3. Default load produces exactly one workload domain named "WLD-1" with all existing default values
  4. `calculationStore.domainResults` is a `computed()` array (one result per domain) with zero `ref()` — CALC-02 maintained
  5. `calculationStore.aggregateTotals` is a `computed()` reducing `domainResults` — all 182+ existing engine tests still pass
**Plans**: 2 plans
Plans:

- [x] 10-01-PLAN.md — Types, defaults, and inputStore refactor (DOM-01, DOM-02, DOM-03, DOM-04)
- [ ] 10-02-PLAN.md — calculationStore refactor and integration (DOM-05, DOM-06)

### Phase 11: URL State Schema Refactor

**Goal**: Multi-domain configuration survives a full lz-string/Zod round-trip and v2.x URLs degrade gracefully to default state
**Depends on**: Phase 10
**Requirements**: URL-01, URL-02, URL-03, URL-04
**Success Criteria** (what must be TRUE):

  1. A URL encoding 3 independent workload domains deserializes losslessly back to the same 3 domains (names, all field values preserved)
  2. Pasting a v2.x flat-schema URL into the browser resets to default state without an error (no crash, no empty tab UI)
  3. The active tab index is never present in the serialized URL — hydration always activates the first tab
  4. A 5-domain configuration serializes to a URL parameter shorter than 2,048 characters
**Plans**: 1 plan
Plans:

- [x] 11-01-PLAN.md — URL state schema refactor with TDD (URL-01, URL-02, URL-03, URL-04)

### Phase 12: Domain Tab UI and Per-Domain Input Forms

**Goal**: Users can manage N named workload domains via a tab interface and configure each domain fully independently
**Depends on**: Phase 10, Phase 11
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, FORM-01, FORM-02, FORM-03, FORM-04, FORM-05
**Success Criteria** (what must be TRUE):

  1. User sees a tab strip showing one tab per workload domain; clicking a tab switches all input forms to that domain's values without affecting other domains
  2. User can add a new domain via "Add Domain" button — new tab appears named "WLD-N" with all inputs at defaults
  3. User can delete a domain via a per-tab delete button — a confirmation dialog appears only when the domain has non-default data; the last remaining domain cannot be deleted
  4. User can rename a domain by double-clicking its tab label — inline edit commits on blur or Enter, cancels on Escape
  5. Management domain host specs and architecture toggle appear in a dedicated section outside the tab strip, fully independent of workload domain tabs
**Plans**: 2 plans
Plans:

- [x] 12-01-PLAN.md — Store mutations, tab component, and form props refactor (UI-01, UI-02, UI-03, UI-04, FORM-01, FORM-02, FORM-03, FORM-04, FORM-05)
- [ ] 12-02-PLAN.md — Management domain section, App integration, and i18n (UI-05)

### Phase 13: Per-Domain Results and Aggregate Totals

**Goal**: Users can read sizing results for each individual workload domain and see the total procurement host count across all domains
**Depends on**: Phase 12
**Requirements**: RES-01, RES-02, RES-03
**Success Criteria** (what must be TRUE):

  1. Each workload domain displays its own result card showing domain name, recommended host count, CPU utilization %, RAM utilization %, and storage breakdown — values update reactively when that domain's inputs change
  2. An aggregate totals card shows the sum of host counts across all workload domains plus management — this is the procurement number
  3. Management domain results (management component overhead and recommended management host count) render in their existing dedicated section, unchanged from v2.x behavior
**Plans**: 2 plans
Plans:

- [x] 13-01-PLAN.md — Fix export composables for multi-domain store API (RES-01, RES-02, RES-03)
- [ ] 13-02-PLAN.md — Per-domain result cards, aggregate totals card, and i18n (RES-01, RES-02, RES-03)
**UI hint**: yes

### Phase 14: Multi-Domain Exports

**Goal**: Markdown and PPTX exports contain a complete section for every workload domain plus aggregate totals
**Depends on**: Phase 13
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04
**Success Criteria** (what must be TRUE):

  1. Downloading the Markdown report produces a document with exactly one named section per workload domain, each containing that domain's configuration and sizing results
  2. The Markdown report ends with a totals section summarizing aggregate host counts and combined resources across all domains
  3. Downloading the PPTX produces a presentation with one slide per workload domain showing the domain name, key inputs, and results summary
  4. The PPTX includes an aggregate totals slide after all per-domain domain slides
**Plans**: 2 plans

- [x] 14-01-PLAN.md — Multi-domain Markdown export (EXP-01, EXP-02)
- [x] 14-02-PLAN.md — Multi-domain PPTX export (EXP-03, EXP-04)

### Phase 15: Engine Correctness

**Goal**: The calculation engine produces correct sizing numbers — management overhead is never double-counted and aggregate totals include all host populations
**Depends on**: Phase 14
**Requirements**: ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-04
**Success Criteria** (what must be TRUE):

  1. In dedicated architecture mode, workload domain result cards show zero management vCPU/RAM overhead — WLD-1 and all other domains are sized on workload inputs alone
  2. In colocated architecture mode, WLD-1 host count increases to absorb management vCPU and RAM — WLD-2 and beyond remain unaffected
  3. The aggregate totals card procurement host count equals the sum of all workload domain host counts plus dedicated management host count (dedicated mode), or workload hosts only (colocated mode)
  4. `npm run type-check` exits with zero errors — no implicit `any` types and no missing module imports remain in `useMarkdownExport.ts`, `usePptxExport.ts`, or `useUrlState.ts`
**Plans**: TBD

### Phase 16: Wizard Scaffold and State

**Goal**: Users see a persistent 3-step wizard indicator and can navigate forward and back between steps without losing any data
**Depends on**: Phase 15
**Requirements**: WIZARD-01, WIZARD-02, WIZARD-07
**Success Criteria** (what must be TRUE):

  1. A horizontal 3-step indicator (1: Topology, 2: Management, 3: Workloads) is visible at all times during the sizing workflow with clear active/completed/upcoming visual states
  2. User can navigate to a previous step at any time — all input values entered in later steps are fully preserved on return
  3. Copying the shareable URL and pasting it into a new browser tab never restores or encodes the wizard step position — the app always opens at step 1 regardless of which step was active when the URL was copied
**Plans**: 2 plans
Plans:

- [ ] 16-01-PLAN.md — uiStore extension, tests (WIZARD-02, WIZARD-07), and i18n keys for all 4 locales
- [ ] 16-02-PLAN.md — WizardStepper.vue, TopologySelector.vue, and App.vue restructuring (WIZARD-01, WIZARD-02)
**UI hint**: yes

### Phase 17: Wizard Step Content and Export Accuracy

**Goal**: Each wizard step enforces the correct VCF design sequence and all export outputs reflect corrected management host counts
**Depends on**: Phase 16
**Requirements**: WIZARD-03, WIZARD-04, WIZARD-05, WIZARD-06, EXPORT-01, EXPORT-02
**Success Criteria** (what must be TRUE):

  1. User cannot advance from step 1 to step 2 until one of the three deployment topologies (Simple / HA / Stretch) is explicitly selected
  2. User cannot advance from step 2 to step 3 until management domain host count meets the minimum validation threshold — the next button is disabled and an inline message explains the requirement
  3. At the bottom of step 2, a management domain result card shows the computed host count and utilization figures before the user advances
  4. At the top of step 3, a collapsed summary panel displays the committed management resource figures (host count, vCPU, RAM) — this panel is read-only and cannot be edited from step 3
  5. The downloaded Markdown report aggregate totals section contains a management hosts line — dedicated mode shows the host count, colocated mode shows "colocated with WLD-1"
  6. The downloaded PPTX aggregate totals slide contains a management hosts breakdown row with the same representation as the Markdown output
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation, Engine and Inputs | v2.0 | 3/3 | Complete | 2026-03-28 |
| 2. Outputs, Charts and Export | v2.0 | 2/2 | Complete | 2026-03-29 |
| 3. Advanced Features and Polish | v2.0 | 2/2 | Complete | 2026-03-29 |
| 4. Correctness and Architecture Validation | v2.0 | 2/2 | Complete | 2026-03-29 |
| 5. vSAN Max Storage Cluster | v2.0 | 2/2 | Complete | 2026-03-29 |
| 6. Markdown Extraction and Enrichment | v2.1 | 3/3 | Complete | 2026-03-30 |
| 7. Print/PDF CSS Overhaul | v2.1 | 3/3 | Complete | 2026-03-30 |
| 8. PPTX Core Slides | v2.1 | 3/3 | Complete | 2026-03-30 |
| 9. PPTX Conditional Slides and Polish | v2.1 | 2/2 | Complete | 2026-03-30 |
| 10. Domain Types, Defaults, and Store Refactor | v3.0 | 1/2 | Complete | 2026-03-30 |
| 11. URL State Schema Refactor | v3.0 | 1/1 | Complete | 2026-03-30 |
| 12. Domain Tab UI and Per-Domain Input Forms | v3.0 | 1/2 | Complete | 2026-03-30 |
| 13. Per-Domain Results and Aggregate Totals | v3.0 | 1/2 | Complete | 2026-03-30 |
| 14. Multi-Domain Exports | v3.0 | 1/2 | Complete    | 2026-03-30 |
| 15. Engine Correctness | v3.1 | 2/2 | Complete   | 2026-03-30 |
| 16. Wizard Scaffold and State | v3.1 | 0/2 | Not started | - |
| 17. Wizard Step Content and Export Accuracy | v3.1 | 0/? | Not started | - |
