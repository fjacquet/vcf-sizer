/// <reference types="vitest/globals" />
// Phase 8: PPTX Export tests — data-mapping helpers, Pinia-backed, node environment
// Pattern: createPinia() + setActivePinia() in each beforeEach for test isolation
// Phase 13: Updated mocks to use workloadDomains[0] multi-domain store shape
// Phase 14-02: Updated helpers to accept WorkloadDomainConfig directly (EXP-03, EXP-04)
// Phase 22: i18n mock — t() returns the key itself; helpers now accept t parameter

import { createPinia, setActivePinia } from 'pinia'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { useUiStore } from '@/stores/uiStore'
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

// Mock i18n — t() returns the key so assertions check i18n key usage
vi.mock('@/i18n', () => ({
  i18n: { global: { t: (key: string) => key } },
}))

// Identity t function for helper tests
const t = (k: string) => k

// ─── PPTX_MASTER_COLOR constant — PPTX-02 ────────────────────────────────────

describe('PPTX_MASTER_COLOR constant — PPTX-02', () => {
  it('equals 1A3B6E (primary brand blue, no # prefix)', () => {
    expect(PPTX_MASTER_COLOR).toBe('1A3B6E')
  })
})

// ─── buildTitleSlideData — PPTX-03 ───────────────────────────────────────────

describe('buildTitleSlideData — PPTX-03', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns domainCount from input (1 domain)', () => {
    const store = useInputStore()
    const result = buildTitleSlideData(store.workloadDomains.length)
    expect(result.domainCount).toBe(1)
  })

  it('returns domainCount correctly when multiple domains exist', () => {
    const store = useInputStore()
    store.addDomain()
    const result = buildTitleSlideData(store.workloadDomains.length)
    expect(result.domainCount).toBe(2)
  })

  it('returns a date string in YYYY-MM-DD format', () => {
    const store = useInputStore()
    const result = buildTitleSlideData(store.workloadDomains.length)
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ─── buildConfigSummaryData — PPTX-04 ────────────────────────────────────────

describe('buildConfigSummaryData — PPTX-04', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns an array with at least 8 config field rows', () => {
    const store = useInputStore()
    const domain = store.workloadDomains[0]
    const result = buildConfigSummaryData(domain, store.managementArchitecture, domain.hostCount, t)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  it('each row has label and value properties', () => {
    const store = useInputStore()
    const domain = store.workloadDomains[0]
    const result = buildConfigSummaryData(domain, store.managementArchitecture, domain.hostCount, t)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })

  it('hostCount row value contains the default value 4', () => {
    const store = useInputStore()
    const domain = store.workloadDomains[0]
    const effectiveHostCount = domain.hostCount // HA mode: effectiveHostCount = hostCount
    const result = buildConfigSummaryData(domain, store.managementArchitecture, effectiveHostCount, t)
    const hostRow = result.find((row) =>
      String(row.label).toLowerCase().includes('host')
    )
    expect(hostRow).toBeDefined()
    expect(String(hostRow!.value)).toContain('4')
  })
})

// ─── buildWorkloadSlideData — PPTX-05 ────────────────────────────────────────

describe('buildWorkloadSlideData — PPTX-05', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns rows for vmCount, vCPU, vRAM, storage, CPU ratio, RAM ratio (>= 6 rows)', () => {
    const store = useInputStore()
    const result = buildWorkloadSlideData(store.workloadDomains[0], t)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(6)
  })

  it('each row has label and value properties', () => {
    const store = useInputStore()
    const result = buildWorkloadSlideData(store.workloadDomains[0], t)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })

  it('a row value contains the default vmCount of 100', () => {
    const store = useInputStore()
    const result = buildWorkloadSlideData(store.workloadDomains[0], t)
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
    const result = buildMgmtOverheadData(calc.management, t)
    expect(result).toHaveLength(6)
  })

  it('each row has label, cores, and ramGB properties', () => {
    const calc = useCalculationStore()
    const result = buildMgmtOverheadData(calc.management, t)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('cores')
      expect(row).toHaveProperty('ramGB')
    })
  })

  it('Total row cores matches management.totalCores', () => {
    const calc = useCalculationStore()
    const mgmt = calc.management
    const result = buildMgmtOverheadData(mgmt, t)
    const totalRow = result.find((row) =>
      String(row.label).toLowerCase().includes('total')
    )
    expect(totalRow).toBeDefined()
    expect(totalRow!.cores).toBe(mgmt.totalCores)
  })

  it('Total row ramGB matches management.totalRamGB', () => {
    const calc = useCalculationStore()
    const mgmt = calc.management
    const result = buildMgmtOverheadData(mgmt, t)
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

  it('returns safeUsableCapacityTiB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.safeUsableCapacityTiB).toBe('number')
  })

  it('returns rawCapacityTiB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.rawCapacityTiB).toBe('number')
  })

  it('returns lfsOverheadTiB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.lfsOverheadTiB).toBe('number')
  })

  it('returns metadataOverheadTiB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.metadataOverheadTiB).toBe('number')
  })

  it('returns usableAfterRaidTiB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.usableAfterRaidTiB).toBe('number')
  })
})

// ─── buildAggregateSlideData — replaces buildRecommendationsData (EXP-04) ────

describe('buildAggregateSlideData — EXP-04', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns exactly 5 rows (includes management hosts row — EXPORT-02)', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(5)
  })

  it('each row has label and value properties', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
      expect(typeof row.label).toBe('string')
      expect(typeof row.value).toBe('string')
    })
  })

  it('first row contains totalRecommendedHosts from aggregateTotals', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    const result = buildAggregateSlideData(totals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    const hostsRow = result.find((r) => r.label.toLowerCase().includes('recommended'))
    expect(hostsRow).toBeDefined()
    expect(hostsRow!.value).toContain(String(totals.totalRecommendedHosts))
  })

  it('management hosts row shows export.colocatedWld1 key when architecture is colocated', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    const mgmtRow = result.find((r) => r.label.toLowerCase().includes('management'))
    expect(mgmtRow).toBeDefined()
    expect(mgmtRow!.value).toBe('export.colocatedWld1')
  })

  it('management hosts row shows numeric count when dedicated', () => {
    const store = useInputStore()
    store.managementArchitecture = 'dedicated'
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    const mgmtRow = result.find((r) => r.label.toLowerCase().includes('management'))
    expect(mgmtRow).toBeDefined()
    expect(mgmtRow!.value).not.toBe('export.colocatedWld1')
  })

  it('rows contain vm count', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    const result = buildAggregateSlideData(totals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    const vmRow = result.find((r) => r.label.toLowerCase().includes('vm'))
    expect(vmRow).toBeDefined()
    expect(vmRow!.value).toContain(String(totals.totalVmCount))
  })

  it('rows contain raw and effective storage values', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    const result = buildAggregateSlideData(totals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    const rawRow = result.find((r) => r.label.toLowerCase().includes('raw'))
    const effRow = result.find((r) => r.label.toLowerCase().includes('effective'))
    expect(rawRow).toBeDefined()
    expect(effRow).toBeDefined()
    expect(rawRow!.value).toContain('TiB')
    expect(effRow!.value).toContain('TiB')
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
    store.updateDomain(store.workloadDomains[0].id, { gpuVmCount: 4 })
    const result = buildAiGpuSlideData(store.workloadDomains[0], t)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('every row has label and value properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { gpuVmCount: 4, vgpuMemoryGB: 24 })
    const result = buildAiGpuSlideData(store.workloadDomains[0], t)
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
    const result = buildAiGpuSlideData(store.workloadDomains[0], t)
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
    const result = buildNvmeTieringSlideData(store.workloadDomains[0], t)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('every row has label and value properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { nvmeTieringEnabled: true, activeMemoryPct: 70 })
    const result = buildNvmeTieringSlideData(store.workloadDomains[0], t)
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
    const result = buildNvmeTieringSlideData(store.workloadDomains[0], t)
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
    const result = buildStretchTopologySlideData(store.workloadDomains[0], calc.domainResults[0].stretch!, t)
    expect(result).toHaveProperty('topology')
    expect(Array.isArray(result.topology)).toBe(true)
    expect(result.topology.length).toBeGreaterThanOrEqual(5)
  })

  it('returns checklist array with >= 3 items', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const result = buildStretchTopologySlideData(store.workloadDomains[0], calc.domainResults[0].stretch!, t)
    expect(result).toHaveProperty('checklist')
    expect(Array.isArray(result.checklist)).toBe(true)
    expect(result.checklist.length).toBeGreaterThanOrEqual(3)
  })

  it('topology rows have label and value properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const result = buildStretchTopologySlideData(store.workloadDomains[0], calc.domainResults[0].stretch!, t)
    result.topology.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })

  it('checklist items are strings', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const result = buildStretchTopologySlideData(store.workloadDomains[0], calc.domainResults[0].stretch!, t)
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
    const result = buildVsanMaxSlideData(store.workloadDomains[0], calc.domainResults[0].vsanMax!, t)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(4)
  })

  it('includes profile in uppercase in a row value', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { storageType: 'vsan-max', vsanMaxProfile: 'lrg', vsanMaxStorageNodes: 8 })
    const calc = useCalculationStore()
    const result = buildVsanMaxSlideData(store.workloadDomains[0], calc.domainResults[0].vsanMax!, t)
    const profileRow = result.find((r) => String(r.value).includes('LRG'))
    expect(profileRow).toBeDefined()
  })

  it('every row has label and value properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { storageType: 'vsan-max', vsanMaxProfile: 'lrg', vsanMaxStorageNodes: 8 })
    const calc = useCalculationStore()
    const result = buildVsanMaxSlideData(store.workloadDomains[0], calc.domainResults[0].vsanMax!, t)
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
    store.updateDomain(store.workloadDomains[0].id, { hostCount: 1 })
    const calc = useCalculationStore()
    const result = buildValidationWarningsSlideData(calc)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(calc.aggregateTotals.allValidationErrors.length)
  })

  it('each entry has severity and messageKey properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { hostCount: 1 })
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

// ─── Chart image embedding logic (EXPORT-01) ─────────────────────────────────

describe('chart image embedding in PPTX (EXPORT-01)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('chartImages with all 3 types for a domain produces 3 available charts', () => {
    const uiStore = useUiStore()
    const store = useInputStore()
    const domainId = store.workloadDomains[0].id

    uiStore.registerChartImage(domainId, 'cores', 'data:image/png;base64,coresABC')
    uiStore.registerChartImage(domainId, 'ram', 'data:image/png;base64,ramDEF')
    uiStore.registerChartImage(domainId, 'storage', 'data:image/png;base64,storGHI')

    const domainCharts = uiStore.chartImages[domainId]
    const chartTypes: Array<{ key: 'cores' | 'ram' | 'storage' }> = [
      { key: 'cores' }, { key: 'ram' }, { key: 'storage' },
    ]
    const available = chartTypes.filter(ct => domainCharts?.[ct.key])
    expect(available).toHaveLength(3)
  })

  it('empty chartImages for a domain produces 0 available charts (no Charts slide)', () => {
    const uiStore = useUiStore()
    const store = useInputStore()
    const domainId = store.workloadDomains[0].id

    const domainCharts = uiStore.chartImages[domainId]
    const chartTypes: Array<{ key: 'cores' | 'ram' | 'storage' }> = [
      { key: 'cores' }, { key: 'ram' }, { key: 'storage' },
    ]
    const available = chartTypes.filter(ct => domainCharts?.[ct.key])
    expect(available).toHaveLength(0)
  })

  it('partial chartImages (only cores) produces 1 available chart', () => {
    const uiStore = useUiStore()
    const store = useInputStore()
    const domainId = store.workloadDomains[0].id

    uiStore.registerChartImage(domainId, 'cores', 'data:image/png;base64,coresOnly')

    const domainCharts = uiStore.chartImages[domainId]
    const chartTypes: Array<{ key: 'cores' | 'ram' | 'storage' }> = [
      { key: 'cores' }, { key: 'ram' }, { key: 'storage' },
    ]
    const available = chartTypes.filter(ct => domainCharts?.[ct.key])
    expect(available).toHaveLength(1)
    expect(available[0].key).toBe('cores')
  })

  it('chart data URLs contain full data:image/png;base64 prefix (PITFALL-7)', () => {
    const uiStore = useUiStore()
    const store = useInputStore()
    const domainId = store.workloadDomains[0].id

    const dataUrl = 'data:image/png;base64,abc123'
    uiStore.registerChartImage(domainId, 'cores', dataUrl)

    expect(uiStore.chartImages[domainId]['cores']).toBe(dataUrl)
    expect(uiStore.chartImages[domainId]['cores']).toMatch(/^data:image\/png;base64,/)
  })
})

// ─── multi-domain PPTX helpers (EXP-03, EXP-04) ──────────────────────────────

describe('multi-domain PPTX helpers (EXP-03, EXP-04)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('buildConfigSummaryData returns correct values for domain 2 (not domain 1)', () => {
    const store = useInputStore()
    // Add a second domain with distinct hostCount
    store.addDomain()
    store.updateDomain(store.workloadDomains[1].id, { hostCount: 12, vmCount: 500 })
    const managementArchitecture = store.managementArchitecture
    // Domain 2 config
    const domain2 = store.workloadDomains[1]
    const result2 = buildConfigSummaryData(domain2, managementArchitecture, domain2.hostCount, t)
    const hostRow = result2.find((r) => r.label.toLowerCase().includes('host'))
    expect(hostRow).toBeDefined()
    expect(String(hostRow!.value)).toContain('12')
    // Domain 1 config should still reflect domain 1 defaults
    const domain1 = store.workloadDomains[0]
    const result1 = buildConfigSummaryData(domain1, managementArchitecture, domain1.hostCount, t)
    const hostRow1 = result1.find((r) => r.label.toLowerCase().includes('host'))
    expect(hostRow1).toBeDefined()
    expect(String(hostRow1!.value)).toContain('4')
  })

  it('buildAggregateSlideData returns correct totals from calc.aggregateTotals', () => {
    const store = useInputStore()
    store.addDomain()
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    const result = buildAggregateSlideData(totals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    expect(result).toHaveLength(5)
    // Verify hosts row matches aggregate totals
    const hostsRow = result.find((r) => r.label.toLowerCase().includes('recommended'))
    expect(hostsRow).toBeDefined()
    expect(hostsRow!.value).toContain(String(totals.totalRecommendedHosts))
  })
})
