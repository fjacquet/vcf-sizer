/// <reference types="vitest/globals" />
import { calcStretch } from './stretch'

describe('calcStretch — witness and topology (STRCH-01/02/03/05)', () => {
  it('preferredSiteHosts=3, secondarySiteHosts=3 → totalHosts=6', () => {
    const result = calcStretch({
      preferredSiteHosts: 3,
      secondarySiteHosts: 3,
      hostStorageTB: 3.84,
      vmCount: 100,
      avgStorageGbPerVm: 100,
    })
    expect(result.totalHosts).toBe(6)
  })

  it('witness = 4 vCPU, 16 GB RAM (ESA M profile — NOT 2/8 OSA Tiny)', () => {
    const result = calcStretch({
      preferredSiteHosts: 3,
      secondarySiteHosts: 3,
      hostStorageTB: 3.84,
      vmCount: 100,
      avgStorageGbPerVm: 100,
    })
    expect(result.witnessCores).toBe(4)
    expect(result.witnessRamGB).toBe(16)
  })

  it('bandwidth = totalWorkloadStorageTB × 0.1; 100 VMs × 100 GB/VM = 10 TB → 1.0 Gbps', () => {
    const result = calcStretch({
      preferredSiteHosts: 3,
      secondarySiteHosts: 3,
      hostStorageTB: 3.84,
      vmCount: 100,
      avgStorageGbPerVm: 100,
    })
    // 100 VMs × 100 GB = 10,000 GB = 9.765... TB ≈ (100×100/1024) TB
    // bandwidth = totalWorkloadStorageTB × 0.1
    const expectedStorageTB = (100 * 100) / 1024
    expect(result.minBandwidthGbps).toBeCloseTo(expectedStorageTB * 0.1, 5)
  })

  it('preferredSiteHosts=4, secondarySiteHosts=2 → totalHosts=6 (asymmetric sites)', () => {
    const result = calcStretch({
      preferredSiteHosts: 4,
      secondarySiteHosts: 2,
      hostStorageTB: 3.84,
      vmCount: 50,
      avgStorageGbPerVm: 200,
    })
    expect(result.totalHosts).toBe(6)
  })

  it('storageNote field = i18n key string (not hardcoded English)', () => {
    const result = calcStretch({
      preferredSiteHosts: 3,
      secondarySiteHosts: 3,
      hostStorageTB: 3.84,
      vmCount: 100,
      avgStorageGbPerVm: 100,
    })
    expect(result.storageNote).toBe('deployment.stretch.storageNote')
  })
})
