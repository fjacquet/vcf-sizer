# Feature Landscape

**Domain:** v3.3 UX Polish & Export Quality — Vue 3 SPA (VCF Sizer)
**Researched:** 2026-04-10
**Overall confidence:** HIGH (codebase directly inspected; patterns verified against official docs and library sources)

---

## Context: What Already Exists

Before categorizing the 8 new features, key existing constraints that shape implementation:

- `uiStore` owns `currentWizardStep ref<1|2|3>` and `topologyConfirmed ref<boolean>`. WIZARD-07 prohibits these from ever entering URL state.
- Wizard panels use `v-show` (not `v-if`) intentionally — data preserved when navigating back.
- `DomainTabStrip` already uses `window.confirm()` for delete confirmation (inline, not modal).
- Charts (`CoresChart.vue`, `RamChart.vue`, `StorageChart.vue`) are hardcoded to `domainResults.value[0]` — a known first-domain bridge with a comment acknowledging it.
- `generateMarkdownReport()` in `useMarkdownExport.ts` is a plain TS function that does NOT call `useI18n()` — validation `messageKey` strings are exported raw (i18n keys, not translated text). This is the existing gap for localization.
- `i18n` is exported from `src/i18n/index.ts` as a named export. `i18n.global.t()` is already callable outside components.
- `createDefaultWorkloadDomain(index)` is a CALC-01-compliant pure function — safe to call in store actions.
- `WorkloadDomainConfig` has 26 typed fields plus `id` and `name`.

---

## Table Stakes

Features users of this type of tool expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Click stepper to navigate back | Any multi-step wizard allows backward navigation — forward-only feels broken | Low | `uiStore.setWizardStep()` already exists; only `WizardStepper.vue` needs click handler |
| Topology change confirmation | Destroying workload data silently is a data-loss bug, not a missing feature | Medium | `inputStore.workloadDomains`, dialog component, `hasNonDefaultData()` pattern already in `DomainTabStrip` |
| Domain duplication | "Copy domain" is expected in any multi-domain configurator — re-entering 26 fields is a UX failure | Medium | `inputStore.addDomain()` + deep clone using `structuredClone(toRaw(...))` pattern |
| Per-domain charts in result cards | Charts that show only WLD-1 data when multiple domains exist is a visible bug | Medium | Chart components need `domainId` prop; remove hardcoded `[0]` bridge |
| Localized exports (MD + PPTX) | Exports in English while UI is in French/German/Italian is jarring and unprofessional | Medium | `i18n.global.t()` is already accessible outside components via named export |

## Differentiators

Features that set this tool apart. Not universally expected, but add meaningful value.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Chart images in PPTX slides | Transforms text-only slides into visual deliverables; meaningful for customer presentations | High | `vue-chartjs` ref to `.chart.toBase64Image()` then pptxgenjs `slide.addImage({ data: ... })` |
| In-app Markdown preview before download | Lets users verify content before downloading; reduces the export-open-re-export cycle | Medium | `marked` library (not currently a dependency) + DOMPurify for safe `v-html` rendering |
| Landing / intro view on first load | Reduces cold-start confusion for new users; explains the 3-step flow | Low-Medium | `uiStore` or `sessionStorage` for "has seen intro" flag; ephemeral state only |

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| `window.confirm()` for topology change dialog | Blocks the event loop; not stylable; fails on mobile browsers; visually inconsistent | Build a proper Vue modal component with `<Teleport to="body">` and Tailwind backdrop |
| `window.confirm()` escalation for intro skip | Same modal consistency concern | Use sessionStorage flag + simple conditional render |
| `html2canvas` for chart rasterization | Already rejected in PITFALLS.md — web fonts fail, bundle 5-15 MB, layout collapses | Use `chartInstance.toBase64Image()` — Chart.js native method, zero extra dependency |
| Server-side PDF with chart images embedded | Client-only constraint — no backend | `window.print()` already has `print:hidden` on canvas and `print:table` fallback |
| `localStorage` for "has seen intro" | Persists too long; URL-shared links should show the tool directly | `sessionStorage` or a simple in-memory ref in `uiStore` |
| Markdown editor in preview panel | Overkill; this is a read-only preview before download | Read-only rendered HTML via `marked` + DOMPurify |
| Per-locale export file naming (e.g., `rapport-vcf.md`) | Deferred to post-v3.3 per PROJECT.md Out of Scope | Hardcode filename, translate content only |

---

## Feature Details

### F1: Click WizardStepper Step to Navigate Back

**Category:** Table stakes

**Expected UX behavior:**
- Completed steps (green badges, `currentWizardStep > s.step`) are clickable.
- The active step badge is not clickable (already there).
- Future steps (grayed out, `currentWizardStep < s.step`) are not clickable — the forward gate still enforces validation.
- Clicking a completed step calls `ui.setWizardStep(s.step)` directly.
- No confirmation needed — going back does not destroy data (panels use `v-show`, data preserved).

**Edge cases:**
- Step 3 to Step 1 jump must be allowed (skipping step 2 on back-nav).
- URL-hydrated sessions: topology is auto-confirmed in `main.ts`, so all step indicators will show as completed. User should be able to jump to step 2 or 3 from step 1 after URL hydration, but this is gated by the existing `topologyConfirmed` flag — acceptable.
- Cursor: clickable steps need `cursor-pointer`; non-clickable steps need `cursor-default`.

**Implementation pattern:**
In `WizardStepper.vue`, compute `isClickable(s.step)` as `s.step < ui.currentWizardStep`, add `@click="if (isClickable(s.step)) ui.setWizardStep(s.step)"`, and add visual affordance (hover ring or underline on clickable completed steps).

**Complexity:** Low — 10 to 20 lines of change in one component.
**Dependencies on existing:** `uiStore.setWizardStep()` already exists; no new store mutations required.

---

### F2: Landing / Intro View on First Load

**Category:** Differentiator

**Expected UX behavior:**
- On first page load (no URL state), show a brief intro screen before the wizard.
- Intro shows: tool name, purpose (1-2 sentences), the 3-step flow, and a "Get started" button.
- Clicking "Get started" dismisses the intro and shows step 1 of the wizard.
- If URL state is present (shared link), skip the intro entirely — jump directly to step 1 with data hydrated.
- Refreshing the page during a session does not re-show the intro (sessionStorage or uiStore ref).

**Edge cases:**
- URL hydration path in `main.ts` must set the "has seen intro" flag to avoid showing the intro on shared-link open.
- Must NOT serialize the "has seen intro" flag to URL state (WIZARD-07 analogy — ephemeral UI state only).
- The intro is not a blocking modal — it replaces the wizard view for first load only.

**Implementation pattern:**
Add `introSeen ref<boolean>` to `uiStore`. Set it on: (a) user clicks "Get started", (b) `hydrateFromUrl()` finds URL state. In `App.vue`, wrap the wizard content with `v-if="ui.introSeen"` and add a `LandingView` component shown with `v-else`. Do NOT use `localStorage` — session-scoped only.

**Content for intro (must be i18n-keyed):** Tool title, one-line purpose, 3-step description, "Get started" button label.

**Complexity:** Low-Medium — new `LandingView.vue` component, 2 lines in `uiStore`, 1 condition in `App.vue`. All text via i18n keys.
**Dependencies on existing:** `uiStore`, `i18n`, URL hydration path in `main.ts`.

---

### F3: Topology Change Confirmation Dialog

**Category:** Table stakes

**Expected UX behavior:**
- When user changes topology (step 1) AND at least one workload domain has non-default data, show a confirmation dialog.
- Dialog explains: "Changing topology resets all workload domain configurations. Continue?"
- Two actions: "Cancel" (dismiss, keep current topology) and "Confirm" (apply new topology, proceed).
- If no workload domain has non-default data (fresh session or all defaults), change topology silently — no dialog shown.
- The `hasNonDefaultData()` function already exists in `DomainTabStrip.vue` — extract to a shared utility.

**Edge cases:**
- `window.confirm()` is already used in `DomainTabStrip` for delete — this feature must NOT continue that pattern; use a proper Vue modal for visual consistency and mobile compatibility.
- The topology change triggers `setGlobalTopology()` which atomically writes to `managementDomain.deploymentMode` AND all `workloadDomains[].deploymentMode` — this must still happen on confirmation.
- Dialog must be accessible: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape key dismisses.
- Vue `<Teleport to="body">` for correct stacking context above the fixed header.

**Implementation pattern:**
- Extract `hasAnyDomainNonDefaultData()` to `src/engine/defaults.ts` or a shared composable (CALC-01 compliant if in engine).
- Create `ConfirmDialog.vue` in `src/components/shared/` accepting `title`, `message`, `confirmLabel`, `cancelLabel` props plus `confirm`/`cancel` emits.
- In `TopologySelector.vue`, intercept topology button clicks: if `hasAnyDomainNonDefaultData()`, show the dialog; on confirm proceed with `setGlobalTopology()`.
- Store dialog open state locally in `TopologySelector.vue` — not in `uiStore` (ephemeral interaction state).

**Complexity:** Medium — new modal component, logic extraction, event wiring.
**Dependencies on existing:** `TopologySelector`, `inputStore.workloadDomains`, `createDefaultWorkloadDomain`.

---

### F4: Domain Duplication ("Copy Domain" Button)

**Category:** Table stakes

**Expected UX behavior:**
- A "Copy" button appears on the active domain tab (or as an action button near the tab strip).
- Clicking it creates a new domain that is an exact copy of the active domain.
- The copy gets a new unique `id` (via `crypto.randomUUID()`).
- The copy gets a name like "WLD-1 (copy)" — append " (copy)" to the source domain name.
- The active tab switches to the newly created copy domain.

**Edge cases:**
- Deep clone is required. `WorkloadDomainConfig` has 26 scalar fields — shallow spread `{ ...domain }` works here because there are no nested objects or arrays in the type. However, `structuredClone(toRaw(domain))` is the safe, future-proof pattern given Pinia Proxy wrapping.
- The `deploymentMode` on the copy must match the global topology (already guaranteed since it is set from `managementDomain.deploymentMode` atomically — the copy will preserve the correct value).
- Name collision: if user already has "WLD-1 (copy)", creating another copy should not silently produce a duplicate name. Simple approach: append incrementing suffix "(copy 2)", "(copy 3)".
- The copy should appear immediately after the source domain in the tab order, not at the end.

**Implementation pattern:**
Add `duplicateDomain(id: string)` to `inputStore`:
- Find source domain by id.
- Create copy with `{ ...structuredClone(toRaw(source)), id: crypto.randomUUID(), name: computedCopyName }`.
- Insert after the source position using `splice(idx + 1, 0, copy)`.
- Set `activeDomainIndex` to `idx + 1`.

Add a "Copy" button in `DomainTabStrip.vue` adjacent to the active tab, or as a dedicated action near the "+ Add domain" button.

**Complexity:** Medium — store action + button + i18n key. Deep clone safety is the main concern.
**Dependencies on existing:** `inputStore`, `DomainTabStrip`, `createDefaultWorkloadDomain` (for `hasNonDefaultData` reference), `toRaw` from Vue.

---

### F5: Chart Images (PNG) Embedded in PPTX Slides

**Category:** Differentiator (HIGH value — transforms text slides into visual deliverables)

**Expected UX behavior:**
- PPTX slides include chart images alongside or in place of the existing data tables.
- Charts show required vs available data (cores, RAM, storage) — matching what the user sees in the UI.
- Image resolution is sufficient for projector/screen (Chart.js default 96 DPI canvas is acceptable for PPTX).
- Graceful fallback: if chart canvas is not available (e.g., called before DOM renders), skip the image and keep the table.

**Technical mechanism (HIGH confidence — verified against official docs):**
1. `vue-chartjs` exposes the underlying Chart.js instance via template ref: `const barRef = ref(null)` then `barRef.value.chart` gives the `Chart` instance.
2. `Chart.toBase64Image()` returns `"data:image/png;base64,..."` — a full data URL including the `data:image/png;base64,` prefix.
3. pptxgenjs `slide.addImage({ data: "image/png;base64,...", x, y, w, h })` expects the string WITHOUT the `data:` prefix — just `"image/png;base64,..."`. Strip `"data:"` from the Chart.js output before passing to pptxgenjs.
4. Coordinates in pptxgenjs are in inches. A typical chart image: `w: 4, h: 2.5` fits on a standard 10 x 7.5 inch slide with a table beside it.

**Critical constraint:** `generatePptxReport()` is called from `ExportToolbar.vue` (a component context) but the export logic lives in `usePptxExport.ts` (a plain TS module, not a Vue component). The chart canvas elements live in `DomainResultCard` child components. There is no direct access to chart canvas refs from within the composable.

**Resolution pattern:** Charts must pass their `toBase64Image()` data upward. Two options:

Option A (recommended): Add a `getChartImages()` helper that chart sub-components expose via `defineExpose({ chart })`. `ResultsPanel.vue` or `ExportToolbar.vue` collects refs and builds an image data map keyed by `domainId`. This map is passed as an argument to `generatePptxReport(chartImages)`.

Option B: Add a `chartImages` ref to `uiStore` that chart components populate on mount and update. `usePptxExport.ts` reads from `uiStore`. This couples uiStore to chart rendering — acceptable but less clean.

Option A keeps CALC-01/CALC-02 constraints clean. Option B is simpler but creates a new uiStore concern.

**Edge cases:**
- Chart animation must complete before `toBase64Image()` is called, or the image will be blank or partially rendered. Solution: add `animation: false` to chart options, or call `chart.stop()` followed by `chart.update('none')` before capture.
- Each workload domain has 3 charts (Cores, RAM, Storage). With 5 domains = 15 chart images. PPTX file size will grow. Per-domain slides already exist — one image set per domain slide is the correct mapping.
- The `data:` prefix strip: `toBase64Image().replace('data:', '')` — straightforward string operation.

**Complexity:** High — requires component ref chain, `defineExpose`, data passing to composable, pptxgenjs image placement layout.
**Dependencies on existing:** `usePptxExport.ts`, chart components, `ExportToolbar.vue`, vue-chartjs chart instance access. Requires F6 to be implemented first.

---

### F6: Per-Domain Chart.js Visualizations in Result Cards

**Category:** Table stakes (existing charts show only WLD-1 — a visible defect when multiple domains exist)

**Expected UX behavior:**
- Each `DomainResultCard` shows its own Cores, RAM, and Storage bar charts reflecting that domain's data.
- Charts are scoped to the domain they appear in, not shared/global.
- The three chart components currently accept no props and read from `domainResults.value[0]` directly. They need a `domainId` prop or `result` data props to scope their data.

**Implementation pattern:**
- Refactor `CoresChart.vue`, `RamChart.vue`, `StorageChart.vue` to accept a `ComputeResult` or `StorageResult` directly as props (preferred over domainId for testability — no store access needed).
- In `DomainResultCard.vue`, pass the per-domain result data as props to each chart component.
- The hardcoded bridge comment `// First-domain bridge — charts show first domain until Phase 14 multi-domain export` explicitly calls out this debt — this is the phase to clear it.

**Edge cases:**
- After refactoring, chart components should NOT access the store at all — they should receive all needed data as props. This makes them pure presentational components and improves testability.
- The print fallback tables inside each chart component must also be scoped to the domain data (currently reference `compute?.totalCoresRequired` — these will naturally follow the prop if refactored correctly).
- Dark mode coloring logic uses `usePreferredDark()` — this stays in the component and remains correct.

**Complexity:** Medium — prop interface change on 3 components + 1 card component update. The main work is removing store coupling from chart components.
**Dependencies on existing:** `DomainResultCard.vue`, `CoresChart.vue`, `RamChart.vue`, `StorageChart.vue`, `DomainResult` type from `src/engine/types`.

---

### F7: Localized Markdown + PPTX Exports

**Category:** Table stakes (Swiss multi-language audience; EN-only exports are a professionalism gap)

**Expected UX behavior:**
- When user has selected FR, DE, or IT in the UI, the exported Markdown and PPTX use translated labels and section headings matching the active locale.
- Numbers follow locale formatting (Markdown/PPTX currently use raw `.toFixed()` strings — acceptable for this milestone as a first pass).
- Validation warning messages in exports are translated (currently exported as i18n keys like `validation.hostCount.tooFew`).
- The generated file is still named `vcf-sizing-report.md` / `.pptx` regardless of locale (per-locale filenames are explicitly deferred post-v3.3).

**Technical mechanism (HIGH confidence — verified in codebase):**
The `i18n` instance is a named export from `src/i18n/index.ts`. The instance uses `legacy: false`, so `i18n.global.locale` is a `Ref<string>`. The `t()` function is accessible as `i18n.global.t('key')` from any plain TS module without component context.

`generateMarkdownReport()` and `generatePptxReport()` are both plain TS functions that already import from `@/stores/...`. Adding `import { i18n } from '@/i18n'` and replacing hardcoded English strings with `i18n.global.t('some.key')` is the complete change required.

**Sections that need translation in Markdown:**
- Section headings: "Management Architecture", "Management Domain Overhead", "Domain: {name}", "Host Configuration", "Workload Profile", etc.
- Table headers: "Parameter", "Value", "Resource", "Required", "Metric", etc.
- Dynamic values: `'dedicated'` / `'colocated'` mapped to `t('deployment.architecture.dedicated')`, etc.
- Validation severity labels: `[ERROR]` / `[WARNING]` translated.

**Sections that need translation in PPTX:**
- Slide titles and table row headers in all `buildXxxSlideData()` helper functions.
- `buildAggregateSlideData()` row labels ("Management hosts", "Total VM count", etc.).

**Edge cases:**
- When `locale` is `'fr'` in `uiStore`, the actual i18n locale is `'fr-CH'` (set by `loadLocale()`). `i18n.global.locale.value` returns `'fr-CH'`. The `t()` function will resolve against `'fr-CH'` messages — correct behavior.
- If locale messages for a key are not loaded yet (lazy-loading scenario), `i18n.global.t()` falls back to `'en'`. This is safe — the export is triggered by user action after the locale file is already loaded.
- PPTX table cells with translated German text may have different widths. Column width is fixed in pptxgenjs — German labels are typically 30% longer. Monitor for text overflow in slides; widen label column or use smaller `fontSize` if needed.
- New i18n keys will be required for export-specific labels not currently in locale files (section headings like "Host Configuration" that only appear in exports, not in the UI).

**Complexity:** Medium — mechanical replacement of hardcoded strings with `i18n.global.t()` calls, plus new i18n keys in all 4 locale JSON files.
**Dependencies on existing:** `src/i18n/index.ts` (exports `i18n`), `useMarkdownExport.ts`, `usePptxExport.ts`, locale JSON files.

---

### F8: In-App Markdown Preview Panel Before Download

**Category:** Differentiator

**Expected UX behavior:**
- A "Preview" button in `ExportToolbar` (or inline in the results panel) shows a modal/panel with the rendered Markdown as formatted HTML.
- Panel has a scrollable content area, a "Download" button (triggers the existing `handleExportMarkdown()` flow), and a "Close" button.
- Preview renders Markdown as formatted HTML (headings, bold text, tables, code blocks) — not raw Markdown text.
- Preview matches active locale (calls `generateMarkdownReport()` which will use `i18n.global.t()` after F7 is implemented).
- No editing — read-only.

**Library choice: `marked` (recommended):**
- `marked` is the standard Markdown-to-HTML library. Latest version is v17.x (2025). Zero dependencies. ~10 KB gzipped for browser.
- Does NOT sanitize output — `DOMPurify` must be used with `v-html` binding to prevent XSS.
- The report content is generated from typed store data (no user-provided free text), so XSS risk is low, but DOMPurify is still the correct pattern. Domain names entered by the user pass through templates and could contain Markdown syntax.
- Alternative: `micromark` (lower-level, more complex). Avoid: `showdown` (older, larger bundle).
- Combined option: `safe-marked` (npm package wrapping `marked` + DOMPurify together) — zero-config safe default.

**XSS safety:** `DOMPurify.sanitize(html)` removes script injection while preserving legitimate table and heading HTML.

**Implementation pattern:**
```
marked(generateMarkdownReport()) → raw HTML string
DOMPurify.sanitize(rawHtml) → safe HTML string
<div v-html="safeHtml" class="prose prose-sm max-w-none" />
```

Use Tailwind `prose` typography classes from `@tailwindcss/typography` plugin for styled rendering, OR write minimal custom table/heading styles (avoids adding another dependency).

**Edge cases:**
- Preview panel must be `print:hidden` — it must not appear in print/PDF output.
- The panel should be lazy — only call `generateMarkdownReport()` when the panel is opened, not on every render cycle.
- Long reports (many domains) produce large HTML. Scrollable container with `max-h-[70vh] overflow-y-auto` is required.
- "Download" inside preview should trigger download and optionally close the panel.

**Complexity:** Medium — new modal component, `marked` plus DOMPurify as new dependencies, lazy invocation.
**Dependencies on existing:** `ExportToolbar.vue`, `generateMarkdownReport()`, F7 (export localization — ideally implemented first so preview shows localized content).
**New dependencies:** `marked` (~10 KB gzipped), `dompurify` (~7 KB gzipped). Total bundle addition: ~17 KB — acceptable.

---

## Feature Dependencies

```
F6 (per-domain charts) must precede F5 (chart PNG in PPTX)
  Chart components need domainId/result props before chart refs can be collected for export.

F7 (localized exports) should precede F8 (Markdown preview)
  Preview shows the same content as the download. If F7 is implemented first,
  preview is localized from day one. Building F8 before F7 produces an English-only preview.

F3 (topology confirmation dialog) has no upstream dependencies — self-contained.
F1 (clickable stepper) has no upstream dependencies — purely additive.
F2 (landing view) has no upstream dependencies — new component plus uiStore flag.
F4 (domain duplication) has no upstream dependencies — additive store action plus button.
```

---

## MVP Recommendation

Ship in this order to maximize value and minimize rework:

**First batch (independent, low-risk):**
1. F1 — Clickable stepper steps (trivial, immediate UX win)
2. F4 — Domain duplication (independent, high practical value)
3. F2 — Landing intro view (independent, first-impression improvement)

**Second batch (medium complexity, foundational for export):**
4. F6 — Per-domain charts (clears the known WLD-1 bridge debt; prerequisite for F5)
5. F7 — Localized exports (foundational for F8; mechanical but requires many i18n key additions)

**Third batch (higher complexity, depends on second batch):**
6. F3 — Topology change confirmation dialog (requires new modal component; share ConfirmDialog.vue with F8)
7. F8 — Markdown preview panel (depends on modal infrastructure from F3; benefits from F7 localization)
8. F5 — Chart images in PPTX (highest complexity; depends on F6 prop refactor)

**Defer from this milestone (per PROJECT.md):**
- Dark mode print stylesheet
- Domain drag-and-drop reordering
- Per-locale export file naming

---

## Phase-Specific Warnings

| Feature | Likely Pitfall | Mitigation |
|---------|---------------|------------|
| F5 (chart PNG) | `toBase64Image()` returns blank if called during Chart.js animation | Disable animation on chart instances: `animation: false` in chart options, or call `chart.stop()` before capture |
| F5 (chart PNG) | pptxgenjs `addImage({ data })` expects `"image/png;base64,..."` NOT `"data:image/png;base64,..."` | Strip the `data:` prefix from the Chart.js data URL before passing to pptxgenjs |
| F6 (per-domain charts) | Removing `storeToRefs` coupling from chart components may break existing tests | Update chart component tests to pass props directly |
| F7 (localized exports) | German labels in PPTX table cells are ~30% longer than English — fixed column widths may truncate | Test PPTX output with DE locale; widen label column or use smaller `fontSize` |
| F7 (localized exports) | `i18n.global.t()` in a plain TS module requires the `i18n` singleton imported from `src/i18n/index.ts` | Import the already-created `i18n` singleton — do not call `createI18n()` again |
| F8 (markdown preview) | `v-html` with unsanitized content is a XSS vector even with generated content | Always pipe through `DOMPurify.sanitize()` before binding to `v-html` |
| F8 (markdown preview) | `@tailwindcss/typography` plugin adds ~20 KB and requires Tailwind config update | If not already installed, write minimal custom prose styles instead |
| F3 (topology dialog) | `window.confirm()` is already used in `DomainTabStrip` — must not add another call | Build `ConfirmDialog.vue` once; consider replacing the existing DomainTabStrip usage for consistency |
| F2 (landing view) | URL-hydrated sessions must bypass the landing view | Set `introSeen` to `true` in the `hydrateFromUrl()` path in `main.ts` |
| F1 (clickable stepper) | Step 3 to Step 1 jump skips step 2 gates — but going BACK skips no gates correctly | Only allow clicking on COMPLETED steps (`s.step < currentWizardStep`), never on future steps |

---

## Sources

- Vue 3 wizard stepper patterns: [Quasar Stepper](https://quasar.dev/vue-components/stepper/) — `beforeLeave` navigation guard pattern
- Chart.js API: [Chart.js API docs](https://www.chartjs.org/docs/latest/developers/api.html) — `toBase64Image()` method
- vue-chartjs chart instance access: [vue-chartjs guide](https://vue-chartjs.org/guide/) — template ref `.chart` property
- pptxgenjs image API: [PptxGenJS Images](https://gitbrent.github.io/PptxGenJS/docs/api-images.html) — `addImage({ data: "image/png;base64,..." })`
- Deep clone Pinia proxy: [Pinia discussion #1412](https://github.com/vuejs/pinia/discussions/1412) — `structuredClone(toRaw(...))` pattern
- vue-i18n outside component: [vue-i18n Composition API](https://vue-i18n.intlify.dev/guide/advanced/composition) — `i18n.global.t()` on exported instance
- Vue 3 confirmation dialog: [LogRocket — promise modals](https://blog.logrocket.com/promise-handling-complex-modals-vue-3/)
- Vue 3 Teleport modal: [DEV Community — Teleport + Tailwind](https://dev.to/alvarosabu/create-modals-with-vue3-teleport-tailwindcss-48aj)
- Accessible focus trap: [Telerik — focus trap in Vue 3 modal](https://www.telerik.com/blogs/how-to-trap-focus-modal-vue-3)
- marked library: [marked.js](https://marked.js.org/) — v17.x, zero-dependency, browser-compatible
- DOMPurify XSS: [DOMPurify GitHub](https://github.com/cure53/DOMPurify)
- safe-marked (marked + DOMPurify combined): [safe-marked GitHub](https://github.com/azu/safe-marked)
- Codebase inspection: `WizardStepper.vue`, `DomainTabStrip.vue`, `DomainResultCard.vue`, `CoresChart.vue`, `useMarkdownExport.ts`, `usePptxExport.ts`, `uiStore.ts`, `inputStore.ts`, `src/i18n/index.ts`, `App.vue`, `defaults.ts`
