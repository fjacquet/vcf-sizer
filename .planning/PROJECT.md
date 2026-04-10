# VCF Sizer

## What This Is

A fast, client-side, interactive sizing calculator for VCF 9.x deployments. Cloud architects, VI admins, and VMware Cloud Service Providers use it to accurately estimate compute, memory, and storage requirements — preventing under-provisioning and optimizing hardware purchasing decisions.

The tool runs entirely in the browser with no backend dependency, supports four languages (FR/EN/DE/IT), and covers all VCF 9 deployment topologies: Simple, HA, Stretch Cluster, and vSAN Max (disaggregated storage clusters). As of v3.1, the tool guides users through a 3-step wizard (Topology → Management → Workloads) enforcing the correct VCF design sequence, and supports unlimited independently-configured workload domains with per-domain result cards, aggregate totals, and full export in Markdown, PDF, and PowerPoint.

## Core Value

Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.

## Requirements

### Validated

- ✓ Deployment model selection: Simple, HA, Stretch Cluster — v1.0
- ✓ Management domain baseline sizing (vCenter, SDDC Manager, NSX Manager, VCF Operations, VCF Automation) — v1.0
- ✓ HA multiplier (x3) for NSX Manager, VCF Operations, VCF Automation — v1.0
- ✓ Hard warning if host < 12 cores / 24 threads (VCFA blocker) — v1.0
- ✓ Workload profile inputs (VM count, vCPU, vRAM, storage per VM) — v1.0
- ✓ AI/GPU workload inputs with vGPU memory overhead — v1.0
- ✓ Physical host specification inputs — v1.0
- ✓ NVMe Memory Tiering toggle (ESXi 9.x, 1:1 DRAM:NVMe at ≤50% active memory) — v1.0
- ✓ Principal storage: vSAN ESA (with Global Dedup toggle), Fibre Channel, NFS — v1.0
- ✓ Stretch cluster configuration: cross-site witness, preferred/secondary site inputs — v1.0
- ✓ Real-time compute calculation (cores/RAM required vs available) — v1.0
- ✓ Storage visualization: raw vs usable with overhead breakdown — v1.0
- ✓ Host count recommendation — v1.0
- ✓ Chart visualizations (Chart.js via vue-chartjs) — v1.0
- ✓ Export to Markdown and PDF — v1.0
- ✓ Shareable URL with lz-string + Zod validation — v1.0
- ✓ Multi-language FR/EN/DE/IT (Switzerland locales) — v1.0
- ✓ Responsive UI (Tailwind CSS v4) — v1.0
- ✓ 10 Gbps bandwidth floor for stretch inter-site bandwidth — v2.0
- ✓ Bandwidth floor indicator surfaced in UI — v2.0
- ✓ Stretch network checklist (MTU 9000, RTT, witness RTT) — v2.0
- ✓ Dedicated management cluster toggle (4-host minimum per KB 392993 for vSAN; 2-host minimum for FC/NFS per KB 416270) — v2.0 / v3.2
- ✓ Co-located minimum host validation (3 for vSAN, 2 for FC/NFS) — v2.0
- ✓ vSAN Max storage cluster sizing (5 ReadyNode profiles, disaggregated topology) — v2.0
- ✓ vSAN Max dual output: storage cluster + compute cluster independently sized — v2.0
- ✓ vSAN Max minimum 4-node validation — v2.0
- ✓ Network speed selector (10/25/100 GbE) affecting dedup eligibility and stretch bandwidth cap — v2.0
- ✓ Markdown export: complete 11-section report (workload, mgmt, NVMe, AI/GPU, stretch, vSAN Max, warnings, network) — v2.1
- ✓ Print/PDF: results-only layout with A4 page geometry, break-inside-avoid, running header/footer — v2.1
- ✓ Print/PDF: chart print fallbacks as semantic data tables — v2.1
- ✓ PPTX export: 7 always-present slides with Broadcom blue (#003087) slide master, dynamic import (zero bundle impact) — v2.1
- ✓ PPTX export: 5 conditional slides (AI/GPU, NVMe, Stretch, vSAN Max, Warnings) — v2.1
- ✓ Domain data model: WorkloadDomainConfig (26 fields + id/name), ManagementDomainConfig (independent host specs), DomainResult, AggregateTotals — v3.0
- ✓ Multiple workload domains with independent host specs, workload profiles, storage configs, and optional features per domain — v3.0
- ✓ Tab-based domain UI with unlimited add/remove of named workload domains, inline rename, confirmation on delete — v3.0
- ✓ Full multi-domain URL state (lz-string/Zod with variable-length domain arrays), v2.x backward compat — v3.0
- ✓ Per-domain result cards + AggregateTotalsCard showing procurement total — v3.0
- ✓ Per-domain sections in Markdown and PPTX exports + aggregate totals — v3.0
- ✓ Engine correctness: management overhead routed only to WLD-1 in colocated mode (no double-counting) — v3.1
- ✓ 3-step wizard: WizardStepper indicator, TopologySelector gate (step 1), management validation gate (step 2) — v3.1
- ✓ Management result card at end of step 2; committed summary panel at top of step 3 — v3.1
- ✓ Shareable URL never encodes wizard step position — v3.1
- ✓ Management hosts line in Markdown and PPTX aggregate exports (dedicated: count, colocated: "colocated with WLD-1") — v3.1

## Current Milestone: v3.3 UX Polish & Export Quality

**Goal:** Improve user experience through wizard navigation enhancements and domain management features, while enriching exports with visuals, localization, and in-app preview.

**Target features:**
- Click WizardStepper step to jump back to a previous step
- Landing / intro view shown on first load before wizard starts
- Topology change confirmation dialog when workloads already configured
- Domain duplication ("Copy domain" button)
- Chart images (PNG) embedded in PPTX slides (rasterized from Chart.js)
- Per-domain Chart.js visualizations in result cards
- Localized Markdown + PPTX exports (follow active UI locale)
- In-app Markdown preview panel before download

### Active

*(Defined — see REQUIREMENTS.md)*

### Deferred (post-v3.3)

- Dark mode print stylesheet
- Domain reordering (drag-and-drop tab reordering)
- Advanced mode: toggle between wizard and classic flat layout

### Out of Scope

- Backend/server-side logic — client-only SPA for zero-infrastructure hosting
- User accounts or saved sessions (URL sharing covers persistence)
- vSphere 7.x or VCF 5.x calculations — VCF 9.x only
- vSAN OSA legacy calculations — out of scope for VCF 9.x focus
- Side-by-side comparison columns, localStorage saves — UI backlog
- Per-locale export file naming — deferred
- Server-side PDF rendering — `jsPDF`/`html2canvas` rejected: bundle cost and quality

## Current State

**Shipped v3.1 (2026-04-04)** — 7,176 LOC TypeScript + Vue 3. 271 tests passing.

Tech stack: Vue 3 (Composition API), Vite 8, Tailwind CSS v4, Pinia 3, Decimal.js, vue-i18n v11, Chart.js via vue-chartjs, lz-string + Zod for URL state, pptxgenjs 4.0.1 (dynamic import), Vitest for unit tests. Deployed on GitHub Pages at `/vcf-sizer/`.

**Architecture patterns established:**

- Engine layer: pure TypeScript, zero Vue imports (CALC-01)
- State layer: calculationStore exposes only `computed()`, zero `ref()` (CALC-02)
- URL state: atomic Zod triple-sync (schema + hydrate + serialize); wizard step never serialized
- TDD discipline: failing tests before implementation throughout (Wave 0 pattern)
- Export composables: plain TypeScript (no Vue lifecycle hooks), pure data-mapping helpers for testability
- pptxgenjs: dynamic `import()` inside function body keeps it out of initial bundle (PPTX-15)
- ManagementStorageType = Exclude<StorageType, 'vsan-max'> — narrower type for management domain (v3.2)

**Known pending:** Verify ReadyNode profile hardware minimums (NVMe counts, RAM minimums) against Broadcom compatibility guide at production deployment time.

## Constraints

- **Tech Stack**: Vue 3 (Composition API) + Tailwind CSS v4 + Pinia 3 — confirmed in Phase 1
- **Runtime**: Pure client-side (browser only), no backend API calls
- **Deployment**: Static hosting compatible (GitHub Pages, Vercel, Netlify)
- **Localization**: FR, EN, DE, IT from day one (fr-CH, de-CH, it-CH BCP47 codes)
- **Engine purity**: No Vue imports in engine layer; calculationStore zero ref() — CALC-01/02

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side only | Zero infrastructure cost, instant global availability | ✓ Works — GitHub Pages deploy |
| Stretch architecture support | Swiss deployments commonly span 2 sites | ✓ Fully modeled in Phase 3 |
| FR/EN/DE/IT localization | Switzerland has 4 official languages | ✓ All 4 locales shipped in every phase |
| VCF 9.x only scope | VCF 9 introduces breaking architectural changes | ✓ Correct decision — no confusion |
| Adaptive RAID-5 gate | 4-5 nodes → 2+1 (1.5x overhead), 6+ nodes → 4+1 (1.25x) | ✓ Confirmed by Broadcom blog |
| Decimal.js for all arithmetic | Prevent float rounding in capacity math | ✓ Zero precision bugs |
| lz-string + Zod for URL state | Compress + validate untrusted input atomically | ✓ Round-trip tested |
| vue-chartjs declarative :data prop | No shallowRef needed, computed() drives charts | ✓ Reactivity clean |
| calcStorage() exhaustive switch | Compile-time exhaustiveness check for storage types | ✓ Enforced from v2.0 |
| vSAN Max separate engine module | Disaggregated topology != HCI; distinct storageNodeCount | ✓ Clean separation |
| networkSpeedGbE global input | Affects dedup eligibility + stretch bandwidth cap | ✓ Single source of truth |
| useMarkdownExport.ts composable | Extract from useUrlState.ts; pure TS, no lifecycle hooks | ✓ Testable, clean separation — v2.1 |
| usePptxExport.ts composable | Same pattern as markdown; dynamic import keeps bundle clean | ✓ 271 tests pass, zero bundle impact |
| pptxgenjs local type defs | Namespace import from dynamic import fails; local interfaces match actual usage | ✓ vue-tsc clean |
| Print chart fallback as `<table>` | `print:table` on hidden semantic tables; `print:hidden` on canvas | ✓ Cross-browser compatible |
| @page in global style.css | Scoped Vue styles ignore @page; global CSS required for print page geometry | ✓ A4 portrait margins applied |
| currentWizardStep in uiStore only | Wizard step is ephemeral UI state — never serialized to URL (WIZARD-07) | ✓ URL sharing always opens at step 1 — v3.1 |
| topologyConfirmed ephemeral flag | Gates step 1→2 transition without polluting URL state | ✓ Clean wizard flow — v3.1 |
| ManagementStorageType = Exclude<StorageType, 'vsan-max'> | vSAN Max is not a valid management domain storage type | ✓ Type-safe, CodeRabbit-validated — v3.2 |
| FC/NFS dedicated management min = 2 (HA) / 4 (stretch) | VCF 9.0 installer allows 2 hosts with external storage (KB 416270) | ✓ Confirmed by Broadcom techdocs — v3.2 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-04-10 — milestone v3.3 started*
