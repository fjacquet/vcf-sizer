# Project Research Summary

**Project:** vcf-sizer v3.3 — UX Polish & Export Quality
**Domain:** Vue 3 SPA enhancement (wizard UX, dialog, Markdown preview, chart-to-PPTX)
**Researched:** 2026-04-10
**Confidence:** HIGH

## Executive Summary

VCF Sizer v3.3 is a focused polish milestone targeting 8 concrete improvements to wizard navigation, domain management, and export quality. Research confirms that 7 of the 8 features require zero new runtime dependencies — all needed primitives exist in the already-installed stack (Vue 3.5, Pinia 3, @vueuse/core 14, Chart.js 4, vue-chartjs 5, pptxgenjs 4, vue-i18n 11). The only net-new runtime addition is `marked ^15` + `dompurify ^3.3.3` (~20 KB gzipped combined) for the in-app Markdown preview panel. The existing architectural constraints (CALC-01, CALC-02, WIZARD-07, EXPORT-PURE) continue to apply and shape every integration decision — all 8 features respect those contracts without modification to the engine or calculation store.

The recommended build sequence is bottom-up: store-layer foundations first (uiStore additions, inputStore actions, i18n key namespace), then independent UI features, then chart refactoring, and finally export enrichment. The chart image pipeline (F5+F6) is the most architecturally complex piece because it must bridge the DOM layer (chart canvas) with a headless composable (usePptxExport.ts). The chosen pattern — a `chartImages` registry in uiStore that chart components populate via `registerChartImage()` — keeps the composable testable and pure while giving components sole responsibility for DOM access.

The top risk cluster centers on the Chart.js canvas capture pipeline: blank PNGs from animation timing, null chart refs in Composition API, canvas ID collisions across domain cards, and dataURL prefix format mismatches with pptxgenjs. All four have documented mitigations: disable animation on per-domain charts, use `Chart.getChart(canvasId)` rather than vue-chartjs template refs, inject per-domain canvas IDs derived from `domain.id`, and pass the full `data:image/png;base64,...` string to `addImage`. A secondary risk is the locale load race condition — export buttons must be disabled during `localeLoading` so that `i18n.global.t()` calls inside composables resolve against the correct locale's message bundle rather than falling back silently to English.

---

## Key Findings

### Recommended Stack

The existing stack needs minimal additions. Seven of eight features are implemented entirely within installed dependencies. Only the Markdown preview panel (F8) adds packages.

**Stack additions for v3.3:**

| Library | Version | Purpose | Bundle cost |
|---------|---------|---------|------------|
| `marked` | `^15.0.12` | Markdown string to HTML for in-app preview | ~12 KB gzipped |
| `dompurify` | `^3.3.3` | XSS-sanitize marked output before `v-html` | ~8 KB gzipped |

**Existing libraries relied upon by new features (no upgrade needed):**

- `@vueuse/core ^14.2.1` — `useConfirmDialog` composable for the topology change dialog (F3)
- `chart.js ^4.5.1` — `.toBase64Image()` on Chart instances captures canvas PNG for PPTX embedding (F5)
- `vue-chartjs ^5.3.3` — per-domain chart components; instance accessed via `Chart.getChart(canvasId)` in Composition API (F5/F6)
- `pptxgenjs ^4.0.1` — `slide.addImage({ data: 'data:image/png;base64,...' })` accepts the full dataURL format (F5)
- `vue-i18n v11` — `i18n.global.t()` via exported singleton from `src/i18n/index.ts` for export composable localization (F7)
- `crypto.randomUUID()` — browser-native API (no import required) for new domain IDs in F4

**Pin `marked` at `^15.x`:** v16+ drops CommonJS build (irrelevant for Vite ESM but signals instability); v18 requires TypeScript v6. Stay on v15 until the ecosystem stabilizes.

**What NOT to add:**
- `html2canvas` — already rejected project-wide; blank canvases off-screen, ~200 KB bundle
- `@headlessui/vue` — unnecessary overhead for a single modal; `useConfirmDialog` from @vueuse/core already covers the need
- `sanitize-html` — Node.js DOM shim adds ~100 KB to browser bundle; DOMPurify is DOM-native at 8 KB
- `@types/dompurify` — types are bundled in dompurify v3.x; do not add separately
- Any new CSS component library — Tailwind v4 is the established styling layer; `@tailwindcss/typography` may be needed for Markdown preview, but verify Tailwind v4 Oxide compatibility before adding

**See STACK.md** for full version compatibility matrix, bundlephobia-verified sizes, and alternatives considered.

---

### Expected Features

**Must have (table stakes) — visible gaps or data-loss risks if absent:**

| Feature | Why critical |
|---------|-------------|
| F1: Clickable wizard stepper steps | Forward-only wizard navigation feels broken in any multi-step form |
| F3: Topology change confirmation | Silent data destruction on topology switch is a data-loss bug, not a UX gap |
| F4: Domain duplication | Re-entering 26 typed fields for a near-identical domain is a UX failure |
| F6: Per-domain charts in result cards | Charts showing only WLD-1 data when multiple domains exist is a visible correctness defect |
| F7: Localized Markdown + PPTX exports | EN-only exports while the UI is in FR/DE/IT is a professionalism gap for the Swiss audience |

**Should have (differentiators — meaningful added value):**

| Feature | Value |
|---------|-------|
| F5: Chart PNG in PPTX slides | Transforms text-only slides into visual deliverables for customer presentations |
| F8: In-app Markdown preview | Eliminates the export-open-re-export cycle; lets users verify content before downloading |
| F2: Landing / intro view | Reduces cold-start confusion for new users; explains the 3-step flow on first load |

**Explicitly deferred (post-v3.3 per PROJECT.md):**
- Dark mode print stylesheet
- Domain drag-and-drop reordering
- Per-locale export file naming (e.g., `rapport-vcf.md`)

**Anti-features — do not build these:**
- `window.confirm()` for topology dialog or any new confirmation — not stylable, blocks event loop, mobile-incompatible
- Markdown editor inside preview panel — read-only preview is the correct scope
- `localStorage` for landing view "has seen" flag — use `uiStore.isLandingVisible` ref (session-scoped only)
- `window.print()` changes — print path is unchanged; canvas elements already have `print:hidden` fallback tables

**Feature dependency constraints:**
- F6 (per-domain charts) must be implemented before F5 (PPTX chart images) — chart components need `domainId` prop and `registerChartImage()` wiring before PNG capture can work
- F7 (localized exports) should be implemented before F8 (Markdown preview) — otherwise preview shows English-only content

**See FEATURES.md** for per-feature UX specification, edge cases, and the ordered MVP recommendation.

---

### Architecture Approach

v3.3 adds two new store concerns to `uiStore` (landing visibility + chart image registry), one new action to `inputStore` (domain duplication), six new components, and six modified components. The calculation engine and `calculationStore` are untouched — all new features are pure UI or export-layer concerns. The chart image pipeline is the only cross-layer integration: per-domain chart components register PNG data URLs into `uiStore.chartImages` on render; `usePptxExport.ts` reads from that registry at export time, preserving the EXPORT-PURE constraint (no DOM access from composables).

**New components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| `LandingView.vue` | `src/components/shared/` | First-load intro screen; dismissed by user or auto-dismissed on URL hydration |
| `ConfirmationDialog.vue` | `src/components/shared/` | Reusable modal; used by topology change (F3); reusable for future needs |
| `DomainCoresChart.vue` | `src/components/results/charts/` | Per-domain cores bar chart; prop-driven; registers PNG into chartImages |
| `DomainRamChart.vue` | `src/components/results/charts/` | Per-domain RAM bar chart; same pattern |
| `DomainStorageChart.vue` | `src/components/results/charts/` | Per-domain storage breakdown chart; same pattern |
| `MarkdownPreview.vue` | `src/components/results/` | In-app rendered Markdown with DOMPurify sanitization |

**Modified components:**

| Component | What changes |
|-----------|-------------|
| `WizardStepper.vue` | Completed step pills gain `@click` to call `ui.setWizardStep(n)` (F1) |
| `TopologySelector.vue` | Intercepts topology button clicks; shows ConfirmationDialog when workloads exist (F3) |
| `DomainTabStrip.vue` | Adds Copy button per tab that calls `inputStore.duplicateDomain(id)` (F4) |
| `DomainResultCard.vue` | Embeds three per-domain chart components below the utilization grid (F6) |
| `ExportToolbar.vue` | Adds Preview button that renders MarkdownPreview panel (F8) |
| `App.vue` | Wraps main layout in `v-if="!ui.isLandingVisible"` with `<LandingView>` as `v-else` (F2) |

**uiStore additions:**

| Addition | Type | Purpose | URL-safe? |
|----------|------|---------|-----------|
| `isLandingVisible` | `ref<boolean>` | Landing view display flag | No — WIZARD-07 applies |
| `dismissLanding()` | action | Sets `isLandingVisible = false` | — |
| `chartImages` | `ref<Record<string, Record<string, string>>>` | Chart PNG registry keyed by domainId + chartType | No — ephemeral session state |
| `registerChartImage(domainId, type, dataUrl)` | action | Called by per-domain chart components after render | — |

**inputStore additions:**

| Addition | Type | Purpose |
|----------|------|---------|
| `duplicateDomain(id: string)` | action | Deep-clones using `structuredClone(toRaw(source))`; inserts after source; activates clone |

**calculationStore:** No changes.

**Composable changes:**
- `useMarkdownExport.ts` — replace all hardcoded English labels with `i18n.global.t('export.*')` calls
- `usePptxExport.ts` — same localization change plus `slide.addImage()` from `uiStore.chartImages` with graceful fallback to table-only slides when images absent

**See ARCHITECTURE.md** for full data flow diagrams, component map, anti-pattern list, and 7-phase build order.

---

### Critical Pitfalls

**PITFALL-1 — Blank PNG from Chart.js animation timing**
`toBase64Image()` called during a Chart.js animation returns a white canvas. No error is thrown — the PPTX generates successfully with blank images. Prevention: set `animation: false` on all per-domain chart components. This is the correct tradeoff for a utility tool where export correctness outweighs entry animation aesthetics.

**PITFALL-2 — vue-chartjs Composition API `ref.chart` returns null**
`chartRef.value.chart` is null in Composition API (confirmed GitHub issue #1012). Prevention: use `Chart.getChart(canvasId)` with a stable per-domain canvas ID instead. Assign the canvas `id` attribute as `cores-chart-${domain.id}` inside each chart component.

**PITFALL-3 — `useI18n()` throws in plain TypeScript composables**
`useI18n()` requires an active Vue component setup context. The export composables are intentionally plain TypeScript (EXPORT-PURE). Prevention: import the `i18n` singleton from `src/i18n/index.ts` and use `i18n.global.t('key')` directly. This is the documented vue-i18n pattern for use outside component contexts.

**PITFALL-4 — `structuredClone` throws on Pinia reactive proxy**
`structuredClone(domain)` throws DOMException because Pinia wraps state in Vue reactive proxies. Prevention: always unwrap first — `structuredClone(toRaw(domain))`. Using shallow spread `{ ...domain }` works today (all 26 fields are primitives) but is fragile against future nested fields; `structuredClone(toRaw(...))` is the canonical future-proof pattern.

**PITFALL-5 — Topology partial write leaves inconsistent store state**
Inserting an async confirmation dialog mid-flight breaks the atomic topology write if the store is written optimistically. Prevention: capture `pendingTopology` in a local `ref<DeploymentMode | null>` before any store write; only call `setGlobalTopology()` on user confirmation. Mixed `deploymentMode` values between management and workload domains produce incorrect sizing calculations.

**PITFALL-7 — pptxgenjs `addImage` dataURL format mismatch**
Stripping the `data:` prefix from `toBase64Image()` output before passing to pptxgenjs produces "Red X" shapes in PowerPoint. Prevention: pass the full `data:image/png;base64,...` string directly to `addImage({ data: ... })` without any string manipulation.

**PITFALL-8 — Canvas ID collisions across multiple DomainResultCards**
Static canvas `id` attributes (e.g., `id="cores-chart"`) cause `Chart.getChart()` to return the first registered instance for all domains. Prevention: inject a `canvasId` prop derived from `domain.id` into each chart component (`cores-chart-${domain.id}`).

**PITFALL-9 — XSS via `v-html` in Markdown preview**
Domain names entered by users are interpolated verbatim into the Markdown report. `<script>` tags in domain names become live HTML after Markdown parsing. Prevention: always pipe through `DOMPurify.sanitize()` before binding to `v-html`. The `dompurify` package added for F8 covers this.

**PITFALL-10 — Locale load race condition on export button click**
If the user switches locale and immediately clicks Export, `i18n.global.t()` may still return English because the lazy-loaded locale JSON has not resolved. Prevention: add `localeLoading` ref to uiStore; disable export buttons while it is true.

**PITFALL-13 — LandingView showing on URL-hydrated sessions**
Using `localStorage` or a new InputStateSchema field to track "has seen landing" breaks URL-shared links. Prevention: gate landing view exclusively on `topologyConfirmed` — `hydrateFromUrl()` already calls `ui.confirmTopology()`, so URL-hydrated sessions automatically skip the landing with no additional logic.

**See PITFALLS.md** for the full list including moderate and minor pitfalls with source citations.

---

## Implications for Roadmap

Based on combined research, v3.3 maps to 7 sequential phases. Store foundations must precede all component work; chart refactoring must precede PPTX chart embedding; export localization should precede Markdown preview so the preview shows correct locale from day one.

### Phase 1: Store Foundations + i18n Keys

**Rationale:** Every other phase depends on store additions and i18n key files. Chart image registry, landing visible flag, and domain duplication action must exist before any component work begins. The `export.*` i18n namespace must be populated before export localization can be tested. Building this first eliminates circular dependencies across all subsequent phases.

**Delivers:** `uiStore` additions (`isLandingVisible`, `dismissLanding`, `chartImages`, `registerChartImage`); `inputStore.duplicateDomain()`; `export.*` key namespace added to all 4 locale JSON files (en, fr, de, it).

**Addresses:** Prereqs for F2, F4, F5/F6, F7

**Avoids:** PITFALL-5 (store changes established cleanly before component wiring prevents mid-flight partial writes)

**Research flag:** Standard patterns — no phase research needed.

---

### Phase 2: Wizard Navigation + Landing View

**Rationale:** Purely additive and independent of all other features. WizardStepper click-back is a single template change using the already-existing `setWizardStep()`. LandingView is a new component using the `isLandingVisible` flag from Phase 1.

**Delivers:** Clickable completed wizard step indicators (F1); first-load landing screen that auto-dismisses on URL hydration (F2).

**Addresses:** F1, F2

**Avoids:** PITFALL-6 (only completed steps clickable — never allow forward jumps that bypass validation gates); PITFALL-13 (landing gated on `topologyConfirmed`, not localStorage or InputStateSchema)

**Research flag:** Standard patterns — no phase research needed.

---

### Phase 3: Domain Duplication

**Rationale:** Self-contained; uses `duplicateDomain()` from Phase 1 but requires no chart or dialog work. High practical value with contained risk.

**Delivers:** "Copy" button per domain tab that deep-clones the domain, assigns new UUID, inserts after source position, activates the clone (F4).

**Addresses:** F4

**Avoids:** PITFALL-4 (`toRaw()` before `structuredClone` to unwrap Pinia proxy); PITFALL-11 (future-proof cloning even if nested fields are added later)

**Research flag:** Standard patterns — no phase research needed.

---

### Phase 4: Per-Domain Charts in Result Cards

**Rationale:** Must precede F5 (PPTX chart images). Chart components need `domainId` prop and `registerChartImage()` wiring before PNG capture can work. This phase also clears the known first-domain bridge debt in `CoresChart`, `RamChart`, `StorageChart`.

**Delivers:** `DomainCoresChart`, `DomainRamChart`, `DomainStorageChart` as prop-driven components; `DomainResultCard` updated to embed them; global first-domain bridge charts removed from `ResultsPanel`; per-domain canvas IDs set from `domain.id` (F6).

**Addresses:** F6

**Avoids:** PITFALL-1 (animation disabled on per-domain charts); PITFALL-2 (use `Chart.getChart(canvasId)` not `chartRef.value.chart`); PITFALL-8 (canvas IDs derived from `domain.id` to prevent collisions)

**Research flag:** Needs validation — confirm `Chart.getChart(canvasId)` lookup timing relative to vue-chartjs v5.3.x render lifecycle. The `watch({ flush: 'post' })` pattern for registering chart images needs empirical verification in the actual dependency version. GitHub issue #1012 confirms the `ref.chart` null behavior; the `Chart.getChart()` workaround timing is the open question.

---

### Phase 5: Topology Confirmation Dialog

**Rationale:** Builds `ConfirmationDialog.vue` as a shared component reusable in Phase 7 (Markdown preview panel close). Isolating dialog infrastructure in its own phase keeps Phase 7 focused on the preview content, not the modal scaffolding.

**Delivers:** `ConfirmationDialog.vue` shared component with `<Teleport to="body">` and Tailwind styling; topology change guard in `TopologySelector.vue` with local `pendingTopology` ref pattern (F3).

**Addresses:** F3

**Avoids:** PITFALL-5 (local `pendingTopology` captured before any store write; only commits on confirmation); PITFALL-12 (styled modal instead of `window.confirm()` for UX consistency)

**Research flag:** Standard patterns — `useConfirmDialog` from @vueuse/core is stable and well-documented.

---

### Phase 6: Localized Exports + PPTX Chart Images

**Rationale:** Requires i18n keys from Phase 1 AND chart image registry populated by Phase 4. Both composables are modified together since they share the same i18n singleton import pattern and export pipeline. PPTX chart embedding is included here because it uses the same `usePptxExport.ts` file being modified for localization.

**Delivers:** `useMarkdownExport.ts` with `i18n.global.t()` for all labels and section headings; `usePptxExport.ts` with same localization plus `slide.addImage()` for per-domain chart PNGs; `localeLoading` guard on export buttons in `ExportToolbar.vue` (F5, F7).

**Addresses:** F5, F7

**Avoids:** PITFALL-3 (use `i18n.global.t()` not `useI18n()`); PITFALL-7 (pass full dataURL with `data:image/png;base64,...` prefix to `addImage`); PITFALL-10 (disable export buttons while `localeLoading` is true)

**Research flag:** Empirical verification needed — run a German-locale PPTX export early in this phase to check whether fixed pptxgenjs column widths truncate longer German/Italian label text. If they do, widen the label column or reduce `fontSize` before writing tests. This is a presentation concern, not a correctness blocker.

---

### Phase 7: Markdown Preview Panel

**Rationale:** Last phase — benefits from F7 localization (preview shows correct locale from day one) and reuses `ConfirmationDialog.vue` infrastructure pattern from Phase 5. Adds `marked` + `dompurify` as the only net-new npm packages.

**Delivers:** `MarkdownPreview.vue` with DOMPurify-sanitized rendered HTML; "Preview" button in `ExportToolbar.vue`; dynamic `import('marked')` on first open to keep it out of the initial bundle (F8).

**Addresses:** F8

**Avoids:** PITFALL-9 (DOMPurify sanitize before `v-html` to prevent XSS from user-entered domain names); PITFALL-15 (dynamic import of `marked` using same pattern as pptxgenjs — loaded on demand, not in initial bundle)

**Research flag:** Verify Tailwind v4 Oxide engine compatibility with `@tailwindcss/typography` plugin before adding it. If not compatible, use `[&_table]`, `[&_h2]`, `[&_h3]` deep-selector manual styles in a scoped style block instead. Check `package.json` first — if `prose` class is already available, no action needed.

---

### Phase Ordering Rationale

- Phase 1 is the unblocking foundation — uiStore refs and i18n keys are prerequisites for most downstream work.
- Phases 2 and 3 are fully independent and could be built in parallel by separate developers; they share no component dependencies.
- Phase 4 (chart refactor) must strictly precede Phase 6 (PPTX chart embedding) because `uiStore.chartImages` is only populated after the per-domain chart components are wired to call `registerChartImage()`.
- Phase 5 (`ConfirmationDialog.vue`) precedes Phase 7 so the modal infrastructure is tested and available for reuse.
- Phase 6 (localized exports) precedes Phase 7 (Markdown preview) so the preview renders localized content from day one instead of requiring a later rework.
- Phases 6 and 7 cannot be parallelized without coordination — both modify `ExportToolbar.vue`.

---

### Research Flags Summary

| Phase | Research Needed? | Why |
|-------|-----------------|-----|
| Phase 1 (Store foundations) | No | Standard Pinia `ref()` additions and locale JSON files |
| Phase 2 (Wizard navigation) | No | Single template change using existing `setWizardStep()` |
| Phase 3 (Domain duplication) | No | Pure store action + button; `structuredClone(toRaw())` pattern is documented |
| Phase 4 (Per-domain charts) | Yes | vue-chartjs `Chart.getChart()` timing vs `watch({ flush: 'post' })` needs empirical verification |
| Phase 5 (Topology dialog) | No | `useConfirmDialog` from @vueuse/core is stable and well-documented |
| Phase 6 (Localized exports) | Partial | German PPTX column width overflow needs empirical test early in phase |
| Phase 7 (Markdown preview) | Partial | Tailwind v4 + `@tailwindcss/typography` compatibility needs verification before adding dep |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All key claims verified against official docs and live bundlephobia data (2026-04-10); only 2 new packages needed |
| Features | HIGH | Direct codebase inspection; existing constraints documented with precision; edge cases catalogued per feature |
| Architecture | HIGH | Grounded in direct inspection of all stores, composables, components, and engine files from the v3.1 baseline |
| Pitfalls | HIGH | Multiple pitfalls verified against specific GitHub issues (Chart.js #2743, vue-chartjs #1012, Pinia #1412, pptxgenjs #283, #1351) |

**Overall confidence:** HIGH

### Gaps to Address

- **vue-chartjs Composition API chart instance access timing:** The `Chart.getChart(canvasId)` workaround is prescribed, but the exact timing (mount event vs. `watch({ flush: 'post' })` vs. custom `chart-render` event) needs confirmation against vue-chartjs v5.3.x. Address in Phase 4 before writing chart component tests.

- **Tailwind v4 + `@tailwindcss/typography` compatibility:** If the Oxide engine does not support the typography plugin, Phase 7 must fall back to manual `[&_table]` deep-selector styles. Verify by checking `package.json` and attempting plugin installation before beginning Phase 7. Not a blocking risk — the fallback is straightforward.

- **German/Italian PPTX column width:** Fixed column widths in pptxgenjs slides may truncate labels that are 30% longer in German or Italian than in English. Requires an empirical test export during Phase 6; not a blocking concern but should be caught before the phase is marked complete.

- **`marked` v15 dynamic import named export under Vite 8:** The `await import('marked')` pattern returning `{ marked }` is consistent with the ESM specification and the pattern established by pptxgenjs in this codebase. Verify the named export shape in a quick integration test during Phase 7.

---

## Sources

### Primary (HIGH confidence)
- Chart.js API docs — `toBase64Image()` method, `animation: false` option, `Chart.getChart()` static registry method
- vue-chartjs official guide — chart instance access via template ref; Composition API behavior
- pptxgenjs Images API docs — `addImage({ data })` parameter format specification
- VueUse `useConfirmDialog` docs — headless confirmation composable API and Promise-based resolve pattern
- vue-i18n Composition API guide — `i18n.global.t()` usage outside Vue component setup context
- marked.js GitHub releases — v15 vs v16/v17/v18 breaking change documentation
- DOMPurify GitHub — v3.3.3 stable; bundled TypeScript types
- Bundlephobia live API (2026-04-10) — `marked@15.0.12`: 38 034 min / 11 678 gz; `dompurify@3.3.3`: 21 436 min / 8 281 gz
- Direct codebase inspection — all stores, composables, components, and engine files from v3.1 baseline

### Secondary (MEDIUM confidence)
- vue-chartjs GitHub issue #1012 — Composition API `ref.chart` null behavior; `Chart.getChart()` workaround
- Pinia GitHub discussion #1412 — `structuredClone` DOMException on reactive proxies; `toRaw()` fix
- Chart.js GitHub issue #2743 — blank PNG from animation timing; `animation: false` fix
- pptxgenjs GitHub issues #283, #1351 — `addImage` Red X from missing dataURL prefix

### Tertiary (LOW confidence — verify during implementation)
- Tailwind v4 Oxide + `@tailwindcss/typography` compatibility — not directly verified; check before Phase 7
- `marked` v15 ESM named export shape under Vite 8 dynamic import — inferred from pptxgenjs pattern in codebase; verify in Phase 7

---
*Research completed: 2026-04-10*
*Ready for roadmap: yes*
