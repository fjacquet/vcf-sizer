# Domain Pitfalls: v3.3 UX Polish & Export Quality

**Domain:** Vue 3 SPA — UX wizard enhancements + Chart.js export integration
**Researched:** 2026-04-10
**Scope:** Integration pitfalls for adding v3.3 features to an existing codebase with established constraints

---

## Critical Pitfalls

These cause broken exports, silent data corruption, or test regressions if not handled.

---

### PITFALL-1: Blank PNG When Rasterizing Chart.js Canvas for PPTX

**What goes wrong:** Calling `chartInstance.toBase64Image()` or `canvas.toDataURL()` immediately after
a user action or component mount returns a completely blank (white) PNG. The PPTX slide embeds a white
rectangle instead of a chart.

**Why it happens:** Chart.js renders via a canvas animation that completes asynchronously. Vue's
`nextTick()` resolves after DOM mutations, not after canvas paint. By the time `nextTick` resolves, the
Chart.js animation has NOT finished drawing. The canvas pixels are still blank.

**Consequences:** Every chart image in the PPTX is a white rectangle. No error is thrown — the PPTX
generates successfully with blank images. The bug only shows up when opening the exported file.

**Prevention:**

Option A (preferred, no animation): Set `animation: false` on the Chart.js instance used for export.
This makes `toBase64Image()` synchronous and safe to call immediately after mount.

Option B (callback): Pass `options.animation.onComplete` callback and capture the image only inside
it. This is complex with vue-chartjs's declarative `:options` pattern and not recommended here.

Option C: Disable animation globally on the per-domain charts. This is a pragmatic tradeoff acceptable
for a utility tool where performance perception is secondary to export correctness.

**Detection warning signs:** PPTX opens with white image shapes where charts should be; no console
error; bug only visible after opening the file.

**Phase that must address it:** Phase implementing "Chart images in PPTX".

---

### PITFALL-2: vue-chartjs ref.chart Null in script setup / Composition API

**What goes wrong:** Accessing `chartRef.value.chart` inside `<script setup>` returns null or
undefined. The chart instance cannot be retrieved via Vue template refs when using the Composition API
with vue-chartjs.

**Why it happens:** vue-chartjs chart components (Bar, Line, etc.) do not expose their internal `chart`
property via `defineExpose()` in the Composition API version. The `ref.chart` pattern only works with
the Options API. This is a confirmed limitation (GitHub issue #1012 on apertureless/vue-chartjs).

**Consequences:** Any parent-level code that tries to call `toBase64Image()` through a template ref
to a chart component silently receives null, causing a TypeError at export time.

**Prevention:** Use `Chart.getChart(canvasId)` instead of relying on the Vue template ref. Assign a
stable `id` attribute to the canvas element within each chart component, then retrieve the instance
via the Chart.js static registry: `Chart.getChart("cores-chart-wld-1")`. The canvas ID must be
per-domain to avoid collisions when multiple DomainResultCards render simultaneously.

**Detection warning signs:** `chartRef.value?.chart` logs null in onMounted; TypeError when calling
`.toBase64Image()`.

**Phase that must address it:** Phase implementing "Chart images in PPTX".

---

### PITFALL-3: i18n t() Not Available in Plain TypeScript Composables

**What goes wrong:** Calling `useI18n()` inside `useMarkdownExport.ts` or `usePptxExport.ts` throws
"Must be called at the top of a setup function" at runtime. Localization cannot be added to these
plain TS composables using the standard vue-i18n composable pattern.

**Why it happens:** `useI18n()` is a Vue composable that requires an active component instance
context. The existing composables are intentionally plain TypeScript with no Vue lifecycle
(CALC-01/CALC-02), so they have no component context.

**Consequences:** Localized strings in Markdown/PPTX output cannot be accessed via the standard path.
Using `i18n.global.t()` directly works but creates a hidden ordering dependency: if the locale is
still loading (lazy-loaded fr/de/it) when export is triggered, `i18n.global.t()` falls back to `en`
silently rather than wait for the load to complete.

**Prevention:**

1. Use `i18n.global.t()` from the exported `i18n` instance in `src/i18n/index.ts` — NOT `useI18n()`.
   The instance is a named export and is always available without a component context.

2. Guard locale loading: before generating the report, verify `i18n.global.locale.value` matches
   `uiStore.locale`. If the user switched locale but the `loadLocale()` promise has not resolved,
   export should await it or the export button should be disabled until locale is loaded.

3. All new i18n keys used in exports MUST be defined in all four locale files (en, fr.json, de.json,
   it.json). Missing keys fall back to `en` silently — the German PPTX will contain English section
   headers with no warning.

**Detection warning signs:** Console warns "Cannot call useI18n..."; export always appears in English
regardless of UI locale; missing translation keys produce the key string in output.

**Phase that must address it:** Phase implementing "Localized Markdown + PPTX exports".

---

### PITFALL-4: structuredClone Fails on Pinia Reactive Proxy Objects

**What goes wrong:** Copying a `WorkloadDomainConfig` from `inputStore.workloadDomains` using
`structuredClone(domain)` throws a `DOMException: Failed to execute 'structuredClone'` because Pinia
reactive proxies are not clonable by the structured clone algorithm.

**Why it happens:** Pinia stores wrap state in Vue reactive proxies. `structuredClone()` only handles
plain serializable values, not Proxy objects. This is confirmed behavior (Pinia GitHub discussion
#1412).

**Consequences:** The "Copy domain" feature crashes at runtime without a build-time error. The failure
only surfaces when the user clicks "Duplicate domain" on a non-trivial configuration.

**Prevention:** Unwrap the proxy before cloning:

```typescript
import { toRaw } from 'vue'
const rawDomain = toRaw(domain)
const copy = structuredClone(rawDomain)
copy.id = crypto.randomUUID()
copy.name = `${rawDomain.name} (copy)`
```

The `addDomain()` action in `inputStore` uses `createDefaultWorkloadDomain()` which handles id
generation. A new `duplicateDomain()` action needs the same id-regeneration logic.

**Detection warning signs:** DOMException in console on "Copy domain" click; test passes with plain
objects but fails with storeToRefs-returned objects.

**Phase that must address it:** Phase implementing "Domain duplication".

---

### PITFALL-5: Topology Confirmation Flag Not Reset After Topology Change Dialog Cancellation

**What goes wrong:** The topology change confirmation dialog is shown when workloads already exist
and the user clicks a different topology button. If the guard is implemented incorrectly — for
example, by writing `deploymentMode` optimistically then rolling back on cancel — the store is left
in an inconsistent state where `managementDomain.deploymentMode !== workloadDomains[0].deploymentMode`.

**Why it happens:** The current `TopologySelector.vue` calls `setGlobalTopology()` on every click
with no guard. `setGlobalTopology()` writes both `deploymentMode` AND calls `ui.confirmTopology()`
atomically. Inserting an async confirmation step mid-flight breaks this atomic guarantee unless the
intent is captured BEFORE writing.

**Consequences:** Mixed topology state causes incorrect sizing calculations and violates the "atomic
topology write" invariant documented in architecture.md. A stretch management domain with HA workload
domains produces wrong host counts.

**Prevention:**

1. Capture the intended new topology in a local variable BEFORE writing to the store.
2. Show the confirmation dialog.
3. Only call `setGlobalTopology(newMode)` if the user confirms.
4. If the user cancels, do not write to the store. The button visually reverts because `currentMode`
   is computed from the store.

The guard logic must live in `TopologySelector.vue` (component layer), not in `uiStore` or
`inputStore`, to keep store actions side-effect-free.

**Detection warning signs:** After cancelling a topology change dialog, `managementDomain.deploymentMode`
differs from `workloadDomains[0].deploymentMode`; URL state round-trip test fails with mixed modes.

**Phase that must address it:** Phase implementing "Topology change confirmation dialog".

---

### PITFALL-6: WizardStepper Click-Back Leaves Stale Management Config From Previous Topology

**What goes wrong:** When a user clicks step 1 from step 2 or 3, `topologyConfirmed` remains `true`,
so the Next button is immediately re-enabled. If the user changes topology in step 1, the management
domain configuration from step 2 (dedicated host count, storage type, host specs) remains from the
old topology. The management domain does NOT auto-reset on topology change — only `deploymentMode` is
written atomically by `setGlobalTopology()`.

**Why it happens:** `setGlobalTopology()` writes `deploymentMode` to all domains but does not reset
`managementDomain` host specs or `managementArchitecture`. Going back to step 1 without resetting
step 2 configuration leaves stale management data.

**Consequences:** A user who configures dedicated management for 6 hosts (valid for HA topology), then
goes back to step 1 and switches to Stretch, then proceeds to step 3 will have a dedicated management
configuration that violates `STRETCH_DEDICATED_MGMT_MIN_HOSTS = 8`. The validation error surfaces in
step 3, not at the point of topology change — confusing and late.

**Prevention:**

1. Gate step indicator clicks to backward navigation only (target step must be <= current step). Never
   allow forward jumps that bypass a gate.
2. Do NOT auto-reset management configuration on topology change — this would be destructive.
3. Display a soft warning in the step 2 management section when the topology has changed since the
   management configuration was last confirmed (compare stored `deploymentMode` with new selection).
4. The topology change confirmation dialog (PITFALL-5) should mention that management configuration
   may need review.

**Detection warning signs:** Validation errors appear in step 3 referencing management host minimum
after a topology change; `dedicatedMgmtHostCount` is inconsistent with the selected topology.

**Phase that must address it:** Phase implementing "Click WizardStepper step to jump back".

---

## Moderate Pitfalls

These cause incorrect output or degraded UX but are recoverable without architectural changes.

---

### PITFALL-7: PPTX addImage dataURL Must Include Full MIME Prefix

**What goes wrong:** Passing a raw base64 string without the `data:image/png;base64,` prefix to
pptxgenjs `addImage({ data: ... })` causes a "red X" placeholder or a "needs repair" dialog in
PowerPoint.

**Why it happens:** pptxgenjs `data` parameter expects the full data URL exactly as returned by
`canvas.toDataURL('image/png')` or `chartInstance.toBase64Image()`. If code strips the prefix (using
`.split(',')[1]`), pptxgenjs cannot detect the image type and generates a malformed slide part.

**Prevention:** Pass the full return value of `toBase64Image()` or `canvas.toDataURL()` directly
to `addImage({ data: dataUrl })` without stripping the prefix. The format should be:
`"data:image/png;base64,iVBOR..."`.

**Detection warning signs:** Red X shapes in PPTX; PowerPoint "repair" dialog on open.

**Phase that must address it:** Phase implementing "Chart images in PPTX".

---

### PITFALL-8: Per-Domain Chart Canvas ID Collisions Across Multiple DomainResultCards

**What goes wrong:** When multiple `DomainResultCard` components render simultaneously, each renders
`CoresChart`, `RamChart`, and `StorageChart`. If these chart components use a static canvas `id`
attribute (e.g. `id="cores-chart"`), Chart.js warns about duplicate canvas IDs and
`Chart.getChart("cores-chart")` returns the first registered instance for all domains.

**Why it happens:** The current chart components are designed for first-domain display only. When
refactored into per-domain charts (v3.3 feature), they receive a domain id as a prop but the canvas
element still needs a unique HTML id for `Chart.getChart()` lookup.

**Consequences:** Chart image capture for PPTX retrieves the wrong domain's chart data. Charts display
correctly visually (Vue reactivity works per component instance) but the PPTX export captures the same
first domain's chart for every domain slide.

**Prevention:** Inject a stable `canvasId` prop into each chart component derived from the domain id:
`canvasId="cores-chart-${domain.id}"`. Bind it to the canvas element's `id` attribute inside the
chart component. Use this ID when calling `Chart.getChart(canvasId)` for export capture.

**Detection warning signs:** Chart.js console warning "Canvas with id ... is already in use"; all
PPTX domain chart images look identical.

**Phase that must address it:** Phase implementing "Per-domain Chart.js visualizations".

---

### PITFALL-9: Markdown Preview XSS via v-html With Unescaped Domain Names

**What goes wrong:** Rendering the Markdown export string via `v-html` without sanitization allows
stored XSS if any user-entered field (most critically, domain names) contains HTML tags. Domain names
are free-text strings entered via the `DomainTabStrip` rename input and are included verbatim in the
Markdown output (e.g. `## Domain: <script>alert(1)</script>`).

**Why it happens:** `generateMarkdownReport()` interpolates `domain.name` directly into the output
string. A Markdown library converts this to `<h2>Domain: <script>...</script></h2>`. Vue's `v-html`
renders this as live HTML.

**Consequences:** This is a stored XSS vector. The impact is limited to the local user session (no
backend persistence), but the attack can execute in the preview panel.

**Prevention:**

Option A (recommended): Sanitize HTML output of the Markdown renderer with DOMPurify before binding
to `v-html`. Use `vue-dompurify-html` directive as a drop-in safe replacement (~18kb gzipped).

Option B: Constrain domain name input to alphanumeric + limited punctuation at the `renameDomain()`
call site in `inputStore.ts`. This is a simpler but less complete mitigation.

The Markdown file download is safe — it is a text file, not rendered HTML. Only the preview panel
via `v-html` is the attack surface.

**Detection warning signs:** Domain name containing `<b>test</b>` renders as bold in preview instead
of as literal characters.

**Phase that must address it:** Phase implementing "In-app Markdown preview panel".

---

### PITFALL-10: Locale Load Race Condition on Export Button Click

**What goes wrong:** User switches to German (de-CH), then immediately clicks "Export PPTX". The
locale file `de.json` is lazy-loaded via `loadLocale('de')` in `uiStore.setLocale()`. If the export
triggers before the dynamic import resolves, `i18n.global.t()` returns English strings because German
messages have not yet been set via `i18n.global.setLocaleMessage()`.

**Why it happens:** `uiStore.setLocale()` is `async` but the `ExportToolbar.vue` buttons are not
guarded against mid-load state. `locale.value` is updated synchronously before messages load.

**Consequences:** Export appears in English even though the UI shows German labels. Silent — no error
is thrown.

**Prevention:**

1. Add a `localeLoading` ref to `uiStore` that is set true during `loadLocale()` and reset on
   resolution.
2. Disable export buttons while `localeLoading` is true.
3. OR: pass locale as a parameter to `generateMarkdownReport()` and `generatePptxReport()` and
   await locale resolution inside the function if needed.

**Detection warning signs:** PPTX section headers appear in English after UI locale is switched to
German/French/Italian; wrong language on first export after locale switch.

**Phase that must address it:** Phase implementing "Localized Markdown + PPTX exports".

---

### PITFALL-11: Domain Copy Creates Fragile Shallow Clone

**What goes wrong:** Using `{ ...domain }` (shallow spread) to copy a `WorkloadDomainConfig` creates
a shallow clone. If any field is an object or array, mutating the copy also mutates the original.

**Why it happens:** JavaScript's spread operator copies one level deep only.

**Consequences:** Currently all 26 fields of `WorkloadDomainConfig` are primitives, so a shallow copy
works today. However this is a latent bug — any future nested object field addition immediately
produces a shared-reference mutation bug in the copy feature.

**Prevention:** Use `structuredClone(toRaw(domain))` (see PITFALL-4) as the canonical copy approach.
Do NOT use `JSON.parse(JSON.stringify(domain))` — this loses `undefined` values and coerces numbers
with potential precision loss.

**Detection warning signs:** Renaming the copied domain also renames the original; changing a value
on the copy changes the source domain.

**Phase that must address it:** Phase implementing "Domain duplication".

---

## Minor Pitfalls

These cause cosmetic issues or test maintenance overhead but have contained impact.

---

### PITFALL-12: window.confirm() Pattern Inconsistency for Topology Dialog

**What goes wrong:** `DomainTabStrip.vue` currently uses `window.confirm()` for domain delete
confirmation. If the topology change confirmation dialog uses a different pattern (styled modal), the
product has two different confirmation UX patterns creating visual inconsistency.

**Prevention:** The v3.3 "Topology change confirmation dialog" should use a styled `<dialog>` or
Teleport-based modal component. The existing `window.confirm()` in DomainTabStrip is tech debt but
out of v3.3 scope. At minimum, do not introduce a third pattern.

**Phase that must address it:** Phase implementing "Topology change confirmation dialog".

---

### PITFALL-13: LandingView First-Load State Conflicts With URL Hydration

**What goes wrong:** Showing a landing/intro view on first load creates a conflict with URL-hydrated
sessions. If the landing check is based on a separate `hasSeenLanding` ref (persisted to localStorage),
the logic must also check whether URL state exists. Getting this wrong shows the landing to users
following a shared link.

**Prevention:** Tie the landing display condition exclusively to `topologyConfirmed`. Show landing when
`!topologyConfirmed`. The `hydrateFromUrl()` path in `main.ts` already calls `ui.confirmTopology()`
which sets `topologyConfirmed = true`, meaning a URL-shared session automatically skips the landing.

Do NOT introduce a new persistent variable for this. Adding it to `InputStateSchema` would violate
WIZARD-07. Using localStorage bypasses the URL-hydration skip logic.

**Phase that must address it:** Phase implementing "Landing / intro view".

---

### PITFALL-14: Chart Animation Disabled for Export Degrades Initial Page Render

**What goes wrong:** Setting `animation: false` on chart components to enable safe `toBase64Image()`
capture (PITFALL-1) disables animation for all contexts including initial page render. Users see
charts appear instantly without the draw animation.

**Prevention:** Accept this tradeoff explicitly for v3.3. VCF Sizer is a utility tool where export
correctness is more important than entry animation. Document the decision. If animation is desired in
a future milestone, implement a separate off-screen canvas render for export capture while keeping
animation on the display canvas.

**Phase that must address it:** Phase implementing "Chart images in PPTX".

---

### PITFALL-15: Markdown Rendering Library Bundle Impact

**What goes wrong:** Adding a Markdown-to-HTML library (`marked`, `showdown`, `markdown-it`) to the
main bundle for the in-app preview panel increases initial bundle size. These libraries range from
~20kb to ~70kb gzipped.

**Prevention:** Use the same dynamic import pattern established for pptxgenjs (PPTX-15). Only load
the Markdown renderer when the preview panel is first opened:

```typescript
const { marked } = await import('marked')
```

`marked` (~23kb gzipped) is sufficient for the table/header Markdown that `generateMarkdownReport()`
produces. `markdown-it` (~45kb) is not needed here.

**Phase that must address it:** Phase implementing "In-app Markdown preview panel".

---

## Phase-Specific Warnings Summary

| Phase Topic | Pitfall ID | Pitfall Name | Mitigation |
|---|---|---|---|
| Click WizardStepper to jump back | PITFALL-6 | Stale management config after topology change | Backward-only clicks; soft step-2 warning if topology changed since step-2 was confirmed |
| Landing / intro view | PITFALL-13 | Conflicts with URL hydration | Gate on `topologyConfirmed` only; no localStorage, no new URL state |
| Topology change confirmation dialog | PITFALL-5 | Partial write leaves inconsistent topology state | Capture intent before writing; guard in component layer only |
| Topology change confirmation dialog | PITFALL-12 | UX pattern inconsistency | Use styled modal; no window.confirm() |
| Domain duplication | PITFALL-4 | structuredClone fails on Pinia proxy | `toRaw()` before structuredClone; new id + new name |
| Domain duplication | PITFALL-11 | Shallow copy breaks on nested fields | Use `structuredClone(toRaw(domain))` exclusively |
| Chart images in PPTX | PITFALL-1 | Blank PNG due to Chart.js animation timing | Disable animation on charts used for capture |
| Chart images in PPTX | PITFALL-2 | vue-chartjs ref.chart null in Composition API | Use `Chart.getChart(canvasId)` with per-domain canvas IDs |
| Chart images in PPTX | PITFALL-7 | addImage dataURL prefix format | Pass full `data:image/png;base64,...` string |
| Chart images in PPTX | PITFALL-14 | Animation disabled degrades page render | Accept tradeoff explicitly; document decision |
| Per-domain Chart.js visualizations | PITFALL-8 | Canvas ID collisions across DomainResultCards | Inject `canvasId` prop from `domain.id` |
| Localized Markdown + PPTX | PITFALL-3 | useI18n() not available in plain TS composables | Use `i18n.global.t()` from exported instance |
| Localized Markdown + PPTX | PITFALL-10 | Locale load race condition on export | Guard export buttons while `localeLoading` is true |
| In-app Markdown preview | PITFALL-9 | XSS via v-html with domain names | Sanitize with DOMPurify via vue-dompurify-html |
| In-app Markdown preview | PITFALL-15 | Bundle size from Markdown renderer | Dynamic import; use `marked` |

---

## CALC-01 / CALC-02 Compliance Checklist

All v3.3 features must maintain the established engine purity contract:

| Feature | Risk | Required check |
|---|---|---|
| Domain duplication (`duplicateDomain()` action) | Must live in `inputStore`, not engine layer | No engine imports in inputStore; no Vue imports in engine |
| Localized exports | `i18n.global.t()` in composable | Composables import from `@/i18n`, never from `@/stores` |
| Markdown preview state | `previewOpen` ref, `previewHtml` computed | Must live in component or uiStore, NOT in calculationStore |
| Chart PPTX capture | Touches DOM via `Chart.getChart()` | Must live in component or `usePptxExport.ts` only |
| Landing view visible flag | Ephemeral UI state | Lives in uiStore only; never in `InputStateSchema` (WIZARD-07) |

---

## Sources

- [Chart.js toBase64Image blank issue — GitHub #2743](https://github.com/chartjs/Chart.js/issues/2743)
- [Chart.js animation onComplete for image capture](https://quickchart.io/documentation/chart-js/image-export/)
- [vue-chartjs Composition API ref.chart null — GitHub #1012](https://github.com/apertureless/vue-chartjs/issues/1012)
- [vue-chartjs Getting Started — chart ref access](https://vue-chartjs.org/guide/)
- [vue-i18n useI18n outside setup — GitHub discussion #1201](https://github.com/intlify/vue-i18n/discussions/1201)
- [vue-i18n Composition API guide](https://vue-i18n.intlify.dev/guide/advanced/composition)
- [Pinia structuredClone proxy error — GitHub discussion #1412](https://github.com/vuejs/pinia/discussions/1412)
- [PptxGenJS addImage API docs](https://gitbrent.github.io/PptxGenJS/docs/api-images.html)
- [PptxGenJS base64 forced 16:9 ratio bug — GitHub #1351](https://github.com/gitbrent/PptxGenJS/issues/1351)
- [PptxGenJS addImage Red X issue — GitHub #283](https://github.com/gitbrent/PptxGenJS/issues/283)
- [Vue 3 security guide — v-html XSS](https://vuejs.org/guide/best-practices/security.html)
- [Markdown XSS vulnerability — showdownjs wiki](https://github.com/showdownjs/showdown/wiki/Markdown's-XSS-Vulnerability-(and-how-to-mitigate-it))
- [DOMPurify bundle size — bundlephobia](https://bundlephobia.com/package/dompurify)
- [vue-dompurify-html — npm](https://www.npmjs.com/package/vue-dompurify-html)
- [Vue 3 Teleport + Tailwind modal pattern](https://dev.to/alvarosabu/create-modals-with-vue3-teleport-tailwindcss-48aj)
