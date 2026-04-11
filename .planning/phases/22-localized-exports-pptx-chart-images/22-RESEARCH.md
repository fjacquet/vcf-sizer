# Phase 22: Localized Exports + PPTX Chart Images - Research

**Researched:** 2026-04-11
**Domain:** i18n integration in export composables, pptxgenjs image embedding
**Confidence:** HIGH

## Summary

Phase 22 requires two main changes: (1) replacing all hardcoded English strings in `useMarkdownExport.ts` and `usePptxExport.ts` with i18n-resolved translations via `i18n.global.t()`, and (2) embedding chart PNG data URLs from `uiStore.chartImages` into per-domain PPTX slides using pptxgenjs `addImage()`.

The codebase is well-positioned for this. The `i18n` singleton is already exported from `src/i18n/index.ts`, the `chartImages` registry in `uiStore` stores `Record<string, Record<ChartType, string>>` keyed by domain ID and chart type, and pptxgenjs v4.0.1 (already installed) supports base64 data URLs via `slide.addImage({ data: dataUrl, x, y, w, h })`. The STATE.md already documents the key pitfalls (PITFALL-3, PITFALL-7, PITFALL-10) that constrain implementation.

**Primary recommendation:** Add an `export` namespace to all four locale JSON files with ~60 keys covering every hardcoded label in both composables, add a `localeLoading` ref to `uiStore.setLocale()`, and wire chart images into the per-domain PPTX slide loop with a data-table fallback when images are unavailable.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPORT-01 | PPTX slides include chart images (PNG, rasterized from live Chart.js canvas) | pptxgenjs `addImage({ data })` accepts full `data:image/png;base64,...` strings (PITFALL-7); `uiStore.chartImages[domainId]` provides the data URLs; graceful fallback when not populated |
| EXPORT-02 | Markdown and PPTX exports use the active UI locale instead of always rendering in English | `i18n.global.t()` callable from plain TS modules (PITFALL-3); ~60 hardcoded strings across both composables need i18n keys; `localeLoading` guard prevents English fallback race |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library (CALC-01)
- `calculationStore.ts` must never contain `ref()` -- only `computed()` (CALC-02)
- Validation warnings must use i18n message keys, not raw English strings
- Export composables are plain TypeScript (no Vue lifecycle hooks) -- EXPORT-PURE
- pptxgenjs dynamic import pattern keeps it out of initial bundle (PPTX-15)
- `VueI18nPlugin` is configured with `include` omitted intentionally

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pptxgenjs | 4.0.1 | PPTX generation with image embedding | Already installed; `addImage({ data })` for base64 PNGs [VERIFIED: node_modules] |
| vue-i18n | (existing) | i18n runtime with `i18n.global.t()` | Already configured with 4 locales; singleton export from `src/i18n/index.ts` [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | -- | -- | No new dependencies needed |

**Installation:** No new packages required.

## Architecture Patterns

### i18n in Plain TypeScript Composables (PITFALL-3)

Export composables are plain TS modules -- they cannot use `useI18n()` (which requires Vue component context). The project decision (STATE.md) is to use the singleton `i18n.global.t()` from `src/i18n/index.ts`. [VERIFIED: STATE.md]

```typescript
// Source: src/i18n/index.ts + STATE.md PITFALL-3
import { i18n } from '@/i18n'

// Inside composable function:
const t = i18n.global.t
const title = t('export.title') // resolves using active locale
```

### pptxgenjs addImage with base64 Data URL (PITFALL-7)

pptxgenjs `addImage()` accepts a `data` property containing a full data URL string including the `data:image/png;base64,` prefix. Do NOT strip the prefix. [VERIFIED: pptxgenjs types + STATE.md PITFALL-7]

```typescript
// Source: pptxgenjs types/index.d.ts DataOrPathProps
slide.addImage({
  data: chartDataUrl,  // full "data:image/png;base64,..." string
  x: 0.5,
  y: 1.5,
  w: 5.5,
  h: 3.5,
})
```

### localeLoading Guard (PITFALL-10)

`uiStore` currently has NO `localeLoading` flag. The `setLocale()` function calls `loadLocale()` which is async. A `localeLoading` ref must be added that is `true` while locale JSON is being fetched, and `ExportToolbar.vue` must disable export buttons when it is true. [VERIFIED: uiStore.ts has no loading state]

```typescript
// Pattern for uiStore.setLocale:
const localeLoading = ref(false)

async function setLocale(newLocale: AppLocale): Promise<void> {
  locale.value = newLocale
  if (newLocale === 'en') {
    i18n.global.locale.value = 'en'
  } else {
    localeLoading.value = true
    try {
      await loadLocale(newLocale)
    } finally {
      localeLoading.value = false
    }
  }
}
```

### Chart Image Fallback Pattern

`uiStore.chartImages` may be empty if charts haven't rendered (e.g., domain results not yet visible). PPTX export must degrade gracefully by showing data tables instead of blank images. [VERIFIED: success criteria #5]

```typescript
const domainCharts = uiStore.chartImages[domain.id]
const hasCoresChart = domainCharts?.cores
if (hasCoresChart) {
  slide.addImage({ data: domainCharts.cores, x: 0.5, y: 1.5, w: 5.5, h: 3.5 })
} else {
  // fallback: render data table (existing table code)
}
```

### Recommended i18n Key Structure for Export Namespace

```
export.title              "VCF 9.x Sizing Report"
export.generated          "Generated"
export.domains            "Domains"
export.mgmtArchitecture   "Management Architecture"
export.mgmtOverhead       "Management Domain Overhead"
export.domain             "Domain"
export.hostConfig         "Host Configuration"
export.workloadProfile    "Workload Profile"
export.computeSizing      "Compute Sizing"
export.storageSizing      "Storage Sizing"
export.networkConfig      "Network Configuration"
export.nvmeTiering        "NVMe Memory Tiering"
export.aiGpu              "AI / GPU Workloads"
export.stretchTopology    "Stretch Cluster Topology"
export.vsanMaxCluster     "vSAN Max Cluster"
export.aggregateTotals    "Aggregate Totals"
export.validationWarnings "Validation Warnings"
export.parameter          "Parameter"
export.value              "Value"
export.metric             "Metric"
export.component          "Component"
export.severity           "Severity"
export.message            "Message"
// ... plus ~40 row-level labels (hosts, coresPerSocket, etc.)
```

### Hardcoded String Inventory

**useMarkdownExport.ts** -- approximately 35 hardcoded English strings:
- Section headings: "VCF 9.x Sizing Report", "Management Architecture", "Management Domain Overhead", "Domain:", "Host Configuration", "Workload Profile", "Compute Sizing", "Storage Sizing", "Network Configuration", "NVMe Memory Tiering", "AI/GPU Workloads", "Stretch Cluster Topology", "vSAN Max Cluster", "Aggregate Totals", "Validation Warnings"
- Table headers: "Parameter", "Value", "Metric", "Resource", "Required", "Component"
- Row labels: "Hosts", "Cores per socket", "Sockets per host", "RAM per host", "Storage per host", etc.
- Boolean values: "Yes"/"No"
- Footer: "Generated by VCF Sizer"

**usePptxExport.ts** -- approximately 55 hardcoded English strings:
- Same labels as Markdown plus slide titles with domain name interpolation
- Build* helper functions return `{ label: string }` objects with hardcoded English
- `generatePptxReport()` has inline hardcoded `addText()` calls and `hdrCell()` calls
- Slide master footer text: "VMware by Broadcom | VCF Sizer"

**Validation warnings** -- currently rendered as raw i18n keys (e.g., `w.messageKey`). Phase 22 should resolve these to translated text using `t(w.messageKey)`. [VERIFIED: useMarkdownExport.ts line 232]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| i18n in composables | Custom translation lookup | `i18n.global.t()` singleton | Already configured, handles locale switching, fallback |
| PPTX image embedding | Manual binary PPTX manipulation | `pptxgenjs addImage({ data })` | Handles base64 encoding, image placement, sizing |
| Locale loading state | Manual promise tracking | `localeLoading` ref in uiStore wrapping existing `loadLocale()` | Single source of truth for all consumers |

## Common Pitfalls

### Pitfall 1: useI18n() Outside Component Context
**What goes wrong:** Calling `useI18n()` in a plain TS module throws "Must be called at the top of a setup function"
**Why it happens:** `useI18n()` requires Vue component injection context
**How to avoid:** Use `i18n.global.t()` from the singleton exported by `src/i18n/index.ts` (PITFALL-3 in STATE.md) [VERIFIED: STATE.md]
**Warning signs:** Runtime error on first export click

### Pitfall 2: Stripping base64 Prefix from Data URL
**What goes wrong:** Image appears as broken/blank in PPTX
**Why it happens:** Developer strips "data:image/png;base64," prefix thinking pptxgenjs wants raw base64
**How to avoid:** Pass the FULL data URL string to `addImage({ data })` (PITFALL-7 in STATE.md) [VERIFIED: STATE.md + pptxgenjs types]
**Warning signs:** PPTX opens but chart images are missing or corrupted

### Pitfall 3: English Fallback Race During Locale Switch
**What goes wrong:** Export generates while locale JSON is still loading, producing English output despite French UI
**Why it happens:** `loadLocale()` is async; if user clicks Export before it resolves, `t()` falls back to English
**How to avoid:** Add `localeLoading` ref to uiStore; disable export buttons while true (PITFALL-10 in STATE.md) [VERIFIED: STATE.md]
**Warning signs:** Intermittent English exports when locale was recently changed

### Pitfall 4: buildXxxData() Functions Return Hardcoded Labels
**What goes wrong:** Localizing only `generatePptxReport()` misses labels generated by `buildConfigSummaryData()` etc.
**Why it happens:** The build helper functions are pure and accept no i18n parameter -- they embed English directly
**How to avoid:** Either (a) pass `t` function to each build helper, or (b) move i18n resolution into `generatePptxReport()` where build helpers return keys instead of labels. Option (a) is simpler -- add a `t` parameter.
**Warning signs:** Some PPTX cells show French titles but English row labels

### Pitfall 5: Chart Images Not Yet Populated on First Load
**What goes wrong:** PPTX export called before charts have rendered and registered PNG data URLs
**Why it happens:** Charts render in DomainResultCard components; if user exports before scrolling to results, chartImages may be empty
**How to avoid:** Graceful fallback -- check `uiStore.chartImages[domainId]?.cores` and render data table if undefined
**Warning signs:** PPTX slides have blank areas where charts should be

## Code Examples

### Using i18n.global.t() in Composable

```typescript
// Source: STATE.md PITFALL-3 decision [VERIFIED: codebase]
import { i18n } from '@/i18n'

export function generateMarkdownReport(): string {
  const t = i18n.global.t
  // Use throughout:
  sections.push(`# ${t('export.title')}`)
  sections.push(`**${t('export.generated')}:** ${now}`)
}
```

### pptxgenjs addImage with Chart Data URL

```typescript
// Source: pptxgenjs v4.0.1 types [VERIFIED: node_modules]
import { useUiStore } from '@/stores/uiStore'

// Inside per-domain slide loop:
const uiStore = useUiStore()
const domainCharts = uiStore.chartImages[domain.id]

if (domainCharts?.cores) {
  slide.addImage({
    data: domainCharts.cores,  // "data:image/png;base64,..."
    x: 0.5,
    y: 1.5,
    w: 5.5,
    h: 3.5,
    altText: `${domain.name} cores utilization chart`,
  })
}
```

### ExportToolbar Locale Loading Guard

```typescript
// In ExportToolbar.vue <script setup>:
import { useUiStore } from '@/stores/uiStore'
const uiStore = useUiStore()

// Template:
// :disabled="pptxLoading || uiStore.localeLoading"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded English in export composables | i18n.global.t() for all export strings | Phase 22 (this phase) | Exports match UI locale |
| No chart images in PPTX | Chart PNGs embedded via addImage | Phase 22 (this phase) | Visual data in presentations |
| No locale loading guard | localeLoading ref disables exports | Phase 22 (this phase) | No English fallback race |
| messageKey rendered raw in exports | t(messageKey) resolves to translated text | Phase 22 (this phase) | Validation warnings are human-readable |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ~60 i18n keys needed for export namespace | Architecture Patterns | Low -- count may vary by 5-10 keys; easy to add more during implementation |
| A2 | Chart images fit well at 5.5 x 3.5 inches on PPTX slide | Code Examples | Low -- dimensions can be adjusted visually; no functional impact |
| A3 | Validation warning messageKeys are resolvable via t() | Pitfall 4 | Medium -- if any messageKey is not in locale files, t() returns the key itself (acceptable fallback) |

## Open Questions

1. **Chart image placement strategy in PPTX**
   - What we know: Each domain can have 3 chart types (cores, ram, storage). Current slides have one table per slide.
   - What's unclear: Should chart images go on their own slide, or alongside existing data tables?
   - Recommendation: Add a single "Charts" slide per domain after the storage results slide, showing all 3 charts in a row (each ~4x3 inches). This keeps existing slide structure intact and adds visual value without disrupting the data flow.

2. **Build helper function refactoring approach**
   - What we know: `buildConfigSummaryData()`, `buildWorkloadSlideData()`, etc. all return `{ label: string }` with hardcoded English
   - What's unclear: Whether to pass `t` to each helper or to change helpers to return i18n keys
   - Recommendation: Pass `t` as a parameter to each build helper. This preserves function purity (caller provides the translation function) and keeps the helpers testable (tests can pass a mock `t`).

## Sources

### Primary (HIGH confidence)
- `src/composables/useMarkdownExport.ts` -- full source reviewed, 35 hardcoded strings identified
- `src/composables/usePptxExport.ts` -- full source reviewed, 55 hardcoded strings + 12 build helpers
- `src/stores/uiStore.ts` -- confirmed chartImages registry shape and absence of localeLoading
- `src/i18n/index.ts` -- confirmed singleton export, loadLocale async pattern
- `node_modules/pptxgenjs/types/index.d.ts` -- confirmed addImage({ data }) accepts full data URL
- `.planning/STATE.md` -- PITFALL-3, PITFALL-7, PITFALL-10 decisions documented

### Secondary (MEDIUM confidence)
- npm registry -- pptxgenjs 4.0.1 confirmed as latest version [VERIFIED: npm view]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all APIs verified in installed packages
- Architecture: HIGH -- i18n singleton pattern already documented as project decision; pptxgenjs image API verified in type definitions
- Pitfalls: HIGH -- all 5 pitfalls verified against codebase and STATE.md accumulated decisions

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- no fast-moving dependencies)
