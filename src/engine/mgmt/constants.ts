// VCF 9.x Management Domain — Frozen sizing tables
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// All values sourced from VMware's VCF 9.0 Planning and Preparation Workbook,
// "Static Reference Tables" sheet, rows 8–267 (current as of 2026-04-28).
// Reference: docs/vcf-9.0-planning-and-preparation-workbook.xlsx

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
  // On-prem ransomware recovery is the HVM (Health/Validation Manager) appliance.
  // Workbook rows R196–R198 (Static Reference Tables): 24 cores / 800 GB RAM /
  // no fixed disk allocation (storage sized dynamically via the protected workload).
  // diskGB is 0 by design — not a TODO.
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
  if (category === 'fleetManager') {
    throw new Error(`fleetManager has no size variants — import FLEET_MANAGER_SPEC directly`)
  }
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
