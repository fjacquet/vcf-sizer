---
phase: 17
slug: wizard-step-content-and-export-accuracy
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-31
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/stores/uiStore.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (vue-tsc type-check)
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** `npm run test && npm run build` must both be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | WIZARD-03, WIZARD-04 | unit | `npx vitest run src/stores/uiStore.test.ts` | ✅ (extend) | ⬜ pending |
| 17-01-02 | 01 | 1 | WIZARD-03 | unit + build | `npm run test && npm run build` | ✅ | ⬜ pending |
| 17-01-03 | 01 | 1 | WIZARD-04 | unit + build | `npm run test && npm run build` | ✅ | ⬜ pending |
| 17-01-04 | 01 | 1 | WIZARD-03, WIZARD-07 | unit | `npx vitest run src/stores/uiStore.test.ts` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 2 | WIZARD-05 | manual + build | `npm run build` | ❌ W0 new | ⬜ pending |
| 17-02-02 | 02 | 2 | WIZARD-06 | manual + build | `npm run build` | ❌ W0 new | ⬜ pending |
| 17-03-01 | 03 | 3 | EXPORT-01 | unit | `npx vitest run src/composables/useMarkdownExport.test.ts` | ✅ (extend) | ⬜ pending |
| 17-03-02 | 03 | 3 | EXPORT-02 | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ✅ (extend) | ⬜ pending |
| 17-03-03 | 03 | 3 | EXPORT-01, EXPORT-02 | full suite | `npm run test && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/uiStore.test.ts` — add tests for `topologyConfirmed` flag and `confirmTopology()` action (WIZARD-03)
- [ ] `src/stores/uiStore.test.ts` — add tests for `isStep2Valid` computed or inline `canGoForward` step-2 gate (WIZARD-04)
- [ ] `src/composables/useMarkdownExport.test.ts` — add test asserting aggregate section contains "Management hosts" row (EXPORT-01)
- [ ] `src/composables/usePptxExport.test.ts` — update `buildAggregateSlideData` test for new 3-argument signature; assert management hosts row appears (EXPORT-02)

*Note: `ManagementResultCard.vue` and `ManagementCommittedSummary.vue` are new Vue components — visual tests require DOM (jsdom) which is outside CLAUDE.md stated test scope. These are verified manually + build type-check.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Step 1 Next button disabled until topology selection confirmed | WIZARD-03 | Requires live UI interaction | 1. `npm run dev` 2. On fresh load, verify Next button is disabled (gray/opacity) 3. Click a topology option — verify Next becomes enabled |
| Step 2 Next button disabled when management domain invalid | WIZARD-04 | Requires UI interaction | 1. Advance to step 2 with dedicated architecture 2. Verify Next button reflects valid/invalid state based on management host count |
| ManagementResultCard shows correct host count in step 2 | WIZARD-05 | Vue component rendering requires DOM | 1. Advance to step 2 (dedicated mode) 2. Verify ManagementResultCard shows dedicated host count 3. Switch to colocated — verify card shows "colocated with WLD-1" |
| ManagementCommittedSummary collapsed by default in step 3 | WIZARD-06 | Requires UI interaction | 1. Advance to step 3 2. Verify summary panel is collapsed (details hidden) 3. Click expand — verify management details are shown and read-only |
| URL hydration skips WIZARD-03 gate | WIZARD-03 | Requires browser URL manipulation | 1. Copy a shareable URL 2. Paste in new tab 3. Verify user can advance from step 1 without re-selecting topology |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
