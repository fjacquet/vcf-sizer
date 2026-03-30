---
phase: 16-wizard-scaffold-and-state
plan: 01
subsystem: ui
tags: [pinia, vuex, wizard, state-management, i18n, vitest, url-state, zod]

# Dependency graph
requires:
  - phase: 11-url-state-schema-refactor
    provides: InputStateSchema with .strip() behavior used in WIZARD-07 tests
  - phase: 10-domain-types-defaults-store-refactor
    provides: inputStore with managementDomain and workloadDomains used in independence tests
provides:
  - uiStore.currentWizardStep ref<1 | 2 | 3> initialized to 1
  - uiStore.setWizardStep(step) action for wizard navigation
  - 6 unit tests for WIZARD-02 (step init, transitions, inputStore independence)
  - 2 tests proving WIZARD-07 URL exclusion (schema strip + structural absence)
  - wizard.step1/step2/step3/nav i18n keys in all 4 locales (en/fr/de/it)
affects:
  - 16-02 (WizardStepper component and App.vue restructuring depends on this state)
  - 17 and beyond (any phase using wizard navigation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wizard step state lives exclusively in uiStore — never in InputStateSchema (WIZARD-07 structural guarantee)"
    - "Store test pattern: setActivePinia(createPinia()) in beforeEach for isolation"
    - "TDD discipline: RED (fail) then GREEN (pass) before committing implementation"
    - "vitest.config.ts extended to include src/stores/**/*.test.ts"

key-files:
  created:
    - src/stores/uiStore.test.ts
  modified:
    - src/stores/uiStore.ts
    - src/composables/useUrlState.test.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
    - vitest.config.ts

key-decisions:
  - "currentWizardStep lives in uiStore only — confirmed by WIZARD-07 tests proving InputStateSchema strips it"
  - "vitest include extended to src/stores/**/*.test.ts to enable store unit tests (Rule 3 fix)"

patterns-established:
  - "Store tests use setActivePinia(createPinia()) pattern consistent with composable tests"
  - "WIZARD-07 tests serve as regression guards: any future accidental serialization of wizard step to URL will be caught"

requirements-completed:
  - WIZARD-02
  - WIZARD-07

# Metrics
duration: 12min
completed: 2026-03-30
---

# Phase 16 Plan 01: Wizard Scaffold and State Summary

**uiStore extended with ref<1 | 2 | 3> currentWizardStep + setWizardStep action, 8 TDD tests proving WIZARD-02/WIZARD-07, and wizard i18n keys added to all 4 locales**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-30T20:17:00Z
- **Completed:** 2026-03-30T20:29:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- uiStore now exposes currentWizardStep (ref initialized to 1) and setWizardStep action for wizard navigation
- 6 unit tests prove WIZARD-02: step initialization to 1, transitions between all steps, and inputStore independence (managementDomain and workloadDomains unaffected by wizard step changes)
- 2 WIZARD-07 tests prove URL exclusion: InputStateSchema.strip() removes currentWizardStep, and the generateShareUrl state object structurally never includes it
- All 4 locale files (en/fr/de/it) contain matching wizard.step1/step2/step3/nav keys with localized labels and navigation text
- Extended vitest.config.ts to include src/stores/**/*.test.ts (required to run store tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add currentWizardStep to uiStore and create uiStore tests** - `cffc8fd` (feat)
2. **Task 2: Add WIZARD-07 URL exclusion test to useUrlState.test.ts** - `9d2eb3e` (test)
3. **Task 3: Add wizard i18n keys to all four locale files** - `97a84a0` (chore)

**Plan metadata:** committed separately (docs)

_Note: TDD tasks have RED then GREEN commit sequence_

## Files Created/Modified

- `src/stores/uiStore.ts` - Added currentWizardStep ref<1 | 2 | 3>(1) and setWizardStep action
- `src/stores/uiStore.test.ts` - Created: 6 unit tests for WIZARD-02 (step state management)
- `src/composables/useUrlState.test.ts` - Added describe block 'WIZARD-07: wizard step URL exclusion' with 2 tests
- `src/i18n/locales/en.json` - Added wizard section with step1/step2/step3/nav keys
- `src/i18n/locales/fr.json` - Added wizard section with French translations
- `src/i18n/locales/de.json` - Added wizard section with German translations
- `src/i18n/locales/it.json` - Added wizard section with Italian translations
- `vitest.config.ts` - Extended include to add src/stores/**/*.test.ts

## Decisions Made

- vitest.config.ts needed to be updated to include store tests. The CLAUDE.md stated "Tests cover src/engine/**/*.test.ts and src/composables/**/*.test.ts only" but the plan explicitly created src/stores/uiStore.test.ts. Applied Rule 3 (blocking fix) — extended include rather than moving the test file to an already-covered directory.
- currentWizardStep structural exclusion from InputStateSchema confirmed by tests — no future code should add it to that schema.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended vitest.config.ts to include src/stores/**/*.test.ts**
- **Found during:** Task 1 (running RED phase tests)
- **Issue:** vitest config only covered src/engine and src/composables — store tests returned "No test files found"
- **Fix:** Added 'src/stores/**/*.test.ts' to the include array in vitest.config.ts
- **Files modified:** vitest.config.ts
- **Verification:** Tests discovered and ran (all 6 failed in RED, all 6 passed in GREEN)
- **Committed in:** cffc8fd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to run the store tests the plan requires. No scope creep.

## Issues Encountered

None beyond the vitest config fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 16-02 (WizardStepper component + App.vue restructuring) can proceed: uiStore.currentWizardStep and setWizardStep are ready, i18n keys are defined
- Full test suite green: 190 tests passing
- TypeScript type check: zero errors

---
*Phase: 16-wizard-scaffold-and-state*
*Completed: 2026-03-30*

## Self-Check: PASSED

- FOUND: src/stores/uiStore.ts
- FOUND: src/stores/uiStore.test.ts
- FOUND: src/composables/useUrlState.test.ts
- FOUND: src/i18n/locales/en.json (with wizard keys)
- FOUND: src/i18n/locales/fr.json (with wizard keys)
- FOUND: src/i18n/locales/de.json (with wizard keys)
- FOUND: src/i18n/locales/it.json (with wizard keys)
- FOUND: .planning/phases/16-wizard-scaffold-and-state/16-01-SUMMARY.md
- FOUND commit cffc8fd: feat(16-01): add currentWizardStep to uiStore
- FOUND commit 9d2eb3e: test(16-01): add WIZARD-07 URL exclusion tests
- FOUND commit 97a84a0: chore(16-01): add wizard i18n keys
- Full test suite: 190 passing, 0 failing
