# Phase 15 Context: Engine Correctness

**Phase:** 15 — Engine Correctness
**Milestone:** v3.1 Sizing Correctness & Guided Workflow
**Requirements:** ENGINE-01, ENGINE-02, ENGINE-03, ENGINE-04
**Created:** 2026-03-30

---

## Domain

Fix two concrete bugs in `calculationStore.ts` and clean up TypeScript diagnostics. The engine layer (`compute.ts`, `management.ts`) requires **zero changes** — bugs are entirely in the store layer.

---

## Decisions

### Bug 1: Management Overhead Routing (ENGINE-01, ENGINE-02)

**Current bug location:** `src/stores/calculationStore.ts` — `domainResults` computed, inside `.map(domain => { ... })` at lines ~45-48.

**Current broken behavior:** `managementCores: management.value.totalCores` and `managementRamGB: management.value.totalRamGB` are passed to ALL workload domains unconditionally.

**Fix:**

- `managementArchitecture === 'dedicated'`: pass `managementCores: 0, managementRamGB: 0` to ALL workload domains. Management runs on its own hosts.
- `managementArchitecture === 'colocated'`: pass `managementCores: management.value.totalCores, managementRamGB: management.value.totalRamGB` to WLD-1 only (`index === 0`), pass 0 to all other domains.

**Pattern:**

```typescript
const mgmtCoresForDomain = input.managementArchitecture === 'colocated' && index === 0
  ? management.value.totalCores
  : 0
const mgmtRamForDomain = input.managementArchitecture === 'colocated' && index === 0
  ? management.value.totalRamGB
  : 0
```

---

### Bug 2: Aggregate Totals Missing Management Hosts (ENGINE-03)

**Current bug location:** `aggregateTotals` computed in `calculationStore.ts`.

**Current broken behavior:** `totalRecommendedHosts` only sums workload domain host counts. `dedicatedMgmtHostCount` is never included.

**Fix — AggregateTotals type extension:**
Add `mgmtHostCount: number` to the `AggregateTotals` interface in `src/engine/types.ts`.

```typescript
export interface AggregateTotals {
  totalRecommendedHosts: number    // grand total = workload + mgmt hosts
  mgmtHostCount: number            // NEW: management-only host count (0 when colocated)
  totalVmCount: number
  totalRawStorageTB: number
  totalEffectiveStorageTB: number
  allValidationErrors: ValidationWarning[]
}
```

**Fix — aggregateTotals computed:**

```typescript
const aggregateTotals = computed<AggregateTotals>(() => {
  const workloadHosts = domainResults.value.reduce(
    (sum, d) => sum + d.compute.recommendedHostCount, 0
  )
  const mgmtHosts = dedicatedMgmtHostCount.value ?? 0
  return {
    totalRecommendedHosts: workloadHosts + mgmtHosts,
    mgmtHostCount: mgmtHosts,
    // ... rest unchanged
  }
})
```

**`totalRecommendedHosts` semantics:** Grand total for procurement = workload hosts + management hosts. `mgmtHostCount` exposes the management-only portion for export breakdown.

---

### 'shared' → 'colocated' Rename (ENGINE-01, ENGINE-02)

**Decision:** Rename the `'shared'` value to `'colocated'` in `managementArchitecture` throughout the codebase.

**Scope of rename:**

- `src/engine/types.ts` — `ManagementArchitecture` type: `'shared' | 'dedicated'` → `'colocated' | 'dedicated'`
- `src/stores/inputStore.ts` — default value and all references
- `src/stores/calculationStore.ts` — conditional checks
- `src/composables/useUrlState.ts` — Zod schema literal values
- `src/engine/validation.ts` — if any checks use `'shared'`
- `src/components/` — all Vue components referencing `managementArchitecture` value `'shared'`
- All test files — `'shared'` → `'colocated'` in assertions and setup

**Why:** Requirements, research, and user communication all use 'colocated'. 'shared' is confusing (shared storage? shared compute?). Phase 15 is the right time since we're already touching this logic.

---

### ENGINE-04: TypeScript Diagnostic Cleanup

**Build status:** `vue-tsc --noEmit` passes with zero errors. The following are LSP false positives to fix for IDE comfort.

**Files to fix:**

1. **`src/composables/usePptxExport.test.ts`** — 3 fixes:
   - Implicit `any` on callback params (`row`, `item`): add explicit types (`(row: { label: string; value: string })` or equivalent from the function's return type)
   - Store property misreports (`calc.domainResults[0].compute`): extract to a typed intermediate variable: `const domainResult: DomainResult = calc.domainResults[0]`, then use `domainResult.compute`
   - Store property misreports for `gpuVmCount`, `vgpuMemoryGB` on inputStore: these are per-domain fields; fix test setup to use `store.updateDomain(store.workloadDomains[0].id, { gpuVmCount: 4, vgpuMemoryGB: 16 })` (may already be correct — verify first)

2. **`src/composables/useMarkdownExport.test.ts`** — 1 fix:
   - Implicit `any` on line callback: add explicit type annotation

3. **`src/composables/useMarkdownExport.ts`** — LSP module resolution:
   - Verify tsconfig paths alias is consistent with `@/` → `src/` mapping
   - If path alias is correct in `tsconfig.app.json`, the LSP issue may resolve when tests run under the correct tsconfig context

**Do NOT use `@ts-ignore` or `as any` casts.** Fix types properly or investigate the root cause.

---

## TDD Strategy

**Wave 0 (failing tests first):**

Write these tests in `calculationStore.test.ts` BEFORE touching implementation:

1. `'dedicated mode: WLD-1 compute.recommendedHostCount is NOT inflated by management overhead'`
   - Set `managementArchitecture = 'dedicated'`, set a large management domain → WLD-1 host count should equal workload-only requirement
2. `'dedicated mode: WLD-2 compute.recommendedHostCount equals WLD-1 with identical config'`
   - Two identical domains in dedicated mode → same host count per domain (no management inflation on either)
3. `'colocated mode: WLD-1 host count absorbs management overhead'`
   - Set `managementArchitecture = 'colocated'` → WLD-1 host count > WLD-2 (management overhead on WLD-1 only)
4. `'dedicated mode: aggregateTotals.totalRecommendedHosts includes dedicatedMgmtHostCount'`
   - `totalRecommendedHosts` = sum(workload hosts) + dedicatedMgmtHostCount
5. `'dedicated mode: aggregateTotals.mgmtHostCount equals dedicatedMgmtHostCount'`
6. `'colocated mode: aggregateTotals.mgmtHostCount is 0'`

**Wave 1 (implementation):**

- Rename 'shared' → 'colocated' throughout
- Fix management overhead routing in `domainResults.map()`
- Extend `AggregateTotals` type and fix `aggregateTotals` computed
- Fix ENGINE-04 TypeScript annotations

---

## Canonical Refs

- `src/stores/calculationStore.ts` — primary file being fixed (bugs confirmed at lines ~45-48 and ~95-103)
- `src/engine/types.ts` — `AggregateTotals` and `ManagementArchitecture` types to update
- `src/stores/calculationStore.test.ts` — existing test file; Wave 0 tests go here
- `src/composables/usePptxExport.test.ts` — ENGINE-04 LSP cleanup
- `src/composables/useMarkdownExport.test.ts` — ENGINE-04 LSP cleanup
- `src/composables/useMarkdownExport.ts` — ENGINE-04 module resolution check
- `src/composables/useUrlState.ts` — Zod schema literal rename ('shared' → 'colocated')

---

## Constraints

- CALC-02: `calculationStore` must never contain `ref()` — only `computed()` (verified by existing CALC-02 test)
- CALC-01: Engine files (`src/engine/*.ts`) must never import from Vue — engine requires no changes
- `dedicatedMgmtHostCount` declaration must precede `aggregateTotals` in the setup function body (Pinia computed order)
- `management` computed must precede `domainResults` in the setup function body (dependency order)
- Do NOT use `@ts-ignore` or `as any` in ENGINE-04 fixes

---

## Out of Scope

- Any wizard UI work (Phase 16)
- Any export composable changes beyond ENGINE-04 LSP fixes (Phase 17)
- Changing `managementArchitecture` from global to per-domain (architectural decision locked in v3.0)
- vSAN Max or stretch topology changes

---

*Context created: 2026-03-30 — discuss-phase 15*
