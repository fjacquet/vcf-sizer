---
phase: 12
slug: domain-tab-ui-and-per-domain-input-forms
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 + vue-tsc (type checking) |
| **Config file** | `vitest.config.ts` (node environment) |
| **Quick run command** | `npm run test 2>&1 \| tail -5` |
| **Full suite command** | `npm run build 2>&1 \| tail -10` |
| **Estimated runtime** | ~10 seconds (test), ~30 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test 2>&1 | tail -5` — confirm no new failures beyond pre-existing 58
- **After every plan wave:** Run `npm run build 2>&1 | tail -10` — confirm vue-tsc clean
- **Before `/gsd:verify-work`:** Build must exit 0 (vue-tsc clean); no new test failures
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | UI-01..05 | type-check | `./node_modules/.bin/vue-tsc -b tsconfig.app.json --noEmit 2>&1 \| tail -3` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | FORM-01..05 | type-check | `./node_modules/.bin/vue-tsc -b tsconfig.app.json --noEmit 2>&1 \| tail -3` | ✅ | ⬜ pending |
| 12-02-01 | 02 | 2 | UI-01..05, FORM-01..05 | build | `npm run build 2>&1 \| tail -5` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 test stubs required — Phase 12 is a UI/component phase. Verification is via:

- `vue-tsc` type-checking after each component change
- `npm run build` for final compilation gate
- Manual browser testing for interaction behaviors

*Existing infrastructure covers all phase requirements via type-checking and build.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab strip renders one tab per domain, clicking switches forms | UI-01 | Requires browser rendering | Run `npm run dev`, verify tab strip + form switching |
| Add Domain button creates WLD-N tab with defaults | UI-02 | Requires browser interaction | Click Add Domain, verify new tab + default values |
| Delete button shows confirmation for non-default data | UI-03 | Requires browser interaction | Modify a domain, click delete, verify confirmation dialog |
| Double-click tab label enters inline rename | UI-04 | Requires browser interaction | Double-click tab, type name, verify Enter/blur commits, Escape cancels |
| Management domain section is outside tab strip | UI-05 | Requires visual inspection | Verify management section renders above/below tab strip independently |
| Each form reads/writes to its domain only | FORM-01..05 | Requires browser interaction | Change values in domain 1, switch to domain 2, verify independence |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
