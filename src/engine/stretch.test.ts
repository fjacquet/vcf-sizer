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

  it('bandwidth floor: 100 VMs x 100 GB/VM -> formula ~0.097 Gbps < 10 Gbps floor -> returns 10 Gbps', () => {
    const result = calcStretch({
      preferredSiteHosts: 3,
      secondarySiteHosts: 3,
      hostStorageTB: 3.84,
      vmCount: 100,
      avgStorageGbPerVm: 100,
    })
    expect(result.minBandwidthGbps).toBe(10)
    expect(result.bandwidthFloorApplied).toBe(true)
  })

  it('bandwidth floor NOT applied: large workload formula > 10 Gbps -> bandwidthFloorApplied=false', () => {
    const result = calcStretch({
      preferredSiteHosts: 3,
      secondarySiteHosts: 3,
      hostStorageTB: 3.84,
      vmCount: 100,
      avgStorageGbPerVm: 200_000,
    })
    expect(result.minBandwidthGbps).toBeGreaterThan(10)
    expect(result.bandwidthFloorApplied).toBe(false)
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

describe('calcStretch -- network checklist (STRCH-08)', () => {
  it('checklist populated with correct static values', () => {
    const result = calcStretch({
      preferredSiteHosts: 3,
      secondarySiteHosts: 3,
      hostStorageTB: 3.84,
      vmCount: 100,
      avgStorageGbPerVm: 100,
    })
    expect(result.networkChecklist.minInterSiteBandwidthGbps).toBe(10)
    expect(result.networkChecklist.maxInterSiteLatencyMs).toBe(5)
    expect(result.networkChecklist.jumboFramesRequired).toBe(true)
    expect(result.networkChecklist.witnessMinBandwidthMbps).toBe(2)
  })

  it('witness RTT = 200ms when max site hosts <= 10', () => {
    const result = calcStretch({
      preferredSiteHosts: 5,
      secondarySiteHosts: 5,
      hostStorageTB: 3.84,
      vmCount: 100,
      avgStorageGbPerVm: 100,
    })
    expect(result.networkChecklist.maxWitnessLatencyMs).toBe(200)
  })

  it('witness RTT = 100ms when max site hosts 11-15', () => {
    const result = calcStretch({
      preferredSiteHosts: 8,
      secondarySiteHosts: 12,
      hostStorageTB: 3.84,
      vmCount: 100,
      avgStorageGbPerVm: 100,
    })
    expect(result.networkChecklist.maxWitnessLatencyMs).toBe(100)
  })

  it('witness RTT = 100ms for > 15 hosts/site (conservative fallback)', () => {
    const result = calcStretch({
      preferredSiteHosts: 3,
      secondarySiteHosts: 20,
      hostStorageTB: 3.84,
      vmCount: 100,
      avgStorageGbPerVm: 100,
    })
    expect(result.networkChecklist.maxWitnessLatencyMs).toBe(100)
  })
})
