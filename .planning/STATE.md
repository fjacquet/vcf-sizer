---
gsd_state_version: 1.0
milestone: v3.3
milestone_name: UX Polish & Export Quality
status: executing
last_updated: "2026-04-10T20:00:00.000Z"
last_activity: 2026-04-10 -- Phase 18 complete
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-10)

**Core value:** Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.
**Current focus:** v3.3 milestone — UX Polish & Export Quality

## Current Position

Phase: 19 (Topology Confirmation + Domain Duplication) — not yet started
Plan: —
Status: Ready to execute
Last activity: 2026-04-10 -- Phase 18 complete (279 tests, build clean)

## Progress Bar

```
v3.3: [##        ] 1/6 phases complete
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

### Test Baseline

- 279 tests passing as of Phase 18 — TDD discipline maintained throughout

## Session Continuity

Next action: Run `/gsd-plan-phase 19` to plan Phase 19 (Topology Confirmation + Domain Duplication).
