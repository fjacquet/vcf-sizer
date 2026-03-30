# Phase 14: Multi-Domain Exports - Research

**Researched:** 2026-03-30
**Domain:** Export composables (useMarkdownExport.ts, usePptxExport.ts) — multi-domain loop refactor
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXP-01 | Markdown export includes one section per workload domain, each containing the domain name, its configuration inputs, and its sizing results | `calc.domainResults` is a computed array with `id`, `name`, `compute`, `storage`, `stretch`, `vsanMax` per domain; `store.workloadDomains` carries all config inputs |
| EXP-02 | Markdown export includes a totals section after all domain sections summarizing aggregate host counts and resources | `calc.aggregateTotals` already exposes `totalRecommendedHosts`, `totalVmCount`, `totalRawStorageTB`, `totalEffectiveStorageTB` |
| EXP-03 | PPTX export includes one slide per workload domain showing the domain name, key inputs, and results summary | The existing per-domain helper pattern (`buildComputeResultsData`, `buildStorageResultsData`) accepts typed arguments — the loop just needs to call them per domain |
| EXP-04 | PPTX export includes an aggregate totals slide after all per-domain slides | Same `aggregateTotals` shape used for Markdown can drive the PPTX totals slide |
</phase_requirements>

---

## Summary

Phase 14 removes the "Phase 13 first-domain bridge" from both `useMarkdownExport.ts` and `usePptxExport.ts`. The bridge (`workloadDomains[0]` / `domainResults[0]`) was an explicit interim pattern documented in both files and in STATE.md. The actual data structures that support full multi-domain output — `domainResults[]` and `aggregateTotals` — are already fully computed in `calculationStore.ts` and were designed for this phase.

The work is purely additive iteration. No new engine functions are needed. No new store fields are needed. No new types are needed. The only files changing are the two export composables and their corresponding test files.

For Markdown export: `generateMarkdownReport()` replaces the single-domain block with a `store.workloadDomains.forEach` (or `.map`) loop, appending a named section per domain, then appends an aggregate totals section pulled from `calc.aggregateTotals`. The existing conditional sections (NVMe, GPU, stretch, vSAN Max) move inside the per-domain loop.

For PPTX export: `generatePptxReport()` replaces the single-domain slide sequence with a `domainResults.forEach` loop. Each iteration generates a set of slides for one domain (compute results, storage results, conditionals). After the loop, one aggregate totals slide is added. The existing pure data-mapping helper functions (`buildComputeResultsData`, `buildStorageResultsData`, etc.) accept typed arguments already — they do not need to change, they just get called once per domain in the loop.

**Primary recommendation:** Loop over `calc.domainResults` (and `store.workloadDomains` in parallel by index) for both composables; append aggregate totals section/slide from `calc.aggregateTotals` at the end.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pptxgenjs | ^3.x (existing) | PPTX generation | Already installed; dynamic-import pattern established in Phase 8 |
| Vitest | existing | Test framework | Already configured; node environment; no DOM needed |
| Pinia | existing | Store access in composables | `useInputStore()` / `useCalculationStore()` called at function entry |

**No new npm packages required.** Phase 14 is a pure refactor of two composable files and their tests.

---

## Architecture Patterns

### Existing Pattern: sections[] Array Assembly (Markdown)

`generateMarkdownReport()` uses a `sections: string[]` array that is built up and joined at the end with `'\n'`. This pattern (established in Phase 6) must be preserved — all per-domain content is pushed into the same sections array.

**Per-domain loop pattern for Markdown:**

```typescript
// Source: existing useMarkdownExport.ts sections[] pattern
for (const [index, domain] of store.workloadDomains.entries()) {
  const result = calc.domainResults[index]
  sections.push(``, `## Domain: ${domain.name}`, ``)
  // ... per-domain config and result rows
  // ... conditional subsections (NVMe, GPU, stretch, vSAN Max)
}
```

### Existing Pattern: Parallel Index Access

`store.workloadDomains[i]` and `calc.domainResults[i]` are guaranteed to be in sync because `domainResults` is a `computed()` that maps over `workloadDomains` in order (calculationStore.ts line 36-106). Safe to use `entries()` index or zip by index.

DomainResult carries `id` and `name` fields that mirror the input domain — either can be used for heading labels. Use `domain.name` (from store) or `result.name` (same value, from domainResults) — they are identical.

### Existing Pattern: Dynamic Import for PPTX (PPTX-15)

```typescript
// Source: existing usePptxExport.ts
const PptxGenJS = (await import('pptxgenjs')).default
const pres = new PptxGenJS()
// defineSlideMaster MUST be called before any addSlide() — Pitfall 2
```

This pattern is unchanged. The master definition happens once before any domain loop.

### New Pattern: Per-Domain Slide Group

The PPTX loop adds a sequence of slides per domain:

1. Domain header slide (domain name, deployment mode)
2. Compute results slide (reuse `buildComputeResultsData`)
3. Storage results slide (reuse `buildStorageResultsData`)
4. Conditional slides: stretch topology (if `domain.deploymentMode === 'stretch'`), vSAN Max (if `domain.storageType === 'vsan-max' && result.vsanMax !== null`), NVMe tiering (if `domain.nvmeTieringEnabled`), AI/GPU (if `domain.gpuVmCount > 0`)

After all domain groups: one aggregate totals slide.

### New Pattern: Aggregate Totals Section/Slide

`calc.aggregateTotals` shape (already computed, HIGH confidence):

```typescript
interface AggregateTotals {
  totalRecommendedHosts: number  // sum of all domain recommendedHostCount
  totalVmCount: number           // sum of all domain vmCount
  totalRawStorageTB: number      // sum of all domain rawCapacityTB
  totalEffectiveStorageTB: number // sum of all domain effectiveCapacityTB
  allValidationErrors: ValidationWarning[]  // flat concat of all domain warnings
}
```

Note: `totalEffectiveStorageTB` is the deduplicated effective capacity (after dedup ratio), not safe usable. Safe usable is not aggregated in the current `AggregateTotals` type. For the export, use `totalRawStorageTB` and `totalEffectiveStorageTB` as the two storage aggregate values — do NOT attempt to sum `safeUsableCapacityTB` directly (it is not in AggregateTotals).

### Anti-Patterns to Avoid

- **Keeping single-domain bridge:** Do NOT leave `const domain = store.workloadDomains[0]` — that is the bridge this phase removes.
- **i18n resolution in composable:** Validation warning `messageKey` values are i18n keys, not English strings. Render them as-is (established decision from Phase 6 / Phase 9).
- **Calling engine functions in composable:** Never call `calcCompute()`, `calcStorage()`, etc. directly — read from `calc.domainResults[i]` which already has computed results (CALC-01 / layer separation).
- **Using `ref()` in composable:** Both composables are plain TypeScript modules — no reactive state, no lifecycle hooks.
- **Redefining PPTX master inside domain loop:** `defineSlideMaster()` is called once before the loop. Calling it inside the loop throws a pptxgenjs error (Pitfall 2 from Phase 8).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Aggregate totals computation | Custom sum loop in composable | `calc.aggregateTotals` | Already computed reactively in calculationStore; composable should read, not compute |
| Domain result iteration | Custom engine calls | `calc.domainResults` array | DomainResult already contains compute, storage, stretch, vsanMax, validationErrors per domain |
| PPTX table cell wrapping | Custom cell shape | Existing `hdrCell()` / `cell()` helpers in usePptxExport.ts | Already typed, already tested |
| Domain name lookup | Index math against workloadDomains | `result.name` from DomainResult | DomainResult carries name at index 0 — same as `store.workloadDomains[i].name` |

---

## Common Pitfalls

### Pitfall 1: Forgetting to Handle Zero Domains

**What goes wrong:** If `store.workloadDomains` is somehow empty, `domainResults` is an empty array. The existing single-domain bridge assumed at least one domain (no guard needed because DOM-04 guarantees one domain always exists).
**Why it happens:** Multi-domain loop code might not null-check.
**How to avoid:** The store guarantees at least one domain — `removeDomain()` guards against removing the last. No special handling needed, but the loop over an empty array is safe by definition.

### Pitfall 2: Slide Order Dependencies

**What goes wrong:** PPTX slide numbers are implicit (insertion order). Per-domain slides must be emitted in the same order as domains in the array, and aggregate totals slide must be the last slide before the existing Validation Warnings conditional slide.
**How to avoid:** Keep Validation Warnings slide as the final conditional after the domain loop AND after the aggregate totals slide. Slide order: Title → (Mgmt Overhead) → [per domain: header + compute + storage + conditionals] → aggregate totals → validation warnings.

### Pitfall 3: Section Heading Collision in Markdown

**What goes wrong:** Current single-domain Markdown has sections named `## Host Configuration`, `## Compute Sizing`, etc. With multiple domains, these headings will repeat verbatim — colliding anchors and ambiguous structure.
**Why it happens:** Direct lift-and-shift of existing heading strings into a loop.
**How to avoid:** Wrap each domain's sub-sections under a `## Domain: {domain.name}` H2 heading and use H3 (`###`) for the sub-sections within each domain block. The aggregate totals section gets its own `## Aggregate Totals` H2. Management Architecture section (which is global) stays as a top-level H2 outside the loop.

### Pitfall 4: Management Architecture Section Placement

**What goes wrong:** `## Management Architecture` reads from `store.managementArchitecture` (global) and `calc.management` (global). If it's placed inside the per-domain loop it will repeat N times.
**How to avoid:** Keep Management Architecture and Management Domain Overhead sections outside the per-domain loop, as they are today. The loop covers only workload domain content.

### Pitfall 5: Test Mutation of `workloadDomains[1]` Requires Store Add

**What goes wrong:** Test code that tries to write `store.workloadDomains[1]` will fail with undefined if a second domain hasn't been added via `store.addDomain()`.
**How to avoid:** Call `store.addDomain()` in test setup before mutating workloadDomains[1]. The `addDomain()` method appends with `createDefaultWorkloadDomain()` defaults.

### Pitfall 6: aggregateTotals Does Not Include safeUsableCapacityTB

**What goes wrong:** Developer tries to show "Total safe usable storage" in the aggregate section by summing from aggregateTotals — but `safeUsableCapacityTB` is not in `AggregateTotals`.
**How to avoid:** Use `totalEffectiveStorageTB` (effective after dedup) or `totalRawStorageTB` (raw). If safe usable aggregate is required, it must be computed inline in the composable as `calc.domainResults.reduce((sum, r) => sum + r.storage.safeUsableCapacityTB, 0)` — document this clearly.

---

## Code Examples

### Per-Domain Markdown Loop Skeleton

```typescript
// Source: pattern derived from existing useMarkdownExport.ts sections[] pattern
for (const domain of store.workloadDomains) {
  const result = calc.domainResults.find(r => r.id === domain.id)!
  sections.push(
    ``,
    `## Domain: ${domain.name}`,
    ``,
    `**Deployment Model:** ${domain.deploymentMode}`,
    ``,
    `### Host Configuration`,
    ``,
    `| Parameter | Value |`,
    `|-----------|-------|`,
    `| Hosts | ${domain.hostCount} |`,
    // ... remaining config rows
  )
  // ... per-domain result sections (Compute Sizing, Storage Sizing)
  // ... conditional sections (NVMe, GPU, stretch, vSAN Max)
}
```

Note: Using `find(r => r.id === domain.id)` is safer than index-based access if domain order could theoretically differ. Both approaches are correct given the store contract, but id-based lookup is more defensive.

### Aggregate Totals Markdown Section

```typescript
// Source: calc.aggregateTotals interface in src/engine/types.ts
const totals = calc.aggregateTotals
sections.push(
  ``,
  `## Aggregate Totals`,
  ``,
  `| Metric | Value |`,
  `|--------|-------|`,
  `| Total recommended hosts (all domains) | ${totals.totalRecommendedHosts} |`,
  `| Total VM count | ${totals.totalVmCount} |`,
  `| Total raw storage | ${totals.totalRawStorageTB.toFixed(2)} TB |`,
  `| Total effective storage | ${totals.totalEffectiveStorageTB.toFixed(2)} TB |`,
)
```

### Per-Domain PPTX Slide Group Skeleton

```typescript
// Source: pattern derived from existing usePptxExport.ts slide creation pattern
for (const domain of store.workloadDomains) {
  const result = calc.domainResults.find(r => r.id === domain.id)!

  // Domain header slide
  const sDomHeader = pres.addSlide({ masterName: MASTER_NAME })
  sDomHeader.addText(`Domain: ${domain.name}`, {
    x: 0.5, y: 1.5, w: 12, h: 1.5,
    fontSize: 30, bold: true, color: PPTX_WHITE,
  })
  sDomHeader.addText(`Deployment: ${domain.deploymentMode}`, {
    x: 0.5, y: 3.2, w: 12, h: 0.8,
    fontSize: 18, color: PPTX_LIGHT_TEXT,
  })

  // Compute results slide (reuse existing helper)
  const computeData = buildComputeResultsData(result.compute)
  // ... add slide with table using computeData

  // Storage results slide (reuse existing helper)
  const storageData = buildStorageResultsData(result.storage)
  // ... add slide with table using storageData

  // Conditional slides (same conditions as before, but scoped to this domain)
  if (domain.gpuVmCount > 0) { /* ... buildAiGpuSlideData(store, domain) ... */ }
  if (domain.nvmeTieringEnabled) { /* ... buildNvmeTieringSlideData(store, domain) ... */ }
  if (domain.deploymentMode === 'stretch' && result.stretch) { /* ... */ }
  if (domain.storageType === 'vsan-max' && result.vsanMax !== null) { /* ... */ }
}
```

Note: The existing helper functions `buildAiGpuSlideData`, `buildNvmeTieringSlideData`, `buildStretchTopologySlideData`, and `buildVsanMaxSlideData` currently accept `store: ReturnType<typeof useInputStore>` and read `workloadDomains[0]` internally. For Phase 14, these helpers must be updated to accept a `WorkloadDomainConfig` domain argument directly — or new per-domain variants created. The cleanest approach is to update the helpers to accept a domain argument and thread it through.

### Aggregate Totals PPTX Slide

```typescript
// Source: calc.aggregateTotals interface in src/engine/types.ts
const totals = calc.aggregateTotals
const sAgg = pres.addSlide({ masterName: MASTER_NAME })
sAgg.addText('Aggregate Totals', {
  x: 0.5, y: 0.3, w: 12, h: 0.8,
  fontSize: 24, bold: true, color: PPTX_WHITE,
})
const aggRows: TableRow[] = [
  [hdrCell('Metric'), hdrCell('Value')],
  [cell('Total Recommended Hosts'), cell(String(totals.totalRecommendedHosts), true)],
  [cell('Total VM Count'), cell(String(totals.totalVmCount))],
  [cell('Total Raw Storage'), cell(`${totals.totalRawStorageTB.toFixed(2)} TB`)],
  [cell('Total Effective Storage'), cell(`${totals.totalEffectiveStorageTB.toFixed(2)} TB`)],
]
sAgg.addTable(aggRows, {
  x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
  fontSize: 13, color: 'F0F0F0',
  border: { type: 'solid', pt: 1, color: '444444' },
})
```

---

## Helper Function Refactor: Per-Domain Arguments

Several helper functions in `usePptxExport.ts` currently accept `store: ReturnType<typeof useInputStore>` and read `workloadDomains[0]` internally:

| Helper | Current signature reads | Phase 14 change |
|--------|------------------------|-----------------|
| `buildTitleSlideData` | `store.workloadDomains[0].deploymentMode` | Keep as-is (title slide is global) |
| `buildConfigSummaryData` | `store.workloadDomains[0]` (8 fields) | Update to accept `domain: WorkloadDomainConfig` |
| `buildWorkloadSlideData` | `store.workloadDomains[0]` (6 fields) | Update to accept `domain: WorkloadDomainConfig` |
| `buildAiGpuSlideData` | `store.workloadDomains[0]` | Update to accept `domain: WorkloadDomainConfig` |
| `buildNvmeTieringSlideData` | `store.workloadDomains[0]` | Update to accept `domain: WorkloadDomainConfig` |
| `buildStretchTopologySlideData` | `store.workloadDomains[0]` | Update to accept `domain: WorkloadDomainConfig` |
| `buildVsanMaxSlideData` | `store.workloadDomains[0]` | Update to accept `domain: WorkloadDomainConfig` |
| `buildRecommendationsData` | `calc.domainResults[0]` | Update to accept `result: DomainResult` |

Updating signatures is a breaking change for the test file — tests must update call sites. This is expected and correct.

`buildMgmtOverheadData` accepts `mgmt: MgmtDomainResult` directly — no change needed.
`buildComputeResultsData` accepts `compute: ComputeResult` directly — no change needed.
`buildStorageResultsData` accepts `storage: StorageResult` directly — no change needed.
`buildValidationWarningsSlideData` accepts `calc` — no change needed (aggregateTotals is still correct).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing, node environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/composables/useMarkdownExport.test.ts src/composables/usePptxExport.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXP-01 | Markdown has one named section per workload domain | unit | `npx vitest run src/composables/useMarkdownExport.test.ts` | Exists — new tests needed |
| EXP-02 | Markdown ends with aggregate totals section | unit | `npx vitest run src/composables/useMarkdownExport.test.ts` | Exists — new tests needed |
| EXP-03 | PPTX helper functions accept domain arg, produce per-domain data | unit | `npx vitest run src/composables/usePptxExport.test.ts` | Exists — tests need updating |
| EXP-04 | Aggregate totals slide data correctly sums all domains | unit | `npx vitest run src/composables/usePptxExport.test.ts` | Exists — new tests needed |

### Test Strategy: Wave 0 TDD

Following the established Phase 8/9 TDD pattern:

**Wave 0 — Write failing tests first:**

- Add describe block `generateMarkdownReport — EXP-01 per-domain sections` with tests that verify a multi-domain store produces N named domain sections.
- Add describe block `generateMarkdownReport — EXP-02 aggregate totals` with tests for `## Aggregate Totals` heading presence.
- Add describe block for new `buildDomainSlideData` helper (or updated helper signatures) for EXP-03.
- Add describe block for aggregate totals slide data for EXP-04.

**Wave 1 — Implement to make tests pass.**

### Sampling Rate

- **Per task commit:** `npx vitest run src/composables/useMarkdownExport.test.ts src/composables/usePptxExport.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite (222+ tests) green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/composables/useMarkdownExport.test.ts` — add multi-domain describe blocks (EXP-01, EXP-02)
- [ ] `src/composables/usePptxExport.test.ts` — update existing helper tests to new domain-arg signatures; add aggregate totals describe block (EXP-03, EXP-04)

*(Existing test infrastructure covers all other project requirements — only export composable tests need additions.)*

---

## Environment Availability

Step 2.6: SKIPPED — Phase 14 is a pure TypeScript composable refactor. No external services, CLI tools, or runtimes beyond Node.js and the existing npm dependencies. Node.js, npm, and pptxgenjs are all confirmed available from previous phases (222 tests green).

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 14 is not a rename/refactor/migration phase. No stored data, live service config, OS-registered state, secrets, or build artifacts are affected.

---

## Project Constraints (from CLAUDE.md)

All directives from `CLAUDE.md` that constrain Phase 14:

| Directive | Impact on Phase 14 |
|-----------|-------------------|
| Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library (CALC-01) | No engine files change in this phase |
| `calculationStore.ts` must never contain `ref()` — only `computed()` (CALC-02) | calculationStore is read-only in this phase; no changes to it |
| Validation warnings must use i18n message keys, not English strings | Export composables already render `messageKey` as-is; this pattern is preserved |
| Composables in `src/composables/` — plain TypeScript modules, no Vue lifecycle hooks | `useMarkdownExport.ts` and `usePptxExport.ts` remain plain modules |
| `VueI18nPlugin` configured with `include` omitted intentionally | No change to plugin config |
| Tests cover `src/engine/**/*.test.ts` and `src/composables/**/*.test.ts` — node environment | New tests go in `src/composables/` test files |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-domain: `const domain = store.workloadDomains[0]` | Multi-domain loop over `store.workloadDomains` | Phase 14 | All conditional sections move inside per-domain loop |
| Single-domain: `const result = calc.domainResults[0]` | Loop using `calc.domainResults` (index or id lookup) | Phase 14 | Per-domain results accessed per iteration |
| Flat Markdown structure (one section per concept) | Hierarchical: H2 per domain, H3 per concept, H2 aggregate totals | Phase 14 | Document structure reflects multi-domain reality |
| PPTX helpers accept full store, read `[0]` internally | PPTX helpers accept `WorkloadDomainConfig` directly | Phase 14 | Helpers become more testable and domain-agnostic |

---

## Open Questions

1. **Aggregate totals slide position: before or after management overhead?**
   - What we know: EXP-04 says "after per-domain slides". Management overhead is a fixed global slide.
   - What's unclear: Whether aggregate totals slide comes before or after the Validation Warnings slide.
   - Recommendation: Place aggregate totals slide after last per-domain slide group, before Validation Warnings (Validation Warnings is always last — consistent with current pattern).

2. **Domain header slide vs. direct content slides in PPTX**
   - What we know: EXP-03 says "one slide per workload domain showing the domain name, key inputs, and results summary".
   - What's unclear: Does each domain get one combined slide (name + inputs + results all on one slide) or multiple slides (header + compute + storage)?
   - Recommendation: One combined summary slide per domain is simpler and matches "one slide per workload domain" literally. A detailed breakdown (multiple slides per domain) would be richer but exceeds the requirement. Plan to implement one summary slide per domain unless the planner decides otherwise.

3. **`buildRecommendationsData` role after multi-domain**
   - What we know: Currently builds global recommendations from `domainResults[0]`. With N domains, a single Recommendations slide is ambiguous.
   - What's unclear: Whether Recommendations slide survives as-is (kept for domain 0 compat), becomes per-domain, or is replaced by the aggregate totals slide.
   - Recommendation: Keep `buildRecommendationsData` for the global Recommendations slide but update it to reflect aggregate totals (total hosts, total storage across all domains). The planner should decide.

---

## Sources

### Primary (HIGH confidence)

- Source code audit: `src/composables/useMarkdownExport.ts` — confirmed first-domain bridge pattern and sections[] structure
- Source code audit: `src/composables/usePptxExport.ts` — confirmed helper function signatures and slide creation patterns
- Source code audit: `src/stores/calculationStore.ts` — confirmed `domainResults` computed array and `aggregateTotals` shape
- Source code audit: `src/engine/types.ts` — confirmed `DomainResult`, `AggregateTotals`, `WorkloadDomainConfig` interfaces
- Source code audit: `src/composables/useMarkdownExport.test.ts` — 256 lines, confirmed test infrastructure and pattern
- Source code audit: `src/composables/usePptxExport.test.ts` — 473 lines, confirmed test infrastructure and helper coverage
- `npm run test` output — 222 tests passing, node environment, 441ms run time

### Secondary (MEDIUM confidence)

- STATE.md decision log — Phase 13 bridge pattern documented; Phase 14 full multi-domain export explicitly named as the successor

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies; all libraries verified present via test run
- Architecture: HIGH — both composables read in full; data contracts (AggregateTotals, DomainResult) verified in types.ts and calculationStore.ts
- Pitfalls: HIGH — derived from first-hand code reading; same patterns as Phases 8/9/13

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable, no fast-moving dependencies)
