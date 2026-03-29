---
phase: 4
slug: correctness-and-architecture-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --reporter=verbose src/engine/stretch.test.ts src/engine/validation.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | STRCH-06/07 | unit | `npm run test -- src/engine/stretch.test.ts` | ✅ (update) | ⬜ pending |
| 4-01-02 | 01 | 1 | STRCH-08 | unit | `npm run test -- src/engine/stretch.test.ts` | ✅ (extend) | ⬜ pending |
| 4-01-03 | 01 | 1 | ARCH-01/02 | unit | `npm run test -- src/engine/validation.test.ts` | ✅ (extend) | ⬜ pending |
| 4-02-01 | 02 | 2 | STRCH-08 | manual | Open app in stretch mode, verify checklist card visible | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 2 | ARCH-01 | manual | Toggle Dedicated Domains, set hostCount < 4, verify error | ❌ W0 | ⬜ pending |
| 4-02-03 | 02 | 2 | ARCH-02 | manual | Co-located mode with 2 hosts + vSAN, verify info note | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update `src/engine/stretch.test.ts` — update bandwidth test assertion to expect 10 Gbps floor (TDD: failing test before fix)
- [ ] Extend `src/engine/stretch.test.ts` — add `bandwidthFloorApplied` and `networkChecklist` tests
- [ ] Extend `src/engine/validation.test.ts` — add `DEDICATED_MGMT_MIN_HOSTS` and co-located min tests

*Existing vitest infrastructure covers all phase requirements — no new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stretch network checklist card renders with correct RTT/MTU values | STRCH-08 | DOM rendering + i18n display | Open app, enable Stretch mode, verify StretchNetworkChecklist.vue card shows MTU 9000, RTT < 5ms, correct witness RTT based on per-site host count |
| Dedicated Domains toggle visible in HA + Stretch modes | ARCH-01 | UI conditional rendering | Switch to HA mode, verify toggle present; switch to Simple, verify toggle absent |
| Co-located min info note displays correct threshold per storage type | ARCH-02 | Dynamic i18n message | Set co-located + vSAN + 2 hosts → expect ≥3 note; set co-located + FC + 1 host → expect ≥2 note |
| bandwidthFloorApplied indicator visible when formula < 10 Gbps | STRCH-07 | UI display logic | Enter small workload (10 VMs), enable stretch, verify floor indicator shown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
