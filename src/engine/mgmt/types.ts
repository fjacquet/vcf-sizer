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

// Categories that may appear in ApplianceLine but are NOT user-overridable.
// Includes SDDC Manager (always-on) and the validated-solution outputs.
export type AutoApplianceCategory =
  | 'sddcManager'
  | 'siteRecovery'        // from validatedSolutions.siteProtection
  | 'ransomwareOnPrem'
  | 'ransomwareCloud'
  | 'crossCloudMobility'
  | 'wldVcenter'          // auto-derived per workload domain
  | 'wldNsxManager'       // auto-derived per workload domain

// Full category set permitted on an ApplianceLine.
export type ApplianceLineCategory = MgmtApplianceCategory | AutoApplianceCategory

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
  siteProtection: { included: boolean; mgmtSize?: SrmSize }
  ransomwareOnPrem: { included: boolean }
  ransomwareCloud: { included: boolean }
  crossCloudMobility: { included: boolean }
}

// ─── Public config + result shapes (placeholders for P2 to fill in) ───────
// Defined here so types.ts is the single source of truth.

export interface ManagementDomainConfig {
  // Hardware (required)
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTiB: number
  deploymentMode: DeploymentMode
  storageType?: StorageType            // optional for backward compat with old callers

  // FC/NFS-only
  externalStorageUsableTiB?: number

  // vSAN-Max-for-mgmt only
  vsanMaxStorageNodes?: number
  vsanMaxProfile?: VsanMaxProfile

  // Capacity headroom — defaults applied by engine when absent
  cpuOversubscription?: number         // default 2
  ramOversubscription?: number         // default 1
  reservePct?: number                  // default 30
  growthPct?: number                   // default 10

  // Sizing UX
  profile?: MgmtProfile                // default 'standard'

  overrides?: Partial<Record<MgmtApplianceCategory, ApplianceOverride>>

  validatedSolutions?: ValidatedSolutionsConfig
}

export interface ApplianceLine {
  category: ApplianceLineCategory
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
  // ─── New (canonical) fields — populated by the P2 calc pipeline ────────
  appliances: ApplianceLine[]
  wldOverhead: ApplianceLine[]

  totalCores: number          // sum of all appliance cores (canonical)
  totalRamGB: number          // sum of all appliance RAM (canonical)
  totalDiskGB: number         // sum of all appliance disk
  totalSwapGB: number         // = totalRamGB; mgmt VM swap demand

  perHostCores: number        // ROUNDUP(totalCores / (hosts−1) / cpuOversub)
  perHostRamGB: number
  perHostStorageGB: number    // 0 for FC/NFS (no local storage)

  storageDemandTiB: number             // demand after FTT × reserve × growth
  minHostsForStorage: number           // ceil(demand / usable-per-host) for vSAN; 0 for FC/NFS
  externalPoolRequiredTiB: number      // FC/NFS demand the array must provide; 0 for vSAN

  recommendedHostCount: number

  validationWarnings: ValidationWarning[]

  // ─── Legacy flat fields (DEPRECATED) ───────────────────────────────────
  // Retained for backward compatibility during the P2/P3 migration.
  // Once usePptxExport.ts and other callers consume `appliances[]`,
  // these can be removed.

  /** @deprecated Use `appliances` filtered by category 'vcenter' */
  vcenterCores?: number
  /** @deprecated Use `appliances` filtered by category 'vcenter' */
  vcenterRamGB?: number
  /** @deprecated Use `appliances` filtered by category 'sddcManager' */
  sddcCores?: number
  /** @deprecated Use `appliances` filtered by category 'sddcManager' */
  sddcRamGB?: number
  /** @deprecated Use `appliances` filtered by category 'nsxManager' */
  nsxCores?: number
  /** @deprecated Use `appliances` filtered by category 'nsxManager' */
  nsxRamGB?: number
  /** @deprecated Use `appliances` filtered by categories vrops/vropsCollector/fleetManager */
  opsCores?: number
  /** @deprecated Use `appliances` filtered by categories vrops/vropsCollector/fleetManager */
  opsRamGB?: number
  /** @deprecated Use `appliances` filtered by category 'automation' */
  automationCores?: number
  /** @deprecated Use `appliances` filtered by category 'automation' */
  automationRamGB?: number
}
