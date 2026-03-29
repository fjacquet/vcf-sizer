# Roadmap: VCF Sizer

## Overview

The project builds a zero-backend browser SPA that computes VCF 9.x hardware requirements before hardware is ordered. Phase 1 lays the engine and all inputs — every formula is tested before any UI is built. Phase 2 surfaces results to the user via charts, a split-screen UI, and export/sharing capability. Phase 3 completes the differentiating features (Stretch Cluster, NVMe Tiering, Global Deduplication) and polishes the four-language Swiss experience. Phase 4 (v2.0-A) remediates live correctness gaps — bandwidth floor bug, stretch network checklist, and management architecture validation. Phase 5 (v2.0-B) adds the vSAN Max disaggregated storage cluster as a new engine subsystem with its own UI.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation, Engine and Inputs** - Scaffold the project, port the storage engine from raidy, implement all calculation logic as pure TypeScript, and build all input panels (completed 2026-03-28)
- [x] **Phase 2: Outputs, Charts and Export** - Surface all computed results through a split-screen UI, real-time charts, shareable URL, and document export (completed 2026-03-29)
- [ ] **Phase 3: Advanced Features and Polish** - Add Stretch Cluster, NVMe Memory Tiering, AI/GPU workloads, Global Deduplication, and complete all four Swiss locales
- [ ] **Phase 4: Correctness and Architecture Validation** - Enforce the 10 Gbps stretch bandwidth floor, surface the stretch network requirements checklist, and add management architecture host-minimum validation
- [ ] **Phase 5: vSAN Max Storage Cluster** - Add vSAN Max as a new disaggregated storage type with 5 ReadyNode profiles, separate storage and compute cluster sizing, and minimum node validation

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

**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md — Project scaffold, Tailwind v4, vue-i18n v11 with all four Swiss locales, Pinia stores, LanguageSwitcher
- [x] 01-02-PLAN.md — Calculation engine TDD: management.ts, compute.ts, storage.ts, validation.ts + calculationStore
- [x] 01-03-PLAN.md — Input panel components: DeploymentModelSelector, HostSpecsForm, WorkloadProfileForm, StorageConfigForm + human verify

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

**Plans:** 2/2 plans complete

Plans:
- [x] 02-01-PLAN.md — Install deps + split-screen layout + HostCountCard + CoresChart + RamChart + StorageChart
- [x] 02-02-PLAN.md — URL state composable (lz-string + Zod) + main.ts hydration + ExportToolbar (Share URL, Markdown, PDF print)

### Phase 3: Advanced Features and Polish

**Goal**: Architects working with Stretch Cluster topologies, NVMe-tiered hosts, AI/GPU workloads, and non-English Swiss locales get accurate sizing across all configurations
**Depends on**: Phase 2
**Requirements**: NVME-01, NVME-02, NVME-03, NVME-04, STRCH-01, STRCH-02, STRCH-03, STRCH-04, STRCH-05, GPU-01, GPU-02, GPU-03
**Success Criteria** (what must be TRUE):

  1. User can enable Stretch Cluster mode and enter preferred site and secondary site host counts independently, with witness node overhead included in totals and mutual exclusion with Global Deduplication enforced in the UI
  2. User can enable NVMe Memory Tiering, enter active memory percentage, and see required physical DRAM halved when active memory is at or below 50%
  3. User can enter GPU-accelerated VM count and vGPU profile and see additional host RAM required for vGPU overhead added to totals
  4. User can switch the UI to FR, DE, or IT and see all text, numbers, and currency formatted correctly for Swiss locales (apostrophe for de-CH, space for fr-CH) with no hardcoded English strings remaining

**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — Engine + stores: extend types.ts, compute.ts (NVMe+GPU TDD), new stretch.ts (TDD), extend validation.ts (STRETCH_MIN_HOSTS), extend inputStore + calculationStore
- [ ] 03-02-PLAN.md — UI: HostSpecsForm (NVMe section), DeploymentModelSelector (stretch site inputs + witness), WorkloadProfileForm (GPU section), StorageConfigForm (dedup disable), all 4 locale files + human verify

### Phase 4: Correctness and Architecture Validation

**Goal**: Architects using stretch cluster and management architecture configurations receive spec-correct bandwidth recommendations, a network requirements checklist, and host-minimum validation aligned with Broadcom KB 392993
**Depends on**: Phase 3
**Requirements**: STRCH-06, STRCH-07, STRCH-08, ARCH-01, ARCH-02
**Success Criteria** (what must be TRUE):

  1. User sees a minimum 10 Gbps bandwidth recommendation for any stretch cluster configuration regardless of workload size, with a visible indicator when the floor has been applied rather than the formula result
  2. User sees a stretch network checklist (MTU 9000, site-to-site RTT < 5ms, witness RTT threshold derived from per-site host count) when stretch mode is active, displayed in all four Swiss locales
  3. User can toggle "Dedicated management cluster" in HA or Stretch mode and sees an error when fewer than 4 management hosts are provisioned
  4. User working in co-located mode with below-minimum hosts sees an informational note pointing to the minimum required host count for vSAN vs FC/NFS configurations

**Plans:** 2 plans

Plans:
- [ ] 04-01-PLAN.md — Engine + stores: extend types.ts (ManagementArchitecture, StretchNetworkChecklist, StretchResult fields), TDD bandwidth floor + checklist in stretch.ts, validation rules (ARCH-01/02), inputStore + calculationStore + useUrlState sync
- [ ] 04-02-PLAN.md — UI: DeploymentModelSelector (architecture toggle + bandwidth floor indicator), StretchNetworkChecklist.vue output card, ResultsPanel wiring, all 4 locale files + human verify

**Key constraints:**
- `engine/types.ts` additive changes (new union members, new interfaces, new optional fields) must land before any other file in this phase
- Bandwidth floor patch must update the existing stretch test first (TDD: write the failing test before adding the floor constant)
- All new i18n keys must appear in all 4 locale files (en, fr, de, it) in the same commit as the UI component that uses them
- Use "Dedicated Domains" / "Co-located" terminology in all UI strings; engine enum values (`'shared' | 'dedicated'`) may remain abbreviated

### Phase 5: vSAN Max Storage Cluster

**Goal**: Architects sizing a disaggregated vSAN Max deployment can select a ReadyNode profile, specify separate storage and compute cluster host counts, and receive independently sized storage cluster and compute cluster outputs with minimum node validation
**Depends on**: Phase 4
**Requirements**: VMAX-01, VMAX-02, VMAX-03
**Success Criteria** (what must be TRUE):

  1. User can select "vSAN Max (Storage Cluster)" as a storage type and choose one of 5 ReadyNode profiles (XS / SM / MED / LRG / XL); tool displays the node count required, raw capacity, and usable capacity for the storage cluster
  2. User sees two distinct host count outputs — storage cluster nodes and compute cluster nodes — with the compute cluster sized using the standard HCI engine (no vSAN overhead applied to compute hosts)
  3. User sees a validation error when the storage node count is below 4, preventing under-provisioning of the minimum vSAN-SC cluster size
  4. A shared URL containing a vSAN Max configuration restores the storage type, selected profile, storage node count, and compute node count exactly on reload

**Plans**: TBD

**Key constraints:**
- Zod URL schema must be updated atomically with any new `inputStore` field; add a `URL_STATE_FIELDS` constant and a schema completeness test before writing UI
- `calcStorage()` must be converted to an exhaustive `switch` with a `never` case before `'vsan-max'` is added to the `StorageType` union
- `calcVsanMax()` must live in `engine/vsanMax.ts` and receive a `VsanMaxInputs` argument with distinct `storageNodeCount` and `computeNodeCount` — never reuse the HCI `hostCount`
- Verify ReadyNode profile constants (especially MED/LRG/XL NVMe counts and XS RAM minimum) against `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance` before hardcoding
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Engine and Inputs | 3/3 | Complete | 2026-03-28 |
| 2. Outputs, Charts and Export | 2/2 | Complete | 2026-03-29 |
| 3. Advanced Features and Polish | 0/2 | Not started | - |
| 4. Correctness and Architecture Validation | 0/2 | Not started | - |
| 5. vSAN Max Storage Cluster | 0/? | Not started | - |
