---
phase: 9
slug: pptx-conditional-slides-and-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 9 — Validation Strategy

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
| 9-01-01 | 01 | 0 | PPTX-10..14 | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ✅ | ⬜ pending |
| 9-02-01 | 02 | 1 | PPTX-10,11 | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ✅ | ⬜ pending |
| 9-02-02 | 02 | 1 | PPTX-12,13,14 | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/composables/usePptxExport.test.ts` — extend existing file with 5 new `describe` blocks for conditional slide helpers: `buildAiGpuSlideData`, `buildNvmeTieringSlideData`, `buildStretchTopologySlideData`, `buildVsanMaxSlideData`, `buildValidationWarningsData`. Tests should fail (RED) until Wave 1 implements the helpers.

*Note: Existing `createPinia() + setActivePinia()` setup already in place — new describe blocks follow same pattern.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI/GPU slide appears when gpuVmCount > 0 | PPTX-10 | Binary .pptx inspection | Set GPU VMs > 0, download PPTX, confirm AI/GPU slide present |
| NVMe slide appears when tiering enabled | PPTX-11 | Binary .pptx inspection | Enable NVMe tiering, download PPTX, confirm NVMe slide present |
| Stretch topology slide conditional | PPTX-12 | Binary .pptx inspection | Set stretch mode, download PPTX, confirm stretch slide present |
| vSAN Max slide conditional | PPTX-13 | Binary .pptx inspection | Set vSAN Max storage, download PPTX, confirm vSAN Max slide present |
| Validation warnings slide conditional | PPTX-14 | Binary .pptx inspection | Trigger a validation error, download PPTX, confirm warnings slide present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
