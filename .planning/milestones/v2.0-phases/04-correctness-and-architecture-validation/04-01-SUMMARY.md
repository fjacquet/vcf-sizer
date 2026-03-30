---
phase: 04-correctness-and-architecture-validation
plan: 01
subsystem: engine
tags: [typescript, vitest, tdd, pinia, zod, lz-string, vsan, vcf-sizing]

# Dependency graph
requires:
  - phase: 03-stretch-cluster
    provides: "calcStretch() function, StretchResult interface, StretchInputs interface, existing test suite"
  - phase: 02-url-state-and-export
    provides: "useUrlState.ts with Zod schema, hydrateFromUrl, generateShareUrl, lz-string pattern"
  - phase: 01-foundation
    provides: "validateInputs(), inputStore refs pattern, calculationStore computed-only pattern (CALC-02)"

provides:
  - "ManagementArchitecture type ('shared' | 'dedicated') in engine/types.ts"
  - "StretchNetworkChecklist interface with inter-site bandwidth, latency, and MTU requirements"
  - "Extended StretchResult with bandwidthFloorApplied boolean and networkChecklist"
  - "Extended ValidationInputs with optional managementArchitecture field"
  - "STRETCH_MIN_BANDWIDTH_GBPS = 10 constant enforcing 10 Gbps floor in calcStretch()"
  - "DEDICATED_MGMT_MIN_HOSTS and COLLOCATED_MIN_HOSTS validation rules in validateInputs()"
  - "managementArchitecture ref in inputStore (default 'shared')"
  - "dedicatedMgmtHostCount computed in calculationStore (CALC-02 compliant)"
  - "managementArchitecture in Zod URL schema with round-trip preservation"

affects:
  - "04-02-UI — consumes StretchNetworkChecklist, bandwidthFloorApplied, dedicatedMgmtHostCount, validation error codes"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD order: update failing test BEFORE implementing fix (bandwidth floor)"
    - "Witness RTT threshold derived from max(preferredSiteHosts, secondarySiteHosts): <=10=200ms, >10=100ms"
    - "Additive-only types.ts: new types/interfaces land first before any other file is changed"
    - "Atomic URL state sync: Zod schema + hydrateFromUrl + generateShareUrl updated in one commit"

key-files:
  created: []
  modified:
    - src/engine/types.ts
    - src/engine/stretch.ts
    - src/engine/stretch.test.ts
    - src/engine/validation.ts
    - src/engine/validation.test.ts
    - src/stores/inputStore.ts
    - src/stores/calculationStore.ts
    - src/composables/useUrlState.ts
    - src/composables/useUrlState.test.ts

key-decisions:
  - "TDD bandwidth floor: test updated to expect 10 Gbps (RED) before STRETCH_MIN_BANDWIDTH_GBPS constant added (GREEN)"
  - "ManagementArchitecture enum values are 'shared'/'dedicated' in engine; UI labels handled separately in Phase 4 Plan 02"
  - "Witness RTT threshold uses simple binary gate: <=10 hosts/site = 200ms, >10 hosts/site = 100ms (conservative fallback covers 11-15 and >15)"
  - "COLLOCATED_MIN_HOSTS uses storageType to differentiate: vSAN requires 3 hosts min, FC/NFS requires 2 hosts min"
  - "dedicatedMgmtHostCount returns null when managementArchitecture != 'dedicated' — consumer must null-check before rendering"

patterns-established:
  - "ManagementArchitecture pattern: ref in inputStore, computed in calculationStore, Zod field in useUrlState (all three atomic)"
  - "Validation constants named RULE_NAME = value at top of validation.ts for discoverability"

requirements-completed:
  - STRCH-06
  - STRCH-07
  - STRCH-08
  - ARCH-01
  - ARCH-02

# Metrics
duration: 8min
completed: 2026-03-29
---

# Phase 4 Plan 01: Engine Layer — Bandwidth Floor, Stretch Checklist, Management Architecture Summary

**10 Gbps bandwidth floor + StretchNetworkChecklist engine + DEDICATED_MGMT_MIN_HOSTS/COLLOCATED_MIN_HOSTS validation rules with managementArchitecture wired through inputStore, calculationStore, and URL state**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-29T12:22:06Z
- **Completed:** 2026-03-29T12:30:40Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Extended `types.ts` with `ManagementArchitecture` type, `StretchNetworkChecklist` interface, and new fields on `StretchResult` and `ValidationInputs` — all additive, no breaking changes
- TDD bandwidth floor: updated existing test to expect 10 Gbps (RED), then added `STRETCH_MIN_BANDWIDTH_GBPS = 10` constant with `Math.max()` floor and `bandwidthFloorApplied` boolean (GREEN) — 10 stretch tests pass
- TDD validation rules: added 8 new failing tests for ARCH-01/ARCH-02 (RED), then implemented `DEDICATED_MGMT_MIN_HOSTS` error and `COLLOCATED_MIN_HOSTS` warning in `validateInputs()` (GREEN) — 17 validation tests pass
- Wired `managementArchitecture` ref through inputStore, `dedicatedMgmtHostCount` computed in calculationStore, and atomic URL state sync in all 3 useUrlState.ts locations
- Full test suite: 95 tests passing (up from 80 baseline, 15 new tests added)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types.ts + TDD bandwidth floor + stretch checklist engine** - `fbf124e` (feat)
2. **Task 2: Validation rules + inputStore + calculationStore + URL state sync** - `293c450` (feat)

_Note: Both tasks used TDD (RED then GREEN commits merged into single feat commits per task)_

## Files Created/Modified

- `src/engine/types.ts` — Added `ManagementArchitecture` type, `StretchNetworkChecklist` interface, extended `StretchResult` + `ValidationInputs`
- `src/engine/stretch.ts` — Added `STRETCH_MIN_BANDWIDTH_GBPS = 10`, floor enforcement, `bandwidthFloorApplied`, `networkChecklist` population
- `src/engine/stretch.test.ts` — Updated bandwidth test (TDD RED/GREEN), added 4 network checklist tests
- `src/engine/validation.ts` — Added `DEDICATED_MGMT_MIN_HOSTS`, `COLLOCATED_MIN_HOSTS_VSAN`, `COLLOCATED_MIN_HOSTS_FC_NFS` constants and Rules 4+5
- `src/engine/validation.test.ts` — Added 8 new tests for ARCH-01 (3 tests) and ARCH-02 (5 tests)
- `src/stores/inputStore.ts` — Added `managementArchitecture = ref<'shared' | 'dedicated'>('shared')` and exposed in return
- `src/stores/calculationStore.ts` — Added `dedicatedMgmtHostCount` computed (CALC-02 compliant); passes `managementArchitecture` to `validateInputs`
- `src/composables/useUrlState.ts` — Added `managementArchitecture` to Zod schema, `hydrateFromUrl` assignment, `generateShareUrl` state object
- `src/composables/useUrlState.test.ts` — Updated schema + defaultState, added 2 new tests (round-trip + default)

## Decisions Made

- TDD order: test updated to expect floor (RED) before implementing `STRETCH_MIN_BANDWIDTH_GBPS` constant — ensures the floor is actually enforced, not paper-patched
- Witness RTT uses simple binary gate (<=10 hosts = 200ms, else 100ms) rather than three-band classification — conservative and simpler
- `managementArchitecture` engine enums remain `'shared'` | `'dedicated'`; UI display labels ("Co-located" / "Dedicated Domains") are handled in Plan 02
- `dedicatedMgmtHostCount` returns `null` when architecture is not dedicated — plan 02 UI must null-check before rendering

## Deviations from Plan

None — plan executed exactly as written. The TDD RED phase was confirmed before each GREEN implementation, and all acceptance criteria were met on first attempt.

## Issues Encountered

None — TypeScript strict mode caught no type errors; all 95 tests pass; production build succeeds.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All engine contracts are defined and tested — Plan 02 UI can consume `bandwidthFloorApplied`, `networkChecklist`, `dedicatedMgmtHostCount`, and validation error codes `DEDICATED_MGMT_MIN_HOSTS` / `COLLOCATED_MIN_HOSTS` without any engine-level work
- URL state round-trips `managementArchitecture` correctly — share links from Plan 02 UI will preserve the toggle
- TypeScript strict compilation and production build both clean

---
_Phase: 04-correctness-and-architecture-validation_
_Completed: 2026-03-29_

## Self-Check: PASSED

- All 9 key files exist on disk: VERIFIED
- Task commit fbf124e exists: VERIFIED
- Task commit 293c450 exists: VERIFIED
- Metadata commit cae6db3 exists: VERIFIED
- 95/95 tests pass: VERIFIED
- TypeScript compilation: CLEAN
- Production build: SUCCESS
