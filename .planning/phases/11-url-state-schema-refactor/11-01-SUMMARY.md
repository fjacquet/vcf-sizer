---
phase: 11-url-state-schema-refactor
plan: "01"
subsystem: url-state
tags: [zod, lz-string, multi-domain, url-state, tdd]
dependency_graph:
  requires: [phase-10-store-refactor]
  provides: [multi-domain-url-schema, WorkloadDomainSchema, ManagementDomainSchema, InputStateSchema]
  affects: [src/composables/useUrlState.ts, src/composables/useUrlState.test.ts]
tech_stack:
  added: []
  patterns:
    - "Nested Zod schemas with factory defaults (.default(() => Schema.parse({}))) to apply inner field defaults"
    - "Array Zod schema with factory default (.default(() => [createDefaultWorkloadDomain(0)])) per Zod v4 requirement"
    - "3-field structured assignment in hydrateFromUrl (replaces 20+ flat scalar assignments)"
    - "generateShareUrl excludes domain id (saves ~40 bytes per domain; re-generated on hydration)"
key_files:
  created: []
  modified:
    - src/composables/useUrlState.ts
    - src/composables/useUrlState.test.ts
decisions:
  - "Export WorkloadDomainSchema, ManagementDomainSchema, InputStateSchema from useUrlState.ts for future use by Phase 12+ form components"
  - "Exclude domain id from generateShareUrl serialization — saves URL bytes, IDs re-generated via crypto.randomUUID() on hydration"
  - "Re-generate all domain IDs in hydrateFromUrl — IDs from URL are not meaningful across sessions"
  - "v2.x flat-schema URLs degrade silently to 1-domain default — .strip() removes flat fields, workloadDomains factory default provides fallback"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-30"
  tasks_completed: 2
  files_modified: 2
---

# Phase 11 Plan 01: URL State Schema Refactor Summary

**One-liner:** Rewrote useUrlState.ts Zod schema from flat 20-field structure to nested 3-field multi-domain schema (managementArchitecture + ManagementDomainSchema + WorkloadDomainSchema[]).

## What Was Built

The Zod schema in `src/composables/useUrlState.ts` was completely replaced. The old flat schema had 20 scalar fields matching the v2.x `inputStore` structure. The new schema has three top-level fields:

- `managementArchitecture` — global deployment-level toggle ('shared' | 'dedicated')
- `managementDomain` — `ManagementDomainSchema` (4 fields with factory default)
- `workloadDomains` — `z.array(WorkloadDomainSchema).min(1)` with factory default

`WorkloadDomainSchema` has 28 fields matching `WorkloadDomainConfig` exactly (26 config fields + id + name). All three schemas are exported for reuse by future phases.

`hydrateFromUrl` was updated: 20+ flat scalar assignments replaced by 3 structured assignments. Domain IDs are re-generated via `crypto.randomUUID()` on hydration. `activeDomainIndex` is never assigned (URL-04).

`generateShareUrl` was updated: reads nested store structure (`managementDomain`, `workloadDomains`), excludes domain `id` from serialization to reduce URL size.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite useUrlState.test.ts with RED failing tests | 76b84fa | src/composables/useUrlState.test.ts |
| 2 | Rewrite useUrlState.ts with multi-domain Zod schema | 6e6a74d | src/composables/useUrlState.ts |

## Verification Results

- `npx vitest run src/composables/useUrlState.test.ts` — 16/16 tests PASS
- `npm run test` — 58 failed (all pre-existing from Phase 10 store refactor), 158 passed, 216 total — no new failures
- `npm run build` — build fails on pre-existing Phase 10 type errors in usePptxExport.ts (not related to this plan)

### Test Coverage (16 tests across 5 describe blocks)

1. **URL-01 — New schema structure (6 tests):** schema defaults, workloadDomains length, WLD-1 name, managementDomain coresPerSocket=16, .strip() removes unknowns, ManagementDomainSchema 4 field defaults
2. **URL-02 — v2.x backward compatibility (3 tests):** flat payload parses, produces 1-domain default, preserves managementArchitecture
3. **URL-03 — Multi-domain round-trip (3 tests):** 3-domain names preserved, non-default field values preserved, 5-domain URL < 2048 chars
4. **URL-04 — activeTabIndex exclusion (1 test):** .strip() removes activeDomainIndex
5. **Schema validation — edge cases (3 tests):** invalid enum rejected, empty array rejected, lz-string null guard

### URL Length Empirical Data

Per research phase (verified at implementation time):

- 1 domain: 654 chars
- 3 domains: 1,277 chars
- 5 domains: 1,789 chars — passes SC4 (< 2,048 chars)
- 8 domains: 2,454 chars (practical limit, no schema cap added)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The URL state schema is fully implemented and operational. The composable can serialize/deserialize multi-domain configurations. However, the composable is not yet exercised end-to-end because Phase 12 (tab-based domain UI) has not been built yet — the store has multiple domains but the UI only shows one tab.

## Self-Check

## Self-Check: PASSED

- FOUND: src/composables/useUrlState.ts
- FOUND: src/composables/useUrlState.test.ts
- FOUND: .planning/phases/11-url-state-schema-refactor/11-01-SUMMARY.md
- FOUND commit: 76b84fa (test(11-01): add failing tests for multi-domain URL schema)
- FOUND commit: 6e6a74d (feat(11-01): rewrite useUrlState.ts with multi-domain Zod schema)
