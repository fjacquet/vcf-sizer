# Phase 7: Print/PDF CSS Overhaul - Research

**Researched:** 2026-03-30
**Domain:** CSS Print Stylesheets, Tailwind CSS v4 print variants, @page rules, CSS fragmentation
**Confidence:** HIGH

---

## Summary

Phase 7 is a pure-CSS task — zero JavaScript changes are needed. The existing `window.print()` call in `ExportToolbar.vue` is unchanged. All work goes into `src/style.css` (global @page and @media print rules) and individual component templates (Tailwind `print:` variant classes and chart fallback tables).

The project already has `@custom-variant print (@media print);` in `src/style.css`. This is redundant because `print:` is a **built-in** Tailwind v4 variant, but it is harmless and should be left as-is to avoid noise. The critical finding is that `print:hidden`, `print:block`, `break-inside-avoid`, and `break-before-page` are all available and work in production builds (see Safari caveat below).

The most complex requirement is PRINT-04/PRINT-05 (running header/footer on every page). CSS `@page` margin-box support (`@top-center`, `@bottom-center`) landed in Chrome 131 and is the modern standard, but the fallback approach (fixed-position elements with matching `@page` body margins) achieves reliable cross-browser coverage including Firefox and Safari.

**Primary recommendation:** Use `@page` margin boxes for header/footer (Chrome 131+ native, 2024+), with a `position: fixed` fallback for Firefox/Safari. Apply Tailwind `print:` classes for visibility control and `break-inside-avoid` / `break-before-page` for fragmentation. Each chart component needs a co-located `<table>` sibling that is `hidden print:block`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase. The following locked decisions come from STATE.md decisions log and REQUIREMENTS.md.

### Locked Decisions
- Print/PDF is pure CSS — zero JavaScript changes required; `window.print()` call in `ExportToolbar.vue` unchanged
- No jsPDF, no html2canvas — rejected: bundle cost and output quality disqualify both
- Server-side PDF rendering — out of scope; project is client-only; no backend permitted
- Chart.js canvas elements must be hidden in print mode; a plain data table shown as fallback

### Claude's Discretion
- CSS approach to running headers/footers (margin boxes vs. fixed position)
- Exact `@page` margin values and paper size declaration
- Table structure for chart data fallback (specific column/row layout)
- New i18n keys for print header/footer text

### Deferred Ideas (OUT OF SCOPE)
- Dark mode print stylesheet
- Localized Markdown and PPTX exports
- In-app Markdown preview panel
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRINT-01 | Input panel hidden in print mode via Tailwind `print:hidden` | Built-in `print:` variant; App.vue already has `print:hidden` on header and input pane |
| PRINT-02 | Page margins and paper size via CSS `@page` rule in `style.css` | `@page { size: A4; margin: 20mm; }` in global CSS; physical units (mm/in) required |
| PRINT-03 | Result cards avoid mid-card breaks (`break-inside-avoid`) | Tailwind `break-inside-avoid` class confirmed; maps to `break-inside: avoid` |
| PRINT-04 | Printed pages include running header with report title and date | `@page @top-center` margin box (Chrome 131+) + `position: fixed` fallback technique |
| PRINT-05 | Printed pages include footer with VCF Sizer attribution | `@page @bottom-center` margin box + `position: fixed` fallback technique |
| PRINT-06 | Chart.js canvas elements hidden; plain data table shown as fallback | `print:hidden` on chart wrapper + `hidden print:block` on sibling `<table>` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.2.2 (installed) | `print:` variant classes | Built-in `print:` variant; no config needed |
| CSS @page | Browser-native | Page margins, size, orientation | W3C spec; supported in all major browsers for margin/size |
| CSS Fragmentation | Browser-native | `break-inside`, `break-before` | Widely supported in Chrome, Firefox, Edge, Safari |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vue-i18n (already installed) | 11.3.0 | i18n keys for header/footer text | For print header title, footer attribution text |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@page` margin boxes | `position: fixed` elements | Fixed works in Firefox/Safari but requires `@page margin: 0` and body padding — more complex layout math |
| `break-inside-avoid` (modern) | `page-break-inside: avoid` (legacy) | Legacy form needed only for IE11; modern form preferred for all supported browsers |
| Global CSS `@media print` in style.css | Scoped `<style>` in each .vue file | `@page` rule cannot go inside `<style scoped>` — must be in global CSS |

**Installation:** No new packages required. All libraries are already installed.

**Version verification:**
```bash
# Confirmed from npm registry 2026-03-30
tailwindcss@4.2.2  (installed: ^4.2.2)
@tailwindcss/vite@4.2.2  (installed: ^4.2.2)
```

---

## Architecture Patterns

### Recommended Project Structure Changes
```
src/
├── style.css                          # ADD: @page rule, @media print global rules
├── components/
│   └── results/
│       ├── charts/
│       │   ├── CoresChart.vue         # ADD: print:hidden wrapper + <table> sibling
│       │   ├── RamChart.vue           # ADD: print:hidden wrapper + <table> sibling
│       │   └── StorageChart.vue       # ADD: print:hidden wrapper + <table> sibling
│       ├── HostCountCard.vue          # ADD: break-inside-avoid, break-before-page
│       ├── VsanMaxClusterCard.vue     # ADD: break-inside-avoid, break-before-page
│       ├── StretchNetworkChecklist.vue # ADD: break-inside-avoid
│       ├── ResultsPanel.vue           # ADD: print header/footer elements
│       └── ExportToolbar.vue          # Already has print:hidden — unchanged
├── App.vue                            # Header already print:hidden; input pane already print:hidden
└── i18n/locales/
    ├── en.json                        # ADD: print.header.title, print.footer.attribution
    ├── fr.json                        # ADD: same keys (or inherit from en)
    ├── de.json                        # ADD: same keys
    └── it.json                        # ADD: same keys
```

### What is Already Done (App.vue audit)
The App.vue template already has:
- `<header ... class="... print:hidden">` — the sticky top header is already hidden for print
- `<div class="... print:hidden">` on the left input pane — inputs already hidden
- `<div class="... print:col-span-2">` on the right results pane — results already fill the full width

This means **PRINT-01 is partially done**. The results pane occupies full width on print. What remains is ensuring no residual screen-grid layout collapses the output.

### Pattern 1: Global @page Rule in style.css
**What:** Add CSS `@page` declaration and global print body styles to `src/style.css`
**When to use:** `@page` cannot be scoped — must be in a global stylesheet
**Example:**
```css
/* src/style.css */
@import "tailwindcss";

@custom-variant print (@media print);  /* already present, keep as-is */

@page {
  size: A4 portrait;
  margin: 20mm 15mm 25mm 15mm; /* top right bottom left — extra bottom for footer */
}

@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```
Source: MDN `@page` documentation; CSS Print Styles best practices verified via multiple sources.

### Pattern 2: Tailwind print: Variant for Visibility
**What:** Use `print:hidden` to hide screen-only elements and `hidden print:block` to show print-only elements
**When to use:** Any component that should differ between screen and print
**Example:**
```html
<!-- Hide the chart canvas wrapper in print -->
<div class="h-48 relative print:hidden">
  <Bar :data="chartData" :options="chartOptions" />
</div>

<!-- Show data table only in print -->
<table class="hidden print:block w-full text-sm">
  <thead>
    <tr>
      <th>Label</th>
      <th>Value</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="row in printTableRows" :key="row.label">
      <td>{{ row.label }}</td>
      <td>{{ row.value }}</td>
    </tr>
  </tbody>
</table>
```
Source: Official Tailwind CSS v4 docs `hover-focus-and-other-states` — `print:` is confirmed built-in.

### Pattern 3: CSS Fragmentation for Section Breaks
**What:** Apply `break-inside-avoid` to card wrappers and `break-before-page` to major sections
**When to use:** Each result section card (HostCountCard, VsanMaxClusterCard, chart cards, checklist)
**Example:**
```html
<!-- On each major card's root element -->
<div class="bg-white ... break-inside-avoid">
  <!-- card content -->
</div>
```
For a new page before each major section in print:
```html
<section class="... break-before-page break-inside-avoid">
```
Source: Tailwind CSS v4 official docs — `break-before-page` maps to `break-before: page`, `break-inside-avoid` maps to `break-inside: avoid`. Confirmed HIGH confidence.

### Pattern 4: Print Header/Footer — Dual-Strategy
**What:** Use CSS `@page` margin boxes for Chrome 131+; fall back to fixed-position HTML elements with `@page` body margins for Firefox/Safari.

**Recommended approach for this project:**
Use **fixed-position elements** within `ResultsPanel.vue` wrapping div, combined with `@page` body margins to prevent overlap. This achieves reliable cross-browser support without depending on Chrome 131+ margin box support.

**Why not pure `@page` margin boxes:**
- `@top-center` content in `@page` only supports simple text and CSS `content:` property — no Vue i18n interpolation possible
- Firefox 2025 support for `@page` margin boxes is partial (margin/size only per caniuse)
- The fixed-position approach supports full HTML including dynamic text from `useCalculationStore` or `Date`

**Example — HTML elements approach (recommended):**
```html
<!-- In ResultsPanel.vue, wrapping the results content -->
<div class="relative">
  <!-- Print header: visible only in print -->
  <div class="hidden print:block fixed top-0 left-0 right-0 text-xs text-gray-500 border-b border-gray-300 py-1 px-4 flex justify-between">
    <span>VCF 9.x Sizing Report</span>
    <span>{{ new Date().toLocaleDateString() }}</span>
  </div>

  <!-- Print footer: visible only in print -->
  <div class="hidden print:block fixed bottom-0 left-0 right-0 text-xs text-gray-500 border-t border-gray-300 py-1 px-4 text-center">
    Generated by VCF Sizer — vcf-sizer.github.io
  </div>

  <!-- Results content -->
  <HostCountCard />
  ...
</div>
```

**Critical: matching @page margin** — add `margin-top` and `margin-bottom` to the `@page` rule so content does not slide under the fixed header/footer:
```css
@page {
  size: A4 portrait;
  margin: 25mm 15mm 25mm 15mm; /* 25mm top/bottom to clear 15px fixed elements */
}
```
Source: Multiple verified sources including tutorialpedia.org and aaronsaray.com 2025.

### Pattern 5: Chart Print Fallback Tables
**What:** Each chart component (CoresChart, RamChart, StorageChart) needs a sibling `<table>` that only renders in print.
**When to use:** Chart canvas elements render blank in print — Chart.js draws to `<canvas>` which is not reliably transferred to print media.

**CoresChart data** (from store): `compute.totalCoresRequired`, `compute.availableCores`
**RamChart data** (from store): `compute.totalRamRequiredGB`, `compute.availableRamGB`
**StorageChart data** (from store): `storage.safeUsableCapacityTB`, `storage.lfsOverheadTB`, `storage.metadataOverheadTB`, `storage.rawCapacityTB - storage.usableAfterRaidTB` (RAID overhead)

**Example — CoresChart.vue addition:**
```html
<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ t('results.charts.cores') }}</h3>
    <!-- Screen: chart canvas -->
    <div class="h-48 relative print:hidden">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <!-- Print: data table -->
    <table class="hidden print:table w-full text-sm border-collapse">
      <thead>
        <tr class="border-b border-gray-300">
          <th class="text-left py-1">{{ t('results.charts.cores') }}</th>
          <th class="text-right py-1">{{ t('results.charts.required') }}</th>
          <th class="text-right py-1">{{ t('results.charts.available') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="py-1">{{ t('results.charts.cores') }}</td>
          <td class="text-right font-mono">{{ compute.totalCoresRequired }}</td>
          <td class="text-right font-mono">{{ compute.availableCores }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

Note: Use `print:table` not `print:block` on the `<table>` element — `display: block` on a `<table>` breaks its semantic rendering.

### Anti-Patterns to Avoid
- **Using `print:block` on a `<table>` element:** Tables need `display: table`, not `display: block`. Use `hidden print:table` instead.
- **Placing `@page` inside `<style scoped>` in a Vue component:** `@page` is a document-level rule and must be in `src/style.css` or a non-scoped stylesheet.
- **Setting `margin: 0` on `@page` without adjusting body padding:** Fixed-position header/footer will overlap content if the `@page` margin doesn't account for their height.
- **Using `break-before-page` on every card:** Only the first card of each major section should force a new page — applying it everywhere causes excessive blank pages.
- **Assuming `@page` margin boxes work in Firefox:** As of 2025, only Chrome 131+ fully supports `@top-center`/`@bottom-center` — Firefox only supports `margin` and `size` properties within `@page`.
- **Testing print styles only in dev mode:** The Safari print variant CSS nesting bug only appears in dev mode — production builds use Lightning CSS which reorders the nesting correctly. Always verify in production build.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart data tables | Custom chart-to-table renderer | Manual `<table>` with store refs | Chart data is already reactive in the component; direct store binding is trivial |
| Page breaks | Custom JavaScript page-split logic | CSS `break-inside-avoid` + `break-before-page` | CSS fragmentation is declarative; JS page-splitting is fragile and breaks on dynamic content |
| Header/footer per-page injection | JavaScript `beforeprint` event + DOM manipulation | CSS `position: fixed` + `@page` margins | CSS approach is stateless and reliable; JS beforeprint only fires once |
| PDF generation | jsPDF / html2canvas | `window.print()` → Save as PDF | Already decided and implemented; jsPDF bundle cost and output quality are disqualifying |

**Key insight:** CSS print stylesheets are declarative and do not require JavaScript. Any JS solution adds complexity, bundle size, and fragility without quality improvement for browser-native print.

---

## Common Pitfalls

### Pitfall 1: Canvas Elements Blank in Print
**What goes wrong:** Chart.js `<canvas>` elements render as empty white boxes in print output.
**Why it happens:** Canvas content is rasterized at screen resolution; print media does not re-render canvas pixel buffers the same way. Browsers differ in whether they capture the canvas bitmap.
**How to avoid:** Always wrap the `<Bar>` component in a `print:hidden` div and provide a sibling `<table class="hidden print:table">` with the same data from the store.
**Warning signs:** Print preview shows blank cards where charts should appear.

### Pitfall 2: print: Variant Not Working in Dev Mode (Safari)
**What goes wrong:** `print:hidden` classes appear not to work in Safari during `npm run dev`.
**Why it happens:** Tailwind v4 dev builds generate CSS nesting syntax that Safari 18.x does not correctly handle for `@media print`. This is a confirmed WebKit bug (WebKit/WebKit#49387, closed as COMPLETED — fix landing in Safari 18.x/26 patches).
**How to avoid:** Test print layouts using `npm run build && npm run preview` (production mode uses Lightning CSS which resolves the nesting).
**Warning signs:** `print:hidden` elements still visible in Safari print preview during `npm run dev`.

### Pitfall 3: Fixed Position Header/Footer Overlapping Content
**What goes wrong:** Fixed-position header/footer overlaps the first/last lines of content on each printed page.
**Why it happens:** `position: fixed` in print is viewport-relative; without corresponding `@page` margin, the content starts at `y=0` and slides under the fixed header.
**How to avoid:** Set `@page { margin-top: 25mm; margin-bottom: 25mm; }` to match the pixel height of the fixed header/footer (15px header ≈ 5mm; add safety margin).
**Warning signs:** First line of each page is clipped or hidden behind the header.

### Pitfall 4: break-before-page Causing Excessive Blank Pages
**What goes wrong:** Every card starts on a new page, resulting in a 10+ page document.
**Why it happens:** `break-before-page` applied to all result cards forces a page break before each.
**How to avoid:** Apply `break-before-page` only to the first card in each logical group (HostCountCard, chart group leader, VsanMaxClusterCard). Use `break-inside-avoid` (not `break-before-page`) for smaller cards.
**Warning signs:** Print preview shows many near-empty pages.

### Pitfall 5: @page Rule in Vue Scoped Style
**What goes wrong:** `@page` has no effect when placed in `<style scoped>` or `<style>` inside a Vue SFC.
**Why it happens:** `@page` is a document-level CSS at-rule; it must be in a global stylesheet to apply.
**How to avoid:** All `@page` rules must go in `src/style.css` (the global Tailwind entry point).
**Warning signs:** `@page` changes have no visible effect in print preview.

### Pitfall 6: print-color-adjust Missing
**What goes wrong:** Colored backgrounds (e.g., the emerald-600 host count number) print as gray.
**Why it happens:** Browsers default to stripping background colors and certain text colors in print mode for ink-saving.
**How to avoid:** Add `print-color-adjust: exact; -webkit-print-color-adjust: exact;` to the `@media print` body rule in `style.css`.
**Warning signs:** Color indicators for sufficiency/warning print as black text on white.

---

## Code Examples

Verified patterns from official sources:

### Global @page + print reset in style.css
```css
/* src/style.css */
@import "tailwindcss";

@custom-variant print (@media print);  /* keep — already present */

@page {
  size: A4 portrait;
  margin: 25mm 15mm 25mm 15mm;
}

@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```
Source: MDN @page docs, DocuSeal CSS print page styling guide (verified MEDIUM confidence)

### Result Card with break-inside-avoid
```html
<!-- HostCountCard.vue — add class to root div -->
<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid">
```
Source: Tailwind CSS v4 official docs — `break-inside` (HIGH confidence)

### Tailwind break-before-page reference table
| Tailwind Class | CSS Property | Use |
|----------------|--------------|-----|
| `break-before-page` | `break-before: page` | Force new page before element |
| `break-before-avoid-page` | `break-before: avoid-page` | Prevent new page before element |
| `break-inside-avoid` | `break-inside: avoid` | Prevent break inside element |
| `break-inside-avoid-page` | `break-inside: avoid-page` | Prevent page break inside element |

Source: Tailwind CSS v4 docs `break-before` and `break-inside` (HIGH confidence)

### Chart Print Fallback Table Pattern
```html
<!-- In any chart component template -->
<!-- Screen view: canvas chart -->
<div class="h-48 relative print:hidden">
  <Bar :data="chartData" :options="chartOptions" />
</div>
<!-- Print view: data table -->
<table class="hidden print:table w-full text-sm border-collapse mt-2">
  <thead>
    <tr class="border-b border-gray-300">
      <th class="text-left py-1 font-medium">...</th>
      <th class="text-right py-1 font-medium">...</th>
    </tr>
  </thead>
  <tbody>
    <!-- rows bound to same store refs as chartData -->
  </tbody>
</table>
```
Note: `print:table` requires `hidden` as the screen default. The `print:table` class generates `display: table` which is correct for `<table>` elements.
Source: Tailwind CSS v4 docs (HIGH confidence for class generation); Canvas print blank verified by multiple community sources (MEDIUM confidence)

### Fixed-Position Print Header/Footer
```html
<!-- In ResultsPanel.vue, outside main content flow -->
<!-- Print-only header -->
<div class="hidden print:flex fixed top-0 left-0 right-0 justify-between items-center
            text-xs text-gray-500 border-b border-gray-200 py-2 px-4 bg-white">
  <span>VCF 9.x Sizing Report</span>
  <span>{{ reportDate }}</span>
</div>

<!-- Print-only footer -->
<div class="hidden print:flex fixed bottom-0 left-0 right-0 justify-center items-center
            text-xs text-gray-400 border-t border-gray-200 py-2 px-4 bg-white">
  <span>Generated by VCF Sizer — vcf-sizer.github.io</span>
</div>
```
Where `reportDate` is a computed ref: `const reportDate = computed(() => new Date().toLocaleDateString())`.
Source: tutorialpedia.org verified pattern, aaronsaray.com 2025 deep dive (MEDIUM confidence)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `page-break-inside: avoid` | `break-inside: avoid` | CSS3 Fragmentation spec | New property is the canonical form; old form aliased in modern browsers |
| Tailwind v3: configure `screens: { print: {raw: 'print'} }` in JS config | Tailwind v4: `@custom-variant print (@media print)` in CSS | Tailwind v4.0 (Jan 2025) | CSS-first configuration; project already has this |
| `@page` margin boxes for headers/footers (Prince/PDFreactor spec) | `@page` margin boxes partially in Chrome 131+ | Chrome 131 (Nov 2024) | Chrome-only; Firefox support remains partial; HTML fixed-position approach is more portable |
| Canvas screenshot fallback (html2canvas) | CSS `print:hidden` + sibling `<table>` | Best practice since 2020 | No library needed; simpler, lighter, always correct |

**Deprecated/outdated:**
- `page-break-inside: avoid` — still works as alias, but `break-inside: avoid` is the canonical modern form per MDN
- Tailwind v3 `tailwind.config.js` `screens.print` configuration — replaced by `@custom-variant` in v4

---

## Open Questions

1. **`print:table` utility availability in Tailwind v4**
   - What we know: `print:block`, `print:hidden` are confirmed. `display: table` utilities exist (`table` class).
   - What's unclear: Whether `print:table` is generated for `<table>` elements without explicit class usage in HTML
   - Recommendation: Use `class="hidden print:table"` on `<table>` elements — Tailwind v4 is content-scan driven, so the class must appear in the template for it to be included in the CSS bundle. Verify with `npm run build` and inspect output CSS.

2. **Firefox support for fixed-position print elements**
   - What we know: `position: fixed` print repeating is documented to work in Chrome, Firefox, Safari for basic cases
   - What's unclear: Whether Firefox correctly renders `fixed` header/footer with matching `@page` margins set in CSS
   - Recommendation: Test in Firefox manually. If issues arise, the fallback is to replace fixed position with a `<thead>` / `<tfoot>` in a wrapping table layout (more complex, but guaranteed cross-browser).

3. **Exact header/footer heights for @page margin sizing**
   - What we know: `@page margin` must be at least as large as the fixed header/footer height
   - What's unclear: Final pixel/mm values depend on font size and line height of header/footer elements
   - Recommendation: Start with `margin: 25mm` top and bottom; adjust after print preview testing.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is pure CSS/template changes with no external tool dependencies beyond the existing npm build stack (npm, Vite, Tailwind). All already verified as available.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vite.config.ts (Vitest inline, node environment) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRINT-01 | Input panel hidden in print | manual/visual | Print preview in browser DevTools (Rendering > Emulate CSS media: print) | N/A |
| PRINT-02 | @page margins applied | manual/visual | Print preview — check page margins | N/A |
| PRINT-03 | Cards avoid mid-card breaks | manual/visual | Print preview — scroll through pages | N/A |
| PRINT-04 | Header on every page | manual/visual | Print multi-page document | N/A |
| PRINT-05 | Footer on every page | manual/visual | Print multi-page document | N/A |
| PRINT-06 | Charts hidden, table shown | manual/visual | Print preview — confirm table appears where chart was | N/A |

**Note on test coverage:** CSS print behavior cannot be verified with Vitest (node environment, no DOM). All PRINT-0x requirements are validated by manual browser print preview. The automated test suite (142 tests) covers engine logic and composables only — no CSS can be tested there. This is expected and consistent with project test scope (CLAUDE.md: "Tests cover `src/engine/**/*.test.ts` and `src/composables/**/*.test.ts` only").

### Wave 0 Gaps
None — no new test files are needed for this phase. Print validation is visual-only.

---

## Sources

### Primary (HIGH confidence)
- Tailwind CSS v4 official docs `hover-focus-and-other-states` — `print:` is a built-in variant with `@media print` generation
- Tailwind CSS v4 official docs `break-before` — `break-before-page` maps to `break-before: page`
- Tailwind CSS v4 official docs `break-inside` — `break-inside-avoid` maps to `break-inside: avoid`
- Chrome Developers Blog `developer.chrome.com/blog/print-margins` — `@page` margin boxes (Chrome 131+), confirmed syntax

### Secondary (MEDIUM confidence)
- Aaron Saray 2025 deep dive `aaronsaray.com/2025/a-deep-dive-into-print-css-headers-and-footers/` — fixed-position vs margin-box technique comparison
- tutorialpedia.org `set-margin-padding-for-each-page-to-print-html-css` — `@page` margin + body padding technique for fixed elements
- GitHub issue tailwindlabs/tailwindcss#18699 — Safari print variant CSS nesting bug; closed as COMPLETED (WebKit fix in progress)
- caniuse.com CSS Paged Media — `@page` size/margin: all modern browsers; margin boxes: Chrome 131+ only
- MDN `@page` reference — confirmed margin, size, orientation as universally supported

### Tertiary (LOW confidence)
- Multiple community sources on Chart.js canvas printing blank — consistent community pattern but no single authoritative source; recommendation (use sibling table) is well-established pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Tailwind v4 print: variant confirmed built-in via official docs
- Architecture: HIGH — patterns derived from official docs and verified browser behavior
- Pitfalls: MEDIUM — pitfalls 1, 3, 5, 6 from official/primary sources; pitfalls 2, 4 from community
- Header/footer approach: MEDIUM — fixed-position recommended; @page margin box desirable but browser support is Chrome 131+ only

**Research date:** 2026-03-30
**Valid until:** 2026-06-30 (stable CSS spec; Tailwind minor releases unlikely to break print: variant)
