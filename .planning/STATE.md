---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Architecture Correctness & vSAN Max
status: defining-requirements
stopped_at: Milestone v2.0 started — defining requirements
last_updated: "2026-03-29T10:00:00.000Z"
last_activity: 2026-03-29
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.
**Current focus:** Milestone v2.0 — Architecture Correctness & vSAN Max

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-29 — Milestone v2.0 started

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Carried from v1.0:
- [Roadmap]: Storage engine (STOR-02, STOR-03) is a PORT from raidy project
- [Phase 01]: @intlify/unplugin-vue-i18n include pattern breaks rolldown — locale files handled natively by Vite 8
- [Phase 01]: vue-i18n Swiss locales use full BCP47 codes (fr-CH, de-CH, it-CH) in numberFormats
- [Phase 01]: Fleet Manager and Collector are ×1 ALWAYS singletons (MGMT-04)
- [Phase 01]: Adaptive RAID-5 uses host-count gate (≥6 hosts = 4+1 scheme)
- [Phase 01]: calculationStore exposes only computed() — zero ref() — CALC-02
- [Phase 02]: Used computed() + vue-chartjs declarative :data prop for chart reactivity
- [Phase 02]: lz-string default import + Zod .strip() for URL state validation
- [Phase 02]: PDF export = window.print() only with Tailwind print: variants
- [Phase 03]: Stretch cluster resource duplication: stretchMultiplier=2 applied to full total (workload + management)
- [Phase 03]: Storage stretch: stretchMirroringFactor=0.5 halves effective/safe usable for PFTT=1

v2.0 new decisions: (none yet)

### Pending Todos

None.

### Blockers/Concerns

- vSAN Max ReadyNode profiles: confirm 5 profiles (XS/SM/MED/LRG/XL) specs match latest Broadcom TechDocs before implementation
- Standard vs Consolidated: clarify how the UI should surface this — separate deployment mode option or validation guidance?
