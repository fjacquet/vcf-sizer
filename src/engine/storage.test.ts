/// <reference types="vitest/globals" />
import { vsanEsaRaidOverhead, calcStorage } from './storage'

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
      hostStorageTB: 3.84,
      fttLevel: 1,
      raidType: 'raid5',
      dedupEnabled: false,
      dedupRatio: 2,
    })
    // rawCapacityTB = 4 × 3.84 = 15.36
    expect(result.rawCapacityTB).toBeCloseTo(15.36, 5)
    // 4 hosts < 6 → 2+1 scheme → raidMultiplier = 1.5
    expect(result.raidMultiplier).toBe(1.5)
    // safeUsable = 7.3728 × 0.70 = 5.16096
    expect(result.safeUsableCapacityTB).toBeCloseTo(5.16, 2)
  })

  it('vSAN ESA with 6 hosts, RAID-5 FTT=1 — uses 4+1 scheme (1.25x)', () => {
    const result = calcStorage({
      storageType: 'vsan-esa',
      hostCount: 6,
      hostStorageTB: 3.84,
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
      hostStorageTB: 10,
      fttLevel: 1,
      raidType: 'raid1',
      dedupEnabled: false,
      dedupRatio: 2,
    })
    expect(result.rawCapacityTB).toBe(40)
    expect(result.raidMultiplier).toBe(1)
    expect(result.lfsOverheadTB).toBe(0)
    expect(result.metadataOverheadTB).toBe(0)
    expect(result.safeUsableCapacityTB).toBe(40)
  })
})

describe('calcStorage — NFS pass-through (STOR-07)', () => {
  it('NFS storage: raw capacity pass-through, no RAID/LFS/metadata overhead', () => {
    const result = calcStorage({
      storageType: 'nfs',
      hostCount: 4,
      hostStorageTB: 10,
      fttLevel: 1,
      raidType: 'raid1',
      dedupEnabled: false,
      dedupRatio: 2,
    })
    expect(result.rawCapacityTB).toBe(40)
    expect(result.raidMultiplier).toBe(1)
    expect(result.lfsOverheadTB).toBe(0)
    expect(result.metadataOverheadTB).toBe(0)
    expect(result.safeUsableCapacityTB).toBe(40)
  })
})
