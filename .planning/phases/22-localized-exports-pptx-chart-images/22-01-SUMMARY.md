---
phase: 22-localized-exports-pptx-chart-images
plan: 01
subsystem: i18n, export
tags: [vue-i18n, i18n, pptxgenjs, markdown, localization, export]

# Dependency graph
requires:
  - phase: 14-multi-domain-export
    provides: multi-domain Markdown and PPTX export composables with hardcoded English strings
provides:
  - export namespace (~100 keys) in all 4 locale JSON files (en, fr, de, it)
  - localeLoading ref in uiStore with try/finally guard
  - Localized useMarkdownExport.ts via i18n.global.t()
  - Localized usePptxExport.ts with t parameter pattern for build helpers
  - ExportToolbar locale-loading guard on MD and PPTX buttons
affects: [22-02-chart-images-pptx, future-export-enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "i18n.global.t() for composable-level localization (PITFALL-3)"
    - "t parameter as last arg with default identity for testable build helpers"
    - "localeLoading ref with try/finally guard in uiStore (PITFALL-10)"

key-files:
  created: []
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/fr.json
    - src/i18n/locales/de.json
    - src/i18n/locales/it.json
    - src/stores/uiStore.ts
    - src/composables/useMarkdownExport.ts
    - src/composables/usePptxExport.ts
    - src/components/results/ExportToolbar.vue
    - src/composables/useMarkdownExport.test.ts
    - src/composables/usePptxExport.test.ts
    - src/stores/uiStore.test.ts

key-decisions:
  - "t parameter as last arg with default identity function (k) => k preserves backward compat and testability"
  - "Slide master footer VMware by Broadcom | VCF Sizer remains hardcoded — brand string not localized"
  - "Validation warnings resolved via t(w.messageKey) in both export formats"
  - "localeLoading uses try/finally to guarantee reset even on fetch failure (T-22-03 mitigation)"

patterns-established:
  - "Export i18n pattern: import { i18n } from @/i18n, const t = i18n.global.t at function top"
  - "Build helper t pattern: t: (key: string) => string = (k) => k as last parameter"
  - "Test i18n mock: vi.mock(@/i18n, () => ({ i18n: { global: { t: (key: string) => key } } }))"

requirements-completed: [EXPORT-02]

# Metrics
duration: 13min
completed: 2026-04-11
---

# Phase 22 Plan 01: Localized Exports Summary

**All export composable strings localized via i18n with ~100 keys across 4 locales, locale-loading guard on export buttons**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-11T16:00:28Z
- **Completed:** 2026-04-11T16:13:56Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Added ~100 export i18n keys to en/fr/de/it locale JSON files covering all hardcoded strings in both export composables
- Localized useMarkdownExport.ts and usePptxExport.ts via i18n.global.t() -- zero hardcoded English labels remain
- Added localeLoading ref to uiStore with try/finally guard to prevent English fallback race
- ExportToolbar disables Markdown and PPTX buttons during locale loading
- All 293 tests pass, type-check clean, production build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Add export i18n keys to all locales + localeLoading guard** - `922583d` (feat)
2. **Task 2: Localize useMarkdownExport + usePptxExport + ExportToolbar guard** - `f1c8f95` (feat)

## Files Created/Modified
- `src/i18n/locales/en.json` - Added 102-key export namespace
- `src/i18n/locales/fr.json` - French translations for export namespace
- `src/i18n/locales/de.json` - German translations for export namespace
- `src/i18n/locales/it.json` - Italian translations for export namespace
- `src/stores/uiStore.ts` - Added localeLoading ref with try/finally in setLocale
- `src/stores/uiStore.test.ts` - Added localeLoading tests (PITFALL-10)
- `src/composables/useMarkdownExport.ts` - All labels use i18n.global.t()
- `src/composables/usePptxExport.ts` - All build helpers accept t param, generatePptxReport uses i18n
- `src/components/results/ExportToolbar.vue` - localeLoading guard on MD/PPTX buttons
- `src/composables/useMarkdownExport.test.ts` - Updated assertions for i18n keys, added i18n mock
- `src/composables/usePptxExport.test.ts` - Updated assertions for i18n keys, pass t to helpers

## Decisions Made
- Used `t` as last parameter with default identity function `(k) => k` to preserve backward compatibility and testability without requiring i18n setup in tests
- Slide master footer "VMware by Broadcom | VCF Sizer" kept as hardcoded brand string, not localized
- Validation warning messageKeys resolved via `t(w.messageKey)` in both Markdown and PPTX exports
- localeLoading guard uses try/finally to guarantee reset even on fetch failure (mitigates T-22-03)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Export localization complete, ready for Phase 22 Plan 02 (chart image embedding in PPTX)
- All locale files have matching export key structures for future additions

---
*Phase: 22-localized-exports-pptx-chart-images*
*Completed: 2026-04-11*
