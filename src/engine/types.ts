// VCF 9.x Calculation Engine — Type Definitions
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)

export type DeploymentMode = 'simple' | 'ha' | 'stretch'
export type StorageType = 'vsan-esa' | 'fc' | 'nfs' | 'vsan-max'
export type VsanMaxProfile = 'xs' | 'sm' | 'med' | 'lrg' | 'xl'
export type RaidType = 'raid1' | 'raid5' | 'raid6'
export type FttLevel = 1 | 2
export type ManagementArchitecture = 'shared' | 'dedicated'

export interface ValidationWarning {
  code: string
  severity: 'error' | 'warning'
  messageKey: string // i18n key, NOT an English string
}

export interface MgmtDomainResult {
  vcenterCores: number
  vcenterRamGB: number
  sddcCores: number
  sddcRamGB: number
  nsxCores: number
  nsxRamGB: number
  opsCores: number
  opsRamGB: number
  automationCores: number
  automationRamGB: number
  totalCores: number
  totalRamGB: number
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
}

export interface StretchInputs {
  preferredSiteHosts: number
  secondarySiteHosts: number
  hostStorageTB: number
  vmCount: number
  avgStorageGbPerVm: number
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
  witnessCores: number       // 4 (ESA M profile — ESA does not support Tiny/2vCPU)
  witnessRamGB: number       // 16 (ESA M profile)
  minBandwidthGbps: number   // max(totalWorkloadStorageTB × 0.1, STRETCH_MIN_BANDWIDTH_GBPS)
  effectivePerSiteStorageTB: number
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
  recommendedHostCount: number
}

export interface StorageInputs {
  storageType: StorageType
  hostCount: number
  hostStorageTB: number
  fttLevel: FttLevel
  raidType: RaidType
  dedupEnabled: boolean
  dedupRatio: number
  deploymentMode?: DeploymentMode  // default 'simple'; 'stretch' halves effective usable (PFTT=1)
}

export interface StorageResult {
  rawCapacityTB: number
  raidMultiplier: number
  usableAfterRaidTB: number
  lfsOverheadTB: number
  metadataOverheadTB: number
  usableBeforeDedupTB: number
  effectiveCapacityTB: number
  safeUsableCapacityTB: number
  raidScheme: string
  minHostsRequired: number
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
  managementArchitecture?: ManagementArchitecture  // default 'shared'
  networkSpeedGbE?: 10 | 25 | 100   // default 25
  vsanMaxStorageNodes?: number      // default 4
}

export interface VsanMaxInputs {
  profile: VsanMaxProfile
  storageNodeCount: number
  computeNodeCount: number
}

export interface VsanMaxResult {
  rawCapacityTB: number
  usableCapacityTB: number
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
  hostStorageTB: number
  hostCount: number
  nvmeTieringEnabled: boolean
  activeMemoryPct: number
  preferredSiteHosts: number
  secondarySiteHosts: number
  vmCount: number
  avgVcpuPerVm: number
  avgVramGbPerVm: number
  avgStorageGbPerVm: number
  cpuOvercommitRatio: number
  ramOvercommitRatio: number
  gpuVmCount: number
  vgpuMemoryGB: number
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

export interface ManagementDomainConfig {
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTB: number
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
  totalRecommendedHosts: number
  totalVmCount: number
  totalRawStorageTB: number
  totalEffectiveStorageTB: number
  allValidationErrors: ValidationWarning[]
}
