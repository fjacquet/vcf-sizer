# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Dedicated management cluster minimum hosts for FC/NFS storage reduced from 4 to 2
  (simple/HA) and from 8 to 4 (stretch) per VCF 9.0 installer requirements (Broadcom KB 416270).
  vSAN management minimums are unchanged (4 / 8). The `ManagementDomainConfig` type
  gains an optional `storageType` field (defaults to `vsan-esa`).

### Added
- ESLint + Prettier configuration with CI enforcement
- CI workflow with test, lint, and type-check gates on PRs
- Dependabot for automated dependency updates
- LICENSE, CONTRIBUTING, SECURITY, and CHANGELOG files
- PR template and issue templates
- EditorConfig for cross-editor consistency

## [3.1.0] - 2026-03-31

### Added
- 3-step guided wizard (Topology → Management → Workloads) enforcing correct VCF design order
- `TopologySelector` component — global atomic topology selection (Simple / HA / Stretch)
- `WizardStepper` with step-aware forward gates: step 1 requires topology confirmation; step 2 requires valid management config for dedicated architectures
- `ManagementResultCard` (step 2 bottom) — shows management host count, vCPU, and RAM requirements
- `ManagementCommittedSummary` (step 3 top) — collapsible read-only panel summarising committed management sizing
- Management hosts row in Markdown aggregate section (`EXPORT-01`)
- Management hosts row in PPTX aggregate slide — `buildAggregateSlideData` extended to 3 arguments (`EXPORT-02`)
- `topologyConfirmed` / `confirmTopology()` in `uiStore`; URL hydration auto-confirms topology
- `wizard.step2.topologyLockedHint` i18n key (all 4 locales) — step 2 shows topology as read-only badge

### Fixed
- Engine correctness: management overhead now routed to WLD-1 only in colocated mode (Phase 15)
- `dedicatedMgmtHostCount` now uses `managementDomain` host specs, not `workloadDomains[0]`
- Dedicated management in Stretch topology: minimum host count corrected to 8 (4 per site × 2 sites, Broadcom KB 392993); was incorrectly 4
- Management deployment mode in step 2 is now read-only (locked by step 1 topology selection); was incorrectly editable

### Changed
- `ManagementArchitecture` enum: `'shared'` renamed to `'colocated'` for VCF accuracy
- `aggregateTotals.mgmtHostCount` returns 0 in colocated mode (overhead embedded in WLD-1, not a separate procurement line)
- `STRETCH_DEDICATED_MGMT_MIN_HOSTS = 8` constant exported from `src/engine/validation.ts`
- 260 tests passing (up from 242 in v1.0.0)

## [3.0.0] - 2026-03-30

### Added
- Multi-domain support: up to 4 independent workload domains plus a management domain
- `WorkloadDomainConfig` and `ManagementDomainConfig` types in engine layer
- Domain tab strip for switching between workload domains
- Per-domain compute, storage, stretch, and vSAN Max results
- Aggregate totals across all domains (hosts, VMs, storage)
- Per-domain Markdown sections (`## Domain: {name}`) and PPTX slide groups
- Management hosts row in aggregate exports
- URL state schema supports multi-domain serialisation; v2.x URLs degrade gracefully

## [2.1.0] - 2026-03-30

### Added
- Full Markdown export (`useMarkdownExport.ts`) with all sections
- Print/PDF CSS overhaul (`@media print`, `@page`, break-inside-avoid)
- PowerPoint export via `pptxgenjs` (dynamic import, code-split)
- Conditional PPTX slides: stretch cluster, vSAN Max, AI/GPU, validation warnings

## [1.0.0] - 2026-03-30

### Added
- VCF 9.x interactive sizing calculator (browser-only, no backend)
- Simple / HA / Stretch cluster topology support
- vSAN ESA storage sizing with FTT/RAID selection and adaptive RAID gate
- vSAN Max disaggregated storage clusters (5 ReadyNode profiles)
- FC / NFS pass-through storage with host count validation
- AI/GPU workload vGPU memory overhead modeling
- NVMe Memory Tiering for ESXi 9.x
- Stretch cluster validation (bandwidth, MTU, RTT, witness)
- Multi-domain support (up to 4 workload domains)
- Shareable URLs with lz-string compression + Zod validation
- Export to Markdown, PDF, and PowerPoint
- 4 Swiss locales: EN, FR-CH, DE-CH, IT-CH
- Real-time Chart.js visualizations
- Pure TypeScript engine with 242 tests
- GitHub Pages deployment via CI/CD
