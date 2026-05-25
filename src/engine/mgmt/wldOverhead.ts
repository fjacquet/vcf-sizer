// VCF 9.x Management Domain — workload-domain overhead
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// Each workload domain contributes 1 vCenter + 1 NSX Manager cluster onto
// the management cluster. Sizes auto-derived from VMware's "Supported
// Limits" tables: vCenter sized by max(hostCount, vmCount); NSX Manager
// sized by hostCount. NSX Manager nodeCount = 1 in 'simple' mode, else 3.
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 step 2

import { getApplianceSpec } from './constants'
import { calcWorkloadDemand } from '../workload/demand'
import { MIN_HOSTS_PER_CLUSTER } from '../workload/constants'
import type { ApplianceLine, ApplianceSize } from './types'
import type { WorkloadDomainConfig } from '../types'

// Demand-driven model: host count is no longer a config field, it is an OUTPUT.
// vCenter/NSX appliance sizing still keys on a per-site host estimate, so we derive
// the per-site demand host count from the workload profile using the same pure
// demand helper the sizing engine uses (no sizing math is changed here).
function estimatePerSiteHosts(wld: WorkloadDomainConfig): number {
  const demand = calcWorkloadDemand({
    vmCount: wld.vmCount,
    avgVcpuPerVm: wld.avgVcpuPerVm,
    avgVramGbPerVm: wld.avgVramGbPerVm,
    cpuOvercommitRatio: wld.cpuOvercommitRatio,
    ramOvercommitRatio: wld.ramOvercommitRatio,
    gpuVmCount: wld.gpuVmCount,
    vgpuMemoryGB: wld.vgpuMemoryGB,
    nvmeTieringEnabled: wld.nvmeTieringEnabled,
    activeMemoryPct: wld.activeMemoryPct,
    coresPerSocket: wld.coresPerSocket,
    socketsPerHost: wld.socketsPerHost,
    hostRamGB: wld.hostRamGB,
    mgmtCores: 0,
    mgmtRamGB: 0,
  })
  return Math.max(demand.minHostsForCpu, demand.minHostsForRam, MIN_HOSTS_PER_CLUSTER)
}

interface VcenterSizeRow {
  maxHosts: number
  maxVms: number
  size: ApplianceSize
}

const VCENTER_LIMITS: readonly VcenterSizeRow[] = [
  { maxHosts: 10,    maxVms: 100,   size: 'tiny' },
  { maxHosts: 100,   maxVms: 1000,  size: 'small' },
  { maxHosts: 400,   maxVms: 4000,  size: 'medium' },
  { maxHosts: 1000,  maxVms: 10000, size: 'large' },
]

export function pickVcenterSize(vmCount: number, hostCount: number): ApplianceSize {
  for (const row of VCENTER_LIMITS) {
    if (hostCount <= row.maxHosts && vmCount <= row.maxVms) {
      return row.size
    }
  }
  return 'xlarge'
}

export function pickNsxSize(hostCount: number): ApplianceSize {
  if (hostCount <= 128) return 'medium'
  if (hostCount <= 1024) return 'large'
  return 'xlarge'
}

export function calcWldOverhead(wlds: readonly WorkloadDomainConfig[]): ApplianceLine[] {
  const lines: ApplianceLine[] = []

  for (const wld of wlds) {
    const perSiteHosts = estimatePerSiteHosts(wld)
    // vCenter: always nodeCount=1
    const vcSize = pickVcenterSize(wld.vmCount, perSiteHosts)
    const vcSpec = getApplianceSpec('vcenter', vcSize)
    lines.push({
      category: 'wldVcenter',
      nodeCount: 1,
      cores: vcSpec.cores,
      ramGB: vcSpec.ramGB,
      diskGB: vcSpec.diskGB,
      totalCores: vcSpec.cores,
      totalRamGB: vcSpec.ramGB,
      totalDiskGB: vcSpec.diskGB,
      source: 'auto-derived',
    })

    // NSX Manager: nodeCount = 1 in simple, 3 in HA/Stretch
    const nsxSize = pickNsxSize(perSiteHosts)
    const nsxSpec = getApplianceSpec('nsxManager', nsxSize)
    const nsxNodeCount = wld.deploymentMode === 'simple' ? 1 : 3
    lines.push({
      category: 'wldNsxManager',
      nodeCount: nsxNodeCount,
      cores: nsxSpec.cores,
      ramGB: nsxSpec.ramGB,
      diskGB: nsxSpec.diskGB,
      totalCores: nsxSpec.cores * nsxNodeCount,
      totalRamGB: nsxSpec.ramGB * nsxNodeCount,
      totalDiskGB: nsxSpec.diskGB * nsxNodeCount,
      source: 'auto-derived',
    })
  }

  return lines
}
