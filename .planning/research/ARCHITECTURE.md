# Architecture Research — v3.3 UX Polish & Export Quality

**Domain:** VCF 9.x Sizing Calculator SPA — UX Enhancement & Export Enrichment
**Researched:** 2026-04-10
**Confidence:** HIGH (grounded in direct codebase inspection of all stores, composables, components, and engine files; v3.1 shipped baseline)
**Replaces:** v3.1 architecture document (2026-03-30)

---

## Context: What This Document Covers

This is the v3.3 milestone architecture document. It answers four questions for the roadmapper:

1. How each of the 8 v3.3 features integrates with the existing store/composable/component layer separation
2. What is new vs what is modified in each layer
3. What data flows change (particularly chart-to-PPTX and locale-to-export)
4. What is the correct build order given inter-feature dependencies

---

## Established Constraints (Non-Negotiable)

| Constraint | Rule | Enforced In |
|------------|------|-------------|
| CALC-01 | Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library | CLAUDE.md |
| CALC-02 | `calculationStore.ts` must contain ZERO `ref()` — only `computed()` | CLAUDE.md |
| WIZARD-07 | `currentWizardStep` must NEVER appear in `InputStateSchema` (Zod) or URL state | uiStore.ts comment |
| I18N | Validation warning `messageKey` must be an i18n key, never a raw English string | engine/types.ts |
| PPTX-15 | pptxgenjs loaded via dynamic `import()` inside function body — keeps it out of initial bundle | usePptxExport.ts |
| EXPORT-PURE | Export composables are plain TypeScript — no Vue lifecycle hooks | usePptxExport.ts header |

---

## Baseline Architecture (v3.1 — What We Start From)

```
src/
  engine/              Pure TS — zero Vue imports (CALC-01)
    types.ts           WorkloadDomainConfig, DomainResult, AggregateTotals, ...
    defaults.ts        createDefaultWorkloadDomain(), createDefaultManagementDomain()
    compute.ts         calcCompute(), etc.
    storage.ts         calcStorage()
    ...

  stores/
    inputStore.ts      All ref() mutable state — workloadDomains, managementDomain,
                       managementArchitecture, activeDomainIndex
    calculationStore.ts Zero ref(), only computed() — domainResults, aggregateTotals,
                       management, dedicatedMgmtHostCount
    uiStore.ts         locale, currentWizardStep (1|2|3), topologyConfirmed

  composables/
    useUrlState.ts     lz-string + Zod serialize/hydrate
    useMarkdownExport.ts generateMarkdownReport() — pure TS, uses inputStore + calculationStore
    usePptxExport.ts   generatePptxReport() — pure TS, dynamic import of pptxgenjs

  components/
    input/             DeploymentModelSelector, HostSpecsForm, WorkloadProfileForm,
                       StorageConfigForm, ManagementDomainSection
    results/           ResultsPanel, DomainResultCard, AggregateTotalsCard, ExportToolbar
    results/charts/    CoresChart, RamChart, StorageChart  (all read domainResults[0])
    shared/            WizardStepper, DomainTabStrip, TopologySelector, ManagementSummary,
                       ManagementResultCard, ManagementCommittedSummary, LanguageSwitcher

  App.vue              Two-pane layout: left=wizard steps (v-show), right=ResultsPanel
  main.ts              hydrateFromUrl() on mount
```

**Key constraint from v3.1:** All three global charts (`CoresChart`, `RamChart`, `StorageChart`) still read `domainResults[0]` — hardcoded first-domain bridge left intentionally as a v3.3 target.

---

## Feature Integration Analysis

### Feature 1: Click WizardStepper Step to Jump Back

**What changes:** `WizardStepper.vue` only.

**Current state:** Completed steps render as green pill indicators with no click handler. `goBack()` only goes to `currentStep - 1`.

**Change:** Add a click handler to each completed step pill in the `v-for` loop. Clicking step N (where N < currentWizardStep) calls `ui.setWizardStep(N)`. No guard is needed for clicking forward — only completed (green) steps should be clickable.

**uiStore.ts:** No change needed. `setWizardStep(step: 1 | 2 | 3)` already exists and accepts any step value. `canGoBack` computed is already correct.

**Integration point:** `WizardStepper.vue` template change only. Step indicator `div` receives `@click="() => { if (ui.currentWizardStep > s.step) ui.setWizardStep(s.step) }"` and `cursor-pointer` / `hover:ring-2` classes when the step is completed.

**Data flow:** `uiStore.currentWizardStep` (read) → `uiStore.setWizardStep()` (write). No store schema change.

---

### Feature 2: Landing View on First Load

**What changes:** `uiStore.ts` (new flag), `App.vue` (new conditional panel), new `LandingView.vue` component.

**Design decision — wizard step 0 vs separate flag:**
Using a dedicated `isLandingVisible` flag in `uiStore` is preferred over a "step 0" because:
- Step type is `1 | 2 | 3` — widening to `0 | 1 | 2 | 3` would require updating every place that checks `currentWizardStep === 1`, `=== 2`, `=== 3`
- WizardStepper only makes sense when the wizard has started — step 0 would require hiding it
- `isLandingVisible` is semantically clear and ephemeral (like `topologyConfirmed`)

**uiStore.ts additions:**
```typescript
const isLandingVisible = ref<boolean>(true)   // true on fresh load
function dismissLanding(): void {
  isLandingVisible.value = false
}
```
Return `isLandingVisible` and `dismissLanding`.

**LandingView.vue:** New component in `src/components/shared/`. Receives no props. Reads `uiStore.isLandingVisible` (or is conditionally shown from App.vue). Emits nothing — calls `uiStore.dismissLanding()` on the CTA button click. Content: product tagline, topology quick summary, "Start Sizing" button.

**App.vue change:** Wrap the entire `<main>` pane with `v-if/v-else` on `!ui.isLandingVisible`, showing `<LandingView>` as a full-screen overlay or replacing the main content when landing is active.

**URL hydration:** When `hydrateFromUrl()` successfully loads state from a shared URL (i.e., a non-default input configuration is found), `isLandingVisible` should be set to `false` automatically so shared links open directly at step 1. This means `main.ts` (or `useUrlState.ts`) needs to call `uiStore.dismissLanding()` after successful hydration.

**Constraint:** `isLandingVisible` must NOT appear in `InputStateSchema` — same structural guarantee as `currentWizardStep` (WIZARD-07 applies by analogy).

---

### Feature 3: Topology Change Confirmation Dialog

**What changes:** `TopologySelector.vue` (adds dialog), `uiStore.ts` (optional: pending topology state), OR handled entirely within the component using a local `ref`.

**What triggers it:** User clicks a new topology button in `TopologySelector.vue` when `ui.topologyConfirmed === true` AND `inputStore.workloadDomains` have been modified from defaults (i.e., any domain has `vmCount > 0` or user is past step 1).

**Recommended approach — component-local state:**
Keep dialog state in `TopologySelector.vue` itself using a local `ref<DeploymentMode | null>`. No store change required.

```
pendingTopology = ref<DeploymentMode | null>(null)

onTopologyClick(mode):
  if (topologyConfirmed && hasWorkloadData):
    pendingTopology.value = mode    // shows dialog
  else:
    commitTopology(mode)            // direct commit, existing behavior

onConfirm():
  commitTopology(pendingTopology.value!)
  pendingTopology.value = null

onCancel():
  pendingTopology.value = null
```

**hasWorkloadData check:** `inputStore.workloadDomains.some(d => d.vmCount > 0)` — if any domain has VMs configured, a change warning is warranted.

**ConfirmationDialog.vue:** New shared component in `src/components/shared/`. Accepts props `{ title: string, message: string, confirmLabel: string, cancelLabel: string }`, emits `confirm` and `cancel`. Implemented as a modal overlay using Tailwind. Reusable across features (topology change, future uses).

**Integration:** `TopologySelector.vue` conditionally renders `<ConfirmationDialog>` when `pendingTopology !== null`. No uiStore change needed.

---

### Feature 4: Domain Duplication (Deep Clone)

**What changes:** `inputStore.ts` (new `duplicateDomain()` action), `DomainTabStrip.vue` (new "Copy" button per tab).

**inputStore.ts addition:**
```typescript
function duplicateDomain(id: string): void {
  const source = workloadDomains.value.find(d => d.id === id)
  if (!source) return
  const clone: WorkloadDomainConfig = {
    ...source,                          // shallow spread is safe — all fields are primitives
    id: crypto.randomUUID(),            // new identity
    name: `${source.name} (copy)`,
  }
  const sourceIdx = workloadDomains.value.findIndex(d => d.id === id)
  workloadDomains.value.splice(sourceIdx + 1, 0, clone)
  activeDomainIndex.value = sourceIdx + 1
}
```

**Why spread is safe:** `WorkloadDomainConfig` contains only primitive fields (string, number, boolean, literal union types). No nested objects or arrays. A shallow spread is a complete deep clone.

**DomainTabStrip.vue change:** Add a "Copy" icon button next to each tab (visible on hover or always visible). Calls `inputStore.duplicateDomain(domain.id)`. Position it alongside the existing rename/delete controls.

**No engine change.** `calculationStore.domainResults` is already a `computed()` that maps over `inputStore.workloadDomains` — a new domain in the array will be picked up automatically.

**URL state:** `workloadDomains` is already serialized to URL. The new domain will appear in the URL on next share. No schema change needed.

---

### Feature 5: Chart Images in PPTX (PNG Rasterization)

**This is the highest architectural complexity feature in v3.3.**

**The core problem:** `usePptxExport.ts` is a plain TypeScript composable with no Vue lifecycle hooks and no access to the DOM. The Chart.js canvas elements live in Vue components (`CoresChart.vue`, `RamChart.vue`, `StorageChart.vue`) that are mounted in the right pane. The composable needs a `data:image/png;base64,...` string to pass to `slide.addImage()`.

**Architecture pattern — chart registry via uiStore:**

The cleanest approach that preserves EXPORT-PURE (no lifecycle hooks in composable) is a **chart image registry in uiStore**. Chart components push their rendered PNG data URLs into the store whenever they update. The PPTX composable reads from the store at export time.

```
uiStore.ts additions:
  const chartImages = ref<Record<string, Record<string, string>>>({})
  // key structure: chartImages[domainId]['cores' | 'ram' | 'storage'] = dataURL

  function registerChartImage(domainId: string, chartType: 'cores' | 'ram' | 'storage', dataUrl: string): void {
    if (!chartImages.value[domainId]) chartImages.value[domainId] = {}
    chartImages.value[domainId][chartType] = dataUrl
  }
```

**Chart component changes (per-domain chart components — see Feature 6):**
Each per-domain chart component uses `vue-chartjs`'s `chart-render` event or `onMounted`/`watch` to call `chartInstance.toBase64Image()` and registers the result:

```typescript
// In DomainCoresChart.vue (new, see Feature 6)
const chartRef = ref<InstanceType<typeof Bar> | null>(null)

// After chart renders or data updates:
watch([chartData, chartRef], () => {
  if (chartRef.value?.chart) {
    const dataUrl = chartRef.value.chart.toBase64Image()
    uiStore.registerChartImage(props.domainId, 'cores', dataUrl)
  }
}, { flush: 'post' })
```

**`chartRef.value.chart`** is the Chart.js instance exposed by vue-chartjs via `ref`. The `toBase64Image()` method returns a `data:image/png;base64,...` string directly — no need for `canvas.toDataURL()`.

**usePptxExport.ts change:** `generatePptxReport()` reads `useUiStore().chartImages` before building per-domain slides. When a domain's chart images are available, it calls `slide.addImage({ data: chartImages[domain.id].cores, ... })`. When not available (e.g., chart not yet rendered), it falls back to the existing table-only slide.

**Constraint:** `chartImages` is ephemeral UI state — it must NOT be serialized to URL state. It is only valid during the current browser session with the results pane visible.

**Alternative considered — canvas query selector:** Calling `document.querySelector('canvas')` from the composable would break the EXPORT-PURE constraint (DOM access from a non-component function) and would not correctly map canvases to domains. Rejected.

**Alternative considered — emit from ExportToolbar.vue:** Having ExportToolbar.vue collect canvas refs and pass them to `generatePptxReport()` as parameters would require changing the function signature and making ExportToolbar.vue aware of chart component internals. Harder to test. Rejected.

---

### Feature 6: Per-Domain Charts in DomainResultCard

**What changes:** Three new chart components, `DomainResultCard.vue` (add chart display), existing global aggregate charts (decide whether to keep or remove).

**New components:**
- `src/components/results/charts/DomainCoresChart.vue` — props: `{ compute: ComputeResult, domainId: string }`
- `src/components/results/charts/DomainRamChart.vue` — props: `{ compute: ComputeResult, domainId: string }`
- `src/components/results/charts/DomainStorageChart.vue` — props: `{ storage: StorageResult, domainId: string }`

**Pattern:** These are prop-driven variants of the existing `CoresChart`, `RamChart`, `StorageChart`. Instead of reading from `calculationStore.domainResults[0]` (the hardcoded first-domain bridge), they accept the domain's data as props. The `domainId` prop is used only to register chart images in `uiStore.chartImages` (Feature 5).

**DomainResultCard.vue change:** Import and render the three new per-domain chart components after the utilization grid. Pass `result.compute`, `result.storage`, and `result.id` as props.

**Existing global charts (`CoresChart`, `RamChart`, `StorageChart`):** With per-domain charts now inside each `DomainResultCard`, the existing aggregate charts in `ResultsPanel.vue` (if any) become redundant. Based on the codebase, these charts are currently rendered separately from `DomainResultCard`. They should be removed from `ResultsPanel.vue` and replaced by the per-domain charts embedded in each card. The "first-domain bridge" comment in the existing charts should be resolved.

**Test coverage:** The new chart components do not need unit tests (they are thin wrappers). The `domainId → chartImages` registration logic is tested through uiStore tests.

---

### Feature 7: Localized Markdown and PPTX Exports

**What changes:** `useMarkdownExport.ts`, `usePptxExport.ts`, `uiStore.ts` (expose locale), `ExportToolbar.vue` (pass locale at call time).

**Current state:** Both composables use hardcoded English labels in table headers and section titles (e.g., `'VM count'`, `'Hosts'`, `'Management hosts'`). The `useI18n()` composable cannot be called outside Vue components/setup context.

**Architecture pattern — pass i18n.global.t directly:**

The global `i18n` instance is exported from `src/i18n/index.ts`. Its `t()` function is accessible as `i18n.global.t`. This is the correct pattern for use outside Vue components.

```typescript
// In useMarkdownExport.ts and usePptxExport.ts:
import { i18n } from '@/i18n'

// Replace hardcoded strings:
// Before: { label: 'VM count', value: ... }
// After:  { label: i18n.global.t('export.vmCount'), value: ... }
```

**i18n key namespace:** Add an `export` key namespace to all four locale files (`en.json`, `fr.json`, `de.json`, `it.json`) covering all labels used in the Markdown report and PPTX table headers. Example keys: `export.vmCount`, `export.coresPerSocket`, `export.storageType`, `export.recommendedHostCount`, etc.

**`uiStore.ts`:** No change needed — the active locale is already reflected in `i18n.global.locale.value` at export time. Because `i18n.global.t()` uses the current locale automatically, the composables will produce output in whichever language was active when the user clicked export.

**Confidence:** HIGH. `i18n.global.t()` is accessible from plain TypeScript because the `i18n` instance is a module-level singleton. The vue-i18n Composition API `useI18n()` is only needed inside component setup contexts. The global instance accessor is a first-class supported pattern per the vue-i18n docs.

**PPTX label hardcoding:** The existing `buildConfigSummaryData`, `buildWorkloadSlideData`, etc. all use hardcoded English strings. These need to be replaced with `i18n.global.t()` calls. Because these are exported pure functions used in tests, tests will need to set the locale before asserting translated output (or test with the English locale as default).

---

### Feature 8: In-App Markdown Preview Panel

**What changes:** New `MarkdownPreview.vue` component, `ExportToolbar.vue` (new Preview button + preview panel toggle), one new dependency (`marked`).

**Library choice — `marked` vs `markdown-it`:**
- `marked`: ~30KB minified, zero configuration, supports GFM tables, outputs safe HTML from trusted content. The Markdown we generate is entirely application-controlled (not user input), so XSS is not a concern.
- `markdown-it`: ~60KB minified, more configurable but more than needed for read-only preview.

Use `marked` with dynamic import to keep it out of the initial bundle, following the same pattern as pptxgenjs.

**MarkdownPreview.vue:** New component in `src/components/results/`. Contains:
- A `computed` that calls `generateMarkdownReport()` and passes the result to `marked.parse()`
- A `div` that renders the parsed HTML via `v-html`
- Tailwind prose styling (or manual table/h2/h3 styles if `@tailwindcss/typography` is not installed — check package.json first)
- A "Close" button that hides the preview

**Package.json check:** `@tailwindcss/typography` is not in the current dependencies. For the preview, use manual Tailwind classes on the rendered HTML (scoped `deep` selectors for tables, headings) rather than adding a new dependency.

**ExportToolbar.vue change:** Add a `showPreview` local `ref<boolean>` and a "Preview" button. When active, render `<MarkdownPreview>` below the toolbar (or as a modal overlay). The button toggles `showPreview`.

**Dynamic import pattern:**
```typescript
// In MarkdownPreview.vue or a useMarkdownPreview composable:
const html = ref<string>('')
async function renderPreview() {
  const { marked } = await import('marked')
  html.value = await marked.parse(generateMarkdownReport())
}
```

**XSS note:** The input to `marked.parse()` is always the output of `generateMarkdownReport()` — application-controlled content with no user-supplied markdown strings. No sanitization step is required.

---

## Component Map: New vs Modified

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `LandingView.vue` | `src/components/shared/` | First-load landing screen |
| `ConfirmationDialog.vue` | `src/components/shared/` | Reusable modal dialog (topology change, future) |
| `DomainCoresChart.vue` | `src/components/results/charts/` | Per-domain cores bar chart (prop-driven) |
| `DomainRamChart.vue` | `src/components/results/charts/` | Per-domain RAM bar chart (prop-driven) |
| `DomainStorageChart.vue` | `src/components/results/charts/` | Per-domain storage breakdown chart (prop-driven) |
| `MarkdownPreview.vue` | `src/components/results/` | In-app rendered Markdown preview |

### Modified Components

| Component | Location | What Changes |
|-----------|----------|-------------|
| `WizardStepper.vue` | `src/components/shared/` | Completed step pills become clickable to jump back |
| `TopologySelector.vue` | `src/components/shared/` | Dialog trigger for topology change when workloads exist |
| `DomainResultCard.vue` | `src/components/results/` | Adds three per-domain chart components below utilization grid |
| `DomainTabStrip.vue` | `src/components/shared/` | Adds "Copy domain" button per tab |
| `ExportToolbar.vue` | `src/components/results/` | Adds "Preview" button, renders `MarkdownPreview` |
| `App.vue` | `src/` | Adds `LandingView` conditional around main layout |

### Existing Components Unchanged

| Component | Reason Unchanged |
|-----------|-----------------|
| `CoresChart.vue`, `RamChart.vue`, `StorageChart.vue` | Replaced by per-domain variants; may be removed |
| `ResultsPanel.vue` | Charts removed from here; DomainResultCard handles per-domain charts |
| `AggregateTotalsCard.vue` | No change needed |
| All `input/` components | No v3.3 changes |
| `ManagementResultCard.vue`, `ManagementSummary.vue`, etc. | No v3.3 changes |

---

## Store Map: New vs Modified

### uiStore.ts — New Additions

| Addition | Type | Purpose |
|----------|------|---------|
| `isLandingVisible` | `ref<boolean>` | Controls landing view display |
| `dismissLanding()` | action | Sets `isLandingVisible = false` |
| `chartImages` | `ref<Record<string, Record<string, string>>>` | Registry of domain chart PNG data URLs |
| `registerChartImage(domainId, type, dataUrl)` | action | Called by per-domain chart components on render |

**CALC-02 compliance:** uiStore is not calculationStore — it may contain `ref()`. All additions are `ref()` in uiStore, which is correct.

**URL-state compliance:** None of `isLandingVisible`, `chartImages` appear in `InputStateSchema` — same guarantee as `currentWizardStep`.

### inputStore.ts — New Additions

| Addition | Type | Purpose |
|----------|------|---------|
| `duplicateDomain(id: string)` | action | Deep-clones a domain, inserts after source, activates the clone |

### calculationStore.ts — No Changes

All new features are pure UI concerns or export-layer concerns. The calculation engine and its computed outputs are unchanged.

---

## Composable Map: Modified

### useMarkdownExport.ts

| Change | Detail |
|--------|--------|
| Replace hardcoded English labels | Import `i18n` from `@/i18n`, use `i18n.global.t('export.*')` for all table header and label strings |
| No structural change | `generateMarkdownReport()` signature unchanged — returns `string` |

### usePptxExport.ts

| Change | Detail |
|--------|--------|
| Replace hardcoded English labels | Same as markdown — `i18n.global.t('export.*')` |
| Add chart image embedding | Read `useUiStore().chartImages[domain.id]` before building each domain slide group; call `slide.addImage()` when available |
| Graceful fallback | If `chartImages[domain.id]` is absent or incomplete, skip `addImage()` — existing table-only slide output unchanged |

---

## Data Flow Diagrams

### Chart Image Pipeline (Feature 5 + 6)

```
DomainResultCard.vue
  └── DomainCoresChart.vue  (props: compute, domainId)
       ├── chartRef = ref<Bar>()
       ├── watch(chartData) { chartRef.chart.toBase64Image() }
       └── uiStore.registerChartImage(domainId, 'cores', dataUrl)

  └── DomainRamChart.vue    (same pattern)
  └── DomainStorageChart.vue (same pattern)

uiStore.chartImages[domainId]['cores'] = 'data:image/png;base64,...'

ExportToolbar.vue
  └── handleExportPptx()
       └── generatePptxReport()
            └── useUiStore().chartImages[domain.id]?.cores → slide.addImage()
```

### Localized Export Pipeline (Feature 7)

```
uiStore.setLocale('fr')
  └── i18n.global.locale.value = 'fr-CH'

ExportToolbar.vue → handleExportMarkdown()
  └── generateMarkdownReport()
       └── i18n.global.t('export.vmCount')  → "Nombre de VM" (fr-CH active)

ExportToolbar.vue → handleExportPptx()
  └── generatePptxReport()
       └── buildConfigSummaryData() → i18n.global.t('export.hosts') → "Hôtes"
```

### Landing View Flow (Feature 2)

```
main.ts → hydrateFromUrl()
  ├── URL has state → uiStore.dismissLanding()
  └── URL is default → isLandingVisible stays true

App.vue → v-if="!ui.isLandingVisible"
  ├── true → show <LandingView>
  └── false → show <main> two-pane layout

LandingView.vue → "Start Sizing" button → uiStore.dismissLanding()
```

### Topology Confirmation Flow (Feature 3)

```
TopologySelector.vue
  ├── hasWorkloadData = inputStore.workloadDomains.some(d => d.vmCount > 0)
  ├── onTopologyClick(mode):
  │    ├── if topologyConfirmed && hasWorkloadData → pendingTopology.value = mode
  │    └── else → commitTopology(mode)
  └── ConfirmationDialog (v-if="pendingTopology !== null")
       ├── @confirm → commitTopology(pendingTopology); pendingTopology = null
       └── @cancel  → pendingTopology = null
```

---

## Suggested Build Order

Feature dependencies determine the order. The chart pipeline (5+6) requires uiStore changes first. Localization (7) requires new i18n keys before composable changes. Landing view (2) is independent. Dialog component (3) can be built standalone.

### Phase ordering

**Group A — Store foundations (no component dependencies)**
1. `uiStore.ts` additions: `isLandingVisible/dismissLanding`, `chartImages/registerChartImage` (Features 2, 5)
2. `inputStore.ts` additions: `duplicateDomain()` (Feature 4)
3. New i18n keys in all 4 locale files: `export.*` namespace (Feature 7 prerequisite)

**Group B — Independent UI features (no cross-feature deps)**
4. WizardStepper clickable steps (Feature 1) — only touches `WizardStepper.vue`, uses existing `uiStore.setWizardStep`
5. `ConfirmationDialog.vue` new shared component (Feature 3 prerequisite)
6. `LandingView.vue` + `App.vue` integration (Feature 2) — uses `isLandingVisible` from Group A

**Group C — Domain management**
7. `DomainTabStrip.vue` Copy button (Feature 4) — uses `duplicateDomain()` from Group A

**Group D — Chart refactor (requires uiStore chartImages from Group A)**
8. New `DomainCoresChart.vue`, `DomainRamChart.vue`, `DomainStorageChart.vue` (Feature 6) — prop-driven, register into `uiStore.chartImages`
9. `DomainResultCard.vue` updated to include per-domain charts (Feature 6)
10. Remove global `CoresChart`, `RamChart`, `StorageChart` from `ResultsPanel.vue` (cleanup)

**Group E — Topology confirmation (requires ConfirmationDialog from Group B)**
11. `TopologySelector.vue` confirmation flow (Feature 3)

**Group F — Export enrichment (requires i18n keys from Group A, chartImages from Group D)**
12. `useMarkdownExport.ts` locale changes (Feature 7)
13. `usePptxExport.ts` locale changes + chart image embedding (Features 5, 7)
14. `MarkdownPreview.vue` + `ExportToolbar.vue` preview button (Feature 8)

### Rationale

- Store changes (Group A) are the foundation — both chart registration and landing dismissal start here.
- i18n keys (Group A) must precede export composable changes to have something to translate.
- Chart component refactor (Group D) must precede PPTX chart embedding (Group F step 13) so that `chartImages` is populated by the time PPTX export is called.
- `ConfirmationDialog` is standalone and can be built as soon as needed, but `TopologySelector` changes depend on it.
- `MarkdownPreview` is last because it requires `marked` as a new dependency and the `generateMarkdownReport()` localization to be complete.

### Milestone phases mapping

| Phase | Features | Group |
|-------|----------|-------|
| Phase 1 | Store foundations + i18n keys | A |
| Phase 2 | WizardStepper clickable + LandingView | A+B |
| Phase 3 | Domain duplication | C |
| Phase 4 | Per-domain charts + DomainResultCard | D |
| Phase 5 | Topology confirmation dialog | B+E |
| Phase 6 | Localized exports + PPTX chart images | F |
| Phase 7 | Markdown preview panel | F last step |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Calling useI18n() in export composables

**What:** Calling `const { t } = useI18n()` inside `generateMarkdownReport()` or `generatePptxReport()`
**Why bad:** `useI18n()` can only be called inside Vue component setup context. Calling it from a plain TypeScript function will throw a "No active component instance" runtime error.
**Instead:** Import `i18n` from `@/i18n` and use `i18n.global.t()` directly.

### Anti-Pattern 2: Canvas querySelector from composable

**What:** `document.querySelector('canvas').toDataURL()` inside `usePptxExport.ts`
**Why bad:** Breaks EXPORT-PURE constraint. Does not map canvases to domains correctly with multiple domains. Canvas may not be visible/rendered at export time.
**Instead:** Chart registry via `uiStore.chartImages` (Feature 5 pattern).

### Anti-Pattern 3: Step 0 for landing view

**What:** Widening `currentWizardStep` to `0 | 1 | 2 | 3` to represent the landing state
**Why bad:** Requires updating every guard and condition that checks `currentWizardStep === 1/2/3`. WizardStepper would need to be hidden for step 0. Semantically wrong — the wizard hasn't started.
**Instead:** Separate `isLandingVisible` boolean flag in uiStore.

### Anti-Pattern 4: ref() in calculationStore for new features

**What:** Adding `ref<boolean>` or `ref<string>` to `calculationStore.ts` for dialog state or preview content
**Why bad:** Violates CALC-02. calculationStore is read-only derived state only.
**Instead:** Dialog state goes in the component (`TopologySelector.vue` local ref). Preview toggle goes in `ExportToolbar.vue` local ref. Chart registry goes in `uiStore`.

### Anti-Pattern 5: Non-optional chartImage parameter in generatePptxReport

**What:** Requiring chart images as a mandatory parameter to `generatePptxReport()`
**Why bad:** Makes the function untestable without a DOM. Breaks the existing test suite. Export should work (with table-only slides) even if chart images haven't been registered.
**Instead:** Read `uiStore.chartImages` inside the function with graceful fallback.

---

## Scalability Considerations

| Concern | Current (1-5 domains) | Future (10+ domains) |
|---------|----------------------|---------------------|
| `chartImages` registry size | Trivial — ~3 base64 strings per domain, ~30KB each | 30 domains × 3 charts × ~30KB = ~2.7MB in memory — acceptable for browser session |
| Per-domain chart renders | Sync with watchers — immediate | May cause UI jank on initial render with 10+ domains; consider `nextTick` batching |
| `DomainResultCard` size | Currently compact; adding 3 charts makes it taller | Consider collapsible chart section per card |
| `generateMarkdownReport()` localization calls | ~40 `t()` calls per domain | Linear with domains — no scaling concern |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Store change design | HIGH | Direct inspection of uiStore.ts, inputStore.ts — patterns are clear |
| Chart image pipeline | HIGH | vue-chartjs `chartRef.value.chart.toBase64Image()` is standard Chart.js API; registry pattern is well-established |
| i18n in composables | HIGH | `i18n.global.t()` is the documented pattern for use outside components (vue-i18n docs) |
| `marked` for preview | MEDIUM | Bundle size ~30KB confirmed; API is stable. Dynamic import pattern is established in this codebase. |
| Wizard step click-back | HIGH | Trivial template change — existing `setWizardStep()` already accepts any step value |
| Domain duplication | HIGH | `WorkloadDomainConfig` contains only primitives — shallow spread is a complete clone |
| Build order | HIGH | Dependencies are explicit; no circular risks |

---

## Gaps to Address in Phase Research

- **`@tailwindcss/typography` vs manual prose styles**: If the Markdown preview needs styled tables/headings, determine whether to add `@tailwindcss/typography` plugin or use `[&_table]` deep selector targeting. Verify Tailwind v4 plugin compatibility before adding dependency.
- **`vue-chartjs` ref access in Composition API**: Confirm `chartRef.value.chart` exposes the Chart.js instance in vue-chartjs v5.3.x. The GitHub issue #1012 showed that `onMounted` can return null — verify the correct event/timing to use (`chart-render` event vs `watch` with `{ flush: 'post' }`).
- **`marked` version and ESM import**: Verify `marked` v15+ supports `await import('marked')` with named export `{ marked }` in the Vite 8 / ESM context. The API changed between v4 and v12.
