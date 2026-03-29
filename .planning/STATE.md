---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Architecture Correctness & vSAN Max
status: roadmap-ready
stopped_at: Roadmap created — Phase 4 and Phase 5 defined; ready for plan-phase 4
last_updated: "2026-03-29T10:00:00.000Z"
last_activity: 2026-03-29
progress:
  total_phases: 2
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

Phase: Phase 4 (not started)
Plan: —
Status: Roadmap ready — awaiting plan-phase 4
Last activity: 2026-03-29 — v2.0 roadmap created (Phase 4 and Phase 5 appended)

```
v2.0 progress: [░░░░░░░░░░] 0% (0/2 phases)
```

## Performance Metrics

- Plans completed this milestone: 0
- Tests written this milestone: 0
- Blockers resolved: 0

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

### Pending Todos

- Verify ReadyNode profile constants (MED/LRG/XL NVMe counts, XS 128 GB RAM minimum) against compatibilityguide.broadcom.com at Phase 5 implementation time

### Blockers/Concerns

- vSAN Max ReadyNode profiles: confirm 5 profiles (XS/SM/MED/LRG/XL) specs match latest Broadcom TechDocs before hardcoding constants in engine/vsanMax.ts

## Session Continuity

To resume:
1. Read .planning/ROADMAP.md for full phase structure
2. Read .planning/REQUIREMENTS.md for v2.0 requirement IDs and traceability
3. Run: `/gsd:plan-phase 4`
