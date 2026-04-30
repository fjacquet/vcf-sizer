/// <reference types="vitest/globals" />
import { calcManagementFull } from './index'
import type { ManagementDomainConfig } from './types'
import type { WorkloadDomainConfig } from '../types'

function baseConfig(): ManagementDomainConfig {
  return {
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 8,
    deploymentMode: 'simple',
    profile: 'standard',
    overrides: {},
    validatedSolutions: {
      siteProtection: { included: false },
      ransomwareOnPrem: { included: false },
      ransomwareCloud: { included: false },
      crossCloudMobility: { included: false },
    },
    cpuOversubscription: 2,
    ramOversubscription: 1,
    reservePct: 30,
    growthPct: 10,
    storageType: 'vsan-esa',
  }
}

describe('calcManagementFull — Standard / Simple / vSAN-ESA / no WLDs', () => {
  it('produces non-empty appliances array with SDDC + Fleet + Standard set', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.appliances.length).toBeGreaterThan(5)
    expect(r.appliances.find(l => l.category === 'sddcManager')).toBeDefined()
    expect(r.appliances.find(l => l.category === 'fleetManager')).toBeDefined()
  })

  it('wldOverhead empty when no WLDs', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.wldOverhead).toEqual([])
  })

  it('totals = sum of all appliance lines + wldOverhead lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    const expectedCores = r.appliances.reduce((s, l) => s + l.totalCores, 0)
    const expectedRam = r.appliances.reduce((s, l) => s + l.totalRamGB, 0)
    const expectedDisk = r.appliances.reduce((s, l) => s + l.totalDiskGB, 0)
    expect(r.totalCores).toBe(expectedCores)
    expect(r.totalRamGB).toBe(expectedRam)
    expect(r.totalDiskGB).toBe(expectedDisk)
  })

  it('totalSwapGB = totalRamGB', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.totalSwapGB).toBe(r.totalRamGB)
  })

  it('per-host metrics are non-zero for vSAN-ESA', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.perHostCores).toBeGreaterThan(0)
    expect(r.perHostRamGB).toBeGreaterThan(0)
    expect(r.perHostStorageGB).toBeGreaterThan(0)
    expect(r.externalPoolRequiredTiB).toBe(0)
  })

  it('recommendedHostCount respects the simple/HA floor of 4', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.recommendedHostCount).toBeGreaterThanOrEqual(4)
  })

  it('validationWarnings include no errors for a clean Standard config', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.validationWarnings.filter(w => w.severity === 'error')).toEqual([])
  })
})

describe('calcManagementFull — FC routing', () => {
  it('FC config: per-host storage = 0; externalPoolRequiredTiB > 0', () => {
    const cfg = { ...baseConfig(), storageType: 'fc' as const, externalStorageUsableTiB: 10 }
    const r = calcManagementFull(cfg, [])
    expect(r.perHostStorageGB).toBe(0)
    expect(r.externalPoolRequiredTiB).toBeGreaterThan(0)
    expect(r.minHostsForStorage).toBe(0)
  })

  it('FC without externalStorageUsableTiB raises MGMT-FC-NEEDS-POOL error', () => {
    const cfg = { ...baseConfig(), storageType: 'fc' as const, externalStorageUsableTiB: undefined }
    const r = calcManagementFull(cfg, [])
    expect(r.validationWarnings.find(w => w.code === 'MGMT-FC-NEEDS-POOL')).toBeDefined()
  })
})

describe('calcManagementFull — Stretch deployment floor of 8', () => {
  it('stretch mode: recommendedHostCount ≥ 8', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'stretch' as const }
    const r = calcManagementFull(cfg, [])
    expect(r.recommendedHostCount).toBeGreaterThanOrEqual(8)
  })

  // P5.5: per-site host counts on the result
  it('stretch mode: preferredSiteHosts and secondarySiteHosts both equal recommendedHostCount', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'stretch' as const }
    const r = calcManagementFull(cfg, [])
    expect(r.preferredSiteHosts).toBe(r.recommendedHostCount)
    expect(r.secondarySiteHosts).toBe(r.recommendedHostCount)
  })

  it('simple mode: preferredSiteHosts and secondarySiteHosts are undefined', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'simple' as const }
    const r = calcManagementFull(cfg, [])
    expect(r.preferredSiteHosts).toBeUndefined()
    expect(r.secondarySiteHosts).toBeUndefined()
  })

  it('ha mode: preferredSiteHosts and secondarySiteHosts are undefined', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const r = calcManagementFull(cfg, [])
    expect(r.preferredSiteHosts).toBeUndefined()
    expect(r.secondarySiteHosts).toBeUndefined()
  })
})

describe('calcManagementFull — WLD overhead routing', () => {
  function wld(overrides: Partial<WorkloadDomainConfig> = {}): WorkloadDomainConfig {
    return {
      id: 'w01', name: 'wld-01', coresPerSocket: 32, socketsPerHost: 2,
      hostRamGB: 512, hostStorageTiB: 8, externalStorageUsableTiB: 0,
      hostCount: 4, nvmeTieringEnabled: false, activeMemoryPct: 50,
      preferredSiteHosts: 4, secondarySiteHosts: 4,
      vmCount: 100, avgVcpuPerVm: 2, avgVramGbPerVm: 4, avgStorageGbPerVm: 100,
      cpuOvercommitRatio: 4, ramOvercommitRatio: 1,
      gpuVmCount: 0, vgpuMemoryGB: 16,
      storageType: 'vsan-esa', fttLevel: 1, raidType: 'raid5',
      dedupEnabled: false, dedupRatio: 1,
      vsanMaxProfile: 'med', vsanMaxStorageNodes: 4,
      networkSpeedGbE: 25, deploymentMode: 'simple',
      ...overrides,
    }
  }

  it('1 WLD adds 2 lines to wldOverhead and contributes to totals', () => {
    const without = calcManagementFull(baseConfig(), [])
    const withOne = calcManagementFull(baseConfig(), [wld()])
    expect(withOne.wldOverhead.length).toBe(2)
    expect(withOne.totalCores).toBeGreaterThan(without.totalCores)
  })

  it('5 WLDs add 10 lines', () => {
    const wlds = [wld({ id: 'w01' }), wld({ id: 'w02' }), wld({ id: 'w03' }), wld({ id: 'w04' }), wld({ id: 'w05' })]
    const r = calcManagementFull(baseConfig(), wlds)
    expect(r.wldOverhead.length).toBe(10)
  })
})

describe('calcManagementFull — validated solutions', () => {
  it('enabling siteProtection adds an appliance line with source=validated-solution', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions!.siteProtection = { included: true, mgmtSize: 'standard' }
    const r = calcManagementFull(cfg, [])
    const sr = r.appliances.find(l => l.category === 'siteRecovery')
    expect(sr).toBeDefined()
    expect(sr!.source).toBe('validated-solution')
  })
})

describe('calcManagementFull — legacy flat fields populated', () => {
  it('vcenterCores/RamGB summed from vcenter category lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    const vcenterLines = r.appliances.filter(l => l.category === 'vcenter')
    const expectedCores = vcenterLines.reduce((s, l) => s + l.totalCores, 0)
    const expectedRam = vcenterLines.reduce((s, l) => s + l.totalRamGB, 0)
    expect(r.vcenterCores).toBe(expectedCores)
    expect(r.vcenterRamGB).toBe(expectedRam)
  })

  it('sddcCores/RamGB summed from sddcManager category lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    expect(r.sddcCores).toBe(4)    // SDDC Manager fixed spec
    expect(r.sddcRamGB).toBe(16)
  })

  it('nsxCores/RamGB summed from nsxManager category lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    const nsxLines = r.appliances.filter(l => l.category === 'nsxManager')
    expect(r.nsxCores).toBe(nsxLines.reduce((s, l) => s + l.totalCores, 0))
    expect(r.nsxRamGB).toBe(nsxLines.reduce((s, l) => s + l.totalRamGB, 0))
  })

  it('opsCores/RamGB summed from vrops + vropsCollector + fleetManager category lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    const opsLines = r.appliances.filter(l =>
      l.category === 'vrops' || l.category === 'vropsCollector' || l.category === 'fleetManager'
    )
    expect(r.opsCores).toBe(opsLines.reduce((s, l) => s + l.totalCores, 0))
    expect(r.opsRamGB).toBe(opsLines.reduce((s, l) => s + l.totalRamGB, 0))
  })

  it('automationCores/RamGB summed from automation category lines', () => {
    const r = calcManagementFull(baseConfig(), [])
    const autoLines = r.appliances.filter(l => l.category === 'automation')
    expect(r.automationCores).toBe(autoLines.reduce((s, l) => s + l.totalCores, 0))
    expect(r.automationRamGB).toBe(autoLines.reduce((s, l) => s + l.totalRamGB, 0))
  })
})
