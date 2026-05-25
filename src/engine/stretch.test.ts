/// <reference types="vitest/globals" />
import { calcStretch } from './stretch'
import type { StretchInputs } from './types'

function inp(o: Partial<StretchInputs> = {}): StretchInputs {
  return { hostsPerSite: 3, vmCount: 100, avgStorageGbPerVm: 100, storageType: 'vsan-esa', ...o }
}

describe('calcStretch — witness and topology (STRCH-01/02/03/05)', () => {
  it('hostsPerSite=3 → totalHosts=6 (symmetric, demand-driven)', () => {
    expect(calcStretch(inp()).totalHosts).toBe(6)
  })

  it('vSAN ESA → requires a witness (ESA M profile: 4 vCPU / 16 GB)', () => {
    const r = calcStretch(inp({ storageType: 'vsan-esa' }))
    expect(r.requiresVsanWitness).toBe(true)
    expect(r.witnessCores).toBe(4)
    expect(r.witnessRamGB).toBe(16)
  })

  it('FC stretch (vMSC) → NO vSAN witness (witness fields zeroed)', () => {
    const r = calcStretch(inp({ storageType: 'fc' }))
    expect(r.requiresVsanWitness).toBe(false)
    expect(r.witnessCores).toBe(0)
    expect(r.witnessRamGB).toBe(0)
  })

  it('NFS stretch (vMSC) → NO vSAN witness', () => {
    expect(calcStretch(inp({ storageType: 'nfs' })).requiresVsanWitness).toBe(false)
  })

  it('bandwidth floor: 100 VMs x 100 GB/VM -> ~0.097 Gbps < 10 Gbps floor -> returns 10 Gbps', () => {
    const r = calcStretch(inp())
    expect(r.minBandwidthGbps).toBe(10)
    expect(r.bandwidthFloorApplied).toBe(true)
  })

  it('bandwidth floor NOT applied: large workload formula > 10 Gbps', () => {
    const r = calcStretch(inp({ avgStorageGbPerVm: 200_000 }))
    expect(r.minBandwidthGbps).toBeGreaterThan(10)
    expect(r.bandwidthFloorApplied).toBe(false)
  })

  it('storageNote field = i18n key string (not hardcoded English)', () => {
    expect(calcStretch(inp()).storageNote).toBe('deployment.stretch.storageNote')
  })
})

describe('calcStretch -- network checklist (STRCH-08)', () => {
  it('checklist populated with correct static values', () => {
    const nc = calcStretch(inp()).networkChecklist
    expect(nc.minInterSiteBandwidthGbps).toBe(10)
    expect(nc.maxInterSiteLatencyMs).toBe(5)
    expect(nc.jumboFramesRequired).toBe(true)
    expect(nc.witnessMinBandwidthMbps).toBe(2)
  })

  it('witness RTT = 200ms when hosts/site <= 10', () => {
    expect(calcStretch(inp({ hostsPerSite: 5 })).networkChecklist.maxWitnessLatencyMs).toBe(200)
  })

  it('witness RTT = 100ms when hosts/site > 10', () => {
    expect(calcStretch(inp({ hostsPerSite: 12 })).networkChecklist.maxWitnessLatencyMs).toBe(100)
  })
})
