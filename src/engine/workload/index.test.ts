import { describe, it, expect } from 'vitest'
import { calcWorkloadFull } from './index'
import type { WorkloadFullInputs } from './types'

function inp(o: Partial<WorkloadFullInputs> = {}): WorkloadFullInputs {
  return {
    id: 'wld-1',
    name: 'WLD-1',
    deploymentMode: 'stretch',
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 1024,
    hostStorageTiB: 3.84,
    vmCount: 5000,
    avgVcpuPerVm: 4,
    avgVramGbPerVm: 16,
    avgStorageGbPerVm: 1000,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    gpuVmCount: 0,
    vgpuMemoryGB: 16,
    nvmeTieringEnabled: false,
    activeMemoryPct: 50,
    storageType: 'fc',
    fttLevel: 1,
    raidType: 'raid5',
    dedupEnabled: false,
    dedupRatio: 2,
    externalStorageUsableTiB: 100,
    vsanMaxProfile: 'med',
    vsanMaxStorageNodes: 4,
    hostFailuresToTolerate: 1,
    mgmtCores: 0,
    mgmtRamGB: 0,
    ...o,
  }
}

describe('calcWorkloadFull — report scenario (the bug)', () => {
  const r = calcWorkloadFull(inp())

  it('sizes to 79/site demand, 2 clusters, 82/site, 164 total — not 314', () => {
    expect(r.demandHostsPerSite).toBe(79)
    expect(r.clusterCountPerSite).toBe(2)
    expect(r.hostsPerCluster).toBe(41)
    expect(r.hostsPerSite).toBe(82)
    expect(r.totalHosts).toBe(164)
    expect(r.exceedsSingleCluster).toBe(true)
  })

  it('utilization is sane (~95%), not the old ~50%', () => {
    expect(r.coreUtilizationPct).toBeCloseTo(95.27, 1)
    expect(r.ramUtilizationPct).toBeCloseTo(95.27, 1)
  })

  it('flags the FC pool shortfall (4882 TiB demand vs 100 TiB pool)', () => {
    expect(r.storage.poolSufficient).toBe(false)
    expect(r.storage.requiredPoolTiB).toBeCloseTo(4882.81, 1)
    expect(r.validationErrors.map(e => e.code)).toContain('FC_POOL_SHORTFALL')
  })

  it('emits stretch metadata with totalHosts = 2 × per-site', () => {
    expect(r.stretch).not.toBeNull()
    expect(r.stretch?.totalHosts).toBe(164)
  })
})

describe('calcWorkloadFull — vSAN ESA storage-driven', () => {
  it('storage demand drives the host count above compute demand', () => {
    const r = calcWorkloadFull(
      inp({
        deploymentMode: 'ha',
        storageType: 'vsan-esa',
        vmCount: 100,
        avgVcpuPerVm: 4,
        avgVramGbPerVm: 8,
        avgStorageGbPerVm: 100,
        coresPerSocket: 16,
        socketsPerHost: 2,
        hostRamGB: 512,
        externalStorageUsableTiB: 0,
      }),
    )
    expect(r.minHostsForCpu).toBe(4) // ceil(100/32)
    expect(r.minHostsForStorage).toBe(7) // ~9.77 TiB demand
    expect(r.demandHostsPerSite).toBe(7)
    expect(r.hostsPerSite).toBe(8) // 7 + 1 HA
    expect(r.totalHosts).toBe(8) // not stretched
    expect(r.exceedsSingleCluster).toBe(false)
    expect(r.stretch).toBeNull()
    expect(r.storage.safeUsableCapacityTiB).toBeGreaterThan(0)
  })
})
