# Phase 2 Validation Architecture

**Phase:** 02-outputs-charts-and-export
**Created:** 2026-03-28

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run | `npm test` |
| Full suite | `npm test` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Command | File |
|--------|----------|-----------|---------|------|
| EXPORT-01 | URL round-trip: compress + decompress returns identical state | unit | `npm test` | src/composables/useUrlState.test.ts |
| EXPORT-02 | URL hydration: Zod rejects unknown keys; defaults apply for missing fields | unit | `npm test` | src/composables/useUrlState.test.ts |
| EXPORT-01 | URL length: max-complexity config produces URL < 1800 chars | unit | `npm test` | src/composables/useUrlState.test.ts |
| EXPORT-03 | Markdown output: contains required sections (Summary, Compute, Storage) | unit | `npm test` | src/composables/useMarkdownExport.test.ts |
| VIZ-07 | Chart reactivity: no "Maximum update depth exceeded" in browser console | manual | `npm run dev` → browser console | — |

## Wave 0 Test Files to Create

- [ ] `src/composables/useUrlState.test.ts` — covers EXPORT-01, EXPORT-02 URL round-trip and Zod validation
- [ ] `src/composables/useMarkdownExport.test.ts` — covers EXPORT-03 Markdown section presence

## Sampling Rate

- Per task commit: `npm test`
- Per wave merge: `npm test`
- Phase gate: all tests green before verification
