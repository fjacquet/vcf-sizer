---
phase: 06-markdown-extraction-and-enrichment
plan: 03
subsystem: composables/export
tags: [markdown, export, sections, tdd, wave-2]
dependency_graph:
  requires: [06-02]
  provides: [complete-markdown-report, MD-02, MD-03, MD-04, MD-05, MD-06, MD-07, MD-08, MD-09]
  affects: [ExportToolbar.vue]
tech_stack:
  added: []
  patterns: [sections-array-pattern, conditional-guards, null-checks]
key_files:
  created: []
  modified:
    - src/composables/useMarkdownExport.ts
decisions:
  - generateMarkdownReport() uses sections[] array pattern with push() for conditional sections
  - dedicatedMgmtHostCount row uses label 'Dedicated host count' matching test expectations
  - i18n keys rendered as-is for validation warnings (Pitfall 6 — no i18n in composable context)
  - MD-07 double guard: storageType === 'vsan-max' AND vsanMax !== null (Pitfall 3)
metrics:
  duration: 5min
  completed: "2026-03-30"
  tasks: 1
  files: 1
---

# Phase 06 Plan 03: Markdown Enrichment — All Sections Summary

**One-liner:** Complete 11-section Markdown report generator with 5 conditional sections guarded by store state.

## What Was Built

`generateMarkdownReport()` in `src/composables/useMarkdownExport.ts` was rewritten from 4 sections to 11 sections, covering all MD-01 through MD-09 requirements. The function uses a `sections: string[]` accumulator pattern with conditional `push()` blocks for optional sections.

## Sections Added

| Section | Requirement | Condition |
|---------|-------------|-----------|
| ## Workload Profile | MD-02 | Always present |
| ## Management Architecture | MD-03 | Always present; dedicated host count row conditional |
| ## NVMe Memory Tiering | MD-04 | `store.nvmeTieringEnabled` |
| ## AI/GPU Workloads | MD-05 | `store.gpuVmCount > 0` |
| ## Network Configuration | MD-09 | Always present |
| ## Stretch Cluster Topology | MD-06 | `store.deploymentMode === 'stretch'` |
| ## vSAN Max Cluster | MD-07 | `store.storageType === 'vsan-max' && calc.vsanMax !== null` |
| ## Validation Warnings | MD-08 | `calc.validationErrors.length > 0` |

Existing sections retained: ## Host Configuration, ## Management Domain Overhead, ## Compute Sizing, ## Storage Sizing.

## Test Results

- Before: 17 failing tests (MD-02 through MD-09 assertions)
- After: 142 passing / 0 failing
- Test file: `src/composables/useMarkdownExport.test.ts` — all 9 describe blocks GREEN

## Conditional Guards Implemented

All 5 required conditional guards are present:
- `store.nvmeTieringEnabled` — NVMe section (MD-04)
- `store.gpuVmCount > 0` — AI/GPU section (MD-05)
- `store.deploymentMode === 'stretch'` — Stretch section (MD-06)
- `store.storageType === 'vsan-max' && calc.vsanMax !== null` — vSAN Max section (MD-07, Pitfall 3)
- `calc.validationErrors.length > 0` — Warnings section (MD-08)
- `calc.dedicatedMgmtHostCount !== null` — Dedicated host count row (MD-03, Pitfall 4)

## Decisions Made

1. **sections[] array pattern** — Uses `sections.push()` for conditional blocks instead of string concatenation; cleaner than conditional ternaries.
2. **Label 'Dedicated host count'** — Test expects this exact label; plan template said "Dedicated management hosts" but tests are the source of truth.
3. **Validation warnings as i18n keys** — `w.messageKey` rendered as-is per Pitfall 6; i18n resolution in composable context is out of scope for Phase 6.
4. **Double guard for vSAN Max** — `storageType === 'vsan-max' && calc.vsanMax !== null` protects against null dereference when store is in intermediate state.

## Deviations from Plan

### Auto-fixed Issues

None.

### Minor Deviation

**Label mismatch between plan and tests**
- Plan action block specified: `| Dedicated management hosts | ${calc.dedicatedMgmtHostCount} |`
- Tests assert: `expect(report).toContain('Dedicated host count')`
- **Fix:** Used `| Dedicated host count | ${calc.dedicatedMgmtHostCount} |` to match test expectations. Tests are the ground truth for acceptance criteria.
- **Impact:** Label in report reads "Dedicated host count" instead of "Dedicated management hosts". No functional impact.

## Phase 6 Success Criteria

All Phase 6 success criteria met:

- [x] npm test exits 0 — all 142 tests pass
- [x] `src/composables/useMarkdownExport.ts` is the only file exporting `generateMarkdownReport()`
- [x] All 9 MD requirement IDs have passing test assertions
- [x] 5 conditional sections each have presence AND absence tests passing
- [x] No engine function imports in useMarkdownExport.ts or its test file

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Enrich generateMarkdownReport() with MD-02..09 | eca6bd0 | src/composables/useMarkdownExport.ts |

## Self-Check: PASSED

- File exists: src/composables/useMarkdownExport.ts ✓
- Commit exists: eca6bd0 ✓
- npm test exits 0: 142 passed, 0 failed ✓
- All 9 MD section headers present in file ✓
- All 5 conditional guards present ✓
