/// <reference types="vitest/globals" />
import { setActivePinia, createPinia } from 'pinia'
import { useInputStore } from './inputStore'
import { useCalculationStore } from './calculationStore'
import { readFileSync } from 'fs'
import { resolve } from 'path'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('calculationStore — domainResults (DOM-05, demand-driven)', () => {
  it('domainResults has length 1 with default store state', () => {
    const calc = useCalculationStore()
    expect(calc.domainResults).toHaveLength(1)
  })

  it('domainResults has length 2 after addDomain()', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    input.addDomain()
    expect(calc.domainResults).toHaveLength(2)
  })

  it('domainResults[0].id / name track workloadDomains[0]', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.domainResults[0].id).toBe(input.workloadDomains[0].id)
    expect(calc.domainResults[0].name).toBe('WLD-1')
  })

  it('demandHostsPerSite and totalHosts are positive (host counts are OUTPUTS)', () => {
    const calc = useCalculationStore()
    expect(calc.domainResults[0].demandHostsPerSite).toBeGreaterThan(0)
    expect(calc.domainResults[0].totalHosts).toBeGreaterThan(0)
    expect(calc.domainResults[0].clusterCountPerSite).toBeGreaterThanOrEqual(1)
  })

  it('stretch is null when deploymentMode is "ha"; vsanMax is null for vsan-esa', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(input.workloadDomains[0].deploymentMode).toBe('ha')
    expect(calc.domainResults[0].stretch).toBeNull()
    expect(calc.domainResults[0].vsanMax).toBeNull()
  })

  it('validationErrors is an array', () => {
    const calc = useCalculationStore()
    expect(Array.isArray(calc.domainResults[0].validationErrors)).toBe(true)
  })
})

describe('calculationStore — aggregateTotals (DOM-06, demand-driven)', () => {
  it('totalRecommendedHosts = sum of domain totalHosts (+ mgmt) ', () => {
    const calc = useCalculationStore()
    const workloadHosts = calc.domainResults.reduce((s, d) => s + d.totalHosts, 0)
    const mgmt = calc.dedicatedMgmtHostCount ?? 0
    expect(calc.aggregateTotals.totalRecommendedHosts).toBe(workloadHosts + mgmt)
  })

  it('totalVmCount = 100 default; doubles after adding identical domain', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.aggregateTotals.totalVmCount).toBe(100)
    input.addDomain()
    expect(calc.aggregateTotals.totalVmCount).toBe(200)
  })

  it('totalRecommendedHosts increases after adding a second domain', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    const single = calc.aggregateTotals.totalRecommendedHosts
    input.addDomain()
    expect(calc.aggregateTotals.totalRecommendedHosts).toBeGreaterThan(single)
  })

  it('totalClusterCount is at least 1 and matches summed cluster breakdowns', () => {
    const calc = useCalculationStore()
    const expected = calc.domainResults.reduce((s, d) => s + d.clusters.length, 0)
    expect(calc.aggregateTotals.totalClusterCount).toBe(expected)
    expect(calc.aggregateTotals.totalClusterCount).toBeGreaterThanOrEqual(1)
  })

  it('totalRawStorageTiB / totalEffectiveStorageTiB are positive', () => {
    const calc = useCalculationStore()
    expect(calc.aggregateTotals.totalRawStorageTiB).toBeGreaterThan(0)
    expect(calc.aggregateTotals.totalEffectiveStorageTiB).toBeGreaterThan(0)
  })

  it('vsan-esa totalRawStorageTiB = provisioned hosts × per-host storage', () => {
    const calc = useCalculationStore()
    const d = calc.domainResults[0]
    expect(calc.aggregateTotals.totalRawStorageTiB).toBeCloseTo(d.hostsPerSite * 3.84, 2)
  })

  it('FC domain: reports POOL as raw capacity and demand as required pool (the fix)', () => {
    const input = useInputStore()
    input.updateDomain(input.workloadDomains[0].id, {
      storageType: 'fc',
      vmCount: 1000,
      avgStorageGbPerVm: 970,
      externalStorageUsableTiB: 100,
    })
    const calc = useCalculationStore()
    // demand = 1000 × 970 / 1024 = 947.265625
    expect(calc.aggregateTotals.totalWorkloadStorageRequiredTiB).toBeCloseTo(947.265625, 2)
    expect(calc.aggregateTotals.totalRequiredPoolTiB).toBeCloseTo(947.265625, 2)
    // raw capacity is the actual pool (100), NOT the demand — the old bug reported demand here
    expect(calc.aggregateTotals.totalRawStorageTiB).toBeCloseTo(100, 2)
    expect(calc.aggregateTotals.totalPoolShortfallTiB).toBeCloseTo(847.265625, 2)
    expect(calc.aggregateTotals.allValidationErrors.map(e => e.code)).toContain('FC_POOL_SHORTFALL')
  })

  it('stretch domain: totalHosts = 2 × per-site; no manual host inputs', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    input.updateDomain(input.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const d = calc.domainResults[0]
    expect(d.totalHosts).toBe(d.hostsPerSite * 2)
    // single domain + colocated mgmt (0 dedicated hosts) → aggregate equals the domain total
    expect(calc.aggregateTotals.totalRecommendedHosts).toBe(d.totalHosts)
  })
})

describe('calculationStore — dedicatedMgmtHostCount (DOM-03)', () => {
  it('is null when managementArchitecture is "colocated"', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(input.managementArchitecture).toBe('colocated')
    expect(calc.dedicatedMgmtHostCount).toBeNull()
  })

  it('is a number >= 4 when managementArchitecture is "dedicated"', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    const calc = useCalculationStore()
    expect(calc.dedicatedMgmtHostCount).toBeGreaterThanOrEqual(4)
  })

  it('reads from managementDomain host specs, not workloadDomains[0]', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    const calc = useCalculationStore()
    const baseCount = calc.dedicatedMgmtHostCount!
    input.managementDomain.coresPerSocket = 8
    expect(calc.dedicatedMgmtHostCount!).toBeGreaterThanOrEqual(baseCount)
    input.managementDomain.coresPerSocket = 16
    expect(calc.dedicatedMgmtHostCount!).toBe(baseCount)
    input.workloadDomains[0].coresPerSocket = 8
    expect(calc.dedicatedMgmtHostCount!).toBe(baseCount)
  })

  // Unification: the store reads calcManagementFull.totalHosts — no separate calc.
  it('equals management.totalHosts (single source of truth)', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    const calc = useCalculationStore()
    expect(calc.dedicatedMgmtHostCount).toBe(calc.management.totalHosts)
  })

  // Stretch total is exactly 2 × per-site (no per-site/total double-count).
  it('stretch total = 2 × per-site (recommendedHostCount), no double-count', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    input.managementDomain.deploymentMode = 'stretch'
    const calc = useCalculationStore()
    expect(calc.dedicatedMgmtHostCount).toBe(calc.management.recommendedHostCount * 2)
    expect(calc.management.preferredSiteHosts).toBe(calc.management.recommendedHostCount)
  })

  // Floors isolated by making compute/RAM/storage demand tiny (huge host) so the
  // storage-type-aware PER-SITE floor dominates. FC = 2/site, vSAN = 4/site.
  it('floor = 2/site when dedicated + FC (KB 416270): HA→2, stretch→4', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    input.managementDomain.storageType = 'fc'
    input.managementDomain.coresPerSocket = 64
    input.managementDomain.socketsPerHost = 4
    input.managementDomain.hostRamGB = 4096 // huge → RAM never drives count
    const calc = useCalculationStore()
    input.managementDomain.deploymentMode = 'ha'
    expect(calc.dedicatedMgmtHostCount).toBe(2)
    input.managementDomain.deploymentMode = 'stretch'
    expect(calc.dedicatedMgmtHostCount).toBe(4) // 2 per site × 2
  })

  it('floor = 4/site when dedicated + vSAN (KB 392993): HA→4, stretch→8', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    input.managementDomain.storageType = 'vsan-esa'
    input.managementDomain.coresPerSocket = 64
    input.managementDomain.socketsPerHost = 4
    input.managementDomain.hostRamGB = 4096
    input.managementDomain.hostStorageTiB = 100 // huge → storage never drives count
    const calc = useCalculationStore()
    input.managementDomain.deploymentMode = 'ha'
    expect(calc.dedicatedMgmtHostCount).toBe(4)
    input.managementDomain.deploymentMode = 'stretch'
    expect(calc.dedicatedMgmtHostCount).toBe(8) // 4 per site × 2
  })
})

describe('calculationStore — management overhead routing (ENGINE-01, ENGINE-02)', () => {
  it('colocated WLD-1 demand >= dedicated WLD-1 demand (overhead added to WLD-1)', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    input.managementArchitecture = 'dedicated'
    input.managementDomain.deploymentMode = 'ha'
    const dedicated = calc.domainResults[0].demandHostsPerSite
    input.managementArchitecture = 'colocated'
    const colocated = calc.domainResults[0].demandHostsPerSite
    expect(colocated).toBeGreaterThanOrEqual(dedicated)
  })

  it('dedicated mode: WLD-2 totalHosts equals WLD-1 with identical config', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    input.addDomain()
    const calc = useCalculationStore()
    const id2 = input.workloadDomains[1].id
    input.updateDomain(id2, { ...input.workloadDomains[0], id: id2, name: 'WLD-2' })
    expect(calc.domainResults[1].totalHosts).toBe(calc.domainResults[0].totalHosts)
  })

  it('colocated mode: WLD-1 totalHosts >= WLD-2 (absorbs management overhead)', () => {
    const input = useInputStore()
    input.addDomain()
    input.managementArchitecture = 'colocated'
    input.managementDomain.deploymentMode = 'ha'
    const id2 = input.workloadDomains[1].id
    input.updateDomain(id2, { ...input.workloadDomains[0], id: id2, name: 'WLD-2' })
    const calc = useCalculationStore()
    expect(calc.domainResults[0].totalHosts).toBeGreaterThanOrEqual(calc.domainResults[1].totalHosts)
  })
})

describe('calculationStore — aggregateTotals mgmt host integration (ENGINE-03)', () => {
  it('dedicated mode: totalRecommendedHosts includes dedicatedMgmtHostCount', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    const calc = useCalculationStore()
    const workloadHosts = calc.domainResults.reduce((s, d) => s + d.totalHosts, 0)
    const mgmtHosts = calc.dedicatedMgmtHostCount ?? 0
    expect(calc.aggregateTotals.totalRecommendedHosts).toBe(workloadHosts + mgmtHosts)
  })

  it('dedicated mode: aggregateTotals.mgmtHostCount equals dedicatedMgmtHostCount', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    const calc = useCalculationStore()
    expect(calc.aggregateTotals.mgmtHostCount).toBe(calc.dedicatedMgmtHostCount ?? 0)
  })

  it('colocated mode: aggregateTotals.mgmtHostCount is 0', () => {
    const input = useInputStore()
    input.managementArchitecture = 'colocated'
    const calc = useCalculationStore()
    expect(calc.aggregateTotals.mgmtHostCount).toBe(0)
  })
})

describe('calculationStore — CALC-02 compliance', () => {
  it('calculationStore.ts contains zero ref() calls', () => {
    const source = readFileSync(resolve(__dirname, './calculationStore.ts'), 'utf-8')
    const refCalls = source.match(/(?<!store[Tt]o|Computed)ref\s*\(/g) || []
    expect(refCalls).toHaveLength(0)
  })
})

describe('calculationStore — calcManagementFull integration (Phase 3)', () => {
  it('management.appliances is populated', () => {
    const calc = useCalculationStore()
    expect(calc.management.appliances.length).toBeGreaterThan(0)
    expect(calc.management.appliances.find(l => l.category === 'sddcManager')).toBeDefined()
  })

  it('management.wldOverhead is auto-derived from inputStore.workloadDomains', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.management.wldOverhead.length).toBe(input.workloadDomains.length * 2)
  })

  it('management.recommendedHostCount is non-zero', () => {
    const calc = useCalculationStore()
    expect(calc.management.recommendedHostCount).toBeGreaterThan(0)
  })

  it('management.totalDiskGB is populated', () => {
    const calc = useCalculationStore()
    expect(calc.management.totalDiskGB).toBeGreaterThan(0)
  })

  it('legacy flat fields still populated for usePptxExport compatibility', () => {
    const calc = useCalculationStore()
    expect(calc.management.vcenterCores).toBeGreaterThan(0)
    expect(calc.management.sddcCores).toBe(4)
    expect(calc.management.nsxCores).toBeGreaterThan(0)
  })

  it('changing inputStore.managementDomain.profile recomputes totals', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    const standardTotal = calc.management.totalCores
    input.managementDomain.profile = 'lab'
    expect(calc.management.totalCores).toBeLessThan(standardTotal)
  })
})
