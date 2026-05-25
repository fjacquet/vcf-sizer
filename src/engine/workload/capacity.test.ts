import { describe, it, expect } from 'vitest'
import { calcWorkloadCapacity } from './capacity'
import type { WorkloadCapacityInputs } from './types'

function inp(o: Partial<WorkloadCapacityInputs> = {}): WorkloadCapacityInputs {
  return {
    storageType: 'fc',
    hostStorageTiB: 3.84,
    hostsPerSite: 8,
    clusterCountPerSite: 1,
    deploymentMode: 'ha',
    fttLevel: 1,
    raidType: 'raid5',
    dedupEnabled: false,
    dedupRatio: 2,
    vmCount: 5000,
    avgStorageGbPerVm: 1000,
    ...o,
  }
}

describe('calcWorkloadCapacity', () => {
  it('FC shortfall: 4882.81 TiB demand vs 100 TiB pool flags poolSufficient=false', () => {
    const r = calcWorkloadCapacity(inp({ externalStorageUsableTiB: 100 }))
    expect(r.workloadStorageRequiredTiB).toBeCloseTo(4882.81, 1)
    expect(r.requiredPoolTiB).toBeCloseTo(4882.81, 1)
    expect(r.availablePoolTiB).toBe(100)
    expect(r.poolShortfallTiB).toBeCloseTo(4782.81, 1)
    expect(r.poolSufficient).toBe(false)
  })

  it('FC sufficient: pool ≥ demand → no shortfall', () => {
    const r = calcWorkloadCapacity(inp({ vmCount: 100, avgStorageGbPerVm: 100, externalStorageUsableTiB: 50 }))
    expect(r.workloadStorageRequiredTiB).toBeCloseTo(9.77, 1)
    expect(r.poolShortfallTiB).toBe(0)
    expect(r.poolSufficient).toBe(true)
  })

  it('vSAN ESA: full overhead stack (8 hosts → 4+1, no stretch halving)', () => {
    const r = calcWorkloadCapacity(
      inp({ storageType: 'vsan-esa', hostsPerSite: 8, clusterCountPerSite: 1, vmCount: 100, avgStorageGbPerVm: 100 }),
    )
    expect(r.raidScheme).toContain('4+1')
    expect(r.raidMultiplier).toBe(1.25)
    expect(r.rawCapacityTiB).toBeCloseTo(30.72, 2) // 8 × 3.84
    expect(r.safeUsableCapacityTiB).toBeCloseTo(12.8164, 2)
    expect(r.poolSufficient).toBe(true)
    expect(r.requiredPoolTiB).toBe(0)
  })

  it('vSAN Max: compute nodes carry no workload storage demand', () => {
    const r = calcWorkloadCapacity(inp({ storageType: 'vsan-max', hostsPerSite: 6 }))
    expect(r.workloadStorageRequiredTiB).toBe(0)
    expect(r.poolSufficient).toBe(true)
  })
})
