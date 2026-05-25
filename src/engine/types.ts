// VCF 9.x Calculation Engine — Type Definitions
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)

// Re-export canonical mgmt types from the mgmt subsystem so existing
// import paths (e.g., `from '../types'`, `from '@/engine/types'`) keep working.
export type { MgmtDomainResult, ManagementDomainConfig } from './mgmt/types'

// Re-export workload sizing result/types so consumers can import from '@/engine/types'.
export type {
  WorkloadDomainResult,
  WorkloadFullInputs,
  ClusterBreakdown,
  WorkloadCapacityResult,
} from './workload/types'

export type DeploymentMode = 'simple' | 'ha' | 'stretch'
export type StorageType = 'vsan-esa' | 'fc' | 'nfs' | 'vsan-max'
export type ManagementStorageType = Exclude<StorageType, 'vsan-max'>  // vsan-max not valid for management domain
export type VsanMaxProfile = 'xs' | 'sm' | 'med' | 'lrg' | 'xl'
export type RaidType = 'raid1' | 'raid5' | 'raid6'
export type FttLevel = 1 | 2
export type ManagementArchitecture = 'colocated' | 'dedicated'

export interface ValidationWarning {
  code: string
  severity: 'error' | 'warning'
  messageKey: string // i18n key, NOT an English string
}

export interface ComputeInputs {
  deploymentMode: DeploymentMode
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostCount: number
  vmCount: number
  avgVcpuPerVm: number
  avgVramGbPerVm: number
  cpuOvercommitRatio: number
  ramOvercommitRatio: number
  managementCores: number
  managementRamGB: number
  // Phase 3 additions (optional — all existing callers unaffected):
  nvmeTieringEnabled?: boolean   // default false
  activeMemoryPct?: number       // default 50
  gpuVmCount?: number            // default 0
  vgpuMemoryGB?: number          // default 16
  minHostsForStorage?: number    // default 0 — vSAN ESA storage-driven host minimum
}

export interface StretchInputs {
  hostsPerSite: number   // symmetric: both sites provisioned identically (demand-driven)
  vmCount: number
  avgStorageGbPerVm: number
  storageType: StorageType   // witness applies only to vSAN ESA stretched clusters
}

export interface StretchNetworkChecklist {
  minInterSiteBandwidthGbps: number
  maxInterSiteLatencyMs: number
  maxWitnessLatencyMs: number
  jumboFramesRequired: boolean
  witnessMinBandwidthMbps: number
}

export interface StretchResult {
  totalHosts: number
  requiresVsanWitness: boolean   // true only for vSAN ESA; FC/NFS stretch (vMSC) has no vSAN witness
  witnessCores: number       // 4 (ESA M profile) when vSAN ESA; 0 otherwise
  witnessRamGB: number       // 16 (ESA M profile) when vSAN ESA; 0 otherwise
  minBandwidthGbps: number   // max(totalWorkloadStorageTiB × 0.1, STRETCH_MIN_BANDWIDTH_GBPS)
  effectivePerSiteStorageTiB: number
  storageNote: string        // i18n key: 'deployment.stretch.storageNote'
  bandwidthFloorApplied: boolean
  networkChecklist: StretchNetworkChecklist
}

export interface ComputeResult {
  totalCoresRequired: number
  totalRamRequiredGB: number
  availableCores: number
  availableRamGB: number
  coreUtilizationPct: number
  ramUtilizationPct: number
  minHostsForCpu: number
  minHostsForRam: number
  minHostsForStorage: number  // vSAN ESA storage-driven minimum (0 for FC/NFS/vSAN Max)
  recommendedHostCount: number
  effectiveHostCount: number  // actual hostCount used for capacity calculations
}

export interface StorageInputs {
  storageType: StorageType
  hostCount: number
  hostStorageTiB: number
  externalStorageUsableTiB?: number
  fttLevel: FttLevel
  raidType: RaidType
  dedupEnabled: boolean
  dedupRatio: number
  deploymentMode?: DeploymentMode  // default 'simple'; 'stretch' halves effective usable (PFTT=1)
  vmCount?: number                 // FC/NFS: used to compute workload storage required
  avgStorageGbPerVm?: number       // FC/NFS: used to compute workload storage required
}

export interface StorageResult {
  rawCapacityTiB: number
  raidMultiplier: number
  usableAfterRaidTiB: number
  lfsOverheadTiB: number
  metadataOverheadTiB: number
  usableBeforeDedupTiB: number
  effectiveCapacityTiB: number
  safeUsableCapacityTiB: number
  raidScheme: string
  minHostsRequired: number
  workloadStorageRequiredTiB: number  // vmCount × avgStorageGbPerVm / 1024; 0 for vSAN types
}

export interface ValidationInputs {
  deploymentMode: DeploymentMode
  coresPerSocket: number
  socketsPerHost: number
  hostCount: number
  dedupEnabled: boolean
  storageType: StorageType
  preferredSiteHosts?: number   // default 3
  secondarySiteHosts?: number   // default 3
  managementArchitecture?: ManagementArchitecture  // default 'colocated'
  managementStorageType?: ManagementStorageType    // default 'vsan-esa' (ARCH-01)
  networkSpeedGbE?: 10 | 25 | 100   // default 25
  vsanMaxStorageNodes?: number      // default 4
}

export interface VsanMaxInputs {
  profile: VsanMaxProfile
  storageNodeCount: number
  computeNodeCount: number
}

export interface VsanMaxResult {
  rawCapacityTiB: number
  usableCapacityTiB: number
  raidScheme: string
  storageNodeCount: number
  computeNodeCount: number
  belowMinNodes: boolean
}

export interface WorkloadDomainConfig {
  id: string
  name: string
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTiB: number
  externalStorageUsableTiB: number
  nvmeTieringEnabled: boolean
  activeMemoryPct: number
  vmCount: number
  avgVcpuPerVm: number
  avgVramGbPerVm: number
  avgStorageGbPerVm: number
  cpuOvercommitRatio: number
  ramOvercommitRatio: number
  gpuVmCount: number
  vgpuMemoryGB: number
  // Failover (HA) reserve hosts per cluster — N+1 default. Demand-driven model:
  // host/cluster counts are OUTPUTS; this is the only host-side knob the user sets.
  hostFailuresToTolerate: number
  storageType: StorageType
  fttLevel: FttLevel
  raidType: RaidType
  dedupEnabled: boolean
  dedupRatio: number
  vsanMaxProfile: VsanMaxProfile
  vsanMaxStorageNodes: number
  networkSpeedGbE: 10 | 25 | 100
  deploymentMode: DeploymentMode
}

export interface DomainResult {
  id: string
  name: string
  compute: ComputeResult
  storage: StorageResult
  stretch: StretchResult | null
  vsanMax: VsanMaxResult | null
  validationErrors: ValidationWarning[]
}

export interface AggregateTotals {
  totalRecommendedHosts: number    // grand total = workload hosts (all clusters/sites) + management hosts
  mgmtHostCount: number            // management-only host count (0 when colocated)
  totalVmCount: number
  totalClusterCount: number        // total vSphere clusters across all domains + sites
  totalRawStorageTiB: number
  totalEffectiveStorageTiB: number
  totalWorkloadStorageRequiredTiB: number  // sum of VM storage demand across domains
  totalRequiredPoolTiB: number     // sum of FC/NFS required external pool (demand)
  totalPoolShortfallTiB: number    // sum of FC/NFS pool shortfall (0 when all pools sufficient)
  allValidationErrors: ValidationWarning[]
  // P5.5: per-site procurement counts when any domain is in stretch mode.
  // All four are undefined when no stretch domain exists.
  preferredSiteHosts?: number      // sum of (workload preferred + mgmt preferred) per stretched domain
  secondarySiteHosts?: number      // sum of (workload secondary + mgmt secondary) per stretched domain
  workloadPreferredSiteHosts?: number  // workload-only preferred-site hosts
  workloadSecondarySiteHosts?: number  // workload-only secondary-site hosts
  mgmtPreferredSiteHosts?: number      // mgmt-only preferred-site hosts (= recommendedHostCount when stretch)
  mgmtSecondarySiteHosts?: number      // mgmt-only secondary-site hosts (= recommendedHostCount when stretch)
}
