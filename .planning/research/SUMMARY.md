# Project Research Summary

**Project:** VCF Sizer — v2.1 Export Quality
**Domain:** Browser-only SPA (Vue 3 + Vite 8) — Infrastructure Sizing Calculator
**Researched:** 2026-03-29
**Confidence:** HIGH

## Executive Summary

VCF Sizer v2.1 targets a single milestone objective: replace the minimal, incomplete export outputs shipped in v1.0–v2.0 with professional-grade deliverables that cloud architects can hand directly to customers and procurement. The three export types in scope — enriched Markdown, print/PDF overhaul, and browser-side PPTX generation — share the same underlying data layer (Pinia stores already populated by the existing engine) and require no changes to the calculation engine. The primary new dependency is `pptxgenjs@4.0.1`, the only actively maintained library capable of generating Office Open XML presentations entirely in the browser without a Node.js process.

The recommended approach is to implement exports in the order: Markdown enrichment first, then print/PDF CSS, then PPTX. Markdown enrichment establishes the complete data access pattern — mapping all 13 store fields to report sections — which then becomes the specification for PPTX slide content. Print CSS can be done entirely without adding any npm dependency and should be completed before introducing the `pptxgenjs` bundle cost. Both `jspdf` and `html2canvas` are explicitly rejected: their combined bundle cost exceeds 30 MB unpacked and their output quality (rasterized, non-searchable) is inferior to browser native print-to-PDF.

The critical constraint for all implementation work is CALC-01/CALC-02: no Vue imports may enter the engine layer (`src/engine/`), and `calculationStore` must expose only `computed()` values. Export composables live in `src/composables/` and read from Pinia stores — they are Vue-layer code and fully compliant with these constraints. The most dangerous pitfalls involve `pptxgenjs`-specific API quirks (instance reuse causing slide bleed, option object mutation converting values to EMU, color hex strings without `#` prefix) rather than architectural issues.

---

## Key Findings

### Recommended Stack

The existing stack requires exactly one new production dependency for v2.1: `pptxgenjs@4.0.1`. Every other export improvement (print/PDF quality, Markdown completeness) is pure TypeScript string assembly and CSS — zero additional packages. This keeps the initial bundle at the current 159 kB gzip; `pptxgenjs` is loaded only as a lazy async chunk when the user triggers PPTX export.

**Core technologies:**
- `pptxgenjs@4.0.1` — PPTX generation — only actively maintained browser-native Office Open XML library; v4.0.0 fixed the Vite Node.js detection conflict; ESM build auto-selected by Vite via `exports` field
- Print CSS (`@media print` + `@page` rules) — PDF quality — zero bundle cost; produces searchable vector-quality text superior to any canvas-rasterization approach
- Tailwind v4 `print:` variants — print layout utilities — `@custom-variant print` already registered in `src/style.css`; `break-before-page`, `break-inside-avoid`, `print:hidden` available immediately
- Dynamic `import('pptxgenjs')` via Vite — bundle isolation — keeps initial page load unaffected; Vite code-splits the library into a separate async chunk automatically

**Libraries explicitly rejected:**
- `jspdf@4.2.1` (28.8 MB unpacked, ~900 kB–1.2 MB gzip, incompatible with Tailwind utilities, rasterized output)
- `html2canvas@1.4.1` (3.3 MB unpacked, last published 2022-01-22, effectively unmaintained, rasterizes DOM)
- `officegen` (Node.js only — no browser support)
- `puppeteer`/`playwright` (server-side — violates zero-infrastructure constraint)

### Expected Features

**Must have — P1 (table stakes for a complete export):**
- Markdown: report header metadata (deployment mode, management architecture, network speed)
- Markdown: workload profile section (VM count, vCPU/VM, vRAM/VM, overcommit ratios)
- Markdown: management domain per-component table (vCenter, SDDC Manager, NSX x3, VCF Operations x3, VCF Automation x3)
- Markdown: conditional sections — stretch cluster topology + network checklist, vSAN Max cluster, AI/GPU workload, NVMe tiering, validation warnings
- Print/PDF: page break CSS on major sections + `break-inside-avoid` on cards/tables
- Print/PDF: `print:hidden` on all interactive UI (forms, toolbar, nav, input panel)
- Print/PDF: `@page` A4 portrait with 0.5in margins in `src/style.css`
- PPTX: 10 always-present slides (title, agenda, configuration summary, host specs, workload profile, management overhead, compute results, storage results, recommendations, appendix)
- PPTX: up to 6 conditional slides (AI/GPU, NVMe tiering, stretch topology, stretch network checklist, vSAN Max, validation warnings)
- PPTX: lazy-loaded via dynamic import — no impact on initial bundle

**Should have — P2 (differentiators, valuable but not blocking):**
- Print/PDF: running header/footer with page numbers (Chrome 131+ `@page` margin boxes)
- Print/PDF: print-only summary page (new `<div class="hidden print:block">` component)
- PPTX: slide master with VMware/Broadcom-style blue color theme
- PPTX: shareable URL as hyperlink on title slide

**Defer to v3+ (anti-features for v2.1):**
- Server-side PDF generation (Puppeteer/headless) — requires backend, violates zero-infrastructure
- Embedded Chart.js canvas images in PPTX — pixelated at presentation resolution, high complexity
- Per-locale export deck content — PPTX/Markdown in French/German/Italian adds full i18n pipeline
- Fully branded customer-specific PPTX templates — scope creep; single VCF-branded template sufficient
- Animated/transitions between PPTX slides — no information value, fragile in Keynote/LibreOffice

### Architecture Approach

All three export types are implemented as Vue-layer composables that read from Pinia stores without writing back. The key refactor is extracting `generateMarkdownReport()` from `useUrlState.ts` (URL state responsibility) into a dedicated `useMarkdownExport.ts` composable. PPTX generation goes into a new `usePptxExport.ts` with an `async generatePptxReport(): Promise<void>` signature. Print CSS requires no new composable — `window.print()` in `ExportToolbar.vue` remains unchanged; the work is entirely in CSS class additions to existing components plus a `@page` block in `src/style.css`.

**Major components for v2.1:**

1. `src/composables/useMarkdownExport.ts` (new) — extracted + enriched Markdown generation; reads all 13 data sources from inputStore + calculationStore; conditional sections guarded by feature flags
2. `src/composables/usePptxExport.ts` (new) — async PPTX generation via dynamic `import('pptxgenjs')`; creates fresh `pptxgen` instance per invocation; reads same store surface as Markdown
3. `src/style.css` (modified) — `@page` A4 portrait block; `@media print` font size and color rules
4. Result card components (modified) — `print:break-before-page` and `print:break-inside-avoid` Tailwind classes on section wrappers
5. `src/components/results/ExportToolbar.vue` (modified) — re-import Markdown from new composable; add PPTX button with async handler; update import chain
6. `package.json` (modified) — add `pptxgenjs` production dependency

**Files that must not change:**
- `src/engine/*.ts` — CALC-01 enforced; export is a UI concern, not engine concern
- `src/stores/calculationStore.ts` — export reads from it, never writes; CALC-02 preserved
- `src/stores/inputStore.ts` — read-only surface for all exporters

**Export layer target state:**
```
ExportToolbar.vue
    ├── import { generateShareUrl } from 'useUrlState'         (URL state, unchanged)
    ├── import { generateMarkdownReport } from 'useMarkdownExport'   (extracted + enriched)
    ├── import { generatePptxReport } from 'usePptxExport'    (new)
    └── window.print()                                         (unchanged — print CSS handles layout)
```

### Critical Pitfalls

The top 5 pitfalls from research — ranked by likelihood of causing a broken release:

1. **PptxGenJS instance reuse causes slide bleed** (A-1, HIGH confidence) — second export contains slides from previous exports; prevent by constructing `new pptxgen()` inside the export function on every invocation, never at module scope

2. **PptxGenJS option objects mutated in-place — EMU conversion** (A-2, HIGH confidence) — reusing a style object literal across `addText()`/`addShape()` calls corrupts positioning; prevent with factory functions returning fresh objects per call

3. **Color hex strings must not include `#` prefix** (A-3, HIGH confidence) — `color: '#1F497D'` silently produces invalid PPTX XML; define a `pptxColors.ts` constants file with bare hex strings before writing any slide

4. **`break-before-page` fails inside flex containers** (A-9, MEDIUM confidence) — CSS fragmentation properties are ignored in flex/grid formatting contexts; report wrapper must switch to block layout in `@media print`

5. **Tailwind v4 `print:hidden` may not override inline display utilities** (A-8, HIGH confidence) — alphabetical class ordering in v4 means `.flex` beats `.hidden` in specificity; use `!important` in a dedicated `print.css` or wrap elements in a structural `print:hidden` container

**Additional PPTX pitfalls to anticipate during implementation:**
- Chart.js `toBase64Image()` returns blank PNG if animation is running — disable animation on export charts (A-4)
- `addImage({ data: ... })` expects `'image/png;base64,...'` without `data:` prefix — strip with `.replace(/^data:/, '')` (A-5)
- CALC-01 violation if chart refs imported into engine layer — extract base64 string in composable, pass plain string to engine (A-11)

---

## Implications for Roadmap

Based on combined research findings, the recommended phase structure for v2.1 is four phases in strict dependency order:

### Phase 1: Markdown Enrichment

**Rationale:** Markdown enrichment has zero new dependencies, establishes the complete data access pattern (all 13 store fields mapped to report sections), and produces a testable deliverable. All subsequent work (print CSS and PPTX) benefits from this mapping being validated first. The existing test file `useMarkdownExport.test.ts` already exists as a stub — this phase formalizes it.
**Delivers:** Complete, professional Markdown report covering all 8 always-present sections and all 7 conditional sections; composable extracted from `useUrlState.ts` into `useMarkdownExport.ts`
**Addresses features:** All P1 Markdown features (workload profile, per-component management table, all conditional sections, validation warnings, footer with shareable URL)
**Avoids pitfall:** B-1 (silent omission of conditional sections) — enforced by Vitest tests for each conditional section's presence/absence
**Research flag:** None — established pattern, well-documented store surface, no third-party API

### Phase 2: Print/PDF CSS Overhaul

**Rationale:** Zero npm dependencies; only touches CSS and Tailwind class additions to existing components. Completing this before PPTX avoids introducing bundle complexity during print CSS development. Phase 1's enriched Markdown also clarifies which result sections exist in the DOM and need page break treatment.
**Delivers:** Professional print/PDF output via `window.print()` — A4 page geometry, section page breaks, no interactive UI in print, charts visible with proper sizing, monochrome-safe colors
**Addresses features:** All P1 Print/PDF features (page breaks, `print:hidden` on controls, `@page` margins, font size adjustment)
**Avoids pitfalls:** A-8 (`print:hidden` specificity — `!important` in print.css), A-9 (flex container blocking page breaks — block layout in print), A-10 (`@page` rules in `print.css`, not Tailwind utilities)
**Research flag:** None — CSS print is well-understood; Tailwind v4 specifics are fully documented in PITFALLS.md

### Phase 3: PPTX Export — Core Slides

**Rationale:** With the complete store-to-section mapping validated by Phase 1, PPTX slide content can be specified with confidence. Core slides (10 always-present) are implemented first to establish the slide master, color constants, and `usePptxExport.ts` composable skeleton before adding conditional slide complexity.
**Delivers:** Downloadable `.pptx` file with 10 always-present slides: title (with shareable URL), agenda, configuration summary, host specs, workload profile, management domain overhead table, compute sizing results, storage sizing results, recommendations, appendix/methodology
**Uses:** `pptxgenjs@4.0.1` via dynamic import; `pptxColors.ts` constants file; `LAYOUT_16x9` (10 x 5.625 in) as the baseline layout
**Implements:** `usePptxExport.ts` composable + PPTX button in `ExportToolbar.vue`
**Avoids pitfalls:** A-1 (fresh instance per export), A-2 (factory functions for option objects), A-3 (define `pptxColors.ts` first), A-6 (commit to `LAYOUT_16x9`, document coordinate assumptions), A-7 (Calibri/Calibri Light only — no custom font embedding)
**Research flag:** Verify `pres.defineSlideMaster()` object mutation behavior before designing the master template — the option-mutation pitfall (A-2) is particularly dangerous for master objects shared across all slides

### Phase 4: PPTX Export — Conditional Slides and Polish

**Rationale:** Conditional slides reuse the conditional logic already validated in Phase 1 (Markdown). Phase 4 is lower risk because the composable skeleton from Phase 3 is already working. Polish items (slide master branding, P2 print header/footer) are deferred here to avoid blocking core PPTX delivery.
**Delivers:** Complete PPTX with up to 6 conditional slides (AI/GPU, NVMe tiering, stretch topology + network checklist, vSAN Max cluster, validation warnings) plus optional slide master branding
**Addresses features:** All remaining P1 PPTX features (conditional slides) and selected P2 items (slide master, shareable URL on title slide)
**Avoids pitfalls:** A-4 (Chart.js animation disabled for export), A-5 (`data:` prefix stripped before `addImage()`), A-11 (CALC-01 preserved — chart image data extracted in Vue layer, passed as plain string to engine function)
**Research flag:** None — conditional logic mirrors Phase 1; chart capture pitfalls are fully documented in PITFALLS.md

### Phase Ordering Rationale

- Markdown must come before PPTX because it forces enumeration of all store fields needed for export — discovered once, specification used twice
- Print CSS must come before PPTX because it has zero dependencies and should be verified clean before `pptxgenjs` adds build complexity
- PPTX core slides must come before conditional slides to establish the composable skeleton and guard against the most dangerous pitfalls (A-1, A-2, A-3) in a controlled, testable scope before adding complexity
- TDD discipline established in v1.0–v2.0 applies throughout: failing tests before implementation, including conditional section presence/absence tests for both Markdown and PPTX

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:
- **Phase 3 (PPTX core):** Verify `pres.defineSlideMaster()` mutation behavior — the option-mutation pitfall (A-2) is especially damaging for master template objects shared across all slides; a quick prototype is warranted before full implementation

Phases with standard patterns (skip research-phase):
- **Phase 1 (Markdown):** Pure TypeScript template literals reading established Pinia store surface — no third-party API
- **Phase 2 (Print CSS):** Standard CSS print specification + Tailwind v4 utilities — all pitfalls documented in PITFALLS.md
- **Phase 4 (PPTX conditional):** Reuses Phase 3 patterns; conditional logic mirrors Phase 1 — no new API surface

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via `npm info` on 2026-03-29; pptxgenjs ESM/Vite compatibility confirmed against official docs and GitHub release notes; rejection of jspdf/html2canvas backed by measured npm registry data |
| Features | HIGH | Markdown completeness audit based on direct first-party code inspection of `useUrlState.ts`, `calculationStore.ts`, `inputStore.ts`; PPTX slide structure MEDIUM confidence — based on industry conventions, not VCF-specific consulting templates |
| Architecture | HIGH | All integration points derived from direct code inspection of existing codebase; CALC-01/CALC-02 compatibility matrix explicitly verified; file change list is concrete and complete |
| Pitfalls | HIGH (A-1, A-2, A-3, A-8, A-10, A-11) / MEDIUM (A-4, A-5, A-6, A-7, A-9) | Critical pptxgenjs pitfalls confirmed against official docs and GitHub issues; print CSS pitfalls confirmed against Tailwind GitHub issues; chart capture pitfalls from official Chart.js docs |

**Overall confidence:** HIGH

### Gaps to Address

- **pptxgenjs exact gzip bundle size:** Bundlephobia and npm pages returned 403 during research. Estimate of 300–400 kB gzip is inferred from the 2,544 kB uncompressed size. Actual size should be measured during Phase 3 with `npx vite build --report` or `rollup-plugin-visualizer`.
- **Chart images in PPTX — include or omit:** Whether to include Chart.js canvas captures in PPTX slides is undecided for v2.1. FEATURES.md documents it as an anti-feature (complexity, pixelation), but STACK.md shows it is technically feasible. Phase 3 should prototype chart capture quickly and drop it if quality is insufficient.
- **Print running header/footer cross-browser:** Chrome 131+ `@page` margin boxes are confirmed. Safari 18.2+ support is MEDIUM confidence. Phase 2 should implement this as an enhancement with an explicit fallback plan if cross-browser testing fails.
- **vSAN Max stretch topology is out of scope:** PROJECT.md flags this as deferred beyond v2.1. Conditional sections in Markdown and PPTX cover vSAN Max standalone only; the combined vSAN Max + stretch cluster topology is explicitly excluded.

---

## Sources

### Primary (HIGH confidence)
- `src/composables/useUrlState.ts` — existing `generateMarkdownReport()` implementation; direct code inspection
- `src/stores/calculationStore.ts` — all computed results available; direct code inspection
- `src/stores/inputStore.ts` — all 27 input fields; direct code inspection
- `src/engine/types.ts` — all result interfaces; direct code inspection
- PptxGenJS official docs — https://gitbrent.github.io/PptxGenJS/ — installation, integration, saving API, TypeScript definitions
- PptxGenJS GitHub releases — v4.0.1 current; v4.0.0 Node detection fix confirmed
- `npm info pptxgenjs` — version 4.0.1, unpacked 2,544 kB (measured 2026-03-29)
- `npm info jspdf` — version 4.2.1, unpacked 28,800 kB (measured 2026-03-29)
- `npm info html2canvas` — version 1.4.1, last published 2022-01-22 (measured 2026-03-29)
- Tailwind CSS v4 break utilities — https://tailwindcss.com/docs/break-inside — confirmed March 2026
- CSS `@page` at-rule — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page — Chrome 131+ / Firefox 95+ / Safari 18.2+
- Tailwind CSS GitHub issue #16586 — `print:hidden` vs `flex` ordering regression in v4 (Feb 2025)
- Tailwind CSS GitHub discussion #7973 — `break-before-page` ignored inside flex containers
- Chart.js API docs — `toBase64Image()` must be called after animation completes
- PptxGenJS source `gen-objects.ts` — confirms `data:` prefix format and in-place EMU conversion behavior

### Secondary (MEDIUM confidence)
- CSS print page styling best practices — https://www.docuseal.com/blog/css-print-page-style
- Print CSS headers/footers deep dive — https://aaronsaray.com/2025/a-deep-dive-into-print-css-headers-and-footers/
- vSAN ReadyNode Sizer report structure — https://medium.com/@lubomir-tobek/vsan-readynode-sizer-c46ce1365312
- Nutanix sizing report sections — https://www.nutanix.com/tech-center/blog/hybrid-cloud-sizing-and-capacity-planning
- pptxgenjs GitHub issue #406 — `defineSlideMaster()` config object mutation confirmed

### Tertiary (LOW confidence)
- IT infrastructure assessment presentation templates — https://www.slideteam.net/blog/top-10-it-infrastructure-assessment-templates-with-samples-and-examples — could not extract template details; structural slide order based on general consulting conventions

---
*Research completed: 2026-03-29*
*Milestone: v2.1 Export Quality*
*Ready for roadmap: yes*
