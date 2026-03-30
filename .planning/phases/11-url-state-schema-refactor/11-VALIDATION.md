---
phase: 11
slug: url-state-schema-refactor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (node environment) |
| **Quick run command** | `npx vitest run src/composables/useUrlState.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/composables/useUrlState.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must have 0 new failures beyond the 58 pre-existing composable failures from Phase 10
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | URL-01, URL-02, URL-03, URL-04 | unit (RED) | `npx vitest run src/composables/useUrlState.test.ts 2>&1 \| tail -3` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | URL-01 | unit | `npx vitest run src/composables/useUrlState.test.ts 2>&1 \| tail -3` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | URL-02 | unit | `npx vitest run src/composables/useUrlState.test.ts 2>&1 \| tail -3` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 1 | URL-03, URL-04 | unit | `npx vitest run src/composables/useUrlState.test.ts 2>&1 \| tail -3` | ❌ W0 | ⬜ pending |
| 11-01-05 | 01 | 2 | URL-01..04 | integration | `npm run test 2>&1 \| tail -5` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/composables/useUrlState.test.ts` — rewritten with stubs for URL-01..04 (multi-domain round-trip, v2.x degradation, activeTabIndex absent, URL length constraint)

*The existing useUrlState.test.ts references old flat InputStateSchema (20 tests that will all fail). Wave 0 replaces these with new tests before any composable changes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| v2.x URL in browser address bar → default state, no crash | URL-02 | Requires live browser | Load app, paste a v2.x compressed URL, verify one WLD-1 domain renders |
| 5-domain URL in address bar → all 5 domains hydrate correctly | URL-03 | Requires live browser + UI (built in Phase 12) | Can be deferred to Phase 12 E2E |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
