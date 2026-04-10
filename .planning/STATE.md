---
gsd_state_version: 1.0
milestone: v3.3
milestone_name: UX Polish & Export Quality
status: in_progress
stopped_at: Defining requirements
last_updated: "2026-04-10T00:00:00.000Z"
last_activity: 2026-04-10
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.
**Current focus:** v3.3 milestone — UX Polish & Export Quality

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-10 — Milestone v3.3 started

## Pending Todos

- Verify ReadyNode profile hardware minimums (NVMe counts, RAM minimums) against Broadcom compatibility guide at production deployment time
- Document colocated overhead formula as an engineering assumption in calculationStore.ts comments (no official Broadcom VCF 9 spec exists)

## Accumulated Context

- Engine layer must remain zero Vue imports (CALC-01)
- calculationStore must remain zero ref() — only computed() (CALC-02)
- All validation messages use i18n keys, never raw English strings
- 271 tests passing as of v3.2 — TDD discipline maintained throughout
- Export composables are plain TypeScript (no Vue lifecycle hooks) for testability
- pptxgenjs dynamic import pattern keeps it out of initial bundle (PPTX-15)
- Chart.js canvas rasterization for PPTX will need html2canvas or toDataURL() approach
- Wizard step position is ephemeral and never serialized to URL (WIZARD-07)
- ManagementStorageType = Exclude<StorageType, 'vsan-max'> established in v3.2
