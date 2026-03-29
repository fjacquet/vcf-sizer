# Milestones

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
