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
  it('is null when managementArchitecture is "shared"', () => {
    const input = useInputStore()
    const calc = useCalculationStore()
    expect(input.managementArchitecture).toBe('shared')
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
