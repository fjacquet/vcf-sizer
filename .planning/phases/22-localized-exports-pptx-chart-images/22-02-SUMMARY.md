---
phase: 22-localized-exports-pptx-chart-images
plan: 02
status: complete
---

# Plan 22-02 Summary: Chart PNG Embedding in PPTX

## What was built
Per-domain chart PNG images (Cores, RAM, Storage) are now embedded into PPTX export slides when available.

## Changes made

### src/composables/usePptxExport.ts
- Added `import { useUiStore } from '@/stores/uiStore'`
- Added `const uiStore = useUiStore()` in `generatePptxReport()`
- After the vSAN Max conditional slide block (end of per-domain loop), added chart image embedding logic:
  - Reads `uiStore.chartImages[domain.id]` for each domain
  - Filters to available chart types (cores, ram, storage)
  - When at least 1 chart is available, adds a "Charts" slide with up to 3 images laid out side-by-side
  - Uses `addImage({ data: fullDataUrl })` with full `data:image/png;base64,...` prefix (PITFALL-7)
  - Each image has `altText` for accessibility

### src/composables/usePptxExport.test.ts
- Added `import { useUiStore }` at top level (ESM import, not CJS require)
- Added 4 new tests covering:
  - All 3 chart types populated → 3 available charts
  - Empty chartImages → 0 available charts (graceful degradation)
  - Partial chartImages (cores only) → 1 available chart
  - Data URLs preserve full `data:image/png;base64,` prefix (PITFALL-7)

### i18n locale files (en.json, fr.json, de.json, it.json)
- Added `export.charts` key: "Charts" / "Graphiques" / "Diagramme" / "Grafici"

## Verification
- 297 tests pass (52 in usePptxExport.test.ts)
- `vue-tsc --noEmit` passes clean
- Graceful degradation: no Charts slide when chartImages is empty for a domain
