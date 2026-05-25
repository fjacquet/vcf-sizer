/// <reference types="vitest/globals" />
import { calcAppliances, calcValidatedSolutions } from './appliances'
import type { ManagementDomainConfig } from './types'

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

describe('calcAppliances — Standard profile + Simple mode', () => {
  it('emits SDDC Manager always (4/16/914 × 1)', () => {
    const lines = calcAppliances(baseConfig())
    const sddc = lines.find(l => l.category === 'sddcManager')
    expect(sddc).toBeDefined()
    expect(sddc!.cores).toBe(4)
    expect(sddc!.ramGB).toBe(16)
    expect(sddc!.diskGB).toBe(914)
    expect(sddc!.nodeCount).toBe(1)
    expect(sddc!.totalCores).toBe(4)
  })

  it('emits Fleet Manager always (4/12/194 × 1)', () => {
    const lines = calcAppliances(baseConfig())
    const fm = lines.find(l => l.category === 'fleetManager')
    expect(fm).toBeDefined()
    expect(fm!.cores).toBe(4)
    expect(fm!.ramGB).toBe(12)
    expect(fm!.diskGB).toBe(194)
    expect(fm!.nodeCount).toBe(1)
  })

  it('vCenter Medium × 1 in Simple mode', () => {
    const lines = calcAppliances(baseConfig())
    const vc = lines.find(l => l.category === 'vcenter')
    expect(vc).toBeDefined()
    expect(vc!.cores).toBe(8)
    expect(vc!.ramGB).toBe(30)
    expect(vc!.diskGB).toBe(858)
    expect(vc!.nodeCount).toBe(1)
    expect(vc!.totalCores).toBe(8)
    expect(vc!.totalRamGB).toBe(30)
    expect(vc!.source).toBe('profile')
  })

  it('NSX Manager Medium × 1 in Simple mode (no HA fanout)', () => {
    const lines = calcAppliances(baseConfig())
    const nsx = lines.find(l => l.category === 'nsxManager')
    expect(nsx).toBeDefined()
    expect(nsx!.nodeCount).toBe(1)
    expect(nsx!.totalCores).toBe(6)
    expect(nsx!.totalRamGB).toBe(24)
  })

  it('NSX Edge Large × 2 (always pair, regardless of mode)', () => {
    const lines = calcAppliances(baseConfig())
    const edge = lines.find(l => l.category === 'nsxEdge')
    expect(edge).toBeDefined()
    expect(edge!.nodeCount).toBe(2)
    expect(edge!.totalCores).toBe(16)
    expect(edge!.totalRamGB).toBe(64)
  })

  it('AVI LB Small × 3 (always cluster, regardless of mode)', () => {
    const lines = calcAppliances(baseConfig())
    const avi = lines.find(l => l.category === 'aviLb')
    expect(avi).toBeDefined()
    expect(avi!.nodeCount).toBe(3)
    expect(avi!.totalCores).toBe(18)
    expect(avi!.totalRamGB).toBe(96)
  })

  it('vROps Medium × 1 in Simple mode (no HA fanout)', () => {
    const lines = calcAppliances(baseConfig())
    const vrops = lines.find(l => l.category === 'vrops')
    expect(vrops).toBeDefined()
    expect(vrops!.nodeCount).toBe(1)
    expect(vrops!.totalCores).toBe(8)
  })

  it('excludes vropsCollector / identityBroker / ssp by default in Standard', () => {
    const lines = calcAppliances(baseConfig())
    expect(lines.find(l => l.category === 'vropsCollector')).toBeUndefined()
    expect(lines.find(l => l.category === 'identityBroker')).toBeUndefined()
    expect(lines.find(l => l.category === 'ssp')).toBeUndefined()
  })

  it('emits VCFMS control + worker (Medium × 1) in Simple mode (no HA fanout)', () => {
    const lines = calcAppliances(baseConfig())
    const control = lines.find(l => l.category === 'vcfmsControl')!
    const worker = lines.find(l => l.category === 'vcfmsWorker')!
    // vcfmsControl medium 4/10/100, vcfmsWorker medium 24/48/100
    expect(control.nodeCount).toBe(1)
    expect(control.totalCores).toBe(4)
    expect(control.totalRamGB).toBe(10)
    expect(worker.nodeCount).toBe(1)
    expect(worker.totalCores).toBe(24)
    expect(worker.totalRamGB).toBe(48)
  })

  it('does not emit lines for excluded categories', () => {
    const lines = calcAppliances(baseConfig())
    // Standard includes: vcenter, nsxManager, nsxEdge, aviLb, vrops, vrli, vrni,
    //   automation, fleetManager, vcfmsControl, vcfmsWorker (11)
    // Plus always: sddcManager (1)
    // Standard excludes: vropsCollector, vrniCollector, identityBroker, ssp
    expect(lines.length).toBe(12)
  })
})

describe('calcAppliances — HA fanout (mode = "ha")', () => {
  it('NSX Manager fans out to nodeCount=3 in HA mode', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const nsx = lines.find(l => l.category === 'nsxManager')!
    expect(nsx.nodeCount).toBe(3)
    expect(nsx.totalCores).toBe(18)
    expect(nsx.totalRamGB).toBe(72)
  })

  it('vROps fans out to 3 in HA mode', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const vrops = lines.find(l => l.category === 'vrops')!
    expect(vrops.nodeCount).toBe(3)
    expect(vrops.totalCores).toBe(24)
  })

  it('VCF Automation fans out to 3 in HA mode', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const auto = lines.find(l => l.category === 'automation')!
    expect(auto.nodeCount).toBe(3)
    expect(auto.totalCores).toBe(72)
  })

  it('vRLI fans out to 3 in HA mode', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const vrli = lines.find(l => l.category === 'vrli')!
    expect(vrli.nodeCount).toBe(3)
  })

  it('VCFMS control + worker fan out to 3 in HA mode', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const control = lines.find(l => l.category === 'vcfmsControl')!
    const worker = lines.find(l => l.category === 'vcfmsWorker')!
    expect(control.nodeCount).toBe(3)
    expect(control.totalCores).toBe(12)   // 4 × 3
    expect(worker.nodeCount).toBe(3)
    expect(worker.totalCores).toBe(72)    // 24 × 3
  })

  it('Fleet Manager stays nodeCount=1 in HA (singleton — MGMT-04 invariant)', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'ha' as const }
    const lines = calcAppliances(cfg)
    const fm = lines.find(l => l.category === 'fleetManager')!
    expect(fm.nodeCount).toBe(1)
  })

  it('Stretch mode behaves like HA for fanout', () => {
    const cfg = { ...baseConfig(), deploymentMode: 'stretch' as const }
    const lines = calcAppliances(cfg)
    const nsx = lines.find(l => l.category === 'nsxManager')!
    expect(nsx.nodeCount).toBe(3)
  })
})

describe('calcAppliances — overrides', () => {
  it('size override changes the spec, source becomes "override"', () => {
    const cfg = baseConfig()
    cfg.overrides = { vcenter: { size: 'large' } }
    const lines = calcAppliances(cfg)
    const vc = lines.find(l => l.category === 'vcenter')!
    expect(vc.cores).toBe(16)
    expect(vc.ramGB).toBe(39)
    expect(vc.diskGB).toBe(1158)
    expect(vc.source).toBe('override')
  })

  it('included=false override removes the appliance line', () => {
    const cfg = baseConfig()
    cfg.overrides = { vrli: { included: false } }
    const lines = calcAppliances(cfg)
    expect(lines.find(l => l.category === 'vrli')).toBeUndefined()
  })

  it('included=true override on a profile-OFF category emits the line', () => {
    const cfg = baseConfig()
    cfg.overrides = { ssp: { included: true, size: 'medium' } }
    const lines = calcAppliances(cfg)
    const ssp = lines.find(l => l.category === 'ssp')
    expect(ssp).toBeDefined()
    expect(ssp!.cores).toBe(112)
    expect(ssp!.source).toBe('override')
  })

  it('nodeCount override: AVI from 3 to 1', () => {
    const cfg = baseConfig()
    cfg.overrides = { aviLb: { nodeCount: 1 } }
    const lines = calcAppliances(cfg)
    const avi = lines.find(l => l.category === 'aviLb')!
    expect(avi.nodeCount).toBe(1)
    expect(avi.totalCores).toBe(6)
    expect(avi.source).toBe('override')
  })
})

describe('calcAppliances — Lab profile', () => {
  it('Lab excludes Edge / AVI / vRLI / vRNI', () => {
    const cfg = { ...baseConfig(), profile: 'lab' as const }
    const lines = calcAppliances(cfg)
    expect(lines.find(l => l.category === 'nsxEdge')).toBeUndefined()
    expect(lines.find(l => l.category === 'aviLb')).toBeUndefined()
    expect(lines.find(l => l.category === 'vrli')).toBeUndefined()
    expect(lines.find(l => l.category === 'vrni')).toBeUndefined()
  })

  it('Lab vCenter is Small (not Medium)', () => {
    const cfg = { ...baseConfig(), profile: 'lab' as const }
    const lines = calcAppliances(cfg)
    const vc = lines.find(l => l.category === 'vcenter')!
    expect(vc.cores).toBe(4)
    expect(vc.ramGB).toBe(21)
  })
})

describe('calcValidatedSolutions', () => {
  it('returns empty array when all toggles are false', () => {
    const cfg = baseConfig()
    expect(calcValidatedSolutions(cfg.validatedSolutions!, cfg.deploymentMode)).toEqual([])
  })

  it('emits Site Protection / SRM line when enabled', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions!.siteProtection = { included: true, mgmtSize: 'standard' }
    const lines = calcValidatedSolutions(cfg.validatedSolutions!, cfg.deploymentMode)
    expect(lines.length).toBe(1)
    expect(lines[0].category).toBe('siteRecovery')
    expect(lines[0].cores).toBe(8)
    expect(lines[0].ramGB).toBe(24)
    expect(lines[0].diskGB).toBe(800)
    expect(lines[0].source).toBe('validated-solution')
  })

  it('emits multiple lines when multiple solutions enabled', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions!.siteProtection = { included: true, mgmtSize: 'standard' }
    cfg.validatedSolutions!.crossCloudMobility = { included: true }
    const lines = calcValidatedSolutions(cfg.validatedSolutions!, cfg.deploymentMode)
    expect(lines.length).toBe(2)
    const cats = lines.map(l => l.category).sort()
    expect(cats).toEqual(['crossCloudMobility', 'siteRecovery'])
  })

  it('SRM size defaults to "standard" if not specified', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions!.siteProtection = { included: true }
    const lines = calcValidatedSolutions(cfg.validatedSolutions!, cfg.deploymentMode)
    expect(lines[0].cores).toBe(8)
  })
})
