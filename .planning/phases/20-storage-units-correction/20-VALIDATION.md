---
phase: 20
slug: storage-units-correction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --reporter=verbose src/engine/storage.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --reporter=verbose src/engine/storage.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** `npm run type-check && npm run test` — both must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | STOR-02/03/04 | — | N/A | unit | `npm run test -- src/engine/storage.test.ts` | ✅ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | STOR-04 | — | N/A | unit | `npm run test -- src/composables/useUrlState.test.ts` | ✅ W0 | ⬜ pending |
| 20-02-01 | 02 | 2 | STOR-01/02/03 | — | N/A | unit | `npm run test` | ✅ | ⬜ pending |
| 20-02-02 | 02 | 2 | STOR-01 | — | N/A | unit | `npm run type-check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/engine/storage.test.ts` — add new tests for `calcStorage()` FC/NFS path with `externalStorageUsableTiB` parameter (STOR-03)
- [ ] `src/engine/storage.test.ts` — update any existing test that references `hostStorageTB` → rename to `hostStorageTiB`
- [ ] `src/composables/useUrlState.test.ts` — update schema replica tests to use renamed fields (`hostStorageTiB`, `externalStorageUsableTiB`)

*Existing infrastructure: Vitest + node env already configured. No new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Storage labels show "TiB" throughout UI | STOR-01 | DOM rendering | Open dev server, verify all storage inputs and results show "TiB" label |
| FC/NFS domain shows pool input, not per-host | STOR-03 | DOM interaction | Create FC/NFS domain, verify "Total Usable Storage Pool (TiB)" field shown |
| vSAN ESA domain shows per-host TiB input | STOR-02 | DOM interaction | Create vSAN ESA domain, verify "Raw Storage per Host (TiB)" slider shown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
