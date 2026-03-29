# Project Research Summary

**Project:** VCF Sizer — Milestone v2.0
**Domain:** Client-side SPA infrastructure sizing calculator (VMware Cloud Foundation 9.x)
**Researched:** 2026-03-29
**Confidence:** HIGH (stack, architecture patterns, stretch specs); MEDIUM (vSAN Max ReadyNode profiles, Standard/Consolidated terminology)

---

## Executive Summary

VCF Sizer v2.0 adds four concrete correctness and feature improvements to an already-shipping v1 SPA: a bandwidth floor bug fix for stretch clusters, a stretch network requirements checklist, Standard vs Consolidated architecture host-minimum validation (now correctly called "Dedicated Domains vs Co-located" in VCF 9), and a vSAN Max disaggregated storage cluster sizing engine. The entire existing stack — Vue 3 + Pinia + TypeScript + Decimal.js + Zod + Tailwind v4 — is fully sufficient to implement all four features. No new npm dependencies are required.

The recommended implementation order prioritises safety: begin with additive-only type changes to `engine/types.ts`, then apply the stretch bandwidth floor bug fix, then add the stretch checklist and management architecture flag (low risk, all additive), and finish with vSAN Max which is the only genuinely new engine subsystem. The key architectural insight is that vSAN Max is NOT a variant of vSAN ESA HCI — it requires two separate input groups (storage cluster hosts and compute cluster hosts) and a dedicated engine file `vsanMax.ts`. Conflating the two is the most dangerous implementation mistake in this milestone.

The primary risks are (a) the Zod URL state schema and its test replica silently drifting when new store fields are added, causing new state fields to be dropped on URL deserialisation; (b) the existing stretch bandwidth test pinning the pre-floor formula value, which will produce a guaranteed red CI build if not updated before the floor is added; and (c) using deprecated VCF 5.x UI labels ("Standard"/"Consolidated") in i18n keys, which will confuse VCF 9 users. All three risks are fully preventable with the concrete mitigations documented in PITFALLS.md.

---

## Key Findings

### Recommended Stack

The v1 stack requires zero additions for v2.0. All arithmetic is pure TypeScript + Decimal.js; new profile constants are hardcoded; new validation rules extend the existing `ValidationWarning[]` pattern. The only affected files are within `src/engine/` (types, stretch, storage, validation) and `src/stores/` (inputStore, calculationStore), plus two new engine files and two to four new Vue components.

**Core technologies (unchanged from v1):**
- TypeScript 5.7 (strict mode) — all new engine code; compile-time exhaustiveness checking is the primary regression guard
- Decimal.js 10.6.0 — all arithmetic including the bandwidth floor `Decimal.max(formula, 10)`
- Pinia 3.0.4 — `inputStore` gains new `ref()` fields; `calculationStore` gains new `computed()` fields; CALC-02 rule (zero `ref()` in calculationStore) must be preserved
- Zod 4.3.6 — URL state schema must be updated atomically with every new `inputStore` field
- vue-i18n 11.3.0 — new keys required in all four locale files (en, fr, de, it) in the same commit as UI components
- Vitest 4.1.2 — existing stretch and storage tests will need targeted updates for bandwidth floor behaviour

### Expected Features

**Must have for v2.0 (confirmed table stakes corrections):**
- Stretch bandwidth floor enforcement — 10 Gbps hard minimum per Broadcom TechDocs VCF 9.0; current code returns values as low as ~0.1 Gbps for small workloads
- Stretch network requirements checklist — MTU 9000 on inter-site links, <5ms site-to-site RTT, witness RTT <200ms (<=10 hosts/site) or <100ms (11-15 hosts/site), 2 Mbps/1,000 components witness bandwidth
- Dedicated Domains vs Co-located host minimum validation — management cluster requires 4 hosts minimum (vSAN) per Broadcom KB 392993; currently no validation exists
- vSAN Max / Storage Cluster sizing — new storage type with 5 ReadyNode profiles (vSAN-SC-XS/SM/MED/LRG/XL), minimum 4 storage cluster hosts, separate compute cluster sizing

**Should have (quality improvements alongside v2.0 features):**
- `bandwidthFloorApplied` boolean in `StretchResult` surfaced in UI with a note explaining the correction — maintains trust in existing shared URLs
- Profile names using VCF 9 terminology (`vSAN-SC-*`) not legacy names (`vSAN-Max-*`)
- Witness latency threshold derived from actual per-site host count, not hardcoded to 200ms

**Defer to v2.1+:**
- vSAN Max stretched topology (stretched storage cluster with witness) — separate feature, not part of the standard vSAN Max disaggregated model
- GPU/AI workload host sizing
- RVTools / LiveOptics import

### Architecture Approach

All v2.0 changes follow the established unidirectional pattern: new `ref()` inputs in `inputStore` -> new `computed()` in `calculationStore` -> pure engine functions in `src/engine/` with zero Vue imports. All type changes to `engine/types.ts` are additive (optional fields, union extensions) — no existing call sites require modification. The only new engine file is `engine/vsanMax.ts`; `engine/stretch.ts`, `engine/storage.ts`, and `engine/validation.ts` receive targeted additions only.

**Major components added/modified for v2.0:**

1. `engine/types.ts` — foundation: `StorageType` union extended with `'vsan-max'`; new interfaces `VsanMaxInputs`, `VsanMaxResult`, `VsanMaxProfile`; `StretchResult` extended with `bandwidthFloorApplied`, `networkChecklist`; new type `ManagementArchitecture = 'shared' | 'dedicated'`
2. `engine/vsanMax.ts` (NEW) — `calcVsanMax()` pure function; 5 ReadyNode profile constants (XS/SM/MED/LRG/XL with capacity, min cores, min RAM, min NIC); uses shared `vsanEsaRaidOverhead()` with `storageNodeCount` (not HCI `hostCount`)
3. `engine/stretch.ts` (PATCHED) — `STRETCH_MIN_BANDWIDTH_GBPS = 10` constant; `bandwidthFloorApplied` field; `networkChecklist` population with witness RTT derived from per-site host count
4. `engine/validation.ts` (ADDITIVE) — `DEDICATED_MGMT_MIN_HOSTS` rule (error when `managementArchitecture === 'dedicated'` and `hostCount < 4`)
5. `engine/storage.ts` (ADDITIVE) — guard clause routing `storageType === 'vsan-max'` to `calcVsanMax()`
6. `components/input/VsanMaxPanel.vue` (NEW) — profile selector + storage node count + compute node count inputs, visible when `storageType === 'vsan-max'`
7. `components/output/VsanMaxResult.vue` (NEW) — storage cluster totals + compute cluster totals
8. `components/output/StretchNetworkChecklist.vue` (NEW) — reads `calculationStore.stretch.networkChecklist`

### Critical Pitfalls

1. **StorageType enum exhaustiveness gap** — Adding `'vsan-max'` to the `StorageType` union without converting the `if/else` tree in `calcStorage()` to a `switch` with a `never` exhaustive case will silently fall through to wrong logic. The Zod schema in `useUrlState.ts` and its test replica must also be updated or the new value is silently dropped on URL deserialisation. Fix: single source of truth in `engine/types.ts`; export Zod enum from `useUrlState.ts` instead of replicating it in the test file. Address first, before any engine logic.

2. **URL state schema silent discard** — Three places must stay synchronised for every new `inputStore` field: the `ref()` declaration, the Zod schema shape, and the `hydrateFromUrl` explicit assignment block. Missing any one means the field silently reverts to default on URL load. Fix: create a `URL_STATE_FIELDS` constant shared by `generateShareUrl` and `hydrateFromUrl`; add a schema completeness test. Address before writing any new UI.

3. **vSAN Max modelled as a storage variant, not a two-cluster topology** — Reusing the HCI host-count formula for vSAN Max produces wrong storage capacity (compute host storage specs applied to storage cluster math) and an ambiguous single host count output. Fix: separate `VsanMaxInputs` interface with distinct `storageNodeCount` and `computeNodeCount`; `calcVsanMax()` sizes the two pools independently. Design the type before writing UI.

4. **Bandwidth floor test regression** — The existing `stretch.test.ts` pins the pre-floor formula value. A 100-VM test case produces ~0.097 Gbps, which is below the 10 Gbps floor — the test will fail immediately on a correct floor implementation. Fix: update the test before adding the floor (TDD order: write the failing test first). Address as the first sub-task of the stretch bandwidth floor work.

5. **VCF 9 terminology in UI labels** — "Standard" and "Consolidated" are retired VCF 5.x terms. Using them in i18n keys will confuse VCF 9 users. Fix: use "Dedicated Domains" and "Co-located" in all i18n keys (engine enum values can remain `'shared' | 'dedicated'` for brevity). Lock i18n key naming before committing any locale files.

---

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md and the pitfall ordering from PITFALLS.md, v2.0 maps cleanly to two sequential sub-phases.

### Phase v2.0-A: Correctness and Architecture Validation

**Rationale:** All changes are additive-only to existing types and engine functions. No new engine subsystems. Lowest risk. Fixes a live bug (bandwidth floor). Can ship independently of vSAN Max.

**Delivers:**
- Bug fix: stretch bandwidth floor at 10 Gbps with `bandwidthFloorApplied` transparency field
- New display: stretch network checklist (MTU, RTT, witness latency) in all 4 locales
- New validation: `DEDICATED_MGMT_MIN_HOSTS` rule for Dedicated Domains architecture selection
- New output: `dedicatedMgmtHostCount` computed when management architecture is dedicated

**Addresses (from FEATURES.md):**
- Stretch bandwidth floor enforcement
- Stretch network requirements checklist
- Dedicated Domains vs Co-located host minimum validation

**Avoids (from PITFALLS.md):**
- Pitfall 15 (bandwidth floor test regression) — update test first
- Pitfall 16 (i18n keys in only one locale) — all 4 locale files in same commit
- Pitfall 17 (architectureModel ref in calculationStore) — add to inputStore only
- Pitfall 14 (VCF 5.x UI labels) — use Dedicated Domains/Co-located terminology

**Build order within phase:**
1. `types.ts` foundation (all additive type changes)
2. Bandwidth floor patch in `calcStretch()` + test update
3. Stretch network checklist in `StretchResult` + `StretchNetworkChecklist.vue` + i18n (all 4 locales)
4. `ManagementArchitecture` flag in `inputStore` + Zod schema + `DEDICATED_MGMT_MIN_HOSTS` rule + `dedicatedMgmtHostCount` computed + UI toggle + i18n (all 4 locales)

**Research flag:** Standard patterns — no deeper research needed. All specs are confirmed HIGH confidence from Broadcom TechDocs.

---

### Phase v2.0-B: vSAN Max Engine

**Rationale:** Introduces a genuinely new engine subsystem with new UI. Medium risk. Depends on `types.ts` foundation from Phase v2.0-A but otherwise independent.

**Delivers:**
- New storage type: vSAN Max (vSAN-SC-XS/SM/MED/LRG/XL ReadyNode profiles)
- Separate storage cluster sizing and compute cluster sizing
- Validation: minimum 4 storage cluster hosts
- URL state persistence for vSAN Max fields

**Addresses (from FEATURES.md):**
- vSAN Max disaggregated storage cluster sizing
- Two-cluster topology modelling (storage nodes + compute nodes as separate pools)
- ReadyNode profile capacity constants (20/50/100/150/200 TB per host)

**Avoids (from PITFALLS.md):**
- Pitfall 11 (StorageType enum exhaustiveness) — convert `calcStorage()` to switch + never case; single Zod enum source of truth
- Pitfall 12 (URL state silent discard) — `URL_STATE_FIELDS` constant; schema completeness test
- Pitfall 13 (vSAN Max modelled as storage variant) — separate `VsanMaxInputs` type; `calcVsanMax()` dedicated function in `vsanMax.ts`
- Pitfall 18 (ReadyNode profile specs actively changing) — source comment with URL and verification date in constants file

**Build order within phase:**
1. `useUrlState.ts` Zod schema updated for new fields + test (schema completeness)
2. `engine/vsanMax.ts` — ReadyNode profile constants + `calcVsanMax()` pure function
3. `calcStorage()` routing guard for `'vsan-max'`
4. `inputStore` new refs + `calculationStore` new `vsanMax` computed
5. `VsanMaxPanel.vue` + `VsanMaxResult.vue` + i18n (all 4 locales)
6. Validation rule: `vsanMaxNodeCount < 4` -> error

**Research flag:** Verify ReadyNode profile constants against the Broadcom vSAN ESA ReadyNode Hardware Guidance at `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance` at implementation time. The Nov 2025 blog documents percentage reductions but not all updated absolute values. The XS 128 GB RAM minimum is inferred, not explicitly confirmed.

---

### Phase Ordering Rationale

- Phase v2.0-A first because it contains a live correctness bug (bandwidth floor), carries lowest risk, and can ship to users while vSAN Max is being built.
- Types foundation is step 1 of v2.0-A because all subsequent changes depend on it; it has zero breaking changes.
- vSAN Max is isolated to its own phase because it is the only change that adds a new engine subsystem, new UI components, and new URL state fields — it has the most failure modes and benefits from the clean baseline that v2.0-A establishes.
- URL state schema changes (Pitfall 11, 12) must be addressed before any vSAN Max UI work; schema drift is the highest-probability silent regression in this codebase.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies confirmed; all v1 library versions verified against current codebase |
| Features | HIGH | Stretch specs, management domain specs, and host minimums all confirmed against Broadcom TechDocs VCF 9.0 and KB 392993 |
| Architecture | HIGH | All integration decisions derived from direct code inspection; build order derived from dependency analysis of actual engine files |
| Pitfalls | HIGH | v2.0 pitfalls confirmed against codebase specifics (Zod schema, test file patterns, CALC-02 constraint); all prevention strategies are concrete and actionable |
| vSAN Max profiles | MEDIUM | XS, SM, LRG, XL capacities and network requirements confirmed; MED NVMe count and LRG/XL NVMe counts not published in blog sources; XS 128 GB RAM minimum is inferred |
| Standard/Consolidated terminology | MEDIUM | Community evidence confirms VCF 9 retired the terms; no single official TechDocs page explicitly states the retirement |

**Overall confidence:** HIGH for implementation guidance; MEDIUM for specific vSAN Max hardware constants (requires verification at implementation time).

### Gaps to Address

- **vSAN Max ReadyNode profile constants (MED/LRG/XL NVMe counts):** Verify against `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance` before hardcoding as constants. Use blog-sourced values as initial estimates with a source comment.
- **XS profile 128 GB RAM minimum:** Inferred from the Nov 2025 "as little as 16 cores and 128 GB" statement. Confirm the 128 GB is for the XS storage cluster profile specifically, not a general minimum across all profiles.
- **ManagementArchitecture 4-host minimum source:** Confirmed by Broadcom KB 392993 for management domain with vSAN. The 3-host minimum for Co-located mode is confirmed by multiple community sources but does not have a single authoritative TechDocs page.
- **vSAN Max profile naming (XS and XL in VCF 9):** Nov 2025 blog describes three profiles (SM, MED, LRG) for new hardware guidance; March 2024 blog includes XS and XL. Verify whether XS and XL are current in VCF 9.0 compatibility guide before including them as options.

---

## Sources

### Primary (HIGH confidence)

- Broadcom TechDocs VCF 9.0 — Bandwidth and Latency Requirements (`techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/vsan-deployment-administration-and-monitoring/vsan-network-design/...`) — stretch RTT thresholds, 10 Gbps floor, witness latency, MTU 9000
- Broadcom KB 392993 — minimum 4 ESXi hosts for management domain with vSAN
- Direct codebase inspection — all 6 engine files, both stores, `useUrlState.ts` and test file
- VMware Blog Nov 2025 ("Driving Down Storage Costs") — vSAN Max hardware requirement reductions
- VMware Blog Mar 2024 ("Greater Flexibility with vSAN Max") — ReadyNode XS/SM/MED/LRG/XL profile structure

### Secondary (MEDIUM confidence)

- Broadcom Community Forum — VCF 9 retirement of Standard/Consolidated terminology
- VMware Blog Jun 2024 ("vSAN HCI or Storage Clusters") — vSAN Max vs HCI architectural distinction
- Lubomir Tobek (Medium, VCF 9.0) — bandwidth sizing for stretched clusters, consistent with TechDocs
- defaultreasoning.com (Jan 2025) — VCF-VSAN-REQD-CFG-002 design constraint analysis

### Tertiary (reference at implementation time)

- Broadcom Compatibility Guide (`compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance`) — canonical authoritative source for ReadyNode profile specs; must be consulted at implementation time to verify MED/LRG/XL NVMe counts and XS RAM minimum

---

*Research completed: 2026-03-29*
*Scope: VCF Sizer milestone v2.0 — vSAN Max + Dedicated Domains validation + stretch correctness*
*Ready for roadmap: yes*
