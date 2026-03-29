# Phase 3 Validation Architecture

**Phase:** 03-advanced-features-and-polish
**Created:** 2026-03-28

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run | `npm test` |
| Full suite | `npm test` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Command | File |
|--------|----------|-----------|---------|------|
| NVME-01/02/03 | NVMe tiering halves hostRamGB when activeMemoryPct ≤ 50 | unit | `npm test` | src/engine/compute.test.ts (extended) |
| NVME-03 | Boundary: activeMemoryPct=50 → halved, =51 → not halved | unit | `npm test` | src/engine/compute.test.ts |
| STRCH-01/02 | Stretch: preferredSiteHosts + secondarySiteHosts = totalHosts | unit | `npm test` | src/engine/stretch.test.ts |
| STRCH-02 | Witness overhead: 4 vCPU / 16 GB (ESA M profile) | unit | `npm test` | src/engine/stretch.test.ts |
| STRCH-03 | Per-site storage = calcStorage(totalHosts).safeUsable / 2 | unit | `npm test` | src/engine/stretch.test.ts |
| STRCH-04 | Dedup+stretch mutual exclusion fires DEDUP_STRETCH_EXCLUSION | unit | `npm test` | src/engine/validation.test.ts (exists) |
| GPU-01/02/03 | GPU RAM overhead = gpuVmCount × vgpuMemoryGB × 2 | unit | `npm test` | src/engine/compute.test.ts (extended) |
| GPU-03 | GPU overhead = 0 when gpuVmCount = 0 | unit | `npm test` | src/engine/compute.test.ts |
| i18n | All 4 locale files have identical key sets | automated | `node -e key parity script` | src/i18n/locales/*.json |
| NVME-04 | Prerequisite notice renders in HostSpecsForm | manual | `npm run dev` + UI inspection | — |
| STRCH-05 | Bandwidth note displays in DeploymentModelSelector | manual | `npm run dev` + UI inspection | — |

## Wave 0 Test Files to Create/Extend

- [ ] `src/engine/stretch.test.ts` — STRCH-01–03, witness spec assertion
- [ ] Extend `src/engine/compute.test.ts` — NVME-01–03, GPU-01–03 boundary tests

## Sampling Rate

- Per task commit: `npm test`
- Per wave merge: `npm test`
- Phase gate: all tests green before verification
