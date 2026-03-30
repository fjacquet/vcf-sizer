---
phase: 14-multi-domain-exports
plan: "01"
subsystem: exports
tags: [markdown, multi-domain, vsan, pptx, composables, tdd]

requires:
  - phase: 13-per-domain-results-and-aggregate-totals
    provides: domainResults computed array and aggregateTotals in calculationStore; first-domain bridge in useMarkdownExport.ts

provides:
  - Full multi-domain Markdown export loop in useMarkdownExport.ts
  - Per-domain ## Domain: {name} H2 sections with H3 sub-sections
  - ## Aggregate Totals section with summed host counts and storage
  - 7 new multi-domain tests (EXP-01, EXP-02 coverage)

affects:
  - 14-02-PLAN (PPTX export multi-domain)
  - useMarkdownExport.ts consumers (ExportToolbar.vue)

tech-stack:
  added: []
  patterns:
    - "for-loop over store.workloadDomains in export composable — same pattern to apply in usePptxExport.ts"
    - "H3 sub-sections inside H2 domain blocks for per-domain content"
    - "Global sections (Management Architecture, Management Domain Overhead, Aggregate Totals) outside domain loop"

key-files:
  created: []
  modified:
    - src/composables/useMarkdownExport.ts
    - src/composables/useMarkdownExport.test.ts

key-decisions:
  - "Per-domain sections use H3 (###) not H2 (##) — prevents heading level collision with domain H2 heading"
  - "Management Architecture and Management Domain Overhead remain outside domain loop — global deployment-level info"
  - "Aggregate Totals section appended after domain loop using calc.aggregateTotals (EXP-02)"
  - "Validation warnings read from calc.aggregateTotals.allValidationErrors (flattened across all domains)"
  - "Existing tests updated: H2 per-domain headings changed to H3 to match new structure"

patterns-established:
  - "Export composable loop pattern: for (const domain of store.workloadDomains) + domainResults.find(r => r.id === domain.id)!"

requirements-completed:
  - EXP-01
  - EXP-02

duration: 10min
completed: "2026-03-30"
---

# Phase 14 Plan 01: Multi-Domain Markdown Export Summary

**Full multi-domain Markdown loop replacing first-domain bridge: per-domain H2 sections with H3 sub-sections, plus Aggregate Totals after loop**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-30T15:20:00Z
- **Completed:** 2026-03-30T15:30:00Z
- **Tasks:** 2 (TDD: 1 RED + 1 GREEN)
- **Files modified:** 2

## Accomplishments

- Replaced `workloadDomains[0]` first-domain bridge with `for` loop over all `store.workloadDomains`
- Each domain emits `## Domain: {name}` H2 heading with 5 always-present H3 sub-sections and 4 conditional H3 blocks
- Added `## Aggregate Totals` section after the loop with totals from `calc.aggregateTotals` (EXP-02)
- Management Architecture and Management Domain Overhead sections stay outside the loop (exactly once each)
- 7 new multi-domain tests added; 229 total tests pass; `npm run build` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add multi-domain Markdown tests (RED)** - `9a8ae92` (test)
2. **Task 2: Implement multi-domain Markdown export (GREEN)** - `7a4a92e` (feat)

**Plan metadata:** (committed with final docs commit)

_Note: TDD tasks have two commits — test (RED) then feat (GREEN)_

## Files Created/Modified

- `src/composables/useMarkdownExport.ts` - Replaced first-domain bridge with full multi-domain loop; added Aggregate Totals section
- `src/composables/useMarkdownExport.test.ts` - Added 7 multi-domain tests (EXP-01/EXP-02); updated existing H2 checks to H3 for per-domain sections

## Decisions Made

- Per-domain sub-sections use H3 (`###`) not H2 to avoid heading collision with the `## Domain: {name}` wrapper (Pitfall 3 from research)
- Management sections (Architecture, Domain Overhead) intentionally kept outside the domain loop — they are deployment-level, not per-domain (Pitfall 4 from research)
- Aggregate Totals reads directly from `calc.aggregateTotals` which is already computed as a reducer across all domain results
- Validation warnings use `calc.aggregateTotals.allValidationErrors` (flattened from all domains)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing tests from H2 to H3 for per-domain sections**

- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Existing tests asserted `## Host Configuration`, `## Compute Sizing`, etc. (H2). After the multi-domain refactor these become H3 sub-sections inside domain blocks, so the assertions would fail.
- **Fix:** Updated all per-domain section assertions in `useMarkdownExport.test.ts` to use `###` prefix (NVMe, AI/GPU, Stretch Cluster, vSAN Max, Network Configuration, Host Configuration, Workload Profile, Compute Sizing, Storage Sizing).
- **Files modified:** `src/composables/useMarkdownExport.test.ts`
- **Verification:** Full suite 229 tests pass
- **Committed in:** `7a4a92e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug: tests would fail on correct implementation)
**Impact on plan:** Required correction — the plan specifies H3 sub-sections, so existing H2 test assertions needed updating. No scope creep.

## Issues Encountered

- Worktree was initially based on origin/maincd (dfea9c5, v2.1 archive) rather than local maincd (2fbd5d2, Phase 14). Reset with `git reset --hard maincd` before starting implementation. No test changes needed — this was a worktree setup issue.

## Next Phase Readiness

- Plan 14-01 complete: Markdown export now fully multi-domain
- Plan 14-02 (PPTX export) can follow the same for-loop pattern established here
- `for (const domain of store.workloadDomains)` + `domainResults.find(r => r.id === domain.id)!` is the canonical pattern for export composables

---
_Phase: 14-multi-domain-exports_
_Completed: 2026-03-30_
