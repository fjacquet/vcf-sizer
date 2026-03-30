# Pitfalls Research

**Domain:** VCF 9.x Client-Side Sizing Calculator SPA — v2.1 Export Quality Milestone
**Researched:** 2026-03-29
**Confidence:** HIGH for pitfalls verified against Context7, official docs, or GitHub issues; MEDIUM for pitfalls backed by multiple community sources; LOW where flagged

---

## Scope: v2.1 Export Features

This document covers pitfalls specific to adding three export capabilities to the existing Vue 3 + Vite 8 + Tailwind v4 SPA:

1. **PptxGenJS** — in-browser PPTX generation (dynamic import)
2. **Print/PDF CSS** — `@media print` overhaul replacing `window.print()` minimal styles
3. **Markdown enrichment** — adding missing conditional sections (stretch, vSAN Max, AI/GPU, NVMe, warnings)

Previous milestone pitfalls (v1.0 / v2.0) are preserved below in a separate section.

---

## Critical Pitfalls

### Pitfall A-1: PptxGenJS Instance Reuse Causes Slide and Metadata Bleed

**What goes wrong:**
When the user clicks "Export PPTX" a second time in the same browser session, the previously generated slides accumulate in the same `pptxgen` instance. The exported file contains slides from both the first and second export, and presentation metadata (title, author, revision) from the first run persists.

**Why it happens:**
`pptxgen` maintains internal state — a slide array and metadata object — from the moment of construction. Calling `addSlide()` on an existing instance appends rather than replaces. Developers reuse a module-level singleton for performance without checking the API contract.

**How to avoid:**
Construct a new `pptxgen` instance inside the export function on every invocation. Never declare `const pptx = new pptxgen()` at module scope or outside the function that triggers download.

```typescript
// CORRECT — fresh instance per export
export async function generatePptx(state: SizingState): Promise<void> {
  const pptxgen = (await import('pptxgenjs')).default
  const pptx = new pptxgen()          // <-- inside the function
  pptx.title = 'VCF Sizing Report'
  // ... add slides
  await pptx.writeFile({ fileName: 'vcf-sizing.pptx' })
}
```

**Sources:** PptxGenJS official docs ("Each new presentation should use a fresh new PptxGenJS() instance to avoid reusing slides or metadata") — HIGH confidence; also confirmed by GitHub issue #406 re: `defineSlideMaster()` config object mutation.

**Warning signs:**
- Second export download contains double the expected slide count
- Presentation title or author shows stale data on re-export

**Phase to address:** PPTX export composable implementation (any task creating `usePptxExport.ts`)

---

### Pitfall A-2: PptxGenJS Option Objects Are Mutated In-Place (EMU Conversion)

**What goes wrong:**
PptxGenJS converts numeric values (positions, sizes, shadow offsets) from inches/points to EMU (English Metric Units) by mutating the option object passed in. If the same option object literal is reused across `addText()`, `addShape()`, or `addImage()` calls, the second call receives already-converted EMU values — producing wildly incorrect positioning (boxes placed off-slide, text sized as thousands of points).

**Why it happens:**
JavaScript passes object references, not copies. The developer writes `const TITLE_STYLE = { x: 0.5, y: 0.3, fontSize: 24 }` once and passes it to multiple `slide.addText(...)` calls. After the first call, `TITLE_STYLE.x` has been silently converted to `457200` (EMU).

**How to avoid:**
Never share option object references across API calls. Use an inline object literal or a factory function that returns a new object on each call:

```typescript
// WRONG — shared reference mutated after first call
const TITLE_OPTIONS = { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, color: '1F497D' }
slide1.addText('Slide 1 Title', TITLE_OPTIONS)
slide2.addText('Slide 2 Title', TITLE_OPTIONS)  // x is now 457200, not 0.5

// CORRECT — factory function returns a new object each time
const titleOptions = () => ({ x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, color: '1F497D' })
slide1.addText('Slide 1 Title', titleOptions())
slide2.addText('Slide 2 Title', titleOptions())
```

Also applies to `shadow` objects — the `offset` value is converted and a negative offset corrupts the PPTX file entirely (PowerPoint shows "needs repair").

**Sources:** Anthropic skills/pptx/pptxgenjs.md — "NEVER reuse option objects across calls - PptxGenJS mutates objects in-place (e.g. converting shadow values to EMU)"; GitHub issue #406 — HIGH confidence.

**Warning signs:**
- Second or third slide has elements positioned off-slide or sized incorrectly
- PowerPoint opens the file with a "needs repair" dialog

**Phase to address:** PPTX slide layout implementation

---

### Pitfall A-3: Color Hex Strings Must Not Include the `#` Prefix

**What goes wrong:**
Passing `color: '#1F497D'` to any PptxGenJS property silently produces an invalid PPTX file. PowerPoint may display a solid black or transparent fill, or show a "needs repair" error, depending on the element type.

**Why it happens:**
CSS uses `#RRGGBB` notation universally. Developers apply the same convention to PptxGenJS, which uses bare `RRGGBB` hex strings without the `#` prefix. There is no runtime error — the library accepts the string and embeds it literally into the XML, which is invalid Office Open XML.

**How to avoid:**
Strip the `#` prefix from all color values. Define a project constant file:

```typescript
// src/engine/pptxColors.ts
export const BRAND = {
  BROADCOM_BLUE:  '1F497D',
  BROADCOM_RED:   'CC0000',
  NEUTRAL_LIGHT:  'F2F2F2',
  NEUTRAL_DARK:   '404040',
  TEXT_PRIMARY:   '000000',
  WHITE:          'FFFFFF',
} as const
```

Also: 8-character RGBA hex strings (e.g., `'1F497D80'`) are not supported. Use 6-char hex plus the separate `transparency` property (0–100 integer).

```typescript
// WRONG
fill: { color: '#1F497D80' }

// CORRECT
fill: { color: '1F497D', transparency: 50 }
```

**Sources:** Anthropic skills/pptx/pptxgenjs.md — HIGH confidence; verified against pptxgenjs source gen-objects.ts.

**Warning signs:**
- Slides render with wrong or missing fill colors
- PowerPoint "needs repair" on open
- All text appears black regardless of specified color

**Phase to address:** PPTX slide layout implementation — define `pptxColors.ts` before writing any slide

---

### Pitfall A-4: Chart.js `toBase64Image()` Returns Blank if Called Before Animation Completes

**What goes wrong:**
`chartRef.value?.chart?.toBase64Image('image/png', 1)` returns a blank (transparent) PNG if called while Chart.js animation is still running. The PPTX slide contains an empty white rectangle where the chart should appear.

**Why it happens:**
Chart.js renders asynchronously with animation by default (`animation.duration = 1000` ms). Calling `toBase64Image()` synchronously after component mount — or immediately after a data update — captures the canvas before rendering completes.

**How to avoid:**
Two options:

Option 1 (recommended for export): Disable animation on charts used for export or globally set `animation: false` in the Chart.js options. With animation disabled, `toBase64Image()` is safe to call synchronously after `nextTick`:

```typescript
// In the chart component options
const chartOptions = {
  animation: false,    // safe for export
  responsive: true,
  // ...
}
```

Option 2 (if animation must be preserved): Wait for `onComplete` callback before calling export:

```typescript
const chartOptions = {
  animation: {
    onComplete: () => {
      chartImageReady.value = true
    }
  }
}
```

**Sources:** Chart.js API docs (`toBase64Image()` must be called after animation completes); QuickChart documentation explicitly states this — HIGH confidence; multiple Stack Overflow threads corroborate.

**Warning signs:**
- PPTX opens with blank image placeholders
- `toBase64Image()` returns `'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='` (1x1 transparent pixel)

**Phase to address:** PPTX export — chart capture step

---

### Pitfall A-5: `addImage()` data: String Format Is Not Standard Data URI

**What goes wrong:**
`chart.toBase64Image()` returns a standard data URI: `'data:image/png;base64,...'`. PptxGenJS `addImage({ data: ... })` expects the format `'image/png;base64,...'` — without the `data:` prefix. Passing the standard data URI with the `data:` prefix causes the image to fail silently (blank in PowerPoint) or produces a corrupted file.

**Why it happens:**
The standard Web API format for data URIs is `data:MIME;base64,DATA`. PptxGenJS strips the prefix internally in some versions but not others, and the official documentation example shows the non-prefixed format. The two formats look almost identical at a glance.

**How to avoid:**
Strip the `data:` prefix before passing to `addImage()`:

```typescript
const rawDataUrl = chartRef.value!.chart!.toBase64Image('image/png', 1)
// toBase64Image returns 'data:image/png;base64,...'
// PptxGenJS expects 'image/png;base64,...'
const pptxImageData = rawDataUrl.replace(/^data:/, '')

slide.addImage({
  data: pptxImageData,
  x: 0.5, y: 1.5, w: 8.5, h: 4.0
})
```

**Sources:** PptxGenJS source gen-objects.ts — error message confirms expected format `'image/png;base64,NMP[...]'`; official docs example shows same format — HIGH confidence.

**Warning signs:**
- Chart images show as blank or X placeholders in the exported PPTX
- No JavaScript error thrown (fails silently)

**Phase to address:** PPTX export — chart capture step

---

### Pitfall A-6: PptxGenJS Default Slide Layout Is 10×5.625 in (16:9) — Not Widescreen

**What goes wrong:**
`LAYOUT_16x9` (the default, 10×5.625 in) and `LAYOUT_WIDE` (13.3×7.5 in) are both 16:9 but different physical sizes. If slide content is designed at 10 in wide and the layout is accidentally changed to `LAYOUT_WIDE`, all positioned elements (text boxes, images, shapes) appear cramped in the left 75% of the slide.

**Why it happens:**
PptxGenJS uses `LAYOUT_16x9` by default (not `LAYOUT_WIDE`). Developers may see "Widescreen (13.3 × 7.5 in)" in PowerPoint's own templates and assume `LAYOUT_WIDE` is the correct 16:9 choice.

**How to avoid:**
Pick one layout at the start of the project and design all x/y/w/h coordinates for that layout. For VCF Sizer: use `LAYOUT_16x9` (10×5.625 in) as the baseline. All position constants should be documented with their assumption:

```typescript
// All positions assume LAYOUT_16x9 (10 × 5.625 in)
pptx.layout = 'LAYOUT_16x9'
```

For reference: `LAYOUT_WIDE` is 13.3×7.5 in — 33% wider than `LAYOUT_16x9`. Never mix coordinates designed for different layouts.

**Sources:** PptxGenJS official layout docs — HIGH confidence.

**Warning signs:**
- Slide content appears left-aligned with large dead space on the right
- Text boxes extend beyond slide boundary after a layout constant change

**Phase to address:** PPTX slide template/master setup (first task of PPTX phase)

---

### Pitfall A-7: Font Embedding Is Not Natively Supported — Custom Fonts Fall Back Silently

**What goes wrong:**
Setting `pptx.theme = { headFontFace: 'VMware Cloud Font', bodyFontFace: 'VMware Cloud Font' }` does NOT embed the font into the PPTX file. The font reference is written into the XML, but the binary font data is not bundled. When the recipient opens the file on a machine without that font installed, PowerPoint silently substitutes Calibri or Times New Roman.

**Why it happens:**
PptxGenJS `headFontFace` and `bodyFontFace` only set the theme font name reference in the Office Open XML manifest. Font binary embedding requires an additional step that the library does not support natively (as of v4.0.1).

**How to avoid:**
Use only system-safe fonts that are universally available in PowerPoint (Calibri, Arial, Helvetica, Verdana). For branded output, choose a Microsoft Office default font that approximates the brand guidelines:

```typescript
pptx.theme = {
  headFontFace: 'Calibri Light',   // safe — ships with Office
  bodyFontFace: 'Calibri',         // safe — ships with Office
}
```

If a custom font is strictly required, use `pptx-embed-fonts` (third-party extension). Load TTF as ArrayBuffer, register with pptxgenjs. Note: this is an additional 10–100 kB per font face in the download.

**Sources:** GitHub issue #1378 (open, March 2025); GitHub issue #176 — MEDIUM confidence (open issues, no official fix confirmed).

**Warning signs:**
- Exported PPTX looks correct on the developer's machine (font installed) but wrong on the client's machine
- No error thrown during generation

**Phase to address:** PPTX branding/template setup — document the font constraint in code comments

---

### Pitfall A-8: Tailwind v4 `print:hidden` May Not Override Inline-Display Utilities

**What goes wrong:**
`<nav class="flex print:hidden">` may remain visible in print output in Tailwind v4. The `print:hidden` utility generates `@media print { display: none }`, but Tailwind v4 changed class ordering to alphabetical, so `.flex` now appears after `.hidden` in the generated CSS file. The `flex` rule wins specificity because it appears later in source order.

**Why it happens:**
Tailwind v3 placed `hidden` last in the generated stylesheet, giving it guaranteed precedence. Tailwind v4 switched to alphabetical ordering (GitHub issue #16586, February 2025). This means `block hidden` still works (`b` < `h`) but `flex hidden` and `inline-flex hidden` are broken.

**How to avoid:**
Do not rely on `print:hidden` to override display utilities set on the same element. Instead:

1. Use the `hidden` HTML attribute for elements that should be hidden on print (applies at element level, not CSS level)
2. Or write raw `@media print` CSS in `print.css` with `!important`:

```css
@media print {
  nav,
  .export-panel,
  .input-form,
  [data-no-print] {
    display: none !important;
  }
}
```

3. Or wrap in a structural element: `<div class="print:hidden"><nav class="flex">...</nav></div>`

**Sources:** GitHub issue #16586 (Tailwind CSS, February 2025, confirmed bug) — HIGH confidence; issue #15884 (duplicate) — HIGH confidence.

**Warning signs:**
- Navigation bar visible in print preview
- Input forms appear in PDF output
- `print:hidden` on `flex` containers has no visible effect in browser print dialog

**Phase to address:** Print CSS implementation task

---

### Pitfall A-9: `break-before-page` / `break-inside-avoid` Fails Inside Flex Containers

**What goes wrong:**
Tailwind's `break-before-page` utility generates `break-before: page`, which is a CSS fragmentation property. This property is ignored inside `display: flex` or `display: grid` containers — it only works in block formatting contexts. Report sections wrapped in flex containers will not produce page breaks regardless of the `break-before-page` class applied.

**Why it happens:**
CSS fragmentation (`break-before`, `break-after`, `break-inside`) is only honored in block layout. Flex and Grid containers create their own formatting context where the `break-*` properties apply only to the flex/grid items at the outermost level — inner break hints are ignored.

GitHub discussion #7973 (tailwindlabs) documents: "I was utilizing those inside of a flex column" as the cause of `break-before-page` not working.

**How to avoid:**
Structure the print report view as nested block-level elements, not flex columns:

```html
<!-- Report wrapper: block, not flex -->
<div class="print-report">

  <!-- Each section is a block-level div -->
  <div class="report-section break-before-page">
    <h2>Compute Results</h2>
    <!-- content -->
  </div>

  <div class="report-section break-before-page">
    <h2>Storage Results</h2>
    <!-- content -->
  </div>

</div>
```

Apply `display: block` to the print container via `@media print { .print-report { display: block; } }` if the normal layout uses flex.

**Sources:** Tailwind CSS GitHub discussion #7973 — MEDIUM confidence (community confirmed, aligns with CSS spec behavior).

**Warning signs:**
- Print preview shows all report sections on a single page despite `break-before-page` classes
- No page breaks appear even with `@page { size: A4 }` set

**Phase to address:** Print CSS layout task — report view structure

---

### Pitfall A-10: `@page` Rules Cannot Be Expressed with Tailwind Utility Classes

**What goes wrong:**
There are no Tailwind v4 utility classes for `@page { size: A4; margin: 2cm; }`. Developers may search for `page-size-a4` or `print-margin-2cm` utilities and assume the feature doesn't work when they can't find them.

**Why it happens:**
Tailwind generates regular CSS rules for HTML elements. `@page` is an at-rule targeting the printed page context — not an element selector — and falls outside Tailwind's utility model entirely.

**How to avoid:**
Write `@page` rules in a dedicated `print.css` file imported in `main.ts` or `App.vue`. Tailwind utility classes and raw CSS coexist without conflict:

```css
/* src/assets/print.css */
@page {
  size: A4 portrait;
  margin: 2cm 1.5cm;
}

@page :first {
  margin-top: 3cm;
}
```

Then use Tailwind utilities (`break-before-page`, `break-inside-avoid`) for element-level fragmentation control.

**Sources:** Tailwind CSS v4 docs — verified absence of `@page` utilities; CSS spec confirms `@page` is a separate at-rule — HIGH confidence.

**Warning signs:**
- Printed pages have browser-default margins (no control over margins)
- Page size defaults to letter instead of A4

**Phase to address:** Print CSS implementation — create `print.css` at project start

---

### Pitfall A-11: PPTX Export Breaks CALC-01 (Engine Purity) If Import Resolves Via Vue Component

**What goes wrong:**
If `usePptxExport.ts` is placed in `src/composables/` and imports from a Vue component to read chart image data (e.g., `import { chartRef } from '../components/ComputeChart.vue'`), the export composable gains a transitive Vue import. If the chart ref is later passed to the engine-layer `generatePptx()` function, the engine layer receives a Vue reactive object, violating CALC-01.

**Why it happens:**
Chart images require a reference to the mounted Chart.js instance (`chartRef.value.chart`). The natural location for this reference is the Vue component that renders the chart. Without careful design, the export function either imports from Vue components or accepts reactive refs as parameters.

**How to avoid:**
Extract chart image data in the Vue component layer (composable or component), then pass the resulting plain string (base64 data URL) to the engine layer. The engine function receives only plain TypeScript types:

```typescript
// src/engine/exportPptx.ts  (CALC-01 zone — no Vue imports)
export async function buildPptxPresentation(
  state: SizingState,
  chartImages: {
    compute: string   // 'image/png;base64,...'
    storage: string
  }
): Promise<void> {
  const pptxgen = (await import('pptxgenjs')).default
  // ... pure TS logic
}
```

```typescript
// src/composables/usePptxExport.ts  (Vue zone — allowed to use refs)
import { useComputeChartRef } from './useComputeChart'
import { buildPptxPresentation } from '../engine/exportPptx'

export function usePptxExport() {
  const chartRef = useComputeChartRef()

  const generate = async (state: SizingState) => {
    const computeImage = chartRef.value?.chart
      ?.toBase64Image('image/png', 1)
      ?.replace(/^data:/, '') ?? ''

    await buildPptxPresentation(state, { compute: computeImage, storage: '' })
  }
  return { generate }
}
```

**Sources:** Project architectural constraint CALC-01 (PROJECT.md) — HIGH confidence (established pattern).

**Warning signs:**
- TypeScript import chain from `src/engine/` resolves to `vue` in the module graph
- Vitest unit tests for export engine require `createApp()` or Vue test utils to run

**Phase to address:** PPTX export architecture design — before writing any code

---

## Moderate Pitfalls

### Pitfall B-1: Markdown Export Omits Conditional Sections Silently

**What goes wrong:**
The Markdown export function produces a complete-looking report that is missing stretch, vSAN Max, AI/GPU, NVMe, or validation warning sections. The output appears valid but omits significant portions of the sizing configuration. Users who paste the Markdown into a ticket or document miss critical configuration context.

**Why it happens:**
The existing export builds sections without checking whether optional features are enabled. When a new optional feature is added (e.g., vSAN Max in v2.0), the export function is not updated because it has no failing test — the output is still valid Markdown, just incomplete. There is no "test for completeness" in the test suite.

**How to avoid:**
Guard each optional section with an explicit feature check inside the export function:

```typescript
if (state.deployment === 'stretch') {
  sections.push(buildStretchSection(state.stretch))
}
if (state.storage.type === 'vsan-max') {
  sections.push(buildVsanMaxSection(state.vsanMax))
}
if (state.aiGpu.enabled) {
  sections.push(buildAiGpuSection(state.aiGpu))
}
if (state.nvmeMemTiering.enabled) {
  sections.push(buildNvmeSection(state.nvmeMemTiering))
}
if (state.validationWarnings.length > 0) {
  sections.push(buildWarningsSection(state.validationWarnings))
}
```

Write a Vitest test for each conditional section that asserts the section is present when the flag is `true` and absent when `false`:

```typescript
it('includes stretch section when deployment is stretch', () => {
  const md = buildMarkdownReport({ ...baseState, deployment: 'stretch' })
  expect(md).toContain('## Stretch Cluster')
})
it('omits stretch section when deployment is not stretch', () => {
  const md = buildMarkdownReport({ ...baseState, deployment: 'ha' })
  expect(md).not.toContain('## Stretch Cluster')
})
```

**Warning signs:**
- Exported Markdown for a stretch configuration has no cross-site bandwidth section
- vSAN Max report only shows compute results
- AI/GPU inputs not reflected in the downloaded file

**Phase to address:** Markdown enrichment task — before completing the feature

---

### Pitfall B-2: Vite Dynamic Import of PptxGenJS Fails in Dev Server With Some Node Built-In Stubs

**What goes wrong:**
In Vite development mode (`vite dev`), dynamic `import('pptxgenjs')` may produce 504 Gateway Timeout errors or `Failed to resolve entry for package "https"` errors. The issue is specific to Vite's pre-bundling of CommonJS packages that reference Node.js built-ins.

**Why it happens:**
PptxGenJS v3.x and older had a hardcoded `require('https')` in the CJS build. Vite's pre-bundler (esbuild) resolves this to the `node:https` built-in, which is not available in the browser context. v4.0.0 fixed this with "brand new logic for detecting Node.js" — but only when Vite selects the ESM build via the `exports` field.

**How to avoid:**
Use pptxgenjs v4.0.1 (the current version as of the v2.1 research). Vite 8 selects the ESM build automatically via the `exports` field in pptxgenjs's `package.json`. If dev-server errors still appear after installing v4.0.1:

1. Clear Vite's dependency cache: `rm -rf node_modules/.vite`
2. Restart dev server
3. If still failing, add to `vite.config.ts`:

```typescript
export default defineConfig({
  optimizeDeps: {
    include: ['pptxgenjs'],  // force pre-bundle the ESM build
  }
})
```

Note: The pre-bundle error is a dev-server-only issue. Production `vite build` creates a proper async chunk and is unaffected.

**Sources:** GitHub discussion vitejs/vite #7873 (root cause documented); pptxgenjs v4.0.0 release notes ("Brand new logic for detecting Node.js, fixes Vite issues #1325") — HIGH confidence.

**Warning signs:**
- Browser console shows 504 on `pptxgenjs` chunk request in dev
- `Failed to resolve entry for package "https"` in terminal
- Export button works in production build but not in dev

**Phase to address:** PPTX export setup — verify in dev server immediately after `npm install pptxgenjs`

---

### Pitfall B-3: `print:` Variant on Tailwind v4 — Built-In vs. Needs Declaration

**What goes wrong:**
In Tailwind v3, `print:` was NOT a built-in variant — it required adding a custom screen definition to `tailwind.config.js`. Developers migrating from v3 patterns or following old documentation attempt to add `print` as a custom screen in v4 and get configuration errors because v4 uses a CSS-first config with no `tailwind.config.js`.

**Why it happens:**
Tailwind v4 ships `print:` as a built-in media query variant. No configuration is needed. Stale v3 tutorials instruct developers to add `screens: { print: { raw: 'print' } }` — this causes errors in v4's `@theme` config block.

**How to avoid:**
Use `print:` utility classes directly in Tailwind v4 — no configuration required:

```html
<!-- Works in Tailwind v4 without any configuration -->
<nav class="print:hidden">...</nav>
<div class="print:block hidden">...</div>
<h2 class="break-after-avoid">Section Header</h2>
<section class="break-before-page">...</section>
```

Do NOT attempt to declare `print` in `@theme` or `@custom-variant` — it is already registered.

**Sources:** Stack Overflow question #79431803 — "you don't need the print one as it is built in to v4 already"; Tailwind v4 upgrade guide confirms `@custom-variant` is the mechanism for custom variants — MEDIUM confidence (community-verified, official confirmation indirect).

**Warning signs:**
- CSS compilation error mentioning `print` screen variant redefinition
- `@theme { --breakpoint-print: ... }` produces no output

**Phase to address:** Print CSS implementation — note in first CSS comment that `print:` is built-in

---

### Pitfall B-4: `canvas` Element Renders Blank in Print When Inside Hidden or Overflow-Clipped Container

**What goes wrong:**
Charts inside containers that are hidden during screen view but shown for print (via `print:block` or `display: block` in `@media print`) may render as blank white rectangles. The canvas pixel buffer was never populated because the element was not visible during the rendering lifecycle.

**Why it happens:**
HTML5 canvas is rasterized by the browser at the time the JavaScript draws to it. If the container is `display: none` or `visibility: hidden` at the time Chart.js renders (on component mount), the canvas has zero dimensions and no pixel data. Switching to `display: block` in `@media print` gives the canvas a layout but does not re-execute the Chart.js rendering code.

**How to avoid:**
Do not hide chart containers with `display: none` during normal view if you intend to print them. Use `visibility: hidden` or `opacity: 0` instead (these preserve layout and allow canvas rendering). For print-only charts, render them off-screen in a fixed position element:

```css
@media screen {
  .print-only-chart {
    position: absolute;
    left: -9999px;
    width: 600px;   /* must have explicit dimensions */
    height: 300px;
  }
}
@media print {
  .print-only-chart {
    position: static;
    width: 100%;
    height: auto;
  }
}
```

For the VCF Sizer, the existing charts are already visible on screen — this pitfall applies only if separate print-specific chart instances are introduced.

**Sources:** Multiple Stack Overflow answers confirming canvas blank-print behavior; vue-chartjs documentation notes on canvas rendering — MEDIUM confidence.

**Warning signs:**
- PDF/print shows chart container area but no chart content
- Chart renders correctly on screen but is blank in print preview

**Phase to address:** Print CSS implementation — review chart container visibility rules

---

### Pitfall B-5: Large PptxGenJS Chunk Delays Export on First Click If Dynamic Import Is Forgotten

**What goes wrong:**
If `import pptxgenjs from 'pptxgenjs'` is placed at the top of `usePptxExport.ts` as a static import, Vite includes it in the main bundle. PptxGenJS's ESM build is ~2.5 MB unpacked (~400–600 kB gzip). This increases the initial bundle from the current 159 kB gzip to potentially 600+ kB gzip, adding 2–4 seconds to page load on mobile/3G — a direct contradiction of the project's static hosting goal.

**Why it happens:**
Static imports are the default pattern. Dynamic import requires remembering an extra step. The export feature is not used on every page load, so its cost should be deferred.

**How to avoid:**
Always use dynamic import for pptxgenjs:

```typescript
// WRONG — adds ~400 kB to initial bundle
import pptxgen from 'pptxgenjs'

// CORRECT — Vite creates a separate async chunk
const pptxgen = (await import('pptxgenjs')).default
```

Verify with `vite build --report` or `npx vite-bundle-visualizer` that pptxgenjs appears as a separate chunk named `pptxgenjs-[hash].js` (not in the main `index-[hash].js` chunk).

**Sources:** Vite code splitting documentation; npm registry (pptxgenjs unpacked size 2,544 kB) — HIGH confidence.

**Warning signs:**
- `vite build` output shows main chunk increased by 300–600 kB
- PageSpeed Insights score drops significantly after adding PPTX export
- Network tab shows `pptxgenjs` in the initial page load waterfall

**Phase to address:** PPTX export implementation — verify bundle analysis after first working export

---

## Minor Pitfalls

### Pitfall C-1: Unicode Bullet Characters in `addText()` Produce Double Bullets

**What goes wrong:**
`slide.addText('• First item', { bullet: true })` produces a slide with two bullets: the unicode `•` character AND the PPTX-native bullet from the `bullet: true` option.

**How to avoid:**
Never embed unicode bullet characters in text strings passed to `addText()`. Use only the `bullet: true` option or a `bullet: { type: 'bullet' }` object:

```typescript
// WRONG
slide.addText('• First item', { bullet: true })

// CORRECT
slide.addText([
  { text: 'First item', options: { bullet: true, breakLine: true } },
  { text: 'Second item', options: { bullet: true, breakLine: true } },
])
```

**Source:** Anthropic skills/pptx/pptxgenjs.md — HIGH confidence.

**Phase to address:** PPTX slide content implementation

---

### Pitfall C-2: `addImage()` With Explicit `w`/`h` Does Not Preserve Aspect Ratio Automatically

**What goes wrong:**
An open bug (pptxgenjs issue #1351, April 2025, still unresolved) causes base64 images with explicit width/height dimensions to be distorted into a 16:9 ratio when using `sizing: { type: 'contain' }`. Chart images captured from `toBase64Image()` are typically wider-than-tall (matching the chart canvas aspect ratio) and may appear stretched.

**How to avoid:**
For chart images, calculate the correct `w` and `h` values based on the canvas pixel dimensions and the desired slide inches:

```typescript
const canvas = chartRef.value?.chart?.canvas
if (canvas) {
  const aspectRatio = canvas.width / canvas.height
  const slideWidth = 8.5   // inches available
  const slideHeight = slideWidth / aspectRatio
  slide.addImage({
    data: imageData,
    x: 0.75, y: 1.5,
    w: slideWidth,
    h: slideHeight,
    // Do NOT use sizing: { type: 'contain' } — it triggers the bug
  })
}
```

**Source:** GitHub issue #1351 (pptxgenjs, September 2024, open) — MEDIUM confidence (bug confirmed, workaround untested in v4.0.1).

**Phase to address:** PPTX chart slide implementation

---

### Pitfall C-3: `h2`/`h3` Elements Not Using `break-after: avoid` Cause Orphaned Headings

**What goes wrong:**
A section heading `h2` appears at the bottom of a printed page with the section content on the next page (orphaned heading). This is the most common print layout issue in document-style web pages.

**How to avoid:**
Add `break-after-avoid` to all headings in print context:

```css
@media print {
  h2, h3 {
    break-after: avoid;
  }
}
```

Or use Tailwind's utility on the elements: `<h2 class="break-after-avoid">`.

**Source:** CSS fragmentation spec; print-css.rocks — HIGH confidence (established CSS print pattern).

**Phase to address:** Print CSS implementation

---

### Pitfall C-4: `writeFile()` Does Not Return a Download Confirmation — Use Promise Resolution

**What goes wrong:**
Developers call `await pptx.writeFile({ fileName: 'report.pptx' })` and immediately show a success toast, but in Firefox the file download dialog requires user action. The Promise resolves when the blob is prepared (not when the user saves the file). On slow machines the blob preparation takes 200–800 ms; calling `writeFile()` without `await` dismisses the loading indicator prematurely.

**How to avoid:**
Always `await` the `writeFile()` call and show loading state before it:

```typescript
const isExporting = ref(false)

const exportPptx = async () => {
  isExporting.value = true
  try {
    await buildPptxPresentation(state, chartImages)
  } finally {
    isExporting.value = false
  }
}
```

**Source:** PptxGenJS API (writeFile returns Promise) — HIGH confidence.

**Phase to address:** PPTX export UI component

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode slide colors as inline strings | Faster to write | Inconsistent branding, hard to rebrand | Never — use a `pptxColors.ts` constants file |
| Call `toBase64Image()` synchronously without animation check | Simple code | Blank chart images intermittently | Never — set `animation: false` or await `onComplete` |
| Static import of pptxgenjs | Simpler code | +400 kB initial bundle | Never in this project — dynamic import is required |
| Write Markdown export without conditional guards | Less boilerplate | Silent data loss for optional features | Never — every optional feature needs an `if` guard |
| Use `print:hidden` on flex elements | Familiar pattern | Elements visible in print in Tailwind v4 | Never — use `@media print { display: none !important }` |
| Reuse pptxgen option objects across calls | Avoids repetition | EMU mutation corrupts second+ slides | Never — use factory functions |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| pptxgenjs + Vite | Static top-level import | Dynamic `(await import('pptxgenjs')).default` |
| Chart.js + pptxgenjs | Pass standard `data:image/png;base64,...` URI | Strip `data:` prefix before `addImage()` |
| Chart.js + `toBase64Image()` | Call synchronously after mount | Disable animation: `{ animation: false }` in chart options |
| Tailwind v4 + print | Declare `print` as custom screen | Use built-in `print:` variant — no config needed |
| `@page` + Tailwind | Look for Tailwind utility class | Write raw `@page {}` in `print.css` |
| Markdown + optional features | Write single template | Guard each optional section with feature flag check |
| pptxgenjs + instance lifecycle | Module-scope `new pptxgen()` | Construct inside export function on every call |
| pptxgenjs + custom fonts | Use `headFontFace` with brand font | Use Office-safe fonts (Calibri, Arial); no binary embedding |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Static pptxgenjs import | 400+ kB added to initial bundle | Dynamic import, verify with bundle analyzer | Immediately on any page load |
| Synchronous chart capture without animation: false | Intermittent blank exports | Disable Chart.js animation or await onComplete | When animation duration > 0 (default 1000 ms) |
| Multiple chart captures without canvas size limit check | Large base64 strings in PPTX | Limit canvas to reasonable pixel dimensions (e.g., 1200×600) | Charts wider than 2048 px on high-DPI displays |

---

## "Looks Done But Isn't" Checklist

- [ ] **PPTX export:** Every `slide.addText()` and `slide.addImage()` call uses a fresh options object (not a shared const) — verify by exporting twice and checking slide count
- [ ] **PPTX export:** Color strings contain no `#` prefix — `grep -r '"#' src/engine/exportPptx.ts` should return nothing
- [ ] **PPTX export:** `new pptxgen()` is inside the export function, not at module scope — check with `grep -n 'new pptxgen' src/`
- [ ] **PPTX export:** `pptxgenjs` is NOT in the main chunk — verify with `npx vite-bundle-visualizer` or check build output
- [ ] **Chart export:** `animation: false` is set in chart options used for export, or capture uses `onComplete` callback
- [ ] **Chart export:** `data:` prefix stripped from `toBase64Image()` result before `addImage()`
- [ ] **Print CSS:** `@page { size: A4; }` is defined in `print.css` (not a Tailwind utility class)
- [ ] **Print CSS:** All nav/form/button elements use `@media print { display: none !important }` (not just `print:hidden` on flex elements)
- [ ] **Print CSS:** Report section containers are block-level (not flex) to enable `break-before-page`
- [ ] **Markdown:** Stretch section present when `state.deployment === 'stretch'` — Vitest assertion
- [ ] **Markdown:** vSAN Max section present when `state.storage.type === 'vsan-max'` — Vitest assertion
- [ ] **Markdown:** AI/GPU section present when `state.aiGpu.enabled === true` — Vitest assertion
- [ ] **Markdown:** Validation warnings section present when `state.validationWarnings.length > 0` — Vitest assertion
- [ ] **Engine purity:** `src/engine/exportPptx.ts` has zero imports from `vue` — `grep -n "from 'vue'" src/engine/exportPptx.ts` returns nothing

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| A-1: Instance reuse | PPTX composable implementation | Export twice — check slide count is not doubled |
| A-2: Option object mutation | PPTX slide layout | Export twice with same data — confirm identical output |
| A-3: Hex color `#` prefix | PPTX branding/template setup | `grep -r '"#' src/engine/exportPptx.ts` returns empty |
| A-4: `toBase64Image()` blank | PPTX chart capture | PPTX opens with visible charts |
| A-5: `data:` prefix in `addImage()` | PPTX chart capture | PPTX chart images visible in PowerPoint |
| A-6: Layout size mismatch | PPTX template setup (first task) | All slide elements within bounds |
| A-7: Font not embedded | PPTX branding setup | Test on machine without custom fonts installed |
| A-8: `print:hidden` on flex | Print CSS implementation | Print preview — nav/forms invisible |
| A-9: Break-* in flex containers | Print CSS report structure | Print preview — each section on its own page |
| A-10: `@page` not in Tailwind | Print CSS implementation | Printed output has A4 dimensions and 2 cm margins |
| A-11: CALC-01 violation in export | Architecture design (before coding) | `grep "from 'vue'" src/engine/exportPptx.ts` returns empty |
| B-1: Markdown missing sections | Markdown enrichment task | Vitest conditional section tests |
| B-2: Dev server 504 on pptxgenjs | PPTX setup — dev verification | Export works in `vite dev` mode |
| B-3: print: variant confusion | Print CSS implementation | No config errors, `print:hidden` works |
| B-4: Canvas blank in hidden container | Print CSS — chart visibility | Print preview shows chart content |
| B-5: pptxgenjs in main bundle | PPTX implementation | Bundle analyzer shows separate pptxgenjs chunk |

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| A-1: Instance reuse | LOW | Move `new pptxgen()` inside export function; re-test |
| A-2: Option mutation | MEDIUM | Refactor all option objects to factory functions; visual review all slides |
| A-3: Color prefix | LOW | Global find-replace `"#` → `"` in pptx colors; re-export and check all slides |
| A-4: Blank chart | LOW | Add `animation: false` to chart options; re-export |
| A-5: `data:` prefix | LOW | Add `.replace(/^data:/, '')` to image capture; re-test |
| A-7: Font not embedded | MEDIUM | Switch to Calibri or add pptx-embed-fonts; update all font references |
| A-8: `print:hidden` flex | LOW | Replace `print:hidden` with `@media print { display: none !important }` |
| A-9: Break in flex | MEDIUM | Restructure report containers as block-level; re-test page breaks |
| A-11: CALC-01 violation | MEDIUM | Extract Vue-layer code to composable, pass plain data to engine |
| B-1: Missing Markdown sections | LOW | Add conditional guards per section; add Vitest assertions |
| B-5: Bundle bloat | LOW | Change to dynamic import; verify with bundle analyzer |

---

## Sources

- PptxGenJS official docs: https://gitbrent.github.io/PptxGenJS/docs/ — HIGH confidence
- PptxGenJS release notes v4.0.0 / v4.0.1: https://github.com/gitbrent/PptxGenJS/releases — HIGH confidence
- PptxGenJS saving guide (instance lifecycle warning): https://gitbrent.github.io/PptxGenJS/docs/usage-saving/ — HIGH confidence
- PptxGenJS images API (data: format): https://gitbrent.github.io/PptxGenJS/docs/api-images/ — HIGH confidence
- PptxGenJS skills reference (option mutation, color format): https://github.com/anthropics/skills/blob/main/skills/pptx/pptxgenjs.md — HIGH confidence
- Vite discussion #7873 (pptxgenjs CJS 504 issue): https://github.com/vitejs/vite/discussions/7873 — HIGH confidence (documents v3.x root cause; v4.0.0 fix confirmed in release notes)
- Chart.js API (toBase64Image): https://www.chartjs.org/docs/latest/developers/api.html — HIGH confidence
- QuickChart export guide (animation timing): https://quickchart.io/documentation/chart-js/image-export/ — MEDIUM confidence
- Chart.js GitHub discussion #10986 (blank pages in print): confirmed Chart.js 4.x unaffected — HIGH confidence
- Tailwind CSS v4 break-before/after/inside docs: https://tailwindcss.com/docs/break-before — HIGH confidence
- Tailwind CSS GitHub issue #16586 (hidden vs flex ordering in v4): https://github.com/tailwindlabs/tailwindcss/issues/16586 — HIGH confidence
- Tailwind CSS GitHub discussion #7973 (break-before inside flex): https://github.com/tailwindlabs/tailwindcss/discussions/7973 — MEDIUM confidence
- PptxGenJS GitHub issue #1351 (base64 image aspect ratio bug, open): https://github.com/gitbrent/PptxGenJS/issues/1351 — MEDIUM confidence
- PptxGenJS GitHub issue #1378 (font embedding, open): https://github.com/gitbrent/PptxGenJS/issues/1378 — MEDIUM confidence
- Stack Overflow (print: variant built-in in v4): https://stackoverflow.com/questions/79431803 — MEDIUM confidence

---
*Pitfalls research for: VCF Sizer v2.1 Export Quality (PPTX, Print/PDF, Markdown)*
*Researched: 2026-03-29*

---

## Preserved: v2.0 Milestone Pitfalls (Unchanged)

The following pitfalls were written for the v2.0 milestone and remain valid for the active codebase.

### Pitfall 11: Adding `vsan-max` to the `storageType` Enum Breaks All Exhaustiveness Guards

**What goes wrong:**
The current `StorageType` union in `engine/types.ts` is `'vsan-esa' | 'fc' | 'nfs'`. The Zod schema in `useUrlState.ts` uses `z.enum(['vsan-esa', 'fc', 'nfs'])`. The `calcStorage` function in `storage.ts` branches on `storageType` with an `if/else` tree.

When `'vsan-max'` is added to the union, TypeScript's exhaustiveness checker will silently not fire on the `if/else` tree in `calcStorage` (only a `switch` with a `never` bottom case catches missed variants). Additionally, the Zod enum in `useUrlState.ts` will need to be updated or the field will fail validation and silently revert to the default.

**Prevention:**
1. Add a `storageType` enum to `engine/types.ts` and import from there (single source of truth)
2. Convert the `if/else` tree in `calcStorage` to `switch` with an exhaustive `never` case
3. Update the Zod schema to include `'vsan-max'` atomically with the union update
4. Add a test: `expect(calcStorage({ ...baseState, storageType: 'vsan-max' }))` to catch the gap before implementation

**Phase to address:** Phase 1 of v2.0 (storage type expansion)
