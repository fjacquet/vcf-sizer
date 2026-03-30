---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Export Quality
status: executing
last_updated: "2026-03-30T08:34:47.913Z"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 11
  completed_plans: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.
**Current focus:** Phase 09 — pptx-conditional-slides-and-polish

## Current Position

Phase: 09 (pptx-conditional-slides-and-polish) — EXECUTING
Plan: 2 of 2
Next: Phase 09 (pptx-conditional-slides) — NOT STARTED
Status: Ready to execute

Progress: [###############-----] 3/4 phases complete

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
| Phase 08 P03 | 5min | 2 tasks | 5 files |
| Phase 09 P01 | 3min | 1 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Carried from v1.0:

- [Roadmap]: Storage engine (STOR-02, STOR-03) is a PORT from raidy project
- [Phase 01]: @intlify/unplugin-vue-i18n include pattern breaks rolldown — locale files handled natively by Vite 8
- [Phase 01]: vue-i18n Swiss locales use full BCP47 codes (fr-CH, de-CH, it-CH) in numberFormats
- [Phase 01]: Fleet Manager and Collector are x1 ALWAYS singletons (MGMT-04)
- [Phase 01]: Adaptive RAID-5 uses host-count gate (>=6 hosts = 4+1 scheme)
- [Phase 01]: calculationStore exposes only computed() — zero ref() — CALC-02
- [Phase 02]: Used computed() + vue-chartjs declarative :data prop for chart reactivity
- [Phase 02]: lz-string default import + Zod .strip() for URL state validation
- [Phase 02]: PDF export = window.print() only with Tailwind print: variants
- [Phase 03]: Stretch cluster resource duplication: stretchMultiplier=2 applied to full total (workload + management)
- [Phase 03]: Storage stretch: stretchMirroringFactor=0.5 halves effective/safe usable for PFTT=1

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

### Pending Todos

- Verify ReadyNode profile constants (MED/LRG/XL NVMe counts, XS 128 GB RAM minimum) against compatibilityguide.broadcom.com at Phase 5 implementation time
- Phase 9: Add conditional slides for AI/GPU, NVMe tiering, stretch topology, vSAN Max, and validation warnings

### Blockers/Concerns

- vSAN Max ReadyNode profiles: confirm 5 profiles (XS/SM/MED/LRG/XL) specs match latest Broadcom TechDocs before hardcoding constants in engine/vsanMax.ts

## Session Continuity

To resume:

1. Read .planning/ROADMAP.md for full phase structure (Phases 6-9)
2. Read .planning/REQUIREMENTS.md for v2.1 requirement IDs (PPTX-10..14)
3. Run: `/gsd:plan-phase 9` to begin PPTX Conditional Slides and Polish
