---
phase: 18
slug: store-foundations-wizard-navigation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --reporter=verbose src/stores` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --reporter=verbose src/stores`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | WIZARD-01 | — | N/A | unit | `npm run test -- src/stores/uiStore.test.ts` | ✅ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | WIZARD-02 | — | N/A | unit | `npm run test -- src/stores/uiStore.test.ts` | ✅ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | WIZARD-01 | — | N/A | unit | `npm run test` | ✅ | ⬜ pending |
| 18-02-02 | 02 | 2 | WIZARD-02 | — | N/A | unit | `npm run test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/uiStore.test.ts` — add failing tests for `isLandingVisible`, `dismissLanding()`, `chartImages`, `registerChartImage()` before implementing
- [ ] `src/stores/uiStore.test.ts` — add failing tests for `setWizardStep()` backward navigation (WIZARD-01 click-back semantics)

*Existing infrastructure: Vitest + node env already configured. No new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LandingView renders with correct i18n text | WIZARD-02 | DOM rendering not covered by Vitest node env | Open dev server, verify landing screen appears on fresh load |
| Click step 2 badge returns to step 2 content | WIZARD-01 | DOM interaction | Complete steps 1+2, click step 1 badge, verify step 1 panel shows |
| URL hydration bypasses landing view | WIZARD-02 | Requires URL with ?s= param | Open shared URL, verify landing screen does NOT appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
