/// <reference types="vitest/globals" />
import { setActivePinia, createPinia } from 'pinia'
import { useInputStore } from './inputStore'
import { useCalculationStore } from './calculationStore'
import { readFileSync } from 'fs'
import { resolve } from 'path'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('calculationStore — domainResults (DOM-05)', () => {
  it('domainResults has length 1 with default store state', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.domainResults).toHaveLength(1)
  })

  it('domainResults has length 2 after addDomain()', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    input.addDomain()
    expect(calc.domainResults).toHaveLength(2)
  })

  it('domainResults[0].id matches workloadDomains[0].id', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.domainResults[0].id).toBe(input.workloadDomains[0].id)
  })

  it('domainResults[0].name matches workloadDomains[0].name', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.domainResults[0].name).toBe('WLD-1')
  })

  it('domainResults[0].compute.recommendedHostCount is a positive number', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.domainResults[0].compute.recommendedHostCount).toBeGreaterThan(0)
  })

  it('domainResults[0].stretch is null when deploymentMode is "ha"', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(input.workloadDomains[0].deploymentMode).toBe('ha')
    expect(calc.domainResults[0].stretch).toBeNull()
  })

  it('domainResults[0].vsanMax is null when storageType is "vsan-esa"', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(input.workloadDomains[0].storageType).toBe('vsan-esa')
    expect(calc.domainResults[0].vsanMax).toBeNull()
  })

  it('domainResults[0].validationErrors is an array', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(Array.isArray(calc.domainResults[0].validationErrors)).toBe(true)
  })
})

describe('calculationStore — aggregateTotals (DOM-06)', () => {
  it('totalRecommendedHosts equals domainResults[0].compute.recommendedHostCount with 1 domain', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.aggregateTotals.totalRecommendedHosts).toBe(
      calc.domainResults[0].compute.recommendedHostCount
    )
  })

  it('totalVmCount equals 100 with default single domain', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.aggregateTotals.totalVmCount).toBe(100)
  })

  it('totalVmCount doubles after adding second identical domain', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    const singleTotal = calc.aggregateTotals.totalVmCount
    input.addDomain()
    expect(calc.aggregateTotals.totalVmCount).toBe(singleTotal * 2)
  })

  it('totalRecommendedHosts increases after adding second domain', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    const singleHosts = calc.aggregateTotals.totalRecommendedHosts
    input.addDomain()
    expect(calc.aggregateTotals.totalRecommendedHosts).toBeGreaterThan(singleHosts)
  })

  it('allValidationErrors is flat array combining all domain errors', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(Array.isArray(calc.aggregateTotals.allValidationErrors)).toBe(true)
  })

  it('totalRawStorageTB is a positive number', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.aggregateTotals.totalRawStorageTB).toBeGreaterThan(0)
  })

  it('totalEffectiveStorageTB is a positive number', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(calc.aggregateTotals.totalEffectiveStorageTB).toBeGreaterThan(0)
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

    // Change managementDomain specs — should change dedicatedMgmtHostCount
    input.managementDomain.coresPerSocket = 8 // halve cores → need more hosts
    const afterMgmtChange = calc.dedicatedMgmtHostCount!
    expect(afterMgmtChange).toBeGreaterThanOrEqual(baseCount)

    // Reset managementDomain, change workloadDomains[0] — should NOT change dedicatedMgmtHostCount
    input.managementDomain.coresPerSocket = 16
    const afterReset = calc.dedicatedMgmtHostCount!
    expect(afterReset).toBe(baseCount)

    input.workloadDomains[0].coresPerSocket = 8
    const afterWorkloadChange = calc.dedicatedMgmtHostCount!
    expect(afterWorkloadChange).toBe(baseCount) // unchanged — reads from managementDomain
  })

  it('is >= 8 when dedicated and deploymentMode is "stretch"', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    input.managementDomain.deploymentMode = 'stretch'
    const calc = useCalculationStore()
    expect(calc.dedicatedMgmtHostCount).toBeGreaterThanOrEqual(8)
  })

  it('returns exactly 8 when stretch floor applies and compute-driven count would be < 8', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    input.managementDomain.deploymentMode = 'stretch'
    input.managementDomain.coresPerSocket = 64  // 64×4=256 cores/host → ceil(118/256)=1
    input.managementDomain.socketsPerHost = 4
    const calc = useCalculationStore()
    expect(calc.dedicatedMgmtHostCount).toBe(8)
  })

  it('is >= 4 (not forced to 8) when dedicated and deploymentMode is "ha"', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    input.managementDomain.deploymentMode = 'ha'
    const calc = useCalculationStore()
    expect(calc.dedicatedMgmtHostCount).toBeGreaterThanOrEqual(4)
  })
})

describe('calculationStore — management overhead routing (ENGINE-01, ENGINE-02)', () => {
  it('dedicated mode: WLD-1 compute.recommendedHostCount is NOT inflated by management overhead', () => {
    const input = useInputStore()
    const calc = useCalculationStore()

    // Set dedicated mode with large management overhead
    input.managementArchitecture = 'dedicated'
    input.managementDomain.deploymentMode = 'ha' // ha = full 3x overhead

    // Get WLD-1 host count — should be workload-only, no management overhead
    const wld1Hosts = calc.domainResults[0].compute.recommendedHostCount

    // Set colocated and verify host count increases (proving management overhead is now added)
    input.managementArchitecture = 'colocated'
    const wld1HostsColocated = calc.domainResults[0].compute.recommendedHostCount

    expect(wld1HostsColocated).toBeGreaterThanOrEqual(wld1Hosts)
  })

  it('dedicated mode: WLD-2 equals WLD-1 with identical config', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    input.addDomain()
    // Make WLD-2 identical to WLD-1 (addDomain copies defaults, should be same)
    const calc = useCalculationStore()
    const id2 = input.workloadDomains[1].id
    input.updateDomain(id2, { ...input.workloadDomains[0], id: id2, name: 'WLD-2' })
    expect(calc.domainResults[1].compute.recommendedHostCount).toBe(
      calc.domainResults[0].compute.recommendedHostCount
    )
  })

  it('colocated mode: WLD-1 host count absorbs management overhead', () => {
    const input = useInputStore()
    input.addDomain()
    input.managementArchitecture = 'colocated'
    input.managementDomain.deploymentMode = 'ha' // maximize management overhead
    const id2 = input.workloadDomains[1].id
    input.updateDomain(id2, { ...input.workloadDomains[0], id: id2, name: 'WLD-2' })
    const calc = useCalculationStore()
    // WLD-1 absorbs management overhead → host count >= WLD-2
    expect(calc.domainResults[0].compute.recommendedHostCount).toBeGreaterThanOrEqual(
      calc.domainResults[1].compute.recommendedHostCount
    )
  })
})

describe('calculationStore — aggregateTotals mgmt host integration (ENGINE-03)', () => {
  it('dedicated mode: aggregateTotals.totalRecommendedHosts includes dedicatedMgmtHostCount', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    const calc = useCalculationStore()
    const workloadHosts = calc.domainResults.reduce(
      (sum, d) => sum + d.compute.recommendedHostCount, 0
    )
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
    const source = readFileSync(
      resolve(__dirname, './calculationStore.ts'),
      'utf-8'
    )
    // Match ref( but not storeToRefs( or Ref< or ComputedRef
    const refCalls = source.match(/(?<!store[Tt]o|Computed)ref\s*\(/g) || []
    expect(refCalls).toHaveLength(0)
  })
})
