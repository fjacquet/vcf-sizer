---
phase: 12-domain-tab-ui-and-per-domain-input-forms
plan: "02"
subsystem: ui-forms
tags: [multi-domain, management-domain, app-wiring, i18n, tab-strip]
dependency_graph:
  requires: [12-01]
  provides: [ManagementDomainSection, App.vue-multi-domain-wiring, i18n-management-keys]
  affects: [App.vue, DeploymentModelSelector.vue, all-locales]
tech_stack:
  added: []
  patterns: [mgmtField-computed-helper, computed-get-set, per-domain-domainId-prop]
key_files:
  created:
    - src/components/input/ManagementDomainSection.vue
  modified:
    - src/App.vue
    - src/components/input/DeploymentModelSelector.vue
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
decisions:
  - "ManagementDomainSection uses mgmtField() helper mirroring domainField() pattern — computed({ get, set }) wrapping updateManagementDomain()"
  - "Architecture toggle and management overhead summary moved from DeploymentModelSelector to ManagementDomainSection (UI-05)"
  - "App.vue computes activeDomainId from workloadDomains[activeDomainIndex] with null-coalescing fallback to workloadDomains[0].id"
  - "ManagementSummary kept below ManagementDomainSection in App.vue (no position change needed)"
metrics:
  duration: "~10min"
  completed_date: "2026-03-30"
  tasks_completed: 3
  files_modified: 7
---

# Phase 12 Plan 02: ManagementDomainSection, App.vue Wiring, and i18n Summary

ManagementDomainSection.vue with management host specs + architecture toggle, App.vue rewired to pass activeDomainId to all 4 per-domain forms via DomainTabStrip, and 6 new i18n keys added to all 4 locale files.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ManagementDomainSection.vue and wire App.vue | f661bd1 | src/components/input/ManagementDomainSection.vue, src/App.vue, src/components/input/DeploymentModelSelector.vue |
| 1-fix | Remove unused variables from DeploymentModelSelector.vue | 77f9519 | src/components/input/DeploymentModelSelector.vue |
| 2 | Add all new i18n keys to 4 locale files | 1aad115 | src/i18n/locales/en.json, fr.json, de.json, it.json |
| 3 | checkpoint:human-verify | (auto-approved) | - |

## What Was Built

### Task 1: ManagementDomainSection.vue + App.vue Wiring

**ManagementDomainSection.vue** (`src/components/input/ManagementDomainSection.vue`):

- `mgmtField()` helper: `computed({ get, set })` wrapping `updateManagementDomain()` — mirrors domainField() pattern from Plan 12-01
- Management host specs sliders: coresPerSocket (4–64), socketsPerHost (1–8), hostRamGB (64–6144 GB), hostStorageTB (0.96–30.72 TB)
- Architecture toggle (shared/dedicated) — global, not per-domain, reads/writes `input.managementArchitecture`
- Management overhead summary grid (totalCores, totalRamGB from calc.management)
- Dedicated host count row shown when `dedicatedMgmtHostCount !== null`

**App.vue** rewrite:

- Added imports: `computed`, `useInputStore`, `DomainTabStrip`, `ManagementDomainSection`
- `activeDomainId` computed: `input.workloadDomains[input.activeDomainIndex]?.id ?? input.workloadDomains[0].id`
- `<DomainTabStrip />` placed at top of left pane
- All 4 forms receive `:domainId="activeDomainId"` prop
- `<ManagementDomainSection />` placed below per-domain forms, above `<ManagementSummary />`

**DeploymentModelSelector.vue** cleanup:

- Removed architecture toggle block (`<template v-if="deploymentMode !== 'simple'">`)
- Removed management overhead summary div
- Removed `managementArchitecture`, `dedicatedMgmtHostCount`, `architectureErrors` computed
- Removed `storageType`, `validationErrors` unused computed
- Removed `WarningBanner` import (no longer used)

### Task 2: i18n Keys

6 new keys added across all 4 locale files:

- `domain.managementSection` — heading for ManagementDomainSection
- `domain.managementHostSpecs` — subheading for host specs section
- `deployment.architecture.dedicatedHosts` — label for dedicated host count

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `storageType` and `validationErrors` from DeploymentModelSelector.vue**

- Found during: Task 1 verification (build output)
- Issue: After removing the architecture toggle block (which was the only consumer of these computed refs), vue-tsc reported TS6133 unused variable errors
- Fix: Removed `storageType = domainField('storageType')` and `validationErrors = computed(...)` from DeploymentModelSelector.vue script
- Files modified: src/components/input/DeploymentModelSelector.vue
- Commit: 77f9519

### Pre-existing Issues (out of scope, deferred to later phases)

The following type errors exist in files outside this plan's scope and were present before Phase 12-02:

- `src/components/results/*.vue` — still using flat storeToRefs on old calc properties (deferred to Phase 14)
- `src/composables/useMarkdownExport.ts` and `usePptxExport.ts` — still using flat store properties (deferred to Phase 14)
- 58 test failures in useMarkdownExport.test.ts and usePptxExport.test.ts (pre-existing from Phase 10)

## Verification Results

1. `npx vue-tsc --noEmit` — zero errors in App.vue, ManagementDomainSection.vue, DeploymentModelSelector.vue, or locale files; pre-existing errors in composables/results only (documented in 12-01-SUMMARY)
2. `npm run test` — 58 failed (pre-existing) | 164 passed — no new failures from this plan
3. checkpoint:human-verify — auto-approved (auto_advance=true)

## Known Stubs

None. ManagementDomainSection fully wires to inputStore.managementDomain and calculationStore. App.vue correctly derives activeDomainId and passes to all 4 forms.

## Self-Check: PASSED
