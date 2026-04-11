---
phase: 19-topology-confirmation-domain-duplication
plan: 02
subsystem: ui
tags: [vue3, i18n, domain-tabs, copy-button, svg-icon, aria-label]

# Dependency graph
requires:
  - phase: 19-01
    provides: duplicateDomain action in inputStore, ConfirmationDialog.vue, topology guard in TopologySelector

provides:
  - Copy button on each domain tab in DomainTabStrip.vue calling input.duplicateDomain
  - domain.copyDomain and domain.copyNameSuffix i18n keys in all 4 locales (en, fr, de, it)
  - Full Phase 19 feature set complete: WIZARD-03 topology guard + DOMAIN-01 domain copy

affects: [phase-20, any phase using DomainTabStrip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@click.stop on inline action buttons within tab items to prevent tab-activation bubbling"
    - "Inline SVG icon with aria-hidden=true + focusable=false for accessible button icon pattern"
    - "Localized name computed at call site: template passes `${domain.name} ${t('domain.copyNameSuffix')}` — store stays i18n-free"

key-files:
  created: []
  modified:
    - src/components/shared/DomainTabStrip.vue
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json

key-decisions:
  - "Copy button is always visible (not gated on workloadDomains.length > 1) — single-domain copy is valid"
  - "Blue hover (hover:text-blue-500) for copy button signals non-destructive additive action, contrasting red hover on delete"
  - "Localized suffix computed in template, not store — keeps inputStore i18n-free per architecture rules"

patterns-established:
  - "Inline tab action buttons: always @click.stop to prevent tab activation"
  - "SVG icons in buttons: aria-hidden=true + focusable=false is the project standard"

requirements-completed:
  - DOMAIN-01
  - WIZARD-03

# Metrics
duration: 5min
completed: 2026-04-11
---

# Phase 19 Plan 02: Copy Domain Button UI Summary

**Copy button added to DomainTabStrip tabs — inline SVG, blue hover, @click.stop, aria-label interpolated from domain.copyDomain — wired to inputStore.duplicateDomain with localized (copy) suffix across all 4 locales**

## Performance

- **Duration:** ~5 min (work was pre-completed in Plan 01 session; this plan verified and documented)
- **Started:** 2026-04-11T02:59:45Z
- **Completed:** 2026-04-11T02:59:50Z
- **Tasks:** 3 (Tasks 1 and 2 already committed; Task 3 auto-approved)
- **Files modified:** 5 (DomainTabStrip.vue + 4 locale files)

## Accomplishments

- Copy button rendered on every domain tab with two-overlapping-squares SVG icon and blue hover state
- Button click calls `input.duplicateDomain(domain.id, \`${domain.name} ${t('domain.copyNameSuffix')}\`)` with `@click.stop` to prevent tab activation
- `domain.copyDomain` ("Copy domain \"{name}\"") and `domain.copyNameSuffix` ("(copy)" / "(copie)" / "(Kopie)" / "(copia)") added to all 4 locale files
- 286 tests passing, production build clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add copy button to DomainTabStrip.vue** - `ebdcb31` (feat) — pre-completed in Plan 01 session
2. **Task 2: Add domain copy i18n keys to all 4 locale files** - `ebdcb31` (feat) — same commit as Task 1
3. **Task 3: Human verify checkpoint** - auto-approved (--auto flag active); automated checks confirmed 286 tests, clean build

## Files Created/Modified

- `src/components/shared/DomainTabStrip.vue` — Added copy button per tab: SVG icon, `@click.stop`, `aria-label` from `t('domain.copyDomain', { name: domain.name })`, calls `input.duplicateDomain`
- `src/i18n/locales/en.json` — Added `domain.copyDomain`, `domain.copyNameSuffix` to domain namespace
- `src/i18n/locales/fr.json` — Added `domain.copyDomain` (Copier le domaine), `domain.copyNameSuffix` ((copie))
- `src/i18n/locales/de.json` — Added `domain.copyDomain` (Domane kopieren), `domain.copyNameSuffix` ((Kopie))
- `src/i18n/locales/it.json` — Added `domain.copyDomain` (Copia dominio), `domain.copyNameSuffix` ((copia))

## Decisions Made

- Copy button always visible (not gated on domain count) — single domain copy is valid and should be accessible
- Blue hover color distinguishes copy (additive, safe) from delete button's red hover (destructive)
- New name computed in template to keep inputStore i18n-free per CALC-01 architecture constraint

## Deviations from Plan

None — plan executed exactly as written. All required changes were already in place from Plan 01 session; this plan verified existing implementation and produced documentation.

## Issues Encountered

None — all 7 human-verification tests were bypassed via auto-approve flag (`--auto` active). Automated checks confirmed 286 tests passing and clean build.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 19 complete: both WIZARD-03 (topology confirmation dialog) and DOMAIN-01 (domain copy button) fully implemented
- All 286 tests passing, production build clean
- Phase 20 (storage units correction TB→TiB, STOR-01 through STOR-04) is ready to begin

---
*Phase: 19-topology-confirmation-domain-duplication*
*Completed: 2026-04-11*
