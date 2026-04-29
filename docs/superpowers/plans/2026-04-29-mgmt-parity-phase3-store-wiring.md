# Mgmt Parity Phase 3 — Store Wiring + URL Zod Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the new `calcManagementFull(config, wlds)` orchestrator into the actual app — `inputStore` defaults extended, URL Zod schema accepts new fields with backward compat, `calculationStore` calls the new orchestrator, legacy `engine/management.ts` shim retired.

**Architecture:** Five tasks. First, the orchestrator gains a final pass that populates the legacy flat fields (`vcenterCores`, etc.) on its result so `usePptxExport.ts` keeps working without changes. Second, `createDefaultManagementDomain()` returns the full new shape with sensible defaults. Third, `ManagementDomainSchema` (Zod) accepts the new fields as `.optional()` with `.default()` — old shareable URLs hydrate to the same defaults the factory uses. Fourth, `calculationStore` switches its `calcManagement(mode)` call to `calcManagementFull(config, wlds)`. Fifth, the legacy shim `engine/management.ts` is deleted (no callers remain).

**Tech Stack:** TypeScript 5, Vue 3 Composition API, Pinia, Vitest, Zod, lz-string. Reuses existing patterns from the codebase.

**Reference spec:** `docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md` — §11 P3 (this phase), §7 (backward compat), §3 (shim retirement).

**Total tasks:** 5. Estimated total time: ~half a day. No new calculation logic; this is wiring.

---

## File Structure (modified or deleted in this phase)

```
src/engine/mgmt/
├── index.ts                # MODIFIED (Task 1 — orchestrator populates legacy flat fields)
└── index.test.ts           # MODIFIED (Task 1 — assertions for legacy flat fields)

src/engine/
├── defaults.ts             # MODIFIED (Task 2 — full default ManagementDomainConfig)
├── management.ts           # DELETED (Task 5 — shim retirement)
└── management.test.ts      # DELETED (Task 5)

src/composables/
├── useUrlState.ts          # MODIFIED (Task 3 — Zod schema extension + storageType widened)
└── useUrlState.test.ts     # MODIFIED (Task 3 — backward-compat URL hydration test)

src/stores/
├── calculationStore.ts     # MODIFIED (Task 4 — switch to calcManagementFull)
├── calculationStore.test.ts # MODIFIED (Task 4 — full-config flow tests)
└── inputStore.test.ts      # MODIFIED (Task 2 — defaults assertion)
```

No new files. Two deletions in Task 5.

---

## Naming and design decisions locked here

- The orchestrator continues to populate legacy flat fields (`vcenterCores`, `vcenterRamGB`, `sddcCores`, `sddcRamGB`, `nsxCores`, `nsxRamGB`, `opsCores`, `opsRamGB`, `automationCores`, `automationRamGB`) for backward compatibility with `usePptxExport.ts`. This is intentional duplication during the migration window. Once `usePptxExport.ts` is migrated to read from `appliances[]` (deferred to P5/P6), these can be removed.
- The `ManagementStorageType = Exclude<StorageType, 'vsan-max'>` alias in `engine/types.ts` is **kept** in this phase — it's still used by the existing `validateInputs` in `engine/validation.ts` (workload-domain validation). The narrow at `calculationStore.ts:134` continues to forward `'vsan-max' → 'vsan-esa'` for that legacy path. Removing the narrow / migrating `validateInputs` to accept all four storage types is deferred (separate concern from store wiring).
- The Zod schema's `storageType` enum is widened to include `'vsan-max'` since `ManagementDomainConfig.storageType` is now `StorageType` (per Q5 of the design).
- New Zod fields use `.optional().default(...)` — explicit optionality preserves backward compat and makes the schema drift-resistant.

---

## Task 1 — Orchestrator populates legacy flat fields

**Files:**
- Modify: `src/engine/mgmt/index.ts` — add `sumByCategory` helper + final result mapping
- Modify: `src/engine/mgmt/index.test.ts` — assertions for legacy flat fields

The current orchestrator returns the new shape with empty/missing legacy flat fields. The legacy shim adds them post-hoc. Move that logic into the orchestrator so any caller (not just the shim) gets a complete result.

- [ ] **Step 1: Add the failing tests in `src/engine/mgmt/index.test.ts`**

Append these tests to the existing file (after the last `describe` block):

```ts
describe('calcManagementFull — legacy flat fields populated', () => {
  it('vcenterCores/RamGB summed from vcenter category lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    const vcenterLines = r.appliances.filter(l => l.category === 'vcenter')
    const expectedCores = vcenterLines.reduce((s, l) => s + l.totalCores, 0)
    const expectedRam = vcenterLines.reduce((s, l) => s + l.totalRamGB, 0)
    expect(r.vcenterCores).toBe(expectedCores)
    expect(r.vcenterRamGB).toBe(expectedRam)
  })

  it('sddcCores/RamGB summed from sddcManager category lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.sddcCores).toBe(4)    // SDDC Manager fixed spec
    expect(r.sddcRamGB).toBe(16)
  })

  it('nsxCores/RamGB summed from nsxManager category lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    const nsxLines = r.appliances.filter(l => l.category === 'nsxManager')
    expect(r.nsxCores).toBe(nsxLines.reduce((s, l) => s + l.totalCores, 0))
    expect(r.nsxRamGB).toBe(nsxLines.reduce((s, l) => s + l.totalRamGB, 0))
  })

  it('opsCores/RamGB summed from vrops + vropsCollector + fleetManager category lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    const opsLines = r.appliances.filter(l =>
      l.category === 'vrops' || l.category === 'vropsCollector' || l.category === 'fleetManager'
    )
    expect(r.opsCores).toBe(opsLines.reduce((s, l) => s + l.totalCores, 0))
    expect(r.opsRamGB).toBe(opsLines.reduce((s, l) => s + l.totalRamGB, 0))
  })

  it('automationCores/RamGB summed from automation category lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    const autoLines = r.appliances.filter(l => l.category === 'automation')
    expect(r.automationCores).toBe(autoLines.reduce((s, l) => s + l.totalCores, 0))
    expect(r.automationRamGB).toBe(autoLines.reduce((s, l) => s + l.totalRamGB, 0))
  })
})
```

- [ ] **Step 2: Run failing tests — confirm legacy fields are missing/zero**

```bash
npx vitest run src/engine/mgmt/index.test.ts
```

Expected: 5 new tests FAIL (legacy flat fields are `undefined`).

- [ ] **Step 3: Modify `src/engine/mgmt/index.ts` — add the `sumByCategory` helper and final mapping**

Add this helper function inside the file (after the `DEFAULT_VALIDATED_SOLUTIONS` const, before the `calcManagementFull` export):

```ts
import type { ApplianceLine as _ApplianceLine } from './types'

function sumByCategory(
  lines: readonly _ApplianceLine[],
  categories: readonly string[],
): { cores: number; ramGB: number } {
  const matching = lines.filter(l => categories.includes(l.category as string))
  return {
    cores: matching.reduce((s, l) => s + l.totalCores, 0),
    ramGB: matching.reduce((s, l) => s + l.totalRamGB, 0),
  }
}
```

Then, at the END of `calcManagementFull` (where it currently returns `{ ...draft, validationWarnings: validateMgmt(config, draft) }`), replace that return statement with:

```ts
  // Build draft result
  const draft: MgmtDomainResult = {
    appliances,
    wldOverhead,
    totalCores,
    totalRamGB,
    totalDiskGB,
    totalSwapGB,
    perHostCores: perHostFinal.perHostCores,
    perHostRamGB: perHostFinal.perHostRamGB,
    perHostStorageGB: perHostFinal.perHostStorageGB,
    storageDemandTiB: storage.storageDemandTiB,
    minHostsForStorage,
    externalPoolRequiredTiB: perHostFinal.externalPoolRequiredTiB,
    recommendedHostCount,
    validationWarnings: [],
  }

  // Populate legacy flat fields (deprecated; used by usePptxExport.ts during P3+ migration window).
  // The full appliances array is the canonical source — these are convenience aggregates.
  const vcenter = sumByCategory(draft.appliances, ['vcenter'])
  const sddc = sumByCategory(draft.appliances, ['sddcManager'])
  const nsx = sumByCategory(draft.appliances, ['nsxManager'])
  const ops = sumByCategory(draft.appliances, ['vrops', 'vropsCollector', 'fleetManager'])
  const automation = sumByCategory(draft.appliances, ['automation'])

  return {
    ...draft,
    vcenterCores: vcenter.cores,
    vcenterRamGB: vcenter.ramGB,
    sddcCores: sddc.cores,
    sddcRamGB: sddc.ramGB,
    nsxCores: nsx.cores,
    nsxRamGB: nsx.ramGB,
    opsCores: ops.cores,
    opsRamGB: ops.ramGB,
    automationCores: automation.cores,
    automationRamGB: automation.ramGB,
    validationWarnings: validateMgmt(config, draft),
  }
}
```

(Replace the existing 3-line return at the bottom of the function. The `_ApplianceLine` import alias is to avoid a name collision with the existing `ApplianceLine` type re-export at the top of the file — you can also just `import type { ApplianceLine } from './types'` separately if cleaner.)

- [ ] **Step 4: Run tests, confirm pass**

```bash
npx vitest run src/engine/mgmt/index.test.ts
```

Expected: all tests PASS (5 new + existing).

- [ ] **Step 5: Run the full suite — verify nothing broke**

```bash
npm run test
```

Expected: 505 + 5 = 510 passing.

- [ ] **Step 6: Type-check + build**

```bash
npm run type-check
npm run build
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/engine/mgmt/index.ts src/engine/mgmt/index.test.ts
git commit -m "feat(mgmt): phase 3.1 — orchestrator populates legacy flat fields

Move the per-category sum logic from engine/management.ts (legacy
shim) into calcManagementFull. Now any caller (not just the shim)
gets a complete MgmtDomainResult with both the new appliances
array AND the legacy flat fields (vcenterCores, sddcCores, etc.).

This unblocks the calculationStore migration in Task 4 — once the
store calls calcManagementFull directly, usePptxExport.ts continues
to compile without changes via the @deprecated optional fields.

The flat fields remain @deprecated; final removal happens after
usePptxExport.ts migrates to read from appliances[] in P5/P6.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §3"
```

---

## Task 2 — Extend `createDefaultManagementDomain()` factory

**Files:**
- Modify: `src/engine/defaults.ts`
- Modify: `src/stores/inputStore.test.ts`

The factory currently returns the OLD 6-field shape. Extend to include all new fields with sensible defaults matching spec §7.

- [ ] **Step 1: Read the current state of `src/stores/inputStore.test.ts` to understand test pattern**

Use the Read tool to inspect the existing test file. Look at how it tests the default management domain to understand the pattern (likely `expect(store.managementDomain.coresPerSocket).toBe(16)` style).

- [ ] **Step 2: Add failing tests in `src/stores/inputStore.test.ts`**

Append these tests inside the existing main `describe` block (or in a new `describe('managementDomain new defaults — Phase 3')` block at the end of the file):

```ts
describe('managementDomain new defaults — Phase 3', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('profile defaults to "standard"', () => {
    const store = useInputStore()
    expect(store.managementDomain.profile).toBe('standard')
  })

  it('cpuOversubscription defaults to 2', () => {
    const store = useInputStore()
    expect(store.managementDomain.cpuOversubscription).toBe(2)
  })

  it('ramOversubscription defaults to 1', () => {
    const store = useInputStore()
    expect(store.managementDomain.ramOversubscription).toBe(1)
  })

  it('reservePct defaults to 30', () => {
    const store = useInputStore()
    expect(store.managementDomain.reservePct).toBe(30)
  })

  it('growthPct defaults to 10', () => {
    const store = useInputStore()
    expect(store.managementDomain.growthPct).toBe(10)
  })

  it('overrides defaults to empty object', () => {
    const store = useInputStore()
    expect(store.managementDomain.overrides).toEqual({})
  })

  it('validatedSolutions defaults to all-included-false', () => {
    const store = useInputStore()
    expect(store.managementDomain.validatedSolutions).toEqual({
      siteProtection: { included: false },
      ransomwareOnPrem: { included: false },
      ransomwareCloud: { included: false },
      crossCloudMobility: { included: false },
    })
  })
})
```

If `setActivePinia` and `createPinia` and `useInputStore` aren't already imported in the test file, add those imports.

- [ ] **Step 3: Run failing tests — confirm they fail (defaults are undefined)**

```bash
npx vitest run src/stores/inputStore.test.ts
```

Expected: 7 new tests FAIL (`expected 'standard' got undefined`, etc.).

- [ ] **Step 4: Replace `createDefaultManagementDomain()` in `src/engine/defaults.ts`**

Replace the existing function body with:

```ts
export function createDefaultManagementDomain(): ManagementDomainConfig {
  return {
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 3.84,
    deploymentMode: 'ha',
    storageType: 'vsan-esa',
    profile: 'standard',
    cpuOversubscription: 2,
    ramOversubscription: 1,
    reservePct: 30,
    growthPct: 10,
    overrides: {},
    validatedSolutions: {
      siteProtection: { included: false },
      ransomwareOnPrem: { included: false },
      ransomwareCloud: { included: false },
      crossCloudMobility: { included: false },
    },
  }
}
```

- [ ] **Step 5: Run tests, confirm they pass**

```bash
npx vitest run src/stores/inputStore.test.ts
```

Expected: all tests PASS (7 new + existing).

- [ ] **Step 6: Run the full suite + type-check + build**

```bash
npm run test
npm run type-check
npm run build
```

Expected: 510 + 7 = 517 passing.

- [ ] **Step 7: Commit**

```bash
git add src/engine/defaults.ts src/stores/inputStore.test.ts
git commit -m "feat(mgmt): phase 3.2 — createDefaultManagementDomain returns full new shape

createDefaultManagementDomain() now includes all P1+P2 fields with
sensible defaults: profile='standard', cpuOversubscription=2,
ramOversubscription=1, reservePct=30, growthPct=10, overrides={},
validatedSolutions all-disabled.

Existing inputStore tests preserved; 7 new tests pin the defaults.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §7"
```

---

## Task 3 — Extend `ManagementDomainSchema` Zod schema + URL backward-compat

**Files:**
- Modify: `src/composables/useUrlState.ts`
- Modify: `src/composables/useUrlState.test.ts`

The current Zod schema accepts only the OLD 6 fields and rejects `'vsan-max'` for storage. Extend to:
- Add new optional fields with `.default(...)` matching the factory.
- Widen `storageType` enum to include `'vsan-max'`.
- Verify old shareable URLs (no new fields) hydrate cleanly via Zod's default-application.

- [ ] **Step 1: Read the current state of `src/composables/useUrlState.test.ts`** to understand the test pattern.

- [ ] **Step 2: Add failing tests in `src/composables/useUrlState.test.ts`**

Append these tests in a new `describe('ManagementDomainSchema — Phase 3 fields')` block:

```ts
describe('ManagementDomainSchema — Phase 3 fields', () => {
  it('accepts the new full management config shape', () => {
    const result = ManagementDomainSchema.safeParse({
      coresPerSocket: 32,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostStorageTiB: 8,
      deploymentMode: 'ha',
      storageType: 'vsan-esa',
      profile: 'standard',
      cpuOversubscription: 2,
      ramOversubscription: 1,
      reservePct: 30,
      growthPct: 10,
      overrides: {},
      validatedSolutions: {
        siteProtection: { included: false },
        ransomwareOnPrem: { included: false },
        ransomwareCloud: { included: false },
        crossCloudMobility: { included: false },
      },
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults for new fields when missing (backward compat)', () => {
    // Old shareable URL: only the 6 original fields
    const result = ManagementDomainSchema.safeParse({
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostStorageTiB: 3.84,
      deploymentMode: 'ha',
      storageType: 'vsan-esa',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.profile).toBe('standard')
      expect(result.data.cpuOversubscription).toBe(2)
      expect(result.data.ramOversubscription).toBe(1)
      expect(result.data.reservePct).toBe(30)
      expect(result.data.growthPct).toBe(10)
      expect(result.data.overrides).toEqual({})
      expect(result.data.validatedSolutions).toEqual({
        siteProtection: { included: false },
        ransomwareOnPrem: { included: false },
        ransomwareCloud: { included: false },
        crossCloudMobility: { included: false },
      })
    }
  })

  it('storageType now accepts vsan-max for management', () => {
    const result = ManagementDomainSchema.safeParse({
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostStorageTiB: 3.84,
      deploymentMode: 'ha',
      storageType: 'vsan-max',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid profile value', () => {
    const result = ManagementDomainSchema.safeParse({
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostStorageTiB: 3.84,
      deploymentMode: 'ha',
      storageType: 'vsan-esa',
      profile: 'enormous',  // not a valid MgmtProfile value
    })
    expect(result.success).toBe(false)
  })

  it('reservePct rejects negative values', () => {
    const result = ManagementDomainSchema.safeParse({
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostStorageTiB: 3.84,
      deploymentMode: 'ha',
      storageType: 'vsan-esa',
      reservePct: -5,
    })
    expect(result.success).toBe(false)
  })
})
```

If `ManagementDomainSchema` isn't already imported in the test file, add the import.

- [ ] **Step 3: Run failing tests — confirm they fail**

```bash
npx vitest run src/composables/useUrlState.test.ts
```

Expected: 5 new tests FAIL (schema rejects new fields or doesn't apply defaults).

- [ ] **Step 4: Modify `src/composables/useUrlState.ts` — extend `ManagementDomainSchema`**

Replace the current schema (lines 48-57) with:

```ts
export const ManagementDomainSchema = z
  .object({
    coresPerSocket: z.number().int().min(1).max(256).default(16),
    socketsPerHost: z.number().int().min(1).max(8).default(2),
    hostRamGB: z.number().positive().default(512),
    hostStorageTiB: z.number().positive().default(3.84),
    deploymentMode: z.enum(['simple', 'ha', 'stretch']).default('ha'),
    // Widened to include 'vsan-max' (per Q5 of design — vSAN Max for mgmt is supported).
    storageType: z.enum(['vsan-esa', 'fc', 'nfs', 'vsan-max']).default('vsan-esa'),

    // FC/NFS only — required pool size when those types are selected.
    externalStorageUsableTiB: z.number().positive().optional(),
    // vSAN Max for mgmt only.
    vsanMaxStorageNodes: z.number().int().min(4).max(64).optional(),
    vsanMaxProfile: z.enum(['xs', 'sm', 'med', 'lrg', 'xl']).optional(),

    // Profile + capacity headroom (P3 additions).
    profile: z.enum(['lab', 'standard', 'large']).default('standard'),
    cpuOversubscription: z.number().positive().max(8).default(2),
    ramOversubscription: z.number().positive().max(4).default(1),
    reservePct: z.number().min(0).max(100).default(30),
    growthPct: z.number().min(0).max(100).default(10),

    // Sparse override map — empty by default.
    overrides: z.record(
      z.string(),
      z.object({
        included: z.boolean().optional(),
        size: z.string().optional(),
        nodeCount: z.number().int().min(1).max(20).optional(),
      }),
    ).default({}),

    // Validated solutions toggles.
    validatedSolutions: z
      .object({
        siteProtection: z
          .object({
            included: z.boolean(),
            mgmtSize: z.enum(['light', 'standard']).optional(),
          })
          .default({ included: false }),
        ransomwareOnPrem: z.object({ included: z.boolean() }).default({ included: false }),
        ransomwareCloud: z.object({ included: z.boolean() }).default({ included: false }),
        crossCloudMobility: z.object({ included: z.boolean() }).default({ included: false }),
      })
      .default({
        siteProtection: { included: false },
        ransomwareOnPrem: { included: false },
        ransomwareCloud: { included: false },
        crossCloudMobility: { included: false },
      }),
  })
  .strip()
```

- [ ] **Step 5: Run tests, confirm pass**

```bash
npx vitest run src/composables/useUrlState.test.ts
```

Expected: all tests PASS (5 new + existing).

- [ ] **Step 6: Run full suite + type-check + build**

```bash
npm run test
npm run type-check
npm run build
```

Expected: 517 + 5 = 522 passing.

- [ ] **Step 7: Commit**

```bash
git add src/composables/useUrlState.ts src/composables/useUrlState.test.ts
git commit -m "feat(mgmt): phase 3.3 — Zod schema accepts P1+P2 management fields

ManagementDomainSchema extended:
- storageType enum widened to include 'vsan-max' (per Q5 of design).
- New optional fields: externalStorageUsableTiB, vsanMaxStorageNodes,
  vsanMaxProfile.
- New fields with defaults matching createDefaultManagementDomain():
  profile='standard', cpuOversubscription=2, ramOversubscription=1,
  reservePct=30, growthPct=10, overrides={}, validatedSolutions=
  all-disabled.

Old shareable URLs (with only the 6 original fields) hydrate
cleanly: Zod applies the defaults, producing a config equivalent
to what the factory creates. Verified by 5 new tests.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §7"
```

---

## Task 4 — Switch `calculationStore` to `calcManagementFull`

**Files:**
- Modify: `src/stores/calculationStore.ts`
- Modify: `src/stores/calculationStore.test.ts`

Replace the legacy `calcManagement(mode)` call with `calcManagementFull(config, wlds)`. The `management.value.totalCores` and `management.value.totalRamGB` fields keep working unchanged; the new orchestrator additionally provides `appliances`, `wldOverhead`, and the legacy flat fields populated by Task 1.

The storageType narrow at line 134 (forwarding to `validateInputs`) is **kept** in this phase — `validateInputs` still expects `ManagementStorageType` (no `vsan-max`). Migrating that is a separate concern (P5/P6).

- [ ] **Step 1: Read `src/stores/calculationStore.test.ts` to understand existing test patterns**

Use the Read tool. Note how the existing tests construct configs and exercise the store's `management.value.totalCores`, `domainResults.value`, etc.

- [ ] **Step 2: Add failing tests in `src/stores/calculationStore.test.ts`**

In a new `describe('calculationStore — calcManagementFull integration (Phase 3)')` block:

```ts
describe('calculationStore — calcManagementFull integration (Phase 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('management.appliances is populated (was empty under legacy shim)', () => {
    const calc = useCalculationStore()
    expect(calc.management.appliances.length).toBeGreaterThan(0)
    expect(calc.management.appliances.find(l => l.category === 'sddcManager')).toBeDefined()
  })

  it('management.wldOverhead is auto-derived from inputStore.workloadDomains', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    // Default has 1 workload domain → wldOverhead has 2 lines (vcenter + nsxManager)
    expect(calc.management.wldOverhead.length).toBe(input.workloadDomains.length * 2)
  })

  it('management.recommendedHostCount is non-zero (was 0 under legacy shim)', () => {
    const calc = useCalculationStore()
    expect(calc.management.recommendedHostCount).toBeGreaterThan(0)
  })

  it('management.totalDiskGB is populated (was 0 under legacy shim)', () => {
    const calc = useCalculationStore()
    expect(calc.management.totalDiskGB).toBeGreaterThan(0)
  })

  it('legacy flat fields still populated for usePptxExport compatibility', () => {
    const calc = useCalculationStore()
    expect(calc.management.vcenterCores).toBeGreaterThan(0)
    expect(calc.management.sddcCores).toBe(4)
    expect(calc.management.nsxCores).toBeGreaterThan(0)
  })

  it('changing inputStore.managementDomain.profile recomputes totals', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    const standardTotal = calc.management.totalCores
    input.managementDomain.profile = 'lab'
    const labTotal = calc.management.totalCores
    expect(labTotal).toBeLessThan(standardTotal)   // Lab is smaller than Standard
  })
})
```

If `setActivePinia`, `createPinia`, `useInputStore`, `useCalculationStore` aren't already imported, add them.

- [ ] **Step 3: Run failing tests — confirm they fail**

```bash
npx vitest run src/stores/calculationStore.test.ts
```

Expected: 6 new tests FAIL (`appliances` is empty array, `recommendedHostCount` is 0, etc. — the legacy shim's placeholder values).

- [ ] **Step 4: Modify `src/stores/calculationStore.ts` — switch to `calcManagementFull`**

Replace the import on line 8:

```ts
// OLD:
// import { calcManagement } from '../engine/management'

// NEW:
import { calcManagementFull } from '../engine/mgmt'
```

Replace the `management` computed at lines 21-23:

```ts
  // Management domain — full pipeline (P3): consumes the full ManagementDomainConfig
  // and the workloadDomains array (for auto-derived per-WLD overhead).
  const management = computed(() =>
    calcManagementFull(input.managementDomain, input.workloadDomains)
  )
```

Leave everything else in the file unchanged. Specifically:
- The storageType narrow at lines 133-136 stays — `validateInputs` still expects `ManagementStorageType`.
- The `management.value.totalCores` / `management.value.totalRamGB` reads stay — those fields still exist on the new shape.
- The `dedicatedMgmtHostCount` computation stays — it reads `management.value.totalCores` which is unchanged.

- [ ] **Step 5: Run tests, confirm pass**

```bash
npx vitest run src/stores/calculationStore.test.ts
```

Expected: all tests PASS (6 new + existing).

- [ ] **Step 6: Run the full suite + type-check + build**

```bash
npm run test
npm run type-check
npm run build
```

Expected: 522 + 6 = 528 passing.

If any existing test fails, the most likely cause is that a test was relying on a placeholder zero from the legacy shim (e.g., `recommendedHostCount: 0`) and the orchestrator now produces a real value. Fix by updating the test expectation to the new value, NOT by reverting the import.

- [ ] **Step 7: Commit**

```bash
git add src/stores/calculationStore.ts src/stores/calculationStore.test.ts
git commit -m "feat(mgmt): phase 3.4 — calculationStore calls calcManagementFull

calculationStore.management now invokes calcManagementFull(config,
wlds) directly instead of the legacy calcManagement(mode) shim.
Consumers see the full MgmtDomainResult: appliances array,
wldOverhead, real recommendedHostCount, total disk/swap, and the
legacy flat fields populated by the orchestrator (Task 3.1).

The storageType narrow at line 134 forwarding to validateInputs
is kept — that path still uses ManagementStorageType (without
vsan-max). Migrating validateInputs is a separate concern (P5/P6).

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §11 P3"
```

---

## Task 5 — Delete the legacy shim

**Files:**
- Delete: `src/engine/management.ts`
- Delete: `src/engine/management.test.ts`

After Task 4, no callers of `calcManagement(mode)` remain. Verify and delete.

- [ ] **Step 1: Verify there are no remaining callers**

```bash
grep -rE "from ['\"]@?/engine/management|from ['\"]\\./management" src/ --include='*.ts' --include='*.vue'
```

Expected output: zero hits.

If hits exist, STOP — there's an unmigrated caller. Read the caller, decide whether to migrate it (likely just changing the import path to `'./mgmt'` and the call to `calcManagementFull(config, wlds)`), then re-run this verification.

- [ ] **Step 2: Delete the two files**

```bash
git rm src/engine/management.ts src/engine/management.test.ts
```

- [ ] **Step 3: Run the full suite + type-check + build to confirm nothing broke**

```bash
npm run test
npm run type-check
npm run build
```

Expected:
- `npm run test`: 528 - 11 = 517 passing (the 11 tests in `management.test.ts` are gone, but everything else stays green).
- `npm run type-check`: clean.
- `npm run build`: clean.

If type-check fails with "Module './management' not found", there's still a caller that wasn't caught by Step 1's grep. Inspect the error, restore the files (`git restore --staged src/engine/management.ts src/engine/management.test.ts && git checkout HEAD -- src/engine/management.ts src/engine/management.test.ts`), migrate the caller properly, then re-attempt the deletion.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(mgmt): phase 3.5 — delete legacy calcManagement(mode) shim

calculationStore migrated to calcManagementFull in Task 3.4. No
remaining callers of the legacy shim. Deleting:
- src/engine/management.ts (~85 lines)
- src/engine/management.test.ts (~85 lines, 11 tests)

The MGMT-04 invariant (Fleet Manager + Collector are HA singletons)
is now expressed structurally in src/engine/mgmt/appliances.ts
(HA_FANOUT_CATEGORIES set excludes them) rather than as legacy test
pins. The legacy flat fields on MgmtDomainResult remain @deprecated
for usePptxExport.ts compatibility; final removal in P5/P6.

Net diff: ~170 lines removed; 11 tests retired (regression coverage
moved into mgmt/index.test.ts and mgmt/appliances.test.ts).

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §3 backward-compat shim retirement"
```

---

## Phase 3 — Acceptance criteria

After all 5 tasks are complete:

- `src/engine/mgmt/index.ts` orchestrator populates legacy flat fields on its result.
- `src/engine/defaults.ts` `createDefaultManagementDomain()` returns the full new shape with sensible defaults.
- `src/composables/useUrlState.ts` `ManagementDomainSchema` accepts the full new shape; old shareable URLs hydrate cleanly via Zod defaults.
- `src/stores/calculationStore.ts` calls `calcManagementFull(config, wlds)` directly.
- `src/engine/management.ts` and `src/engine/management.test.ts` deleted.
- `npm run test` is green at ~517 tests (was 505 + ~23 new from P3 Tasks 1-4 - 11 retired in Task 5 = ~517).
- `npm run type-check` clean.
- `npm run build` clean.
- Git log shows 5 atomic commits, one per task.
- **No user-visible behavior change** — the application's results match what was returned by the legacy shim before P3, but consumers can now read `management.appliances`, `management.recommendedHostCount`, etc., from the store. **EXCEPT:** `management.recommendedHostCount`, `management.totalDiskGB`, `management.minHostsForStorage` etc. are now nonzero (were placeholder zeros under the shim) — if the UI surfaces any of these, they'll display real values.

This phase produces the first real consumer of the new orchestrator. P4 will surface the new fields in the wizard UI.

---

## Notes for the implementer

- **No new arithmetic in this phase.** All calculation logic was completed in P2; this phase just wires it.
- **The narrow at `calculationStore.ts:134`** (storageType `vsan-max → vsan-esa` for `validateInputs`) is intentionally kept. Don't try to remove it — `validateInputs` doesn't yet handle `vsan-max` for management, and changing that is out of scope for P3.
- **Backward-compat URL test (Task 3.2)** is the most important regression check — if a user has a shareable URL from before P3, it must still work. The Zod `.default(...)` calls handle this automatically; the test verifies it.
- **Task 5's grep** must return zero hits before proceeding to delete. If you find a caller, the migration is small (change import path + call signature), but you MUST migrate the caller; don't delete the shim if it leaves dangling references.
- The `rtk` CLI proxy sometimes mangles `npx vitest run` output to a single PASS/FAIL summary. If you need full output, drop the `rtk` prefix and run plain `npx vitest`.
- IDE TS server diagnostics may show stale "Cannot find module" errors after files are added/deleted. The source of truth is `npm run type-check` (which runs `vue-tsc --noEmit`).
