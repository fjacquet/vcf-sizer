// VCF 9.x Calculation Engine — Type Definitions
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)

export type DeploymentMode = 'simple' | 'ha' | 'stretch'
export type StorageType = 'vsan-esa' | 'fc' | 'nfs'
export type RaidType = 'raid1' | 'raid5' | 'raid6'
export type FttLevel = 1 | 2

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
}
