# Phase 20: Storage Units Correction - Research

**Researched:** 2026-04-10
**Domain:** TypeScript rename/refactor — engine types, store, URL schema, UI, i18n, export composables
**Confidence:** HIGH

## Summary

This phase is a well-scoped rename+refactor across the entire application stack. The word "TB" appears in type field names, function signatures, engine constants, default values, URL schema field names, i18n keys, Vue component templates, and export composable strings. Every occurrence was located by source-reading and grep audit.

The key structural decision documented in STATE.md is that this is **not a label-only change**: the intent is to commit to TiB (binary 2^40 bytes) as the stored unit going forward. However, the calculation arithmetic itself does not need conversion constants because:

1. For vSAN ESA: the value the user enters is treated as the raw per-host disk capacity. Whether that number is labelled "TB" or "TiB" is a presentation concern — the RAID/LFS/metadata overhead math is dimensionless multipliers applied to whatever unit the input carries. Renaming the field `hostStorageTiB` and labelling the slider "TiB" **is sufficient** to make the system semantically correct. No conversion factor (e.g., multiplying by 1.0995) is needed because existing users were never told they were entering TB vs TiB — the distinction was never surfaced.

2. For FC/NFS: the new field `externalStorageUsableTiB` replaces the per-host raw storage concept with a total usable pool. The calcStorage FC/NFS path is currently a pass-through: `rawCapacityTB = hostCount * hostStorageTB`. With the new model, the pool value is provided directly, so the engine FC/NFS path must accept a pool total rather than computing hostCount × perHost.

3. For URL backward compatibility: the Zod schema uses `.strip()`. Old URLs with `hostStorageTB` key will have that key stripped and the field will fall back to the Zod default (3.84 TiB). This is intentional graceful degradation.

4. vSAN Max profile labels (e.g., "XS — 20 TB/node") reference Broadcom's published ReadyNode capacity ratings. Those are marketing specs in decimal TB. The decision from STATE.md is that STOR-01 applies globally — these labels should also be updated to TiB for consistency within the application.

**Primary recommendation:** Execute as a single atomic commit. All field renames, i18n key updates, and engine signature changes must land together — no intermediate state where `hostStorageTB` and `hostStorageTiB` coexist.

## Project Constraints (from CLAUDE.md)

- Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library (CALC-01)
- `calculationStore.ts` must never contain `ref()` — only `computed()` (CALC-02)
- Validation warnings must use i18n message keys, never raw English strings
- `VueI18nPlugin` configured with `include` omitted intentionally — do not change
- `@/` maps to `src/` throughout
- Run `npm run test` to validate; run `npm run type-check` before build

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STOR-01 | All storage inputs and outputs use TiB (binary, 2^40 bytes) throughout UI and exports, replacing TB (decimal) | All 47 TB occurrences located and catalogued below |
| STOR-02 | For vSAN ESA workload domains, "Raw Storage per Host" input is in TiB | Field is `hostStorageTB` in `WorkloadDomainConfig` + `StorageInputs` + Zod schema; rename to `hostStorageTiB`, update slider label via i18n key `host.storageTB` |
| STOR-03 | For FC/NFS workload domains, "Total Usable Storage Pool (TiB)" input replaces per-host raw storage field | New field `externalStorageUsableTiB` on `WorkloadDomainConfig`; FC/NFS engine path changes from `hostCount × hostStorageTB` to direct pool passthrough |
| STOR-04 | Engine storage calculations use TiB; URL state schema updated (hostStorageTiB, externalStorageUsableTiB) | Zod schema in `useUrlState.ts` must add `hostStorageTiB` + `externalStorageUsableTiB`, drop `hostStorageTB`; `.strip()` handles old URL degradation |
</phase_requirements>

## Standard Stack

No new libraries are needed for this phase. All changes are renames within the existing stack.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | existing | URL state schema validation | Already installed; `.strip()` handles backward compat |
| decimal.js | existing | Arithmetic in engine | Already installed; rename does not affect arithmetic |

**Installation:** none required

## Architecture Patterns

### Pattern 1: Field Rename Across Type Hierarchy

The rename `hostStorageTB → hostStorageTiB` must propagate through the type hierarchy in strict order to prevent TypeScript errors:

1. `src/engine/types.ts` — update all four interfaces that carry the field
2. `src/engine/defaults.ts` — update property names in factory functions
3. `src/engine/storage.ts` — update `StorageInputs` destructure and arithmetic variable name
4. `src/engine/stretch.ts` — `StretchInputs.hostStorageTB` is defined but **not used** by `calcStretch()` (the function destructures only `preferredSiteHosts`, `secondarySiteHosts`, `vmCount`, `avgStorageGbPerVm`). The field still must be renamed for type consistency, but no arithmetic changes.
5. `src/stores/calculationStore.ts` — update the two `hostStorageTB:` property accesses in `calcStorage()` and `calcStretch()` call sites
6. `src/composables/useUrlState.ts` — rename in `WorkloadDomainSchema` and `ManagementDomainSchema`
7. All Vue components — rename computed refs that read the field
8. All export composables — rename template string references
9. All i18n locale files — rename i18n key `host.storageTB` and update label text

### Pattern 2: FC/NFS Pool Field Addition

Adding `externalStorageUsableTiB` requires:

1. Add field to `WorkloadDomainConfig` in `types.ts`
2. Add default value in `defaults.ts` (e.g., 100.0 TiB)
3. Add to `WorkloadDomainSchema` in `useUrlState.ts`
4. Modify `calcStorage()` FC/NFS branch to accept the pool value
5. Update `calculationStore.ts` `calcStorage()` call to pass pool value for FC/NFS
6. Update `StorageConfigForm.vue` to show pool input slider for FC/NFS
7. Update `useMarkdownExport.ts` and `usePptxExport.ts` to use pool field

### Pattern 3: i18n Key Rename

The key `host.storageTB` must be renamed to `host.storageTiB` in all 4 locale files (en, fr-CH, de-CH, it-CH). The component `HostSpecsForm.vue` references `t('host.storageTB')` — update to `t('host.storageTiB')`. Swiss locales inherit nothing from parent — all 4 files are independent.

### Pattern 4: URL Schema Backward Compatibility

The `.strip()` behavior on Zod schema means:

- Old URLs with `hostStorageTB: 3.84` will parse → `hostStorageTB` stripped → `hostStorageTiB` defaults to 3.84 TiB
- Old URLs with `hostStorageTB: X` where X is a user-entered decimal TB value will silently reset to the default. This is acceptable per STATE.md (graceful degradation, not lossless migration).

### Anti-Patterns to Avoid

- **Conversion arithmetic**: Do NOT add a 1.0995 factor (TB→TiB conversion). The phase is a unit label commit, not a value rescaling. Existing users who entered "3.84 TB" will now see "3.84 TiB" — acceptable.
- **Partial rename**: Never leave `hostStorageTB` in any production path after the commit. TypeScript will catch most cases, but template strings in export composables require manual audit.
- **Nested default in Zod without factory**: For nested Zod schemas, `.default({})` bypasses inner field defaults (existing pitfall already documented). Use `.default(() => SchemaName.parse({}))` pattern already established.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL backward compat | Custom migration logic | Zod `.strip()` already handles unknown keys | Established pattern; adding `hostStorageTiB` as new key with default makes old URLs degrade to default |
| Type safety for rename | Text search | TypeScript compiler | After rename in `types.ts`, tsc errors guide remaining changes |
| Test coverage | Manual smoke test | Vitest unit tests | Arithmetic is dimensionless; tests verify the renamed API contract |

## Runtime State Inventory

This is a rename/refactor phase — the runtime state audit is required.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | No databases or key-value stores persist `hostStorageTB` as a key. The only persistent state is URL query params (`?c=`). | Backward compat handled by Zod `.strip()` + defaults — no data migration |
| Live service config | None — client-only SPA, no server-side config, no n8n, no external services | None |
| OS-registered state | None — no scheduled tasks, no pm2, no systemd units | None |
| Secrets/env vars | None — no env vars reference storage field names | None |
| Build artifacts | `dist/` output will be stale after rename but is rebuilt on `npm run build` | `npm run build` as part of phase gate |

**Nothing found in Stored data beyond URL params:** Confirmed — no DB, no localStorage, no Mem0. The only "stored" state is the compressed URL param which degrades gracefully.

## Complete TB Occurrence Inventory

### Engine Layer (`src/engine/`)

| File | Occurrences | Type | Action |
|------|-------------|------|--------|
| `types.ts:56` | `StretchInputs.hostStorageTB` | Type field | Rename to `hostStorageTiB` |
| `types.ts:95` | `StorageInputs.hostStorageTB` | Type field | Rename to `hostStorageTiB` |
| `types.ts:152` | `WorkloadDomainConfig.hostStorageTB` | Type field | Rename to `hostStorageTiB` |
| `types.ts:181` | `ManagementDomainConfig.hostStorageTB` | Type field | Rename to `hostStorageTiB` |
| `types.ts:73-74` | `StretchResult.effectivePerSiteStorageTB`, `minBandwidthGbps` comment mentioning TB | Result field names + comment | Rename result fields to `...TiB`; update comment |
| `types.ts:103-114` | `StorageResult.*TB` fields (9 fields) | Result fields | Rename all `*TB` → `*TiB` in `StorageResult` |
| `types.ts:200-201` | `AggregateTotals.totalRawStorageTB`, `.totalEffectiveStorageTB` | Result fields | Rename to `*TiB` |
| `defaults.ts:13` | `hostStorageTB: 3.84` | Default value | Rename key to `hostStorageTiB` |
| `defaults.ts:44` | `hostStorageTB: 3.84` | Default value | Rename key to `hostStorageTiB` |
| `storage.ts:89` | `hostStorageTB,` (destructure) | Variable | Rename to `hostStorageTiB` |
| `storage.ts:97` | `rawCapacityTB = new Decimal(hostCount).times(hostStorageTB)` | Arithmetic + variable names | Rename variable, rename result fields in returned object |
| `vsanMax.ts:9-14` | `rawTbPerNode` property + label strings "20 TB/node" etc. | Constant key + string labels | Rename property + update label strings to "TiB/node" |
| `vsanMax.ts:35-36` | `.times(profileData.rawTbPerNode)` | Arithmetic call | Rename after property rename |

**Note on `StretchInputs.hostStorageTB`:** This field exists in the type and is passed by `calculationStore.ts` but is **not destructured or used** inside `calcStretch()`. The function body ignores it. It should still be renamed for type hygiene, but no arithmetic change is needed.

### Store Layer (`src/stores/`)

| File | Occurrences | Action |
|------|-------------|--------|
| `calculationStore.ts:82` | `hostStorageTB: domain.hostStorageTB` (calcStorage call) | Rename to `hostStorageTiB` |
| `calculationStore.ts:93` | `hostStorageTB: domain.hostStorageTB` (calcStretch call) | Rename to `hostStorageTiB` |
| `calculationStore.ts:134-135` | `totalRawStorageTB`, `totalEffectiveStorageTB` (reduce) | Rename result field references |

### URL State Composable (`src/composables/useUrlState.ts`)

| Line | Content | Action |
|------|---------|--------|
| 21 | `hostStorageTB: z.number().positive().default(3.84)` in WorkloadDomainSchema | Rename key to `hostStorageTiB`; add `externalStorageUsableTiB: z.number().positive().default(100)` |
| 52 | `hostStorageTB: z.number().positive().default(3.84)` in ManagementDomainSchema | Rename key to `hostStorageTiB` |

### Components (`src/components/`)

| File | Occurrences | Action |
|------|-------------|--------|
| `input/HostSpecsForm.vue:35` | `const hostStorageTB = domainField('hostStorageTB')` | Rename local const + key |
| `input/HostSpecsForm.vue:92` | `v-model="hostStorageTB"` | Rename to `hostStorageTiB` |
| `input/HostSpecsForm.vue:94` | `unit="TB"` | Change to `unit="TiB"` |
| `input/HostSpecsForm.vue:93` | `:label="t('host.storageTB')"` | Change to `t('host.storageTiB')` |
| `input/ManagementDomainSection.vue:23` | `const hostStorageTB = mgmtField('hostStorageTB')` | Rename |
| `input/ManagementDomainSection.vue:138` | `v-model="hostStorageTB"` | Rename |
| `input/ManagementDomainSection.vue:140` | `unit="TB"` | Change to `unit="TiB"` |
| `input/ManagementDomainSection.vue:139` | `:label="t('host.storageTB')"` | Change to `t('host.storageTiB')` |
| `input/StorageConfigForm.vue:170-174` | vSAN Max profile options: "XS — 20 TB/node" etc. | Update labels to TiB |
| `input/StorageConfigForm.vue:198` | `{{ ... }} TB` (raw capacity display) | Change to TiB |
| `input/StorageConfigForm.vue:205` | `{{ ... }} TB` (safe usable display) | Change to TiB |
| `input/StorageConfigForm.vue:213` | `{{ ... }} TB` (vSAN Max usable display) | Change to TiB |
| `input/StorageConfigForm.vue:219` | `{{ ... }} TB` (FC/NFS passthrough display) | Change to TiB |
| `results/DomainResultCard.vue:66` | `{{ result.storage.safeUsableCapacityTB.toFixed(2) }} TB` | Change field + label |
| `results/AggregateTotalsCard.vue:50` | `{{ totals.totalRawStorageTB.toFixed(2) }} TB` | Change field + label |
| `results/AggregateTotalsCard.vue:53` | `{{ totals.totalEffectiveStorageTB.toFixed(2) }} TB` | Change field + label |
| `results/VsanMaxClusterCard.vue:37` | `{{ props.result.vsanMax.rawCapacityTB.toFixed(2) }} TB` | Change field + label |
| `results/VsanMaxClusterCard.vue:41` | `{{ vsanMax.usableCapacityTB.toFixed(2) }} TB` | Change field + label |
| `results/charts/StorageChart.vue:98` | `<th ...>TB</th>` (print fallback table header) | Change to TiB |

**FC/NFS storage input (STOR-03):** `StorageConfigForm.vue` currently has no input slider for FC/NFS storage — the per-host raw storage slider lives in `HostSpecsForm.vue` and is always visible. For FC/NFS domains, a new `NumberSliderInput` must be added to `StorageConfigForm.vue` inside the FC/NFS branch (no vSAN ESA template block exists for FC/NFS today — only for vSAN ESA and vSAN Max). The slider should bind to `externalStorageUsableTiB` on the domain. The `HostSpecsForm.vue` `hostStorageTiB` slider should be **hidden** (or removed) when `storageType === 'fc' || 'nfs'` since that field becomes irrelevant.

### Export Composables

| File | Lines | Action |
|------|-------|--------|
| `useMarkdownExport.ts:72` | `domain.hostStorageTB} TB` | Change to `hostStorageTiB} TiB` |
| `useMarkdownExport.ts:117-121` | 5 lines with `...TB.toFixed(2)} TB` | Rename fields + change "TB" to "TiB" |
| `useMarkdownExport.ts:177` | `effectivePerSiteStorageTB.toFixed(2)} TB` | Rename field + change "TB" |
| `useMarkdownExport.ts:204-205` | vSAN Max raw/usable capacity TB | Rename fields + change "TB" |
| `useMarkdownExport.ts:221-222` | `totalRawStorageTB`, `totalEffectiveStorageTB` | Rename fields + change "TB" |
| `usePptxExport.ts:88` | `domain.hostStorageTB} TB` | Change to `hostStorageTiB} TiB` |
| `usePptxExport.ts:195-196` | `totalRawStorageTB`, `totalEffectiveStorageTB` + "TB" | Rename + change |
| `usePptxExport.ts:243` | `effectivePerSiteStorageTB.toFixed(2)} TB` | Rename + change |
| `usePptxExport.ts:270-271` | vSAN Max capacity TB | Rename + change |
| `usePptxExport.ts:469-475` | Storage table cells with "TB" labels | Change "TB" → "TiB" |

### i18n Files

| File | Key Path | Current Value | Required Change |
|------|----------|---------------|-----------------|
| `en.json:52` | `host.storageTB` | "Raw Storage per Host (TB)" | Rename key to `host.storageTiB`; value → "Raw Storage per Host (TiB)" |
| `en.json:137` | `results.charts.storage` | "Storage (TB)" | Change to "Storage (TiB)" |
| `fr.json:52` | `host.storageTB` | "Stockage brut par hôte (To)" | Rename key; value → "Stockage brut par hôte (Tio)" |
| `fr.json:137` | `results.charts.storage` | "Stockage (To)" | Change to "Stockage (Tio)" |
| `de.json:52` | `host.storageTB` | "Rohspeicher pro Host (TB)" | Rename key; value → "Rohspeicher pro Host (TiB)" |
| `de.json:137` | `results.charts.storage` | "Speicher (TB)" | Change to "Speicher (TiB)" |
| `it.json:52` | `host.storageTB` | "Storage grezzo per host (TB)" | Rename key; value → "Storage grezzo per host (TiB)" |
| `it.json:137` | `results.charts.storage` | "Archiviazione (TB)" | Change to "Archiviazione (TiB)" |

**Note on French locale:** French computing standards use "Tio" for TiB (tebibyte). The existing fr locale already uses "To" (téraoctet) for TB. The correct French binary unit is "Tio" (tébioctet). This should be updated accordingly.

**New i18n key needed (STOR-03):** A new key is required for the FC/NFS pool label:

- `en`: `host.externalStorageTiB: "Total Usable Storage Pool (TiB)"`
- `fr`: `host.externalStorageTiB: "Pool de stockage utilisable total (Tio)"`
- `de`: `host.externalStorageTiB: "Gesamter nutzbarer Speicherpool (TiB)"`
- `it`: `host.externalStorageTiB: "Pool di storage utilizzabile totale (TiB)"`

### Test Files (must be updated alongside source)

| File | Occurrences | Action |
|------|-------------|--------|
| `engine/storage.test.ts` (14 lines) | `hostStorageTB: X` in every test fixture | Rename to `hostStorageTiB` |
| `engine/stretch.test.ts` (10 lines) | `hostStorageTB: 3.84` in every fixture | Rename to `hostStorageTiB` |
| `engine/defaults.test.ts:30,62` | `expect(d.hostStorageTB).toBe(3.84)` | Rename to `hostStorageTiB` |
| `stores/calculationStore.test.ts:95-102` | `totalRawStorageTB`, `totalEffectiveStorageTB` | Rename to `*TiB` |
| `stores/inputStore.test.ts:21` | `expect(store.managementDomain.hostStorageTB).toBe(3.84)` | Rename |
| `composables/useUrlState.test.ts` (7 lines) | `hostStorageTB` in schema replicas and payloads | Rename; add `externalStorageUsableTiB` assertions |
| `composables/usePptxExport.test.ts:312-313` | `expect(rawRow!.value).toContain('TB')` | Change to `'TiB'` |

## Common Pitfalls

### Pitfall 1: Storage Result Field Names Not Renamed

**What goes wrong:** `StorageResult` interface uses `rawCapacityTB`, `usableAfterRaidTB`, `lfsOverheadTB`, `metadataOverheadTB`, `usableBeforeDedupTB`, `effectiveCapacityTB`, `safeUsableCapacityTB`. If only the input field is renamed and not the output result fields, components still show "TB" from variable names.
**Why it happens:** The result fields are returned by `calcStorage()` and used directly in components and exports. They are not renamed by renaming the input type.
**How to avoid:** Include all `StorageResult` fields in the rename sweep. TypeScript will flag usages after the interface update.
**Warning signs:** tsc errors on `.rawCapacityTB` access in components.

### Pitfall 2: StretchInputs.hostStorageTB is Dead Code

**What goes wrong:** Believing the `hostStorageTB` field in `StretchInputs` affects stretch calculations and writing conversion logic.
**Why it happens:** The field exists in `StretchInputs` and `calcStretch()` is called with it, but the function body only destructures 4 other fields. The host storage value plays no role in bandwidth or site storage calculations (those use `vmCount × avgStorageGbPerVm`).
**How to avoid:** Only rename the field — do not add conversion logic.
**Warning signs:** Adding a `hostStorageTiB × someConversionFactor` line to `calcStretch()`.

### Pitfall 3: FC/NFS Engine Path Still Multiplies per-host

**What goes wrong:** After adding `externalStorageUsableTiB`, the FC/NFS branch in `calcStorage()` still computes `hostCount × hostStorageTiB` instead of using the pool value.
**Why it happens:** The new field is added to the type but `calcStorage()` is not updated to use it.
**How to avoid:** The `StorageInputs` interface must receive the new field. The FC/NFS branch returns `externalStorageUsableTiB` directly for all TB-labelled result fields.
**Warning signs:** FC/NFS result still changes when hostCount slider moves.

### Pitfall 4: Zod Schema Replica in useUrlState.test.ts

**What goes wrong:** The test file contains its own replica of the schema and must be updated independently from `useUrlState.ts`. If only the source is updated, the tests fail with mismatched field names.
**Why it happens:** The test schema was created as an independent replica to avoid Pinia bootstrap in test context.
**How to avoid:** Update `useUrlState.test.ts` schemas alongside `useUrlState.ts`.
**Warning signs:** `hostStorageTB is not a valid field` type errors in test file.

### Pitfall 5: vSAN Max rawTbPerNode Values

**What goes wrong:** The ReadyNode capacity values (20, 50, 100, 150, 200) are Broadcom marketing specs measured in decimal TB. Renaming the property to `rawTibPerNode` while keeping the same numeric values would be semantically incorrect (20 TiB ≠ 20 TB).
**Why it happens:** The property name is renamed but the values are not converted.
**How to avoid:** Two valid approaches: (a) keep values as-is and rename property to `rawTibPerNode` acknowledging ~9% accuracy loss in the label, OR (b) convert values to TiB equivalents (20 TB ÷ 1.0995 ≈ 18.19 TiB). This is a decision point — document in plan for user confirmation via the discuss phase. Current STATE.md says "true binary units" but does not specify vSAN Max profile conversion explicitly.
**Warning signs:** vSAN Max capacity results changing unexpectedly after rename.

### Pitfall 6: StorageChart.vue print table header "TB" is hardcoded

**What goes wrong:** `StorageChart.vue:98` has `<th ...>TB</th>` as a hardcoded string (not an i18n key). It will not be caught by an i18n key search.
**Why it happens:** Print fallback tables sometimes get static strings rather than i18n keys.
**How to avoid:** Audit component templates for literal "TB" strings, not just i18n key references.

## Code Examples

### FC/NFS Pool Engine Change (StorageInputs)

```typescript
// Source: [VERIFIED: src/engine/types.ts — read in this session]
// Before:
export interface StorageInputs {
  storageType: StorageType
  hostCount: number
  hostStorageTB: number   // ← renamed from this
  // ...
}

// After:
export interface StorageInputs {
  storageType: StorageType
  hostCount: number
  hostStorageTiB: number  // ← vSAN ESA: raw storage per host in TiB
  externalStorageUsableTiB?: number  // ← FC/NFS: total usable pool in TiB (optional; only used when storageType is fc/nfs)
  // ...
}
```

### FC/NFS Engine Path Change

```typescript
// Source: [VERIFIED: src/engine/storage.ts — read in this session]
// Before: FC/NFS computes rawCapacity from hostCount × perHostStorage
case 'fc':
case 'nfs':
  // rawCapacityTB = hostCount × hostStorageTB (WRONG — mixes FC pool with ESA per-host concept)

// After:
case 'fc':
case 'nfs':
  // For FC/NFS, user provides total usable pool directly
  const poolTiB = externalStorageUsableTiB ?? 0
  return {
    rawCapacityTiB: poolTiB,
    // ... all TB-labelled fields renamed to TiB ...
    safeUsableCapacityTiB: poolTiB,  // pass-through
    raidScheme: 'Pass-through',
    minHostsRequired: 0,
  }
```

### Zod Schema Field Rename

```typescript
// Source: [VERIFIED: src/composables/useUrlState.ts — read in this session]
// WorkloadDomainSchema — rename and add:
hostStorageTiB: z.number().positive().default(3.84),  // was hostStorageTB
externalStorageUsableTiB: z.number().positive().default(100),  // new — FC/NFS pool
```

### i18n Key Rename

```typescript
// Source: [VERIFIED: src/i18n/locales/en.json — read in this session]
// en.json "host" section:
// Before: "storageTB": "Raw Storage per Host (TB)"
// After:  "storageTiB": "Raw Storage per Host (TiB)"
// New:    "externalStorageTiB": "Total Usable Storage Pool (TiB)"

// Component reference update (HostSpecsForm.vue):
// Before: t('host.storageTB')
// After:  t('host.storageTiB')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "TB" everywhere (decimal 10^12) | "TiB" everywhere (binary 2^40) | Phase 20 | ~9.95% label accuracy improvement; no arithmetic change |
| Per-host raw storage for FC/NFS | Total usable pool for FC/NFS | Phase 20 | FC/NFS sizing now accepts pool size directly, matches how FC/NFS storage is actually procured |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | vSAN Max rawTbPerNode values (20, 50, 100, 150, 200) are Broadcom marketing TB specs and will be kept as-is (the property is renamed to TiB but values remain decimal TB equivalents) | Don't Hand-Roll / Pitfall 5 | If user wants true TiB values, all vSAN Max capacity results would need ÷1.0995 conversion; capacity results would drop ~10% |
| A2 | `StretchInputs.hostStorageTB` is intentionally dead code (field defined but never used in `calcStretch()` body) | Complete TB Inventory | If stretch bandwidth calculation should use per-host storage, the rename alone is insufficient |
| A3 | The default value for `externalStorageUsableTiB` should be 100 TiB | FC/NFS Engine Pattern | Wrong default causes confusing initial state for FC/NFS domains |
| A4 | The `ManagementDomainConfig.hostStorageTB` should also be renamed (management domain uses vSAN ESA by default and has per-host storage) | Complete TB Inventory | Low risk — management domain only uses vSAN-ESA which is per-host; rename is correct |

## Open Questions

1. **vSAN Max profile conversion: rename only or also rescale values?**
   - What we know: ReadyNode profiles are published by Broadcom in decimal TB (marketing specs)
   - What's unclear: Should the engine convert 20 TB → 18.19 TiB internally, or simply rename the label?
   - Recommendation: Rename only (keep 20/50/100/150/200 as the stored values). The 9% difference is within noise for sizing purposes. Document as [ASSUMED].

2. **FC/NFS default pool size**
   - What we know: The current default for per-host storage is 3.84 (a typical NVMe drive size)
   - What's unclear: A reasonable default for a total usable FC/NFS pool (100 TiB? 50 TiB?)
   - Recommendation: 100 TiB is a reasonable starting point for an enterprise SAN/NFS array. Confirm with user.

3. **HostSpecsForm.vue visibility of hostStorageTiB slider when storageType is FC/NFS**
   - What we know: Currently the per-host storage slider is always shown regardless of storage type
   - What's unclear: Should the slider be hidden or disabled for FC/NFS domains (since the field becomes irrelevant)?
   - Recommendation: Hide (conditional render) the `hostStorageTiB` slider when `storageType === 'fc' || storageType === 'nfs'` in `HostSpecsForm.vue`. Show the `externalStorageUsableTiB` slider in `StorageConfigForm.vue` for those types instead.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all changes are code/config only)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (node environment) |
| Config file | `vitest.config.ts` (inferred from package.json) |
| Quick run command | `npx vitest run src/engine/storage.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOR-01 | All storage values labeled TiB in exports | unit | `npx vitest run src/composables/usePptxExport.test.ts` | Yes |
| STOR-02 | vSAN ESA per-host input uses TiB field name | unit | `npx vitest run src/engine/storage.test.ts` | Yes |
| STOR-03 | FC/NFS pool input accepted by engine | unit | `npx vitest run src/engine/storage.test.ts` | Yes — new tests needed |
| STOR-04 | URL round-trip with new field names | unit | `npx vitest run src/composables/useUrlState.test.ts` | Yes |

### Sampling Rate

- **Per task commit:** `npx vitest run src/engine/storage.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** `npm run type-check && npm run test` — both must be green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] New test cases for `calcStorage()` FC/NFS path with `externalStorageUsableTiB` — covers STOR-03
- [ ] New test case for `WorkloadDomainSchema.parse({})` returning `hostStorageTiB` and `externalStorageUsableTiB` defaults — covers STOR-04
- [ ] Update existing `useUrlState.test.ts` schema replicas to match renamed fields

*(All other test infrastructure exists — no new framework install needed)*

## Security Domain

> `security_enforcement` not set to false in config.json → section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Zod schema validation already in place; rename does not weaken it |
| V6 Cryptography | no | — |

### Known Threat Patterns for rename/refactor

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL injection via `externalStorageUsableTiB` field | Tampering | Zod `.number().positive()` validation already mitigates; no additional risk introduced |
| XSS from domain names in exports | Spoofing | DOMPurify already in place (Phase 18 PITFALL-9); storage values are numbers, not user strings |

## Sources

### Primary (HIGH confidence)

- `src/engine/types.ts` — all type interfaces read directly
- `src/engine/storage.ts` — complete function read
- `src/engine/storage.test.ts` — all test fixtures read
- `src/engine/stretch.ts` — confirmed `hostStorageTB` is not used in function body
- `src/engine/vsanMax.ts` — `rawTbPerNode` property confirmed
- `src/engine/defaults.ts` — default values confirmed
- `src/stores/calculationStore.ts` — all `hostStorageTB` call sites confirmed
- `src/composables/useUrlState.ts` — Zod schema field names confirmed
- `src/composables/useMarkdownExport.ts` — all TB string literals confirmed
- `src/composables/usePptxExport.ts` — all TB string literals confirmed
- `src/components/input/HostSpecsForm.vue` — slider label + unit confirmed
- `src/components/input/ManagementDomainSection.vue` — storage slider confirmed
- `src/components/input/StorageConfigForm.vue` — inline TB display confirmed
- `src/components/results/DomainResultCard.vue` — TB display confirmed
- `src/components/results/AggregateTotalsCard.vue` — TB display confirmed
- `src/components/results/VsanMaxClusterCard.vue` — TB display confirmed
- `src/components/results/charts/StorageChart.vue` — hardcoded "TB" header confirmed
- `src/i18n/locales/en.json`, `fr.json`, `de.json`, `it.json` — all TB-containing keys found
- `.planning/REQUIREMENTS.md`, `STATE.md`, `ROADMAP.md` — requirements and decisions confirmed

### Secondary (MEDIUM confidence)

- Grep audit across all source files for "TB" and "hostStorageTB" patterns

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new libraries; all existing
- Architecture: HIGH — all files read directly; rename scope fully enumerated
- Pitfalls: HIGH — derived from direct code reading, not assumptions

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable codebase; no external dependencies)
