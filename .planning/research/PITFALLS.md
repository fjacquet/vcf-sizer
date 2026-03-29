# Pitfalls Research

**Domain:** VCF 9.x Client-Side Sizing Calculator SPA (Vue 3 / React, multi-language, browser-only)
**Researched:** 2026-03-29 (updated for v2.0 milestone)
**Confidence:** HIGH for v1 pitfalls (unchanged); MEDIUM for v2.0 additions (based on official docs + community, verified against codebase)

---

## v2.0 Milestone Additions

The following pitfalls are specific to adding vSAN Max, Standard/Consolidated architecture distinction,
stretch bandwidth floor, and stretch network checklist to the existing Phase 1 codebase. They address the
four categories the milestone research requested.

---

## Critical Pitfalls

### Pitfall 11: Adding `vsan-max` to the `storageType` Enum Breaks All Exhaustiveness Guards

**What goes wrong:**
The current `StorageType` union in `engine/types.ts` is `'vsan-esa' | 'fc' | 'nfs'`. The Zod schema in
`useUrlState.ts` uses `z.enum(['vsan-esa', 'fc', 'nfs'])`. The `calcStorage` function in `storage.ts`
branches on `storageType` with an `if/else` tree.

When `'vsan-max'` is added to the union, TypeScript's exhaustiveness checker will silently not fire on
the `if/else` tree in `calcStorage` (only a `switch` with a `never` bottom case catches missed variants).
Additionally, the Zod enum in `useUrlState.ts` will need to be updated or the field will fail validation
and silently revert to the default, appearing to work while actually discarding the user's choice.

The URL schema test file (`useUrlState.test.ts`) replicates the schema in-test and will also silently
remain inconsistent — it tests the old enum, not the real schema — producing false green tests.

**Why it happens:**
The schema definition is duplicated between `useUrlState.ts` (the real schema) and
`useUrlState.test.ts` (the test replica). The comment in `useUrlState.test.ts` says
"Replicated schema (must stay in sync with useUrlState.ts)" — this is a manual maintenance
contract that will be violated on the first schema change if not caught by review.

**Consequences:**
- A user selects "vSAN Max" in the UI; sharing the URL drops them back to "vSAN ESA" silently
- `calcStorage` receives an unhandled `storageType` value; the function falls through to the
  `fc`/`nfs` pass-through branch if no guard exists, returning raw capacity with zero overhead
  (massively over-optimistic result)
- Existing stretch/dedup validation tests may pass despite incorrect behavior because they
  test `storageType` combinations via `validateInputs`, not via `calcStorage`

**Prevention:**
1. Add a `storageType` enum to `engine/types.ts` and import from there (single source of truth)
2. Convert the `if/else` tree in `calcStorage` to `switch` with an exhaustive `never` case
3. Export the Zod enum variant list from `useUrlState.ts`; import it into the test file —
   do not replicate the schema definition
4. Add a Zod schema test: `storageType: 'vsan-max'` must parse successfully after the change
5. Write the vSAN Max engine function (`calcVsanMaxStorage`) as a separate pure function;
   the main `calcStorage` dispatcher calls it — mirrors how `calcStretch` is separate from
   `calcStorage`

**Detection:**
- URL round-trip test: set `storageType: 'vsan-max'`, serialize, deserialize — verify it is
  not silently coerced to default
- TypeScript build: `tsc --noEmit` must produce zero errors after schema change

**Phase to address:** First task of the vSAN Max phase — update types and schema before writing any
engine logic.

---

### Pitfall 12: URL State Schema Migration Silently Discards New Fields for Existing Shared URLs

**What goes wrong:**
Existing shared URLs (generated before v2.0) contain compressed JSON with the v1 field set.
The Zod schema uses `.strip()` which drops unknown keys but also applies defaults for missing keys.
This is the correct direction — old URLs deserialize safely.

The dangerous direction is new URLs opened in old deployments (edge case: user bookmarks a v2.0
URL and opens it in a cached old build). More practically: the Zod schema test in
`useUrlState.test.ts` tests a hardcoded field list. Adding new fields like `architectureModel` or
`vsanMaxProfile` to `inputStore.ts` but failing to add them to the Zod schema means
`generateShareUrl` serializes them but `hydrateFromUrl` discards them (`.strip()` removes unknown
keys). The store fields remain at their default values after hydration — no error thrown, no
warning logged.

**Why it happens:**
There are three places that must all stay synchronized:
1. `src/stores/inputStore.ts` — the ref declarations
2. `src/composables/useUrlState.ts` — the Zod schema AND the hydration assignment block
3. `src/composables/useUrlState.test.ts` — the test schema replica AND `defaultState`

The hydration assignment block in `hydrateFromUrl` explicitly assigns every field by name
(lines 72–88 of the current file). Adding a field to the store but forgetting to add it to the
assignment block means it is validated but never written to the store.

**Consequences:**
- Shared URLs for vSAN Max configs look valid but silently restore as vSAN ESA
- `architectureModel: 'standard'` → URL → `architectureModel: 'consolidated'` (the default)
- Regression is invisible until a user reports "my shared link gives the wrong answer"

**Prevention:**
1. Create a shared constant `URL_STATE_FIELDS: (keyof InputState)[]` and use it in both
   `generateShareUrl` and `hydrateFromUrl` — eliminates the parallel assignment lists
2. Write a test that uses the Zod schema to verify every key in `inputStore` state appears in
   the schema: `Object.keys(store.$state).forEach(k => expect(InputStateSchema.shape).toHaveProperty(k))`
3. For each new v2.0 field, add it to the schema WITH a default that matches the store default —
   this ensures old URLs hydrate correctly (missing field → default value, not validation error)
4. Use `z.enum(['standard', 'consolidated']).default('standard')` for architecture model; Zod's
   `.default()` handles the old-URL missing-field case automatically

**Detection:**
- Old URL (no `architectureModel` key) + new Zod schema: must parse successfully and default to `'standard'`
- New URL + assertion that all inputStore keys appear in the deserialized state

**Phase to address:** Before writing any UI for new inputs — schema must be updated atomically with store.

---

### Pitfall 13: vSAN Max Is a Fundamentally Different Sizing Model, Not a Storage Overhead Variant

**What goes wrong:**
The existing `calcStorage` function models "how much usable capacity does a cluster of N hosts provide
given vSAN overhead?" vSAN Max (disaggregated) separates storage from compute. The compute cluster
hosts have no local storage (or minimal boot-only storage). The storage cluster hosts have
specialized profiles (vSAN-SC-SM, vSAN-SC-MED, vSAN-SC-LRG — three profiles as of Nov 2025, with
specific reduced CPU/RAM requirements since hosts handle storage processing only).

If the tool reuses `calcStorage` with `storageType: 'vsan-max'` but keeps the same
`hostCount × hostStorageTB` formula, it will produce incorrect results because:
- The compute cluster host count is independent of the storage cluster host count
- The storage cluster requires its own RAID overhead calculation (same ESA Adaptive RAID-5 rules apply)
- The compute cluster hosts do NOT need the storage capacity fields (`hostStorageTB`, `dedupRatio`, etc.)
- Mixing compute and storage host specs in a single `hostCount × hostStorageTB` formula
  conflates two distinct cluster types

**Why it happens:**
vSAN Max reuses the same underlying vSAN ESA RAID engine. Developers assume it is a variant of
`storageType: 'vsan-esa'` and add a flag, rather than modeling the two-cluster topology.

**Consequences:**
- The recommended storage capacity is wrong (compute host storage specs applied to storage cluster math)
- The recommended host count is ambiguous (compute count? storage count? total?)
- The UI has no way to express "I have 8 compute hosts and 4 vSAN Max storage hosts"

**Prevention:**
1. Model vSAN Max with two separate input groups: `vsanMaxComputeHosts` and `vsanMaxStorageHosts`
2. Add a new `VsanMaxInputs` interface to `engine/types.ts` separate from `StorageInputs`
3. The storage cluster sizing still uses `vsanEsaRaidOverhead()` — the RAID math is shared
4. The compute cluster sizing uses the existing `calcCompute()` path unchanged
5. Add 5 ReadyNode profile constants for the storage cluster (as of 2025 docs, 3 official
   profiles exist: XS, SM, MED, LRG; a 5th profile is referenced in earlier docs — verify
   against current Broadcom ReadyNode compatibility guide before hard-coding)
6. Wire `vsanMaxProfile` selection to `vsanMaxStorageHosts` minimum constraint (XS: min 4 hosts,
   MED/LRG: min 4 hosts per Nov 2025 docs)

**Detection:**
- Test: vSAN Max with 8 compute hosts and 4 storage hosts should NOT multiply `8 × hostStorageTB`
- Test: the compute host count recommendation must use `VsanMaxInputs.computeHostCount` not
  `vsanMaxStorageHosts`

**Phase to address:** Design the `VsanMaxInputs` type BEFORE writing any UI — the data model
difference must be explicit.

---

### Pitfall 14: Standard vs Consolidated Architecture Model Is a Naming Trap in VCF 9

**What goes wrong:**
In VCF 5.x, "Standard" meant dedicated management domain + separate workload domains, and
"Consolidated" meant management and workload VMs collocated in a single cluster. VCF 9 dropped
these term names (confirmed by community evidence: "Consolidated Architecture isn't being used in
VCF 9 as it created confusion"). VCF 9 now describes the same concepts as two deployment modes:
(a) separate management domain + VI workload domain, or (b) combined management+workload domain.

A sizing tool that uses "Standard" vs "Consolidated" labels in the UI will confuse VCF 9 users
who have read current documentation. The important constraint to model is: when management and
workload are separated, the management cluster requires a minimum of 4 dedicated hosts (vSAN or
external storage). When combined, the minimum is still 4 hosts (Broadcom design requirement
VCF-VSAN-REQD-CFG-002) but the host count is shared.

**Why it happens:**
The milestone brief uses "Standard vs Consolidated" (based on VCF 5.x docs). The VCF 9
documentation uses different language. If UI labels copy the v5 terms verbatim, they will
misalign with VCF 9 admin expectations.

**Consequences:**
- User confusion: "Standard" in v5 means one thing, but the current Broadcom docs use
  different framing
- Validation rule "management cluster requires 4 hosts" must fire in both models
- The resource pool isolation note (in the combined model) cannot be labeled "Consolidated"
  without potential misinterpretation

**Prevention:**
1. Use VCF 9 terminology in UI labels: "Separate Management Domain" vs
   "Combined Management + Workload Domain" (or similar)
2. In the engine, the internal enum key can still be `'standard' | 'consolidated'` for
   brevity, but i18n keys must use current official language
3. The 4-host minimum validation rule must apply in BOTH modes — do not gate it only on
   "standard" architecture
4. Add a tooltip in the UI explaining the combined model uses vSphere resource pools for
   isolation, not a separate vCenter

**Detection:**
- Review every i18n key containing "standard" or "consolidated" before release
- Test: in "combined" mode, a 3-host config must still trigger the 4-host minimum warning

**Phase to address:** UI design phase, BEFORE i18n keys are committed — labels set i18n key names,
which are hard to rename later without hunting all 4 locale files.

---

## Moderate Pitfalls

### Pitfall 15: Stretch Bandwidth Floor Test Regression When Floor Is Added

**What goes wrong:**
The current `calcStretch` function returns `minBandwidthGbps` as a raw computed value:
`totalWorkloadStorageTB × 0.1`. The existing test pins this formula:

```typescript
// stretch.test.ts line 38
expect(result.minBandwidthGbps).toBeCloseTo(expectedStorageTB * 0.1, 5)
```

When the 10 Gbps floor is added (`Math.max(10, computedValue)`), any configuration where
`totalWorkloadStorageTB × 0.1 < 10` will produce `10` — and the existing test will fail
because it asserts the pre-floor formula result.

The test case uses 100 VMs × 100 GB = ~0.977 Gbps, which is well below the 10 Gbps floor.
This is therefore a guaranteed test failure on the first run after the floor is added.

**Why it happens:**
The existing test was written to validate the formula, not the policy. A floor is a policy
change that the test does not anticipate.

**Consequences:**
- CI turns red on a correct implementation
- Developer reverts the floor or adjusts the test to match the old (wrong) behavior

**Prevention:**
1. Write the new test case first (TDD): `expect(result.minBandwidthGbps).toBeGreaterThanOrEqual(10)`
2. Update the existing test to assert the floor behavior:
   `expect(result.minBandwidthGbps).toBe(10)` for the 100-VM case
3. Add a test case that exercises above-floor: `vmCount: 200000, avgStorageGbPerVm: 1000`
   should produce `minBandwidthGbps > 10`
4. The constant `STRETCH_MIN_BANDWIDTH_GBPS = 10` should live in `stretch.ts` next to the
   other stretch constants — not inline in the formula

**Detection:**
- Run existing tests before making the change to confirm the test currently passes with `~0.097`
- Then add the floor and confirm the test fails in the expected place — then fix the test
- This is the intended TDD flow; the test failure is not a bug, it is the signal

**Phase to address:** First sub-task of the bandwidth floor work.

---

### Pitfall 16: Stretch Network Checklist i18n Keys Added to Only One Locale

**What goes wrong:**
The stretch network checklist (MTU 9000, <5ms RTT between data sites, <200ms witness RTT for
clusters up to 10 hosts per site, <100ms witness RTT for 11-15 hosts per site) is display-only.
No engine computation is involved. The implementation risk is entirely in i18n completeness.

The pattern of adding a new display block to the results panel typically happens in a single
component file. Developers add the i18n key to `en.json` (the working language), verify visually
in the browser, and move on. The other three locale files (`fr.json`, `de.json`, `it.json`) are
not updated in the same commit.

Vue-i18n's fallback behavior: when `missingWarn` is not explicitly set to `false`, a missing
key logs a console warning and falls back to the key name (e.g., `"deployment.stretch.mtuNote"`
is rendered as literal text). This is visually obvious in German or Italian but silent in the
test suite if tests only run in the `en` locale.

**Why it happens:**
i18n key additions are not enforced by TypeScript — there is no compile-time check that all four
locale files have the same key set. The pattern is a human process discipline problem.

**Consequences:**
- German and Italian UIs show raw i18n key strings in the stretch network section
- The `en` locale looks correct; CI passes if tests only render in English
- Discovered by the first French or German speaker who opens the results panel

**Prevention:**
1. Add a test that compares the key set of all four locale files:
   `expect(Object.keys(flattenKeys(de))).toEqual(Object.keys(flattenKeys(en)))` — this
   catches structural divergence across all locales
2. When adding checklist keys, edit all four locale files in the same commit — treat it as
   an atomic operation with a checklist in the PR template
3. For the stretch checklist specifically, the keys needed are:
   - `deployment.stretch.networkChecklist.title`
   - `deployment.stretch.networkChecklist.mtu` (value: MTU 9000 required on inter-site links)
   - `deployment.stretch.networkChecklist.rttDataSites` (value: <5ms RTT between data sites)
   - `deployment.stretch.networkChecklist.rttWitnessSmall` (value: <200ms for ≤10 hosts/site)
   - `deployment.stretch.networkChecklist.rttWitnessLarge` (value: <100ms for 11-15 hosts/site)
4. The checklist content is display-only — these keys do NOT need engine input, only the
   `deploymentMode === 'stretch'` guard to show/hide the section

**Detection:**
- Switch locale to `de` or `it` in a browser after adding the checklist — scan for raw key strings
- Add locale key-set equality test to CI before the feature is merged

**Phase to address:** Same commit as the checklist UI component — never as a follow-up.

---

### Pitfall 17: `calculationStore` Computed Chain Must Not Be Extended with `ref()` for Architecture Mode

**What goes wrong:**
The codebase enforces a strict constraint: `calculationStore.ts` returns only `computed()` values
(enforced by the comment `// All returned values are computed — ZERO ref() in this store (CALC-02)`).
When adding Standard vs Consolidated architecture selection, the instinct is to add the
`architectureModel` ref to `calculationStore` since it affects the management domain calculation.

Adding `ref()` to `calculationStore` violates the established constraint and creates a split-brain
state: `architectureModel` lives in the calc store, but all other inputs live in `inputStore`.
URL state hydration only writes to `inputStore` — the new ref would not be restored from URL.

**Why it happens:**
Architecture mode visually "belongs" with the calculation output (it changes management resource
totals), so developers add it to `calculationStore`.

**Consequences:**
- URL state for `architectureModel` is never persisted (the field is not in `inputStore` or the
  Zod schema)
- The constraint comment `CALC-02` is violated, creating precedent for future ref() pollution
- `calcManagement()` receives `deploymentMode` from `inputStore` — if `architectureModel` is
  sourced from a different store, the data flow becomes inconsistent

**Prevention:**
1. `architectureModel` (and `vsanMaxProfile`, `vsanMaxComputeHosts`, `vsanMaxStorageHosts`) go
   in `inputStore.ts` as `ref()` values
2. `calculationStore.ts` reads these from `inputStore` via `computed()` — same pattern as all
   other fields
3. The Zod schema in `useUrlState.ts` must include these fields
4. Update `calcManagement` signature to accept `architectureModel` as an input parameter
   (not read from a store directly) — the engine must remain a pure function

**Detection:**
- TypeScript: `calculationStore.ts` must export zero `ref()` symbols — add a linting rule or
  comment-enforced review check
- Test: `hydrateFromUrl` round-trip must restore `architectureModel` to the correct value

**Phase to address:** inputStore design before any engine or UI work.

---

## Minor Pitfalls

### Pitfall 18: vSAN Max ReadyNode Profile Specs Are Actively Changing

**What goes wrong:**
The vSAN Max ReadyNode profiles were updated in November 2025 — minimums were reduced
significantly (XS minimum went from 75TB to 20TB; SM RAM minimum reduced from 512GB to 384GB).
If the sizing tool hard-codes profile minimums from the 2023 profile introduction blog, it will
display unnecessarily high minimums, making vSAN Max look more expensive than it is.

**Why it happens:**
The profiles are documented in a Broadcom compatibility guide (`compatibilityguide.broadcom.com`)
and a blog post — not a stable versioned spec. Profile minimums can change between VCF releases.

**Prevention:**
1. Source the ReadyNode profile constants from the most recent official source at implementation
   time — check both the Nov 2025 blog post and the current vSAN ESA ReadyNode Hardware Guidance
2. Add a comment to the constants file: `// Source: [URL], verified [date]` with the source
   URL and verification date
3. Mark the profile constants as needing review before each major VCF version bump
4. As of Nov 2025 docs (MEDIUM confidence — blog post, not versioned spec):
   - XS: min 4 hosts, 20 TB/host, 24 cores, 2 NVMe devices
   - SM: min 4 hosts, 50 TB/host, 32 cores, 384 GB RAM
   - MED: min 4 hosts, 100 TB/host, 40 cores, 512 GB RAM
   - LRG: min 4 hosts, 150 TB/host, 48 cores, 768 GB RAM
   - XL: min 4 hosts (specs not publicly confirmed in reviewed sources)

**Detection:**
- Before shipping, cross-check constants against `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance`

**Phase to address:** vSAN Max engine phase — flag constants for verification before merge.

---

### Pitfall 19: Existing Tests for `calcStretch` Will Need to Account for the New `networkChecklist` Field

**What goes wrong:**
The `StretchResult` interface currently has 6 fields. When `networkChecklist` data is added
(even if display-only, it may be added to the return type for completeness), all existing
snapshot tests against `StretchResult` will fail if they assert strict object equality.

The existing tests in `stretch.test.ts` use `toBe()` on specific fields — they do NOT use
`toMatchObject()` (which would pass with extra fields). Adding a new field to `StretchResult`
without updating tests produces test failures in an otherwise correct implementation.

**Why it happens:**
Tests written against the current structure silently become strict object equality checks
when a field is added, depending on how the assertion is written.

**Prevention:**
1. If `networkChecklist` is added to `StretchResult`, update all existing tests to use
   `toMatchObject({ field: value })` rather than `expect(result).toEqual({...all fields})`
2. Prefer not adding the checklist to `StretchResult` — keep it as static display data
   in the component, keyed only on `deploymentMode === 'stretch'`. This avoids changing
   the engine interface entirely.
3. If checklist thresholds must be returned from the engine (e.g., to compute witness RTT
   tier based on hosts/site), add a dedicated `stretchNetworkReqs()` pure function rather
   than extending `StretchResult`

**Detection:**
- Run the full test suite after adding any field to `StretchResult`; all affected tests
  will fail immediately

**Phase to address:** Stretch network checklist phase.

---

## Phase-Specific Warnings (v2.0 Additions)

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| vSAN Max type addition | StorageType enum not updated in Zod schema | Update types.ts, useUrlState.ts, and test schema in one atomic commit |
| vSAN Max engine | Reusing calcStorage for fundamentally different 2-cluster topology | New VsanMaxInputs interface; compute and storage clusters sized separately |
| vSAN Max ReadyNode profiles | Hard-coding outdated minimums from 2023 | Verify against Nov 2025 blog + Broadcom compatibility guide at implementation time |
| Standard vs Consolidated | Using VCF 5.x terminology in VCF 9 UI | Use VCF 9 language: "Separate Management Domain" vs "Combined Domain" |
| Standard vs Consolidated | Adding architectureModel to calculationStore as ref() | architectureModel belongs in inputStore only |
| Stretch bandwidth floor | Existing test asserts pre-floor formula result | Update existing test first; assert floor behavior before adding Decimal.js max() |
| Stretch network checklist | Adding keys to en.json only | Add to all 4 locales in the same commit; add locale key-set equality test |
| Stretch network checklist | Adding network fields to StretchResult type | Keep checklist as static display data in component; do not extend StretchResult |
| URL schema migration | New fields serialized but not in Zod schema | Zod schema and inputStore must be updated atomically; hydration assignment block must be updated |
| URL schema migration | Test schema replica in useUrlState.test.ts diverges | Export schema fields list; import in tests rather than replicating |

---

## v1.0 Pitfalls (Retained from Original Research)

### Pitfall 1: Floating-Point Arithmetic Errors in Sizing Calculations

**What goes wrong:**
JavaScript's native `Number` type uses IEEE 754 binary floating-point, which cannot exactly represent many decimal fractions. The classic `0.1 + 0.2 === 0.30000000000000004` failure surfaces in sizing tools as host counts drifting by 0.0000x, storage overhead percentages rounding incorrectly, or the NVMe tiering 50% active-memory threshold flipping the wrong direction at boundary values. A user who inputs exactly 50% active memory may see NVMe tiering enabled or disabled depending on whether the comparison is `<=` against a float that accumulated drift.

**Why it happens:**
Developers write `totalRAM * 0.5` and compare with `<=` to detect the threshold, then find that e.g. `48 * 0.5` equals `24.000000000000004` in binary float, causing off-by-epsilon logic errors. The problem is invisible during casual testing because numbers like 48 GB produce no visible drift, but workload-specific combinations (e.g. 4.3 TB storage with 1.13 deduplication ratio) expose accumulation.

**How to avoid:**
Use `decimal.js` (arbitrary-precision) or `Decimal` for all sizing arithmetic — never native `+`, `*`, `/` on floating-point inputs. For integer-bounded quantities (host counts, vCPU counts) use `Math.ceil()` on the result of a Decimal computation, not native division. Define a project-wide `Calc` wrapper that rejects raw numbers and always operates on `Decimal` instances.

**Warning signs:**

- Unit tests show values like `3.0000000000000004` for a host count
- Snapshot tests for known VCF sizing scenarios diverge after adding or removing a workload profile
- The NVMe tiering toggle flips state unexpectedly near the 50% boundary

**Phase to address:** Phase 1 (Foundation / Core Calculation Engine) — establish the Decimal-based math layer before any formula is written.

---

### Pitfall 2: vSAN ESA Adaptive RAID-5 Threshold Miscalculation

**What goes wrong:**
The tool hard-codes "RAID-5 needs minimum 4 hosts" and calculates storage overhead as always 125% (4+1 scheme). In practice, vSAN ESA uses Adaptive RAID-5: clusters of 5 or fewer hosts use the **2+1 scheme (150% overhead)**, while clusters of 6+ hosts switch to the **4+1 scheme (125% overhead)**. A calculator that ignores this threshold will under-estimate required raw capacity by 20% for small clusters, causing undersized hardware orders.

Additionally, when a 6-node cluster loses a host (or has one in maintenance), vSAN automatically downgrades from 4+1 to 2+1 after 24 hours. Sizings that do not account for the spare-host design pattern will output the wrong overhead figure.

**Why it happens:**
Older OSA documentation stated "RAID-5 FTT=1 requires 4 hosts minimum" — this is correct for OSA but wrong for ESA's 4+1 scheme. Developers copy the 4-host minimum and the 125% overhead constant without reading the ESA-specific Adaptive RAID-5 documentation.

**How to avoid:**
Implement a `raidOverhead(hostCount, ftLevel, raidType)` function with the correct ESA thresholds:

- RAID-1 FTT=1: min 3 hosts, 200% overhead (2 copies)
- RAID-5 (2+1): 3 to 5 hosts, 150% overhead
- RAID-5 (4+1): 6+ hosts, 125% overhead
- RAID-6 (4+2) FTT=2: min 6 hosts, 150% overhead
- RAID-1 FTT=2: min 5 hosts, 300% overhead

Source the thresholds from Duncan Epping's January 2024 ESA post, not the OSA guide.

**Warning signs:**

- Storage results for a 5-node cluster look the same as for a 6-node cluster
- RAID-5 overhead is always displayed as 1.25x regardless of host count
- No visual distinction between 2+1 and 4+1 in the UI

**Phase to address:** Phase 2 (Storage Calculation Module) — encode the Adaptive RAID-5 matrix in a dedicated lookup before any storage UI is built.

---

### Pitfall 3: vSAN ESA Capacity Overhead Stack Omission

**What goes wrong:**
The tool calculates "usable capacity = raw / RAID_overhead" and stops, missing two additional compulsory overheads:

1. **vSAN LFS (Log-Structured Filesystem) overhead:** approximately 13% of object + replica data written — this is not optional and does not depend on workload.
2. **Global metadata:** approximately 10% of total raw cluster capacity reserved for metadata.

Applying only the RAID overhead under-reports required raw disk capacity by roughly 20 to 25% for typical deployments.

**Why it happens:**
The LFS and metadata overheads are documented in a separate VMware blog post ("Capacity Overheads for the ESA in vSAN 8") that is less prominent than the RAID guides. Developers read the RAID guide and stop.

**How to avoid:**
The correct formula stack (sequential application):

```
1. raw_after_dedup    = raw_input x dedup_ratio            (if Global Dedup enabled)
2. data_for_raid      = raw_after_dedup
3. usable_before_lfs  = data_for_raid / raid_overhead_multiplier
4. usable_after_lfs   = usable_before_lfs x (1 - 0.13)    (LFS approx 13%)
5. global_meta_pool   = total_raw_cluster x 0.10            (metadata approx 10% of raw)
6. net_usable         = usable_after_lfs - global_meta_pool
```

Apply these as a chain of Decimal operations. Write a unit test that reproduces the worked example from the VMware ESA capacity blog.

**Warning signs:**

- Usable capacity output is suspiciously high compared to vSAN ReadyNode Sizer for the same inputs
- No mention of LFS or metadata overhead fields in the storage breakdown chart
- Storage "surplus" bar in the chart never turns negative even at 100% fill

**Phase to address:** Phase 2 (Storage Calculation Module) — validate formula against vSAN ReadyNode Sizer output before declaring storage module complete.

---

### Pitfall 4: VCFA HA Multiplier Not Applied to All Components

**What goes wrong:**
In HA (Production) mode, the management domain requires 3 instances of NSX Manager, VCF Operations, AND VCF Automation (VCFA). A common mistake is applying the x3 multiplier only to NSX Manager while treating VCF Operations and VCFA as singletons, or forgetting to multiply storage disk requirements by 3 as well. This silently under-counts management domain resource consumption by 50 to 60%.

VCFA specifics that are easy to get wrong:

- VCFA requires 24 vCPU / 96 GB RAM per instance — in HA mode that is 72 vCPU / 288 GB RAM for VCFA alone
- VCFA HA uses medium (150 GB disk) or large (200 GB disk) volumes — not the singleton 75 GB
- Physical hosts must have at least 12 physical cores / 24 threads for VCFA to deploy at all; this is a hard blocker, not a performance concern

**Why it happens:**
The VCF 9 deployment documentation describes HA mode globally but lists per-component specs in separate tables. It is easy to miss that "3-node" applies to every named appliance.

**How to avoid:**
Model each management component (vCenter, SDDC Mgr, NSX Mgr, VCF Ops, VCFA) as a typed object with `{ vCPU, ramGB, diskGB, count }`. The `count` field is driven by deployment mode: `count = 1` (Simple) or `count = 3` (HA). Total management overhead = sum across all components. Validate totals against the known minimums from Broadcom KB 397782 and the VCF 9 deployment guide.

**Warning signs:**

- Management domain vCPU count in HA mode is less than approximately 100 vCPU total (it should be well above this)
- Storage overview shows no disk difference between Simple and HA modes
- The tool never warns about the 12-core / 24-thread physical host requirement for VCFA

**Phase to address:** Phase 1 (Management Domain Baseline) — hard-code component specs as constants sourced from official Broadcom documentation, never as magic numbers inline.

---

### Pitfall 5: NVMe Memory Tiering Threshold Applied to Wrong Metric

**What goes wrong:**
The tool checks if `totalConfiguredRAM * 0.5 >= workloadRAMRequired` to decide whether NVMe tiering can halve physical DRAM. The correct condition is that **active memory** (hot working set) must be at or below 50% of physical DRAM — not total configured or allocated memory. Configured memory and active memory are different: a VM may be allocated 256 GB but only actively use 80 GB at peak. Using allocated memory instead of active memory causes the tool to falsely disqualify NVMe tiering for large-RAM VMs, or falsely enable it for memory-intensive workloads.

**Why it happens:**
The VCF 9 NVMe tiering documentation states "keep active memory at or below 50% of DRAM." Most sizing tools expose only "total VM RAM" as an input, and developers map this directly to "active memory" for simplicity.

**How to avoid:**
Add an explicit "memory activeness %" input (default 70%, representing typical enterprise workloads) alongside total VM RAM. Active memory = total VM RAM x activeness %. NVMe tiering is then beneficial only when active memory is at or below 50% of DRAM. Display both the input assumption and the derived active-memory figure prominently so users can override the default.

**Warning signs:**

- NVMe tiering is triggered for a workload where all VMs are described as memory-intensive databases
- The activeness percentage has no input field — the tool implicitly assumes 100%
- DRAM reduction benefit shows 2x for workloads where active memory clearly exceeds DRAM

**Phase to address:** Phase 3 (Compute / NVMe Tiering Feature) — model active-memory ratio as a first-class user input with a visible tooltip explaining the 50% threshold.

---

### Pitfall 6: Swiss Locale Number Formatting Inconsistency

**What goes wrong:**
Switzerland uses an apostrophe as the thousands separator with a period as the decimal separator: `1'234'567.89`. The four Swiss locales (`fr-CH`, `de-CH`, `it-CH`, `en-CH`) should all use this format, but `Intl.NumberFormat` implementations vary:

- Some browser and OS versions output a regular single quote instead of the Unicode apostrophe (U+2019) — visually identical but causes test assertion failures
- `fr-CH` has documented inconsistencies in some JS runtimes — numbers may render with a space separator instead of apostrophe
- vue-i18n's number format configuration must be explicitly defined for every locale: there is no automatic Swiss format inheritance. An unconfigured locale falls back to its parent (`fr`, not `fr-CH`) and shows European formats such as `1.234.567,89`

**Why it happens:**
vue-i18n delegates to `Intl.NumberFormat` under the hood. Developers define `fr` but forget `fr-CH`, `de-CH`, `it-CH` as distinct entries in `numberFormats`. A locale-switch test works in Chrome on macOS but fails in Firefox on Linux due to CLDR data differences.

**How to avoid:**
Explicitly define `numberFormats` for all four Swiss locales in the vue-i18n configuration. Write cross-locale snapshot tests using `@formatjs/intl-numberformat` as a polyfill to get deterministic output regardless of browser CLDR version. Test input values like `1234567.89` and `0.5` in all four locales.

**Warning signs:**

- Numbers display identically in `fr-CH` and `fr` locale
- Storage figures display as `1.500.000,00` (European format) after switching to German
- CI tests pass but user reports the DE locale shows wrong separators in their browser

**Phase to address:** Phase 1 (i18n Foundation) — configure all four Swiss locales explicitly on day one; never add them as an afterthought.

---

### Pitfall 7: URL State Sharing Breaks with Standard Base64

**What goes wrong:**
Standard Base64 uses `+`, `/`, and `=` characters. When embedded in a URL query string or fragment, these characters have special meaning: `+` decodes as space, `=` is interpreted as key-value separator, `/` confuses path parsing. A URL like `?config=abc+def/xyz==` will silently corrupt to `abc def/xyz` when decoded by a browser's `URLSearchParams`, breaking state restoration.

Additionally, large configurations (many VMs, multiple workload profiles) can push the base64 string past browser-specific URL limits. Chrome truncates at 2 MB, Internet Explorer at 2,083 characters — but email clients, Slack, and Teams preview links break at approximately 500 characters.

**Why it happens:**
Developers use `btoa()` + `JSON.stringify()` directly without applying URL-safe encoding. This works in isolated testing (where the URL is pasted rather than processed) but fails in email links and social sharing.

**How to avoid:**
Use **Base64URL** encoding (RFC 4648 section 5): replace `+` with `-`, `/` with `_`, and strip trailing `=`. In modern browsers, apply `encodeURIComponent(btoa(json))` at minimum, or a library that outputs Base64URL natively. Compress the JSON with `lz-string` or `pako` before encoding to stay well under 2,000 characters for typical configurations. Add a unit test that round-trips a maximum-complexity configuration (all deployment modes, all workloads, all languages) and verifies URL length below 1,800 characters.

**Warning signs:**

- Pasting a shared URL into Outlook strips content after the `+`
- State round-trip test fails when workload names contain spaces or special characters
- URL length exceeds 2,000 characters for a 10-workload configuration

**Phase to address:** Phase 4 (URL State Sharing) — design the encode and decode pipeline with Base64URL plus compression from the start; do not retrofit later.

---

### Pitfall 8: Chart.js and Vue 3 Reactivity Causing Silent Double-Update or Stale Charts

**What goes wrong:**
Wrapping a Chart.js instance in a Vue 3 `reactive()` object triggers the Chart.js internal `update()` method inside Vue's reactive proxy, causing a "Maximum update depth exceeded" recursion error (confirmed GitHub issue #11619). Alternatively, charts that receive data via shallow copies update the labels array but not the datasets, leaving the chart displaying stale bars while Pinia state is correct.

A second pattern: using `watch()` on a large Pinia store that contains all sizing inputs causes a "watcher storm" — every keystroke in any input field re-triggers all chart watchers simultaneously, leading to 300 to 500 ms render delays on mid-range devices.

**Why it happens:**
Vue's deep reactivity wraps every nested object in a Proxy. Chart.js instances maintain internal mutable state that conflicts with Proxy interception. Developers register the chart instance as `const chart = reactive(new Chart(...))` thinking this enables reactive updates, but this is the wrong integration pattern.

**How to avoid:**
Store Chart.js instances in `shallowRef()`, never in `reactive()` or `ref()`. Pass data to charts via computed properties derived from the Pinia store, using `watch(computedChartData, () => chart.value.update())` with `{ flush: 'post' }` to batch updates after the DOM cycle. For Pinia, break the monolithic state store into domain-specific stores (compute store, storage store, network store) so watchers are scoped and do not cascade. Use `vue-chartjs` as the integration layer — it handles the `shallowRef` pattern correctly.

**Warning signs:**

- Browser console shows "Maximum update depth exceeded" when chart inputs change
- Charts correctly update in development but are one update behind in production
- CPU spikes to 100% when the user types quickly in the VM count input field

**Phase to address:** Phase 3 (Visualization / Chart Integration) — prototype the chart and reactivity integration in isolation before integrating with the full store.

---

### Pitfall 9: PDF Export Font and Layout Regression

**What goes wrong:**
`html2canvas` + `jsPDF` rasterizes the DOM into a PNG and embeds it in a PDF. This approach has three VCF-sizer-specific failure modes:

1. **Font rendering:** Web fonts (e.g., Inter, the default Tailwind sans) are not loaded at the time html2canvas captures the DOM — the PDF shows fallback serif fonts or blank text boxes.
2. **CSS layout collapse:** Flex and Grid layouts used by Tailwind lose their computed styles during the DOM clone that html2canvas performs. Charts collapse to zero-height divs.
3. **File size:** A full-page raster at 2x DPI for a complex sizing report produces a 5 to 15 MB PDF — impractical for email attachment.

**Why it happens:**
html2canvas operates on a cloned DOM, and the clone does not inherit computed styles applied via `<link>` stylesheets loaded after initial paint. Charts rendered via `<canvas>` elements are copied as blank because the canvas `toDataURL()` call happens before the animation frame completes.

**How to avoid:**
Use the `@page` CSS print media approach first: a `window.print()` triggered PDF with `@media print` overrides is zero-dependency and preserves fonts and layout correctly. For a "true PDF" button, use `@vueuse/core`'s `useEventListener` to trigger a print dialog styled with a print stylesheet. If a downloadable file (not print dialog) is required, evaluate `jspdf-autotable` for data tables and render charts to `canvas.toDataURL()` explicitly before calling html2canvas. Always test PDF export in both Chrome and Firefox headless.

**Warning signs:**

- PDF preview shows "Helvetica" instead of the project typeface
- Bar charts appear as empty rectangles in the exported PDF
- PDF file sizes exceed 5 MB for a standard 3-workload configuration
- Export works in Chrome dev tools but fails in Playwright headless tests

**Phase to address:** Phase 5 (Export Features) — prototype PDF generation as a standalone spike in week 1 of that phase; do not assume html2canvas works without validation.

---

### Pitfall 10: Stretch Cluster Witness Size Selected Without Component Count Calculation

**What goes wrong:**
The tool offers a "Stretch Cluster" toggle and simply adds a "witness appliance" line to the BOM without calculating the correct witness appliance size tier. vSAN witness appliances have four sizes (Tiny / Medium / Large / Extra Large) supporting up to 750 / 21,833 / 45,000 / 45,000+ components respectively. A Tiny witness for a 200-VM stretched cluster will have too few component slots, causing the cluster to fail health checks at deployment time.

The component count formula is non-trivial: each VM with FTT=1 RAID-1 generates approximately 3 components per disk, plus witness components. The calculator must sum components across all VMs, accounting for snapshot overhead and storage policy variations.

**Why it happens:**
The witness appliance is perceived as a "small helper VM" — developers default to Tiny and move on. The component count calculation is buried in the vSAN Stretched Cluster Guide, not in the main sizing guide.

**How to avoid:**
Implement a `witnessComponentCount(vmCount, disksPerVM, policy)` function. Map the result to witness size tiers:

- Below 750 components: Tiny
- 750 to 21,833 components: Medium
- 21,834 to 45,000 components: Large
- Above 45,000 components: Extra Large

Display the calculated component count alongside the recommended witness tier so users can audit the result.

**Warning signs:**

- The tool always recommends "Tiny" witness regardless of VM count
- No component count figure appears in the stretch cluster section
- The witness section has no inputs for disks-per-VM or storage policy

**Phase to address:** Phase 2 (Stretch Cluster Module) — define the component count model before designing the stretch cluster UI.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Native JS `Number` for all calculations | Simpler code | Off-by-epsilon errors in host count recommendations; potential NVMe threshold flip | Never — use Decimal.js from day one |
| Single monolithic Pinia store for all inputs | Easier to prototype | Watcher storms on every keystroke; chart re-renders for unrelated input changes | MVP prototype only — refactor before Phase 2 |
| Hardcoded English-only strings in components | Faster initial build | Cannot retrofit i18n without full component audit | Never — add vue-i18n from day one |
| `window.btoa()` without Base64URL conversion | Works in local testing | Shared URLs break in email clients and Slack | Never — Base64URL adds 3 lines of code |
| `html2canvas` default settings for PDF | Quick to implement | Blank fonts, collapsed Tailwind layouts, 10 MB PDFs | Prototype only — spike real implementation |
| Assuming deduplication ratio = 2x always | Simpler storage math | Undersized or oversized raw disk estimates depending on workload | Never — make dedupe ratio a user input with 2x default |
| Single `numberFormats` entry for `fr` covering all Swiss locales | Fewer config lines | German and Italian Swiss locales show European thousand/decimal separators | Never — all four Swiss locales must be explicit |
| Adding `vsan-max` to StorageType without updating Zod schema | Passes TypeScript | URL state silently reverts vSAN Max to default on share/restore | Never — schema must be updated atomically with types |
| Duplicating Zod schema in test file | Convenient | Test schema diverges from real schema silently | Never — export fields list and import in tests |
| Extending `StretchResult` with checklist fields | All in one struct | Breaks existing stretch tests; couples display data to engine contract | Never — keep checklist as static display-only data |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| vue-i18n + Intl.NumberFormat | Define `fr` numberFormat and assume `fr-CH` inherits it | Explicit `numberFormats` block for `fr-CH`, `de-CH`, `it-CH`, `en` — no inheritance |
| Chart.js + Vue 3 Pinia | Store Chart.js instance in `reactive()` | Store in `shallowRef()`; use `vue-chartjs` wrapper; update via `watch(..., { flush: 'post' })` |
| Base64 URL state | Use `btoa()` directly | Compress JSON with `lz-string`, then apply Base64URL encoding (replace `+` to `-`, `/` to `_`, strip `=`) |
| html2canvas + Tailwind | Assume CSS is captured during clone | Inline critical styles; pre-render canvas elements; use `@media print` as primary export path |
| Decimal.js + Vue reactive | Wrap Decimal instances in `reactive()` — Proxy breaks Decimal internals | Extract primitive value before storing in reactive state: `computed(() => myDecimal.toNumber())` |
| vSAN formula constants | Copy from OSA documentation | Always source from ESA-specific docs; OSA and ESA use different overhead percentages |
| StorageType enum + Zod | Add enum variant to TypeScript but not to Zod schema | Single source enum in types.ts; Zod enum constructed from the same constant |
| inputStore + calculationStore | Add new input field ref() to calculationStore (CALC-02 violation) | All ref() live in inputStore; calculationStore is computed()-only |
| i18n key additions | Add new key to en.json only | Add atomically to all 4 locale files; add locale key-set equality test |
| URL schema test | Replicate full schema in test file | Export schema shape list; import in test — do not replicate |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Deep `watch()` on entire Pinia sizing store | 300 to 500 ms input lag; chart redraws on unrelated field changes | Split into domain stores; use `watchEffect` with explicit dependency tracking | At approximately 10 reactive fields in the same store |
| Re-running all sizing formulas on every keystroke | UI jank during VM count input; Decimal.js chains are not free | Debounce reactive computation triggers (150 ms); use `computed` with Decimal caching | Immediately visible on mid-range mobile |
| Serializing full Pinia state to `localStorage` on every change | localStorage writes block the main thread | Debounce persistence writes; only persist on intentional actions (export, share) | At approximately 50 KB state object |
| Base64-encoding a 500-field JSON without compression | URL exceeds 2,000 characters | Compress with `lz-string` before encoding | At roughly 15+ workload profiles |
| Rendering chart data as deeply nested reactive arrays | Chart.js proxy recursion crash | Use `shallowRef` + explicit `.value` replacement instead of mutating nested arrays | At first chart data update after locale switch |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Deserializing base64-decoded URL state without schema validation | Crafted URLs could inject unexpected values that break calculations or display incorrect results | Use `JSON.parse()` wrapped in try/catch, then validate schema with Zod before trusting any value; reject unknown keys |
| Trusting deduplication ratio inputs without bounds checking | User enters 100x ratio, tool shows 0 GB required storage | Clamp all ratio inputs: dedup 1.0 to 10.0x, compression 1.0 to 8.0x, activeness 10 to 100% |
| Embedding internal company infrastructure data in a shared URL | Base64 is not encryption — anyone receiving the URL can decode the full configuration | Add a visible warning: "Shared URLs contain your full configuration in readable form" |
| No input validation on VM count | User enters negative or NaN counts, Decimal operations throw | Validate all numeric inputs at the store layer before computation; display field-level errors |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw capacity and usable capacity without labeling which is which | Architects order the wrong amount of disks | Always label: "Raw Disk Capacity" vs. "Net Usable (after RAID + LFS + metadata)" with a tooltip explaining the stack |
| Updating all charts on every keystroke | Visual noise; hard to read while typing | Debounce chart updates 300 ms after last input change |
| Presenting NVMe tiering as an on/off toggle with no explanation | Users enable it for all workloads, even latency-sensitive ones | Show a warning when NVMe tiering is enabled: "Not suitable for Fault Tolerance VMs, Monster VMs (more than 1 TB RAM), or SGX workloads" |
| Displaying the sizing result without a confidence indicator | Users treat approximate deduplication estimates as guarantees | Show a banner: "Deduplication savings are workload-dependent; 2x is a conservative baseline" |
| Language-switching causing in-progress calculations to reset | User switches to German mid-session; number fields reset to defaults | Store all computation state in Pinia (language-independent); only apply locale to display layer |
| Sharing a URL that is too long for email | Link appears broken in Outlook | Show URL length indicator in the share dialog with a warning if above 1,800 characters |
| Labeling combined-domain mode as "Consolidated" (VCF 5.x term) | VCF 9 admins unfamiliar with the v5 term are confused | Use VCF 9 terminology in all UI labels and tooltips |

---

## "Looks Done But Isn't" Checklist

- [ ] **vSAN ESA RAID overhead:** Verify the Adaptive RAID-5 threshold (3 to 5 hosts = 2+1 scheme; 6+ hosts = 4+1 scheme) is implemented and produces different storage totals for a 5-node vs. 6-node cluster.
- [ ] **LFS + metadata overhead:** Confirm usable capacity includes the approximately 13% LFS and approximately 10% global metadata deductions; compare output to vSAN ReadyNode Sizer for the same inputs.
- [ ] **HA multiplier completeness:** Confirm that switching to HA mode multiplies resource counts for NSX Manager, VCF Operations, AND VCF Automation — not just one of them.
- [ ] **VCFA core/thread blocker:** Confirm a hard warning fires when a host spec shows fewer than 12 cores / 24 threads in HA mode with VCFA enabled.
- [ ] **Swiss locales explicitly configured:** Switch to each of `fr-CH`, `de-CH`, `it-CH`, `en` and verify apostrophe thousands separator and decimal period for a value like `1234567.89`.
- [ ] **Base64URL round-trip:** Paste a shared URL into a raw HTTP client (not a browser that may auto-decode) and verify state restores correctly, including VM names with spaces and special characters.
- [ ] **NVMe tiering activeness input:** Confirm there is an explicit "memory activeness %" input and that the NVMe tiering toggle only activates when active memory is at or below 50% of DRAM.
- [ ] **Witness component count:** Confirm stretch cluster mode outputs a witness size recommendation based on calculated component count, not a hardcoded default.
- [ ] **PDF font rendering:** Open the exported PDF in a PDF viewer (not browser PDF preview) and confirm the project typeface is present and bar charts are visible.
- [ ] **URL length under load:** Generate a URL for a configuration with 3 deployment profiles and 5 workload types; verify URL length is below 1,800 characters.
- [ ] **vSAN Max URL round-trip:** Set storageType to vsan-max, serialize URL, deserialize — confirm storageType is not silently reverted to vsan-esa.
- [ ] **vSAN Max two-cluster inputs:** Confirm compute host count and storage host count are independent inputs, not the same field.
- [ ] **Bandwidth floor:** Confirm minBandwidthGbps is never below 10 for any stretch config; test with minimal workload (100 VMs, 1 GB/VM).
- [ ] **Locale key completeness:** Switch to de-CH and it-CH after adding stretch checklist — confirm no raw i18n key strings are visible.
- [ ] **Architecture mode URL persistence:** Set architectureModel to 'combined', generate URL, restore — confirm architectureModel is 'combined' not the default.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Floating-point errors discovered after launch | HIGH | Identify all affected formula paths; replace with Decimal.js; re-validate all baseline test scenarios; publish a "calculation corrected" note |
| Wrong vSAN overhead constants shipped | MEDIUM | Patch constants as a hotfix; update unit tests; add a "last verified against Broadcom KB [date]" comment to the constants file |
| i18n number formats missing for `de-CH` and `it-CH` | LOW | Add explicit `numberFormats` entries; snapshot tests will catch regressions |
| PDF export blank charts discovered in Firefox | MEDIUM | Migrate to `@media print` approach; test in Playwright headless against Chrome and Firefox before re-release |
| URL state breaks in email due to standard Base64 | LOW | Add Base64URL normalization step; old shared URLs can be migrated with a one-time redirect handler |
| Chart.js reactivity crash (Proxy recursion) | MEDIUM | Convert chart instance storage to `shallowRef`; audit all `reactive()` usages in chart-adjacent code |
| Witness tier always "Tiny" bug | MEDIUM | Implement component count formula; requires stretch cluster module regression testing |
| `vsan-max` storageType not in Zod schema | MEDIUM | Add to schema with default; all existing URLs parse as before (missing field → default vsan-esa); no data loss |
| Locale key missing in 3 languages | LOW | Add keys to missing locale files; key-set equality test prevents recurrence |
| architectureModel ref() added to calculationStore | MEDIUM | Move to inputStore; update Zod schema; update URL hydration block; URL state was never persisted so no backward compat needed |
| Bandwidth floor not applied | LOW | Add `Decimal.max(10, computedBandwidth)` to calcStretch; update test expectations |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Floating-point arithmetic errors | Phase 1 (Core Math Engine) | Unit test: `raidOverhead(5, 1, 'RAID5')` returns exactly `1.5`; no float drift |
| Adaptive RAID-5 threshold miscalculation | Phase 2 (Storage Module) | Snapshot test: 5-node cluster storage total differs from 6-node cluster |
| LFS + metadata overhead omission | Phase 2 (Storage Module) | Integration test vs. vSAN ReadyNode Sizer for known input set |
| VCFA HA multiplier incomplete | Phase 1 (Management Domain) | Test: HA mode total vCPU at or above 3 x (VCFA 24 + NSX 18 + Ops 24 + vCenter 8) |
| NVMe tiering wrong metric | Phase 3 (Compute / NVMe) | Unit test: activeness 60%, DRAM 100 GB, total VM RAM 70 GB results in tiering disabled |
| Swiss locale number formatting | Phase 1 (i18n Foundation) | Cross-locale snapshot test: `1234567.89` in all four locales shows apostrophe separator |
| URL state Base64 encoding | Phase 4 (URL State) | Round-trip test in Firefox headless; test with VM name containing `+`, `/`, `=` |
| Chart.js reactivity crash | Phase 3 (Visualization) | Integration test: rapid input changes do not trigger "Maximum update depth exceeded" |
| PDF export blank or wrong output | Phase 5 (Export) | Playwright PDF test: confirm text layer and canvas elements are non-empty |
| Witness size not calculated | Phase 2 (Stretch Cluster) | Test: 200-VM stretch cluster recommends Medium or Large witness, not Tiny |
| StorageType enum + Zod schema gap | v2.0 vSAN Max (first task) | Round-trip test: `storageType: 'vsan-max'` survives URL serialization |
| vSAN Max two-cluster topology | v2.0 vSAN Max (type design) | Test: storage result does not use compute host count as storage cluster host count |
| Architecture model CALC-02 violation | v2.0 architecture model (store design) | TypeScript: calculationStore exports no ref() — check with static analysis |
| Bandwidth floor regression | v2.0 stretch bandwidth floor (TDD) | Test: minBandwidthGbps >= 10 for any stretch config; existing test updated to assert floor |
| Locale key incompleteness | v2.0 stretch checklist (same commit) | Locale key-set equality test across all 4 locale files; visual check in de-CH |
| URL schema missing new fields | v2.0 any new input field | Zod parse test for old URL (missing field) and new URL; hydration round-trip test |

---

## Sources

- [vSAN ESA Adaptive RAID-5 introduction — Duncan Epping (Yellow Bricks, 2022)](https://www.yellow-bricks.com/2022/11/15/vsan-8-0-esa-introducing-adaptive-raid-5/)
- [vSAN ESA minimum host count with RAID-1/5/6 — Duncan Epping (Yellow Bricks, 2024)](https://www.yellow-bricks.com/2024/01/23/vsan-esa-and-the-minimum-number-of-hosts-with-raid-1-5-6/)
- [Capacity Overheads for the ESA in vSAN 8 — VMware Cloud Foundation Blog (2022)](https://blogs.vmware.com/cloud-foundation/2022/11/02/capacity-overheads-for-the-esa-in-vsan-8/)
- [Global Deduplication in vSAN ESA for VMware Cloud Foundation 9.0 — VMware Cloud Foundation Blog (2025)](https://blogs.vmware.com/cloud-foundation/2025/06/19/global-deduplication-in-vsan-esa-for-vmware-cloud-foundation-9-0/)
- [NVMe Memory Tiering Design and Sizing on VMware Cloud Foundation 9 — VMware Cloud Foundation Blog (2025)](https://blogs.vmware.com/cloud-foundation/2025/11/04/nvme-memory-tiering-design-and-sizing-on-vmware-cloud-foundation-9-part-1/)
- [VCF Operations 9.0 Sizing Guidelines — Broadcom KB 397782](https://knowledge.broadcom.com/external/article/397782/vcf-operations-90-sizing-guidelines.html)
- [Minimal resources for deploying VCF 9.0 in a Lab — William Lam (2025)](https://williamlam.com/2025/06/minimal-resources-for-deploying-vcf-9-0-in-a-lab.html)
- [vSAN Stretched Cluster Bandwidth Sizing — VMware official docs](https://www.vmware.com/docs/vmw-vsan-stretched-cluster-bandwidth-sizing)
- [Strategic Bandwidth Sizing for vSAN Stretched Clusters in VCF 9.0 — Lubomir Tobek (Medium, 2025)](https://medium.com/@lubomir-tobek/strategic-bandwidth-sizing-for-vsan-stretched-clusters-in-vcf-9-0-a-roadmap-to-resilience-ce55545b96a2)
- [vSAN Max ReadyNode Profiles Certified — VMware Cloud Foundation Blog (2023)](https://blogs.vmware.com/cloud-foundation/2023/10/02/readynode-profiles-certified-for-vsan-max/)
- [Driving Down Storage Costs with Lower Hardware Requirements for vSAN — VMware Cloud Foundation Blog (Nov 2025)](https://blogs.vmware.com/cloud-foundation/2025/11/14/driving-down-storage-costs-with-lower-hardware-requirements-for-vsan/)
- [Design and Operational Guidance for vSAN Storage Clusters — VMware official docs](https://www.vmware.com/docs/vmw-vsan-storage-clusters-design-and-operations)
- [VCF 9 Deployment Pathways — VMware Cloud Foundation Blog (2025)](https://blogs.vmware.com/cloud-foundation/2025/07/03/vcf-9-0-deployment-pathways/)
- [Why VCF Management Domain Needs 4 Hosts — Default Reasoning (2025)](https://defaultreasoning.com/2025/01/23/why-management-domain-needs-4-hosts-vcf/)
- [VCF9 management domain minimum number of hosts — Broadcom Community](https://community.broadcom.com/vmware-cloud-foundation/discussion/vcf9-management-domain-minimum-number-of-hosts)
- [Network Traffic Separation in vSAN Storage Clusters for VCF 9.0 — VMware Cloud Foundation Blog (2025)](https://blogs.vmware.com/cloud-foundation/2025/06/19/network-traffic-separation-in-vsan-storage-clusters-for-vcf-9-0/)
- [Stretched Topologies using vSAN Storage Clusters in VCF 9.0 — VMware Cloud Foundation Blog (2025)](https://blogs.vmware.com/cloud-foundation/2025/06/19/stretched-topologies-using-vsan-storage-clusters-in-vcf-9-0/)
- [vue-i18n Number Formatting — official docs](https://vue-i18n.intlify.dev/guide/essentials/number)
- [vue-i18n Fallback Localization — official docs](https://vue-i18n.intlify.dev/guide/essentials/fallback)
- [vue-i18n issue #2053: Use different locale for number and date formatting](https://github.com/intlify/vue-i18n/issues/2053)
- [Wrong number format for Switzerland CH — Intl.js issue #269](https://github.com/andyearnshaw/Intl.js/issues/269)
- [Chart.js issue #11619: update() fails with recursion error in Vue 3](https://github.com/chartjs/Chart.js/issues/11619)
- [7 Vue 3 Performance Pitfalls — Simform Engineering (Medium, 2024)](https://medium.com/simform-engineering/7-vue-3-performance-pitfalls-that-quietly-derail-your-app-33c7180d68d4)
- [Base64URL standard — base64.guru](https://base64.guru/standards/base64url)
- [Decimal.js vs BigNumber.js — DEV Community comparison](https://dev.to/fvictorio/a-comparison-of-bignumber-libraries-in-javascript-2gc5)
- [html2canvas + jsPDF pitfalls — DEV Community](https://dev.to/jringeisen/using-jspdf-html2canvas-and-vue-to-generate-pdfs-1f8l)
- [RAID-5 objects not immediately converted from 2+1 to 4+1 after node count change — Broadcom KB 405876](https://knowledge.broadcom.com/external/article/405876/raid5-objects-not-immediately-converted.html)

---
*Pitfalls research for: VCF 9.x Sizing Calculator SPA*
*Originally researched: 2026-03-28*
*Updated for v2.0 milestone: 2026-03-29*
