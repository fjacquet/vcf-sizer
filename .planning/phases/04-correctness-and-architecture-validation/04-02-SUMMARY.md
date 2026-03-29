---
phase: 04-correctness-and-architecture-validation
plan: 02
subsystem: ui
tags: [vue3, typescript, vue-i18n, pinia, tailwind, vcf-sizing]

# Dependency graph
requires:
  - phase: 04-correctness-and-architecture-validation
    plan: 01
    provides: "ManagementArchitecture type, StretchNetworkChecklist interface, bandwidthFloorApplied boolean, networkChecklist computed, dedicatedMgmtHostCount computed, DEDICATED_MGMT_MIN_HOSTS/COLLOCATED_MIN_HOSTS validation error codes"
  - phase: 01-foundation
    provides: "WarningBanner.vue shared component, i18n locale file structure and nesting conventions"

provides:
  - "deployment.stretchSites.bandwidthFloorIndicator i18n key in all 4 locales (en/fr/de/it)"
  - "deployment.stretchSites.networkChecklist object (8 sub-keys) in all 4 locales"
  - "deployment.architecture object (label/shared/dedicated) in all 4 locales"
  - "validation.dedicatedMgmtMinHosts and validation.colocatedMinHosts in all 4 locales"
  - "Management architecture toggle in DeploymentModelSelector (visible when deploymentMode != 'simple')"
  - "Bandwidth floor indicator in DeploymentModelSelector stretch section (amber text when bandwidthFloorApplied)"
  - "StretchNetworkChecklist.vue card component showing RTT/bandwidth/MTU checklist"
  - "ResultsPanel wired to render StretchNetworkChecklist after StorageChart"

affects:
  - "End user — all new UI elements visible; all new validation messages render in 4 locales"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "storeToRefs destructure pattern extended: both inputStore and calculationStore refs consumed in same component"
    - "architectureErrors computed filter: isolates specific error codes from global validationErrors array"
    - "v-if='deploymentMode !== simple' guard pattern for mode-conditional UI sections"
    - "v-if guard on results component (StretchNetworkChecklist) mirrors input-side condition"

key-files:
  created:
    - src/components/results/StretchNetworkChecklist.vue
  modified:
    - src/components/input/DeploymentModelSelector.vue
    - src/components/results/ResultsPanel.vue
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json

key-decisions:
  - "StretchNetworkChecklist rendered in ResultsPanel (output side) not DeploymentModelSelector (input side) — checklist is a result, not a configuration control"
  - "architectureErrors computed filters globally from validationErrors rather than duplicating logic — single source of truth for error state"
  - "Architecture toggle guarded by deploymentMode !== 'simple' (shows in both HA and Stretch) — consistent with ARCH-01/02 scope"
  - "Bandwidth floor indicator uses amber color (not red) to distinguish informational floor from actual error state"

# Metrics
duration: 10min
completed: 2026-03-29
---

# Phase 4 Plan 02: UI Layer — Bandwidth Floor Indicator, Stretch Network Checklist, Management Architecture Toggle Summary

**i18n keys in all 4 Swiss locales + DeploymentModelSelector management architecture toggle with WarningBanner validation errors + StretchNetworkChecklist card component + ResultsPanel wiring — all engine correctness work from Plan 01 now user-visible**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-29T14:35:00Z
- **Completed:** 2026-03-29T14:09:55Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 7 (4 locale files, 2 updated Vue components, 1 new Vue component)

## Accomplishments

- Added 14 new i18n keys per locale across all 4 locale files (en/fr/de/it): `bandwidthFloorIndicator`, `networkChecklist` object with 8 sub-keys, `architecture` object with 3 sub-keys, `dedicatedMgmtMinHosts`, `colocatedMinHosts` — identical key structure, language-appropriate values in each
- Updated `DeploymentModelSelector.vue`: added `managementArchitecture` storeToRefs from inputStore, `validationErrors` + `dedicatedMgmtHostCount` from calculationStore, `architectureErrors` computed filter, management architecture toggle (Co-located / Dedicated Domains buttons, guarded by `deploymentMode !== 'simple'`), bandwidth floor indicator (amber text, conditionally rendered via `stretch.bandwidthFloorApplied`)
- Created `StretchNetworkChecklist.vue`: standalone card component, `v-if="input.deploymentMode === 'stretch'"` guard, grid layout showing inter-site bandwidth, site-to-site RTT, witness RTT, jumbo frames required, witness bandwidth, high host count advisory note
- Updated `ResultsPanel.vue`: imported and rendered `StretchNetworkChecklist` after `StorageChart`
- Visual verification passed (human-approved): bandwidth floor indicator, network checklist card, management architecture toggle with validation banners, all 4 locales render human-readable text

## Task Commits

Each task was committed atomically:

1. **Task 1: Add all i18n keys to all 4 locale files** - `4ab0070` (feat)
2. **Task 2: Update DeploymentModelSelector + create StretchNetworkChecklist + wire ResultsPanel** - `6d5a002` (feat)
3. **Task 3: Visual verification checkpoint** - approved by user (no code commit)

## Files Created/Modified

- `src/i18n/locales/en.json` — Added `deployment.stretchSites.bandwidthFloorIndicator`, `networkChecklist` (8 keys), `deployment.architecture` (3 keys), `validation.dedicatedMgmtMinHosts`, `validation.colocatedMinHosts`
- `src/i18n/locales/fr.json` — Same keys, French translations
- `src/i18n/locales/de.json` — Same keys, German translations
- `src/i18n/locales/it.json` — Same keys, Italian translations
- `src/components/input/DeploymentModelSelector.vue` — Management architecture toggle, `architectureErrors` computed, WarningBanner integration, bandwidth floor indicator
- `src/components/results/StretchNetworkChecklist.vue` — New component: stretch network requirements card (RTT/bandwidth/MTU checklist)
- `src/components/results/ResultsPanel.vue` — Import and render `StretchNetworkChecklist` after `StorageChart`

## Requirements Completed

- **STRCH-06** — Bandwidth floor (10 Gbps minimum) now visible in UI with amber indicator text when floor is applied
- **STRCH-07** — Floor indicator text explicitly states "10 Gbps floor applied (VCF 9.0 minimum)" in all 4 locales
- **STRCH-08** — `StretchNetworkChecklist` card visible in results panel only in stretch mode; shows MTU 9000, RTT < 5ms, witness RTT thresholds
- **ARCH-01** — Management architecture toggle shows in HA/Stretch modes; `DEDICATED_MGMT_MIN_HOSTS` error banner when < 4 hosts with dedicated architecture
- **ARCH-02** — `COLLOCATED_MIN_HOSTS` warning banner for co-located mode below storage type minimums

## Decisions Made

- `StretchNetworkChecklist` placed in ResultsPanel (output side) rather than DeploymentModelSelector — checklist is a result presentation, not a user input
- `architectureErrors` computed filters from global `validationErrors` array rather than duplicating error detection — keeps single source of truth in the engine/store layer
- Architecture toggle guarded by `deploymentMode !== 'simple'` so it appears in both HA and Stretch — consistent with ARCH-01/02 which apply to both non-simple modes
- Bandwidth floor indicator uses amber color (`text-amber-600`) to distinguish it visually from red error state — floor is informational, not an error

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met on first attempt. Build succeeded with zero TypeScript errors.

## Known Stubs

None — all UI elements are wired to live store data. No placeholder values or hardcoded mock data.

## Issues Encountered

None — TypeScript strict mode clean; all 95 tests pass (pre-existing suite, no regressions from UI-only changes); production build succeeds in 257ms (166 modules transformed).

## Final Verification

- `npm run test`: **95/95 tests passed** (8 test files)
- `npm run build`: **succeeded** (166 modules, 0 TypeScript errors, gzip: 158KB)
- Visual verification: **approved** by user

## User Setup Required

None — no external service configuration or environment changes required.

## Next Phase Readiness

- Phase 4 is now complete: all engine correctness fixes (Plan 01) are user-visible through the UI layer (Plan 02)
- All 5 requirements (STRCH-06/07/08, ARCH-01/02) are implemented end-to-end
- Share URLs preserve `managementArchitecture` selection via URL state (wired in Plan 01)
- Application ready for Phase 5 (vSAN Max storage tier)

---
*Phase: 04-correctness-and-architecture-validation*
*Completed: 2026-03-29*

## Self-Check: PASSED

- `src/components/results/StretchNetworkChecklist.vue` exists: VERIFIED
- `src/components/input/DeploymentModelSelector.vue` contains `managementArchitecture`: VERIFIED
- `src/components/results/ResultsPanel.vue` contains `StretchNetworkChecklist`: VERIFIED
- `src/i18n/locales/en.json` contains `bandwidthFloorIndicator`: VERIFIED
- Task commit 4ab0070 exists: VERIFIED
- Task commit 6d5a002 exists: VERIFIED
- 95/95 tests pass: VERIFIED
- TypeScript compilation: CLEAN
- Production build: SUCCESS (166 modules, 257ms)
