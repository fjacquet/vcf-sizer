---
phase: 19
slug: topology-confirmation-domain-duplication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --reporter=verbose src/stores/inputStore.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --reporter=verbose src/stores/inputStore.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | DOMAIN-01 | — | N/A | unit | `npm run test -- src/stores/inputStore.test.ts` | ✅ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | WIZARD-03 | — | N/A | unit | `npm run test -- src/stores/inputStore.test.ts` | ✅ W0 | ⬜ pending |
| 19-02-01 | 02 | 2 | DOMAIN-01 | — | N/A | unit | `npm run test` | ✅ | ⬜ pending |
| 19-02-02 | 02 | 2 | WIZARD-03 | — | N/A | unit | `npm run test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/inputStore.test.ts` — add `describe('inputStore — duplicateDomain (DOMAIN-01)')` with 6 failing tests:
  - `duplicateDomain(id)` inserts clone immediately after original
  - Clone has new UUID different from source
  - Clone name is `"${original.name} (copy)"` (or parameterized equivalent)
  - Clone has all 26 config fields equal to source (deep equality, excluding id+name)
  - `activeDomainIndex` advances to new domain's index after duplication
  - `duplicateDomain('nonexistent-id')` is a no-op (no domains added)
- [ ] `src/stores/inputStore.test.ts` — add `describe('inputStore — topology change helpers (WIZARD-03)')` with store-level tests:
  - Calling `updateManagementDomain` + all `updateDomain` for all domains with new deploymentMode updates all records

*Existing infrastructure: Vitest + node env already configured. No new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Confirmation dialog appears when topology changed with configured data | WIZARD-03 | DOM rendering + component state not covered by Vitest node env | Configure a workload domain (change VM count), then change topology — verify dialog appears |
| Cancel leaves topology selector visually unchanged | WIZARD-03 | DOM interaction | Show dialog, click cancel — verify topology button still shows original selection |
| Copy domain button appears in each tab | DOMAIN-01 | DOM rendering | Add 2 domains, verify each tab shows copy button |
| Clicking copy creates new tab after original | DOMAIN-01 | DOM interaction | Click copy on domain 1 — verify new tab "WLD-1 (copy)" appears at position 2 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
