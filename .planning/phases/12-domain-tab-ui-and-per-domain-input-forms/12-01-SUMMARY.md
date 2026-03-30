---
phase: 12-domain-tab-ui-and-per-domain-input-forms
plan: "01"
subsystem: ui-forms
tags: [multi-domain, tab-strip, forms, store-mutations, per-domain]
dependency_graph:
  requires: [10-01, 11-01]
  provides: [DomainTabStrip, per-domain-forms, renameDomain, updateManagementDomain]
  affects: [App.vue, Plan-12-02]
tech_stack:
  added: []
  patterns: [domainField-computed-helper, computed-get-set, per-domain-store-binding]
key_files:
  created:
    - src/components/shared/DomainTabStrip.vue
  modified:
    - src/stores/inputStore.ts
    - src/stores/inputStore.test.ts
    - src/components/input/HostSpecsForm.vue
    - src/components/input/WorkloadProfileForm.vue
    - src/components/input/StorageConfigForm.vue
    - src/components/input/DeploymentModelSelector.vue
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
decisions:
  - "domainField() helper pattern: computed({ get, set }) wrapping updateDomain() used in all 4 forms for per-domain field binding"
  - "DomainTabStrip uses window.confirm() for delete confirmation (consistent with window.print() pattern in project)"
  - "managementArchitecture stays global in DeploymentModelSelector (not per-domain), consistent with locked v3.0 decision"
  - "i18n domain keys added to all 4 locales in this plan (domain.addDomain, domain.deleteConfirm)"
metrics:
  duration: "~25min"
  completed_date: "2026-03-30"
  tasks_completed: 3
  files_modified: 10
---

# Phase 12 Plan 01: Store Mutations, DomainTabStrip, and Per-Domain Form Wiring Summary

Store mutations (`renameDomain`, `updateManagementDomain`), DomainTabStrip component with inline rename/delete/add, and all 4 input forms refactored from flat storeToRefs to per-domain `computed({ get, set })` via `domainField()` helper.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Store mutations + tests for renameDomain and updateManagementDomain | a2e81ca | src/stores/inputStore.ts, src/stores/inputStore.test.ts |
| 2 | Create DomainTabStrip.vue with add/delete/rename | 732c860 | src/components/shared/DomainTabStrip.vue, 4x locales |
| 3 | Refactor all 4 input forms to accept domainId prop | 7b49c59 | 4x form components |

## What Was Built

### Task 1: inputStore mutations
- `renameDomain(id, name)`: trims whitespace, ignores empty/whitespace-only strings, ignores non-existent IDs
- `updateManagementDomain(patch)`: Object.assign patch for management domain without overwriting unpatched fields
- 6 new unit tests covering edge cases; all 19 inputStore tests pass

### Task 2: DomainTabStrip.vue
- Horizontal tab strip with one tab per workload domain
- Active tab: `border-b-2 border-blue-600` visual indicator
- Delete button hidden when `workloadDomains.length === 1` (UI-03)
- Inline rename via double-click: blur/Enter commits, Escape cancels, guard against double-fire
- `hasNonDefaultData()` compares all non-id/name fields against defaults before showing confirm dialog
- Template refs use callback `setRenameRef` pattern for v-for refs
- `+ Add Domain` button calls `input.addDomain()`
- All 4 locale files updated with `domain.addDomain` and `domain.deleteConfirm` keys

### Task 3: Per-domain form refactoring
Pattern used in all 4 forms:
```typescript
const props = defineProps<{ domainId: string }>()
function domainField<K extends keyof WorkloadDomainConfig>(key: K) {
  return computed({
    get: () => (input.workloadDomains.find(d => d.id === props.domainId) ?? createDefaultWorkloadDomain(0))[key],
    set: (val) => input.updateDomain(props.domainId, { [key]: val })
  })
}
```

- **HostSpecsForm**: removed storeToRefs; 9 per-domain fields; vcfaBlockerError from domainResults.find()
- **WorkloadProfileForm**: removed storeToRefs; 8 per-domain fields; no calc store needed
- **StorageConfigForm**: removed storeToRefs; storage/vsanMax/validationErrors via domainResults.find() with optional chaining on all property accesses
- **DeploymentModelSelector**: removed storeToRefs; stretch/validationErrors per-domain; managementArchitecture global computed({ get, set }); management and dedicatedMgmtHostCount still top-level

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added domain i18n keys to all 4 locales**
- Found during: Task 2
- Issue: DomainTabStrip uses `t('domain.addDomain')` and `t('domain.deleteConfirm')` but these keys did not exist in any locale file
- Fix: Added `domain` section to all 4 locale files (en, fr, de, it) with appropriate translations
- Files modified: src/i18n/locales/en.json, fr.json, de.json, it.json
- Commit: 732c860

### Pre-existing Issues (out of scope)

The following type errors exist in files outside this plan's scope and were present before Phase 12 started (from Phase 10's store refactor):
- `src/App.vue` — forms used without domainId prop (Plan 12-02 will fix)
- `src/components/results/*.vue` — still using flat storeToRefs on old calc properties
- `src/composables/useMarkdownExport.ts` and `usePptxExport.ts` — still using flat store properties
- 58 test failures in useMarkdownExport.test.ts and usePptxExport.test.ts (pre-existing)

These are deferred to Phase 12-02 (App.vue integration) and Phase 14 (exports update).

## Verification Results

1. `npx vitest run src/stores/inputStore.test.ts` — PASS (19 tests, 0 failures)
2. vue-tsc — zero new errors introduced by this plan; pre-existing errors in App.vue/results/composables remain
3. `npm run test` — 58 failed (pre-existing) | 164 passed — no NEW failures from this plan

## Known Stubs

None. All 4 forms correctly wire to `domainId` prop and will function correctly when App.vue passes the prop (Plan 12-02).

## Self-Check: PASSED
