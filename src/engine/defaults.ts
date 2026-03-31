// src/engine/defaults.ts
// Pure TypeScript factory functions — CALC-01 compliant (zero Vue imports)

import type { WorkloadDomainConfig, ManagementDomainConfig } from './types'

export function createDefaultWorkloadDomain(index: number): WorkloadDomainConfig {
  return {
    id: crypto.randomUUID(),
    name: `WLD-${index + 1}`,
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTB: 3.84,
    hostCount: 4,
    nvmeTieringEnabled: false,
    activeMemoryPct: 50,
    preferredSiteHosts: 3,
    secondarySiteHosts: 3,
    vmCount: 100,
    avgVcpuPerVm: 4,
    avgVramGbPerVm: 8,
    avgStorageGbPerVm: 100,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    gpuVmCount: 0,
    vgpuMemoryGB: 16,
    storageType: 'vsan-esa',
    fttLevel: 1,
    raidType: 'raid5',
    dedupEnabled: false,
    dedupRatio: 2,
    vsanMaxProfile: 'med',
    vsanMaxStorageNodes: 4,
    networkSpeedGbE: 25,
    deploymentMode: 'ha',
  }
}

export function createDefaultManagementDomain(): ManagementDomainConfig {
  return {
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTB: 3.84,
    deploymentMode: 'ha',
    storageType: 'vsan-esa',
  }
}
