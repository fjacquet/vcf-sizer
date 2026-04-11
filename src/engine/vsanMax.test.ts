/// <reference types="vitest/globals" />
import { calcVsanMax, READYNODE_PROFILES } from './vsanMax'

// Usable capacity formula for MED profile, 4 nodes (2+1 RAID-5):
// rawCapacityTiB = 4 * 100 = 400
// raidMultiplier = 1.5 (2+1, since 4 < 6 hosts)
// usableAfterRaid = 400 / 1.5 = 266.667
// lfsOverhead = 266.667 * 0.13 = 34.667
// usableAfterLfs = 266.667 - 34.667 = 232.00
// metadataPool = 400 * 0.10 = 40
// netUsable = 232.00 - 40 = 192.00
// safeUsable = 192.00 * 0.70 = 134.40

describe('calcVsanMax — MED profile, 4 nodes (2+1 RAID-5)', () => {
  it('returns rawCapacityTiB=400', () => {
    const result = calcVsanMax({ profile: 'med', storageNodeCount: 4, computeNodeCount: 8 })
    expect(result.rawCapacityTiB).toBe(400)
  })

  it('returns usableCapacityTiB ~134.40', () => {
    const result = calcVsanMax({ profile: 'med', storageNodeCount: 4, computeNodeCount: 8 })
    expect(result.usableCapacityTiB).toBeCloseTo(134.40, 1)
  })

  it('returns raidScheme=2+1 (FTT=1 RAID-5)', () => {
    const result = calcVsanMax({ profile: 'med', storageNodeCount: 4, computeNodeCount: 8 })
    expect(result.raidScheme).toBe('2+1 (FTT=1 RAID-5)')
  })

  it('returns belowMinNodes=false when storageNodeCount=4', () => {
    const result = calcVsanMax({ profile: 'med', storageNodeCount: 4, computeNodeCount: 8 })
    expect(result.belowMinNodes).toBe(false)
  })
})

describe('calcVsanMax — all 5 profiles rawCapacityTiB', () => {
  it('XS profile, 4 nodes: rawCapacityTiB=80 (4 * 20)', () => {
    const result = calcVsanMax({ profile: 'xs', storageNodeCount: 4, computeNodeCount: 8 })
    expect(result.rawCapacityTiB).toBe(80)
  })

  it('SM profile, 4 nodes: rawCapacityTiB=200 (4 * 50)', () => {
    const result = calcVsanMax({ profile: 'sm', storageNodeCount: 4, computeNodeCount: 8 })
    expect(result.rawCapacityTiB).toBe(200)
  })

  it('MED profile, 4 nodes: rawCapacityTiB=400 (4 * 100)', () => {
    const result = calcVsanMax({ profile: 'med', storageNodeCount: 4, computeNodeCount: 8 })
    expect(result.rawCapacityTiB).toBe(400)
  })

  it('LRG profile, 4 nodes: rawCapacityTiB=600 (4 * 150)', () => {
    const result = calcVsanMax({ profile: 'lrg', storageNodeCount: 4, computeNodeCount: 8 })
    expect(result.rawCapacityTiB).toBe(600)
  })

  it('XL profile, 4 nodes: rawCapacityTiB=800 (4 * 200)', () => {
    const result = calcVsanMax({ profile: 'xl', storageNodeCount: 4, computeNodeCount: 8 })
    expect(result.rawCapacityTiB).toBe(800)
  })
})

describe('calcVsanMax — RAID scheme adaptive (6+ nodes = 4+1)', () => {
  it('MED profile, 6 nodes: uses 4+1 scheme (raidScheme contains 4+1)', () => {
    const result = calcVsanMax({ profile: 'med', storageNodeCount: 6, computeNodeCount: 8 })
    expect(result.raidScheme).toContain('4+1')
  })
})

describe('calcVsanMax — belowMinNodes boundary (min=4)', () => {
  it('MED profile, 3 nodes: belowMinNodes=true', () => {
    const result = calcVsanMax({ profile: 'med', storageNodeCount: 3, computeNodeCount: 8 })
    expect(result.belowMinNodes).toBe(true)
  })

  it('MED profile, 4 nodes: belowMinNodes=false (boundary)', () => {
    const result = calcVsanMax({ profile: 'med', storageNodeCount: 4, computeNodeCount: 8 })
    expect(result.belowMinNodes).toBe(false)
  })
})

describe('READYNODE_PROFILES constant', () => {
  it('has exactly 5 entries: xs, sm, med, lrg, xl', () => {
    const keys = Object.keys(READYNODE_PROFILES)
    expect(keys).toHaveLength(5)
    expect(keys).toContain('xs')
    expect(keys).toContain('sm')
    expect(keys).toContain('med')
    expect(keys).toContain('lrg')
    expect(keys).toContain('xl')
  })
})
