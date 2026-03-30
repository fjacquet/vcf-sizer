# Phase 9: PPTX Conditional Slides and Polish - Research

**Researched:** 2026-03-30
**Domain:** pptxgenjs conditional slide generation, Pinia store field mapping
**Confidence:** HIGH

## Summary

Phase 9 extends the existing `usePptxExport.ts` composable with five conditional slides that appear only when the relevant feature is active. The guards mirror exactly what `useMarkdownExport.ts` already does for Markdown: `store.gpuVmCount > 0`, `store.nvmeTieringEnabled`, `store.deploymentMode === 'stretch'`, `store.storageType === 'vsan-max' && calc.vsanMax !== null`, and `calc.validationErrors.length > 0`. The implementation pattern is already established in Phase 8 — new slides follow the identical `pres.addSlide({ masterName: MASTER_NAME })` + `addText` / `addTable` sequence and are inserted after Slide 7 (Recommendations) inside `generatePptxReport()`. New pure data-mapping helpers are exported and tested in isolation; the browser-API `generatePptxReport` function itself is not unit-tested (same Phase 8 precedent).

The test strategy replicates Phase 8: a Wave 0 TDD pass writes failing describe blocks for each new helper, covering the presence/absence contract. The Pinia setup pattern (`createPinia() + setActivePinia()` in `beforeEach`) and the store mutation pattern (direct property assignment on the store instance) are already proven in the existing test file.

**Primary recommendation:** Add five `buildXxxSlideData` helpers following the existing pattern, guard each with the same conditions used in `useMarkdownExport.ts`, append conditional slides after Slide 7 inside `generatePptxReport()`, and extend `usePptxExport.test.ts` with a new `describe` block per helper.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PPTX-10 | Conditional AI/GPU slide when `gpuVmCount > 0` | Guard: `store.gpuVmCount > 0`; data from `store.gpuVmCount`, `store.vgpuMemoryGB` |
| PPTX-11 | Conditional NVMe memory tiering slide when `nvmeTieringEnabled = true` | Guard: `store.nvmeTieringEnabled === true`; data from `store.nvmeTieringEnabled`, `store.activeMemoryPct` |
| PPTX-12 | Conditional stretch topology slide when `deploymentMode = 'stretch'` | Guard: `store.deploymentMode === 'stretch'`; data from `store.preferredSiteHosts`, `store.secondarySiteHosts`, `calc.stretch` (StretchResult) |
| PPTX-13 | Conditional vSAN Max cluster slide when `storageType = 'vsan-max'` | Guard: `store.storageType === 'vsan-max' && calc.vsanMax !== null`; data from `store.vsanMaxProfile`, `calc.vsanMax` (VsanMaxResult) |
| PPTX-14 | Conditional validation warnings slide when warnings exist | Guard: `calc.validationErrors.length > 0`; data from `calc.validationErrors` (ValidationWarning[]) |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pptxgenjs | already installed (Phase 8) | PPTX slide generation | Project decision — no alternative |
| pinia | already installed | Reactive stores for store state | Project architecture — CALC-01/02 |
| vitest | already installed | Unit testing | Project test framework |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | Phase 9 introduces zero new dependencies |

**Installation:** No new packages required. All dependencies were installed in Phase 8.

---

## Architecture Patterns

### Pattern 1: Existing Conditional Guard in useMarkdownExport.ts

The Markdown composable establishes the definitive guard pattern. Each conditional section uses a plain `if` statement before pushing to the `sections[]` array. The same structure applies to PPTX: wrap the `pres.addSlide(...)` block in an `if` guard.

```typescript
// Source: src/composables/useMarkdownExport.ts (verified by direct read)

// MD-04: NVMe Memory Tiering (conditional: nvmeTieringEnabled)
if (store.nvmeTieringEnabled) {
  sections.push(...)
}

// MD-05: AI/GPU Workloads (conditional: gpuVmCount > 0)
if (store.gpuVmCount > 0) {
  sections.push(...)
}

// MD-06: Stretch Cluster Topology (conditional: deploymentMode === 'stretch')
if (store.deploymentMode === 'stretch') {
  const s = calc.stretch
  sections.push(...)
}

// MD-07: vSAN Max Cluster (conditional: storageType === 'vsan-max' AND vsanMax !== null)
if (store.storageType === 'vsan-max' && calc.vsanMax !== null) {
  const v = calc.vsanMax
  sections.push(...)
}

// MD-08: Validation Warnings (conditional: validationErrors.length > 0)
if (calc.validationErrors.length > 0) {
  sections.push(...)
}
```

### Pattern 2: PPTX Conditional Slide Block (mirrors Markdown guards)

```typescript
// Source: pattern derived from usePptxExport.ts Phase 8 structure + Markdown guards

// After Slide 7 (Recommendations) in generatePptxReport()

// PPTX-10: AI/GPU (conditional)
if (store.gpuVmCount > 0) {
  const gpuData = buildAiGpuSlideData(store)
  const sGpu = pres.addSlide({ masterName: MASTER_NAME })
  sGpu.addText('AI / GPU Workloads', {
    x: 0.5, y: 0.3, w: 12, h: 0.8,
    fontSize: 24, bold: true, color: PPTX_WHITE,
  })
  // addTable with gpuData rows...
}

// PPTX-11: NVMe Tiering (conditional)
if (store.nvmeTieringEnabled) {
  const nvmeData = buildNvmeTieringSlideData(store)
  const sNvme = pres.addSlide({ masterName: MASTER_NAME })
  // ...
}

// PPTX-12: Stretch Topology (conditional)
if (store.deploymentMode === 'stretch') {
  const stretchData = buildStretchTopologySlideData(store, calc.stretch)
  const sStretch = pres.addSlide({ masterName: MASTER_NAME })
  // ...
}

// PPTX-13: vSAN Max (conditional)
if (store.storageType === 'vsan-max' && calc.vsanMax !== null) {
  const vsanMaxData = buildVsanMaxSlideData(store, calc.vsanMax)
  const sVsanMax = pres.addSlide({ masterName: MASTER_NAME })
  // ...
}

// PPTX-14: Validation Warnings (conditional)
if (calc.validationErrors.length > 0) {
  const warningsData = buildValidationWarningsSlideData(calc)
  const sWarn = pres.addSlide({ masterName: MASTER_NAME })
  // ...
}
```

### Pattern 3: Data-Mapping Helper Signature Conventions (from Phase 8)

```typescript
// Source: src/composables/usePptxExport.ts (verified by direct read)

// Helpers that take only the input store:
export function buildTitleSlideData(store: ReturnType<typeof useInputStore>): {...}
export function buildWorkloadSlideData(store: ReturnType<typeof useInputStore>): Array<{...}>

// Helpers that take engine result objects directly (not full store):
export function buildMgmtOverheadData(mgmt: MgmtDomainResult): Array<{...}>
export function buildComputeResultsData(compute: ComputeResult): {...}
export function buildStorageResultsData(storage: StorageResult): {...}

// Helpers that take both stores:
export function buildRecommendationsData(
  _store: ReturnType<typeof useInputStore>,
  calc: ReturnType<typeof useCalculationStore>
): string[]
```

New Phase 9 helpers should follow the same signature pattern:

- `buildAiGpuSlideData(store)` — input store only
- `buildNvmeTieringSlideData(store)` — input store only
- `buildStretchTopologySlideData(store, stretch: StretchResult)` — store + engine result
- `buildVsanMaxSlideData(store, vsanMax: VsanMaxResult)` — store + engine result
- `buildValidationWarningsSlideData(calc)` — calculation store only

### Pattern 4: Test Isolation (from Phase 8)

```typescript
// Source: src/composables/usePptxExport.test.ts (verified by direct read)

describe('buildAiGpuSlideData — PPTX-10', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns null (or empty) when gpuVmCount === 0', () => {
    const store = useInputStore()
    store.gpuVmCount = 0
    // assert helper returns null or empty array
  })

  it('returns rows with gpuVmCount and vgpuMemoryGB when gpuVmCount > 0', () => {
    const store = useInputStore()
    store.gpuVmCount = 4
    store.vgpuMemoryGB = 16
    const result = buildAiGpuSlideData(store)
    // assert rows include gpuVmCount = 4 and vgpuMemoryGB = 16
  })
})
```

Pinia store fields are directly assignable in test context (plain `ref()` wrapped by `defineStore`). No mock is needed — `store.gpuVmCount = 4` mutates the ref directly.

### Anti-Patterns to Avoid

- **Calling `buildXxxSlideData` outside `generatePptxReport()`:** The guards in `generatePptxReport()` and the helper existence are two separate concerns. The helper itself should NOT contain the conditional guard — the caller guards it.
- **Adding `ref()` to `calculationStore.ts`:** CALC-02 is absolute — calculationStore must stay zero-ref.
- **Resolving i18n keys in the composable:** Validation warning `messageKey` values are i18n keys (e.g., `'validation.hostCount.tooFew'`). Render them as literal strings in the PPTX slide, same as Markdown export does. No `useI18n()` calls in this composable.
- **Importing pptxgenjs at module top level:** Dynamic `import('pptxgenjs')` MUST stay inside `generatePptxReport()` body — PPTX-15 constraint.

---

## Store Field Mapping for Each Conditional Slide

### PPTX-10: AI/GPU Slide

**Guard:** `store.gpuVmCount > 0`

| Field | Store | Type | Default |
|-------|-------|------|---------|
| `gpuVmCount` | `useInputStore()` | `number` | `0` |
| `vgpuMemoryGB` | `useInputStore()` | `number` | `16` |

**Slide content:** 2-row parameter table (GPU VM count, vGPU memory per VM) — mirrors Markdown MD-05 section.

### PPTX-11: NVMe Memory Tiering Slide

**Guard:** `store.nvmeTieringEnabled === true`

| Field | Store | Type | Default |
|-------|-------|------|---------|
| `nvmeTieringEnabled` | `useInputStore()` | `boolean` | `false` |
| `activeMemoryPct` | `useInputStore()` | `number` | `50` |

**Slide content:** 2-row parameter table (Status: Enabled, Active memory percentage) — mirrors Markdown MD-04.

### PPTX-12: Stretch Cluster Topology Slide

**Guard:** `store.deploymentMode === 'stretch'`

**Input store fields:**

| Field | Type | Default |
|-------|------|---------|
| `preferredSiteHosts` | `number` | `3` |
| `secondarySiteHosts` | `number` | `3` |

**Calc store fields (from `calc.stretch: StretchResult`):**

| Field | Type | Notes |
|-------|------|-------|
| `totalHosts` | `number` | preferred + secondary |
| `minBandwidthGbps` | `number` | bandwidth floor applied |
| `witnessCores` | `number` | 4 (ESA M profile) |
| `witnessRamGB` | `number` | 16 (ESA M profile) |
| `effectivePerSiteStorageTB` | `number` | after PFTT=1 mirroring |
| `bandwidthFloorApplied` | `boolean` | floor flag |
| `networkChecklist.minInterSiteBandwidthGbps` | `number` | — |
| `networkChecklist.maxInterSiteLatencyMs` | `number` | — |
| `networkChecklist.maxWitnessLatencyMs` | `number` | — |
| `networkChecklist.jumboFramesRequired` | `boolean` | — |
| `networkChecklist.witnessMinBandwidthMbps` | `number` | — |

**Slide content:** Main topology table + network checklist table (2 tables on one slide) — mirrors Markdown MD-06.

### PPTX-13: vSAN Max Cluster Slide

**Guard:** `store.storageType === 'vsan-max' && calc.vsanMax !== null`

**Input store fields:**

| Field | Type | Default |
|-------|------|---------|
| `vsanMaxProfile` | `'xs' | 'sm' | 'med' | 'lrg' | 'xl'` | `'med'` |
| `vsanMaxStorageNodes` | `number` | `4` |

**Calc store fields (from `calc.vsanMax: VsanMaxResult`):**

| Field | Type | Notes |
|-------|------|-------|
| `storageNodeCount` | `number` | — |
| `computeNodeCount` | `number` | — |
| `raidScheme` | `string` | — |
| `rawCapacityTB` | `number` | — |
| `usableCapacityTB` | `number` | — |
| `belowMinNodes` | `boolean` | warning flag |

**Slide content:** Parameter table with profile, node counts, capacity — mirrors Markdown MD-07. Show `vsanMaxProfile.toUpperCase()` for readability.

### PPTX-14: Validation Warnings Slide

**Guard:** `calc.validationErrors.length > 0`

**Calc store fields (from `calc.validationErrors: ValidationWarning[]`):**

| Field | Type | Notes |
|-------|------|-------|
| `severity` | `'error' | 'warning'` | Display as `[ERROR]` or `[WARNING]` |
| `messageKey` | `string` | i18n key — render as literal string |
| `code` | `string` | optional: include for reference |

**Slide content:** Bulleted text list or single-column table — mirrors Markdown MD-08 bullet rendering. Do NOT attempt i18n resolution (Pitfall 6 from Phase 6 decisions).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table cell styling | Custom style objects | `hdrCell()` / `cell()` helpers already in usePptxExport.ts | Consistency; already typed for pptxgenjs |
| Conditional logic | Complex feature-detection | Plain `if` guards matching Markdown composable | Proven pattern; trivially testable |
| i18n resolution | useI18n() in composable | Raw messageKey strings | Composable is outside Vue lifecycle; same decision as Phase 6 |
| Type imports | Importing PptxGenJS namespace types | Local `TableCell`/`TableRow` interfaces already defined at top of file | Avoids dynamic-import type complexity (Phase 8 decision) |

---

## Common Pitfalls

### Pitfall 1: Guard mismatches between PPTX and Markdown

**What goes wrong:** PPTX-13 guard uses `storageType === 'vsan-max'` but forgets `&& calc.vsanMax !== null`, causing a TypeScript null-dereference in the helper.
**Why it happens:** `calc.vsanMax` is `VsanMaxResult | null` — it returns null when storageType is not 'vsan-max'. The double guard is required.
**How to avoid:** Copy the guard verbatim from `useMarkdownExport.ts` line 167: `if (store.storageType === 'vsan-max' && calc.vsanMax !== null)`.
**Warning signs:** TypeScript error `Object is possibly 'null'` on `calc.vsanMax.storageNodeCount`.

### Pitfall 2: Calling addTable with an empty rows array

**What goes wrong:** pptxgenjs throws or produces a corrupt file when `addTable([])` is called.
**Why it happens:** Data-mapping helper returns zero rows if input is misconfigured.
**How to avoid:** Guards ensure the slide is only added when data exists. Helpers should always return at least one data row when called (their input is already guarded).

### Pitfall 3: Two tables on one slide (Stretch topology) exceed slide height

**What goes wrong:** Main topology table + network checklist table overflow past the footer area (y + h > 6.8 inches).
**Why it happens:** Default `rowH: 0.45` for each row; 7 topology rows + 5 checklist rows = significant height.
**How to avoid:** Position first table at `y: 1.3` with height capped, second table at `y: 4.2` or use `fontSize: 11` to compress rows. Test in actual PowerPoint viewer.

### Pitfall 4: Accessing calc.stretch when deploymentMode is not 'stretch'

**What goes wrong:** `calc.stretch` is always computed (not null-guarded in calculationStore), but its values may be nonsensical when `deploymentMode !== 'stretch'`.
**Why it happens:** `calcStretch()` is always called; the result is only meaningful when stretch mode is active.
**How to avoid:** The `if (store.deploymentMode === 'stretch')` guard already ensures the helper is only called in the correct mode. The helper should take the `StretchResult` directly (as a parameter) rather than the full calc store.

### Pitfall 5: Forgetting to export new helpers

**What goes wrong:** Tests import the helper by name and get `undefined`; TypeScript reports a module error.
**Why it happens:** Helpers added without the `export` keyword.
**How to avoid:** All data-mapping helpers in usePptxExport.ts are exported (verified in Phase 8 — every `buildXxx` function has `export`).

---

## Code Examples

### Complete Guard Sequence to Insert After Slide 7

```typescript
// Source: pattern from usePptxExport.ts + useMarkdownExport.ts (both verified)

// ── After await pres.writeFile is NOT the right place ──
// Insert BEFORE the writeFile call, after Slide 7 block ends

// Conditional Slide: AI/GPU (PPTX-10)
if (store.gpuVmCount > 0) {
  const gpuData = buildAiGpuSlideData(store)
  const sGpu = pres.addSlide({ masterName: MASTER_NAME })
  sGpu.addText('AI / GPU Workloads', {
    x: 0.5, y: 0.3, w: 12, h: 0.8,
    fontSize: 24, bold: true, color: PPTX_WHITE,
  })
  const gpuRows: TableRow[] = [
    [hdrCell('Parameter'), hdrCell('Value')],
    ...gpuData.map((r): TableRow => [cell(r.label), cell(r.value)]),
  ]
  sGpu.addTable(gpuRows, {
    x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
    fontSize: 13, color: 'F0F0F0',
    border: { type: 'solid', pt: 1, color: '444444' },
  })
}

// ... (NVMe, Stretch, vSAN Max, Warnings follow same structure)

// Trigger browser download — MUST await (last line before return)
await pres.writeFile({ fileName: 'vcf-sizing-report.pptx' })
```

### Validation Warnings as Bulleted Text (mirrors Recommendations slide)

```typescript
// Source: pattern from Slide 7 (Recommendations) in usePptxExport.ts

if (calc.validationErrors.length > 0) {
  const warningsData = buildValidationWarningsSlideData(calc)
  const sWarn = pres.addSlide({ masterName: MASTER_NAME })
  sWarn.addText('Validation Warnings', {
    x: 0.5, y: 0.3, w: 12, h: 0.8,
    fontSize: 24, bold: true, color: PPTX_WHITE,
  })
  const warnText = warningsData
    .map((w) => `  \u2022  [${w.severity.toUpperCase()}]  ${w.messageKey}`)
    .join('\n')
  sWarn.addText(warnText, {
    x: 0.5, y: 1.5, w: 12, h: 4.5,
    fontSize: 14, color: PPTX_WHITE, valign: 'top', lineSpacingMultiple: 1.5,
  })
}
```

### Test Pattern for Presence/Absence Contract

```typescript
// Source: pattern from usePptxExport.test.ts (verified by direct read)

describe('buildAiGpuSlideData — PPTX-10', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns rows when gpuVmCount > 0', () => {
    const store = useInputStore()
    store.gpuVmCount = 4
    store.vgpuMemoryGB = 24
    const result = buildAiGpuSlideData(store)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(2)
    const gpuRow = result.find((r) => String(r.value).includes('4'))
    expect(gpuRow).toBeDefined()
  })

  it('every row has label and value', () => {
    const store = useInputStore()
    store.gpuVmCount = 1
    const result = buildAiGpuSlideData(store)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })
})
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | `vite.config.ts` (vitest section) |
| Quick run command | `npx vitest run src/composables/usePptxExport.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PPTX-10 | `buildAiGpuSlideData` returns rows when `gpuVmCount > 0` | unit | `npx vitest run src/composables/usePptxExport.test.ts` | Extend existing |
| PPTX-11 | `buildNvmeTieringSlideData` returns rows when `nvmeTieringEnabled = true` | unit | `npx vitest run src/composables/usePptxExport.test.ts` | Extend existing |
| PPTX-12 | `buildStretchTopologySlideData` returns rows including networkChecklist data | unit | `npx vitest run src/composables/usePptxExport.test.ts` | Extend existing |
| PPTX-13 | `buildVsanMaxSlideData` returns rows when `storageType = 'vsan-max'` | unit | `npx vitest run src/composables/usePptxExport.test.ts` | Extend existing |
| PPTX-14 | `buildValidationWarningsSlideData` returns an entry per warning | unit | `npx vitest run src/composables/usePptxExport.test.ts` | Extend existing |

### Sampling Rate

- **Per task commit:** `npx vitest run src/composables/usePptxExport.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/composables/usePptxExport.test.ts` — add 5 new `describe` blocks for PPTX-10..14 helpers (file exists; extend it)

No new test files are needed — Phase 9 tests live inside the existing test file as additional `describe` blocks.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Rule |
|------------|------|
| Engine layer | `src/engine/*.ts` must NEVER import from Vue, Pinia, or Vue ecosystem (CALC-01) |
| calculationStore | Must contain ZERO `ref()` — only `computed()` (CALC-02) |
| Validation warnings | Must use i18n message keys, not English strings |
| VueI18nPlugin | `include` omitted intentionally — do not add it |
| pptxgenjs | Dynamic import only, inside `generatePptxReport()` body (PPTX-15) |
| Composable location | `src/composables/` — Vue-layer code |
| Test scope | Tests cover `src/engine/**/*.test.ts` and `src/composables/**/*.test.ts` only |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 9 is a pure TypeScript code extension with no new external dependencies. All required packages (pptxgenjs, pinia, vitest) were installed in prior phases.

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 9 is not a rename/refactor/migration phase. No stored data, service configs, OS-registered state, secrets, or build artifacts are affected.

---

## Open Questions

1. **Two-table stretch slide layout**
   - What we know: Stretch topology section in Markdown has 7 main rows + 5 network checklist rows = 12 total data rows
   - What's unclear: Whether two tables fit on a single slide without overflowing past the footer at y=6.8 using standard rowH=0.45
   - Recommendation: Use compressed `rowH: 0.35` and `fontSize: 11` for both tables, or split into two slides (topology + checklist). The planner should decide; a two-slide approach is simpler to implement and avoids overflow risk.

2. **Validation warnings: table vs. text**
   - What we know: Recommendations slide uses bulleted text (`addText`); warnings could use either text or a table with Severity/Message columns
   - What's unclear: Whether a table is more readable for warnings vs. the bullets-only approach
   - Recommendation: Use table with two columns (Severity, Message Key) for consistent look with other slides. Add a header row using `hdrCell()`.

---

## Sources

### Primary (HIGH confidence)

- Direct read of `src/composables/usePptxExport.ts` — full Phase 8 output, patterns verified
- Direct read of `src/composables/useMarkdownExport.ts` — conditional guard patterns verified
- Direct read of `src/composables/usePptxExport.test.ts` — test patterns verified
- Direct read of `src/stores/inputStore.ts` — all field names and types verified
- Direct read of `src/stores/calculationStore.ts` — computed accessors and return types verified
- Direct read of `src/engine/types.ts` — `StretchResult`, `VsanMaxResult`, `ValidationWarning` interfaces verified
- Direct read of `.planning/REQUIREMENTS.md` — PPTX-10..14 requirements verified
- Direct read of `.planning/STATE.md` — Phase 8 decisions verified
- Direct read of `CLAUDE.md` — project constraints verified

### Secondary (MEDIUM confidence)

- None required — all findings sourced from project codebase directly

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies; all libraries already installed and proven
- Architecture: HIGH — patterns read directly from Phase 8 source files and Markdown composable
- Store field mapping: HIGH — read directly from inputStore.ts and calculationStore.ts
- Pitfalls: HIGH — derived from actual code constraints and Phase 8 decisions in STATE.md

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack — pptxgenjs API stable; Pinia API stable)
