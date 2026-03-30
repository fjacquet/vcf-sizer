---
phase: 16
slug: wizard-scaffold-and-state
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-30
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/stores/uiStore.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (vue-tsc type-check)
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** `npm run test && npm run build` must both be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | WIZARD-02, WIZARD-07 | unit | `npx vitest run src/stores/uiStore.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | WIZARD-07 | unit | `npx vitest run src/composables/useUrlState.test.ts` | ✅ | ⬜ pending |
| 16-01-03 | 01 | 1 | WIZARD-01 | i18n | `npm run build` (type-check only) | ✅ | ⬜ pending |
| 16-02-01 | 02 | 2 | WIZARD-01 | manual + build | `npm run build` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 2 | WIZARD-01 | manual + build | `npm run build` | ❌ W0 | ⬜ pending |
| 16-02-03 | 02 | 2 | WIZARD-01, WIZARD-02 | manual + unit | `npm run test && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/uiStore.test.ts` — covers WIZARD-02 (currentWizardStep init, setWizardStep transitions, inputStore independence) and WIZARD-07 (step not in URL)
- [ ] Add WIZARD-07 test case to `src/composables/useUrlState.test.ts`: assert `generateShareUrl()` output when decompressed and parsed contains no `currentWizardStep` key

*Note: `src/components/shared/WizardStepper.vue` and `src/components/shared/TopologySelector.vue` are new Vue components — visual/rendering tests require DOM (jsdom) which is outside CLAUDE.md stated test scope. These are verified manually + build type-check.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WizardStepper renders 3 steps with correct labels and active/completed/upcoming states | WIZARD-01 | Vue component rendering requires DOM; outside CLAUDE.md test scope | 1. `npm run dev` 2. Verify step 1 "Topology" is active (blue), steps 2-3 are inactive (gray) 3. Advance to step 2 — verify step 1 shows completed state |
| TopologySelector writes deploymentMode atomically to both managementDomain and all workloadDomains | WIZARD-01 | Requires UI interaction | 1. Select "HA" topology 2. Add a second workload domain 3. Check that both WLD-1 and WLD-2 show deploymentMode === 'ha' in Vue DevTools |
| Back navigation preserves all form values | WIZARD-02 | Requires live UI interaction | 1. Advance to step 2, change management host count 2. Advance to step 3, change VM count 3. Navigate back to step 2 — verify management host count unchanged |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
