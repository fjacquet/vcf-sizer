// PPTX export composable — generates VCF sizing report as .pptx browser download
// Plain TypeScript — NO Vue lifecycle hooks (CALC-01/CALC-02 compliant)
// pptxgenjs is loaded via dynamic import() to keep it out of the main bundle (PPTX-15)

import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import type {
  MgmtDomainResult,
  ComputeResult,
  StorageResult,
  StretchResult,
  VsanMaxResult,
  WorkloadDomainConfig,
  AggregateTotals,
} from '@/engine/types'
// Local type definitions matching pptxgenjs TableCell/TableRow shapes.
// We use local types rather than importing from pptxgenjs to avoid
// namespace resolution issues with the dynamic-import-only pattern (PPTX-15).
interface TableCell {
  text: string
  options?: {
    bold?: boolean
    fill?: { color: string }
    color?: string
    colspan?: number
    rowspan?: number
    align?: 'left' | 'center' | 'right'
    valign?: 'top' | 'middle' | 'bottom'
    fontSize?: number
  }
}
type TableRow = TableCell[]

// ─── Exported color constants ──────────────────────────────────────────────────
// All hex values WITHOUT # prefix — pptxgenjs uses bare 6-digit hex (Pitfall 1)

export const PPTX_MASTER_COLOR = '003087' // Broadcom blue
export const PPTX_FOOTER_COLOR = '001F5B'
export const PPTX_WHITE = 'FFFFFF'
export const PPTX_LIGHT_TEXT = 'CCCCCC'
export const PPTX_HEADER_BG = 'E8E8E8'
export const MASTER_NAME = 'VCF_MASTER'

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** Create a header cell with grey background fill */
function hdrCell(text: string): TableCell {
  return {
    text,
    options: { bold: true, fill: { color: PPTX_HEADER_BG }, color: '000000' },
  }
}

/** Create a plain data cell */
function cell(text: string, bold = false): TableCell {
  return bold ? { text, options: { bold: true } } : { text }
}

// ─── Data-mapping helpers (pure functions — testable without pptxgenjs) ────────

/**
 * buildTitleSlideData — returns { domainCount, date } for title slide (PPTX-03)
 * Phase 14: accepts domainCount directly instead of reading store.workloadDomains[0].deploymentMode
 */
export function buildTitleSlideData(domainCount: number, date?: string): {
  domainCount: number
  date: string
} {
  return {
    domainCount,
    date: date ?? new Date().toISOString().split('T')[0],
  }
}

/**
 * buildConfigSummaryData — returns 8 label/value rows for config summary slide (PPTX-04)
 * Phase 14: accepts WorkloadDomainConfig directly instead of reading store.workloadDomains[0]
 */
export function buildConfigSummaryData(
  domain: WorkloadDomainConfig,
  managementArchitecture: string
): Array<{ label: string; value: string }> {
  return [
    { label: 'Hosts', value: String(domain.hostCount) },
    { label: 'Cores per socket', value: String(domain.coresPerSocket) },
    { label: 'Sockets per host', value: String(domain.socketsPerHost) },
    { label: 'RAM per host', value: `${domain.hostRamGB} GB` },
    { label: 'Storage per host', value: `${domain.hostStorageTB} TB` },
    { label: 'Storage type', value: domain.storageType },
    { label: 'Network speed', value: `${domain.networkSpeedGbE} GbE` },
    { label: 'Management architecture', value: managementArchitecture },
  ]
}

/**
 * buildWorkloadSlideData — returns 6 label/value rows for workload profile slide (PPTX-05)
 * Phase 14: accepts WorkloadDomainConfig directly instead of reading store.workloadDomains[0]
 */
export function buildWorkloadSlideData(
  domain: WorkloadDomainConfig
): Array<{ label: string; value: string }> {
  return [
    { label: 'VM count', value: String(domain.vmCount) },
    { label: 'vCPU per VM', value: String(domain.avgVcpuPerVm) },
    { label: 'vRAM per VM', value: `${domain.avgVramGbPerVm} GB` },
    { label: 'Storage per VM', value: `${domain.avgStorageGbPerVm} GB` },
    { label: 'CPU overcommit ratio', value: `${domain.cpuOvercommitRatio}:1` },
    { label: 'RAM overcommit ratio', value: `${domain.ramOvercommitRatio}:1` },
  ]
}

/**
 * buildMgmtOverheadData — returns 6 rows for management domain overhead slide (PPTX-06)
 */
export function buildMgmtOverheadData(
  mgmt: MgmtDomainResult
): Array<{ label: string; cores: number; ramGB: number }> {
  return [
    { label: 'vCenter', cores: mgmt.vcenterCores, ramGB: mgmt.vcenterRamGB },
    { label: 'SDDC Manager', cores: mgmt.sddcCores, ramGB: mgmt.sddcRamGB },
    { label: 'NSX', cores: mgmt.nsxCores, ramGB: mgmt.nsxRamGB },
    { label: 'Aria Ops / Fleet Mgr', cores: mgmt.opsCores, ramGB: mgmt.opsRamGB },
    { label: 'Automation', cores: mgmt.automationCores, ramGB: mgmt.automationRamGB },
    { label: 'Total', cores: mgmt.totalCores, ramGB: mgmt.totalRamGB },
  ]
}

/**
 * buildComputeResultsData — returns key compute metrics for compute results slide (PPTX-07)
 */
export function buildComputeResultsData(compute: ComputeResult): {
  recommendedHostCount: number
  coreUtilizationPct: number
  ramUtilizationPct: number
  availableCores: number
  availableRamGB: number
  minHostsForCpu: number
  minHostsForRam: number
} {
  return {
    recommendedHostCount: compute.recommendedHostCount,
    coreUtilizationPct: compute.coreUtilizationPct,
    ramUtilizationPct: compute.ramUtilizationPct,
    availableCores: compute.availableCores,
    availableRamGB: compute.availableRamGB,
    minHostsForCpu: compute.minHostsForCpu,
    minHostsForRam: compute.minHostsForRam,
  }
}

/**
 * buildStorageResultsData — returns key storage metrics for storage results slide (PPTX-08)
 */
export function buildStorageResultsData(storage: StorageResult): {
  rawCapacityTB: number
  usableAfterRaidTB: number
  lfsOverheadTB: number
  metadataOverheadTB: number
  safeUsableCapacityTB: number
  raidScheme: string
} {
  return {
    rawCapacityTB: storage.rawCapacityTB,
    usableAfterRaidTB: storage.usableAfterRaidTB,
    lfsOverheadTB: storage.lfsOverheadTB,
    metadataOverheadTB: storage.metadataOverheadTB,
    safeUsableCapacityTB: storage.safeUsableCapacityTB,
    raidScheme: storage.raidScheme,
  }
}

/**
 * buildAggregateSlideData — returns 4 label/value rows for aggregate totals slide (EXP-04)
 * Replaces buildRecommendationsData — summarizes all workload domains.
 */
export function buildAggregateSlideData(
  totals: AggregateTotals
): Array<{ label: string; value: string }> {
  return [
    { label: 'Total recommended hosts (all domains)', value: String(totals.totalRecommendedHosts) },
    { label: 'Total VM count', value: String(totals.totalVmCount) },
    { label: 'Total raw storage', value: `${totals.totalRawStorageTB.toFixed(2)} TB` },
    { label: 'Total effective storage', value: `${totals.totalEffectiveStorageTB.toFixed(2)} TB` },
  ]
}

/**
 * buildAiGpuSlideData — returns label/value rows for AI/GPU workloads slide (PPTX-10)
 * Phase 14: accepts WorkloadDomainConfig directly instead of reading store.workloadDomains[0]
 */
export function buildAiGpuSlideData(
  domain: WorkloadDomainConfig
): Array<{ label: string; value: string }> {
  return [
    { label: 'GPU VM count', value: String(domain.gpuVmCount) },
    { label: 'vGPU memory per VM', value: `${domain.vgpuMemoryGB} GB` },
  ]
}

/**
 * buildNvmeTieringSlideData — returns label/value rows for NVMe memory tiering slide (PPTX-11)
 * Phase 14: accepts WorkloadDomainConfig directly instead of reading store.workloadDomains[0]
 */
export function buildNvmeTieringSlideData(
  domain: WorkloadDomainConfig
): Array<{ label: string; value: string }> {
  return [
    { label: 'Status', value: 'Enabled' },
    { label: 'Active memory percentage', value: `${domain.activeMemoryPct}%` },
  ]
}

/**
 * buildStretchTopologySlideData — returns topology rows + network checklist for stretch slide (PPTX-12)
 * Phase 14: accepts WorkloadDomainConfig directly instead of reading store.workloadDomains[0]
 * Accepts stretch: StretchResult directly (not full calc store) to keep function pure/testable.
 */
export function buildStretchTopologySlideData(
  domain: WorkloadDomainConfig,
  stretch: StretchResult,
): { topology: Array<{ label: string; value: string }>; checklist: string[] } {
  const topology = [
    { label: 'Preferred site hosts', value: String(domain.preferredSiteHosts) },
    { label: 'Secondary site hosts', value: String(domain.secondarySiteHosts) },
    { label: 'Total hosts', value: String(stretch.totalHosts) },
    { label: 'Min inter-site bandwidth', value: `${stretch.minBandwidthGbps} Gbps` },
    { label: 'Witness vCPU', value: String(stretch.witnessCores) },
    { label: 'Witness RAM', value: `${stretch.witnessRamGB} GB` },
    { label: 'Effective per-site storage', value: `${stretch.effectivePerSiteStorageTB.toFixed(2)} TB` },
  ]
  const nc = stretch.networkChecklist
  const checklist = [
    `Min inter-site bandwidth: ${nc.minInterSiteBandwidthGbps} Gbps`,
    `Max inter-site latency: ${nc.maxInterSiteLatencyMs} ms`,
    `Max witness latency: ${nc.maxWitnessLatencyMs} ms`,
    `Jumbo frames required: ${nc.jumboFramesRequired ? 'Yes' : 'No'}`,
    `Min witness bandwidth: ${nc.witnessMinBandwidthMbps} Mbps`,
  ]
  return { topology, checklist }
}

/**
 * buildVsanMaxSlideData — returns label/value rows for vSAN Max cluster slide (PPTX-13)
 * Phase 14: accepts WorkloadDomainConfig directly instead of reading store.workloadDomains[0]
 * Accepts vsanMax: VsanMaxResult directly — caller guards against null.
 */
export function buildVsanMaxSlideData(
  domain: WorkloadDomainConfig,
  vsanMax: VsanMaxResult,
): Array<{ label: string; value: string }> {
  return [
    { label: 'ReadyNode profile', value: domain.vsanMaxProfile.toUpperCase() },
    { label: 'Storage node count', value: String(vsanMax.storageNodeCount) },
    { label: 'Compute node count', value: String(vsanMax.computeNodeCount) },
    { label: 'RAID scheme', value: vsanMax.raidScheme },
    { label: 'Raw capacity', value: `${vsanMax.rawCapacityTB.toFixed(2)} TB` },
    { label: 'Usable capacity', value: `${vsanMax.usableCapacityTB.toFixed(2)} TB` },
  ]
}

/**
 * buildValidationWarningsSlideData — returns severity + messageKey rows for warnings slide (PPTX-14)
 * messageKey rendered as literal string — no i18n resolution in composable (Phase 6 decision).
 * Uses aggregateTotals.allValidationErrors for multi-domain aggregation.
 */
export function buildValidationWarningsSlideData(
  calc: ReturnType<typeof useCalculationStore>
): Array<{ severity: string; messageKey: string }> {
  return calc.aggregateTotals.allValidationErrors.map((w) => ({
    severity: w.severity,
    messageKey: w.messageKey,
  }))
}

// ─── Main export function ──────────────────────────────────────────────────────

/**
 * generatePptxReport — creates multi-domain VCF sizing report and triggers browser download.
 * pptxgenjs is dynamically imported to avoid including it in the main bundle (PPTX-15).
 * A fresh PptxGenJS instance is created per call — no state carryover (Pitfall 6).
 * Phase 14: full multi-domain loop — one slide group per workload domain + aggregate totals slide.
 */
export async function generatePptxReport(): Promise<void> {
  const store = useInputStore()
  const calc = useCalculationStore()

  // Dynamic import — Vite code-splits this automatically (PPTX-15)
  const PptxGenJS = (await import('pptxgenjs')).default
  // Fresh instance per export — no state carryover (Pitfall 6)
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches

  // MUST call defineSlideMaster() ONCE BEFORE any addSlide() (Pitfall 2)
  pres.defineSlideMaster({
    title: MASTER_NAME,
    background: { color: PPTX_MASTER_COLOR },
    objects: [
      {
        rect: {
          x: 0,
          y: 6.8,
          w: '100%',
          h: 0.7,
          fill: { color: PPTX_FOOTER_COLOR },
        },
      },
      {
        text: {
          text: 'VMware by Broadcom  |  VCF Sizer',
          options: {
            x: 0.3,
            y: 6.9,
            w: 9,
            h: 0.4,
            color: PPTX_LIGHT_TEXT,
            fontSize: 9,
          },
        },
      },
    ],
    slideNumber: { x: 12.5, y: 6.9, color: PPTX_LIGHT_TEXT, fontSize: 9 },
  })

  // ── Global slide 1: Title ────────────────────────────────────────────────────
  const titleData = buildTitleSlideData(store.workloadDomains.length)
  const s1 = pres.addSlide({ masterName: MASTER_NAME })
  s1.addText('VCF 9.x Sizing Report', {
    x: 0.5,
    y: 1.5,
    w: 12,
    h: 1.5,
    fontSize: 36,
    bold: true,
    color: PPTX_WHITE,
  })
  s1.addText(`Domains: ${titleData.domainCount}`, {
    x: 0.5,
    y: 3.2,
    w: 12,
    h: 0.8,
    fontSize: 20,
    color: PPTX_LIGHT_TEXT,
  })
  s1.addText(`Generated: ${titleData.date}`, {
    x: 0.5,
    y: 4.0,
    w: 12,
    h: 0.6,
    fontSize: 14,
    color: PPTX_LIGHT_TEXT,
  })

  // ── Global slide 2: Management Domain Overhead ───────────────────────────────
  const mgmtData = buildMgmtOverheadData(calc.management)
  const s2 = pres.addSlide({ masterName: MASTER_NAME })
  s2.addText('Management Domain Overhead', {
    x: 0.5,
    y: 0.3,
    w: 12,
    h: 0.8,
    fontSize: 24,
    bold: true,
    color: PPTX_WHITE,
  })
  const mgmtRows: TableRow[] = [
    [hdrCell('Component'), hdrCell('vCPU'), hdrCell('RAM (GB)')],
    ...mgmtData.map((r): TableRow => [
      cell(r.label, r.label === 'Total'),
      cell(String(r.cores), r.label === 'Total'),
      cell(String(r.ramGB), r.label === 'Total'),
    ]),
  ]
  s2.addTable(mgmtRows, {
    x: 0.5,
    y: 1.3,
    w: 12,
    colW: [5, 3.5, 3.5],
    rowH: 0.45,
    fontSize: 13,
    color: 'F0F0F0',
    border: { type: 'solid', pt: 1, color: '444444' },
  })

  // ── Per-domain slide groups ──────────────────────────────────────────────────
  for (const domain of store.workloadDomains) {
    const result = calc.domainResults.find(r => r.id === domain.id)!

    // Domain: Configuration Summary
    const configData = buildConfigSummaryData(domain, store.managementArchitecture)
    const sCfg = pres.addSlide({ masterName: MASTER_NAME })
    sCfg.addText(`Domain: ${domain.name}`, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 24, bold: true, color: PPTX_WHITE,
    })
    const configRows: TableRow[] = [
      [hdrCell('Parameter'), hdrCell('Value')],
      ...configData.map((r): TableRow => [cell(r.label), cell(r.value)]),
    ]
    sCfg.addTable(configRows, {
      x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
      fontSize: 13, color: 'F0F0F0',
      border: { type: 'solid', pt: 1, color: '444444' },
    })

    // Domain: Workload Profile
    const workloadData = buildWorkloadSlideData(domain)
    const sWkld = pres.addSlide({ masterName: MASTER_NAME })
    sWkld.addText(`${domain.name} — Workload Profile`, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 24, bold: true, color: PPTX_WHITE,
    })
    const wkldRows: TableRow[] = [
      [hdrCell('Parameter'), hdrCell('Value')],
      ...workloadData.map((r): TableRow => [cell(r.label), cell(r.value)]),
    ]
    sWkld.addTable(wkldRows, {
      x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
      fontSize: 13, color: 'F0F0F0',
      border: { type: 'solid', pt: 1, color: '444444' },
    })

    // Domain: Compute Results
    const computeData = buildComputeResultsData(result.compute)
    const sComp = pres.addSlide({ masterName: MASTER_NAME })
    sComp.addText(`${domain.name} — Compute Results`, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 24, bold: true, color: PPTX_WHITE,
    })
    const compRows: TableRow[] = [
      [hdrCell('Metric'), hdrCell('Value')],
      [cell('Recommended Host Count'), cell(String(computeData.recommendedHostCount), true)],
      [cell('Min Hosts for CPU'), cell(String(computeData.minHostsForCpu))],
      [cell('Min Hosts for RAM'), cell(String(computeData.minHostsForRam))],
      [cell('Available vCPU'), cell(String(computeData.availableCores))],
      [cell('Available RAM (GB)'), cell(String(Math.round(computeData.availableRamGB)))],
      [cell('CPU Utilization'), cell(`${computeData.coreUtilizationPct.toFixed(1)}%`)],
      [cell('RAM Utilization'), cell(`${computeData.ramUtilizationPct.toFixed(1)}%`)],
    ]
    sComp.addTable(compRows, {
      x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
      fontSize: 13, color: 'F0F0F0',
      border: { type: 'solid', pt: 1, color: '444444' },
    })

    // Domain: Storage Results
    const storageData = buildStorageResultsData(result.storage)
    const sStor = pres.addSlide({ masterName: MASTER_NAME })
    sStor.addText(`${domain.name} — Storage Results`, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 24, bold: true, color: PPTX_WHITE,
    })
    const storRows: TableRow[] = [
      [hdrCell('Metric'), hdrCell('Value')],
      [cell('RAID Scheme'), cell(storageData.raidScheme)],
      [cell('Raw Capacity'), cell(`${storageData.rawCapacityTB.toFixed(2)} TB`)],
      [cell('Usable After RAID'), cell(`${storageData.usableAfterRaidTB.toFixed(2)} TB`)],
      [cell('LFS Overhead'), cell(`${storageData.lfsOverheadTB.toFixed(2)} TB`)],
      [cell('Metadata Overhead'), cell(`${storageData.metadataOverheadTB.toFixed(2)} TB`)],
      [
        cell('Safe Usable Capacity', true),
        cell(`${storageData.safeUsableCapacityTB.toFixed(2)} TB`, true),
      ],
    ]
    sStor.addTable(storRows, {
      x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
      fontSize: 13, color: 'F0F0F0',
      border: { type: 'solid', pt: 1, color: '444444' },
    })

    // Domain: Conditional Slide — AI/GPU Workloads (PPTX-10)
    if (domain.gpuVmCount > 0) {
      const gpuData = buildAiGpuSlideData(domain)
      const sGpu = pres.addSlide({ masterName: MASTER_NAME })
      sGpu.addText(`${domain.name} — AI / GPU Workloads`, {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 24, bold: true, color: PPTX_WHITE,
      })
      const gpuRows: TableRow[] = [
        [hdrCell('Parameter'), hdrCell('Value')],
        ...gpuData.map((r): TableRow => [cell(r.label), cell(r.value)]),
      ]
      sGpu.addTable(gpuRows, {
        x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
        fontSize: 13, color: 'F0F0F0',
        border: { type: 'solid', pt: 1, color: '444444' },
      })
    }

    // Domain: Conditional Slide — NVMe Memory Tiering (PPTX-11)
    if (domain.nvmeTieringEnabled) {
      const nvmeData = buildNvmeTieringSlideData(domain)
      const sNvme = pres.addSlide({ masterName: MASTER_NAME })
      sNvme.addText(`${domain.name} — NVMe Memory Tiering`, {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 24, bold: true, color: PPTX_WHITE,
      })
      const nvmeRows: TableRow[] = [
        [hdrCell('Parameter'), hdrCell('Value')],
        ...nvmeData.map((r): TableRow => [cell(r.label), cell(r.value)]),
      ]
      sNvme.addTable(nvmeRows, {
        x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
        fontSize: 13, color: 'F0F0F0',
        border: { type: 'solid', pt: 1, color: '444444' },
      })
    }

    // Domain: Conditional Slide — Stretch Cluster Topology (PPTX-12)
    if (domain.deploymentMode === 'stretch') {
      const stretchData = buildStretchTopologySlideData(domain, result.stretch!)
      const sStretch = pres.addSlide({ masterName: MASTER_NAME })
      sStretch.addText(`${domain.name} — Stretch Cluster Topology`, {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 24, bold: true, color: PPTX_WHITE,
      })
      const topoRows: TableRow[] = [
        [hdrCell('Parameter'), hdrCell('Value')],
        ...stretchData.topology.map((r): TableRow => [cell(r.label), cell(r.value)]),
      ]
      sStretch.addTable(topoRows, {
        x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.35,
        fontSize: 11, color: 'F0F0F0',
        border: { type: 'solid', pt: 1, color: '444444' },
      })
      sStretch.addText('Network Checklist', {
        x: 0.5, y: 4.3, w: 12, h: 0.5,
        fontSize: 16, bold: true, color: PPTX_WHITE,
      })
      const checkText = stretchData.checklist.map((c) => `  \u2022  ${c}`).join('\n')
      sStretch.addText(checkText, {
        x: 0.5, y: 4.9, w: 12, h: 1.8,
        fontSize: 11, color: PPTX_WHITE, valign: 'top', lineSpacingMultiple: 1.3,
      })
    }

    // Domain: Conditional Slide — vSAN Max Cluster (PPTX-13)
    if (domain.storageType === 'vsan-max' && result.vsanMax !== null) {
      const vmaxData = buildVsanMaxSlideData(domain, result.vsanMax)
      const sVmax = pres.addSlide({ masterName: MASTER_NAME })
      sVmax.addText(`${domain.name} — vSAN Max Cluster`, {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 24, bold: true, color: PPTX_WHITE,
      })
      const vmaxRows: TableRow[] = [
        [hdrCell('Parameter'), hdrCell('Value')],
        ...vmaxData.map((r): TableRow => [cell(r.label), cell(r.value)]),
      ]
      sVmax.addTable(vmaxRows, {
        x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
        fontSize: 13, color: 'F0F0F0',
        border: { type: 'solid', pt: 1, color: '444444' },
      })
    }
  } // end per-domain loop

  // ── After domain loop: Aggregate Totals slide ────────────────────────────────
  const aggData = buildAggregateSlideData(calc.aggregateTotals)
  const sAgg = pres.addSlide({ masterName: MASTER_NAME })
  sAgg.addText('Aggregate Totals', {
    x: 0.5, y: 0.3, w: 12, h: 0.8,
    fontSize: 24, bold: true, color: PPTX_WHITE,
  })
  const aggRows: TableRow[] = [
    [hdrCell('Metric'), hdrCell('Value')],
    ...aggData.map((r): TableRow => [cell(r.label), cell(r.value)]),
  ]
  sAgg.addTable(aggRows, {
    x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
    fontSize: 13, color: 'F0F0F0',
    border: { type: 'solid', pt: 1, color: '444444' },
  })

  // ── Conditional Slide: Validation Warnings (PPTX-14) — always last ───────────
  if (calc.aggregateTotals.allValidationErrors.length > 0) {
    const warningsData = buildValidationWarningsSlideData(calc)
    const sWarn = pres.addSlide({ masterName: MASTER_NAME })
    sWarn.addText('Validation Warnings', {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 24, bold: true, color: PPTX_WHITE,
    })
    const warnRows: TableRow[] = [
      [hdrCell('Severity'), hdrCell('Message')],
      ...warningsData.map((w): TableRow => [
        cell(`[${w.severity.toUpperCase()}]`),
        cell(w.messageKey),
      ]),
    ]
    sWarn.addTable(warnRows, {
      x: 0.5, y: 1.3, w: 12, colW: [3, 9], rowH: 0.45,
      fontSize: 13, color: 'F0F0F0',
      border: { type: 'solid', pt: 1, color: '444444' },
    })
  }

  // Trigger browser download — MUST await (Pitfall 5)
  await pres.writeFile({ fileName: 'vcf-sizing-report.pptx' })
}
