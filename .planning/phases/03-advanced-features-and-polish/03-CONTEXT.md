# Phase 3: Advanced Features and Polish — Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the three VCF 9.x differentiating features (NVMe Memory Tiering, Stretch Cluster per-site inputs, AI/GPU workloads) and complete the four Swiss locales. Phase 3 does NOT add new export formats, new chart types beyond what Phase 2 built, or v2 features (vSAN OSA, localStorage saves). The phase is complete when architects using Stretch Cluster topologies, NVMe-tiered hosts, or AI/GPU workloads get accurate sizing, and FR/DE/IT users see correct Swiss number formatting with no hardcoded English strings.

</domain>

<decisions>
## Implementation Decisions

### NVMe Memory Tiering (NVME-01 to NVME-04)

**Store changes (inputStore.ts):**
- Add `nvmeTieringEnabled: ref(false)`
- Add `activeMemoryPct: ref(50)` — percentage of DRAM actively used (0–100)

**Engine changes (compute.ts):**
- Add optional `nvmeTieringEnabled` and `activeMemoryPct` to `ComputeInputs`
- When `nvmeTieringEnabled && activeMemoryPct <= 50`: `effectiveHostRamGB = hostRamGB / 2`
- Else: `effectiveHostRamGB = hostRamGB`
- All RAM calculations use `effectiveHostRamGB` (not raw `hostRamGB`)

**UI (HostSpecsForm.vue):**
- Add NVMe Tiering toggle beneath host RAM input
- When toggle enabled: show `activeMemoryPct` slider (0–100%)
- When `activeMemoryPct <= 50`: show green indicator "NVMe tiering active — DRAM halved"
- Prerequisite notice: "Requires Class D+ NVMe at 3+ DWPD" (NVME-04)

### Stretch Cluster (STRCH-01 to STRCH-05)

**Store changes (inputStore.ts):**
- Add `preferredSiteHosts: ref(3)` — host count at preferred site
- Add `secondarySiteHosts: ref(3)` — host count at secondary site
- Note: existing `hostCount` becomes the total across both sites when stretch is active

**Engine changes:**
- `calcStretch(inputs)` new function in `src/engine/stretch.ts`:
  - Witness node overhead: 2 vCPU, 8 GB RAM (small form factor witness)
  - Per-site storage: each site holds a full copy → storage calc uses PFTT=1 (2× site replication on top of FTT policy)
  - Cross-site bandwidth recommendation: `(totalWorkloadStorageTB × 0.1)` GB/s minimum link (10% of total storage as daily change rate heuristic)
  - Total host count for capacity: `preferredSiteHosts + secondarySiteHosts`

**UI:**
- In `DeploymentModelSelector.vue`: when stretch selected, show two new inputs: "Preferred site hosts" and "Secondary site hosts" (NumberSliderInput)
- Witness overhead shown in ManagementSummary.vue when stretch active
- Cross-site bandwidth guidance displayed as informational note
- Mutual exclusion: Global Deduplication toggle disabled (greyed out) when stretch is active (STRCH-04)

**Storage math for stretch:**
- Data is written to both sites → effective storage per site = normal vSAN calc × 1 (each site is independent)
- Total cluster raw capacity = `(preferredSiteHosts + secondarySiteHosts) × hostStorageTB`
- Apply normal RAID+LFS+metadata stack per-site, then sum
- Simpler: treat total host count = preferred + secondary, but flag in UI that stretch halves effective usable vs. single-site

### AI / GPU Workloads (GPU-01 to GPU-03)

**Store changes (inputStore.ts):**
- Add `gpuVmCount: ref(0)`
- Add `vgpuMemoryGB: ref(16)` — memory per vGPU profile

**Engine changes (compute.ts):**
- Add `gpuVmCount` and `vgpuMemoryGB` to `ComputeInputs`
- GPU RAM overhead added to `totalRamRequiredGB`: `gpuVmCount × vgpuMemoryGB × 2` (conservative 2× multiplier for vGPU overhead)

**UI (WorkloadProfileForm.vue):**
- Add "AI/GPU Workloads" section at bottom of form
- `gpuVmCount`: NumberSliderInput (0–50)
- `vgpuMemoryGB`: NumberSliderInput (8, 16, 32, 48, 80 GB — common vGPU profiles)

### i18n Locale Completion

- All Phase 3 new UI strings added to all 4 locale files simultaneously (not deferred)
- EN keys defined first; FR/DE/IT translations included in same task
- No hardcoded English strings in any Phase 3 component

### Test Strategy

- All new engine functions (`calcStretch`, updated `calcCompute`) get Vitest unit tests
- Test files follow existing pattern: `/// <reference types="vitest/globals" />`
- GPU RAM overhead formula tested with boundary values (gpuVmCount=0 → no overhead)
- NVMe tiering tested at boundary: activeMemoryPct=50 (halved), =51 (not halved), =0 (halved)
- Stretch witness overhead tested for correct vCPU and RAM values

### Claude's Discretion

- Exact Tailwind styling for new form sections
- Whether to put stretch site inputs inline in DeploymentModelSelector or as a separate StretchSiteForm component
- Exact vGPU profile preset values if NumberSliderInput uses discrete steps
- Cross-site bandwidth formula refinement (heuristic, not spec'd exactly)

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — Phase 3: NVME-01–04, STRCH-01–05, GPU-01–03
- `.planning/research/FEATURES.md` — VCF 9.x NVMe tiering prerequisites, stretch cluster specs
- `.planning/research/PITFALLS.md` — Floating-point (Decimal.js), Swiss locale formatting

### Phase 1/2 outputs extended by Phase 3

- `src/stores/inputStore.ts` — add nvmeTieringEnabled, activeMemoryPct, preferredSiteHosts, secondarySiteHosts, gpuVmCount, vgpuMemoryGB
- `src/engine/compute.ts` — extend ComputeInputs with NVMe and GPU fields
- `src/engine/types.ts` — extend ComputeInputs, add StretchInputs/StretchResult types
- `src/engine/validation.ts` — add STRETCH_MIN_HOSTS validation
- `src/components/input/HostSpecsForm.vue` — add NVMe tiering section
- `src/components/input/WorkloadProfileForm.vue` — add GPU section
- `src/components/input/DeploymentModelSelector.vue` — add stretch site inputs
- `src/stores/calculationStore.ts` — wire stretch engine call, update compute call

</canonical_refs>

<code_context>
## Existing Code Insights

### ComputeInputs (types.ts) — fields to add
Current: deploymentMode, coresPerSocket, socketsPerHost, hostRamGB, hostCount, vmCount, avgVcpuPerVm, avgVramGbPerVm, cpuOvercommitRatio, ramOvercommitRatio, managementCores, managementRamGB
Add: nvmeTieringEnabled?, activeMemoryPct?, gpuVmCount?, vgpuMemoryGB?

### calcCompute (compute.ts) — changes
- Compute `effectiveHostRamGB` from NVMe inputs before using hostRamGB in formulas
- Add `gpuRamOverheadGB = gpuVmCount × vgpuMemoryGB × 2` to `totalRamRequiredGB`
- All new fields are optional with sensible defaults (0 for counts, false for toggles)

### StorageConfigForm.vue (src/components/input/)
- Dedup toggle already exists — needs to be disabled/greyed when stretch is active (STRCH-04)
- Read `inputStore.deploymentMode` to conditionally disable

### Existing i18n keys structure
Locale files: src/i18n/locales/{en,fr,de,it}.json
Phase 3 new keys go under existing sections:
- `host.nvme.*` for NVMe tiering
- `workload.gpu.*` for GPU section
- `deployment.stretch.*` for stretch site inputs
- `warnings.stretchDedup` for the mutual exclusion warning

</code_context>

<deferred>
## Out of Phase 3

- Stretch cluster chart visualizations beyond the existing host count card — v2 backlog
- vGPU profile library (A16/A30/H100 presets) — GPU-V2-01 (v2)
- vSAN OSA storage calculations — v2
- Dark mode — v2
- localStorage saved configs — v2

</deferred>

---
*Phase: 03-advanced-features-and-polish*
*Context gathered: 2026-03-28*
