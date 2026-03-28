/// <reference types="vitest/globals" />
import { calcManagement } from './management'

describe('calcManagement — Simple mode', () => {
  it('vCenter: 4 vCPU / 21 GB RAM (always ×1)', () => {
    const r = calcManagement('simple')
    expect(r.vcenterCores).toBe(4)
    expect(r.vcenterRamGB).toBe(21)
  })

  it('SDDC Manager: 4 vCPU / 16 GB RAM (always ×1)', () => {
    const r = calcManagement('simple')
    expect(r.sddcCores).toBe(4)
    expect(r.sddcRamGB).toBe(16)
  })

  it('NSX Manager: 6 vCPU / 24 GB RAM (×1 in Simple)', () => {
    const r = calcManagement('simple')
    expect(r.nsxCores).toBe(6)
    expect(r.nsxRamGB).toBe(24)
  })

  it('VCF Operations incl Fleet + Collector (ops ×1; Fleet/Collector singletons per MGMT-04)', () => {
    const r = calcManagement('simple')
    // ops=4×1=4, fleet=4(fixed), collector=4(fixed) → total cores for ops group = 12
    expect(r.opsCores).toBe(12)
    // ops=16×1=16, fleet=12(fixed), collector=16(fixed) → total RAM for ops group = 44
    expect(r.opsRamGB).toBe(44)
  })

  it('VCF Automation: 24 vCPU / 96 GB RAM (×1 in Simple)', () => {
    const r = calcManagement('simple')
    expect(r.automationCores).toBe(24)
    expect(r.automationRamGB).toBe(96)
  })

  it('Simple mode TOTALS: totalCores=50, totalRamGB=201', () => {
    const r = calcManagement('simple')
    // vc=4, sddc=4, nsx=6, ops+fleet+coll=12, vcfa=24 → 50
    expect(r.totalCores).toBe(50)
    // vc=21, sddc=16, nsx=24, ops+fleet+coll=44, vcfa=96 → 201
    expect(r.totalRamGB).toBe(201)
  })
})

describe('calcManagement — HA mode', () => {
  it('NSX Manager: 6 vCPU / 24 GB RAM (×3 in HA)', () => {
    const r = calcManagement('ha')
    expect(r.nsxCores).toBe(18)
    expect(r.nsxRamGB).toBe(72)
  })

  it('VCF Operations: ops ×3, Fleet+Collector stay ×1 singletons (MGMT-04)', () => {
    const r = calcManagement('ha')
    // ops=4×3=12, fleet=4(fixed), collector=4(fixed) → 20
    expect(r.opsCores).toBe(20)
    // ops=16×3=48, fleet=12(fixed), collector=16(fixed) → 76
    expect(r.opsRamGB).toBe(76)
  })

  it('VCF Automation: 24 vCPU / 96 GB RAM (×3 in HA)', () => {
    const r = calcManagement('ha')
    expect(r.automationCores).toBe(72)
    expect(r.automationRamGB).toBe(288)
  })

  it('HA mode TOTALS: totalCores=118, totalRamGB=473', () => {
    const r = calcManagement('ha')
    // vc=4, sddc=4, nsx=18, ops=12+4+4=20, vcfa=72 → 4+4+18+20+72=118
    expect(r.totalCores).toBe(118)
    // vc=21, sddc=16, nsx=72, ops=48+12+16=76, vcfa=288 → 21+16+72+76+288=473
    expect(r.totalRamGB).toBe(473)
  })
})

describe('calcManagement — Stretch mode', () => {
  it('Stretch uses same multipliers as HA', () => {
    const ha = calcManagement('ha')
    const stretch = calcManagement('stretch')
    expect(stretch.totalCores).toBe(ha.totalCores)
    expect(stretch.totalRamGB).toBe(ha.totalRamGB)
  })
})
