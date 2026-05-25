// VCF 9.1 Workload Sizing — type definitions
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// Demand-driven model: host counts, cluster counts and capacity are OUTPUTS.
// The building-block host spec + deploymentMode + hostFailuresToTolerate are INPUTS.

import type {
  DeploymentMode,
  StorageType,
  FttLevel,
  RaidType,
  VsanMaxProfile,
  ValidationWarning,
  StretchResult,
  VsanMaxResult,
} from '../types'

// ─── Demand (per site) ──────────────────────────────────────────────────────

export interface WorkloadDemandInputs {
  vmCount: number
  avgVcpuPerVm: number
  avgVramGbPerVm: number
  cpuOvercommitRatio: number
  ramOvercommitRatio: number
  gpuVmCount: number
  vgpuMemoryGB: number
  nvmeTieringEnabled: boolean
  activeMemoryPct: number
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  // Colocated management overhead added to THIS site (0 for dedicated / non-WLD-1)
  mgmtCores: number
  mgmtRamGB: number
}

export interface WorkloadDemand {
  coresPerHost: number
  effRamPerHost: number          // hostRamGB, halved when NVMe tiering active
  siteCoresRequired: number      // physical cores per site (post-overcommit)
  siteRamRequiredGB: number
  minHostsForCpu: number
  minHostsForRam: number
}

// ─── Cluster split ────────────────────────────────────────────────────────────

export type ClusterSite = 'single' | 'preferred' | 'secondary'

export interface ClusterBreakdown {
  index: number
  site: ClusterSite
  demandHosts: number
  haReserveHosts: number
  totalHosts: number
}

export interface ClusterSplitInputs {
  demandHostsPerSite: number
  deploymentMode: DeploymentMode
  storageType: StorageType
  hostFailuresToTolerate: number
}

export interface ClusterSplitResult {
  maxHostsPerCluster: number
  clusterCountPerSite: number
  hostsPerCluster: number
  demandHostsPerSite: number
  hostsPerSite: number           // hostsPerCluster × clusterCountPerSite
  totalHosts: number             // ×2 for stretch
  clusters: ClusterBreakdown[]
  exceedsSingleCluster: boolean
}

// ─── Capacity ─────────────────────────────────────────────────────────────────

export interface WorkloadCapacityInputs {
  storageType: StorageType
  hostStorageTiB: number
  hostsPerSite: number
  clusterCountPerSite: number
  deploymentMode: DeploymentMode
  fttLevel: FttLevel
  raidType: RaidType
  dedupEnabled: boolean
  dedupRatio: number
  vmCount: number
  avgStorageGbPerVm: number
  externalStorageUsableTiB?: number
}

export interface WorkloadCapacityResult {
  storageType: StorageType
  // vSAN ESA overhead stack (0 for external / vSAN Max passthrough)
  rawCapacityTiB: number
  raidMultiplier: number
  usableAfterRaidTiB: number
  lfsOverheadTiB: number
  metadataOverheadTiB: number
  effectiveCapacityTiB: number
  safeUsableCapacityTiB: number
  raidScheme: string
  // Demand + FC/NFS reconciliation
  workloadStorageRequiredTiB: number   // total VM storage demand
  requiredPoolTiB: number              // per-site for stretch external; else total demand
  availablePoolTiB: number             // external pool capacity (0 when vSAN)
  poolShortfallTiB: number             // max(0, required − available)
  poolSufficient: boolean
}

// ─── Per-domain result ──────────────────────────────────────────────────────

export interface WorkloadDomainResult {
  id: string
  name: string
  deploymentMode: DeploymentMode

  // Demand (per site)
  siteCoresRequired: number
  siteRamRequiredGB: number
  minHostsForCpu: number
  minHostsForRam: number
  minHostsForStorage: number
  demandHostsPerSite: number

  // Provisioned (post HA reserve + cluster split)
  hostsPerCluster: number
  clusterCountPerSite: number
  hostsPerSite: number
  totalHosts: number
  clusters: ClusterBreakdown[]
  exceedsSingleCluster: boolean

  // Physical capacity at the provisioned size (honestly labeled — physical cores)
  provisionedCores: number
  provisionedRamGB: number
  coreUtilizationPct: number
  ramUtilizationPct: number

  storage: WorkloadCapacityResult
  stretch: StretchResult | null
  vsanMax: VsanMaxResult | null
  validationErrors: ValidationWarning[]
}

// ─── Orchestrator input ────────────────────────────────────────────────────
// Decoupled from WorkloadDomainConfig so the engine stays stable across the
// store/data-model migration. The store maps config → these fields.

export interface WorkloadFullInputs {
  id: string
  name: string
  deploymentMode: DeploymentMode
  // Building-block host (user input)
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTiB: number
  // Workload profile
  vmCount: number
  avgVcpuPerVm: number
  avgVramGbPerVm: number
  avgStorageGbPerVm: number
  cpuOvercommitRatio: number
  ramOvercommitRatio: number
  gpuVmCount: number
  vgpuMemoryGB: number
  nvmeTieringEnabled: boolean
  activeMemoryPct: number
  // Storage
  storageType: StorageType
  fttLevel: FttLevel
  raidType: RaidType
  dedupEnabled: boolean
  dedupRatio: number
  externalStorageUsableTiB?: number
  vsanMaxProfile: VsanMaxProfile
  vsanMaxStorageNodes: number
  // Failover (HA) reserve hosts per cluster — N+1 default
  hostFailuresToTolerate: number
  // Colocated management overhead added to THIS domain's per-site demand (0 otherwise)
  mgmtCores: number
  mgmtRamGB: number
}
