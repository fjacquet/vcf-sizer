# Milestones

## v3.1 Sizing Correctness & Guided Workflow (Shipped: 2026-04-04)

**Phases completed:** 8 phases, 16 plans, 33 tasks

**Key accomplishments:**

- One-liner:
- calculationStore rewritten with domainResults computed<DomainResult[]> array and aggregateTotals computed<AggregateTotals> reducer, CALC-02 maintained with zero ref()
- One-liner:
- 1. [Rule 2 - Missing functionality] Added domain i18n keys to all 4 locales
- ManagementDomainSection.vue
- Found during:
- DomainResultCard.vue
- Full multi-domain Markdown loop replacing first-domain bridge: per-domain H2 sections with H3 sub-sections, plus Aggregate Totals after loop
- Full multi-domain PPTX loop with per-domain slide groups, aggregate totals slide, and all helpers accepting WorkloadDomainConfig directly (EXP-03, EXP-04)
- Six regression tests for management overhead routing (dedicated vs colocated) and aggregate host count correctness — all pass because Wave-2 implementation preceded this executor.
- Management overhead routing corrected with index-aware .map(), 'shared' renamed to 'colocated' throughout, AggregateTotals extended with mgmtHostCount, and 242 tests passing with clean build
- uiStore extended with ref<1 | 2 | 3> currentWizardStep + setWizardStep action, 8 TDD tests proving WIZARD-02/WIZARD-07, and wizard i18n keys added to all 4 locales
- 3-step guided wizard UI delivered: WizardStepper indicator, TopologySelector with atomic global writes, and App.vue restructured into v-show panels (WIZARD-01/WIZARD-02)
- topologyConfirmed ephemeral flag in uiStore with step-aware WizardStepper canGoForward gates enforcing VCF design sequence (topology before management before workloads)
- ManagementResultCard (step 2 bottom) and ManagementCommittedSummary (step 3 top) integrated into wizard with dedicated/colocated host count display and i18n keys in all 4 locales
- Management hosts row added to Markdown and PPTX exports with TDD: shows numeric count (dedicated) or 'colocated with WLD-1' (non-dedicated), backed by new AggregateTotals type and aggregateTotals computed

---

## v2.1 Export Quality (Shipped: 2026-03-30)

**Phases completed:** 4 phases, 11 plans, 13 tasks

**Key accomplishments:**

- One-liner:
- generateMarkdownReport() extracted verbatim from useUrlState.ts into dedicated useMarkdownExport.ts composable, wiring ExportToolbar.vue to the new location — MD-01 satisfied
- One-liner:
- A4 portrait @page rule with 25mm/15mm margins, print-color-adjust for background preservation, and break-inside-avoid on all result cards to prevent mid-card page splits
- Fixed-position print header (title + date) and footer (attribution) added to ResultsPanel.vue using hidden print:flex pattern with i18n keys in all 4 locales
- Chart.js canvas hidden in print via print:hidden, replaced by semantic data tables using hidden print:table pattern in all three chart components (CoresChart, RamChart, StorageChart)
- One-liner:
- One-liner:
- "Download PPTX" button added to ExportToolbar.vue with async loading state and i18n keys in all 4 locales, wiring generatePptxReport into the existing toolbar UI.
- One-liner:
- 5 conditional PPTX slides for AI/GPU, NVMe tiering, stretch topology, vSAN Max, and validation warnings wired to generatePptxReport() with feature-guard conditions matching useMarkdownExport.ts

---

## v2.0 Architecture Correctness & vSAN Max (Shipped: 2026-03-29)

**Phases completed:** 5 phases, 11 plans, 12 tasks

**Key accomplishments:**

- Vite 8 + Vue 3 + Tailwind v4 project scaffold with vue-i18n v11 (Composition API, four Swiss locales), Pinia inputStore/uiStore, and language switcher
- One-liner:
- Vue 3 SFC input panel components wired reactively to Pinia stores — NumberSliderInput, DeploymentModelSelector, ManagementSummary, HostSpecsForm, WorkloadProfileForm, StorageConfigForm all built with full i18n and VCFA blocker warning.
- One-liner:
- lz-string URL compression with Zod validation for shareable URLs, Markdown report download, and browser-print PDF via ExportToolbar component
- Completed:
- Completed:
- 10 Gbps bandwidth floor + StretchNetworkChecklist engine + DEDICATED_MGMT_MIN_HOSTS/COLLOCATED_MIN_HOSTS validation rules with managementArchitecture wired through inputStore, calculationStore, and URL state
- i18n keys in all 4 Swiss locales + DeploymentModelSelector management architecture toggle with WarningBanner validation errors + StretchNetworkChecklist card component + ResultsPanel wiring — all engine correctness work from Plan 01 now user-visible
- src/engine/vsanMax.ts
- src/components/results/VsanMaxClusterCard.vue

---

## v1.0 — Initial Release (completed 2026-03-29)

**Goal:** Build a fully functional, zero-backend VCF 9.x sizing calculator with real-time compute, RAM, and storage results across all deployment models.

**Shipped:**

- Full calculation engine: management domain, compute, storage (vSAN ESA, FC, NFS), stretch cluster
- NVMe Memory Tiering (ESXi 9.x), AI/GPU workload sizing, Global Deduplication
- Split-screen UI with real-time Chart.js charts (Cores, RAM, Storage)
- Stretch cluster topology card (witness, bandwidth, per-site storage)
- URL sharing (lz-string + Zod), Markdown export, print-to-PDF
- 4 Swiss locales (FR, EN, DE, IT), auto dark mode (OS-driven)
- Validation: VCFA min 12 cores blocker, dedup/stretch mutual exclusion, stretch min 3 hosts/site

**Phases:** 3 phases, 7 plans, 72 tests passing

---
