/// <reference types="vitest/globals" />
// Phase 6: Markdown Export tests — all sections, Pinia-backed, node environment
// Pattern: createPinia() + setActivePinia() in each beforeEach for test isolation
// Phase 13: Updated mocks to use workloadDomains[0] multi-domain store shape
// Phase 14: Updated per-domain sections from H2 to H3 (multi-domain loop)
// Phase 22: i18n mock — t() returns the key itself for deterministic assertions

import { createPinia, setActivePinia } from 'pinia'
import { useInputStore } from '@/stores/inputStore'
import { generateMarkdownReport } from './useMarkdownExport'

// Mock i18n — t() returns the key so assertions check i18n key usage
// te() returns false (key absent) so category label fallback chain returns the raw category key
vi.mock('@/i18n', () => ({
  i18n: { global: { t: (key: string) => key, te: (_key: string) => false } },
}))

describe('generateMarkdownReport — always-present sections', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('contains report title using i18n key export.title', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('# export.title')
  })

  it('contains ### export.hostConfig section (H3, inside domain block)', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('### export.hostConfig')
  })

  it('contains ## export.mgmtOverhead section', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('## export.mgmtOverhead')
  })

  it('contains ### export.computeSizing section (H3, inside domain block)', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('### export.computeSizing')
  })

  it('contains ### export.storageSizing section (H3, inside domain block)', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('### export.storageSizing')
  })

  it('contains ### export.workloadProfile section (H3, inside domain block)', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('### export.workloadProfile')
  })

  it('contains ### export.networkConfig section (H3, inside domain block)', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('### export.networkConfig')
  })

  it('contains footer attribution export.footer', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('*export.footer')
  })

  it('report contains no undefined or NaN values', () => {
    const report = generateMarkdownReport()
    expect(report).not.toContain('undefined')
    expect(report).not.toContain('NaN')
  })
})

describe('generateMarkdownReport — MD-02 Workload Profile', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows VM count row matching store default (100)', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('100')
  })

  it('shows vCPU per VM row using i18n key', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('| export.vcpuPerVm')
  })
})

describe('generateMarkdownReport — MD-03 Management Architecture', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows management architecture row (default: shared)', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('colocated')
  })

  it('dedicated host count row absent when managementArchitecture=shared (default)', () => {
    const report = generateMarkdownReport()
    expect(report).not.toContain('export.dedicatedHostCount')
  })

  it('dedicated host count row present when managementArchitecture=dedicated', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    const report = generateMarkdownReport()
    expect(report).toContain('export.dedicatedHostCount')
  })
})

describe('generateMarkdownReport — MD-04 NVMe Tiering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('NVMe section absent when nvmeTieringEnabled=false (default)', () => {
    const report = generateMarkdownReport()
    expect(report).not.toContain('### export.nvmeTiering')
  })

  it('NVMe section present when nvmeTieringEnabled=true', () => {
    const input = useInputStore()
    input.workloadDomains[0].nvmeTieringEnabled = true
    input.workloadDomains[0].activeMemoryPct = 60
    const report = generateMarkdownReport()
    expect(report).toContain('### export.nvmeTiering')
  })
})

describe('generateMarkdownReport — MD-05 AI/GPU', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('AI/GPU section absent when gpuVmCount=0 (default)', () => {
    const report = generateMarkdownReport()
    expect(report).not.toContain('### export.aiGpu')
  })

  it('AI/GPU section present when gpuVmCount=5', () => {
    const input = useInputStore()
    input.workloadDomains[0].gpuVmCount = 5
    input.workloadDomains[0].vgpuMemoryGB = 32
    const report = generateMarkdownReport()
    expect(report).toContain('### export.aiGpu')
  })

  it('AI/GPU section shows GPU VM count row with value 5', () => {
    const input = useInputStore()
    input.workloadDomains[0].gpuVmCount = 5
    input.workloadDomains[0].vgpuMemoryGB = 32
    const report = generateMarkdownReport()
    expect(report).toContain('5')
  })
})

describe('generateMarkdownReport — MD-06 Stretch Cluster', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Stretch section absent when deploymentMode=ha (default)', () => {
    const report = generateMarkdownReport()
    expect(report).not.toContain('### export.stretchTopology')
  })

  it('Stretch section present when deploymentMode=stretch', () => {
    const input = useInputStore()
    input.workloadDomains[0].deploymentMode = 'stretch'
    const report = generateMarkdownReport()
    expect(report).toContain('### export.stretchTopology')
  })

  it('Stretch section contains export.minInterSiteBw row', () => {
    const input = useInputStore()
    input.workloadDomains[0].deploymentMode = 'stretch'
    const report = generateMarkdownReport()
    expect(report).toContain('export.minInterSiteBw')
  })

  it('Stretch section contains export.witnessVcpu and export.witnessRam rows', () => {
    const input = useInputStore()
    input.workloadDomains[0].deploymentMode = 'stretch'
    const report = generateMarkdownReport()
    expect(report).toContain('export.witnessVcpu')
    expect(report).toContain('export.witnessRam')
  })
})

describe('generateMarkdownReport — MD-07 vSAN Max', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('vSAN Max section absent when storageType=vsan-esa (default)', () => {
    const report = generateMarkdownReport()
    expect(report).not.toContain('### export.vsanMaxCluster')
  })

  it('vSAN Max section present when storageType=vsan-max', () => {
    const input = useInputStore()
    input.workloadDomains[0].storageType = 'vsan-max'
    const report = generateMarkdownReport()
    expect(report).toContain('### export.vsanMaxCluster')
  })

  it('vSAN Max section shows export.readyNodeProfile row', () => {
    const input = useInputStore()
    input.workloadDomains[0].storageType = 'vsan-max'
    const report = generateMarkdownReport()
    expect(report).toContain('export.readyNodeProfile')
  })
})

describe('generateMarkdownReport — MD-08 Validation Warnings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Validation warnings section absent with default valid inputs', () => {
    const report = generateMarkdownReport()
    expect(report).not.toContain('## export.validationWarnings')
  })

  it('Validation warnings section present when FC pool is too small (shortfall)', () => {
    const input = useInputStore()
    // FC pool shortfall: large VM demand against a tiny external pool → FC_POOL_SHORTFALL.
    input.updateDomain(input.workloadDomains[0].id, {
      storageType: 'fc', vmCount: 5000, avgStorageGbPerVm: 1000, externalStorageUsableTiB: 10,
    })
    const report = generateMarkdownReport()
    expect(report).toContain('## export.validationWarnings')
    // Assert the SPECIFIC scenario warning, not merely that some warning exists.
    expect(report).toContain('validation.fcPoolShortfall')
  })
})

describe('generateMarkdownReport — MD-09 Network Configuration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Network config section present (always, H3 inside domain block)', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('### export.networkConfig')
  })

  it('Network config shows export.networkSpeed row', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('export.networkSpeed')
  })

  it('Network config shows export.dedupEnabled row', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('export.dedupEnabled')
  })
})

describe('generateMarkdownReport — table structure', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('report contains at least 10 markdown table rows (| ... |)', () => {
    const report = generateMarkdownReport()
    const tableRows = report.split('\n').filter((line) => line.startsWith('|'))
    expect(tableRows.length).toBeGreaterThanOrEqual(10)
  })
})

describe('generateMarkdownReport — no regression', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('export.provisionedHosts row is present in compute section', () => {
    const report = generateMarkdownReport()
    // Scope to the compute section so a regression elsewhere can't satisfy this.
    expect(report).toMatch(/### export\.computeSizing[\s\S]*?export\.provisionedHosts/)
  })

  it('export.safeUsableCapacity row is present in storage section', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('export.safeUsableCapacity')
  })

  it('CPU utilization formatted to 1 decimal place (matches /\\d+\\.\\d%/)', () => {
    const report = generateMarkdownReport()
    expect(report).toMatch(/\d+\.\d%/)
  })
})

describe('generateMarkdownReport — multi-domain (EXP-01, EXP-02)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('includes one named section per workload domain', () => {
    const input = useInputStore()
    // Add a second domain and rename it
    input.addDomain()
    input.updateDomain(input.workloadDomains[1].id, { name: 'WLD-2' })
    const report = generateMarkdownReport()
    expect(report).toContain('## export.domain: WLD-1')
    expect(report).toContain('## export.domain: WLD-2')
  })

  it('uses H3 sub-sections within each domain block', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('### export.hostConfig')
    expect(report).toContain('### export.computeSizing')
  })

  it('includes aggregate totals section', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('## export.aggregateTotals')
  })

  it('aggregate totals includes export.totalRecommendedHosts', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('export.totalRecommendedHosts')
  })

  it('management architecture appears exactly once', () => {
    const input = useInputStore()
    input.addDomain()
    input.updateDomain(input.workloadDomains[1].id, { name: 'WLD-2' })
    const report = generateMarkdownReport()
    const occurrences = report.split('## export.mgmtArchitecture').length - 1
    expect(occurrences).toBe(1)
  })

  it('management domain overhead appears exactly once', () => {
    const input = useInputStore()
    input.addDomain()
    input.updateDomain(input.workloadDomains[1].id, { name: 'WLD-2' })
    const report = generateMarkdownReport()
    const occurrences = report.split('## export.mgmtOverhead').length - 1
    expect(occurrences).toBe(1)
  })

  it('conditional GPU section only in domain that enables it', () => {
    const input = useInputStore()
    // Domain 1 (WLD-1): no GPU
    input.updateDomain(input.workloadDomains[0].id, { gpuVmCount: 0, name: 'WLD-1' })
    // Add domain 2 (WLD-2): with GPU
    input.addDomain()
    input.updateDomain(input.workloadDomains[1].id, { name: 'WLD-2', gpuVmCount: 2, vgpuMemoryGB: 16 })
    const report = generateMarkdownReport()
    // GPU section should appear after WLD-2 heading
    const wld2Pos = report.indexOf('## export.domain: WLD-2')
    const gpuPos = report.indexOf('### export.aiGpu')
    expect(gpuPos).toBeGreaterThan(wld2Pos)
    // GPU section should NOT appear between report start and WLD-2 heading
    const wld1Pos = report.indexOf('## export.domain: WLD-1')
    expect(gpuPos).toBeGreaterThan(wld1Pos)
    // No GPU section in the part before WLD-2
    const reportBeforeWld2 = report.substring(0, wld2Pos)
    expect(reportBeforeWld2).not.toContain('### export.aiGpu')
  })
})

describe('generateMarkdownReport -- EXPORT-01 management hosts in aggregate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('aggregate section contains export.managementHosts row (default colocated)', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('| export.managementHosts |')
    expect(report).toContain('export.colocatedWld1')
  })

  it('aggregate section shows numeric host count when dedicated', () => {
    const input = useInputStore()
    input.managementArchitecture = 'dedicated'
    const report = generateMarkdownReport()
    expect(report).toContain('| export.managementHosts |')
    const lines = report.split('\n').filter(l => l.includes('export.managementHosts'))
    expect(lines.length).toBeGreaterThanOrEqual(1)
    const mgmtLine = lines[0]
    expect(mgmtLine).not.toContain('export.colocatedWld1')
  })
})
