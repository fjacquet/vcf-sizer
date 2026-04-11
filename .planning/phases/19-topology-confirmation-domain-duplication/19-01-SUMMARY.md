---
phase: 19-topology-confirmation-domain-duplication
plan: "01"
subsystem: stores, components, i18n
tags: [tdd, store-action, modal, i18n, topology-guard]
dependency_graph:
  requires: []
  provides: [duplicateDomain-action, ConfirmationDialog-component, topology-guard]
  affects: [TopologySelector.vue, inputStore.ts, all-locale-files]
tech_stack:
  added: []
  patterns: [structuredClone+toRaw, Teleport-modal, intercept-guard]
key_files:
  created:
    - src/components/shared/ConfirmationDialog.vue
  modified:
    - src/stores/inputStore.ts
    - src/stores/inputStore.test.ts
    - src/components/shared/TopologySelector.vue
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
decisions:
  - structuredClone(toRaw(source)) is the canonical domain clone pattern — bare structuredClone throws on Pinia reactive proxy (Pinia #1412)
  - duplicateDomain name is a parameter (not hardcoded suffix) — keeps store i18n-clean
  - pendingTopology stored in local ref, never written to store before user confirms (PITFALL-5)
  - hasConfiguredDomains skips deploymentMode in addition to id/name — topology change should not trigger its own confirmation
  - applyTopology calls confirmTopology() (idempotent) + setWizardStep(1) per ROADMAP criterion 3
metrics:
  duration_seconds: 266
  completed_date: "2026-04-11"
  tasks_completed: 4
  files_changed: 7
requirements:
  - WIZARD-03
  - DOMAIN-01
---

# Phase 19 Plan 01: Topology Confirmation + Domain Duplication Summary

**One-liner:** TDD `duplicateDomain` store action using `structuredClone(toRaw())`, reusable `ConfirmationDialog` modal with Teleport, topology-change guard in `TopologySelector`, and topology i18n keys in all 4 locales.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TDD -- duplicateDomain action (RED+GREEN) | 3b0343c | inputStore.ts, inputStore.test.ts |
| 2 | Create ConfirmationDialog.vue | bf31819 | src/components/shared/ConfirmationDialog.vue |
| 3 | Wire topology guard in TopologySelector.vue | d401f3c | src/components/shared/TopologySelector.vue |
| 4 | Add topology i18n keys to all 4 locale files | 178a15e | en.json, fr.json, de.json, it.json |

## What Was Built

### duplicateDomain store action (DOMAIN-01)

Added to `src/stores/inputStore.ts`:

- `duplicateDomain(id: string, newName: string): void`
- Uses `structuredClone(toRaw(source))` to produce a deep independent copy that bypasses Pinia's reactive proxy (Pinia #1412)
- Clone gets a new UUID via `crypto.randomUUID()`
- Clone is spliced at `idx + 1` (immediately after source)
- `activeDomainIndex` advances to the new clone position
- No-op if `id` not found
- Name is passed as parameter (store does not hardcode any suffix — i18n-clean)

7 TDD tests added to `inputStore.test.ts` — all pass. Total test count: 286 (baseline 279 + 7 new).

### ConfirmationDialog.vue (WIZARD-03)

New component at `src/components/shared/ConfirmationDialog.vue`:

- Props: `visible`, `title`, `message`, `confirmLabel`, `cancelLabel`
- Emits: `confirm`, `cancel`
- Uses `<Teleport to="body">` to prevent stacking context clipping
- `@click.self` on overlay backdrop emits `cancel`
- `@keydown.escape` on overlay emits `cancel`
- ARIA: `role="dialog"`, `aria-modal="true"`
- Cancel button left (safe default), Confirm button right

### Topology change guard (TopologySelector.vue)

Rewrote `src/components/shared/TopologySelector.vue`:

- Imports `ConfirmationDialog`, `createDefaultWorkloadDomain`, `WorkloadDomainConfig`
- `pendingTopology` and `showConfirmDialog` are local refs — never written to store before confirmation
- `hasConfiguredDomains()` checks all workload domains against defaults, skipping `id`, `name`, and `deploymentMode`
- `requestTopologyChange()`: no-op on same topology; shows dialog if any domain has configured data; directly applies if all domains are at defaults
- `applyTopology()`: updates management domain + all workload domains' `deploymentMode`, calls `confirmTopology()` (idempotent) and `setWizardStep(1)`
- `onConfirm()` / `onCancel()` manage pending state
- `ConfirmationDialog` wired in template with `topology.*` i18n keys

### i18n topology namespace

Added `"topology"` key (alphabetically before `"warnings"`) to all 4 locale files:

- **en**: "Change topology?", "Changing the topology will reset all workload domain settings..."
- **fr**: With typographic non-breaking space before `?`, proper accented characters
- **de**: With proper umlauts (`\u00e4`, `\u00c4`, `\u00fc`)
- **it**: With accented character (`\u00e8`)

## Verification Results

- Full test suite: 286 tests, 0 failures
- Type-check: zero errors
- Build: clean (181 modules transformed, all locale chunks generated)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality fully implemented.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. All changes operate on in-memory Pinia state only. No threat flags to report.

## Self-Check: PASSED

- ConfirmationDialog.vue: FOUND at src/components/shared/ConfirmationDialog.vue
- TopologySelector.vue contains `pendingTopology`: FOUND (5 occurrences)
- TopologySelector.vue contains `ConfirmationDialog`: FOUND (2 occurrences)
- en.json topology.confirmTitle: FOUND
- fr.json topology.confirmTitle: FOUND
- de.json topology.confirmTitle: FOUND
- it.json topology.confirmTitle: FOUND
- Commits: 3b0343c, bf31819, d401f3c, 178a15e — all present in git log
- Test count: 286 (279 baseline + 7 new duplicateDomain tests)
