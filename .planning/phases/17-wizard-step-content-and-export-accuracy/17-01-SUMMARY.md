---
phase: 17-wizard-step-content-and-export-accuracy
plan: 01
subsystem: ui
tags: [vue3, pinia, wizard, i18n, uiStore, topologyConfirmed]

# Dependency graph
requires:
  - phase: 16-wizard-scaffold-and-state
    provides: WizardStepper, TopologySelector, uiStore.currentWizardStep, App.vue v-show panels
provides:
  - topologyConfirmed ref and confirmTopology() action in uiStore (WIZARD-03)
  - Step 1 Next button gate: blocked until topology selection confirmed (WIZARD-03)
  - Step 2 Next button gate: blocked until management domain valid (WIZARD-04)
  - URL hydration auto-confirm: s= param triggers confirmTopology() in main.ts
  - i18n validation hint messages in all 4 locales (wizard.step1.topologyRequired, wizard.step2.mgmtInvalid)
affects: [17-02, 17-03, any future wizard step or export work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ephemeral UI flag pattern: topologyConfirmed lives in uiStore only, never in InputStateSchema (WIZARD-07 structural guarantee)"
    - "URL hydration gate: window.location.search.includes('s=') check to auto-confirm topology only when URL state is present"
    - "Step-aware canGoForward: computed switch on currentWizardStep, each case reads appropriate store values"

key-files:
  created: []
  modified:
    - src/stores/uiStore.ts
    - src/stores/uiStore.test.ts
    - src/components/shared/WizardStepper.vue
    - src/components/shared/TopologySelector.vue
    - src/main.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json

key-decisions:
  - "topologyConfirmed is ephemeral UI state in uiStore only — never serialized to URL or InputStateSchema (WIZARD-07)"
  - "URL hydration check uses window.location.search.includes('s=') — cleaner than inspecting hydrateFromUrl() return value"
  - "Step 2 gate uses calc.dedicatedMgmtHostCount !== null — null only occurs for dedicated architecture with invalid config"
  - "Colocated architecture always passes step 2 gate — management sizing is derived, never blocked"
  - "TopologySelector calls ui.confirmTopology() as last action in setGlobalTopology() — any topology click (including re-click) confirms"

patterns-established:
  - "Wizard gate pattern: canGoForward computed switches on currentWizardStep, each case uses dedicated store reads"
  - "Validation hint UX: <p> below Next button, amber text, conditionally shown when !canGoForward && step < 3"

requirements-completed: [WIZARD-03, WIZARD-04]

# Metrics
duration: 5min
completed: 2026-03-31
---

# Phase 17 Plan 01: Wizard Gates and Store Summary

**topologyConfirmed ephemeral flag in uiStore with step-aware WizardStepper canGoForward gates enforcing VCF design sequence (topology before management before workloads)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-31T05:23:11Z
- **Completed:** 2026-03-31T05:27:34Z
- **Tasks:** 2 (TDD: 1 RED + 1 GREEN)
- **Files modified:** 9

## Accomplishments
- Added `topologyConfirmed` ref (false by default) and `confirmTopology()` action to uiStore — WIZARD-03
- Step 1 Next button now blocked until user clicks any topology option in TopologySelector — WIZARD-03
- Step 2 Next button blocked for dedicated architecture until `dedicatedMgmtHostCount !== null` — WIZARD-04
- Step 2 always passes for colocated architecture (correct: management sizing is derived) — WIZARD-04
- URL-hydrated sessions auto-confirm topology via `window.location.search.includes('s=')` check in main.ts
- Validation hint message shown below Next button in amber when blocked (all 4 locales)
- 253 tests pass (17 more than baseline 236), build clean

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD RED — failing tests for topologyConfirmed** - `05ffa86` (test)
2. **Task 2: Implement topologyConfirmed + WizardStepper gates + TopologySelector + main.ts** - `e783b5f` (feat)

## Files Created/Modified
- `src/stores/uiStore.ts` - Added topologyConfirmed ref and confirmTopology() action
- `src/stores/uiStore.test.ts` - Added 4 new tests for WIZARD-03 (topologyConfirmed behavior)
- `src/components/shared/WizardStepper.vue` - Replaced simple canGoForward with step-aware gate; added validation hint
- `src/components/shared/TopologySelector.vue` - Added ui.confirmTopology() call in setGlobalTopology()
- `src/main.ts` - Added URL hydration check to auto-confirm topology when s= param present
- `src/i18n/locales/en.json` - Added wizard.step1.topologyRequired, wizard.step2.mgmtInvalid
- `src/i18n/locales/fr.json` - French translations for the above keys
- `src/i18n/locales/de.json` - German translations for the above keys
- `src/i18n/locales/it.json` - Italian translations for the above keys

## Decisions Made
- `topologyConfirmed` is ephemeral: lives in uiStore only, never in URL or InputStateSchema (WIZARD-07 guarantee maintained)
- URL hydration check: `window.location.search.includes('s=')` — only auto-confirms when URL actually contains state; fresh load leaves gate active
- Step 2 gate delegates to `calc.dedicatedMgmtHostCount !== null` — reuses existing null-contract from dedicatedMgmtHostCount (returns null when colocated)
- TopologySelector calls `ui.confirmTopology()` after every topology button click, including re-clicks of already-selected topology

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wizard gates active — step 1 and step 2 validation enforced
- Ready for Phase 17-02 (wizard step content: per-step panels with correct input forms)
- WIZARD-07 structural guarantee maintained throughout (InputStateSchema unmodified)

## Self-Check: PASSED

- FOUND: src/stores/uiStore.ts
- FOUND: src/components/shared/WizardStepper.vue
- FOUND: src/components/shared/TopologySelector.vue
- FOUND: src/main.ts
- FOUND: .planning/phases/17-wizard-step-content-and-export-accuracy/17-01-SUMMARY.md
- FOUND commit: 05ffa86 (test: RED gate)
- FOUND commit: e783b5f (feat: GREEN implementation)

---
*Phase: 17-wizard-step-content-and-export-accuracy*
*Completed: 2026-03-31*
