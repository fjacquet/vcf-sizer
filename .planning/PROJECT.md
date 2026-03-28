# VCF Sizer

## What This Is

A fast, client-side, interactive sizing calculator for VCF 9.x deployments. Cloud architects, VI admins, and VMware Cloud Service Providers use it to accurately estimate compute, memory, and storage requirements — preventing under-provisioning and optimizing hardware purchasing decisions. The tool runs entirely in the browser with no backend dependency, supports four languages (FR/EN/DE/IT), and accounts for VCF 9's new deployment models including stretch architecture.

## Core Value

Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Deployment model selection: Simple (Lab/POC), High Availability (Production), Stretch Cluster (2-site)
- [ ] Management domain baseline sizing (vCenter, SDDC Manager, NSX Manager, VCF Operations, VCF Automation)
- [ ] HA multiplier (x3) for NSX Manager, VCF Operations, VCF Automation in production mode
- [ ] Hard warning if host has fewer than 12 Cores / 24 Threads (VCFA deployment blocker)
- [ ] Workload profile inputs: VM count, average vCPU, vRAM, storage per VM
- [ ] AI/GPU workload inputs: Private AI sizing with vGPU memory overhead
- [ ] Physical host specification inputs: cores per socket, total RAM, storage
- [ ] NVMe Memory Tiering toggle (ESXi 9.x): 1:1 DRAM-to-NVMe ratio at ≤50% active memory
- [ ] Principal storage selection: vSAN ESA (with Global Deduplication toggle), Fibre Channel, NFS
- [ ] Stretch cluster configuration: cross-site witness node, preferred/secondary site inputs
- [ ] Real-time calculation: total cores required vs. available, RAM required vs. available
- [ ] Storage visualization: raw vs. usable capacity after vSAN overhead/deduplication
- [ ] Host count recommendation: minimum hosts to run cluster safely
- [ ] Chart visualizations (Chart.js or Recharts)
- [ ] Export to Markdown or PDF
- [ ] Shareable URL with base64-encoded configuration
- [ ] Multi-language support: FR, EN, DE, IT (Switzerland locales)
- [ ] Responsive, modern UI (Tailwind CSS)

### Out of Scope

- Backend/server-side logic — client-only SPA for zero-infrastructure hosting
- User accounts or saved sessions (URL sharing covers persistence)
- vSphere 7.x or VCF 5.x calculations — VCF 9.x only

## Context

VCF 9 introduces significant changes that make sizing more complex:
- VCFA requires a minimum 24 vCPU / 96 GB RAM, multiplied by 3 for HA
- NVMe Memory Tiering can halve DRAM requirements when active memory ≤ 50% of DRAM
- Global Deduplication on vSAN ESA changes storage efficiency calculations
- Stretch cluster adds witness node overhead and cross-site networking considerations
- Target users are in Switzerland — FR/EN/DE/IT localization is essential from day one

Tool should be deployable to GitHub Pages, Vercel, or Netlify as a static site.

## Constraints

- **Tech Stack**: Vue 3 (Composition API) + Tailwind CSS + Pinia for state — or React + Zustand; decision to be finalized during research
- **Runtime**: Pure client-side (browser only), no backend API calls
- **Deployment**: Static hosting compatible (GitHub Pages, Vercel, Netlify)
- **Localization**: FR, EN, DE, IT from day one — i18n library required
- **Verification**: Use Context7 MCP to validate library APIs and VCF 9.x documentation before implementation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side only | Zero infrastructure cost, instant global availability | — Pending |
| Stretch architecture support | Swiss deployments commonly span 2 sites | — Pending |
| FR/EN/DE/IT localization | Switzerland has 4 official languages | — Pending |
| VCF 9.x only scope | VCF 9 introduces breaking architectural changes | — Pending |

---
*Last updated: 2026-03-28 after initialization*
