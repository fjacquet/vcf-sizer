/// <reference types="vitest/globals" />
import { mgmtStorageDemand } from './storage'

describe('mgmtStorageDemand — vSAN ESA (×1.5 FTT multiplier)', () => {
  it('applies 1.5× FTT, then 30% reserve, then 10% growth', () => {
    // diskGB + swapGB = 1000; raw = 1500; reserve = 1500 × 1.3 = 1950; growth = 1950 × 1.1 = 2145
    const r = mgmtStorageDemand({
      totalDiskGB: 500,
      totalRamGB: 500,
      storageType: 'vsan-esa',
      reservePct: 30,
      growthPct: 10,
    })
    expect(r.storageDemandGB).toBe(2145)
    expect(r.storageDemandTiB).toBeCloseTo(2145 / 1024, 5)
  })
})

describe('mgmtStorageDemand — vSAN Max (ESA-class ×1.5 multiplier)', () => {
  it('uses 1.5× multiplier same as ESA', () => {
    const r = mgmtStorageDemand({
      totalDiskGB: 500,
      totalRamGB: 500,
      storageType: 'vsan-max',
      reservePct: 30,
      growthPct: 10,
    })
    expect(r.storageDemandGB).toBe(2145)
  })
})

describe('mgmtStorageDemand — FC/NFS (×1, array handles redundancy)', () => {
  it('FC: ×1, then reserve, then growth', () => {
    // diskGB + swapGB = 1000; raw = 1000; reserve = 1300; growth = 1430
    const r = mgmtStorageDemand({
      totalDiskGB: 500,
      totalRamGB: 500,
      storageType: 'fc',
      reservePct: 30,
      growthPct: 10,
    })
    expect(r.storageDemandGB).toBe(1430)
  })

  it('NFS: same as FC', () => {
    const r = mgmtStorageDemand({
      totalDiskGB: 500,
      totalRamGB: 500,
      storageType: 'nfs',
      reservePct: 30,
      growthPct: 10,
    })
    expect(r.storageDemandGB).toBe(1430)
  })
})

describe('mgmtStorageDemand — reserve and growth are compound percentages', () => {
  it('zero reserve + zero growth: just the raw multiplier', () => {
    const r = mgmtStorageDemand({
      totalDiskGB: 1000,
      totalRamGB: 0,
      storageType: 'fc',
      reservePct: 0,
      growthPct: 0,
    })
    expect(r.storageDemandGB).toBe(1000)
  })

  it('reserve then growth, in that order (compound, not sum)', () => {
    // raw = 100; reserve = 100 × 1.5 = 150; growth = 150 × 1.5 = 225 (NOT 100 × 2.0)
    const r = mgmtStorageDemand({
      totalDiskGB: 100,
      totalRamGB: 0,
      storageType: 'fc',
      reservePct: 50,
      growthPct: 50,
    })
    expect(r.storageDemandGB).toBe(225)
  })
})

describe('mgmtStorageDemand — swap calculation', () => {
  it('swapGB equals totalRamGB (mgmt VM swap demand = RAM)', () => {
    const r = mgmtStorageDemand({
      totalDiskGB: 0,
      totalRamGB: 100,
      storageType: 'fc',
      reservePct: 0,
      growthPct: 0,
    })
    // diskGB + swapGB = 0 + 100 = 100
    expect(r.storageDemandGB).toBe(100)
    expect(r.swapGB).toBe(100)
    expect(r.diskAndSwapGB).toBe(100)
  })
})

describe('mgmtStorageDemand — invalid input', () => {
  it('rejects negative reserve', () => {
    expect(() => mgmtStorageDemand({
      totalDiskGB: 100, totalRamGB: 0, storageType: 'fc', reservePct: -1, growthPct: 0,
    })).toThrow(/reserve|growth/i)
  })
  it('rejects negative growth', () => {
    expect(() => mgmtStorageDemand({
      totalDiskGB: 100, totalRamGB: 0, storageType: 'fc', reservePct: 0, growthPct: -1,
    })).toThrow(/reserve|growth/i)
  })
})
