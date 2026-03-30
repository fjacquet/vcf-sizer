/// <reference types="vitest/globals" />
// Phase 8: PPTX Export tests — data-mapping helpers, Pinia-backed, node environment
// Pattern: createPinia() + setActivePinia() in each beforeEach for test isolation
// Wave 0 purpose: establish RED tests before implementation (TDD gate)
// NOTE: Tests WILL FAIL because usePptxExport.ts does not exist yet — that is expected.

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
  buildRecommendationsData,
  generatePptxReport,
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

  it('returns deploymentMode from input store (default: ha)', () => {
    const store = useInputStore()
    const result = buildTitleSlideData(store)
    expect(result.deploymentMode).toBe('ha')
  })

  it('returns a date string in YYYY-MM-DD format', () => {
    const store = useInputStore()
    const result = buildTitleSlideData(store)
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
    const result = buildConfigSummaryData(store)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  it('each row has label and value properties', () => {
    const store = useInputStore()
    const result = buildConfigSummaryData(store)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })

  it('hostCount row value contains the default value 4', () => {
    const store = useInputStore()
    const result = buildConfigSummaryData(store)
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
    const result = buildWorkloadSlideData(store)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(6)
  })

  it('each row has label and value properties', () => {
    const store = useInputStore()
    const result = buildWorkloadSlideData(store)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })

  it('a row value contains the default vmCount of 100', () => {
    const store = useInputStore()
    const result = buildWorkloadSlideData(store)
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
    const result = buildComputeResultsData(calc.compute)
    expect(typeof result.recommendedHostCount).toBe('number')
  })

  it('returns coreUtilizationPct as a number', () => {
    const calc = useCalculationStore()
    const result = buildComputeResultsData(calc.compute)
    expect(typeof result.coreUtilizationPct).toBe('number')
  })

  it('returns ramUtilizationPct as a number', () => {
    const calc = useCalculationStore()
    const result = buildComputeResultsData(calc.compute)
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
    const result = buildStorageResultsData(calc.storage)
    expect(typeof result.safeUsableCapacityTB).toBe('number')
  })

  it('returns rawCapacityTB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.storage)
    expect(typeof result.rawCapacityTB).toBe('number')
  })

  it('returns lfsOverheadTB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.storage)
    expect(typeof result.lfsOverheadTB).toBe('number')
  })

  it('returns metadataOverheadTB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.storage)
    expect(typeof result.metadataOverheadTB).toBe('number')
  })

  it('returns usableAfterRaidTB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.storage)
    expect(typeof result.usableAfterRaidTB).toBe('number')
  })
})

// ─── buildRecommendationsData — PPTX-09 ──────────────────────────────────────

describe('buildRecommendationsData — PPTX-09', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns a non-empty array', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const result = buildRecommendationsData(store, calc)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('every item in the array is a string', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const result = buildRecommendationsData(store, calc)
    result.forEach((item) => {
      expect(typeof item).toBe('string')
    })
  })
})

// ─── generatePptxReport — PPTX-01 ────────────────────────────────────────────

describe('generatePptxReport — PPTX-01', () => {
  it('is a function', () => {
    expect(typeof generatePptxReport).toBe('function')
  })
})
