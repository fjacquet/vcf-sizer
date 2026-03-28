# Roadmap: VCF Sizer

## Overview

The project builds a zero-backend browser SPA that computes VCF 9.x hardware requirements before hardware is ordered. Phase 1 lays the engine and all inputs — every formula is tested before any UI is built. Phase 2 surfaces results to the user via charts, a split-screen UI, and export/sharing capability. Phase 3 completes the differentiating features (Stretch Cluster, NVMe Tiering, Global Deduplication) and polishes the four-language Swiss experience.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation, Engine and Inputs** - Scaffold the project, port the storage engine from raidy, implement all calculation logic as pure TypeScript, and build all input panels
- [ ] **Phase 2: Outputs, Charts and Export** - Surface all computed results through a split-screen UI, real-time charts, shareable URL, and document export
- [ ] **Phase 3: Advanced Features and Polish** - Add Stretch Cluster, NVMe Memory Tiering, AI/GPU workloads, Global Deduplication, and complete all four Swiss locales

## Phase Details

### Phase 1: Foundation, Engine and Inputs

**Goal**: Architects can enter a complete VCF 9.x host and workload specification and the tool computes correct management domain overhead, compute requirements, and storage sizing
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, I18N-01, I18N-02, I18N-03, I18N-04, I18N-05, DEPLOY-01, DEPLOY-02, DEPLOY-03, MGMT-01, MGMT-02, MGMT-03, MGMT-04, MGMT-05, MGMT-06, MGMT-07, HOST-01, HOST-02, HOST-03, HOST-04, HOST-05, HOST-06, WKLD-01, WKLD-02, WKLD-03, WKLD-04, WKLD-05, WKLD-06, STOR-01, STOR-02, STOR-03, STOR-04, STOR-05, STOR-06, STOR-07, STOR-08, CALC-01, CALC-02, CALC-03, CALC-04, CALC-05
**Success Criteria** (what must be TRUE):

  1. User can scaffold the project with `npm run dev` and see a running app with language switcher defaulting to browser locale
  2. User can select Simple, High Availability, or Stretch Cluster deployment model and see management domain overhead change accordingly (x3 multiplier applies for HA/Stretch)
  3. User can enter host specs (cores, sockets, RAM, storage, host count) and see a hard blocker warning when the host has fewer than 12 physical cores
  4. User can enter workload profile (VM count, vCPU, vRAM, storage, overcommit ratios) and see total required compute updated without pressing a submit button
  5. User can select vSAN ESA with an FTT policy and see raw vs. usable capacity with all overhead layers (RAID + LFS + metadata) computed correctly — validated against raidy reference values

**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffold, Tailwind v4, vue-i18n v11 with all four Swiss locales, Pinia stores, LanguageSwitcher
- [ ] 01-02-PLAN.md — Calculation engine TDD: management.ts, compute.ts, storage.ts, validation.ts + calculationStore
- [ ] 01-03-PLAN.md — Input panel components: DeploymentModelSelector, HostSpecsForm, WorkloadProfileForm, StorageConfigForm + human verify

### Phase 2: Outputs, Charts and Export

**Goal**: Architects can read a complete sizing recommendation from a visual results panel, share the configuration via URL, and export a formatted report
**Depends on**: Phase 1
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05, VIZ-06, VIZ-07, EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-04
**Success Criteria** (what must be TRUE):

  1. User sees a split-screen layout with input panel on the left and results panel on the right; layout remains usable on mobile
  2. User sees bar or gauge charts for Cores Required vs. Available and RAM Required vs. Available updating in real time as inputs change
  3. User sees a storage chart showing raw capacity vs. usable capacity with a breakdown of each overhead layer
  4. User can copy a shareable URL that, when opened in a new browser tab, restores all input state exactly
  5. User can export a formatted Markdown sizing report and can print to PDF via browser print without installing any additional dependency
**Plans**: TBD

### Phase 3: Advanced Features and Polish

**Goal**: Architects working with Stretch Cluster topologies, NVMe-tiered hosts, AI/GPU workloads, and non-English Swiss locales get accurate sizing across all configurations
**Depends on**: Phase 2
**Requirements**: NVME-01, NVME-02, NVME-03, NVME-04, STRCH-01, STRCH-02, STRCH-03, STRCH-04, STRCH-05, GPU-01, GPU-02, GPU-03
**Success Criteria** (what must be TRUE):

  1. User can enable Stretch Cluster mode and enter preferred site and secondary site host counts independently, with witness node overhead included in totals and mutual exclusion with Global Deduplication enforced in the UI
  2. User can enable NVMe Memory Tiering, enter active memory percentage, and see required physical DRAM halved when active memory is at or below 50%
  3. User can enter GPU-accelerated VM count and vGPU profile and see additional host RAM required for vGPU overhead added to totals
  4. User can switch the UI to FR, DE, or IT and see all text, numbers, and currency formatted correctly for Swiss locales (apostrophe for de-CH, space for fr-CH) with no hardcoded English strings remaining
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Engine and Inputs | 0/3 | Not started | - |
| 2. Outputs, Charts and Export | 0/TBD | Not started | - |
| 3. Advanced Features and Polish | 0/TBD | Not started | - |
