---
phase: 7
slug: print-pdf-css-overhaul
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-03-30
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (existing) |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (regression check — phase adds no new automated tests)
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green + manual print preview verification
- **Max feedback latency:** 10 seconds (automated); manual verification per wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | PRINT-02 | manual | `npm test` (no regression) | ✅ | ⬜ pending |
| 7-01-02 | 01 | 1 | PRINT-01 | manual | `npm test` (no regression) | ✅ | ⬜ pending |
| 7-01-03 | 01 | 1 | PRINT-03 | manual | `npm test` (no regression) | ✅ | ⬜ pending |
| 7-01-04 | 01 | 2 | PRINT-04 | manual | `npm test` (no regression) | ✅ | ⬜ pending |
| 7-01-05 | 01 | 2 | PRINT-05 | manual | `npm test` (no regression) | ✅ | ⬜ pending |
| 7-01-06 | 01 | 2 | PRINT-06 | manual | `npm test` (no regression) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no new test files are needed for this phase. CSS print behavior cannot be verified with Vitest (node environment, no DOM). All PRINT-0x requirements are validated by manual browser print preview. Existing 142 tests continue to cover engine/composables and act as a regression gate.

*Note: `wave_0_complete: true` is pre-approved because all phase requirements are manual-only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Input panel hidden in print | PRINT-01 | CSS print media — no DOM in Vitest node env | Chrome DevTools → Rendering → Emulate CSS media: print; confirm input pane and toolbar invisible |
| @page margins applied | PRINT-02 | CSS @page — visual validation only | File → Print → Print Preview; check A4 page margins with ruler |
| Cards avoid mid-card breaks | PRINT-03 | CSS fragmentation — visual validation | Expand to multi-page scenario; verify no card splits across pages |
| Header on every page | PRINT-04 | CSS fixed-position in print — visual validation | Print multi-page document; verify header visible on each page |
| Footer on every page | PRINT-05 | CSS fixed-position in print — visual validation | Print multi-page document; verify footer visible on each page |
| Charts hidden, table shown | PRINT-06 | Canvas print blank — visual validation | Chrome print preview; confirm canvas hidden and data table visible for each chart |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (N/A — no new files needed)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
