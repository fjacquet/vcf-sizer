---
phase: 13
slug: per-domain-results-and-aggregate-totals
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 13 — Validation Strategy

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
| 13-01-01 | 01 | 1 | RES-01 | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | RES-02 | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 13-01-03 | 01 | 1 | RES-03 | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 2 | RES-01 | build | `npm run build` | ✅ | ⬜ pending |
| 13-02-02 | 02 | 2 | RES-02 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Domain result cards render in browser | RES-01 | Vue DOM components not covered by node-env Vitest | Run `npm run dev`, open browser, verify each domain card shows domain name, host count, CPU%, RAM%, storage |
| Aggregate totals card renders | RES-02 | Vue DOM components not covered by node-env Vitest | Verify AggregateTotalsCard shows sum of all domain host counts |
| Management domain section unchanged | RES-03 | Vue DOM visual regression | Verify management results section looks identical to v2.x behavior |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
