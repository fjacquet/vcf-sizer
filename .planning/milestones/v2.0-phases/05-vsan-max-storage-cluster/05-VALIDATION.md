---
phase: 5
slug: vsan-max-storage-cluster
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| W0-01 | 01 | 0 | VMAX-01 | unit | `npm run test` | ❌ W0 — create `src/engine/vsanMax.test.ts` | ⬜ pending |
| W0-02 | 01 | 0 | VMAX-01 | unit | `npm run test` | ❌ W0 — add switch test to `src/engine/storage.test.ts` | ⬜ pending |
| W0-03 | 01 | 0 | VMAX-03 | unit | `npm run test` | ❌ W0 — add VSAN_MAX_MIN_NODES + DEDUP_NETWORK_SPEED to `src/engine/validation.test.ts` | ⬜ pending |
| W0-04 | 02 | 0 | VMAX-03 | unit | `npm run test` | ❌ W0 — URL round-trip tests in `src/composables/useUrlState.test.ts` | ⬜ pending |
| 5-01-01 | 01 | 1 | VMAX-01 | unit | `npm run test` | ✅ after W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | VMAX-01 | unit | `npm run test` | ✅ after W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | VMAX-03 | unit | `npm run test` | ✅ after W0 | ⬜ pending |
| 5-02-01 | 02 | 2 | VMAX-02 | unit | `npm run test` | ✅ after W0 | ⬜ pending |
| 5-02-02 | 02 | 2 | VMAX-03 | unit | `npm run test` | ✅ after W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/engine/vsanMax.test.ts` — NEW: unit tests for `calcVsanMax()`: all 5 profiles, RAID scheme at 4 vs 6 nodes, min node validation (belowMinNodes), raw + usable capacity formula. Covers VMAX-01, VMAX-02, VMAX-03.
- [ ] Add to `src/engine/storage.test.ts` — `calcStorage()` exhaustive switch: test that `storageType='vsan-max'` is handled after refactor (no throw, no wrong ESA overhead applied)
- [ ] Add to `src/engine/validation.test.ts` — VSAN_MAX_MIN_NODES error when `storageType='vsan-max'` and `vsanMaxStorageNodes < 4`; DEDUP_NETWORK_SPEED warning when `dedupEnabled=true` and `networkSpeedGbE < 25`
- [ ] Create `src/composables/useUrlState.test.ts` (if not exists) — URL round-trip: `vsanMaxProfile`, `vsanMaxStorageNodes`, `networkSpeedGbE` survive `generateShareUrl` → `hydrateFromUrl`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VsanMaxClusterCard renders correctly with warning indicator | VMAX-02 | Visual component output | Dev server: select vSAN Max, set storage nodes < 4, confirm red warning badge visible |
| Network speed button group visible in HostSpecsForm | VMAX-01 | Visual layout | Dev server: confirm 10/25/100 GbE selector appears after host storage TB input |
| Profile dropdown format: "MED — 100 TB/node" | VMAX-01 | Visual/copy | Dev server: open StorageConfigForm with vSAN Max selected, confirm dropdown format |
| Share URL round-trip (browser) | VMAX-03 | Integration | Set vSAN Max config, copy share URL, open in new tab, verify all fields restore |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
