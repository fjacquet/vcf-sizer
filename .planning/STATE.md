---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: Roadmap ready — awaiting plan-phase 4
last_updated: "2026-03-29T12:32:03.823Z"
last_activity: 2026-03-29 — v2.0 roadmap created (Phase 4 and Phase 5 appended)
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 9
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Prevent under-provisioning of VCF 9.x deployments by computing exact hardware requirements across all deployment configurations before hardware is ordered.
**Current focus:** Milestone v2.0 — Architecture Correctness & vSAN Max

## Current Position

Phase: Phase 4 (in progress)
Plan: 04-01 complete, 04-02 next
Status: Plan 04-01 complete — ready for 04-02 (UI layer)
Last activity: 2026-03-29 — Completed 04-01-PLAN.md (engine layer: bandwidth floor, stretch checklist, management architecture)

```
v2.0 progress: [█████████░] 89% (8/9 plans)
```

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 04 | 01 | 8min | 2 | 9 |

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

### Pending Todos

- Verify ReadyNode profile constants (MED/LRG/XL NVMe counts, XS 128 GB RAM minimum) against compatibilityguide.broadcom.com at Phase 5 implementation time

### Blockers/Concerns

- vSAN Max ReadyNode profiles: confirm 5 profiles (XS/SM/MED/LRG/XL) specs match latest Broadcom TechDocs before hardcoding constants in engine/vsanMax.ts

## Session Continuity

To resume:

1. Read .planning/ROADMAP.md for full phase structure
2. Read .planning/REQUIREMENTS.md for v2.0 requirement IDs and traceability
3. Run: `/gsd:execute-phase 4` (Plan 04-02 UI layer is next)
