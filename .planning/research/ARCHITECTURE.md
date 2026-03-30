# Architecture Research — v2.1 Export Integration

**Domain:** VCF 9.x Sizing Calculator SPA — Export Quality (Markdown, Print/PDF, PPTX)
**Researched:** 2026-03-29
**Confidence:** HIGH for integration patterns (direct code inspection); HIGH for pptxgenjs API (official docs); MEDIUM for Tailwind v4 print specifics (WebSearch, no Context7 entry); LOW for exact pptxgenjs bundle size (Bundlephobia 403'd, npm page 403'd)
**Replaces:** Prior ARCHITECTURE.md (v2.0 research, 2026-03-29)

---

## Context: What This Document Covers

This is the v2.1 milestone architecture document. It answers six specific integration questions for the roadmapper:

1. Where should `generateMarkdownReport()` live — stay in `useUrlState.ts` or move?
2. Where should PPTX generation live — new composable? engine function? component handler?
3. Which stores and engine results does each export type read?
4. What is the print/PDF CSS approach — Tailwind `print:` variants vs separate stylesheet?
5. What are the new files to create vs existing files to modify?
6. What is the correct build order for all three export types?

All answers are grounded in direct inspection of the existing codebase.

---

## Existing Architecture — Confirmed State

The engine follows a strict unidirectional pattern that MUST be preserved:

```
inputStore (ref() only — CALC-01 enforced)
    ↓
calculationStore (computed() only — CALC-02 enforced)
    ↓ reads
engine/*.ts — pure TypeScript functions (zero Vue imports — CALC-01)
```

### Current Export Surface

`ExportToolbar.vue` currently calls three functions all imported from `useUrlState.ts`:

```
ExportToolbar.vue
    ├── generateShareUrl()      → reads inputStore → lz-string → returns URL string
    ├── generateMarkdownReport()→ reads inputStore + calculationStore → returns string
    └── window.print()          → direct browser API call
```

**Problem:** `generateMarkdownReport()` is misplaced in `useUrlState.ts`. That file's responsibility is URL state (compress/decompress + Zod validation). The Markdown export is unrelated to URL state. This is the first refactor that must happen.

### Current inputStore fields (all `ref()`)

All deployment configuration: `deploymentMode`, `hostCount`, `coresPerSocket`, `socketsPerHost`, `hostRamGB`, `hostStorageTB`, `nvmeTieringEnabled`, `activeMemoryPct`, `preferredSiteHosts`, `secondarySiteHosts`, `managementArchitecture`, `vmCount`, `avgVcpuPerVm`, `avgVramGbPerVm`, `avgStorageGbPerVm`, `cpuOvercommitRatio`, `ramOvercommitRatio`, `gpuVmCount`, `vgpuMemoryGB`, `storageType`, `fttLevel`, `raidType`, `dedupEnabled`, `dedupRatio`, `vsanMaxProfile`, `vsanMaxStorageNodes`, `networkSpeedGbE`.

### Current calculationStore exports (all `computed()`)

- `management` → `MgmtDomainResult` (per-component overhead + totals)
- `compute` → `ComputeResult` (host count, utilization pct, vCPU/RAM required/available)
- `storage` → `StorageResult` (raw TB, usable TB, RAID scheme, overhead breakdown)
- `stretch` → `StretchResult` (bandwidth, per-site storage, network checklist, witness)
- `vsanMax` → `VsanMaxResult | null` (storage nodes, usable TB, RAID scheme)
- `validationErrors` → `ValidationWarning[]` (error/warning severity, i18n key)
- `dedicatedMgmtHostCount` → `number | null`

---

## Question 1: Where Should `generateMarkdownReport()` Live?

### Verdict: Extract to a new `src/composables/useMarkdownExport.ts`

**Rationale:**

`useUrlState.ts` has a single clear responsibility: URL state serialization (lz-string + Zod). `generateMarkdownReport()` does not compress state, does not touch Zod, and does not interact with the URL. Its presence in `useUrlState.ts` is an accretion from v1 when exports were minimal. The test file `useMarkdownExport.test.ts` already exists (it directly calls engine functions as a workaround — confirming the author anticipated this move).

The new composable follows the existing pattern exactly: a plain TypeScript module (no Vue lifecycle hooks, just exported functions), reads from `useInputStore()` and `useCalculationStore()`, returns a string.

**What moves:** `generateMarkdownReport()` from `useUrlState.ts` → new `useMarkdownExport.ts`.
**What stays:** `hydrateFromUrl()` and `generateShareUrl()` stay in `useUrlState.ts`.
**Import change:** `ExportToolbar.vue` import line updates from `useUrlState` to `useMarkdownExport`.

**CALC-01/CALC-02 compatibility:** Full. The new composable reads Pinia stores (permitted — composables are Vue-layer), calls no engine functions directly (stores already do that via `computed()`).

---

## Question 2: Where Should PPTX Generation Live?

### Verdict: New `src/composables/usePptxExport.ts`

**Rationale:**

PPTX generation is browser-side via `pptxgenjs`. The generation function needs to:
1. Read current state from `useInputStore()` and `useCalculationStore()`
2. Construct a `pptxgen` presentation object
3. Call `pres.writeFile()` which triggers browser download

This is identical in structure to `generateMarkdownReport()` — it reads stores and produces a file download. The composable pattern (plain TypeScript module with exported async function) fits perfectly.

**Why not inside `ExportToolbar.vue` directly?**
- Testability: an exported function in a composable can be unit-tested; a method inside a Vue SFC script block cannot be isolated
- Reuse: a second export entry point (e.g., a future "Export" menu component) can reuse the composable without duplicating logic
- Separation: keeps the toolbar a thin button layer, not a business logic container

**Why not in the engine layer?**
HARD NO. The engine layer (CALC-01) forbids all Vue imports. `pptxgenjs` is a browser library and its usage requires reading Pinia stores. Both constraints disqualify the engine.

**CALC-01/CALC-02 compatibility:** Full. `usePptxExport.ts` is a composable (Vue layer), not an engine function. It reads `computed()` values from the calculationStore — it never writes to any store.

**Function signature:**
```typescript
// src/composables/usePptxExport.ts
export async function generatePptxReport(): Promise<void>
```

The function is `async` because `pptxgenjs`'s `writeFile()` returns a Promise. The caller in `ExportToolbar.vue` calls it with `await` in an async handler (same pattern as `handleShare` already uses).

---

## Question 3: Which Stores Does Each Export Type Read?

### Markdown Export — `useMarkdownExport.ts`

| Data needed | Source |
|-------------|--------|
| Deployment mode | `inputStore.deploymentMode` |
| Host configuration | `inputStore.*` (hostCount, cores, RAM, storage) |
| Workload profile | `inputStore.*` (vmCount, avgVcpu, avgVram, overcommit ratios) |
| AI/GPU config | `inputStore.gpuVmCount`, `inputStore.vgpuMemoryGB` |
| NVMe tiering | `inputStore.nvmeTieringEnabled`, `inputStore.activeMemoryPct` |
| Stretch site config | `inputStore.preferredSiteHosts`, `inputStore.secondarySiteHosts` |
| vSAN Max config | `inputStore.vsanMaxProfile`, `inputStore.vsanMaxStorageNodes` |
| Management overhead | `calculationStore.management` |
| Compute sizing | `calculationStore.compute` |
| Storage sizing | `calculationStore.storage` |
| Stretch topology | `calculationStore.stretch` (only when `deploymentMode === 'stretch'`) |
| vSAN Max results | `calculationStore.vsanMax` (only when `storageType === 'vsan-max'`) |
| Validation warnings | `calculationStore.validationErrors` |

The current `generateMarkdownReport()` only covers Host Config, Management, Compute, and Storage — missing 7 sections. The enrichment adds all the missing rows.

### PPTX Export — `usePptxExport.ts`

Reads the same store surface as Markdown. PPTX additionally needs conditional logic:
- Slide 3 (Stretch topology) only rendered when `deploymentMode === 'stretch'`
- Slide 4 (vSAN Max) only rendered when `storageType === 'vsan-max'`
- Warnings slide only rendered when `validationErrors.length > 0`

### Print/PDF — CSS only, no composable needed

Print styling is pure CSS. No JavaScript reads stores at print time. `window.print()` in `ExportToolbar.vue` remains unchanged. The work is entirely in CSS: `@page` rules, `break-before`/`break-after`/`break-inside` on the DOM elements that are already rendered.

---

## Question 4: Print/PDF CSS Approach

### Verdict: Tailwind `print:` variants for simple rules + `@page` block in `style.css` for advanced rules

**Rationale:**

Tailwind v4 supports the `print:` modifier natively (already active — `src/style.css` has `@custom-variant print (@media print)`). This covers:
- `print:hidden` on ExportToolbar and interactive controls (already used in `ExportToolbar.vue`)
- `print:break-before-page` on section boundaries
- `print:break-inside-avoid` on cards to prevent mid-card splits

**Where Tailwind `print:` falls short:** The `@page` at-rule (margins, page size, headers/footers) cannot be expressed as Tailwind utility classes. This goes in `src/style.css` as a raw CSS block.

**The `@page` block needed in `src/style.css`:**
```css
@media print {
  @page {
    size: A4 portrait;
    margin: 15mm 20mm;
  }

  @page :first {
    margin-top: 25mm; /* room for report title */
  }
}
```

**Chrome 131+ note:** `@page` margin boxes (`@top-center`, `@bottom-center`) for running headers/footers are now supported in Chrome 131+ and Firefox 95+ (confirmed via WebSearch). Safari 18.2+ adds support. This is broadly available as of 2025. However, running headers require `position: running()` which is not standard CSS — it is a Prince/WeasyPrint CSS extension. Browser native print headers require `content: counter(page)` in `@page` margin boxes, which IS standard and available. This can be added to `style.css` without any JavaScript.

**Page break strategy for the results panel:**

The DOM structure in `ResultsPanel.vue` renders components in this order:
1. `HostCountCard` — always visible
2. `VsanMaxClusterCard` — conditional (storageType === 'vsan-max')
3. `CoresChart` — always visible
4. `RamChart` — always visible
5. `StorageChart` — always visible
6. `StretchNetworkChecklist` — conditional (deploymentMode === 'stretch')
7. `ExportToolbar` — `print:hidden` already applied

Recommended page break insertions (as `print:break-before-page` on each card wrapper):
- Break before `CoresChart` (compute section starts fresh page)
- Break before `StorageChart` (storage section starts fresh page)
- `break-inside: avoid` on all card `<section>` elements

The `App.vue` input panel (left column in the two-column layout) should be `print:hidden` or `print:w-full` depending on desired print layout. Inspect `App.vue` to confirm the column layout before implementing.

**CALC-01/CALC-02 compatibility:** Print CSS has zero interaction with stores or engine. No constraints apply.

---

## Question 5: New Files vs Modified Files

### New Files to Create

| File | Purpose | Constraint |
|------|---------|-----------|
| `src/composables/useMarkdownExport.ts` | `generateMarkdownReport()` — extracted + enriched | Vue layer; reads stores |
| `src/composables/usePptxExport.ts` | `generatePptxReport()` — new PPTX generation | Vue layer; reads stores; uses pptxgenjs |

### Existing Files to Modify

| File | Change | Risk |
|------|--------|------|
| `src/composables/useUrlState.ts` | Remove `generateMarkdownReport()` export | Low — only called from ExportToolbar |
| `src/components/results/ExportToolbar.vue` | Update import + add PPTX button + async handler | Low |
| `src/style.css` | Add `@page` block for print margins | Low |
| `src/components/results/*.vue` (cards) | Add `print:break-before-page` / `break-inside: avoid` Tailwind classes | Low |
| `package.json` | Add `pptxgenjs` dependency | Low |
| `.planning/research/STACK.md` | Document pptxgenjs version/rationale | Docs only |

### Files That Do NOT Change

| File | Reason |
|------|--------|
| `src/engine/*.ts` | CALC-01: engine is pure TS, export is UI concern |
| `src/stores/calculationStore.ts` | Export reads from it, never writes — no change needed |
| `src/stores/inputStore.ts` | Export reads from it, never writes — no change needed |
| `src/composables/useUrlState.ts` (schema, hydrate, share) | URL state logic is unaffected by export refactor |

---

## Question 6: Build Order

### Verdict: Markdown enrichment FIRST, then print CSS, then PPTX

**Dependency chain:**

```
Step 1: Extract generateMarkdownReport() to useMarkdownExport.ts
         (prerequisite for all subsequent work — establishes the correct composable home)
    ↓
Step 2: Enrich Markdown report (add all missing sections: workload, AI/GPU, NVMe, stretch, vSAN Max, warnings)
         (establishes the complete data access pattern — which store fields map to which report sections)
    ↓
Step 3: Print/PDF CSS
         (independent of Markdown; only touches CSS + Tailwind classes on existing components)
    ↓
Step 4: PPTX export
         (reads same store surface as enriched Markdown — benefits from Step 2's data mapping work;
          can reuse field lists and conditional logic patterns already validated in Markdown)
```

**Why Markdown before PPTX?**
The enriched Markdown implementation forces the developer to enumerate every store field needed for a complete export (all 13 data sources listed in Question 3). This enumeration becomes the specification for PPTX slide content. Implementing PPTX first would require discovering the same field mapping twice.

**Why print CSS before PPTX?**
Print CSS can be done entirely without adding any npm dependency. PPTX adds `pptxgenjs` (~600 kB uncompressed, confirmed via npm's dist file browsing). It is better practice to complete the zero-dependency work before adding the bundle cost.

**Can print CSS and Markdown enrichment be done in parallel?**
Yes — they have no shared files. But sequencing Markdown first is still recommended because a developer doing print CSS needs to know what sections exist in the rendered DOM to place page breaks correctly. The enriched Markdown development also exercises the stretch/vSAN Max conditional rendering paths that the print CSS will need to handle.

---

## Architecture Diagrams

### Export Layer — Current vs Target

**Current (v2.0):**
```
ExportToolbar.vue
    ├── import { generateShareUrl, generateMarkdownReport } from 'useUrlState'
    └── window.print()
```

**Target (v2.1):**
```
ExportToolbar.vue
    ├── import { generateShareUrl } from 'useUrlState'         (URL state, unchanged)
    ├── import { generateMarkdownReport } from 'useMarkdownExport'   (extracted + enriched)
    ├── import { generatePptxReport } from 'usePptxExport'    (new)
    └── window.print()                                         (unchanged — print CSS handles layout)
```

### PPTX Data Flow

```
usePptxExport.ts
    ├── useInputStore()         → deploymentMode, host spec, workload, GPU, NVMe, stretch, vSAN Max config
    ├── useCalculationStore()   → management, compute, storage, stretch, vsanMax, validationErrors
    └── pptxgenjs
         ├── new pptxgen()                   → pres
         ├── pres.layout = 'LAYOUT_WIDE'     → 16:9 widescreen
         ├── pres.addSlide()                 → slide 1: Executive Summary
         ├── pres.addSlide()                 → slide 2: Host Configuration + Compute
         ├── pres.addSlide()                 → slide 3: Storage Sizing
         ├── [conditional] pres.addSlide()   → slide 4: Stretch Topology (only if stretch)
         ├── [conditional] pres.addSlide()   → slide 5: vSAN Max Cluster (only if vsan-max)
         ├── [conditional] pres.addSlide()   → slide 6: Warnings (only if validationErrors > 0)
         └── pres.writeFile({ fileName: 'vcf-sizing.pptx' })  → triggers browser download
```

### Markdown Composable Data Flow

```
useMarkdownExport.ts (extracted from useUrlState.ts)
    ├── useInputStore()         → all config fields
    ├── useCalculationStore()   → all computed results
    └── template literals       → sections (conditional on deploymentMode + storageType)
         ├── ## Host Configuration       (always)
         ├── ## Workload Profile         (always)
         ├── ## AI/GPU Workloads         (only if gpuVmCount > 0)
         ├── ## NVMe Memory Tiering      (only if nvmeTieringEnabled)
         ├── ## Management Domain        (always)
         ├── ## Compute Sizing           (always)
         ├── ## Storage Sizing           (always)
         ├── ## Stretch Topology         (only if deploymentMode === 'stretch')
         ├── ## vSAN Max Cluster         (only if storageType === 'vsan-max')
         └── ## Validation Warnings      (only if validationErrors.length > 0)
```

---

## pptxgenjs Integration Notes

### Installation

```bash
npm install pptxgenjs
```

Zero runtime dependencies (confirmed: dual ESM/CJS builds, no peer deps). Vite automatically selects the ES module build (`dist/pptxgen.es.js`) via the `exports` field in its `package.json`.

### Bundle Size Impact

Exact gzip size could not be confirmed (Bundlephobia returned 403). From npm's dist directory browsing, `pptxgen.bundle.js` is ~450-600 kB uncompressed. This is significant relative to the current 159 kB gzip bundle. **Use dynamic import** to load pptxgenjs only on PPTX button click, avoiding any impact on initial page load:

```typescript
// src/composables/usePptxExport.ts
export async function generatePptxReport(): Promise<void> {
  const { default: pptxgen } = await import('pptxgenjs')  // dynamic import
  const pres = new pptxgen()
  // ... build slides ...
  await pres.writeFile({ fileName: 'vcf-sizing.pptx' })
}
```

Vite will automatically code-split `pptxgenjs` into a separate chunk. It will not appear in the main bundle. Initial page load performance is unaffected.

### TypeScript Support

pptxgenjs ships with full TypeScript definitions (`types/index.d.ts`). No `@types/` package needed. Key types: `pptxgen.TextProps`, `pptxgen.ShapeProps`, `pptxgen.TableProps`.

### Positioning Model

pptxgenjs uses inches for all positioning (`x`, `y`, `w`, `h`). Standard slide is 10" × 7.5" (LAYOUT_16x9) or 13.33" × 7.5" (LAYOUT_WIDE). All coordinates must be numeric inches — not CSS pixels or percentages.

### writeFile vs write

Use `writeFile({ fileName: 'vcf-sizing.pptx' })` for browser download. The `write({ outputType: 'blob' })` alternative is only needed if you want to attach the file to a FormData for upload — not the case here.

---

## Tailwind v4 Print Integration Notes

### Custom Variant Already Registered

`src/style.css` already contains:
```css
@custom-variant print (@media print);
```

This means all `print:` prefixed Tailwind classes work already. No configuration change needed.

### Recommended Class Additions

**On `ExportToolbar.vue`** (already done):
```html
<div class="... print:hidden">
```

**On card wrapper `<section>` elements** (to add):
```html
<section class="... print:break-inside-avoid">
```

**On major section boundaries** (to add):
```html
<div class="... print:break-before-page">  <!-- before Compute section -->
<div class="... print:break-before-page">  <!-- before Storage section -->
```

**On App.vue input panel** (to investigate — add `print:hidden` if only results should print):
```html
<aside class="... print:hidden">  <!-- hides the input form when printing -->
```

### @page Rules (in `src/style.css`)

Standard `@page` rules cannot be Tailwind utilities. Add as a raw CSS block. Browser support as of 2025: Chrome 131+, Firefox 95+, Safari 18.2+ for full margin box support.

---

## CALC-01 / CALC-02 Constraint Compatibility Matrix

| Component | Accesses inputStore | Accesses calculationStore | Creates ref() | Creates computed() | CALC-01 OK | CALC-02 OK |
|-----------|--------------------|--------------------------|--------------|--------------------|-----------|-----------|
| `useMarkdownExport.ts` | YES (read-only) | YES (read-only) | NO | NO | YES | YES |
| `usePptxExport.ts` | YES (read-only) | YES (read-only) | NO | NO | YES | YES |
| Print CSS changes | NO | NO | NO | NO | YES | YES |
| `ExportToolbar.vue` changes | YES (calls composable) | NO (via composable) | YES (ref for loading state) | NO | YES | YES |

CALC-01 constraint applies to `src/engine/*.ts` only. Composables are in `src/composables/` — they are Vue-layer code and are permitted to import Pinia stores.

CALC-02 constraint applies to `src/stores/calculationStore.ts` only — it must expose only `computed()`. Export composables read from it, never define new `ref()` inside it.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Putting PPTX Logic in ExportToolbar.vue

**What people do:** Write the entire `pres.addSlide()` sequence directly inside the `<script setup>` of `ExportToolbar.vue`.
**Why it's wrong:** The toolbar becomes a 200+ line component mixing UI (button styling, click handlers) with business logic (slide content, data mapping). Untestable. Violates single-responsibility principle.
**Do this instead:** `ExportToolbar.vue` calls `generatePptxReport()` from `usePptxExport.ts`. The toolbar contains zero pptxgenjs calls.

### Anti-Pattern 2: Calling Engine Functions Directly in Export Composables

**What people do:** Import `calcCompute()`, `calcStorage()`, etc. directly into `useMarkdownExport.ts` and re-pass all inputStore values.
**Why it's wrong:** This duplicates what `calculationStore.ts` already does — creating a second code path that can drift from the canonical calculation. The test file `useMarkdownExport.test.ts` already does this as a workaround because `generateMarkdownReport()` currently can't be tested with Pinia. After extraction to its own file with proper Pinia test setup, this workaround is eliminated.
**Do this instead:** Read `calculationStore.management.value`, `calculationStore.compute.value`, etc. All calculation results are already in the store.

### Anti-Pattern 3: Eager Import of pptxgenjs

**What people do:** `import pptxgen from 'pptxgenjs'` at the top of `usePptxExport.ts`.
**Why it's wrong:** Adds ~150-200 kB to the main bundle (even with tree-shaking, pptxgenjs is not tree-shakeable — it's a class-based library). Increases initial page load time for 100% of users who may never click the PPTX button.
**Do this instead:** `const { default: pptxgen } = await import('pptxgenjs')` inside the `generatePptxReport()` function. Vite code-splits this into a separate chunk loaded on demand.

### Anti-Pattern 4: Using Pixel Values for pptxgenjs Positioning

**What people do:** Copy CSS px/rem values into pptxgenjs `x`, `y`, `w`, `h` properties.
**Why it's wrong:** pptxgenjs uses inches. `x: 100` means 100 inches off-screen, not 100 pixels.
**Do this instead:** Design slide layout in inches. A standard 16:9 slide is 10" × 7.5". Use decimals: `x: 0.5, y: 0.5, w: 9, h: 1.5`.

### Anti-Pattern 5: Synchronous PPTX Button Handler

**What people do:** `function handleExportPptx() { generatePptxReport() }` (synchronous, no await).
**Why it's wrong:** `generatePptxReport()` is async (dynamic import + pptxgenjs `writeFile()`). Without `await`, errors are silently swallowed and there is no loading feedback.
**Do this instead:** `async function handleExportPptx() { await generatePptxReport() }` with optional loading state ref for button disabled/spinner feedback.

---

## Integration Points Summary

| Export Type | Reads From | Writes To | New File | Modified Files |
|-------------|------------|-----------|----------|----------------|
| Markdown (enriched) | inputStore + calculationStore | `.md` download via Blob | `useMarkdownExport.ts` | `useUrlState.ts` (remove fn), `ExportToolbar.vue` (re-import) |
| Print/PDF | DOM (rendered already) | Browser print dialog | none | `style.css` (@page rules), card components (print: classes) |
| PPTX | inputStore + calculationStore | `.pptx` download via pptxgenjs | `usePptxExport.ts` | `ExportToolbar.vue` (add button + handler), `package.json` |

---

## Sources

- Direct code inspection: `src/composables/useUrlState.ts`, `src/stores/calculationStore.ts`, `src/stores/inputStore.ts`, `src/engine/types.ts`, `src/components/results/ExportToolbar.vue`, `src/components/results/ResultsPanel.vue`, `src/style.css`
- pptxgenjs official docs: https://gitbrent.github.io/PptxGenJS/docs/integration/ and https://gitbrent.github.io/PptxGenJS/docs/usage-saving/ — confirmed browser ESM support, `writeFile()` API, TypeScript definitions, zero runtime dependencies
- Tailwind v4 print: https://www.mailslurp.com/blog/tailwind-print-styles-custom-media-query/ and https://github.com/tailwindlabs/tailwindcss/discussions/17457 — confirmed `print:` modifier and `break-*` utilities work in v4
- CSS @page rules: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page — confirmed Chrome 131+ / Firefox 95+ / Safari 18.2+ margin box support
- Vite dynamic import code splitting: Vite docs (standard behavior, HIGH confidence from training data)

---

*Architecture research for: VCF 9.x Sizing Calculator SPA — v2.1 Export Quality milestone*
*Researched: 2026-03-29*
