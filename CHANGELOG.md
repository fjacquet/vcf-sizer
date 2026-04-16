# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.4.0] - 2026-04-16 -- Step 3 Workload Wizard UX + Dep Refresh

### Added

- External pool capacity slider for FC/NFS storage (10-2000 TiB, default 100) -- users can now configure external array size from the form
- i18n keys `storage.workloadRequired`, `storage.externalPool`, `storage.externalPoolInput` (EN/FR/DE/IT)
- Multi-key auto-correction banner -- all cascading fixes surface as individual bullet items, deduplicated
- Store-level tests (`src/stores/inputStore.test.ts`) covering the full auto-correction cascade
- aria-label on disabled Stretch / vSAN Max buttons combining label + exclusion reason for screen readers

### Changed

- Step 3 form order: Deployment -> Storage -> Host Specs -> Workloads (storageType-driven branches render final shape on first paint)
- `normalizeDomainPatch()` runs the vSAN Max + Stretch rule before the Stretch + Dedup rule so dedup is preserved on the HA-corrected path
- Component prop naming converted to kebab-case (`:domain-id`) matching Vue convention

### Fixed

- DOMPurify moderate severity advisory (GHSA-39q2-94rc-95cp) via `npm audit fix`
- Auto-correction banner no longer overwrites prior messages on multi-field patches

### Dependencies

- marked 15.0.12 -> 18.0.0 (trims trailing blank lines from block tokens, TS 6)
- vite 8.0.3 -> 8.0.8, @vitejs/plugin-vue 6.0.5 -> 6.0.6
- vue-i18n 11.3.0 -> 11.3.2
- @vitest/ui 4.1.2 -> 4.1.4, @types/node 25.5.2 -> 25.6.0, globals 17.4.0 -> 17.5.0, dev-tools group (3)
- actions/upload-pages-artifact 4 -> 5 (deploy workflow)

## [3.3.3] - 2026-04-15 -- FC/NFS Storage Accuracy

### Fixed

- FC/NFS exports no longer show "Storage per host" (irrelevant for external SAN/NAS)
- FC/NFS exports now show "Workload Storage Required" computed from vmCount x avgStorageGbPerVm
- Aggregate totals include total workload storage required (shown only when > 0)

### Added

- `workloadStorageRequiredTiB` field in storage engine for FC/NFS domains
- `totalWorkloadStorageRequiredTiB` in aggregate totals
- ADR-009: Workload Storage Required for FC/NFS Domains
- i18n keys for workload storage labels (EN, FR, DE, IT)

## [3.3.0] - 2026-04-11 -- UX Polish & Export Quality

### Added

- 3-step guided wizard (Topology, Management, Workloads) with click-back navigation
- Landing/intro view for first-time users (bypassed by shared URLs)
- Topology change confirmation dialog -- prevents accidental data loss
- Domain duplication -- copy all 26 configuration fields to a new domain
- Storage units correction -- all fields now use TiB (binary) labels
- FC/NFS external storage pool input (Total Usable Storage Pool TiB)
- Per-domain Chart.js visualizations (Cores, RAM, Storage utilization)
- Chart PNG images embedded in PPTX export slides
- Localized exports -- Markdown and PPTX render in active UI locale (EN/FR/DE/IT)
- In-app Markdown preview panel with DOMPurify XSS sanitization
- Locale loading guard -- export buttons disabled during async locale switch

## [3.1.0] - 2026-04-04 -- Sizing Correctness & Guided Workflow

### Added

- Engine correctness improvements
- Wizard scaffold and state management
- Wizard step content and export accuracy

## [3.0.0] - 2026-03-30 -- Multi-Domain Support

### Added

- Multiple workload domains with per-domain tabs
- Domain types, defaults, and store refactor
- URL state schema refactor for multi-domain
- Per-domain results and aggregate totals
- Multi-domain exports (Markdown + PPTX)

## [2.1.0] - 2026-03-30 -- Export Quality

### Added

- Markdown extraction and enrichment
- Print/PDF CSS overhaul
- PPTX core slides (pptxgenjs)
- PPTX conditional slides (AI/GPU, NVMe, stretch, vSAN Max)

## [2.0.0] - 2026-03-29 -- Architecture Correctness & vSAN Max

### Added

- Foundation engine with pure TypeScript sizing calculations
- Input forms with Pinia state management
- Output charts (Chart.js via vue-chartjs)
- vSAN ESA storage calculations with FTT/RAID selection
- vSAN Max disaggregated storage clusters (5 ReadyNode profiles)
- FC/NFS pass-through storage with host count validation
- AI/GPU workload vGPU memory overhead modeling
- NVMe Memory Tiering support
- Stretch cluster validation with network checklist
- Shareable URLs (lz-string + Zod validation)
- 4 languages: EN, FR-CH, DE-CH, IT-CH

## [1.0.0] - 2026-03-28 -- Initial Release

### Added

- Initial VCF 9.x sizing calculator
