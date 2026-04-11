# Architecture Decision Records

## ADR-001: Strict Layer Separation

**Status:** Accepted
**Context:** The codebase mixes sizing logic, reactive state, and UI rendering. Without clear boundaries, engine logic becomes untestable and tightly coupled to Vue.
**Decision:** Three layers with hard rules: Engine (`src/engine/`) is pure TypeScript with zero Vue imports (CALC-01). `calculationStore` contains zero `ref()` -- only `computed()` that call engine functions (CALC-02). Components read from stores and never call engine functions directly.
**Consequences:** Engine functions are fully testable in Node without jsdom. Adding a new sizing formula requires no Vue knowledge. Store layer acts as a one-way data bridge between mutable inputs and derived calculations.

## ADR-002: URL State Serialization

**Status:** Accepted
**Context:** Users need shareable links that reproduce an exact sizing configuration. A backend database would add deployment complexity for a static GitHub Pages site.
**Decision:** `useUrlState.ts` serializes `inputStore` to JSON, compresses with lz-string, and appends as a URL query parameter. On load, `hydrateFromUrl()` decompresses and validates through a Zod schema using `.strip()` to discard unknown keys. All fields are optional with defaults.
**Consequences:** No backend required. `.strip()` provides forward and backward compatibility -- old URLs with removed fields still load. URL length is bounded by lz-string compression (~2-4 KB for typical configs).

## ADR-003: Dynamic Import for Heavy Libraries

**Status:** Accepted
**Context:** Libraries like pptxgenjs (~300 KB), marked, and dompurify add significant weight to the initial bundle but are only needed during export operations.
**Decision:** Use dynamic `import()` for pptxgenjs, marked, and dompurify. They are loaded on demand when the user triggers an export action (PPTX-15 pattern).
**Consequences:** Initial bundle stays small. First export has a brief loading delay. Tree-shaking is unaffected since these are full library imports regardless.

## ADR-004: i18n in Export Composables

**Status:** Accepted
**Context:** Export composables (`useMarkdownExport`, `usePptxExport`) are plain TypeScript modules, not Vue components. Calling `useI18n()` outside a Vue component `setup()` context throws a runtime error.
**Decision:** Use `i18n.global.t()` from the singleton instance exported by `src/i18n/index.ts` instead of the `useI18n()` composable (PITFALL-3).
**Consequences:** Exports are fully translatable. Composables remain pure TypeScript with no Vue lifecycle dependency. The locale is always current because `i18n.global.locale` is reactive.

## ADR-005: Chart PNG Capture

**Status:** Accepted
**Context:** Exporting domain sizing results to PPTX/Markdown requires embedding chart images. `vue-chartjs` Composition API does not reliably expose `.chart` on template refs (vue-chartjs #1012).
**Decision:** Use `Chart.getChart(canvasId)` to retrieve chart instances. Set `animation: false` on all per-domain charts to guarantee `toBase64Image()` returns a fully rendered frame (Chart.js #2743). Canvas IDs are derived from `domain.id` to prevent collisions across multiple DomainResultCards.
**Consequences:** Reliable PNG capture across all domains. No animation means charts appear instantly, which is acceptable for a sizing tool.

## ADR-006: XSS Sanitization

**Status:** Accepted
**Context:** Domain names are user-supplied free text. When rendered through Markdown into `v-html`, unsanitized input creates an XSS vector.
**Decision:** Run `DOMPurify.sanitize()` on all HTML before binding to `v-html` in the MarkdownPreview component (PITFALL-9). DOMPurify is loaded via dynamic import alongside marked.
**Consequences:** User-supplied content is safe to render. Adds ~8 KB gzipped to the export chunk. Sanitization is centralized in the Markdown preview path.

## ADR-007: Pinia Reactive Proxy Cloning

**Status:** Accepted
**Context:** Duplicating a domain object from the Pinia store using bare `structuredClone()` throws because `structuredClone` cannot serialize Vue reactive proxies (Pinia #1412).
**Decision:** The canonical clone pattern is `structuredClone(toRaw(obj))`. `toRaw()` unwraps the reactive proxy first, then `structuredClone()` produces a deep plain copy.
**Consequences:** Domain duplication works reliably. All store cloning code must follow this two-step pattern -- bare `structuredClone` on store objects is a bug.

## ADR-008: Swiss Locale Configuration

**Status:** Accepted
**Context:** Swiss French, German, and Italian use distinct number formatting (e.g., apostrophe as thousands separator) that differs from their parent locales (fr, de, it).
**Decision:** Define explicit `numberFormats` for `fr-CH`, `de-CH`, and `it-CH` in the i18n configuration. Do not inherit from parent locales. Swiss locales are lazy-loaded on demand via `uiStore.setLocale`.
**Consequences:** Numbers display correctly for Swiss users. Each Swiss locale file is self-contained. Adding a new locale requires explicit number format definition.
