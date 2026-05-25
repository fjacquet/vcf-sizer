// VCF 9.1 Workload Sizing — orchestrator (mirrors mgmt/calcManagementFull)
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// Demand-driven pipeline: per-site demand → storage-driven host floor → cluster split
// (HA reserve + VMware cap) → capacity/reconciliation → utilization → stretch → validation.

import Decimal from 'decimal.js'
import { calcWorkloadDemand } from './demand'
import { splitIntoClusters } from './clusters'
import { calcWorkloadCapacity } from './capacity'
import { validateWorkload } from './validation'
import { MIN_HOSTS_PER_CLUSTER } from './constants'
import { calcMinHostsForVsanEsa } from '../storage'
import { calcStretch } from '../stretch'
import { calcVsanMax } from '../vsanMax'
import { calcWorkloadStorageTiB } from '../shared'
import type { WorkloadFullInputs, WorkloadDomainResult } from './types'

function pct(part: number, whole: number): number {
  return whole > 0 ? new Decimal(part).dividedBy(whole).times(100).toNumber() : 0
}

export function calcWorkloadFull(inputs: WorkloadFullInputs): WorkloadDomainResult {
  // 1. Per-site compute/RAM demand (no stretch ×2 here).
  const demand = calcWorkloadDemand({
    vmCount: inputs.vmCount,
    avgVcpuPerVm: inputs.avgVcpuPerVm,
    avgVramGbPerVm: inputs.avgVramGbPerVm,
    cpuOvercommitRatio: inputs.cpuOvercommitRatio,
    ramOvercommitRatio: inputs.ramOvercommitRatio,
    gpuVmCount: inputs.gpuVmCount,
    vgpuMemoryGB: inputs.vgpuMemoryGB,
    nvmeTieringEnabled: inputs.nvmeTieringEnabled,
    activeMemoryPct: inputs.activeMemoryPct,
    coresPerSocket: inputs.coresPerSocket,
    socketsPerHost: inputs.socketsPerHost,
    hostRamGB: inputs.hostRamGB,
    mgmtCores: inputs.mgmtCores,
    mgmtRamGB: inputs.mgmtRamGB,
  })

  // 2. Storage-driven per-site host minimum (vSAN ESA only). Computed PER SITE
  //    ('simple' → no cross-site halving); the topology doubling happens in step 4.
  const perSiteWorkloadStorageTiB = calcWorkloadStorageTiB(inputs.vmCount, inputs.avgStorageGbPerVm)
  const minHostsForStorage =
    inputs.storageType === 'vsan-esa'
      ? calcMinHostsForVsanEsa(
          inputs.hostStorageTiB,
          inputs.fttLevel,
          inputs.raidType,
          inputs.dedupEnabled,
          inputs.dedupRatio,
          'simple',
          perSiteWorkloadStorageTiB,
        )
      : 0

  // 3. Per-site host demand (compute, RAM, storage, cluster floor).
  const demandHostsPerSite = Math.max(
    demand.minHostsForCpu,
    demand.minHostsForRam,
    minHostsForStorage,
    MIN_HOSTS_PER_CLUSTER,
  )

  // 4. HA reserve + multi-cluster auto-split at the VMware maximum.
  const split = splitIntoClusters({
    demandHostsPerSite,
    deploymentMode: inputs.deploymentMode,
    storageType: inputs.storageType,
    hostFailuresToTolerate: inputs.hostFailuresToTolerate,
  })

  // 5. Capacity + FC/NFS reconciliation at the provisioned size.
  const storage = calcWorkloadCapacity({
    storageType: inputs.storageType,
    hostStorageTiB: inputs.hostStorageTiB,
    hostsPerSite: split.hostsPerSite,
    clusterCountPerSite: split.clusterCountPerSite,
    deploymentMode: inputs.deploymentMode,
    fttLevel: inputs.fttLevel,
    raidType: inputs.raidType,
    dedupEnabled: inputs.dedupEnabled,
    dedupRatio: inputs.dedupRatio,
    vmCount: inputs.vmCount,
    avgStorageGbPerVm: inputs.avgStorageGbPerVm,
    externalStorageUsableTiB: inputs.externalStorageUsableTiB,
  })

  // 6. Physical capacity & utilization at the PROVISIONED host count (per site).
  const provisionedCores = new Decimal(split.hostsPerSite).times(demand.coresPerHost).toNumber()
  const provisionedRamGB = new Decimal(split.hostsPerSite).times(demand.effRamPerHost).toNumber()

  // 7. Stretch metadata (witness, bandwidth, network checklist).
  const stretch =
    inputs.deploymentMode === 'stretch'
      ? calcStretch({
          hostsPerSite: split.hostsPerSite,
          vmCount: inputs.vmCount,
          avgStorageGbPerVm: inputs.avgStorageGbPerVm,
          storageType: inputs.storageType,
        })
      : null

  // 8. vSAN Max storage cluster (separate from compute nodes).
  const vsanMax =
    inputs.storageType === 'vsan-max'
      ? calcVsanMax({
          profile: inputs.vsanMaxProfile,
          storageNodeCount: inputs.vsanMaxStorageNodes,
          computeNodeCount: split.totalHosts,
        })
      : null

  return {
    id: inputs.id,
    name: inputs.name,
    deploymentMode: inputs.deploymentMode,

    siteCoresRequired: demand.siteCoresRequired,
    siteRamRequiredGB: demand.siteRamRequiredGB,
    minHostsForCpu: demand.minHostsForCpu,
    minHostsForRam: demand.minHostsForRam,
    minHostsForStorage,
    demandHostsPerSite,

    hostsPerCluster: split.hostsPerCluster,
    clusterCountPerSite: split.clusterCountPerSite,
    hostsPerSite: split.hostsPerSite,
    totalHosts: split.totalHosts,
    clusters: split.clusters,
    exceedsSingleCluster: split.exceedsSingleCluster,

    provisionedCores,
    provisionedRamGB,
    coreUtilizationPct: pct(demand.siteCoresRequired, provisionedCores),
    ramUtilizationPct: pct(demand.siteRamRequiredGB, provisionedRamGB),

    storage,
    stretch,
    vsanMax,
    validationErrors: validateWorkload(storage, split),
  }
}

// Public surface
export { calcWorkloadDemand } from './demand'
export { splitIntoClusters } from './clusters'
export { calcWorkloadCapacity } from './capacity'
export { validateWorkload } from './validation'
export * from './constants'
export type * from './types'
