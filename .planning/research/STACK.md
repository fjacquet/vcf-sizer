# Stack Research — v3.3 UX Polish & Export Quality

**Domain:** Vue 3 SPA enhancement (wizard UX, dialog, Markdown preview, chart-to-PPTX)
**Researched:** 2026-04-10
**Confidence:** HIGH (all key claims verified against official docs or bundlephobia live data)

---

## Scope Boundaries

This document covers ONLY what is NEW for v3.3. The existing validated stack
(Vue 3.5, Vite 8, Tailwind CSS v4, Pinia 3, vue-i18n v11, Chart.js 4 / vue-chartjs 5,
pptxgenjs 4.0.1, lz-string, Zod, @vueuse/core 14, Vitest) is accepted as-is and not
re-examined here.

---

## Feature-to-Library Mapping

| v3.3 Feature | Library Addition | Pattern |
|---|---|---|
| 1. Click WizardStepper step to jump back | **none** — uiStore already has `setWizardStep()` | Wire `@click` in WizardStepper.vue |
| 2. Landing / intro view on first load | **none** — `showLanding` ref in uiStore + `v-if` | No new library |
| 3. Topology change confirmation dialog | **useConfirmDialog** from `@vueuse/core` (already installed) | Headless composable |
| 4. Domain duplication ("Copy domain") | **none** — object spread in inputStore action | `crypto.randomUUID()` browser API |
| 5. Chart PNG in PPTX | **none** — Chart.js `.toBase64Image()` via vue-chartjs template ref | Canvas API; no new dep |
| 6. Per-domain charts in result cards | **none** — refactor existing chart components to accept `domainId` prop | No new dep |
| 7. Localized Markdown + PPTX exports | **none** — `i18n.global.t()` via exported singleton | Existing `src/i18n/index.ts` exports `i18n` |
| 8. In-app Markdown preview panel | **marked v15** + **DOMPurify v3** | ~38 kB min / ~12 kB gz + ~21 kB min / ~8 kB gz |

**Net new runtime dependencies: 2** (`marked`, `dompurify`).
**All other features require zero new packages.**

---

## Recommended Stack Additions

### New Runtime Dependencies

| Library | Recommended Version | Purpose | Why |
|---|---|---|---|
| `marked` | `^15.0.12` | Markdown string → HTML string | Zero dependencies. 38 034 bytes min / 11 678 bytes gz (bundlephobia live). Pure ESM; Vite tree-shakes unused extensions. Pin `^15` to avoid v16 breaking change (CommonJS build dropped, Node 20 minimum enforced). v18.0.0 is current latest (April 2026) but adds TypeScript v6 as requirement — avoid until TS ecosystem stabilises. |
| `dompurify` | `^3.3.3` | XSS-sanitize HTML from `marked` before `v-html` | marked explicitly recommends DOMPurify. 21 436 bytes min / 8 281 bytes gz (bundlephobia live). DOM-native — works in browser without Node polyfills. Includes built-in TypeScript types since v3.x. |

### Features Using Zero New Libraries

**Feature 1 — WizardStepper click-to-jump**

`uiStore` already exposes `setWizardStep(step: 1|2|3)`. Add an `@click` handler to each
completed step indicator (steps where `ui.currentWizardStep > s.step`). No state model
changes. No new library.

**Feature 2 — Landing / intro view**

Add `showLanding = ref(true)` and `dismissLanding()` action to `uiStore`. Gate the main
wizard view with `v-if="!ui.showLanding"`. This is pure uiStore state. The codebase is
explicitly router-less by architectural decision; `uiStore` is the correct seat for
ephemeral view-routing state.

**Feature 3 — Topology change confirmation dialog**

`@vueuse/core` v14 (already installed at `^14.2.1`) includes `useConfirmDialog`. It
exposes `{ isRevealed, reveal, confirm, cancel }` where `reveal()` returns a Promise
resolving to `{ isCanceled: boolean }`. Build one shared `ConfirmDialog.vue` wired to
the composable; Tailwind CSS handles all styling.

```typescript
// TopologySelector.vue — guard before resetting domains
const { isRevealed, reveal, confirm, cancel } = useConfirmDialog()

async function onTopologyClick(newMode: DeploymentMode) {
  if (hasWorkloads.value) {
    const { isCanceled } = await reveal()
    if (isCanceled) return
  }
  // apply topology change
}
```

**Feature 4 — Domain duplication**

Pure Pinia action in `inputStore`:

```typescript
function duplicateDomain(sourceId: string): void {
  const source = workloadDomains.value.find(d => d.id === sourceId)
  if (!source) return
  workloadDomains.value.push({
    ...source,
    id: crypto.randomUUID(),
    name: source.name + ' (copy)',
  })
}
```

`crypto.randomUUID()` is available in all supported browsers (Chrome 92+, Firefox 95+,
Safari 15.4+) with no import needed. No new library.

**Feature 5 — Chart PNG in PPTX**

Chart.js v4 exposes `toBase64Image()` on the Chart instance. vue-chartjs v5 exposes the
Chart.js instance at `chartRef.value.chart` when a template ref is placed on any
`<Bar>`, `<Doughnut>`, or `<Line>` component.

The PPTX export composable is headless (no DOM access). The correct pattern is to pass
pre-captured PNG strings as parameters:

```typescript
// ResultsPanel.vue (component layer — has DOM access)
const chartPngs = new Map<string, string>()
for (const [domainId, ref] of chartRefs.entries()) {
  const fullDataUrl = ref.value.chart.toBase64Image() // "data:image/png;base64,..."
  chartPngs.set(domainId, fullDataUrl.split(',')[1])  // strip prefix for pptxgenjs
}
await generatePptxReport({ chartPngs })

// usePptxExport.ts (composable — accepts pre-captured PNGs)
slide.addImage({
  data: `image/png;base64,${chartPngs.get(domain.id) ?? ''}`,
  x: 0.5, y: 2.0, w: 6.0, h: 3.5,
})
```

pptxgenjs `addImage` accepts the `"image/png;base64,<data>"` format (without the
`data:` prefix) as documented officially. Stripping the prefix before passing is
required.

**Feature 6 — Per-domain charts in result cards**

The existing chart components (`CoresChart.vue`, `RamChart.vue`, `StorageChart.vue`)
currently hardcode `domainResults[0]`. Refactor to accept a `domainId: string` prop and
look up the matching `DomainResult`. The `computed(() => domainResults.value[0]?.storage)`
pattern becomes `computed(() => domainResults.value.find(r => r.id === props.domainId)?.storage)`.
No new library.

**Feature 7 — Localized Markdown + PPTX exports**

The export composables are plain TypeScript modules (not Vue components) and cannot call
`useI18n()` — that composable requires a component setup context. The correct pattern,
confirmed by the vue-i18n official documentation, is to use the `i18n` singleton directly:

```typescript
// src/composables/useMarkdownExport.ts
import { i18n } from '@/i18n'

// Inside generateMarkdownReport():
const label = i18n.global.t('export.section.compute')
```

`i18n.global.t()` is synchronous and locale-reactive: it reads `i18n.global.locale.value`
which `uiStore.setLocale()` keeps up to date. No new package.

**Feature 8 — In-app Markdown preview panel**

```typescript
// MarkdownPreview.vue
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const safeHtml = computed(() =>
  DOMPurify.sanitize(marked.parse(props.markdown) as string)
)
```

```html
<div class="prose prose-sm max-w-none" v-html="safeHtml" />
```

Tailwind Typography plugin (`@tailwindcss/typography`) provides the `prose` class for
readable Markdown rendering. Check whether it is already installed; if not, add it as a
dev dependency alongside `marked` and `dompurify`.

---

## Integration Points Summary

### Chart-to-PPTX Data Flow

```
<ResultsPanel> (Vue component — has DOM refs)
  → for each domain, chartRef.value.chart.toBase64Image()
  → strip "data:image/png;base64," prefix
  → pass Map<domainId, base64string> to generatePptxReport()

generatePptxReport(chartPngs) (headless composable)
  → slide.addImage({ data: `image/png;base64,${png}`, x, y, w, h })
```

This keeps the composable testable (engine purity analogous to CALC-01) while giving
the component layer sole responsibility for DOM interaction.

### i18n Access in Composables

```
src/i18n/index.ts  ──exports──►  i18n (I18n singleton)
                                     └─► i18n.global.t('key')   ← call in composable
```

The `uiStore.setLocale()` action updates `i18n.global.locale.value`, so `i18n.global.t()`
automatically returns strings in the active locale without any additional wiring.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Markdown parser | `marked ^15` | `markdown-it` | ~3x larger (~60 kB gz); plugin boilerplate for no added value here |
| Markdown parser | `marked ^15` | `micromark` | Lower-level; requires assembly of remark/rehype pipeline; overengineered for a preview panel |
| XSS sanitiser | `dompurify ^3.3.3` | `sanitize-html` | Node.js DOM dependency adds ~100 kB bundle; incompatible with browser-only constraint |
| Confirmation dialog | `useConfirmDialog` (@vueuse/core already installed) | `vuejs-confirm-dialog` | Would add another package for a feature already covered by existing dep |
| Confirmation dialog | headless composable | `@headlessui/vue` | ~20 kB gz for a single modal dialog; unjustified overhead |
| Chart rasterisation | Chart.js `.toBase64Image()` | `html2canvas` | ~200 kB gz; already rejected in PROJECT.md for PDF export; causes blank canvas on off-screen elements |
| Landing view | `uiStore.showLanding` ref | `vue-router` named route | Project is explicitly router-less; routing via store is the established pattern |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|---|---|---|
| `html2canvas` | ~200 kB gz; off-screen canvas renders blank; already rejected in PROJECT.md | Chart.js `.toBase64Image()` |
| `jsPDF` | Bundle cost; already rejected in PROJECT.md | `window.print()` for PDF |
| `@headlessui/vue` | Full library for one modal component | `useConfirmDialog` from `@vueuse/core` (already installed) |
| `sanitize-html` | Node.js DOM shim, ~100 kB in browser bundle | DOMPurify (DOM-native, 8 kB gz) |
| `marked` v16+ | Drops CJS build (irrelevant for Vite ESM), Node 20 minimum, TypeScript v6 required in v18 | Pin `^15.x` |
| Any CSS component framework | Tailwind CSS v4 is already the styling layer | Tailwind utility classes |
| `@types/dompurify` | Types are bundled in `dompurify` v3.x | None needed |

---

## Installation

Features 1–7 require no new packages.

Feature 8 (in-app Markdown preview):

```bash
npm install marked@^15.0.12 dompurify@^3.3.3
```

Optionally, if `@tailwindcss/typography` is not yet installed:

```bash
npm install -D @tailwindcss/typography
```

Check `package.json` first — if the `prose` class is already usable, skip this.

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---|---|---|---|
| `marked` | `^15.0.12` | Vite 8, Node 18+, browser ESM | Pure ESM. No dependencies. |
| `dompurify` | `^3.3.3` | Browser only (no Node / SSR) | Bundled TS types. |
| `@vueuse/core` | `^14.2.1` (already installed) | Vue 3.5, Vite 8 | `useConfirmDialog` stable since v7. |
| `chart.js` | `^4.5.1` (already installed) | Browser canvas | `.toBase64Image()` available since v2. |
| `vue-chartjs` | `^5.3.3` (already installed) | Vue 3, Chart.js 4 | Template ref exposes `.chart` (Chart.js instance). |
| `pptxgenjs` | `^4.0.1` (already installed) | Browser ESM | `addImage({ data: 'image/png;base64,...' })` works in v4. |

---

## Sources

- [Chart.js API — `toBase64Image()`](https://www.chartjs.org/docs/latest/developers/api.html) — HIGH confidence, official docs
- [vue-chartjs Guide — template ref access to `.chart`](https://vue-chartjs.org/guide/) — HIGH confidence, official docs
- [pptxgenjs Images API — `addImage` `data` parameter](https://gitbrent.github.io/PptxGenJS/docs/api-images/) — HIGH confidence, official docs
- [VueUse `useConfirmDialog`](https://vueuse.org/core/useconfirmdialog/) — HIGH confidence, official docs
- [vue-i18n Composition API — global scope, usage outside components](https://vue-i18n.intlify.dev/guide/advanced/composition) — HIGH confidence, official docs
- [marked releases — v15/v16/v17/v18 changelog](https://github.com/markedjs/marked/releases) — HIGH confidence, GitHub releases (verified 2026-04-10: latest is v18.0.0; v15.0.12 recommended for stability)
- [DOMPurify — v3.3.3 current stable](https://github.com/cure53/DOMPurify) — HIGH confidence, GitHub
- Bundlephobia API (live, 2026-04-10) — `marked@15.0.12`: 38 034 min / 11 678 gz; `dompurify@3.3.3`: 21 436 min / 8 281 gz

---
*Stack research for: vcf-sizer v3.3 UX Polish & Export Quality*
*Researched: 2026-04-10*
