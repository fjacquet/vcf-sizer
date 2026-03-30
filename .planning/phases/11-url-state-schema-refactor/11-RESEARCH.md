# Phase 11: URL State Schema Refactor - Research

**Researched:** 2026-03-30
**Domain:** Zod v4 schema design, lz-string URL compression, Pinia store hydration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase. Constraints come from STATE.md locked decisions.

### Locked Decisions (from STATE.md v3.0 decisions)
- v2.x URL backward compatibility — silent reset to default state; document in release notes; no migration code
- Zod v4 — use factory `.default(() => [createDefaultWorkloadDomain(0)])` for array field, NOT `.default([])`
- activeTabIndex is ephemeral UI state — never serialized to URL; hydration always activates first tab
- Zod URL schema updated atomically with every new inputStore field; URL_STATE_FIELDS constant shared by generateShareUrl and hydrateFromUrl (from v2.0 decisions)

### Claude's Discretion
- Schema organization: whether WorkloadDomainSchema and ManagementDomainSchema are defined inline in useUrlState.ts or imported from a shared location
- Exact error handling / logging verbosity in hydrateFromUrl for partial v2.x schema parse outcomes
- Whether to export schema types or keep them internal to the composable

### Deferred Ideas (OUT OF SCOPE)
- Auto-migration of v2.x flat-schema URLs to single-domain array format (deferred to v3.1+)
- Domain count UI validation beyond what the engine already enforces
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| URL-01 | `useUrlState.ts` Zod schema restructured to `{ managementDomain: ManagementDomainSchema, workloadDomains: z.array(WorkloadDomainSchema).min(1) }` with `.strip()` on all sub-schemas | Empirically verified: nested schemas work; factory defaults required for sub-schemas |
| URL-02 | Old flat-schema shared URLs (v2.x format) are not migrated — they fall back to default state on load | Empirically verified: v2.x flat payload parsed by new schema silently produces 1-domain default workloadDomains; managementArchitecture top-level field still preserved |
| URL-03 | Full multi-domain configuration (N workload domains) serializes to and deserializes from a lz-string compressed URL parameter round-trip losslessly | Empirically verified: 3-domain lossless round-trip confirmed including non-default field values, domain names, and distinct per-domain configs |
| URL-04 | The active tab index is NOT serialized to URL state; on hydration, the first domain tab is always active | Empirically verified: `.strip()` removes activeTabIndex from the serialized payload automatically; hydrateFromUrl never reads activeDomainIndex |
</phase_requirements>

---

## Summary

Phase 11 replaces the flat Zod schema in `useUrlState.ts` with a nested multi-domain schema that matches the refactored `inputStore` from Phase 10. The current `InputStateSchema` contains 20 flat scalar fields matching the v2.x store structure. The new schema wraps a `ManagementDomainSchema` (4 fields) and `z.array(WorkloadDomainSchema).min(1)` (26 fields per domain) under a top-level object, plus the single remaining global field `managementArchitecture`.

All technical patterns were empirically verified against the installed Zod 4.3.6 and lz-string 1.5.0. The core findings are: (1) factory defaults are required for nested schemas — `.default({})` bypasses inner field defaults; (2) a 5-domain URL compresses to 1,789 chars, well under the 2,048 limit; (3) v2.x flat-schema URLs parse successfully against the new schema because `.strip()` discards unknown flat keys and the `workloadDomains` default factory provides one default domain; (4) `hydrateFromUrl` assignment must change from 20 flat property assignments to two structured assignments (`store.workloadDomains` and `store.managementDomain`).

**Primary recommendation:** Replace `InputStateSchema` wholesale — define `WorkloadDomainSchema` and `ManagementDomainSchema` as named constants above the main schema, use factory defaults for both nested fields, and update `hydrateFromUrl` + `generateShareUrl` to work with the new shape. Also update `useUrlState.test.ts` in parallel since the test replicates the schema directly.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.3.6 (installed: 4.3.6) | Schema definition, validation, safe parse | Already project standard; all existing URL state uses it |
| lz-string | ^1.5.0 (installed: 1.5.0) | URL-safe lossless compression of JSON | Already project standard; default import pattern established |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (project standard) | Test runner for schema validation tests | All schema round-trip tests |

**No new dependencies required for this phase.**

---

## Architecture Patterns

### File to modify
```
src/composables/useUrlState.ts     # Schema replacement + hydration/serialization update
src/composables/useUrlState.test.ts # Schema test update (schema is replicated in test file)
```

### Pattern 1: Sub-Schema with Factory Default

**What:** Nested Zod schemas require factory defaults (callable `.default(() => ...)`) when used inside a parent schema. Static `.default({})` provides the raw object directly, bypassing inner field defaults.

**When to use:** Every nested `.object()` schema used as a sub-field with `.default(...)` in a parent schema.

**Verified behavior (Zod 4.3.6):**

```typescript
// WRONG — bypasses inner field defaults, produces undefined for coresPerSocket
const Outer = z.object({
  managementDomain: ManagementDomainSchema.default({})
})
// outer.parse({}).managementDomain.coresPerSocket === undefined ← BUG

// CORRECT — factory calls parse(), applies inner defaults
const Outer = z.object({
  managementDomain: ManagementDomainSchema.default(() => ManagementDomainSchema.parse({}))
})
// outer.parse({}).managementDomain.coresPerSocket === 16 ← CORRECT
```

### Pattern 2: Array Schema with Factory Default

**What:** `z.array(Schema).min(1).default(() => [...])` — factory returns pre-built default array. Never use `.default([])` (cited Zod v4 issues #5525, #4544; also confirmed by STATE.md locked decision).

**Verified behavior:**
```typescript
// CORRECT
workloadDomains: z.array(WorkloadDomainSchema).min(1).default(() => [
  createDefaultWorkloadDomain(0)
])
// parse({}).workloadDomains has 1 domain with all defaults ← CORRECT

// ALSO: .min(1) rejects empty arrays [] at parse time
// parse({ workloadDomains: [] }).success === false ← correct validation
```

### Pattern 3: Full New Schema Shape

```typescript
// Source: Empirically verified against installed zod@4.3.6

const WorkloadDomainSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default('WLD-1'),
  // ... 24 more fields matching WorkloadDomainConfig
  deploymentMode: z.enum(['simple', 'ha', 'stretch']).default('ha'),
}).strip()

const ManagementDomainSchema = z.object({
  coresPerSocket: z.number().int().min(1).max(256).default(16),
  socketsPerHost: z.number().int().min(1).max(8).default(2),
  hostRamGB: z.number().positive().default(512),
  hostStorageTB: z.number().positive().default(3.84),
}).strip()

const InputStateSchema = z.object({
  managementArchitecture: z.enum(['shared', 'dedicated']).default('shared'),
  managementDomain: ManagementDomainSchema.default(
    () => ManagementDomainSchema.parse({})
  ),
  workloadDomains: z.array(WorkloadDomainSchema).min(1).default(
    () => [createDefaultWorkloadDomain(0)]
  ),
}).strip()
```

### Pattern 4: Updated hydrateFromUrl Assignment

The current `hydrateFromUrl` assigns 20 scalar properties individually. After the schema change, it assigns 3 top-level properties:

```typescript
// NEW pattern — 3 assignments replaces 20
const store = useInputStore()
store.managementArchitecture = state.managementArchitecture
store.managementDomain = state.managementDomain
store.workloadDomains = state.workloadDomains
// activeDomainIndex is NOT assigned — stays at 0 (URL-04)
```

### Pattern 5: Updated generateShareUrl Serialization

```typescript
// NEW pattern — read nested structure
const state = {
  managementArchitecture: store.managementArchitecture,
  managementDomain: { ...store.managementDomain },  // spread ManagementDomainConfig
  workloadDomains: store.workloadDomains.map(d => ({ ...d })),  // spread each WorkloadDomainConfig
}
// Note: activeTabIndex is never included — URL-04 satisfied automatically
```

### Anti-Patterns to Avoid

- **`ManagementDomainSchema.default({})`:** Silent bug — inner field defaults not applied when outer field is missing from parse input. Use factory `.default(() => ManagementDomainSchema.parse({}))`.
- **`z.array(WorkloadDomainSchema).default([])`:** Zod v4 known issue; use factory function. Even if it passes in current version, STATE.md locked decision mandates factory.
- **Including `activeDomainIndex` in serialized state:** It is ephemeral UI state. `.strip()` will remove it if someone accidentally includes it in the serialized object, but it must never be added to the schema.
- **Importing `createDefaultWorkloadDomain` from engine:** This import is fine (it's a pure TS function, no Vue imports). But the `id` field in the URL schema uses `.default(() => crypto.randomUUID())` — this generates a fresh ID on hydration when the URL happens to not carry an `id` field. For normal round-trips, the `id` from the serialized domain is preserved.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL-safe compression | Custom base64/compression | `LZString.compressToEncodedURIComponent` / `decompressFromEncodedURIComponent` | Already in use; handles all edge cases |
| Schema validation with fallback | try/catch JSON parse | `z.safeParse()` | Returns `{ success, data, error }` — no throw |
| URL read/write | `window.location.href` manipulation | `new URLSearchParams` + `new URL` | Already used; handles edge cases |

---

## Critical Pitfalls

### Pitfall 1: Nested Schema Default Bypasses Inner Field Defaults

**What goes wrong:** `ManagementDomainSchema.default({})` in the parent schema provides an empty object as the raw default, bypassing parsing. Inner `.default(16)` etc. are never applied, producing `undefined` for all fields.

**Why it happens:** Zod's `.default(value)` in nested context uses the value directly without running the sub-schema's parser when the outer field is absent.

**How to avoid:** Always use factory function: `.default(() => ManagementDomainSchema.parse({}))` — this runs the sub-schema's full parse (including defaults) to produce the value.

**Warning signs:** Tests pass but accessing `result.data.managementDomain.coresPerSocket` returns `undefined`.

### Pitfall 2: v2.x managementArchitecture Is a Top-Level Field — Preserved by New Schema

**What goes wrong:** Assuming v2.x URLs fully degrade to defaults. `managementArchitecture` was and remains a top-level field in both v2.x and v3.x schemas — so it IS preserved from v2.x URLs.

**Why it happens:** Only the flat workload fields (hostCount, vmCount, etc.) are stripped by `.strip()`. `managementArchitecture` is explicitly in both schemas.

**How to avoid:** This is correct behavior — document it. Do not treat `managementArchitecture` as degraded; it is intentionally preserved.

### Pitfall 3: Test File Replicates Schema — Must Be Updated in Sync

**What goes wrong:** `useUrlState.test.ts` contains a full replica of `InputStateSchema` (lines 9-35). After the composable schema changes, the test schema must also be updated or tests will pass against the old shape and miss regressions.

**Why it happens:** The test was written to avoid importing from the composable (composable uses Pinia / window). The schema replica pattern makes it self-contained but creates a sync risk.

**How to avoid:** Update `useUrlState.test.ts` schema replica in the same commit/task as the composable schema update. Write the new tests TDD-style with the new schema shape.

### Pitfall 4: 5-Domain URL Length Under 2,048 — But 8 Domains Exceeds It

**Empirical data (verified at research time):**
- 1 domain: 654 chars
- 3 domains: 1,277 chars
- 5 domains: 1,789 chars ← under 2,048 (success criterion met)
- 8 domains: 2,454 chars ← exceeds 2,048

**How to avoid:** Success criterion (URL-03 / SC4) only requires 5 domains under 2,048 chars — this passes. No action needed beyond documenting the practical limit. Do NOT add schema-level domain count caps beyond `min(1)` unless explicitly required.

### Pitfall 5: Zod id Field with crypto.randomUUID()

**What goes wrong:** `z.string().default(() => crypto.randomUUID())` generates a NEW UUID each time a domain without an `id` is parsed. This is correct for v2.x URLs (which have no `id`) but means hydrated domains get fresh UUIDs — not matching the serialized state.

**Why it happens:** For normal round-trips where all domains have their `id` included in the URL, this is not an issue (id is a plain string, it round-trips fine). The UUID default only fires when `id` is absent from the input.

**How to avoid:** Ensure `generateShareUrl` always includes the domain `id` in the serialized payload (spread of `WorkloadDomainConfig` naturally includes `id`).

---

## Code Examples

### WorkloadDomainSchema — All 26 Fields

```typescript
// Source: Empirically verified against installed zod@4.3.6 + types.ts interface
const WorkloadDomainSchema = z
  .object({
    id: z.string().default(() => crypto.randomUUID()),
    name: z.string().default('WLD-1'),
    coresPerSocket: z.number().int().min(1).max(256).default(16),
    socketsPerHost: z.number().int().min(1).max(8).default(2),
    hostRamGB: z.number().positive().default(512),
    hostStorageTB: z.number().positive().default(3.84),
    hostCount: z.number().int().min(1).max(64).default(4),
    nvmeTieringEnabled: z.boolean().default(false),
    activeMemoryPct: z.number().min(1).max(100).default(50),
    preferredSiteHosts: z.number().int().min(1).default(3),
    secondarySiteHosts: z.number().int().min(1).default(3),
    vmCount: z.number().int().min(0).default(100),
    avgVcpuPerVm: z.number().positive().default(4),
    avgVramGbPerVm: z.number().positive().default(8),
    avgStorageGbPerVm: z.number().positive().default(100),
    cpuOvercommitRatio: z.number().positive().max(20).default(4),
    ramOvercommitRatio: z.number().positive().max(4).default(1),
    gpuVmCount: z.number().int().min(0).default(0),
    vgpuMemoryGB: z.number().positive().default(16),
    storageType: z.enum(['vsan-esa', 'fc', 'nfs', 'vsan-max']).default('vsan-esa'),
    fttLevel: z.union([z.literal(1), z.literal(2)]).default(1),
    raidType: z.enum(['raid1', 'raid5', 'raid6']).default('raid5'),
    dedupEnabled: z.boolean().default(false),
    dedupRatio: z.number().min(1).max(10).default(2),
    vsanMaxProfile: z.enum(['xs', 'sm', 'med', 'lrg', 'xl']).default('med'),
    vsanMaxStorageNodes: z.number().int().min(4).max(64).default(4),
    networkSpeedGbE: z.union([z.literal(10), z.literal(25), z.literal(100)]).default(25),
    deploymentMode: z.enum(['simple', 'ha', 'stretch']).default('ha'),
  })
  .strip()
```

### ManagementDomainSchema

```typescript
// Source: Empirically verified — ManagementDomainConfig has exactly 4 fields
const ManagementDomainSchema = z
  .object({
    coresPerSocket: z.number().int().min(1).max(256).default(16),
    socketsPerHost: z.number().int().min(1).max(8).default(2),
    hostRamGB: z.number().positive().default(512),
    hostStorageTB: z.number().positive().default(3.84),
  })
  .strip()
```

### Top-Level InputStateSchema

```typescript
// Source: Empirically verified — factory defaults required for both nested fields
import { createDefaultWorkloadDomain } from '@/engine/defaults'

const InputStateSchema = z
  .object({
    managementArchitecture: z.enum(['shared', 'dedicated']).default('shared'),
    managementDomain: ManagementDomainSchema.default(
      () => ManagementDomainSchema.parse({})
    ),
    workloadDomains: z.array(WorkloadDomainSchema).min(1).default(
      () => [createDefaultWorkloadDomain(0)]
    ),
  })
  .strip()

type InputState = z.infer<typeof InputStateSchema>
```

---

## Validation Architecture

Nyquist validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project standard) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/composables/useUrlState.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| URL-01 | New Zod schema parses `{}` successfully and applies all defaults | unit | `npx vitest run src/composables/useUrlState.test.ts` | Needs update |
| URL-01 | WorkloadDomainSchema strips unknown keys | unit | `npx vitest run src/composables/useUrlState.test.ts` | Needs new test |
| URL-02 | v2.x flat-schema payload parses silently to default state (1 domain) | unit | `npx vitest run src/composables/useUrlState.test.ts` | Needs new test |
| URL-03 | 3-domain config round-trips losslessly (names, all field values preserved) | unit | `npx vitest run src/composables/useUrlState.test.ts` | Needs new test |
| URL-04 | `activeDomainIndex` absent from serialized payload (stripped by `.strip()`) | unit | `npx vitest run src/composables/useUrlState.test.ts` | Needs new test |
| URL-03 (SC4) | 5-domain URL param length < 2048 chars | unit | `npx vitest run src/composables/useUrlState.test.ts` | Needs new test |

### Sampling Rate

- **Per task commit:** `npx vitest run src/composables/useUrlState.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

The test file `src/composables/useUrlState.test.ts` already exists (20 tests passing). Its tests must be updated to match the new schema shape. New tests to add:

- [ ] New schema parse `{}` → applies all defaults including `workloadDomains[0].name === 'WLD-1'`
- [ ] `WorkloadDomainSchema` strips unknown keys
- [ ] `ManagementDomainSchema.parse({})` applies all 4 field defaults correctly
- [ ] v2.x flat payload round-trip → falls back to 1-domain default (URL-02)
- [ ] 3-domain lossless round-trip preserving all non-default field values (URL-03)
- [ ] `activeTabIndex` absent from serialized state (URL-04 — `.strip()` removes it)
- [ ] 5-domain URL param length < 2,048 chars (SC4)

Existing 20 tests cover old flat schema behavior and will need to be replaced/updated. The lz-string compression and decompression tests remain valid.

---

## Environment Availability

Step 2.6: All dependencies already in the project (zod, lz-string, vitest). No external tools required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| zod | Schema validation | Yes | 4.3.6 | — |
| lz-string | URL compression | Yes | 1.5.0 | — |
| Node.js crypto.randomUUID() | WorkloadDomain id default | Yes | Node 20+ in vitest env | — |

**No missing dependencies.**

---

## Project Constraints (from CLAUDE.md)

- `useUrlState.ts` lives in `src/composables/` — plain TypeScript module, no Vue lifecycle hooks
- Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library — `createDefaultWorkloadDomain` imported from `@/engine/defaults` is fine (pure TS)
- `calculationStore.ts` must never contain `ref()` — not affected by this phase
- Tests cover `src/engine/**/*.test.ts`, `src/composables/**/*.test.ts`, `src/stores/**/*.test.ts` (all included in vitest.config.ts)
- `@/` maps to `src/` (path alias already configured)
- `VueI18nPlugin` `include` omitted intentionally — not affected by this phase

---

## Open Questions

1. **Should `WorkloadDomainSchema` and `ManagementDomainSchema` be exported from `useUrlState.ts`?**
   - What we know: Currently the schema is not exported; tests replicate it inline
   - What's unclear: Whether Phase 12+ (form components) could benefit from re-using these schemas for per-field validation
   - Recommendation: Export them — they are stable type-aligned schemas that future phases may reference

2. **Should `createDefaultWorkloadDomain(0)` be imported into `useUrlState.ts`?**
   - What we know: The import is CALC-01 compliant (pure TS, no Vue). `defaults.ts` is already in engine layer
   - What's unclear: Whether the research team wants to duplicate default values or share them
   - Recommendation: Import `createDefaultWorkloadDomain` from `@/engine/defaults` — single source of truth for default values; avoids duplication drift

3. **Existing `useUrlState.test.ts` has 20 tests passing against v2.x schema — are they all obsolete?**
   - What we know: Most tests exercise lz-string round-trip (still valid) and v2.x Zod schema (must be replaced)
   - Recommendation: Keep lz-string tests, replace schema tests with new schema shape tests

---

## Sources

### Primary (HIGH confidence)
- Empirical verification against installed `zod@4.3.6` — all patterns run in Node.js during research
- Empirical verification against installed `lz-string@1.5.0` — compression/decompression tested
- `/Users/fjacquet/Projects/vcf-sizer/src/composables/useUrlState.ts` — current implementation
- `/Users/fjacquet/Projects/vcf-sizer/src/stores/inputStore.ts` — Phase 10 store structure
- `/Users/fjacquet/Projects/vcf-sizer/src/engine/types.ts` — `WorkloadDomainConfig` (26 fields), `ManagementDomainConfig` (4 fields)
- `/Users/fjacquet/Projects/vcf-sizer/src/engine/defaults.ts` — `createDefaultWorkloadDomain`, `createDefaultManagementDomain`
- `.planning/STATE.md` v3.0 decisions section — locked constraints

### Secondary (MEDIUM confidence)
- STATE.md citation of Zod v4 GitHub issues #5525, #4544 for `.default([])` bug — corroborated by empirical test showing factory pattern works and `.default({})` bypass confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — installed versions confirmed via `node -e require`
- Architecture patterns: HIGH — all patterns empirically verified in Node.js
- Pitfalls: HIGH — most discovered via live testing, not speculation
- URL length: HIGH — measured empirically for 1/2/3/4/5/8/10 domain counts
- v2.x backward compat: HIGH — tested with simulated v2.x payload

**Research date:** 2026-03-30
**Valid until:** 2026-09-30 (Zod 4.x stable; lz-string 1.5 very stable)
