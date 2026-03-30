---
phase: 14
slug: multi-domain-exports
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | EXP-01, EXP-02 | unit | `npx vitest run src/composables/useMarkdownExport.test.ts` | ✅ | ⬜ pending |
| 14-01-02 | 01 | 1 | EXP-01, EXP-02 | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 14-02-01 | 02 | 2 | EXP-03, EXP-04 | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ✅ | ⬜ pending |
| 14-02-02 | 02 | 2 | EXP-03, EXP-04 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Markdown download contains per-domain sections | EXP-01 | File download in browser | Run `npm run dev`, click Markdown export, verify one `## Domain: {name}` section per domain |
| Markdown ends with aggregate totals section | EXP-02 | File download in browser | Verify `## Aggregate Totals` at end of downloaded .md file |
| PPTX contains one slide per workload domain | EXP-03 | File download in browser | Download PPTX, verify one workload domain slide per domain |
| PPTX aggregate totals slide present | EXP-04 | File download in browser | Verify aggregate totals slide appears after per-domain slides |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
