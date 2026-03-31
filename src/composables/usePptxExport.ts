// PPTX export composable — generates VCF sizing report as .pptx browser download
// Plain TypeScript — NO Vue lifecycle hooks (CALC-01/CALC-02 compliant)
// pptxgenjs is loaded via dynamic import() to keep it out of the main bundle (PPTX-15)

import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import type { MgmtDomainResult, ComputeResult, StorageResult, StretchResult, VsanMaxResult, AggregateTotals } from '@/engine/types'
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
 * buildTitleSlideData — returns { deploymentMode, date } for title slide (PPTX-03)
 */
export function buildTitleSlideData(store: ReturnType<typeof useInputStore>): {
  deploymentMode: string
  date: string
} {
  return {
    deploymentMode: store.deploymentMode,
    date: new Date().toISOString().split('T')[0],
  }
}

/**
 * buildConfigSummaryData — returns 8 label/value rows for config summary slide (PPTX-04)
 */
export function buildConfigSummaryData(
  store: ReturnType<typeof useInputStore>
): Array<{ label: string; value: string }> {
  return [
    { label: 'Hosts', value: String(store.hostCount) },
    { label: 'Cores per socket', value: String(store.coresPerSocket) },
    { label: 'Sockets per host', value: String(store.socketsPerHost) },
    { label: 'RAM per host', value: `${store.hostRamGB} GB` },
    { label: 'Storage per host', value: `${store.hostStorageTB} TB` },
    { label: 'Storage type', value: store.storageType },
    { label: 'Network speed', value: `${store.networkSpeedGbE} GbE` },
    { label: 'Management architecture', value: store.managementArchitecture },
  ]
}

/**
 * buildWorkloadSlideData — returns 6 label/value rows for workload profile slide (PPTX-05)
 */
export function buildWorkloadSlideData(
  store: ReturnType<typeof useInputStore>
): Array<{ label: string; value: string }> {
  return [
    { label: 'VM count', value: String(store.vmCount) },
    { label: 'vCPU per VM', value: String(store.avgVcpuPerVm) },
    { label: 'vRAM per VM', value: `${store.avgVramGbPerVm} GB` },
    { label: 'Storage per VM', value: `${store.avgStorageGbPerVm} GB` },
    { label: 'CPU overcommit ratio', value: `${store.cpuOvercommitRatio}:1` },
    { label: 'RAM overcommit ratio', value: `${store.ramOvercommitRatio}:1` },
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
 * buildRecommendationsData — returns string[] recommendations for recommendations slide (PPTX-09)
 */
export function buildRecommendationsData(
  _store: ReturnType<typeof useInputStore>,
  calc: ReturnType<typeof useCalculationStore>
): string[] {
  const recs: string[] = [
    `Recommended host count: ${calc.compute.recommendedHostCount}`,
    `Safe usable storage: ${calc.storage.safeUsableCapacityTB.toFixed(2)} TB`,
    `CPU utilization: ${calc.compute.coreUtilizationPct.toFixed(1)}%`,
    `RAM utilization: ${calc.compute.ramUtilizationPct.toFixed(1)}%`,
  ]
  if (calc.validationErrors.length > 0) {
    recs.push(`Active warnings: ${calc.validationErrors.length}`)
  }
  return recs
}

/**
 * buildAiGpuSlideData — returns label/value rows for AI/GPU workloads slide (PPTX-10)
 */
export function buildAiGpuSlideData(
  store: ReturnType<typeof useInputStore>
): Array<{ label: string; value: string }> {
  return [
    { label: 'GPU VM count', value: String(store.gpuVmCount) },
    { label: 'vGPU memory per VM', value: `${store.vgpuMemoryGB} GB` },
  ]
}

/**
 * buildNvmeTieringSlideData — returns label/value rows for NVMe memory tiering slide (PPTX-11)
 */
export function buildNvmeTieringSlideData(
  store: ReturnType<typeof useInputStore>
): Array<{ label: string; value: string }> {
  return [
    { label: 'Status', value: 'Enabled' },
    { label: 'Active memory percentage', value: `${store.activeMemoryPct}%` },
  ]
}

/**
 * buildStretchTopologySlideData — returns topology rows + network checklist for stretch slide (PPTX-12)
 * Accepts stretch: StretchResult directly (not full calc store) to keep function pure/testable.
 */
export function buildStretchTopologySlideData(
  store: ReturnType<typeof useInputStore>,
  stretch: StretchResult,
): { topology: Array<{ label: string; value: string }>; checklist: string[] } {
  const topology = [
    { label: 'Preferred site hosts', value: String(store.preferredSiteHosts) },
    { label: 'Secondary site hosts', value: String(store.secondarySiteHosts) },
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
 * Accepts vsanMax: VsanMaxResult directly — caller guards against null.
 */
export function buildVsanMaxSlideData(
  store: ReturnType<typeof useInputStore>,
  vsanMax: VsanMaxResult,
): Array<{ label: string; value: string }> {
  return [
    { label: 'ReadyNode profile', value: store.vsanMaxProfile.toUpperCase() },
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
 */
export function buildValidationWarningsSlideData(
  calc: ReturnType<typeof useCalculationStore>
): Array<{ severity: string; messageKey: string }> {
  return calc.validationErrors.map((w) => ({
    severity: w.severity,
    messageKey: w.messageKey,
  }))
}

/**
 * buildAggregateSlideData — returns 5 label/value rows for aggregate totals slide (EXPORT-02)
 * Management hosts row shows numeric count for dedicated architecture, or 'colocated with WLD-1'.
 */
export function buildAggregateSlideData(
  totals: AggregateTotals,
  managementArchitecture: string,
  dedicatedMgmtHostCount: number | null
): Array<{ label: string; value: string }> {
  const mgmtLine = managementArchitecture === 'dedicated' && dedicatedMgmtHostCount !== null
    ? String(dedicatedMgmtHostCount)
    : 'colocated with WLD-1'
  return [
    { label: 'Total recommended hosts (all domains)', value: String(totals.totalRecommendedHosts) },
    { label: 'Management hosts', value: mgmtLine },
    { label: 'Total VM count', value: String(totals.totalVmCount) },
    { label: 'Total raw storage', value: `${totals.totalRawStorageTB.toFixed(2)} TB` },
    { label: 'Total effective storage', value: `${totals.totalEffectiveStorageTB.toFixed(2)} TB` },
  ]
}

// ─── Main export function ──────────────────────────────────────────────────────

/**
 * generatePptxReport — creates 7-slide VCF sizing report and triggers browser download.
 * pptxgenjs is dynamically imported to avoid including it in the main bundle (PPTX-15).
 * A fresh PptxGenJS instance is created per call — no state carryover (Pitfall 6).
 */
export async function generatePptxReport(): Promise<void> {
  const store = useInputStore()
  const calc = useCalculationStore()

  // Dynamic import — Vite code-splits this automatically (PPTX-15)
  const PptxGenJS = (await import('pptxgenjs')).default
  // Fresh instance per export — no state carryover (Pitfall 6)
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches

  // MUST call defineSlideMaster() BEFORE any addSlide() (Pitfall 2)
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

  const titleData = buildTitleSlideData(store)
  const configData = buildConfigSummaryData(store)
  const workloadData = buildWorkloadSlideData(store)
  const mgmtData = buildMgmtOverheadData(calc.management)
  const computeData = buildComputeResultsData(calc.compute)
  const storageData = buildStorageResultsData(calc.storage)
  const recsData = buildRecommendationsData(store, calc)

  // Slide 1: Title (PPTX-03)
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
  s1.addText(`Deployment: ${titleData.deploymentMode}`, {
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

  // Slide 2: Configuration Summary (PPTX-04)
  const s2 = pres.addSlide({ masterName: MASTER_NAME })
  s2.addText('Configuration Summary', {
    x: 0.5,
    y: 0.3,
    w: 12,
    h: 0.8,
    fontSize: 24,
    bold: true,
    color: PPTX_WHITE,
  })
  const configRows: TableRow[] = [
    [hdrCell('Parameter'), hdrCell('Value')],
    ...configData.map((r): TableRow => [cell(r.label), cell(r.value)]),
  ]
  s2.addTable(configRows, {
    x: 0.5,
    y: 1.3,
    w: 12,
    colW: [6, 6],
    rowH: 0.45,
    fontSize: 13,
    color: 'F0F0F0',
    border: { type: 'solid', pt: 1, color: '444444' },
  })

  // Slide 3: Workload Profile (PPTX-05)
  const s3 = pres.addSlide({ masterName: MASTER_NAME })
  s3.addText('Workload Profile', {
    x: 0.5,
    y: 0.3,
    w: 12,
    h: 0.8,
    fontSize: 24,
    bold: true,
    color: PPTX_WHITE,
  })
  const wkldRows: TableRow[] = [
    [hdrCell('Parameter'), hdrCell('Value')],
    ...workloadData.map((r): TableRow => [cell(r.label), cell(r.value)]),
  ]
  s3.addTable(wkldRows, {
    x: 0.5,
    y: 1.3,
    w: 12,
    colW: [6, 6],
    rowH: 0.45,
    fontSize: 13,
    color: 'F0F0F0',
    border: { type: 'solid', pt: 1, color: '444444' },
  })

  // Slide 4: Management Domain Overhead (PPTX-06)
  const s4 = pres.addSlide({ masterName: MASTER_NAME })
  s4.addText('Management Domain Overhead', {
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
  s4.addTable(mgmtRows, {
    x: 0.5,
    y: 1.3,
    w: 12,
    colW: [5, 3.5, 3.5],
    rowH: 0.45,
    fontSize: 13,
    color: 'F0F0F0',
    border: { type: 'solid', pt: 1, color: '444444' },
  })

  // Slide 5: Compute Results (PPTX-07)
  const s5 = pres.addSlide({ masterName: MASTER_NAME })
  s5.addText('Compute Results', {
    x: 0.5,
    y: 0.3,
    w: 12,
    h: 0.8,
    fontSize: 24,
    bold: true,
    color: PPTX_WHITE,
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
  s5.addTable(compRows, {
    x: 0.5,
    y: 1.3,
    w: 12,
    colW: [6, 6],
    rowH: 0.45,
    fontSize: 13,
    color: 'F0F0F0',
    border: { type: 'solid', pt: 1, color: '444444' },
  })

  // Slide 6: Storage Results (PPTX-08)
  const s6 = pres.addSlide({ masterName: MASTER_NAME })
  s6.addText('Storage Results', {
    x: 0.5,
    y: 0.3,
    w: 12,
    h: 0.8,
    fontSize: 24,
    bold: true,
    color: PPTX_WHITE,
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
  s6.addTable(storRows, {
    x: 0.5,
    y: 1.3,
    w: 12,
    colW: [6, 6],
    rowH: 0.45,
    fontSize: 13,
    color: 'F0F0F0',
    border: { type: 'solid', pt: 1, color: '444444' },
  })

  // Slide 7: Recommendations (PPTX-09)
  const s7 = pres.addSlide({ masterName: MASTER_NAME })
  s7.addText('Recommendations', {
    x: 0.5,
    y: 0.3,
    w: 12,
    h: 0.8,
    fontSize: 24,
    bold: true,
    color: PPTX_WHITE,
  })
  const recText = recsData.map((r) => `  \u2022  ${r}`).join('\n')
  s7.addText(recText, {
    x: 0.5,
    y: 1.5,
    w: 12,
    h: 4.5,
    fontSize: 16,
    color: PPTX_WHITE,
    valign: 'top',
    lineSpacingMultiple: 1.5,
  })

  // Conditional Slide: AI/GPU Workloads (PPTX-10)
  if (store.gpuVmCount > 0) {
    const gpuData = buildAiGpuSlideData(store)
    const sGpu = pres.addSlide({ masterName: MASTER_NAME })
    sGpu.addText('AI / GPU Workloads', {
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

  // Conditional Slide: NVMe Memory Tiering (PPTX-11)
  if (store.nvmeTieringEnabled) {
    const nvmeData = buildNvmeTieringSlideData(store)
    const sNvme = pres.addSlide({ masterName: MASTER_NAME })
    sNvme.addText('NVMe Memory Tiering', {
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

  // Conditional Slide: Stretch Cluster Topology (PPTX-12)
  if (store.deploymentMode === 'stretch') {
    const stretchData = buildStretchTopologySlideData(store, calc.stretch)
    const sStretch = pres.addSlide({ masterName: MASTER_NAME })
    sStretch.addText('Stretch Cluster Topology', {
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

  // Conditional Slide: vSAN Max Cluster (PPTX-13)
  if (store.storageType === 'vsan-max' && calc.vsanMax !== null) {
    const vmaxData = buildVsanMaxSlideData(store, calc.vsanMax)
    const sVmax = pres.addSlide({ masterName: MASTER_NAME })
    sVmax.addText('vSAN Max Cluster', {
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

  // Conditional Slide: Validation Warnings (PPTX-14)
  if (calc.validationErrors.length > 0) {
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
