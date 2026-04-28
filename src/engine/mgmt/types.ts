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
