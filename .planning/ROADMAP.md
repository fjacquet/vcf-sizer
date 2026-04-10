# Roadmap: VCF Sizer

## Milestones

- ✅ **v2.0 Architecture Correctness & vSAN Max** — Phases 1-5 (shipped 2026-03-29)
- ✅ **v2.1 Export Quality** — Phases 6-9 (shipped 2026-03-30)
- ✅ **v3.0 Multi-Domain Support** — Phases 10-14 (shipped 2026-03-30)
- ✅ **v3.1 Sizing Correctness & Guided Workflow** — Phases 15-17 (shipped 2026-04-04)
- 🔄 **v3.3 UX Polish & Export Quality** — Phases 18-23 (in progress)

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

- [x] Phase 10: Domain Types, Defaults, and Store Refactor (2/2 plans) — completed 2026-03-30
- [x] Phase 11: URL State Schema Refactor (1/1 plans) — completed 2026-03-30
- [x] Phase 12: Domain Tab UI and Per-Domain Input Forms (2/2 plans) — completed 2026-03-30
- [x] Phase 13: Per-Domain Results and Aggregate Totals (2/2 plans) — completed 2026-03-30
- [x] Phase 14: Multi-Domain Exports (2/2 plans) — completed 2026-03-30

</details>

<details>
<summary>✅ v3.1 Sizing Correctness & Guided Workflow (Phases 15-17) — SHIPPED 2026-04-04</summary>

- [x] Phase 15: Engine Correctness (2/2 plans) — completed 2026-03-30
- [x] Phase 16: Wizard Scaffold and State (2/2 plans) — completed 2026-03-30
- [x] Phase 17: Wizard Step Content and Export Accuracy (3/3 plans) — completed 2026-03-31

Full details: `.planning/milestones/v3.1-ROADMAP.md`

</details>

### v3.3 UX Polish & Export Quality (Phases 18-23)

- [ ] **Phase 18: Store Foundations + Wizard Navigation** - Unblocking store additions and wizard UX (clickable steps, landing view)
- [ ] **Phase 19: Topology Confirmation + Domain Duplication** - Guard topology changes with dialog; add domain copy action
- [ ] **Phase 20: Storage Units Correction** - Replace TB with TiB throughout engine, schema, UI, and exports (atomic)
- [ ] **Phase 21: Per-Domain Chart Visualizations** - Each result card shows its own Cores/RAM/Storage charts
- [ ] **Phase 22: Localized Exports + PPTX Chart Images** - Exports in active locale; chart PNGs embedded in PPTX slides
- [ ] **Phase 23: Markdown Preview Panel** - In-app rendered Markdown preview before download

---

## Phase Details

### Phase 18: Store Foundations + Wizard Navigation
**Goal**: Users can navigate the wizard freely by clicking completed steps, and new users see an intro screen before starting
**Depends on**: Phase 17 (wizard step state already in uiStore)
**Requirements**: WIZARD-01, WIZARD-02
**Success Criteria** (what must be TRUE):
  1. User can click any completed (grey checkmark) step badge in WizardStepper and immediately land on that step's content without losing entered data
  2. User sees a landing/intro view on first load that explains the 3-step VCF sizing flow before any wizard step is shown
  3. User arriving via a shared URL bypasses the landing view entirely and lands directly at step 1 with their configuration hydrated
  4. Forward-jump attempts to unvisited steps have no effect (clicking step 3 while on step 1 does nothing)
  5. uiStore exposes chartImages registry and registerChartImage() action (consumed by Phase 21); isLandingVisible and dismissLanding() action are available
**Plans**: TBD
**UI hint**: yes

### Phase 19: Topology Confirmation + Domain Duplication
**Goal**: Users are protected from accidental topology changes that would invalidate configured workloads, and can copy a domain instead of re-entering 26 fields
**Depends on**: Phase 18 (ConfirmationDialog.vue reuses patterns; duplicateDomain stores toRaw() pattern)
**Requirements**: WIZARD-03, DOMAIN-01
**Success Criteria** (what must be TRUE):
  1. User who changes topology after configuring at least one workload domain sees a styled confirmation dialog before any store state changes
  2. User who cancels the topology change confirmation finds all workload domain data unchanged and the topology selector unchanged
  3. User who confirms the topology change sees the new topology applied and the wizard reset to step 1
  4. User can click a "Copy domain" button on any domain tab and see a new domain tab appear immediately after the original, containing all the same settings with a generated name (e.g., "WLD-1 (copy)")
  5. The duplicated domain is given a new UUID and all 26 configuration fields are faithfully cloned (not shared references)
**Plans**: TBD
**UI hint**: yes

### Phase 20: Storage Units Correction
**Goal**: All storage quantities throughout the application — inputs, calculated outputs, exports — display and compute in TiB (binary 2^40 bytes) rather than TB (decimal 10^12 bytes)
**Depends on**: Phase 17 (engine storage calculations established; URL state schema baseline)
**Requirements**: STOR-01, STOR-02, STOR-03, STOR-04
**Success Criteria** (what must be TRUE):
  1. All storage input fields and result displays show "TiB" unit labels; no "TB" labels remain anywhere in the UI or export output
  2. For vSAN ESA workload domains, the "Raw Storage per Host" input slider/field is labeled in TiB and the engine uses that value as TiB in calculations
  3. For FC/NFS workload domains, a "Total Usable Storage Pool (TiB)" input replaces the previous per-host raw storage field, and the engine uses the pooled value correctly
  4. URL state round-trips correctly using the new field names (hostStorageTiB, externalStorageUsableTiB); a URL generated after this phase loads all storage values correctly on hydration
  5. Existing Vitest engine tests are updated or added to cover TiB-based storage arithmetic; all tests pass
**Plans**: TBD

### Phase 21: Per-Domain Chart Visualizations
**Goal**: Each workload domain result card shows its own Cores, RAM, and Storage charts that reflect that domain's sizing data, rather than a single shared chart set
**Depends on**: Phase 18 (chartImages registry in uiStore available for PNG registration)
**Requirements**: CHART-01
**Success Criteria** (what must be TRUE):
  1. Each DomainResultCard displays three charts (Cores utilization, RAM utilization, Storage breakdown) showing only that domain's data
  2. With three configured workload domains, the page shows nine separate charts — three per card — each with distinct data values reflecting their respective domain
  3. Chart canvas elements carry per-domain IDs (e.g., cores-chart-{domainId}) preventing any cross-domain Chart.js instance collision
  4. After each chart renders, its PNG data URL is registered into uiStore.chartImages[domainId], making it available for PPTX embedding in Phase 22
**Plans**: TBD
**UI hint**: yes

### Phase 22: Localized Exports + PPTX Chart Images
**Goal**: Markdown and PPTX exports render all labels and section headings in the active UI locale, and PPTX slides include embedded chart images rasterized from live Chart.js canvases
**Depends on**: Phase 21 (chartImages registry populated by per-domain charts); Phase 18 (i18n keys for export namespace established)
**Requirements**: EXPORT-01, EXPORT-02
**Success Criteria** (what must be TRUE):
  1. User who has the UI set to French generates a Markdown export and all section headings, labels, and column names appear in French
  2. User who has the UI set to German generates a PPTX export and all slide titles, bullet labels, and table headers appear in German
  3. Each per-domain PPTX slide includes a chart image (PNG) showing the domain's utilization; the image is visually accurate (not a white blank)
  4. Export buttons are disabled while a locale is loading, preventing race conditions where i18n resolves to English fallback mid-export
  5. PPTX exports degrade gracefully when chartImages are not yet populated — slides render with data tables in place of images rather than failing
**Plans**: TBD

### Phase 23: Markdown Preview Panel
**Goal**: Users can preview the full rendered Markdown report inside the application before downloading, seeing the localized and formatted output in context
**Depends on**: Phase 22 (localized Markdown content; exports render in correct locale before preview exists)
**Requirements**: EXPORT-03
**Success Criteria** (what must be TRUE):
  1. User clicks a "Preview" button in the export toolbar and sees a rendered Markdown panel appear in the UI without downloading a file
  2. The preview panel renders tables, headings, and code blocks with correct HTML styling (not raw Markdown syntax)
  3. All domain names and user-entered text in the preview are sanitized — injecting `<script>` tags into a domain name does not execute JavaScript
  4. User can close the preview panel and return to the results view without losing any entered data
  5. The `marked` library is loaded lazily on first preview open and does not increase the initial page bundle
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 18. Store Foundations + Wizard Navigation | 0/? | Not started | - |
| 19. Topology Confirmation + Domain Duplication | 0/? | Not started | - |
| 20. Storage Units Correction | 0/? | Not started | - |
| 21. Per-Domain Chart Visualizations | 0/? | Not started | - |
| 22. Localized Exports + PPTX Chart Images | 0/? | Not started | - |
| 23. Markdown Preview Panel | 0/? | Not started | - |
