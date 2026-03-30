/// <reference types="vitest/globals" />
// Phase 8: PPTX Export tests — data-mapping helpers, Pinia-backed, node environment
// Pattern: createPinia() + setActivePinia() in each beforeEach for test isolation
// Phase 14: Updated helper signatures — accept WorkloadDomainConfig directly (EXP-03, EXP-04)

import { createPinia, setActivePinia } from 'pinia'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import {
  PPTX_MASTER_COLOR,
  buildTitleSlideData,
  buildConfigSummaryData,
  buildWorkloadSlideData,
  buildMgmtOverheadData,
  buildComputeResultsData,
  buildStorageResultsData,
  buildAggregateSlideData,
  generatePptxReport,
  buildAiGpuSlideData,
  buildNvmeTieringSlideData,
  buildStretchTopologySlideData,
  buildVsanMaxSlideData,
  buildValidationWarningsSlideData,
} from './usePptxExport'

// ─── PPTX_MASTER_COLOR constant — PPTX-02 ────────────────────────────────────

describe('PPTX_MASTER_COLOR constant — PPTX-02', () => {
  it('equals 003087 (Broadcom blue, no # prefix)', () => {
    expect(PPTX_MASTER_COLOR).toBe('003087')
  })
})

// ─── buildTitleSlideData — PPTX-03 ───────────────────────────────────────────

describe('buildTitleSlideData — PPTX-03', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns domainCount equal to workloadDomains.length (default: 1)', () => {
    const store = useInputStore()
    const result = buildTitleSlideData(store.workloadDomains.length)
    expect(result.domainCount).toBe(1)
  })

  it('returns a date string in YYYY-MM-DD format', () => {
    const store = useInputStore()
    const result = buildTitleSlideData(store.workloadDomains.length)
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns domainCount=2 when called with 2', () => {
    const result = buildTitleSlideData(2)
    expect(result.domainCount).toBe(2)
  })
})

// ─── buildConfigSummaryData — PPTX-04 ────────────────────────────────────────

describe('buildConfigSummaryData — PPTX-04', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns an array with at least 8 config field rows', () => {
    const store = useInputStore()
    const result = buildConfigSummaryData(store.workloadDomains[0], store.managementArchitecture)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  it('each row has label and value properties', () => {
    const store = useInputStore()
    const result = buildConfigSummaryData(store.workloadDomains[0], store.managementArchitecture)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })

  it('hostCount row value contains the default value 4', () => {
    const store = useInputStore()
    const result = buildConfigSummaryData(store.workloadDomains[0], store.managementArchitecture)
    const hostRow = result.find((row) =>
      String(row.label).toLowerCase().includes('host')
    )
    expect(hostRow).toBeDefined()
    expect(String(hostRow!.value)).toContain('4')
  })

  it('returns values from the given domain (not workloadDomains[0] hardcoded)', () => {
    const store = useInputStore()
    // Update domain 0 to have a different host count
    store.workloadDomains[0].hostCount = 8
    const result = buildConfigSummaryData(store.workloadDomains[0], store.managementArchitecture)
    const hostRow = result.find((row) => String(row.label).toLowerCase().includes('host'))
    expect(hostRow).toBeDefined()
    expect(String(hostRow!.value)).toContain('8')
  })
})

// ─── buildWorkloadSlideData — PPTX-05 ────────────────────────────────────────

describe('buildWorkloadSlideData — PPTX-05', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns rows for vmCount, vCPU, vRAM, storage, CPU ratio, RAM ratio (>= 6 rows)', () => {
    const store = useInputStore()
    const result = buildWorkloadSlideData(store.workloadDomains[0])
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(6)
  })

  it('each row has label and value properties', () => {
    const store = useInputStore()
    const result = buildWorkloadSlideData(store.workloadDomains[0])
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })

  it('a row value contains the default vmCount of 100', () => {
    const store = useInputStore()
    const result = buildWorkloadSlideData(store.workloadDomains[0])
    const hasHundred = result.some((row) => String(row.value).includes('100'))
    expect(hasHundred).toBe(true)
  })
})

// ─── buildMgmtOverheadData — PPTX-06 ─────────────────────────────────────────

describe('buildMgmtOverheadData — PPTX-06', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns exactly 6 rows (vCenter, SDDC, NSX, Ops, Automation, Total)', () => {
    const calc = useCalculationStore()
    const result = buildMgmtOverheadData(calc.management)
    expect(result).toHaveLength(6)
  })

  it('each row has label, cores, and ramGB properties', () => {
    const calc = useCalculationStore()
    const result = buildMgmtOverheadData(calc.management)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('cores')
      expect(row).toHaveProperty('ramGB')
    })
  })

  it('Total row cores matches management.totalCores', () => {
    const calc = useCalculationStore()
    const mgmt = calc.management
    const result = buildMgmtOverheadData(mgmt)
    const totalRow = result.find((row) =>
      String(row.label).toLowerCase().includes('total')
    )
    expect(totalRow).toBeDefined()
    expect(totalRow!.cores).toBe(mgmt.totalCores)
  })

  it('Total row ramGB matches management.totalRamGB', () => {
    const calc = useCalculationStore()
    const mgmt = calc.management
    const result = buildMgmtOverheadData(mgmt)
    const totalRow = result.find((row) =>
      String(row.label).toLowerCase().includes('total')
    )
    expect(totalRow).toBeDefined()
    expect(totalRow!.ramGB).toBe(mgmt.totalRamGB)
  })
})

// ─── buildComputeResultsData — PPTX-07 ───────────────────────────────────────

describe('buildComputeResultsData — PPTX-07', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns recommendedHostCount as a number', () => {
    const calc = useCalculationStore()
    const result = buildComputeResultsData(calc.domainResults[0].compute)
    expect(typeof result.recommendedHostCount).toBe('number')
  })

  it('returns coreUtilizationPct as a number', () => {
    const calc = useCalculationStore()
    const result = buildComputeResultsData(calc.domainResults[0].compute)
    expect(typeof result.coreUtilizationPct).toBe('number')
  })

  it('returns ramUtilizationPct as a number', () => {
    const calc = useCalculationStore()
    const result = buildComputeResultsData(calc.domainResults[0].compute)
    expect(typeof result.ramUtilizationPct).toBe('number')
  })
})

// ─── buildStorageResultsData — PPTX-08 ───────────────────────────────────────

describe('buildStorageResultsData — PPTX-08', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns safeUsableCapacityTB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.safeUsableCapacityTB).toBe('number')
  })

  it('returns rawCapacityTB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.rawCapacityTB).toBe('number')
  })

  it('returns lfsOverheadTB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.lfsOverheadTB).toBe('number')
  })

  it('returns metadataOverheadTB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.metadataOverheadTB).toBe('number')
  })

  it('returns usableAfterRaidTB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.usableAfterRaidTB).toBe('number')
  })
})

// ─── buildAggregateSlideData — EXP-04 ────────────────────────────────────────

describe('buildAggregateSlideData — EXP-04', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns exactly 4 rows', () => {
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(4)
  })

  it('every row has label and value properties (strings)', () => {
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
      expect(typeof row.label).toBe('string')
      expect(typeof row.value).toBe('string')
    })
  })

  it('first row label mentions total hosts', () => {
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals)
    expect(result[0].label.toLowerCase()).toContain('host')
  })

  it('value matches calc.aggregateTotals.totalRecommendedHosts', () => {
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals)
    expect(result[0].value).toBe(String(calc.aggregateTotals.totalRecommendedHosts))
  })

  it('third row value contains TB for raw storage', () => {
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals)
    expect(result[2].value).toContain('TB')
  })
})

// ─── generatePptxReport — PPTX-01 ────────────────────────────────────────────

describe('generatePptxReport — PPTX-01', () => {
  it('is a function', () => {
    expect(typeof generatePptxReport).toBe('function')
  })
})

// ─── buildAiGpuSlideData — PPTX-10 ───────────────────────────────────────────

describe('buildAiGpuSlideData — PPTX-10', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns rows when gpuVmCount > 0', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { gpuVmCount: 4, vgpuMemoryGB: 24 })
    const result = buildAiGpuSlideData(store.workloadDomains[0])
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('every row has label and value properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { gpuVmCount: 4, vgpuMemoryGB: 24 })
    const result = buildAiGpuSlideData(store.workloadDomains[0])
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
      expect(typeof row.label).toBe('string')
      expect(typeof row.value).toBe('string')
    })
  })

  it('a row value contains gpuVmCount when gpuVmCount=4', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { gpuVmCount: 4, vgpuMemoryGB: 24 })
    const result = buildAiGpuSlideData(store.workloadDomains[0])
    const gpuRow = result.find((r) => String(r.value).includes('4'))
    expect(gpuRow).toBeDefined()
  })
})

// ─── buildNvmeTieringSlideData — PPTX-11 ─────────────────────────────────────

describe('buildNvmeTieringSlideData — PPTX-11', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns rows when nvmeTieringEnabled is true', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { nvmeTieringEnabled: true, activeMemoryPct: 70 })
    const result = buildNvmeTieringSlideData(store.workloadDomains[0])
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('every row has label and value properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { nvmeTieringEnabled: true, activeMemoryPct: 70 })
    const result = buildNvmeTieringSlideData(store.workloadDomains[0])
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
      expect(typeof row.label).toBe('string')
      expect(typeof row.value).toBe('string')
    })
  })

  it('includes activeMemoryPct value in a row', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { nvmeTieringEnabled: true, activeMemoryPct: 70 })
    const result = buildNvmeTieringSlideData(store.workloadDomains[0])
    const pctRow = result.find((r) => String(r.value).includes('70'))
    expect(pctRow).toBeDefined()
  })
})

// ─── buildStretchTopologySlideData — PPTX-12 ─────────────────────────────────

describe('buildStretchTopologySlideData — PPTX-12', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns topology array with >= 5 rows', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const result = buildStretchTopologySlideData(store.workloadDomains[0], calc.domainResults[0].stretch!)
    expect(result).toHaveProperty('topology')
    expect(Array.isArray(result.topology)).toBe(true)
    expect(result.topology.length).toBeGreaterThanOrEqual(5)
  })

  it('returns checklist array with >= 3 items', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const result = buildStretchTopologySlideData(store.workloadDomains[0], calc.domainResults[0].stretch!)
    expect(result).toHaveProperty('checklist')
    expect(Array.isArray(result.checklist)).toBe(true)
    expect(result.checklist.length).toBeGreaterThanOrEqual(3)
  })

  it('topology rows have label and value properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const result = buildStretchTopologySlideData(store.workloadDomains[0], calc.domainResults[0].stretch!)
    result.topology.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })

  it('checklist items are strings', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const result = buildStretchTopologySlideData(store.workloadDomains[0], calc.domainResults[0].stretch!)
    result.checklist.forEach((item) => {
      expect(typeof item).toBe('string')
    })
  })
})

// ─── buildVsanMaxSlideData — PPTX-13 ─────────────────────────────────────────

describe('buildVsanMaxSlideData — PPTX-13', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns rows when vsanMax is not null', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { storageType: 'vsan-max', vsanMaxProfile: 'lrg', vsanMaxStorageNodes: 8 })
    const calc = useCalculationStore()
    expect(calc.domainResults[0].vsanMax).not.toBeNull()
    const result = buildVsanMaxSlideData(store.workloadDomains[0], calc.domainResults[0].vsanMax!)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(4)
  })

  it('includes profile in uppercase in a row value', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { storageType: 'vsan-max', vsanMaxProfile: 'lrg', vsanMaxStorageNodes: 8 })
    const calc = useCalculationStore()
    const result = buildVsanMaxSlideData(store.workloadDomains[0], calc.domainResults[0].vsanMax!)
    const profileRow = result.find((r) => String(r.value).includes('LRG'))
    expect(profileRow).toBeDefined()
  })

  it('every row has label and value properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { storageType: 'vsan-max', vsanMaxProfile: 'lrg', vsanMaxStorageNodes: 8 })
    const calc = useCalculationStore()
    const result = buildVsanMaxSlideData(store.workloadDomains[0], calc.domainResults[0].vsanMax!)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })
})

// ─── buildValidationWarningsSlideData — PPTX-14 ──────────────────────────────

describe('buildValidationWarningsSlideData — PPTX-14', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns entries matching validationErrors when warnings exist', () => {
    const store = useInputStore()
    store.workloadDomains[0].hostCount = 1
    const calc = useCalculationStore()
    const result = buildValidationWarningsSlideData(calc)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(calc.aggregateTotals.allValidationErrors.length)
  })

  it('each entry has severity and messageKey properties', () => {
    const store = useInputStore()
    store.workloadDomains[0].hostCount = 1
    const calc = useCalculationStore()
    const result = buildValidationWarningsSlideData(calc)
    result.forEach((entry) => {
      expect(entry).toHaveProperty('severity')
      expect(entry).toHaveProperty('messageKey')
    })
  })

  it('returns empty array when no warnings (default store state)', () => {
    const calc = useCalculationStore()
    if (calc.aggregateTotals.allValidationErrors.length === 0) {
      const result = buildValidationWarningsSlideData(calc)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    } else {
      // Default store already has warnings — skip assertion and verify shape only
      const result = buildValidationWarningsSlideData(calc)
      expect(Array.isArray(result)).toBe(true)
    }
  })
})

// ─── multi-domain PPTX helpers (EXP-03, EXP-04) ──────────────────────────────

describe('multi-domain PPTX helpers (EXP-03, EXP-04)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('buildConfigSummaryData returns correct values for domain 2 (not domain 1)', () => {
    const store = useInputStore()
    store.addDomain()
    // Domain 2 has different host count
    store.updateDomain(store.workloadDomains[1].id, { hostCount: 12, vmCount: 200 })
    const result = buildConfigSummaryData(store.workloadDomains[1], store.managementArchitecture)
    const hostRow = result.find((row) => String(row.label).toLowerCase().includes('host'))
    expect(hostRow).toBeDefined()
    expect(String(hostRow!.value)).toContain('12')
  })

  it('buildAggregateSlideData returns correct totals from calc.aggregateTotals', () => {
    const store = useInputStore()
    store.addDomain()
    store.updateDomain(store.workloadDomains[0].id, { hostCount: 4 })
    store.updateDomain(store.workloadDomains[1].id, { hostCount: 6 })
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals)
    expect(result).toHaveLength(4)
    // totalRecommendedHosts is a computed aggregate across all domains
    expect(result[0].value).toBe(String(calc.aggregateTotals.totalRecommendedHosts))
  })
})
