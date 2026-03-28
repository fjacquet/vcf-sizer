---
phase: 01-foundation-engine-and-inputs
plan: 03
subsystem: ui
tags: [vue3, tailwind, pinia, vue-i18n, components, input-forms]

# Dependency graph
requires:
  - phase: 01-01
    provides: inputStore, i18n setup, shared WarningBanner + LanguageSwitcher
  - phase: 01-02
    provides: calculationStore with management/compute/storage/validationErrors computed refs

provides:
  - NumberSliderInput reusable coupled number+slider component
  - DeploymentModelSelector with three-mode toggle wired to inputStore
  - ManagementSummary table showing per-component vCPU/RAM from calculationStore
  - HostSpecsForm with VCFA_MIN_CORES blocker banner
  - WorkloadProfileForm with VM workload inputs
  - StorageConfigForm with type selector, FTT/RAID policy, dedup toggle, capacity summary
  - App.vue updated to display all four input panels in single-column layout
  - Extended all four locale files (EN/FR/DE/IT) with storage and management table keys

affects: [02-results-panel, 03-stretch-cluster]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - NumberSliderInput: coupled number+range inputs with defineProps+defineEmits update:modelValue
    - storeToRefs for reactive Pinia store destructuring in components
    - computed() for derived UI state (vcfaBlockerError, totalCoresPerHost)
    - v-if on WarningBanner keyed to calculationStore.validationErrors error codes
    - Template-based storage type toggle using const array with labelKey

key-files:
  created:
    - src/components/shared/NumberSliderInput.vue
    - src/components/shared/ManagementSummary.vue
    - src/components/input/DeploymentModelSelector.vue
    - src/components/input/HostSpecsForm.vue
    - src/components/input/WorkloadProfileForm.vue
    - src/components/input/StorageConfigForm.vue
  modified:
    - src/App.vue
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json

key-decisions:
  - "NumberSliderInput treats number input as primary (architects need exact values) — slider is secondary sensitivity helper"
  - "WarningBanner driven by validationErrors error codes (VCFA_MIN_CORES, DEDUP_STRETCH_EXCLUSION) — no local computed flags"
  - "storageType/fttLevel/raidType buttons use const array of {value, labelKey} objects — avoids inline string literals in template"
  - "Added storage.rawCapacity/raidOverhead/netUsable keys to all 4 locale files to eliminate any hardcoded text"

patterns-established:
  - "storeToRefs pattern: always destructure from storeToRefs() for reactive two-way binding"
  - "computed() for all derived UI state in components — never recalculate in template"
  - "i18n completeness: every string added to EN + FR + DE + IT simultaneously"

requirements-completed:
  - DEPLOY-01
  - DEPLOY-02
  - DEPLOY-03
  - HOST-01
  - HOST-02
  - HOST-03
  - HOST-04
  - HOST-05
  - WKLD-01
  - WKLD-02
  - WKLD-03
  - WKLD-04
  - WKLD-05
  - WKLD-06

# Metrics
duration: 10min
completed: 2026-03-28
---

# Phase 1 Plan 3: Input Panel Components Summary

**Vue 3 SFC input panel components wired reactively to Pinia stores — NumberSliderInput, DeploymentModelSelector, ManagementSummary, HostSpecsForm, WorkloadProfileForm, StorageConfigForm all built with full i18n and VCFA blocker warning.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-28T23:34:10Z
- **Completed:** 2026-03-28T23:44:00Z
- **Tasks:** 2 completed (checkpoint auto-approved)
- **Files modified:** 11

## Accomplishments

- Built six Vue 3 SFC components (2 shared, 4 input panels) all using `<script setup>` with storeToRefs reactive binding
- VCFA core blocker warning (red WarningBanner) fires when coresPerSocket * socketsPerHost < 12, driven by calculationStore.validationErrors
- All component text uses `t()` from vue-i18n — zero hardcoded English strings, all four locales updated in parallel
- App.vue wired with sticky header, all four input panels stacked in max-w-2xl single-column layout
- npm run build passes, npm run test passes (30/30)

## Task Commits

1. **Task 1: NumberSliderInput, DeploymentModelSelector, ManagementSummary** - `0c3661a` (feat)
2. **Task 2: HostSpecsForm, WorkloadProfileForm, StorageConfigForm, App.vue** - `854969d` (feat)

## Files Created/Modified

- `src/components/shared/NumberSliderInput.vue` - Reusable coupled number+range slider, emits update:modelValue
- `src/components/shared/ManagementSummary.vue` - Per-component vCPU/RAM table reading calculationStore.management
- `src/components/input/DeploymentModelSelector.vue` - Three-mode toggle (Simple/HA/Stretch) with inline overhead summary
- `src/components/input/HostSpecsForm.vue` - Host spec inputs with prominent red VCFA blocker banner
- `src/components/input/WorkloadProfileForm.vue` - VM workload inputs (count, vCPU, vRAM, storage, overcommit ratios)
- `src/components/input/StorageConfigForm.vue` - Storage type selector, FTT/RAID policy, dedup toggle, capacity summary
- `src/App.vue` - Updated to display all four input panels in single-column layout
- `src/i18n/locales/en.json` - Added management.component/vcpu/ramLabel, storage.rawCapacity/raidOverhead/netUsable/minHosts
- `src/i18n/locales/fr.json` - Same keys in French
- `src/i18n/locales/de.json` - Same keys in German
- `src/i18n/locales/it.json` - Same keys in Italian

## Decisions Made

- Used `storeToRefs()` for all Pinia store destructuring to preserve Vue 3 reactivity
- VCFA blocker uses `validationErrors.value.find(e => e.code === 'VCFA_MIN_CORES')` pattern — single source of truth from calculationStore
- storageType toggle implemented as const array of {value, labelKey} objects to avoid hardcoded strings in template iteration
- ManagementSummary uses function refs in rows array `() => management.value.vcenterCores` so table re-renders reactively

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added i18n keys for ManagementSummary table headers**
- **Found during:** Task 1 (ManagementSummary implementation)
- **Issue:** Plan used hardcoded "Component", "vCPU", "RAM (GB)" as table headers — violates no-hardcoded-strings rule
- **Fix:** Added management.component/vcpu/ramLabel keys to all four locale files
- **Files modified:** src/i18n/locales/en.json, fr.json, de.json, it.json
- **Committed in:** 0c3661a

**2. [Rule 2 - Missing Critical] Added i18n keys for StorageConfigForm capacity summary**
- **Found during:** Task 2 (StorageConfigForm implementation)
- **Issue:** Plan used hardcoded "Raw Capacity", "RAID Overhead", "Net Usable" text — violates no-hardcoded-strings rule
- **Fix:** Added storage.rawCapacity/raidOverhead/netUsable/netUsablePassthrough/minHosts to all four locale files
- **Files modified:** src/i18n/locales/en.json, fr.json, de.json, it.json
- **Committed in:** 854969d

**Total deviations:** 2 auto-fixed (both missing i18n keys caught before commit)
**Impact:** No scope change. All text now properly internationalised.

## Issues Encountered

None — plan executed cleanly. Build and tests pass.

## Next Phase Readiness

- Phase 1 complete: architect can enter full VCF 9.x specification and see management overhead in real time
- calculationStore API surface is stable (management, compute, storage, validationErrors)
- Phase 2 can read calculationStore computed refs to drive charts and results panel
- i18n translation keys established — Phase 3 fills FR/DE/IT translations

## Self-Check: PASSED

All 8 created/modified files confirmed present on disk.
Both task commits verified in git log (0c3661a, 854969d).
npm run build: exits 0, npm run test: 30/30 pass.

---
*Phase: 01-foundation-engine-and-inputs*
*Completed: 2026-03-28*
