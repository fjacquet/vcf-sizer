/// <reference types="vitest/globals" />
import { vsanEsaRaidOverhead, calcStorage, calcMinHostsForVsanEsa } from './storage'

describe('vsanEsaRaidOverhead — Adaptive RAID-5 thresholds (STOR-02)', () => {
  it('RAID-5 FTT=1 with 5 hosts → 2+1 scheme (multiplier=1.5)', () => {
    const r = vsanEsaRaidOverhead(5, 1, 'raid5')
    expect(r.multiplier).toBe(1.5)
    expect(r.scheme).toBe('2+1 (FTT=1 RAID-5)')
  })

  it('RAID-5 FTT=1 with 6 hosts → 4+1 scheme (multiplier=1.25)', () => {
    const r = vsanEsaRaidOverhead(6, 1, 'raid5')
    expect(r.multiplier).toBe(1.25)
    expect(r.scheme).toBe('4+1 (FTT=1 RAID-5)')
  })

  it('RAID-5 FTT=1 with 4 hosts → 2+1 scheme (multiplier=1.5, below 6 host threshold)', () => {
    const r = vsanEsaRaidOverhead(4, 1, 'raid5')
    expect(r.multiplier).toBe(1.5)
  })

  it('RAID-1 FTT=1 → 2.0x multiplier', () => {
    const r = vsanEsaRaidOverhead(3, 1, 'raid1')
    expect(r.multiplier).toBe(2.0)
  })

  it('RAID-6 FTT=2 → 1.5x multiplier', () => {
    const r = vsanEsaRaidOverhead(6, 2, 'raid6')
    expect(r.multiplier).toBe(1.5)
  })
})

describe('calcStorage — vSAN ESA overhead stack (STOR-03)', () => {
  it('vSAN ESA with 4 hosts, RAID-5 FTT=1, no dedup — full overhead stack', () => {
    const result = calcStorage({
      storageType: 'vsan-esa',
      hostCount: 4,
      hostStorageTiB: 3.84,
      fttLevel: 1,
      raidType: 'raid5',
      dedupEnabled: false,
      dedupRatio: 2,
    })
    // rawCapacityTiB = 4 × 3.84 = 15.36
    expect(result.rawCapacityTiB).toBeCloseTo(15.36, 5)
    // 4 hosts < 6 → 2+1 scheme → raidMultiplier = 1.5
    expect(result.raidMultiplier).toBe(1.5)
    // safeUsable = 7.3728 × 0.70 = 5.16096
    expect(result.safeUsableCapacityTiB).toBeCloseTo(5.16, 2)
    // vSAN ESA: workload storage not applicable (capacity from physical drives)
    expect(result.workloadStorageRequiredTiB).toBe(0)
  })

  it('vSAN ESA with 6 hosts, RAID-5 FTT=1 — uses 4+1 scheme (1.25x)', () => {
    const result = calcStorage({
      storageType: 'vsan-esa',
      hostCount: 6,
      hostStorageTiB: 3.84,
      fttLevel: 1,
      raidType: 'raid5',
      dedupEnabled: false,
      dedupRatio: 2,
    })
    expect(result.raidMultiplier).toBe(1.25)
    expect(result.raidScheme).toBe('4+1 (FTT=1 RAID-5)')
  })
})

describe('calcStorage — FC pass-through (STOR-07)', () => {
  it('FC storage: raw capacity pass-through, no RAID/LFS/metadata overhead', () => {
    const result = calcStorage({
      storageType: 'fc',
      hostCount: 4,
      hostStorageTiB: 10,
      fttLevel: 1,
      raidType: 'raid1',
      dedupEnabled: false,
      dedupRatio: 2,
    })
    expect(result.rawCapacityTiB).toBe(40)
    expect(result.raidMultiplier).toBe(1)
    expect(result.lfsOverheadTiB).toBe(0)
    expect(result.metadataOverheadTiB).toBe(0)
    expect(result.safeUsableCapacityTiB).toBe(40)
    expect(result.workloadStorageRequiredTiB).toBe(0)
  })

  it('FC with vmCount and avgStorageGbPerVm computes workloadStorageRequiredTiB', () => {
    const result = calcStorage({
      storageType: 'fc',
      hostCount: 28,
      hostStorageTiB: 3.84,
      externalStorageUsableTiB: 100,
      fttLevel: 1,
      raidType: 'raid1',
      dedupEnabled: false,
      dedupRatio: 2,
      vmCount: 1000,
      avgStorageGbPerVm: 970,
    })
    // 1000 × 970 / 1024 = 947.265625
    expect(result.workloadStorageRequiredTiB).toBeCloseTo(947.265625, 4)
    expect(result.rawCapacityTiB).toBe(100)
  })

  it('FC with vmCount=0 returns workloadStorageRequiredTiB=0', () => {
    const result = calcStorage({
      storageType: 'fc',
      hostCount: 4,
      hostStorageTiB: 10,
      fttLevel: 1,
      raidType: 'raid1',
      dedupEnabled: false,
      dedupRatio: 2,
      vmCount: 0,
      avgStorageGbPerVm: 970,
    })
    expect(result.workloadStorageRequiredTiB).toBe(0)
  })
})

describe('calcStorage — NFS pass-through (STOR-07)', () => {
  it('NFS storage: raw capacity pass-through, no RAID/LFS/metadata overhead', () => {
    const result = calcStorage({
      storageType: 'nfs',
      hostCount: 4,
      hostStorageTiB: 10,
      fttLevel: 1,
      raidType: 'raid1',
      dedupEnabled: false,
      dedupRatio: 2,
    })
    expect(result.rawCapacityTiB).toBe(40)
    expect(result.raidMultiplier).toBe(1)
    expect(result.lfsOverheadTiB).toBe(0)
    expect(result.metadataOverheadTiB).toBe(0)
    expect(result.safeUsableCapacityTiB).toBe(40)
    expect(result.workloadStorageRequiredTiB).toBe(0)
  })

  it('NFS with vmCount and avgStorageGbPerVm computes workloadStorageRequiredTiB', () => {
    const result = calcStorage({
      storageType: 'nfs',
      hostCount: 4,
      hostStorageTiB: 10,
      externalStorageUsableTiB: 150,
      fttLevel: 1,
      raidType: 'raid1',
      dedupEnabled: false,
      dedupRatio: 2,
      vmCount: 100,
      avgStorageGbPerVm: 100,
    })
    // 100 × 100 / 1024 = 9.765625
    expect(result.workloadStorageRequiredTiB).toBeCloseTo(9.765625, 4)
    expect(result.rawCapacityTiB).toBe(150)
  })
})

describe('calcStorage — FC/NFS pool input (STOR-03)', () => {
  it('FC with externalStorageUsableTiB uses pool value directly (not hostCount * perHost)', () => {
    const result = calcStorage({
      storageType: 'fc', hostCount: 4, hostStorageTiB: 10,
      externalStorageUsableTiB: 200,
      fttLevel: 1, raidType: 'raid1', dedupEnabled: false, dedupRatio: 2,
    })
    expect(result.rawCapacityTiB).toBe(200)
    expect(result.safeUsableCapacityTiB).toBe(200)
  })

  it('NFS with externalStorageUsableTiB uses pool value directly', () => {
    const result = calcStorage({
      storageType: 'nfs', hostCount: 4, hostStorageTiB: 10,
      externalStorageUsableTiB: 150,
      fttLevel: 1, raidType: 'raid1', dedupEnabled: false, dedupRatio: 2,
    })
    expect(result.rawCapacityTiB).toBe(150)
    expect(result.safeUsableCapacityTiB).toBe(150)
  })

  it('FC without externalStorageUsableTiB falls back to hostCount * hostStorageTiB', () => {
    const result = calcStorage({
      storageType: 'fc', hostCount: 4, hostStorageTiB: 10,
      fttLevel: 1, raidType: 'raid1', dedupEnabled: false, dedupRatio: 2,
    })
    expect(result.rawCapacityTiB).toBe(40)
  })
})

describe('calcStorage — vsan-max pass-through', () => {
  it('vsan-max storageType returns pass-through (compute nodes have no vSAN storage)', () => {
    const result = calcStorage({
      storageType: 'vsan-max',
      hostCount: 8,
      hostStorageTiB: 3.84,
      fttLevel: 1,
      raidType: 'raid5',
      dedupEnabled: false,
      dedupRatio: 2,
    })
    expect(result.raidMultiplier).toBe(1)
    expect(result.lfsOverheadTiB).toBe(0)
    expect(result.raidScheme).toBe('Pass-through (vSAN Max compute)')
  })
})

describe('calcStorage — stretch PFTT=1 site mirroring (STRCH-03)', () => {
  const baseInputs = {
    storageType: 'vsan-esa' as const,
    hostCount: 6,
    hostStorageTiB: 10,
    fttLevel: 1 as const,
    raidType: 'raid5' as const,
    dedupEnabled: false,
    dedupRatio: 1,
  }

  it('stretch: safeUsableCapacityTiB is half of simple mode (PFTT=1 site mirroring)', () => {
    const simple = calcStorage({ ...baseInputs, deploymentMode: 'simple' })
    const stretch = calcStorage({ ...baseInputs, deploymentMode: 'stretch' })
    expect(stretch.safeUsableCapacityTiB).toBeCloseTo(simple.safeUsableCapacityTiB / 2, 6)
  })

  it('stretch: effectiveCapacityTiB is half of simple mode', () => {
    const simple = calcStorage({ ...baseInputs, deploymentMode: 'simple' })
    const stretch = calcStorage({ ...baseInputs, deploymentMode: 'stretch' })
    expect(stretch.effectiveCapacityTiB).toBeCloseTo(simple.effectiveCapacityTiB / 2, 6)
  })

  it('stretch: rawCapacityTiB unchanged (full-cluster physical capacity)', () => {
    const simple = calcStorage({ ...baseInputs, deploymentMode: 'simple' })
    const stretch = calcStorage({ ...baseInputs, deploymentMode: 'stretch' })
    expect(stretch.rawCapacityTiB).toBe(simple.rawCapacityTiB)
  })

  it('simple/ha: no mirroring factor (backward compat)', () => {
    const simple = calcStorage({ ...baseInputs, deploymentMode: 'simple' })
    const noMode = calcStorage(baseInputs)
    expect(noMode.safeUsableCapacityTiB).toBeCloseTo(simple.safeUsableCapacityTiB, 6)
  })
})

describe('calcMinHostsForVsanEsa — storage-driven host minimum (STOR-08)', () => {
  it('500 VMs × 250 GB with 3.84 TiB/host, RAID-5 FTT=1, no dedup → needs many hosts', () => {
    const workloadTiB = 500 * 250 / 1024 // ~122.07 TiB
    const result = calcMinHostsForVsanEsa(3.84, 1, 'raid5', false, 2, 'simple', workloadTiB)
    // With 4+1 (1.25x): usablePerHost = 3.84 × (0.87/1.25 − 0.10) × 0.70 ≈ 1.603
    // minHosts = ceil(122.07 / 1.603) ≈ 77
    expect(result).toBeGreaterThanOrEqual(6) // Must use 4+1 scheme
    expect(result).toBeGreaterThan(70) // Needs many hosts for 122 TiB
  })

  it('returns 0 when workload is zero', () => {
    expect(calcMinHostsForVsanEsa(3.84, 1, 'raid5', false, 2, 'simple', 0)).toBe(0)
  })

  it('returns 0 when hostStorageTiB is zero', () => {
    expect(calcMinHostsForVsanEsa(0, 1, 'raid5', false, 2, 'simple', 10)).toBe(0)
  })

  it('RAID-1 FTT=1 requires more hosts than RAID-5 for same workload', () => {
    const workloadTiB = 50
    const raid5 = calcMinHostsForVsanEsa(3.84, 1, 'raid5', false, 2, 'simple', workloadTiB)
    const raid1 = calcMinHostsForVsanEsa(3.84, 1, 'raid1', false, 2, 'simple', workloadTiB)
    expect(raid1).toBeGreaterThan(raid5)
  })

  it('dedup enabled reduces required host count', () => {
    const workloadTiB = 50
    const noDedup = calcMinHostsForVsanEsa(3.84, 1, 'raid5', false, 2, 'simple', workloadTiB)
    const withDedup = calcMinHostsForVsanEsa(3.84, 1, 'raid5', true, 2, 'simple', workloadTiB)
    expect(withDedup).toBeLessThan(noDedup)
  })

  it('stretch mode roughly doubles required hosts vs simple (PFTT=1 halves per-host usable)', () => {
    const workloadTiB = 50
    const simple = calcMinHostsForVsanEsa(3.84, 1, 'raid5', false, 2, 'simple', workloadTiB)
    const stretch = calcMinHostsForVsanEsa(3.84, 1, 'raid5', false, 2, 'stretch', workloadTiB)
    // ceil() rounding means stretch may be 2×simple or 2×simple−1
    expect(stretch).toBeGreaterThanOrEqual(simple * 2 - 1)
    expect(stretch).toBeLessThanOrEqual(simple * 2)
  })

  it('RAID-5 adaptive boundary: small workload fits within 5 hosts uses 2+1 scheme', () => {
    // Small workload that fits in ≤5 hosts with 2+1 (1.5x)
    const workloadTiB = 5
    const result = calcMinHostsForVsanEsa(3.84, 1, 'raid5', false, 2, 'simple', workloadTiB)
    expect(result).toBeLessThanOrEqual(5)
    expect(result).toBeGreaterThanOrEqual(4) // RAID-5 minimum
  })

  it('RAID-5 minimum is 4 hosts even for tiny workload', () => {
    const result = calcMinHostsForVsanEsa(3.84, 1, 'raid5', false, 2, 'simple', 0.1)
    expect(result).toBeGreaterThanOrEqual(4)
  })

  it('RAID-1 FTT=1 minimum is 3 hosts', () => {
    const result = calcMinHostsForVsanEsa(3.84, 1, 'raid1', false, 2, 'simple', 0.1)
    expect(result).toBeGreaterThanOrEqual(3)
  })
})
