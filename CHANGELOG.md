# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
