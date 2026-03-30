---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Sizing Correctness & Guided Workflow
status: executing
stopped_at: Completed 15-01-PLAN.md — ENGINE-01/02/03 TDD tests (retrospective)
last_updated: "2026-03-30T19:20:08.724Z"
last_activity: 2026-03-30
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 11
  completed_plans: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.
**Current focus:** Phase 15 — engine-correctness

## Current Position

Phase: 15 (engine-correctness) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-03-30

Progress: [---       ] 0/3 phases formally verified (Phase 15 implemented)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 04 | 01 | 8min | 2 | 9 |
| 14 | 02 | 15min | 2 | 2 |

*Updated after each plan completion*
| Phase 14 P02 | 15min | 2 tasks | 2 files |
| Phase 15 P01 | 5min | 1 tasks | 0 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

v3.1 decisions (pending implementation):

- [Roadmap]: Engine fix is highest-risk change — TDD required: write failing tests for colocated/dedicated aggregate behavior before touching calculationStore.ts
- [Roadmap]: currentWizardStep belongs in uiStore exclusively — never in InputStateSchema or calculationStore (prevents URL contamination and CALC-02 violation)
- [Roadmap]: Wizard onMounted must never call inputStore.$reset() — only set uiStore.currentWizardStep = 1; URL-hydrated state must be preserved
- [Roadmap]: Step 1 must write deploymentMode to BOTH managementDomain AND all workloadDomains atomically — mixed topologies are not supported
- [Roadmap]: Export composable updates are mandatory in the same phase as AggregateTotals type changes (avoids UI/export discrepancy)
- [Phase 14]: buildAggregateSlideData(totals) replaces buildRecommendationsData — summarizes all domains in 4 rows instead of single-domain read
- [Phase 14]: All PPTX helper functions now accept WorkloadDomainConfig directly — no store bridge pattern in export composable
- [Phase 15]: Out-of-order TDD accepted: Wave-0 tests and Wave-2 implementation written in same session — tests serve as regression guards

### Pending Todos

- Verify ReadyNode profile hardware minimums (NVMe counts, RAM minimums) against Broadcom compatibility guide at production deployment time
- Document colocated overhead formula as an engineering assumption in calculationStore.ts comments (no official Broadcom VCF 9 spec exists)

### Blockers/Concerns

- Colocated overhead formula (LOW confidence): no official Broadcom VCF 9 document specifies the absorption formula; must be flagged as engineering assumption in code comments
- Phase 15 engine fix touches calculationStore.ts which drives all 236+ tests — TDD gate is non-negotiable before any implementation

## Session Continuity

Last session: 2026-03-30T19:20:08.721Z
Stopped at: Completed 15-01-PLAN.md — ENGINE-01/02/03 TDD tests (retrospective)
Next action: /gsd:plan-phase 15
Resume file: None
