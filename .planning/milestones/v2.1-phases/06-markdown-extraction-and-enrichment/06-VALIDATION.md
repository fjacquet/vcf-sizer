---
phase: 6
slug: markdown-extraction-and-enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- src/composables/useMarkdownExport.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/composables/useMarkdownExport.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | MD-01 | unit | `npm test -- src/composables/useMarkdownExport.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | MD-01 | unit | `npm test` (no regression in useUrlState tests) | ✅ | ⬜ pending |
| 6-01-03 | 01 | 2 | MD-02 | unit | `npm test -- src/composables/useMarkdownExport.test.ts` | ✅ after W0 | ⬜ pending |
| 6-01-04 | 01 | 2 | MD-03 | unit | `npm test -- src/composables/useMarkdownExport.test.ts` | ✅ after W0 | ⬜ pending |
| 6-01-05 | 01 | 2 | MD-04 | unit | `npm test -- src/composables/useMarkdownExport.test.ts` | ✅ after W0 | ⬜ pending |
| 6-01-06 | 01 | 2 | MD-05 | unit | `npm test -- src/composables/useMarkdownExport.test.ts` | ✅ after W0 | ⬜ pending |
| 6-01-07 | 01 | 2 | MD-06 | unit | `npm test -- src/composables/useMarkdownExport.test.ts` | ✅ after W0 | ⬜ pending |
| 6-01-08 | 01 | 2 | MD-07 | unit | `npm test -- src/composables/useMarkdownExport.test.ts` | ✅ after W0 | ⬜ pending |
| 6-01-09 | 01 | 2 | MD-08 | unit | `npm test -- src/composables/useMarkdownExport.test.ts` | ✅ after W0 | ⬜ pending |
| 6-01-10 | 01 | 2 | MD-09 | unit | `npm test -- src/composables/useMarkdownExport.test.ts` | ✅ after W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/composables/useMarkdownExport.test.ts` — rewrite existing stub for Pinia-backed composable using `createPinia()` + `setActivePinia()` test setup; include failing tests for all 9 MD requirements before implementation

*Note: `vitest.config.ts` already configured with `environment: 'node'` and `globals: true` — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Markdown file downloads correctly via browser | MD-01 | Browser download API not testable in node Vitest | Click Export Markdown button; confirm `.md` file downloaded and opens with correct content |
| All 9 sections visible in downloaded file | MD-02..09 | Full browser integration | Open downloaded file; verify each section header present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
