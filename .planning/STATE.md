---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Sizing Correctness & Guided Workflow
status: executing
stopped_at: Completed 15-02-PLAN.md — ENGINE-01/02/03/04 implementation (retrospective)
last_updated: "2026-03-30T20:38:53.088Z"
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
| Phase 04 P02 | 10min | 3 tasks | 7 files |
| Phase 05 P01 | 9min | 2 tasks | 10 files |
| Phase 05 P02 | 12min | 3 tasks | 9 files |
| Phase 06 P01 | - | Wave 0 TDD | 1 file |
| Phase 06 P02 | 5min | 2 tasks | 3 files |
| Phase 06 P03 | 5min | 1 task | 1 file |
| Phase 07 P01 | 2min | 2 tasks | 6 files |
| Phase 07 P02 | 3min | 1 tasks | 5 files |
| Phase 07 P03 | 2min | 2 tasks | 3 files |
| Phase 08 P01 | 2min | 1 tasks | 1 files |
| Phase 08 P02 | 11min | 2 tasks | 3 files |
| Phase 08 P03 | 5min | 1 tasks | 5 files |
| Phase 09 P01 | 3min | 1 tasks | 1 files |
| Phase 09 P02 | 4min | 2 tasks | 1 files |
| Phase 10 P01 | 6min | 3 tasks | 6 files |
| Phase 11 P01 | 5min | 2 tasks | 2 files |
| Phase 12 P01 | 25min | 3 tasks | 10 files |
| Phase 12 P02 | 10min | 3 tasks | 7 files |
| Phase 13 P01 | 12min | 2 tasks | 4 files |
| Phase 13 P02 | 15min | 3 tasks | 11 files |
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

v2.0 decisions:

- [Roadmap]: Phase 4 starts with types.ts additive changes before any other file — all Phase 4 and Phase 5 type contracts defined first
- [Roadmap]: Bandwidth floor patch uses TDD order — failing test written before floor constant added to calcStretch()
- [Roadmap]: UI labels use "Dedicated Domains" / "Co-located" (VCF 9 terminology); engine enums stay 'shared' | 'dedicated'
- [Roadmap]: vSAN Max is a separate engine subsystem (engine/vsanMax.ts), not a variant of vSAN ESA HCI — VsanMaxInputs has distinct storageNodeCount and computeNodeCount
- [Roadmap]: Zod URL schema updated atomically with every new inputStore field; URL_STATE_FIELDS constant shared by generateShareUrl and hydrateFromUrl
- [04-01]: Witness RTT threshold uses binary gate: <=10 hosts/site = 200ms, >10 hosts/site = 100ms (conservative fallback)
- [04-01]: dedicatedMgmtHostCount returns null when managementArchitecture != 'dedicated' — UI must null-check before rendering
- [04-01]: COLLOCATED_MIN_HOSTS uses storageType gate: vSAN = 3 hosts min, FC/NFS = 2 hosts min
- [Phase 04]: StretchNetworkChecklist placed in ResultsPanel (output side) — checklist is a result, not a configuration control
- [Phase 04]: Architecture toggle guarded by deploymentMode !== 'simple' (visible in both HA and Stretch modes)
- [Phase 05]: [05-01]: calcVsanMax() reuses vsanEsaRaidOverhead() + exported storage constants — no formula duplication
- [Phase 05]: [05-01]: calcStorage() converted to exhaustive switch with never case — future StorageType additions are compile-time errors
- [Phase 05]: [05-01]: vsanMaxStorageNodes Zod min(4) enforces floor in URL state, matching VSAN_MAX_MIN_STORAGE_NODES validation constant
- [Phase 05]: DEDUP_NETWORK_SPEED warning placed inside vSAN ESA dedup section per UI-SPEC (not HostSpecsForm)
- [Phase 05]: effectiveBandwidthGbps = Math.min(stretch.minBandwidthGbps, networkSpeedGbE) caps stretch bandwidth display in DeploymentModelSelector
- [Phase 05]: i18n keys use flat naming (storage.vsanMaxProfile) per PLAN.md spec, consistent with existing project conventions

v2.1 decisions:

- [Roadmap]: generateMarkdownReport() extracted from useUrlState.ts to useMarkdownExport.ts before any enrichment — extraction is a hard prerequisite for MD-02 through MD-09
- [Roadmap]: Export composables (useMarkdownExport.ts, usePptxExport.ts) live in src/composables/ — they are Vue-layer code, fully compliant with CALC-01/CALC-02
- [Roadmap]: pptxgenjs loaded via dynamic import() inside export function body — zero impact on initial bundle; Vite code-splits automatically
- [Roadmap]: Build order enforced: Markdown extraction (Phase 6) → Print/PDF CSS (Phase 7) → PPTX core (Phase 8) → PPTX conditional (Phase 9)
- [Roadmap]: Print/PDF is pure CSS — zero JavaScript changes required; window.print() call in ExportToolbar.vue unchanged
- [Roadmap]: Phase 8 (PPTX core) introduces pptxgenjs as the only new production dependency for v2.1
- [Phase 06-02]: generateMarkdownReport() extracted verbatim to useMarkdownExport.ts — Wave 2 enrichment targets single source of truth
- [Phase 06-02]: useCalculationStore import removed from useUrlState.ts as dead code after extraction
- [Phase 06-03]: generateMarkdownReport() uses sections[] array pattern for conditional section assembly
- [Phase 06-03]: Validation warnings rendered as i18n keys — no i18n resolution in composable (Pitfall 6)
- [Phase 07-01]: No JavaScript changes needed for print CSS foundation — pure CSS via Tailwind print: variants and @page rule
- [Phase 07-01]: break-inside-avoid applied to individual card root elements only, NOT ResultsPanel wrapper
- [Phase 07-01]: print:min-h-0 prevents viewport-height constraint from adding blank pages in print output
- [Phase 07-02]: Fixed-position header/footer relies on 25mm @page margins (Plan 01) to avoid content overlap
- [Phase 07-02]: hidden print:flex pattern: hidden hides on screen, print:flex overrides to flex in print media
- [Phase 07-03]: print:table (not print:block) on table elements preserves semantic table rendering in print media
- [Phase 07-03]: StorageChart RAID overhead row uses rawCapacityTB - usableAfterRaidTB formula identical to chart dataset
- [Phase 08]: [08-01]: Wave 0 test file tests 7 data-mapping helpers as pure functions accepting store/calc instances — avoids pptxgenjs browser-API dependency in Node test environment (Pitfall 7)
- [Phase 08]: [08-02]: pptxgenjs TableCell/TableRow types accessed via PptxGenJS namespace — not named exports — due to export-as-namespace declaration in index.d.ts
- [Phase 08]: [08-02]: Internal hdrCell() and cell() helpers wrap plain strings into typed TableCell objects to satisfy TS type checker without casting
- [Phase 08]: [08-02]: type import PptxGenJS used for namespace type access only — runtime dynamic import still inside function body (PPTX-15 compliant)
- [Phase 08-03]: [08-03]: Button uses disabled:opacity-50 Tailwind class and :disabled binding for loading state visual feedback
- [Phase 08-03]: [08-03]: i18n key path is results.toolbar.exportPptx / results.toolbar.exportPptxLoading — consistent with existing toolbar keys
- [Phase 09]: Wave 0 TDD RED gate: 5 failing test describe blocks added to usePptxExport.test.ts for PPTX-10..14 before any helper implementation
- [Phase 09]: Stretch helper accepts StretchResult directly (not full calc store) for testability
- [Phase 09]: Validation warnings in PPTX use raw messageKey — no i18n in composable (consistent with Phase 6)
- [Phase 09]: vSAN Max PPTX guard uses double condition: storageType === 'vsan-max' && calc.vsanMax !== null

v3.0 decisions:

- [Roadmap]: Store structure — Option A: single inputStore with workloadDomains array + managementDomain object (not a separate domainsStore)
- [Roadmap]: deploymentMode is per-domain — VCF architecture requires stretch topology to be per-domain
- [Roadmap]: managementArchitecture remains a global field on inputStore — it is a deployment-level toggle, not a per-domain setting
- [Roadmap]: v2.x URL backward compatibility — silent reset to default state; document in release notes; no migration code
- [Roadmap]: Zod v4 — use factory .default(() => [createDefaultWorkloadDomain(0)]) for array field, NOT .default([])
- [Roadmap]: v-for key must always be :key="domain.id" (crypto.randomUUID()) — never array index
- [Roadmap]: activeTabIndex is ephemeral UI state — never serialized to URL; hydration always activates first tab
- [Roadmap]: i18n new keys accumulated across Phases 12-14 are delivered with their respective phases (not deferred to a separate cleanup phase)
- [Phase 10]: WorkloadDomainConfig has 26 fields covering all per-domain configuration; inputStore uses ref<WorkloadDomainConfig[]> NOT reactive([]) to avoid storeToRefs() double-wrap bug
- [Phase 10]: vitest.config.ts extended to include src/stores/**/*.test.ts — was missing from original include list
- [Phase 11]: Export WorkloadDomainSchema and ManagementDomainSchema from useUrlState.ts for Phase 12+ reuse
- [Phase 11]: Exclude domain id from generateShareUrl — saves URL bytes; IDs re-generated on hydration via crypto.randomUUID()
- [Phase 12]: domainField() computed helper pattern used in all 4 forms for per-domain field binding via computed({ get, set }) wrapping updateDomain()
- [Phase 12]: managementArchitecture stays global in DeploymentModelSelector (not per-domain), consistent with locked v3.0 decision
- [Phase 12]: ManagementDomainSection uses mgmtField() helper — computed({ get, set }) wrapping updateManagementDomain()
- [Phase 12]: Architecture toggle and management overhead summary moved from DeploymentModelSelector to ManagementDomainSection (UI-05)
- [Phase 12]: App.vue computes activeDomainId from workloadDomains[activeDomainIndex] with null-coalescing fallback
- [Phase 13]: first-domain bridge pattern (workloadDomains[0] / domainResults[0]) used in export composables for Phase 13 compat; full multi-domain export is Phase 14
- [Phase 13]: DomainResultCard absorbs HostCountCard layout; chart components use first-domain bridge (domainResults[0]) for Phase 13 compat
- [Phase 14]: buildAggregateSlideData(totals) replaces buildRecommendationsData — summarizes all domains in 4 rows instead of single-domain read
- [Phase 14]: All PPTX helper functions now accept WorkloadDomainConfig directly — no store bridge pattern in export composable

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
