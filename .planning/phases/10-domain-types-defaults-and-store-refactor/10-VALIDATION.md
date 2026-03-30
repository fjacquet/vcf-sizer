---
phase: 10
slug: domain-types-defaults-and-store-refactor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (node environment) |
| **Quick run command** | `npx vitest run src/engine/ src/stores/` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/engine/ src/stores/`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green (182+ tests passing)
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 0 | DOM-01, DOM-02, DOM-03 | unit (RED) | `npx vitest run src/stores/inputStore.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | DOM-01, DOM-02, DOM-03 | unit | `npx vitest run src/engine/types.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | DOM-04 | unit | `npx vitest run src/engine/defaults.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-04 | 01 | 1 | DOM-01, DOM-04 | unit | `npx vitest run src/stores/inputStore.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 0 | DOM-05, DOM-06 | unit (RED) | `npx vitest run src/stores/calculationStore.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | DOM-05, DOM-06 | unit | `npx vitest run src/stores/calculationStore.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 1 | DOM-05, DOM-06 | integration | `npm run test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/inputStore.test.ts` — stubs for DOM-01, DOM-02, DOM-03, DOM-04 (new workloadDomains shape + managementDomain shape + defaults)
- [ ] `src/stores/calculationStore.test.ts` — stubs for DOM-05, DOM-06 (domainResults array + aggregateTotals)
- [ ] `src/engine/defaults.test.ts` — stubs for createDefaultWorkloadDomain() and createDefaultManagementDomain() factory functions

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| vue-tsc clean after store rewrite | DOM-01..06 | Requires vue-tsc full compilation (not just vitest) | Run `./node_modules/.bin/vue-tsc -b tsconfig.app.json --noEmit` — must exit 0 |
| All 182 pre-existing engine tests still pass | DOM-05, DOM-06 | Regression guard for engine purity | Run `npm run test` and confirm count ≥ 182 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
