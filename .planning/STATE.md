---
gsd_state_version: 1.0
milestone: v3.3
milestone_name: UX Polish & Export Quality
status: completed
last_updated: "2026-04-11T17:08:07.475Z"
last_activity: 2026-04-11
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 11
  completed_plans: 9
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.
**Current focus:** Milestone v3.3 complete — all phases shipped

## Current Position

Phase: 23 (Markdown Preview Panel) — COMPLETE
Plan: 2 of 2
Status: Milestone v3.3 complete
Last activity: 2026-04-11

## Progress Bar

```
v3.3: [██████████] 100%
```

## Pending Todos

- Verify ReadyNode profile hardware minimums (NVMe counts, RAM minimums) against Broadcom compatibility guide at production deployment time
- Document colocated overhead formula as an engineering assumption in calculationStore.ts comments (no official Broadcom VCF 9 spec exists)

## Accumulated Context

### Architecture Constraints (non-negotiable)

- Engine layer must remain zero Vue imports (CALC-01)
- calculationStore must remain zero ref() — only computed() (CALC-02)
- All validation messages use i18n keys, never raw English strings
- Export composables are plain TypeScript (no Vue lifecycle hooks) for testability — EXPORT-PURE
- pptxgenjs dynamic import pattern keeps it out of initial bundle (PPTX-15)
- Wizard step position is ephemeral and never serialized to URL (WIZARD-07)
- ManagementStorageType = Exclude<StorageType, 'vsan-max'> established in v3.2

### v3.3-Specific Decisions

- Chart PNG capture uses Chart.getChart(canvasId) not chartRef.value.chart (vue-chartjs #1012 — ref.chart is null in Composition API)
- Per-domain canvas IDs must be derived from domain.id to prevent Chart.getChart() collisions across DomainResultCards
- animation: false required on all per-domain charts to prevent blank PNG from toBase64Image() (Chart.js #2743)
- structuredClone(toRaw(domain)) is the canonical domain clone pattern — bare structuredClone throws on Pinia reactive proxy (Pinia #1412)
- Topology confirmation: capture pendingTopology in local ref BEFORE any store write; only commit on user confirmation (PITFALL-5)
- i18n in export composables: use i18n.global.t() from singleton in src/i18n/index.ts — useI18n() throws outside component context (PITFALL-3)
- pptxgenjs addImage: pass full data:image/png;base64,... dataURL string without stripping prefix (PITFALL-7)
- DOMPurify.sanitize() required before v-html in MarkdownPreview to prevent XSS from user domain names (PITFALL-9)
- localeLoading guard: disable export buttons while locale JSON is loading to prevent English fallback race (PITFALL-10)
- Landing view gated on topologyConfirmed (not localStorage) — hydrateFromUrl() already calls confirmTopology() (PITFALL-13)
- marked pinned at ^15.x — v16+ drops CommonJS; v18 requires TypeScript v6
- New npm packages for v3.3: marked@^15.0.12 + dompurify@^3.3.3 (~20 KB gzipped combined)

### v3.3 Phase 19 Decisions

- structuredClone(toRaw(source)) is the canonical domain clone pattern — bare structuredClone throws on Pinia reactive proxy (Pinia #1412)
- duplicateDomain name is a parameter (not hardcoded suffix) — keeps store i18n-clean
- pendingTopology stored in local ref, never written to store before user confirms (PITFALL-5)
- hasConfiguredDomains skips deploymentMode in addition to id/name — topology change should not trigger its own confirmation
- applyTopology calls confirmTopology() (idempotent) + setWizardStep(1) per ROADMAP criterion 3

### Test Baseline

- 297 tests passing as of Phase 23 completion — TDD discipline maintained throughout

## Session Continuity

Last session: 2026-04-11
Next action: Milestone v3.3 complete. Merge branch to maincd or plan next milestone.
