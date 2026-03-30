---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Sizing Correctness & Guided Workflow
status: executing
stopped_at: Completed 15-02-PLAN.md — ENGINE-01/02/03/04 implementation (retrospective)
last_updated: "2026-03-30T20:28:06.432Z"
last_activity: 2026-03-30 -- Phase 14 execution started
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 13
  completed_plans: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.
**Current focus:** Phase 14 — multi-domain-exports

## Current Position

Phase: 14 (multi-domain-exports) — EXECUTING
Plan: 1 of 2
Status: Executing Phase 14
Last activity: 2026-03-30 -- Phase 14 execution started

Progress: [---       ] 0/3 phases formally verified (Phase 15 implemented)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 04 | 01 | 8min | 2 | 9 |
| 14 | 02 | 15min | 2 | 2 |

*Updated after each plan completion*
| Phase 14 P02 | 15min | 2 tasks | 2 files |
| Phase 15 P01 | 5min | 1 tasks | 0 files |
| Phase 15 P02 | retrospective | 3 tasks | 12 files |
| Phase 16 P01 | 12min | 3 tasks | 7 files |

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
- [Phase 15]: Management overhead routed to WLD-1 only in colocated mode via index-aware map to prevent double-counting across multiple workload domains
- [Phase 15]: ManagementArchitecture renamed from 'shared' to 'colocated' — semantically accurate for VCF topology (management VMs run co-located within workload domain)
- [Phase 15]: mgmtHostCount: 0 when colocated is correct — overhead is embedded in WLD-1 host count, not a separate procurement line item
- [Phase 16]: currentWizardStep lives in uiStore only — confirmed by WIZARD-07 tests proving InputStateSchema strips it
- [Phase 16]: vitest include extended to src/stores/**/*.test.ts to enable store unit tests (Rule 3 fix)


### Pending Todos

- Verify ReadyNode profile hardware minimums (NVMe counts, RAM minimums) against Broadcom compatibility guide at production deployment time
- Document colocated overhead formula as an engineering assumption in calculationStore.ts comments (no official Broadcom VCF 9 spec exists)

### Blockers/Concerns

- Colocated overhead formula (LOW confidence): no official Broadcom VCF 9 document specifies the absorption formula; must be flagged as engineering assumption in code comments
- Phase 15 engine fix touches calculationStore.ts which drives all 236+ tests — TDD gate is non-negotiable before any implementation

## Session Continuity

Last session: 2026-03-30T19:23:27.632Z
Stopped at: Completed 15-02-PLAN.md — ENGINE-01/02/03/04 implementation (retrospective)
Next action: /gsd:plan-phase 15
Resume file: None
