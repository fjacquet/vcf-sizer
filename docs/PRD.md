# Product Requirements Document -- VCF Sizer v3.3

**Version**: 3.3 (UX Polish & Export Quality)
**Last updated**: 2026-04-11
**Status**: Shipped

---

## Overview

VCF Sizer is an interactive browser-based sizing calculator for VMware Cloud Foundation 9.x deployments. It computes exact hardware requirements -- hosts, CPU cores, RAM, and storage -- across all supported deployment topologies before hardware is ordered.

The application runs entirely client-side as a Vue 3 single-page application deployed to GitHub Pages. There is no backend, no database, no login, and no external API calls. Configuration state is serialized into shareable URLs using lz-string compression and Zod schema validation.

**Live URL**: `https://<org>.github.io/vcf-sizer/`

---

## Target Users

- **VMware/Broadcom pre-sales engineers** -- sizing VCF deployments for customer proposals
- **Infrastructure architects** -- planning VCF rack layouts and validating hardware specs against workload requirements
- **IT managers** -- evaluating hardware budgets and comparing topology options before procurement

---

## Core Capabilities

| # | Capability | Description |
|---|-----------|-------------|
| 1 | Multi-domain sizing | Configure multiple workload domains plus a management domain, each with independent hardware parameters |
| 2 | All VCF 9 topologies | Simple (single-site), HA (multi-host), Stretch Cluster (two-site with witness) |
| 3 | Storage types | vSAN ESA, vSAN Max (disaggregated), Fibre Channel, NFS |
| 4 | AI/GPU workload modeling | GPU VM count and vGPU memory per VM feed into compute sizing |
| 5 | NVMe Memory Tiering | Active memory percentage reduces physical RAM requirements |
| 6 | Shareable URLs | Full configuration compressed into a URL query parameter (no backend) |
| 7 | Export: Markdown | Localized Markdown report with per-domain tables and aggregate totals |
| 8 | Export: PPTX | PowerPoint slides with embedded chart images (PNG), localized labels |
| 9 | Export: Print/PDF | Print-optimized CSS stylesheet for browser-native PDF generation |
| 10 | In-app Markdown preview | Rendered HTML preview with sanitized output before download |
| 11 | 4 locales | English, French (CH), German (CH), Italian (CH) with Swiss number formatting |
| 12 | 3-step guided wizard | Topology, Management, Workloads -- with clickable step navigation and topology change guards |
| 13 | Domain duplication | Copy an existing workload domain with all 26 fields cloned under a new UUID |
| 14 | Per-domain charts | Cores, RAM, and Storage utilization charts rendered per workload domain |

---

## Functional Requirements

### FR-1: Compute Sizing

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| FR-1.1 | Calculate total cores and RAM required from VM count, vCPU/vRAM per VM, and overcommit ratios | Output matches: `totalCoresRequired = vmCount * avgVcpuPerVm / cpuOvercommitRatio` (analogous for RAM) |
| FR-1.2 | Subtract management overhead (vCenter, SDDC Manager, NSX, Aria Ops, Aria Automation) from available capacity when colocated | Management cores and RAM are deducted before computing utilization percentages |
| FR-1.3 | Recommend minimum host count based on whichever resource (CPU or RAM) is the bottleneck | `recommendedHostCount = max(minHostsForCpu, minHostsForRam, deploymentMinimum)` |
| FR-1.4 | Support NVMe Memory Tiering to reduce effective RAM demand | When enabled, effective RAM = `hostRamGB * (activeMemoryPct / 100)` is used for available RAM calculation |

### FR-2: Storage Sizing

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| FR-2.1 | Calculate raw-to-usable storage for vSAN ESA with RAID multiplier, LFS overhead (1.5%), and metadata overhead (1%) | Output: `usableAfterRaidTiB`, `lfsOverheadTiB`, `metadataOverheadTiB`, `effectiveCapacityTiB` |
| FR-2.2 | Apply deduplication ratio when enabled | `effectiveCapacityTiB = usableBeforeDedupTiB * dedupRatio` |
| FR-2.3 | Display safe usable capacity at 75% of effective capacity | `safeUsableCapacityTiB = effectiveCapacityTiB * 0.75` |
| FR-2.4 | All storage quantities use TiB (binary, 2^40 bytes) throughout UI, engine, and exports | No "TB" labels appear anywhere; URL state fields are `hostStorageTiB` and `externalStorageUsableTiB` |

### FR-3: Storage Type Variants

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| FR-3.1 | vSAN Max: disaggregated storage with profile-based capacity (xs/sm/med/lrg/xl) and separate storage + compute node counts | `VsanMaxResult` includes `rawCapacityTiB`, `usableCapacityTiB`, node counts |
| FR-3.2 | FC/NFS: user provides total usable storage pool in TiB; per-host raw storage field is hidden; workload storage required is computed from `vmCount x avgStorageGbPerVm / 1024` | `externalStorageUsableTiB` is used as pool capacity; `workloadStorageRequiredTiB` shows actual VM demand; exports display both values |
| FR-3.3 | Stretch Cluster: effective per-site storage is halved (PFTT=1 mirror) | `effectivePerSiteStorageTiB` reflects the halving; bandwidth formula applies |

### FR-4: Management Overhead

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| FR-4.1 | Size management VMs (vCenter, SDDC Manager, NSX x3, Aria Ops, Aria Automation) with fixed resource profiles | `MgmtDomainResult` returns per-component and total cores/RAM |
| FR-4.2 | Colocated architecture deducts management overhead from workload domain capacity | Management cores and RAM subtracted from the first workload domain's available resources |
| FR-4.3 | Dedicated architecture adds separate management hosts to aggregate totals | `AggregateTotals.mgmtHostCount` is non-zero; management domain has its own host count |

### FR-5: Validation

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| FR-5.1 | Validate minimum host counts per topology (Simple >= 2, HA >= 4, Stretch >= 3+3) | Appropriate `ValidationWarning` with severity `error` is returned |
| FR-5.2 | Warn on invalid RAID/FTT combinations and dedup misconfigurations | Warning codes and i18n message keys are returned (never English strings) |
| FR-5.3 | Validate vSAN Max minimum storage node counts per profile | `belowMinNodes` flag set when storage nodes fall below profile minimum |

### FR-6: Export

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| FR-6.1 | Markdown export generates a complete sizing report with per-domain tables and aggregate summary | Downloaded `.md` file contains all configured domains with correct data |
| FR-6.2 | PPTX export generates slides with localized labels and embedded chart PNG images | Each domain slide includes a chart image; labels match the active locale |
| FR-6.3 | Exports render in the active UI locale, not hardcoded English | Switching to French and exporting produces French headings and labels |
| FR-6.4 | In-app Markdown preview renders HTML with sanitized output (DOMPurify) | Injecting `<script>` into a domain name does not execute; tables and headings render correctly |

### FR-7: UI/UX

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| FR-7.1 | 3-step wizard (Topology, Management, Workloads) guides new users through configuration | Steps are navigable; completed steps show checkmarks and are clickable for back-navigation |
| FR-7.2 | Topology change after workload configuration triggers a confirmation dialog | Cancelling preserves all data; confirming resets wizard to step 1 |
| FR-7.3 | Domain tab strip allows adding, removing, renaming, and duplicating workload domains | Copy produces a new domain with cloned settings and a generated name (e.g., "WLD-1 (copy)") |
| FR-7.4 | Per-domain result cards display Cores, RAM, and Storage charts | Three charts per domain with distinct canvas IDs; PNG data registered for PPTX export |

### FR-8: Internationalization

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| FR-8.1 | English locale bundled; FR-CH, DE-CH, IT-CH lazy-loaded on demand | Switching locale loads the JSON file dynamically; no increase to initial bundle |
| FR-8.2 | Swiss locales define explicit `numberFormats` (apostrophe thousands separator) | Numbers display as `1'234.56` in Swiss locales, not `1,234.56` |
| FR-8.3 | All validation messages use i18n keys | No raw English strings in validation warnings |

---

## Non-Functional Requirements

| ID | Requirement | Detail |
|----|------------|--------|
| NFR-1 | Client-side only | Entire application runs in the browser. Deployed as static files to GitHub Pages. |
| NFR-2 | No external API calls | Zero network requests after initial page load. All computation is local. |
| NFR-3 | URL state under 8 KB | Compressed configuration must stay within browser URL length limits. Zod schema strips unknown keys on hydration. |
| NFR-4 | XSS protection | All user-generated content in Markdown preview is sanitized via DOMPurify before DOM insertion. |
| NFR-5 | Lazy-loaded heavy dependencies | `pptxgenjs`, `marked`, and `dompurify` are loaded on first use, not at startup. |
| NFR-6 | Automated test coverage | 313 Vitest tests covering engine calculations, composables, and store logic. All tests run in Node (no DOM). |
| NFR-7 | Type safety | Full TypeScript coverage. `vue-tsc` type-check runs before every production build. |
| NFR-8 | Engine purity | Engine layer (`src/engine/`) has zero Vue/Pinia imports. Pure functions with typed inputs and outputs. |
| NFR-9 | Decimal precision | `decimal.js` used for storage arithmetic to avoid floating-point rounding errors. |
| NFR-10 | Responsive layout | Tailwind CSS with responsive breakpoints. Print stylesheet optimized for A4/Letter PDF output. |

---

## Architecture Summary

```
src/
  engine/         Pure TS functions (compute, storage, management, validation, stretch, vsanMax)
  stores/         Pinia stores: inputStore (mutable refs), calculationStore (computed only), uiStore
  composables/    useUrlState (lz-string + Zod), useMarkdownExport, usePptxExport
  components/
    input/        Form components (sliders, selectors, toggles)
    results/      Result cards, charts, aggregate totals
    shared/       Reusable UI (ConfirmDialog, WizardStepper, DomainTabStrip, MarkdownPreviewPanel)
  locales/        en.json (bundled), fr-CH.json, de-CH.json, it-CH.json (lazy)
```

Key constraints enforced by convention:
- Engine files never import Vue, Pinia, or any Vue ecosystem library.
- `calculationStore` contains only `computed()` -- zero `ref()`.
- Validation warnings reference i18n keys, never raw English strings.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3.5 + TypeScript |
| State | Pinia 3 |
| Styling | Tailwind CSS 4 |
| Charts | Chart.js 4 + vue-chartjs |
| Build | Vite 8 |
| Tests | Vitest 4 |
| i18n | vue-i18n 11 |
| URL compression | lz-string |
| Schema validation | Zod 4 |
| Precision math | decimal.js |
| PPTX generation | pptxgenjs 4 |
| Markdown rendering | marked 15 |
| Sanitization | DOMPurify 3 |
| Deployment | GitHub Pages (GitHub Actions on `maincd` branch) |

---

## Out of Scope

- **Backend / database** -- the application is a static SPA with no server-side component.
- **User authentication** -- no accounts, no login, no saved sessions.
- **Multi-user collaboration** -- configurations are shared via URL, not real-time sync.
- **Historical sizing comparisons** -- no side-by-side comparison of saved configurations.
- **vSphere 7.x or VCF 5.x calculations** -- engine targets VCF 9.x only.
- **vSAN OSA legacy calculations** -- only vSAN ESA is supported.
- **Dark mode** -- deferred to a future milestone.
- **Domain reordering** -- drag-and-drop tab reordering is deferred.

---

## Revision History

| Version | Date | Description |
|---------|------|-------------|
| v2.0 | 2026-03-29 | Architecture correctness, vSAN Max support |
| v2.1 | 2026-03-30 | Export quality (Markdown, Print/PDF, PPTX) |
| v3.0 | 2026-03-30 | Multi-domain support (workload + management domains) |
| v3.1 | 2026-04-04 | Sizing correctness, 3-step guided wizard |
| v3.3 | 2026-04-11 | UX polish (domain copy, topology guard, per-domain charts, localized exports, Markdown preview, TiB units) |
| v3.3.3 | 2026-04-15 | FC/NFS storage accuracy: workload storage computation, hide per-host storage, aggregate workload totals |
