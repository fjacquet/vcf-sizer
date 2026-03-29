# VCF Sizer

## What This Is

A fast, client-side, interactive sizing calculator for VCF 9.x deployments. Cloud architects, VI admins, and VMware Cloud Service Providers use it to accurately estimate compute, memory, and storage requirements — preventing under-provisioning and optimizing hardware purchasing decisions.

The tool runs entirely in the browser with no backend dependency, supports four languages (FR/EN/DE/IT), and covers all VCF 9 deployment topologies: Simple, HA, Stretch Cluster, and vSAN Max (disaggregated storage clusters). As of v2.0, it enforces spec-correct bandwidth floors and network validation for stretch deployments, models dedicated vs co-located management architecture, and sizes vSAN Max ReadyNode storage clusters independently from compute.

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
- ✓ Dedicated management cluster toggle (4-host minimum per KB 392993) — v2.0
- ✓ Co-located minimum host validation (3 for vSAN, 2 for FC/NFS) — v2.0
- ✓ vSAN Max storage cluster sizing (5 ReadyNode profiles, disaggregated topology) — v2.0
- ✓ vSAN Max dual output: storage cluster + compute cluster independently sized — v2.0
- ✓ vSAN Max minimum 4-node validation — v2.0
- ✓ Network speed selector (10/25/100 GbE) affecting dedup eligibility and stretch bandwidth cap — v2.0

### Active

(None — all v2.0 requirements shipped)

### Out of Scope

- Backend/server-side logic — client-only SPA for zero-infrastructure hosting
- User accounts or saved sessions (URL sharing covers persistence)
- vSphere 7.x or VCF 5.x calculations — VCF 9.x only
- vSAN Max stretched topology — disaggregated vSAN-SC + stretch is a separate feature; defer to v2.1
- vSAN OSA legacy calculations — out of scope for VCF 9.x focus
- Side-by-side configuration comparison, localStorage saves, dark mode — UI backlog

## Context

**Shipped v2.0 with ~3,900 LOC TypeScript + Vue 3.**
Tech stack: Vue 3 (Composition API), Vite 8, Tailwind CSS v4, Pinia 3, Decimal.js, vue-i18n v11, Chart.js via vue-chartjs, lz-string + Zod for URL state, Vitest for unit tests.

120 tests passing. Build: 169 modules, 467 kB bundle (gzip 159 kB). 4 locale files (en/fr/de/it).

**Architecture patterns established:**
- Engine layer: pure TypeScript, zero Vue imports (CALC-01)
- State layer: calculationStore exposes only `computed()`, zero `ref()` (CALC-02)
- URL state: atomic Zod triple-sync (schema + hydrate + serialize)
- TDD discipline: failing tests before implementation throughout

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

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-03-29 — v2.0 milestone complete*
