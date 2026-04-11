---
phase: 23-markdown-preview-panel
plan: 02
subsystem: ui
tags: [export-toolbar, markdown-preview, vue3, integration]

requires:
  - phase: 23-markdown-preview-panel
    plan: 01
    provides: MarkdownPreviewPanel.vue component, marked + dompurify deps, i18n keys
provides:
  - Preview button in ExportToolbar wired to MarkdownPreviewPanel
  - Complete EXPORT-03 feature: in-app Markdown preview with XSS sanitization
affects: []

tech-stack:
  added: []
  patterns: [v-if toggle for modal open/close, localeLoading guard on preview button]

key-files:
  created: []
  modified:
    - src/components/results/ExportToolbar.vue

key-decisions:
  - "Preview button placed first in toolbar (before Share URL) for discoverability"
  - "localeLoading guard applied to preview button matching existing export button pattern (PITFALL-10, T-23-02)"

requirements-completed: [EXPORT-03]

duration: 2min
completed: 2026-04-11
---

# Phase 23 Plan 02: Wire Preview into ExportToolbar Summary

**Preview button added to ExportToolbar with localeLoading guard, wired to MarkdownPreviewPanel via open/close ref toggle**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-11T16:53:32Z
- **Completed:** 2026-04-11T16:55:08Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added Preview button as first button in ExportToolbar with disabled state during locale loading
- Imported MarkdownPreviewPanel and wired with previewOpen ref for open/close toggle
- Build passes with marked and dompurify in separate lazy-loaded chunks (confirmed in build output)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire MarkdownPreviewPanel into ExportToolbar.vue** - `8dd54ad` (feat)
2. **Task 2: Verify Markdown Preview end-to-end** - Auto-approved checkpoint (no code changes)

## Files Modified
- `src/components/results/ExportToolbar.vue` - Added Preview button, imported MarkdownPreviewPanel, added previewOpen ref

## Decisions Made
- Preview button placed first in toolbar row for discoverability, before Share URL button
- localeLoading guard applied to preview button to prevent English fallback race (PITFALL-10, T-23-02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Threat Model Verification
- T-23-01 (XSS via v-html): Mitigated by DOMPurify.sanitize() in MarkdownPreviewPanel (from Plan 01)
- T-23-02 (Locale race condition): Mitigated by `:disabled="uiStore.localeLoading"` on Preview button

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED
- ExportToolbar.vue: FOUND
- MarkdownPreviewPanel.vue: FOUND
- Commit 8dd54ad: FOUND

---
*Phase: 23-markdown-preview-panel*
*Completed: 2026-04-11*
