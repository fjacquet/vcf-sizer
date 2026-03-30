---
phase: 8
slug: pptx-core-slides
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npx vitest run src/composables/usePptxExport.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/composables/usePptxExport.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 0 | PPTX-01..09 | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 1 | PPTX-15 | unit | `npm install pptxgenjs && npm run build` | ✅ after W0 | ⬜ pending |
| 8-02-02 | 02 | 1 | PPTX-01,02 | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ✅ after W0 | ⬜ pending |
| 8-02-03 | 02 | 1 | PPTX-03..09 | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ✅ after W0 | ⬜ pending |
| 8-03-01 | 03 | 2 | PPTX-01 | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/composables/usePptxExport.test.ts` — create test file with Pinia-backed failing tests for all data-mapping helpers (buildTitleSlideData, buildConfigSummaryData, buildWorkloadSlideData, buildMgmtOverheadData, buildComputeResultsData, buildStorageResultsData, buildRecommendationsData); includes PPTX-01 async function existence check and PPTX-02 master color assertion

*Note: pptxgenjs itself uses browser globals (Blob, URL.createObjectURL) so `generatePptxReport()` cannot be tested end-to-end in Vitest node env. Tests cover pure data-mapping helpers only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser downloads .pptx file | PPTX-01 | `pres.writeFile()` uses browser Blob API unavailable in node Vitest | Click "Download PPTX" button; confirm .pptx file downloaded |
| Slide master Broadcom blue applied to all slides | PPTX-02 | Visual PowerPoint inspection | Open .pptx in PowerPoint/LibreOffice; verify all slides use #003087 accent color |
| pptxgenjs not in synchronous bundle | PPTX-15 | Bundle analysis | Run `npx vite build --report`; verify pptxgenjs appears in async chunk only |
| All 7 slides present and correctly populated | PPTX-03..09 | Visual PowerPoint inspection | Open .pptx; verify 7 slides with correct titles and data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
