# Requirements: VCF Sizer

**Defined:** 2026-03-28
**Core Value:** Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.

## v1 Requirements

### Project Foundation

- [x] **FOUND-01**: Project scaffolds with Vite 8 + Vue 3 (Composition API) + TypeScript
- [x] **FOUND-02**: Tailwind CSS v4 integrated via Vite plugin (no PostCSS config required)
- [x] **FOUND-03**: Pinia 3 state management installed and configured
- [x] **FOUND-04**: Decimal.js installed and used for all arithmetic (no native JS float math in calculation engine)
- [x] **FOUND-05**: Project deploys as static site to GitHub Pages, Vercel, or Netlify with no backend
- [x] **FOUND-06**: Unit test framework (Vitest) configured for pure calculation engine tests

### Internationalization

- [x] **I18N-01**: vue-i18n v11 installed with explicit Swiss locale declarations: `fr-CH`, `de-CH`, `it-CH`, `en`
- [x] **I18N-02**: Language switcher component allows selecting FR, EN, DE, IT
- [x] **I18N-03**: All visible UI text externalized to locale message files (no hardcoded strings)
- [x] **I18N-04**: Number formatting uses locale-aware `Intl.NumberFormat` per locale (apostrophe for `de-CH`, space for `fr-CH`)
- [x] **I18N-05**: Default language detected from browser locale; falls back to English

### Deployment Models

- [x] **DEPLOY-01**: User can select Simple (Lab/POC) deployment model
- [x] **DEPLOY-02**: User can select High Availability (Production) deployment model — applies x3 multiplier to NSX Manager, VCF Operations, VCF Automation
- [x] **DEPLOY-03**: User can select Stretch Cluster deployment model — 2-site topology with witness node

### Management Domain Sizing

- [x] **MGMT-01**: Tool computes vCenter Server baseline: 4 vCPU / 21 GB RAM (always 1 instance)
- [x] **MGMT-02**: Tool computes SDDC Manager baseline: 4 vCPU / 16 GB RAM (always 1 instance)
- [x] **MGMT-03**: Tool computes NSX Manager: 6 vCPU / 24 GB RAM × 1 (Simple) or × 3 (HA/Stretch)
- [x] **MGMT-04**: Tool computes VCF Operations: 4 vCPU / 16 GB RAM × 1 or × 3, plus Fleet Manager (12 GB) and Collector (16 GB)
- [x] **MGMT-05**: Tool computes VCF Automation (VCFA): 24 vCPU / 96 GB RAM × 1 (Simple) or × 3 (HA/Stretch)
- [x] **MGMT-06**: Tool displays total management domain overhead: aggregate vCPU and RAM before workload addition
- [x] **MGMT-07**: Tool shows prominent blocker warning when selected host has fewer than 12 physical cores (24 threads) — VCFA deployment prerequisite

### Host Specifications

- [x] **HOST-01**: User can input number of cores per socket
- [x] **HOST-02**: User can input number of sockets per host
- [x] **HOST-03**: User can input total RAM per host (GB)
- [x] **HOST-04**: User can input raw storage per host (TB) for vSAN configurations
- [x] **HOST-05**: User can input number of hosts in the cluster
- [x] **HOST-06**: Tool validates host minimum for each selected deployment model (VCFA blocker enforced)

### Workload Profiles

- [x] **WKLD-01**: User can input number of VMs
- [x] **WKLD-02**: User can input average vCPU per VM
- [x] **WKLD-03**: User can input average vRAM per VM (GB)
- [x] **WKLD-04**: User can input average storage per VM (GB)
- [x] **WKLD-05**: User can input vCPU over-commitment ratio (default 4:1)
- [x] **WKLD-06**: User can input RAM over-commitment ratio (default 1:1)

### Storage Engine

- [x] **STOR-01**: User can select principal storage: vSAN ESA, Fibre Channel (FC), or NFS
- [x] **STOR-02**: vSAN ESA capacity calculation applies Adaptive RAID-5 thresholds (2+1 at 5 hosts; 4+1 at 6+ hosts) — port from raidy
- [x] **STOR-03**: vSAN ESA calculation stacks all overhead layers: RAID overhead + LFS overhead (~13%) + global metadata pool (~10%) — port from raidy
- [x] **STOR-04**: User can select FTT policy (FTT=1 RAID-1, FTT=1 RAID-5, FTT=2 RAID-6)
- [x] **STOR-05**: Global Deduplication toggle available for vSAN ESA (disabled when: Stretch Cluster selected, encryption active, < 3 or > 16 hosts, < 25GbE)
- [x] **STOR-06**: Global Deduplication ratio configurable (default 2x conservative; user adjustable)
- [x] **STOR-07**: FC and NFS paths skip vSAN overhead, show raw capacity pass-through
- [x] **STOR-08**: Tool displays raw capacity vs. net usable capacity with breakdown of each overhead layer

### NVMe Memory Tiering

- [ ] **NVME-01**: NVMe Memory Tiering toggle available (ESXi 9.x feature)
- [ ] **NVME-02**: When enabled, user inputs estimated active memory % (0-100)
- [ ] **NVME-03**: When active memory ≤ 50%, tool recalculates required physical DRAM as half the total (1:1 DRAM-to-NVMe ratio)
- [ ] **NVME-04**: Tool displays prerequisite notice: requires Class D+ NVMe at 3+ DWPD

### Stretch Cluster

- [ ] **STRCH-01**: Stretch cluster configures preferred site and secondary site independently (host count, storage per site)
- [ ] **STRCH-02**: Witness node overhead calculated and added to total resource requirements
- [ ] **STRCH-03**: Storage calculation uses PFTT=1 + SFTT policy — data written to both sites
- [ ] **STRCH-04**: Mutual exclusion enforced: Stretch Cluster + Global Deduplication cannot both be active (UI prevents combination)
- [ ] **STRCH-05**: Minimum bandwidth recommendation displayed (cross-site link sizing guidance)

### AI / GPU Workloads

- [ ] **GPU-01**: User can input number of GPU-accelerated VMs
- [ ] **GPU-02**: User can input vGPU profile (memory per vGPU, GB)
- [ ] **GPU-03**: Tool computes additional host RAM required for vGPU overhead (2-3x vGPU memory per host)

### Calculation Engine

- [x] **CALC-01**: All formulas implemented as pure TypeScript functions with no Vue imports (testable with Vitest)
- [x] **CALC-02**: Calculation store (`calculationStore`) exposes only `computed()` read-only results derived from `inputStore`
- [x] **CALC-03**: Total cluster compute output: required vCPUs, required RAM, available vCPUs, available RAM, utilization %
- [x] **CALC-04**: Minimum host count recommendation computed and displayed
- [x] **CALC-05**: Context7 MCP used to verify all library API calls before implementation

### Visualizations

- [ ] **VIZ-01**: Split-screen layout: input panel (left), results panel (right), responsive on mobile
- [ ] **VIZ-02**: Bar or gauge chart: Total Cores Required vs. Available
- [ ] **VIZ-03**: Bar or gauge chart: Total RAM Required vs. Available
- [ ] **VIZ-04**: Storage chart: Raw Capacity vs. Usable Capacity with overhead breakdown
- [ ] **VIZ-05**: Host count summary card prominently displayed
- [ ] **VIZ-06**: Charts update in real-time as inputs change (no submit button)
- [ ] **VIZ-07**: Chart.js + vue-chartjs using `computed()` returning new object references bound to `:data` prop — no `shallowRef` needed with declarative vue-chartjs (verified in Phase 2 research)

### Export & Sharing

- [ ] **EXPORT-01**: Shareable URL generated using lz-string compression + Base64URL encoding of full input state
- [ ] **EXPORT-02**: Loading a shared URL restores all input state exactly
- [ ] **EXPORT-03**: Export to Markdown: formatted sizing report with all computed values
- [ ] **EXPORT-04**: Export to PDF via browser print CSS (`@media print`) — no html2canvas dependency

## v2 Requirements

### Extended Workload Types

- **WKLD-V2-01**: Kubernetes/Tanzu workload sizing inputs
- **WKLD-V2-02**: VCF Fleet multi-cluster topology planning

### Extended Storage

- **STOR-V2-01**: vSAN OSA (legacy) overhead calculations
- **STOR-V2-02**: NVMe-oF / disaggregated storage support

### UI Enhancements

- **UI-V2-01**: Dark mode toggle
- **UI-V2-02**: Save/load named configurations to browser localStorage
- **UI-V2-03**: Side-by-side comparison of two sizing configurations

### GPU Extended

- **GPU-V2-01**: Full vGPU profile library (A16, A30, A100, H100 profiles with exact memory specs)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend API / server-side logic | Zero-infrastructure static hosting is a core requirement |
| User accounts / auth | URL sharing covers persistence; accounts add complexity |
| VCF 5.x / vSphere 7.x calculations | VCF 9.x architectural changes make shared formulas misleading |
| Real-time pricing / BOM generation | Prices vary by region/partner; scope creep risk |
| VMware Cloud (VMC on AWS) sizing | Different capacity model; separate tool concern |
| html2canvas PDF export | Fragile, large output, font loss — print CSS is superior |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 to FOUND-06 | Phase 1 | Pending |
| I18N-01 to I18N-05 | Phase 1 | Pending |
| DEPLOY-01 to DEPLOY-03 | Phase 1 | Pending |
| MGMT-01 to MGMT-07 | Phase 1 | Pending |
| HOST-01 to HOST-06 | Phase 1 | Pending |
| WKLD-01 to WKLD-06 | Phase 1 | Pending |
| STOR-01 to STOR-08 | Phase 1 | Pending |
| CALC-01 to CALC-05 | Phase 1 | Pending |
| VIZ-01 to VIZ-07 | Phase 2 | Pending |
| EXPORT-01 to EXPORT-04 | Phase 2 | Pending |
| NVME-01 to NVME-04 | Phase 3 | Pending |
| STRCH-01 to STRCH-05 | Phase 3 | Pending |
| GPU-01 to GPU-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 55
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 — traceability updated for 3-phase coarse roadmap*
