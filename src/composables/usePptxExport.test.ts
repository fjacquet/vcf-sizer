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

// Mock i18n — t() returns the key so assertions check i18n key usage.
// te() returns false so makeCategoryLabel falls back to the raw category key.
vi.mock('@/i18n', () => ({
  i18n: { global: { t: (key: string) => key, te: () => false } },
}))

// ─── pptxgenjs mock — records deck structure (section/slide order) ──────────────
// Captures the order PptxGenJS APIs are called so the integration test can assert
// the new section layout (Cover → Management → workload domains → Summary) and
// that the aggregate-totals slide is the final content slide.
interface DeckWitness {
  sections: string[]
  // Each recorded slide: its sectionTitle (if any) and its first addText (== frame title)
  slides: Array<{ sectionTitle?: string; title?: string }>
  wroteFile: boolean
}

const deckWitness: DeckWitness = { sections: [], slides: [], wroteFile: false }

function resetDeckWitness() {
  deckWitness.sections = []
  deckWitness.slides = []
  deckWitness.wroteFile = false
}

vi.mock('pptxgenjs', () => {
  class FakeSlide {
    private record: { sectionTitle?: string; title?: string }
    background: unknown
    constructor(record: { sectionTitle?: string; title?: string }) {
      this.record = record
    }
    addText(text: unknown) {
      // addSlideFrame() makes the first addText the slide title (a string).
      if (this.record.title === undefined && typeof text === 'string') {
        this.record.title = text
      }
      return this
    }
    addShape() { return this }
    addChart() { return this }
    addImage() { return this }
    addTable() { return this }
  }
  class FakePptxGenJS {
    layout = ''
    theme: unknown = {}
    author = ''
    company = ''
    title = ''
    ShapeType = new Proxy({}, { get: (_t, p) => String(p) })
    ChartType = new Proxy({}, { get: (_t, p) => String(p) })
    addSection(opts: { title: string }) {
      deckWitness.sections.push(opts.title)
    }
    defineSlideMaster() { /* no-op */ }
    addSlide(opts?: { sectionTitle?: string; masterName?: string }) {
      const record: { sectionTitle?: string; title?: string } = {
        sectionTitle: opts?.sectionTitle,
      }
      deckWitness.slides.push(record)
      return new FakeSlide(record)
    }
    async writeFile() {
      deckWitness.wroteFile = true
      return 'vcf-sizing-report.pptx'
    }
  }
  return { default: FakePptxGenJS }
})

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
    const calc = useCalculationStore()
    const domain = store.workloadDomains[0]
    const result = buildConfigSummaryData(domain, store.managementArchitecture, calc.domainResults[0], t)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(8)
  })

  it('each row has label and value properties', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const domain = store.workloadDomains[0]
    const result = buildConfigSummaryData(domain, store.managementArchitecture, calc.domainResults[0], t)
    result.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })

  it('provisioned-hosts row value contains the computed totalHosts', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const domain = store.workloadDomains[0]
    const result = buildConfigSummaryData(domain, store.managementArchitecture, calc.domainResults[0], t)
    const hostRow = result.find((row) => row.label === 'export.provisionedHosts')
    expect(hostRow).toBeDefined()
    expect(String(hostRow!.value)).toContain(String(calc.domainResults[0].totalHosts))
  })
})

describe('buildConfigSummaryData — FC/NFS storagePerHost (ADR-009)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('FC domain does NOT include storagePerHost row', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { storageType: 'fc' })
    const calc = useCalculationStore()
    const domain = store.workloadDomains[0]
    const result = buildConfigSummaryData(domain, store.managementArchitecture, calc.domainResults[0], t)
    const storagePerHostRow = result.find((r) => r.label === 'export.storagePerHost')
    expect(storagePerHostRow).toBeUndefined()
  })

  it('NFS domain does NOT include storagePerHost row', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { storageType: 'nfs' })
    const calc = useCalculationStore()
    const domain = store.workloadDomains[0]
    const result = buildConfigSummaryData(domain, store.managementArchitecture, calc.domainResults[0], t)
    const storagePerHostRow = result.find((r) => r.label === 'export.storagePerHost')
    expect(storagePerHostRow).toBeUndefined()
  })

  it('vsan-esa domain DOES include storagePerHost row', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const domain = store.workloadDomains[0] // default is vsan-esa
    const result = buildConfigSummaryData(domain, store.managementArchitecture, calc.domainResults[0], t)
    const storagePerHostRow = result.find((r) => r.label === 'export.storagePerHost')
    expect(storagePerHostRow).toBeDefined()
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

  it('returns provisionedHostCount as a number', () => {
    const calc = useCalculationStore()
    const result = buildComputeResultsData(calc.domainResults[0])
    expect(typeof result.provisionedHostCount).toBe('number')
  })

  it('returns coreUtilizationPct as a number', () => {
    const calc = useCalculationStore()
    const result = buildComputeResultsData(calc.domainResults[0])
    expect(typeof result.coreUtilizationPct).toBe('number')
  })

  it('returns ramUtilizationPct as a number', () => {
    const calc = useCalculationStore()
    const result = buildComputeResultsData(calc.domainResults[0])
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

  it('returns workloadStorageRequiredTiB as a number', () => {
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(typeof result.workloadStorageRequiredTiB).toBe('number')
  })

  it('workloadStorageRequiredTiB is 0 for vsan-esa (demand drives host count, not a pool)', () => {
    // vSAN ESA: VM storage demand is satisfied via minHostsForStorage, so this field
    // is 0 — non-zero only for FC/NFS external pools. Default domain is vsan-esa.
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(result.workloadStorageRequiredTiB).toBe(0)
  })

  it('workloadStorageRequiredTiB is computed for FC domain', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, {
      storageType: 'fc',
      vmCount: 1000,
      avgStorageGbPerVm: 970,
      externalStorageUsableTiB: 100,
    })
    const calc = useCalculationStore()
    const result = buildStorageResultsData(calc.domainResults[0].storage)
    expect(result.workloadStorageRequiredTiB).toBeCloseTo(947.265625, 2)
  })
})

// ─── buildAggregateSlideData — replaces buildRecommendationsData (EXP-04) ────

describe('buildAggregateSlideData — EXP-04', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns exactly 7 base rows (grand total, workload, mgmt, clusters, VMs, raw, effective) when no workload-storage demand', () => {
    const store = useInputStore()
    // vmCount=0 → no workload-storage-required row → just the 7 always-present rows
    // (now includes the explicit Workload Hosts row mirroring AggregateTotalsCard).
    store.updateDomain(store.workloadDomains[0].id, { vmCount: 0 })
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(7)
  })

  it('includes a workload-hosts row equal to grand total minus management hosts', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    const result = buildAggregateSlideData(totals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    const wkldHostsRow = result.find((r) => r.label === 'export.workloadHosts')
    expect(wkldHostsRow).toBeDefined()
    expect(wkldHostsRow!.value).toBe(String(totals.totalRecommendedHosts - totals.mgmtHostCount))
  })

  it('includes total-clusters row matching aggregateTotals.totalClusterCount', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    const result = buildAggregateSlideData(totals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    const clusterRow = result.find((r) => r.label === 'export.totalClusterCount')
    expect(clusterRow).toBeDefined()
    expect(clusterRow!.value).toBe(String(totals.totalClusterCount))
  })

  it('omits per-site host rows when no domain is stretched', () => {
    const store = useInputStore()
    const calc = useCalculationStore()
    const result = buildAggregateSlideData(calc.aggregateTotals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    expect(result.find((r) => r.label === 'export.aggPreferredSiteHosts')).toBeUndefined()
    expect(result.find((r) => r.label === 'export.aggSecondarySiteHosts')).toBeUndefined()
  })

  it('includes per-site host rows when a stretched domain exists', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    expect(totals.preferredSiteHosts).not.toBeUndefined()
    const result = buildAggregateSlideData(totals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    const prefRow = result.find((r) => r.label === 'export.aggPreferredSiteHosts')
    const secRow = result.find((r) => r.label === 'export.aggSecondarySiteHosts')
    expect(prefRow).toBeDefined()
    expect(secRow).toBeDefined()
    expect(prefRow!.value).toBe(String(totals.preferredSiteHosts))
    expect(secRow!.value).toBe(String(totals.secondarySiteHosts))
  })

  it('includes pool-shortfall row only when totalPoolShortfallTiB > 0', () => {
    const store = useInputStore()
    // No shortfall in default state — row absent.
    const calc0 = useCalculationStore()
    const noShortfall = buildAggregateSlideData(calc0.aggregateTotals, store.managementArchitecture, calc0.dedicatedMgmtHostCount, undefined, t)
    expect(noShortfall.find((r) => r.label === 'export.totalPoolShortfall')).toBeUndefined()
    // Force an undersized FC pool → shortfall row present.
    store.updateDomain(store.workloadDomains[0].id, {
      storageType: 'fc', vmCount: 5000, avgStorageGbPerVm: 1000, externalStorageUsableTiB: 10,
    })
    const calc1 = useCalculationStore()
    expect(calc1.aggregateTotals.totalPoolShortfallTiB).toBeGreaterThan(0)
    const withShortfall = buildAggregateSlideData(calc1.aggregateTotals, store.managementArchitecture, calc1.dedicatedMgmtHostCount, undefined, t)
    expect(withShortfall.find((r) => r.label === 'export.totalPoolShortfall')).toBeDefined()
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

// ─── generatePptxReport — deck section/slide order (Tasks 3 & 4) ─────────────

describe('generatePptxReport — section & slide order', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetDeckWitness()
  })

  it('emits sections in order: Cover → Management → <domain> → Summary', async () => {
    await generatePptxReport()
    // Cover and Management precede every per-domain section; Summary is last.
    expect(deckWitness.sections[0]).toBe('Cover')
    expect(deckWitness.sections[1]).toBe('Management')
    expect(deckWitness.sections[deckWitness.sections.length - 1]).toBe('Summary')
    expect(deckWitness.sections.indexOf('Management')).toBeLessThan(
      deckWitness.sections.indexOf('Summary'),
    )
  })

  it('places the management appliance section before the first workload domain content', async () => {
    const store = useInputStore()
    const domainName = store.workloadDomains[0].name
    await generatePptxReport()

    const mgmtApplianceIdx = deckWitness.slides.findIndex(
      (s) => s.title === 'export.mgmtAppliances',
    )
    // First workload-domain slide carries sectionTitle === the domain name.
    const firstDomainSlideIdx = deckWitness.slides.findIndex(
      (s) => s.sectionTitle === domainName,
    )
    expect(mgmtApplianceIdx).toBeGreaterThanOrEqual(0)
    expect(firstDomainSlideIdx).toBeGreaterThanOrEqual(0)
    expect(mgmtApplianceIdx).toBeLessThan(firstDomainSlideIdx)
  })

  it('makes the aggregate-totals slide the final content slide', async () => {
    await generatePptxReport()
    const lastSlide = deckWitness.slides[deckWitness.slides.length - 1]
    expect(lastSlide.title).toBe('export.aggregateTotals')
    expect(lastSlide.sectionTitle).toBe('Summary')
    expect(deckWitness.wroteFile).toBe(true)
  })

  it('places validation warnings before the aggregate-totals slide when warnings exist', async () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, {
      storageType: 'fc', vmCount: 5000, avgStorageGbPerVm: 1000, externalStorageUsableTiB: 10,
    })
    await generatePptxReport()
    const warnIdx = deckWitness.slides.findIndex((s) => s.title === 'export.validationWarnings')
    const aggIdx = deckWitness.slides.findIndex((s) => s.title === 'export.aggregateTotals')
    expect(warnIdx).toBeGreaterThanOrEqual(0)
    expect(aggIdx).toBeGreaterThanOrEqual(0)
    expect(warnIdx).toBeLessThan(aggIdx)
    // And the aggregate-totals slide remains the very last slide.
    expect(aggIdx).toBe(deckWitness.slides.length - 1)
  })

  it('places the management overhead slide before the management appliance section', async () => {
    await generatePptxReport()
    const overheadIdx = deckWitness.slides.findIndex((s) => s.title === 'export.mgmtOverhead')
    const applianceIdx = deckWitness.slides.findIndex((s) => s.title === 'export.mgmtAppliances')
    expect(overheadIdx).toBeGreaterThanOrEqual(0)
    expect(applianceIdx).toBeGreaterThanOrEqual(0)
    expect(overheadIdx).toBeLessThan(applianceIdx)
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
    const result = buildStretchTopologySlideData(calc.domainResults[0].hostsPerSite, calc.domainResults[0].stretch!, t)
    expect(result).toHaveProperty('topology')
    expect(Array.isArray(result.topology)).toBe(true)
    expect(result.topology.length).toBeGreaterThanOrEqual(5)
  })

  it('returns checklist array with >= 3 items', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const result = buildStretchTopologySlideData(calc.domainResults[0].hostsPerSite, calc.domainResults[0].stretch!, t)
    expect(result).toHaveProperty('checklist')
    expect(Array.isArray(result.checklist)).toBe(true)
    expect(result.checklist.length).toBeGreaterThanOrEqual(3)
  })

  it('topology rows have label and value properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const result = buildStretchTopologySlideData(calc.domainResults[0].hostsPerSite, calc.domainResults[0].stretch!, t)
    result.topology.forEach((row) => {
      expect(row).toHaveProperty('label')
      expect(row).toHaveProperty('value')
    })
  })

  it('checklist items are strings', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { deploymentMode: 'stretch' })
    const calc = useCalculationStore()
    const result = buildStretchTopologySlideData(calc.domainResults[0].hostsPerSite, calc.domainResults[0].stretch!, t)
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
    // FC pool shortfall: huge VM demand against a tiny external pool → FC_POOL_SHORTFALL.
    store.updateDomain(store.workloadDomains[0].id, {
      storageType: 'fc', vmCount: 5000, avgStorageGbPerVm: 1000, externalStorageUsableTiB: 10,
    })
    const calc = useCalculationStore()
    const result = buildValidationWarningsSlideData(calc)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(calc.aggregateTotals.allValidationErrors.length)
  })

  it('each entry has severity and messageKey properties', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, {
      storageType: 'fc', vmCount: 5000, avgStorageGbPerVm: 1000, externalStorageUsableTiB: 10,
    })
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
    // Add a second domain whose larger VM demand drives more provisioned hosts than domain 1.
    store.addDomain()
    store.updateDomain(store.workloadDomains[1].id, { vmCount: 4000, avgVcpuPerVm: 8 })
    const calc = useCalculationStore()
    const managementArchitecture = store.managementArchitecture
    // Domain 2 — provisioned host count reflects its own (larger) demand
    const domain2 = store.workloadDomains[1]
    const result2 = buildConfigSummaryData(domain2, managementArchitecture, calc.domainResults[1], t)
    const hostRow2 = result2.find((r) => r.label === 'export.provisionedHosts')
    expect(hostRow2).toBeDefined()
    expect(String(hostRow2!.value)).toContain(String(calc.domainResults[1].totalHosts))
    // Domain 1 — provisioned host count reflects its own defaults, distinct from domain 2
    const domain1 = store.workloadDomains[0]
    const result1 = buildConfigSummaryData(domain1, managementArchitecture, calc.domainResults[0], t)
    const hostRow1 = result1.find((r) => r.label === 'export.provisionedHosts')
    expect(hostRow1).toBeDefined()
    expect(String(hostRow1!.value)).toContain(String(calc.domainResults[0].totalHosts))
    expect(calc.domainResults[1].totalHosts).toBeGreaterThan(calc.domainResults[0].totalHosts)
  })

  it('buildAggregateSlideData returns correct totals from calc.aggregateTotals', () => {
    const store = useInputStore()
    store.addDomain()
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    const result = buildAggregateSlideData(totals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    expect(result.length).toBeGreaterThanOrEqual(6)
    // Verify hosts row matches aggregate totals
    const hostsRow = result.find((r) => r.label.toLowerCase().includes('recommended'))
    expect(hostsRow).toBeDefined()
    expect(hostsRow!.value).toContain(String(totals.totalRecommendedHosts))
  })

  it('buildAggregateSlideData includes workload storage row when FC domain present', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, {
      storageType: 'fc',
      vmCount: 1000,
      avgStorageGbPerVm: 970,
    })
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    expect(totals.totalWorkloadStorageRequiredTiB).toBeGreaterThan(0)
    const result = buildAggregateSlideData(totals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    // Target the storage row precisely — a Workload Hosts row now also contains "workload".
    const wkldRow = result.find((r) => r.label === 'export.totalWorkloadStorageRequired')
    expect(wkldRow).toBeDefined()
    expect(wkldRow!.value).toContain('TiB')
  })

  it('buildAggregateSlideData omits workload storage row when there is no VM demand (vmCount=0)', () => {
    const store = useInputStore()
    // Demand-driven engine reports per-VM storage demand for ALL storage types, so the
    // row only disappears when there is no VM demand at all.
    store.updateDomain(store.workloadDomains[0].id, { vmCount: 0 })
    const calc = useCalculationStore()
    const totals = calc.aggregateTotals
    expect(totals.totalWorkloadStorageRequiredTiB).toBe(0)
    const result = buildAggregateSlideData(totals, store.managementArchitecture, calc.dedicatedMgmtHostCount, undefined, t)
    const wkldRow = result.find((r) => r.label === 'export.totalWorkloadStorageRequired')
    expect(wkldRow).toBeUndefined()
  })
})
