# Mgmt Parity Phase 1 — Engine Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the `src/engine/mgmt/` foundation — type definitions, frozen VMware sizing tables, and Lab/Standard/Large profile preset mappings — with full unit-test coverage. No callers wired; no behavior change to the running app.

**Architecture:** Decomposed pure-TS subsystem under `src/engine/mgmt/`. Three files in this phase: `types.ts` (compile-time contracts), `constants.ts` (frozen tables sourced from VMware's VCF 9.0 workbook + `getApplianceSpec(category, size)` lookup), `profiles.ts` (profile → per-category default mapping + `resolveProfileEntry(profile, category)` resolver). Zero Vue/Pinia imports (CALC-01); `Decimal.js` not yet needed in this phase (no arithmetic).

**Tech Stack:** TypeScript 5, Vitest (node env, no DOM), existing `decimal.js` available but unused this phase.

**Reference spec:** `docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md` — Appendix A (sizing values), Appendix B (profile presets), §3 (module boundaries), §4 (data model).

**Total tasks:** 4. Estimated total time: half a day.

---

## File Structure (all created in this phase)

```
src/engine/mgmt/
├── types.ts            # Type definitions only (Task 1)
├── constants.ts        # Frozen VMware sizing tables + getApplianceSpec() (Task 2)
├── constants.test.ts   # Unit tests for the lookup function (Task 2)
├── profiles.ts         # Lab/Standard/Large preset maps + resolveProfileEntry() (Task 3)
├── profiles.test.ts    # Unit tests for profile resolution (Task 3)
└── index.ts            # Public barrel re-export (Task 4)
```

No existing files are modified. No callsites change. `src/engine/management.ts` remains untouched in this phase (the backward-compat shim is added in P2).

---

## Task 1 — Create `src/engine/mgmt/types.ts`

**Files:**
- Create: `src/engine/mgmt/types.ts`

This file has no behavior to test at runtime — types are compile-time. The verification step is `npm run type-check` (which runs `vue-tsc --noEmit`).

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/engine/mgmt
```

- [ ] **Step 2: Write `src/engine/mgmt/types.ts`**

Create the file with this exact content:

```ts
// VCF 9.x Management Domain — Phase 1 type definitions
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §4

import type {
  DeploymentMode,
  StorageType,
  VsanMaxProfile,
  ValidationWarning,
} from '../types'

// ─── Sizing taxonomy ──────────────────────────────────────────────────────

export type MgmtProfile = 'lab' | 'standard' | 'large'

export type ApplianceSize = 'tiny' | 'small' | 'medium' | 'large' | 'xlarge'
export type NsxEdgeSize = 'small' | 'medium' | 'large' | 'xlarge'
export type SspSize = 'medium' | 'large' | 'xlarge'
export type SrmSize = 'light' | 'standard'
export type CollectorSize = 'small' | 'standard'

// Union covering every size string that may appear in an override.
// `appliances.ts` (P2) will narrow this per category at lookup time.
export type AnyApplianceSize =
  | ApplianceSize
  | NsxEdgeSize
  | SspSize
  | SrmSize
  | CollectorSize

// ─── Appliance category identifiers ───────────────────────────────────────
// Stable string keys used across constants, profiles, overrides, and i18n.
// Adding a category = adding here + constants.ts + profiles.ts.

export type MgmtApplianceCategory =
  | 'vcenter'
  | 'nsxManager'
  | 'nsxEdge'
  | 'aviLb'
  | 'vrops'
  | 'vropsCollector'
  | 'vrli'
  | 'vrni'
  | 'vrniCollector'
  | 'automation'
  | 'fleetManager'
  | 'identityBroker'
  | 'ssp'

// ─── Per-spec resource shape ──────────────────────────────────────────────

export interface ApplianceSpec {
  cores: number
  ramGB: number
  diskGB: number
}

// ─── Profile preset entry ─────────────────────────────────────────────────
// One entry per (profile, category). Drives Step 1 of the calc pipeline.

export interface ProfileEntry {
  included: boolean
  size: AnyApplianceSize
  nodeCount: number      // 1 for singletons; 3 for HA clusters; 2 for Edge pairs
}

// ─── Override shape (sparse — empty = "use profile defaults") ─────────────

export interface ApplianceOverride {
  included?: boolean
  size?: AnyApplianceSize
  nodeCount?: number
}

// ─── Validated solutions ──────────────────────────────────────────────────

export interface ValidatedSolutionsConfig {
  siteProtection:    { included: boolean; mgmtSize?: SrmSize }
  ransomwareOnPrem:  { included: boolean }
  ransomwareCloud:   { included: boolean }
  crossCloudMobility:{ included: boolean }
}

// ─── Public config + result shapes (placeholders for P2 to fill in) ───────
// Defined here so types.ts is the single source of truth.

export interface ManagementDomainConfig {
  // Hardware
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTiB: number
  deploymentMode: DeploymentMode
  storageType: StorageType            // includes 'vsan-max'

  // FC/NFS-only
  externalStorageUsableTiB?: number

  // vSAN-Max-for-mgmt only
  vsanMaxStorageNodes?: number
  vsanMaxProfile?: VsanMaxProfile

  // Capacity headroom
  cpuOversubscription: number         // default 2
  ramOversubscription: number         // default 1
  reservePct: number                  // default 30
  growthPct: number                   // default 10

  // Sizing UX
  profile: MgmtProfile                // default 'standard'

  overrides: Partial<Record<MgmtApplianceCategory, ApplianceOverride>>

  validatedSolutions: ValidatedSolutionsConfig
}

export interface ApplianceLine {
  category: MgmtApplianceCategory | 'sddcManager' | string
  nodeCount: number
  cores: number
  ramGB: number
  diskGB: number
  totalCores: number
  totalRamGB: number
  totalDiskGB: number
  source: 'profile' | 'override' | 'auto-derived' | 'validated-solution'
}

export interface MgmtDomainResult {
  appliances: ApplianceLine[]
  wldOverhead: ApplianceLine[]

  totalCores: number
  totalRamGB: number
  totalDiskGB: number
  totalSwapGB: number

  perHostCores: number
  perHostRamGB: number
  perHostStorageGB: number

  storageDemandTiB: number
  minHostsForStorage: number
  externalPoolRequiredTiB: number

  recommendedHostCount: number

  validationWarnings: ValidationWarning[]
}
```

- [ ] **Step 3: Verify the file compiles**

Run: `npm run type-check`
Expected: clean exit code 0, no errors. The new file imports `DeploymentMode`, `StorageType`, `VsanMaxProfile`, `ValidationWarning` from the existing `../types` — all four already exported there.

- [ ] **Step 4: Verify it changes nothing at runtime**

Run: `npm run test`
Expected: all 297+ existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/mgmt/types.ts
git commit -m "feat(mgmt): phase 1.1 — types.ts skeleton

Type-only definitions for the new src/engine/mgmt/ subsystem:
MgmtProfile, ApplianceSize variants, MgmtApplianceCategory,
ApplianceSpec, ProfileEntry, ApplianceOverride,
ValidatedSolutionsConfig, ManagementDomainConfig, ApplianceLine,
MgmtDomainResult. No runtime code; no behavior change.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md"
```

---

## Task 2 — Create `src/engine/mgmt/constants.ts` + tests

**Files:**
- Create: `src/engine/mgmt/constants.ts`
- Create: `src/engine/mgmt/constants.test.ts`

Frozen VMware sizing tables for all 13 user-overridable categories + SDDC Manager + Validated Solutions. Plus a `getApplianceSpec(category, size)` lookup function. TDD: write the test first, watch it fail, implement.

- [ ] **Step 1: Create the failing test file `src/engine/mgmt/constants.test.ts`**

```ts
/// <reference types="vitest/globals" />
import { getApplianceSpec, SDDC_MANAGER_SPEC, FLEET_MANAGER_SPEC, VALIDATED_SOLUTIONS_SPECS } from './constants'

describe('getApplianceSpec — vCenter sizes (Appendix A)', () => {
  it('Tiny → 2 / 14 / 579', () => {
    expect(getApplianceSpec('vcenter', 'tiny')).toEqual({ cores: 2, ramGB: 14, diskGB: 579 })
  })
  it('Small → 4 / 21 / 694', () => {
    expect(getApplianceSpec('vcenter', 'small')).toEqual({ cores: 4, ramGB: 21, diskGB: 694 })
  })
  it('Medium → 8 / 30 / 908', () => {
    expect(getApplianceSpec('vcenter', 'medium')).toEqual({ cores: 8, ramGB: 30, diskGB: 908 })
  })
  it('Large → 16 / 39 / 1358', () => {
    expect(getApplianceSpec('vcenter', 'large')).toEqual({ cores: 16, ramGB: 39, diskGB: 1358 })
  })
  it('XLarge → 24 / 58 / 2283', () => {
    expect(getApplianceSpec('vcenter', 'xlarge')).toEqual({ cores: 24, ramGB: 58, diskGB: 2283 })
  })
})

describe('getApplianceSpec — NSX Manager sizes', () => {
  it('Medium → 6 / 24 / 300', () => {
    expect(getApplianceSpec('nsxManager', 'medium')).toEqual({ cores: 6, ramGB: 24, diskGB: 300 })
  })
  it('Large → 12 / 48 / 300', () => {
    expect(getApplianceSpec('nsxManager', 'large')).toEqual({ cores: 12, ramGB: 48, diskGB: 300 })
  })
  it('XLarge → 24 / 96 / 400', () => {
    expect(getApplianceSpec('nsxManager', 'xlarge')).toEqual({ cores: 24, ramGB: 96, diskGB: 400 })
  })
})

describe('getApplianceSpec — NSX Edge sizes', () => {
  it('Small → 2 / 4 / 200', () => {
    expect(getApplianceSpec('nsxEdge', 'small')).toEqual({ cores: 2, ramGB: 4, diskGB: 200 })
  })
  it('Medium → 4 / 8 / 200', () => {
    expect(getApplianceSpec('nsxEdge', 'medium')).toEqual({ cores: 4, ramGB: 8, diskGB: 200 })
  })
  it('Large → 8 / 32 / 200', () => {
    expect(getApplianceSpec('nsxEdge', 'large')).toEqual({ cores: 8, ramGB: 32, diskGB: 200 })
  })
  it('XLarge → 16 / 64 / 200', () => {
    expect(getApplianceSpec('nsxEdge', 'xlarge')).toEqual({ cores: 16, ramGB: 64, diskGB: 200 })
  })
})

describe('getApplianceSpec — AVI Load Balancer sizes', () => {
  it('Small → 6 / 32 / 512', () => {
    expect(getApplianceSpec('aviLb', 'small')).toEqual({ cores: 6, ramGB: 32, diskGB: 512 })
  })
  it('Large → 16 / 48 / 1400', () => {
    expect(getApplianceSpec('aviLb', 'large')).toEqual({ cores: 16, ramGB: 48, diskGB: 1400 })
  })
  it('XLarge → 16 / 64 / 1750', () => {
    expect(getApplianceSpec('aviLb', 'xlarge')).toEqual({ cores: 16, ramGB: 64, diskGB: 1750 })
  })
})

describe('getApplianceSpec — VCF Operations (vROps)', () => {
  it('Small → 4 / 16 / 274', () => {
    expect(getApplianceSpec('vrops', 'small')).toEqual({ cores: 4, ramGB: 16, diskGB: 274 })
  })
  it('Medium → 8 / 32 / 274', () => {
    expect(getApplianceSpec('vrops', 'medium')).toEqual({ cores: 8, ramGB: 32, diskGB: 274 })
  })
  it('Large → 16 / 48 / 274', () => {
    expect(getApplianceSpec('vrops', 'large')).toEqual({ cores: 16, ramGB: 48, diskGB: 274 })
  })
})

describe('getApplianceSpec — VCF Operations Collector', () => {
  it('Small → 4 / 16 / 264', () => {
    expect(getApplianceSpec('vropsCollector', 'small')).toEqual({ cores: 4, ramGB: 16, diskGB: 264 })
  })
  it('Standard → 8 / 48 / 264', () => {
    expect(getApplianceSpec('vropsCollector', 'standard')).toEqual({ cores: 8, ramGB: 48, diskGB: 264 })
  })
})

describe('getApplianceSpec — vRLI (Logs)', () => {
  it('Small → 4 / 8 / 530', () => {
    expect(getApplianceSpec('vrli', 'small')).toEqual({ cores: 4, ramGB: 8, diskGB: 530 })
  })
  it('Medium → 8 / 16 / 530', () => {
    expect(getApplianceSpec('vrli', 'medium')).toEqual({ cores: 8, ramGB: 16, diskGB: 530 })
  })
  it('Large → 16 / 32 / 530', () => {
    expect(getApplianceSpec('vrli', 'large')).toEqual({ cores: 16, ramGB: 32, diskGB: 530 })
  })
})

describe('getApplianceSpec — vRNI (Networks)', () => {
  it('Medium → 8 / 32 / 1024', () => {
    expect(getApplianceSpec('vrni', 'medium')).toEqual({ cores: 8, ramGB: 32, diskGB: 1024 })
  })
  it('Large → 12 / 48 / 1024', () => {
    expect(getApplianceSpec('vrni', 'large')).toEqual({ cores: 12, ramGB: 48, diskGB: 1024 })
  })
})

describe('getApplianceSpec — vRNI Collector', () => {
  it('Medium → 4 / 12 / 250', () => {
    expect(getApplianceSpec('vrniCollector', 'medium')).toEqual({ cores: 4, ramGB: 12, diskGB: 250 })
  })
})

describe('getApplianceSpec — VCF Automation', () => {
  it('Small → 24 / 96 / 455', () => {
    expect(getApplianceSpec('automation', 'small')).toEqual({ cores: 24, ramGB: 96, diskGB: 455 })
  })
  it('Medium → 24 / 96 / 334', () => {
    expect(getApplianceSpec('automation', 'medium')).toEqual({ cores: 24, ramGB: 96, diskGB: 334 })
  })
  it('Large → 32 / 128 / 430', () => {
    expect(getApplianceSpec('automation', 'large')).toEqual({ cores: 32, ramGB: 128, diskGB: 430 })
  })
})

describe('getApplianceSpec — Identity Broker (WSA)', () => {
  it('Medium → 8 / 16 / 220', () => {
    expect(getApplianceSpec('identityBroker', 'medium')).toEqual({ cores: 8, ramGB: 16, diskGB: 220 })
  })
})

describe('getApplianceSpec — SSP (Security Services Platform)', () => {
  it('Medium → 112 / 414 / 4096', () => {
    expect(getApplianceSpec('ssp', 'medium')).toEqual({ cores: 112, ramGB: 414, diskGB: 4096 })
  })
  it('Large → 160 / 606 / 5120', () => {
    expect(getApplianceSpec('ssp', 'large')).toEqual({ cores: 160, ramGB: 606, diskGB: 5120 })
  })
  it('XLarge → 192 / 734 / 6656', () => {
    expect(getApplianceSpec('ssp', 'xlarge')).toEqual({ cores: 192, ramGB: 734, diskGB: 6656 })
  })
})

describe('Always-on appliance specs (no size variants)', () => {
  it('SDDC Manager → 4 / 16 / 914', () => {
    expect(SDDC_MANAGER_SPEC).toEqual({ cores: 4, ramGB: 16, diskGB: 914 })
  })
  it('Fleet Manager → 4 / 12 / 194', () => {
    expect(FLEET_MANAGER_SPEC).toEqual({ cores: 4, ramGB: 12, diskGB: 194 })
  })
})

describe('Validated solution specs', () => {
  it('Site Protection / SRM Standard → 8 / 24 / 800', () => {
    expect(VALIDATED_SOLUTIONS_SPECS.siteProtection.standard).toEqual({ cores: 8, ramGB: 24, diskGB: 800 })
  })
  it('Site Protection / SRM Light → 2 / 8 / 20', () => {
    expect(VALIDATED_SOLUTIONS_SPECS.siteProtection.light).toEqual({ cores: 2, ramGB: 8, diskGB: 20 })
  })
  it('Ransomware Recovery (on-prem) → 24 / 800 (HVM)', () => {
    expect(VALIDATED_SOLUTIONS_SPECS.ransomwareOnPrem).toEqual({ cores: 24, ramGB: 800, diskGB: 0 })
  })
  it('Cloud Ransomware Connector → 8 / 12 / 100', () => {
    expect(VALIDATED_SOLUTIONS_SPECS.ransomwareCloud).toEqual({ cores: 8, ramGB: 12, diskGB: 100 })
  })
  it('HCX Connector → 4 / 12 / 65', () => {
    expect(VALIDATED_SOLUTIONS_SPECS.crossCloudMobility).toEqual({ cores: 4, ramGB: 12, diskGB: 65 })
  })
})

describe('getApplianceSpec — invalid lookups', () => {
  it('throws on unknown category', () => {
    // @ts-expect-error testing runtime safety
    expect(() => getApplianceSpec('bogus', 'medium')).toThrow(/unknown mgmt appliance/i)
  })
  it('throws on unknown size for known category', () => {
    // @ts-expect-error testing runtime safety
    expect(() => getApplianceSpec('vcenter', 'humongous')).toThrow(/unknown size/i)
  })
})
```

- [ ] **Step 2: Run the tests — confirm they fail**

Run: `npx vitest run src/engine/mgmt/constants.test.ts`
Expected: FAIL with "Cannot find module './constants'" or similar — file doesn't exist yet.

- [ ] **Step 3: Implement `src/engine/mgmt/constants.ts`**

```ts
// VCF 9.x Management Domain — Frozen sizing tables
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// All values sourced from VMware's VCF 9.0 Planning and Preparation Workbook,
// "Static Reference Tables" sheet, rows 8–267 (current as of 2026-04-28).
// Reference: docs/vcf-9.0-planning-and-preparation-workbook.xlsx
//
// DO NOT mutate these objects at runtime — they're frozen via `as const` and
// asserted-frozen in tests.

import type { ApplianceSpec, MgmtApplianceCategory } from './types'

// ─── Sized appliance tables ───────────────────────────────────────────────

const VCENTER: Record<string, ApplianceSpec> = {
  tiny:   { cores: 2,  ramGB: 14, diskGB: 579 },
  small:  { cores: 4,  ramGB: 21, diskGB: 694 },
  medium: { cores: 8,  ramGB: 30, diskGB: 908 },
  large:  { cores: 16, ramGB: 39, diskGB: 1358 },
  xlarge: { cores: 24, ramGB: 58, diskGB: 2283 },
}

const NSX_MANAGER: Record<string, ApplianceSpec> = {
  medium: { cores: 6,  ramGB: 24, diskGB: 300 },
  large:  { cores: 12, ramGB: 48, diskGB: 300 },
  xlarge: { cores: 24, ramGB: 96, diskGB: 400 },
}

const NSX_EDGE: Record<string, ApplianceSpec> = {
  small:  { cores: 2,  ramGB: 4,  diskGB: 200 },
  medium: { cores: 4,  ramGB: 8,  diskGB: 200 },
  large:  { cores: 8,  ramGB: 32, diskGB: 200 },
  xlarge: { cores: 16, ramGB: 64, diskGB: 200 },
}

const AVI_LB: Record<string, ApplianceSpec> = {
  small:  { cores: 6,  ramGB: 32, diskGB: 512 },
  large:  { cores: 16, ramGB: 48, diskGB: 1400 },
  xlarge: { cores: 16, ramGB: 64, diskGB: 1750 },
}

const VROPS: Record<string, ApplianceSpec> = {
  small:  { cores: 4,  ramGB: 16, diskGB: 274 },
  medium: { cores: 8,  ramGB: 32, diskGB: 274 },
  large:  { cores: 16, ramGB: 48, diskGB: 274 },
  xlarge: { cores: 24, ramGB: 128, diskGB: 274 },
}

const VROPS_COLLECTOR: Record<string, ApplianceSpec> = {
  small:    { cores: 4, ramGB: 16, diskGB: 264 },
  standard: { cores: 8, ramGB: 48, diskGB: 264 },
}

const VRLI: Record<string, ApplianceSpec> = {
  small:  { cores: 4,  ramGB: 8,  diskGB: 530 },
  medium: { cores: 8,  ramGB: 16, diskGB: 530 },
  large:  { cores: 16, ramGB: 32, diskGB: 530 },
}

const VRNI: Record<string, ApplianceSpec> = {
  small:  { cores: 4,  ramGB: 16, diskGB: 1024 },
  medium: { cores: 8,  ramGB: 32, diskGB: 1024 },
  large:  { cores: 12, ramGB: 48, diskGB: 1024 },
  xlarge: { cores: 16, ramGB: 64, diskGB: 1024 },
}

const VRNI_COLLECTOR: Record<string, ApplianceSpec> = {
  small:  { cores: 2, ramGB: 4,  diskGB: 250 },
  medium: { cores: 4, ramGB: 12, diskGB: 250 },
  large:  { cores: 8, ramGB: 16, diskGB: 250 },
}

const AUTOMATION: Record<string, ApplianceSpec> = {
  small:  { cores: 24, ramGB: 96,  diskGB: 455 },
  medium: { cores: 24, ramGB: 96,  diskGB: 334 },
  large:  { cores: 32, ramGB: 128, diskGB: 430 },
}

const IDENTITY_BROKER: Record<string, ApplianceSpec> = {
  small:    { cores: 8,  ramGB: 16, diskGB: 290 },
  medium:   { cores: 8,  ramGB: 16, diskGB: 220 },
  large:    { cores: 10, ramGB: 16, diskGB: 100 },
}

const SSP: Record<string, ApplianceSpec> = {
  medium: { cores: 112, ramGB: 414, diskGB: 4096 },
  large:  { cores: 160, ramGB: 606, diskGB: 5120 },
  xlarge: { cores: 192, ramGB: 734, diskGB: 6656 },
}

// ─── Always-on appliances (no size variants) ──────────────────────────────

export const SDDC_MANAGER_SPEC: ApplianceSpec = { cores: 4, ramGB: 16, diskGB: 914 }
export const FLEET_MANAGER_SPEC: ApplianceSpec = { cores: 4, ramGB: 12, diskGB: 194 }

// ─── Validated solution specs ─────────────────────────────────────────────

export const VALIDATED_SOLUTIONS_SPECS = {
  siteProtection: {
    light:    { cores: 2, ramGB: 8,  diskGB: 20  } as ApplianceSpec,
    standard: { cores: 8, ramGB: 24, diskGB: 800 } as ApplianceSpec,
  },
  // On-prem ransomware recovery is the HVM (Health/Validation Manager) appliance:
  // workbook lists 24 RAM / 800 disk (R196-R198 Static Reference Tables).
  ransomwareOnPrem:   { cores: 24, ramGB: 800, diskGB: 0 } as ApplianceSpec,
  ransomwareCloud:    { cores: 8,  ramGB: 12,  diskGB: 100 } as ApplianceSpec,
  crossCloudMobility: { cores: 4,  ramGB: 12,  diskGB: 65 } as ApplianceSpec,
} as const

// ─── Lookup ──────────────────────────────────────────────────────────────
//
// fleetManager is intentionally absent from TABLES — Fleet Manager has no
// size variants. Callers needing its spec should import FLEET_MANAGER_SPEC
// directly. Calling getApplianceSpec('fleetManager', ...) throws.

const TABLES: Partial<Record<MgmtApplianceCategory, Record<string, ApplianceSpec>>> = {
  vcenter: VCENTER,
  nsxManager: NSX_MANAGER,
  nsxEdge: NSX_EDGE,
  aviLb: AVI_LB,
  vrops: VROPS,
  vropsCollector: VROPS_COLLECTOR,
  vrli: VRLI,
  vrni: VRNI,
  vrniCollector: VRNI_COLLECTOR,
  automation: AUTOMATION,
  identityBroker: IDENTITY_BROKER,
  ssp: SSP,
}

/**
 * Look up the {cores, ramGB, diskGB} spec for a given (category, size).
 *
 * Throws on unknown category or unknown size — sizes vary per category
 * (NSX Edge has no `tiny`; vROps Collector uses `standard` not `medium`),
 * so the caller is responsible for passing a size valid for the category.
 *
 * Fleet Manager and SDDC Manager have no size variants; use the exported
 * FLEET_MANAGER_SPEC / SDDC_MANAGER_SPEC constants directly.
 */
export function getApplianceSpec(
  category: MgmtApplianceCategory,
  size: string,
): ApplianceSpec {
  const table = TABLES[category]
  if (!table) {
    throw new Error(`unknown mgmt appliance category: ${category}`)
  }
  const spec = table[size]
  if (!spec) {
    throw new Error(`unknown size '${size}' for mgmt appliance '${category}'`)
  }
  return spec
}
```

- [ ] **Step 4: Run the tests — confirm they pass**

Run: `npx vitest run src/engine/mgmt/constants.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Run the full suite — verify nothing broke**

Run: `npm run test`
Expected: all 297+ existing tests still pass; new constants tests added on top.

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: clean exit code 0.

- [ ] **Step 7: Commit**

```bash
git add src/engine/mgmt/constants.ts src/engine/mgmt/constants.test.ts
git commit -m "feat(mgmt): phase 1.2 — frozen sizing tables + getApplianceSpec()

VMware VCF 9.0 sizing tables for 13 user-overridable categories,
SDDC Manager and Fleet Manager (always-on), and 5 validated solutions.
getApplianceSpec(category, size) lookup with explicit throws on
invalid input. Values sourced from VMware's Static Reference Tables
sheet, rows 8–267.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md Appendix A"
```

---

## Task 3 — Create `src/engine/mgmt/profiles.ts` + tests

**Files:**
- Create: `src/engine/mgmt/profiles.ts`
- Create: `src/engine/mgmt/profiles.test.ts`

Three profiles (`lab` / `standard` / `large`) each map every category to a `ProfileEntry`. `resolveProfileEntry(profile, category)` is the lookup. Profile data comes from spec Appendix B.

- [ ] **Step 1: Write the failing test file `src/engine/mgmt/profiles.test.ts`**

```ts
/// <reference types="vitest/globals" />
import { resolveProfileEntry, PROFILES } from './profiles'

describe('resolveProfileEntry — Standard profile (Q4 default)', () => {
  it('vcenter → Medium × 1, included', () => {
    expect(resolveProfileEntry('standard', 'vcenter')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('nsxManager → Medium × 1 (HA fanout applied later by appliances.ts)', () => {
    expect(resolveProfileEntry('standard', 'nsxManager')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('nsxEdge → Large × 2, included (Q4: ON by default)', () => {
    expect(resolveProfileEntry('standard', 'nsxEdge')).toEqual({
      included: true, size: 'large', nodeCount: 2,
    })
  })
  it('aviLb → Small × 3, included (Q4: ON by default)', () => {
    expect(resolveProfileEntry('standard', 'aviLb')).toEqual({
      included: true, size: 'small', nodeCount: 3,
    })
  })
  it('vrops → Medium × 1, included (HA fanout later)', () => {
    expect(resolveProfileEntry('standard', 'vrops')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('vropsCollector → excluded by default (Standard profile)', () => {
    expect(resolveProfileEntry('standard', 'vropsCollector').included).toBe(false)
  })
  it('vrli → Medium × 1, included (Q4: ON; HA fanout later)', () => {
    expect(resolveProfileEntry('standard', 'vrli')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('vrni → Medium × 1, included (Q4: ON)', () => {
    expect(resolveProfileEntry('standard', 'vrni')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('vrniCollector → excluded by default (Standard profile)', () => {
    expect(resolveProfileEntry('standard', 'vrniCollector').included).toBe(false)
  })
  it('automation → Medium × 1, included (HA fanout later)', () => {
    expect(resolveProfileEntry('standard', 'automation')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('fleetManager → always included × 1', () => {
    expect(resolveProfileEntry('standard', 'fleetManager').included).toBe(true)
    expect(resolveProfileEntry('standard', 'fleetManager').nodeCount).toBe(1)
  })
  it('identityBroker → excluded by default (Q4: OFF)', () => {
    expect(resolveProfileEntry('standard', 'identityBroker').included).toBe(false)
  })
  it('ssp → excluded by default (Q4: OFF — opt-in only)', () => {
    expect(resolveProfileEntry('standard', 'ssp').included).toBe(false)
  })
})

describe('resolveProfileEntry — Lab profile', () => {
  it('vcenter → Small × 1', () => {
    expect(resolveProfileEntry('lab', 'vcenter')).toEqual({
      included: true, size: 'small', nodeCount: 1,
    })
  })
  it('nsxEdge → excluded (no edge in lab)', () => {
    expect(resolveProfileEntry('lab', 'nsxEdge').included).toBe(false)
  })
  it('aviLb → excluded (no LB in lab)', () => {
    expect(resolveProfileEntry('lab', 'aviLb').included).toBe(false)
  })
  it('vrli → excluded (no logging in lab)', () => {
    expect(resolveProfileEntry('lab', 'vrli').included).toBe(false)
  })
  it('vrni → excluded', () => {
    expect(resolveProfileEntry('lab', 'vrni').included).toBe(false)
  })
})

describe('resolveProfileEntry — Large profile', () => {
  it('vcenter → Large × 1', () => {
    expect(resolveProfileEntry('large', 'vcenter')).toEqual({
      included: true, size: 'large', nodeCount: 1,
    })
  })
  it('nsxEdge → XLarge × 2', () => {
    expect(resolveProfileEntry('large', 'nsxEdge')).toEqual({
      included: true, size: 'xlarge', nodeCount: 2,
    })
  })
  it('aviLb → Large × 3', () => {
    expect(resolveProfileEntry('large', 'aviLb')).toEqual({
      included: true, size: 'large', nodeCount: 3,
    })
  })
  it('vrops → Large × 1 (HA fanout later)', () => {
    expect(resolveProfileEntry('large', 'vrops')).toEqual({
      included: true, size: 'large', nodeCount: 1,
    })
  })
  it('vrniCollector → Medium × 1 (only enabled in Large)', () => {
    expect(resolveProfileEntry('large', 'vrniCollector')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('identityBroker → Medium × 1 (only enabled in Large)', () => {
    expect(resolveProfileEntry('large', 'identityBroker')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('ssp → still excluded (always opt-in regardless of profile)', () => {
    expect(resolveProfileEntry('large', 'ssp').included).toBe(false)
  })
})

describe('PROFILES table integrity', () => {
  it('every profile has an entry for every category', () => {
    const categories = [
      'vcenter','nsxManager','nsxEdge','aviLb','vrops','vropsCollector',
      'vrli','vrni','vrniCollector','automation','fleetManager',
      'identityBroker','ssp',
    ] as const
    for (const profile of ['lab','standard','large'] as const) {
      for (const cat of categories) {
        const entry = PROFILES[profile][cat]
        expect(entry, `${profile} missing ${cat}`).toBeDefined()
        expect(typeof entry.included).toBe('boolean')
        expect(typeof entry.size).toBe('string')
        expect(typeof entry.nodeCount).toBe('number')
      }
    }
  })
})
```

- [ ] **Step 2: Run the tests — confirm they fail**

Run: `npx vitest run src/engine/mgmt/profiles.test.ts`
Expected: FAIL with "Cannot find module './profiles'".

- [ ] **Step 3: Implement `src/engine/mgmt/profiles.ts`**

```ts
// VCF 9.x Management Domain — Profile preset mappings
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md
//   Q4 (Standard defaults) and Appendix B (full preset table).
//
// Note on nodeCount: profiles always set nodeCount=1 for components that
// fan out under HA (NSX Manager, vROps, VCF Automation, vRLI). The HA
// fan-out (×3) is applied later in `appliances.ts` (P2) based on the
// resolved deployment mode. Edge nodeCount=2 is hard-coded here because
// the pair count is independent of HA topology.

import type { MgmtProfile, MgmtApplianceCategory, ProfileEntry } from './types'

type ProfileMap = Record<MgmtApplianceCategory, ProfileEntry>

const LAB: ProfileMap = {
  vcenter:        { included: true,  size: 'small',  nodeCount: 1 },
  nsxManager:     { included: true,  size: 'small',  nodeCount: 1 },
  nsxEdge:        { included: false, size: 'small',  nodeCount: 2 },
  aviLb:          { included: false, size: 'small',  nodeCount: 3 },
  vrops:          { included: true,  size: 'small',  nodeCount: 1 },
  vropsCollector: { included: false, size: 'small',  nodeCount: 1 },
  vrli:           { included: false, size: 'small',  nodeCount: 1 },
  vrni:           { included: false, size: 'medium', nodeCount: 1 },
  vrniCollector:  { included: false, size: 'medium', nodeCount: 1 },
  automation:     { included: true,  size: 'small',  nodeCount: 1 },
  fleetManager:   { included: true,  size: 'medium', nodeCount: 1 },
  identityBroker: { included: false, size: 'medium', nodeCount: 1 },
  ssp:            { included: false, size: 'medium', nodeCount: 1 },
}

const STANDARD: ProfileMap = {
  vcenter:        { included: true,  size: 'medium', nodeCount: 1 },
  nsxManager:     { included: true,  size: 'medium', nodeCount: 1 },
  nsxEdge:        { included: true,  size: 'large',  nodeCount: 2 },
  aviLb:          { included: true,  size: 'small',  nodeCount: 3 },
  vrops:          { included: true,  size: 'medium', nodeCount: 1 },
  vropsCollector: { included: false, size: 'standard', nodeCount: 1 },
  vrli:           { included: true,  size: 'medium', nodeCount: 1 },
  vrni:           { included: true,  size: 'medium', nodeCount: 1 },
  vrniCollector:  { included: false, size: 'medium', nodeCount: 1 },
  automation:     { included: true,  size: 'medium', nodeCount: 1 },
  fleetManager:   { included: true,  size: 'medium', nodeCount: 1 },
  identityBroker: { included: false, size: 'medium', nodeCount: 1 },
  ssp:            { included: false, size: 'medium', nodeCount: 1 },
}

const LARGE: ProfileMap = {
  vcenter:        { included: true,  size: 'large',  nodeCount: 1 },
  nsxManager:     { included: true,  size: 'large',  nodeCount: 1 },
  nsxEdge:        { included: true,  size: 'xlarge', nodeCount: 2 },
  aviLb:          { included: true,  size: 'large',  nodeCount: 3 },
  vrops:          { included: true,  size: 'large',  nodeCount: 1 },
  vropsCollector: { included: true,  size: 'standard', nodeCount: 1 },
  vrli:           { included: true,  size: 'large',  nodeCount: 1 },
  vrni:           { included: true,  size: 'medium', nodeCount: 1 },
  vrniCollector:  { included: true,  size: 'medium', nodeCount: 1 },
  automation:     { included: true,  size: 'large',  nodeCount: 1 },
  fleetManager:   { included: true,  size: 'medium', nodeCount: 1 },
  identityBroker: { included: true,  size: 'medium', nodeCount: 1 },
  ssp:            { included: false, size: 'medium', nodeCount: 1 },
}

export const PROFILES: Record<MgmtProfile, ProfileMap> = {
  lab: LAB,
  standard: STANDARD,
  large: LARGE,
}

/**
 * Resolve the per-category default ProfileEntry for a given profile.
 *
 * The result is the *base* default — overrides are merged on top by the
 * appliance resolver in P2, and HA-fanout (×3 for NSX Mgr, vROps, etc.)
 * is also applied there.
 */
export function resolveProfileEntry(
  profile: MgmtProfile,
  category: MgmtApplianceCategory,
): ProfileEntry {
  return PROFILES[profile][category]
}
```

- [ ] **Step 4: Run the tests — confirm they pass**

Run: `npx vitest run src/engine/mgmt/profiles.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Run the full suite — verify nothing broke**

Run: `npm run test`
Expected: all existing tests still pass; new profile tests added.

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: clean exit code 0.

- [ ] **Step 7: Commit**

```bash
git add src/engine/mgmt/profiles.ts src/engine/mgmt/profiles.test.ts
git commit -m "feat(mgmt): phase 1.3 — Lab/Standard/Large profile presets

PROFILES table maps each profile to per-category ProfileEntry
(included/size/nodeCount). resolveProfileEntry(profile, category)
provides the lookup. Standard profile defaults match Q4: ON for
{NSX Edge, AVI LB, vRLI, vRNI}; OFF for {Identity Broker, SSP,
validated solutions}. NSX Mgr/vROps/Auto/vRLI nodeCount stays at 1
in profiles — HA fanout (×3) applied in P2's appliance resolver.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md Appendix B"
```

---

## Task 4 — Create `src/engine/mgmt/index.ts` barrel re-export

**Files:**
- Create: `src/engine/mgmt/index.ts`

A clean public surface for downstream phases (P2 onward). No new behavior; just re-exports. No tests beyond the existing ones (the barrel imports are exercised transitively).

- [ ] **Step 1: Create `src/engine/mgmt/index.ts`**

```ts
// VCF 9.x Management Domain — public barrel
// P1 surface: types + sizing tables + profiles only.
// P2 will append calcManagement() and the calc pipeline.

export type {
  MgmtProfile,
  ApplianceSize,
  NsxEdgeSize,
  SspSize,
  SrmSize,
  CollectorSize,
  AnyApplianceSize,
  MgmtApplianceCategory,
  ApplianceSpec,
  ProfileEntry,
  ApplianceOverride,
  ValidatedSolutionsConfig,
  ManagementDomainConfig,
  ApplianceLine,
  MgmtDomainResult,
} from './types'

export {
  getApplianceSpec,
  SDDC_MANAGER_SPEC,
  FLEET_MANAGER_SPEC,
  VALIDATED_SOLUTIONS_SPECS,
} from './constants'

export {
  PROFILES,
  resolveProfileEntry,
} from './profiles'
```

- [ ] **Step 2: Type-check the barrel**

Run: `npm run type-check`
Expected: clean exit code 0.

- [ ] **Step 3: Run the full suite — verify nothing broke**

Run: `npm run test`
Expected: all tests pass — the barrel doesn't change any existing behavior.

- [ ] **Step 4: Commit**

```bash
git add src/engine/mgmt/index.ts
git commit -m "feat(mgmt): phase 1.4 — public barrel re-export

src/engine/mgmt/index.ts exposes types + getApplianceSpec +
profile helpers as the stable surface for P2 callers.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §3"
```

---

## Phase 1 — Acceptance criteria

After all 4 tasks are complete:

- `src/engine/mgmt/{types,constants,profiles,index}.ts` exist.
- `src/engine/mgmt/{constants,profiles}.test.ts` exist; the rest of the project's test count grew by ~70 tests (constants ~50, profiles ~25).
- `npm run test` is green.
- `npm run type-check` is clean.
- `npm run build` succeeds (Vite production build still passes).
- Git log shows 4 atomic commits, one per task.
- **No callsites changed** — `inputStore`, `calculationStore`, components, and `src/engine/management.ts` are byte-identical to before.

This phase produces no user-visible change and unblocks **P2 (calculation pipeline + shim)**.

---

## Notes for the implementer

- `Decimal.js` is unused this phase — no arithmetic happens until P2.
- File-size targets: every file < 200 lines. `constants.ts` will be ~150 lines (acceptable; pure data).
- If `npm run type-check` complains about an import path, double-check the relative path — `src/engine/mgmt/types.ts` imports from `'../types'` (one level up), not `'./types'`.
- When debugging a failing test, prefer `npx vitest run <single-file>` over `npm run test` — much faster feedback loop.
- Do NOT modify `src/engine/management.ts` in this phase. That's P2's responsibility.
