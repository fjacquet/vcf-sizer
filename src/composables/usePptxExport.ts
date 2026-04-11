// PPTX export composable — generates VCF sizing report as .pptx browser download
// Plain TypeScript — NO Vue lifecycle hooks (CALC-01/CALC-02 compliant)
// pptxgenjs is loaded via dynamic import() to keep it out of the main bundle (PPTX-15)
// Phase 22: All user-visible strings localized via i18n.global.t() (EXPORT-02)

import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { useUiStore } from '@/stores/uiStore'
import { i18n } from '@/i18n'
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
// Phase 22: t parameter added as last arg for i18n localization (PITFALL-3/4)

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
  managementArchitecture: string,
  t: (key: string) => string = (k) => k
): Array<{ label: string; value: string }> {
  return [
    { label: t('export.hosts'), value: String(domain.hostCount) },
    { label: t('export.coresPerSocket'), value: String(domain.coresPerSocket) },
    { label: t('export.socketsPerHost'), value: String(domain.socketsPerHost) },
    { label: t('export.ramPerHost'), value: `${domain.hostRamGB} GB` },
    { label: t('export.storagePerHost'), value: `${domain.hostStorageTiB} TB` },
    { label: t('export.storageType'), value: domain.storageType },
    { label: t('export.networkSpeed'), value: `${domain.networkSpeedGbE} GbE` },
    { label: t('export.mgmtArch'), value: managementArchitecture },
  ]
}

/**
 * buildWorkloadSlideData — returns 6 label/value rows for workload profile slide (PPTX-05)
 * Phase 14: accepts WorkloadDomainConfig directly instead of reading store.workloadDomains[0]
 */
export function buildWorkloadSlideData(
  domain: WorkloadDomainConfig,
  t: (key: string) => string = (k) => k
): Array<{ label: string; value: string }> {
  return [
    { label: t('export.vmCount'), value: String(domain.vmCount) },
    { label: t('export.vcpuPerVm'), value: String(domain.avgVcpuPerVm) },
    { label: t('export.vramPerVm'), value: `${domain.avgVramGbPerVm} GB` },
    { label: t('export.storagePerVm'), value: `${domain.avgStorageGbPerVm} GB` },
    { label: t('export.cpuOvercommit'), value: `${domain.cpuOvercommitRatio}:1` },
    { label: t('export.ramOvercommit'), value: `${domain.ramOvercommitRatio}:1` },
  ]
}

/**
 * buildMgmtOverheadData — returns 6 rows for management domain overhead slide (PPTX-06)
 */
export function buildMgmtOverheadData(
  mgmt: MgmtDomainResult,
  t: (key: string) => string = (k) => k
): Array<{ label: string; cores: number; ramGB: number }> {
  return [
    { label: t('export.vcenter'), cores: mgmt.vcenterCores, ramGB: mgmt.vcenterRamGB },
    { label: t('export.sddcManager'), cores: mgmt.sddcCores, ramGB: mgmt.sddcRamGB },
    { label: t('export.nsx'), cores: mgmt.nsxCores, ramGB: mgmt.nsxRamGB },
    { label: t('export.ariaOps'), cores: mgmt.opsCores, ramGB: mgmt.opsRamGB },
    { label: t('export.automation'), cores: mgmt.automationCores, ramGB: mgmt.automationRamGB },
    { label: t('export.total'), cores: mgmt.totalCores, ramGB: mgmt.totalRamGB },
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
  rawCapacityTiB: number
  usableAfterRaidTiB: number
  lfsOverheadTiB: number
  metadataOverheadTiB: number
  safeUsableCapacityTiB: number
  raidScheme: string
} {
  return {
    rawCapacityTiB: storage.rawCapacityTiB,
    usableAfterRaidTiB: storage.usableAfterRaidTiB,
    lfsOverheadTiB: storage.lfsOverheadTiB,
    metadataOverheadTiB: storage.metadataOverheadTiB,
    safeUsableCapacityTiB: storage.safeUsableCapacityTiB,
    raidScheme: storage.raidScheme,
  }
}

/**
 * buildAggregateSlideData — returns 5 label/value rows for aggregate totals slide (EXP-04, EXPORT-02)
 * Replaces buildRecommendationsData — summarizes all workload domains.
 * Management hosts row shows numeric count for dedicated architecture, or localized 'colocated with WLD-1'.
 */
export function buildAggregateSlideData(
  totals: AggregateTotals,
  managementArchitecture: string,
  dedicatedMgmtHostCount: number | null,
  managementStorageType?: string,
  t: (key: string) => string = (k) => k
): Array<{ label: string; value: string }> {
  const mgmtLine = managementArchitecture === 'dedicated' && dedicatedMgmtHostCount !== null
    ? String(dedicatedMgmtHostCount)
    : t('export.colocatedWld1')
  const rows: Array<{ label: string; value: string }> = [
    { label: t('export.totalRecommendedHosts'), value: String(totals.totalRecommendedHosts) },
    { label: t('export.managementHosts'), value: mgmtLine },
  ]
  if (managementStorageType !== undefined) {
    rows.push({ label: t('export.mgmtStorageType'), value: managementStorageType })
  }
  rows.push(
    { label: t('export.totalVmCount'), value: String(totals.totalVmCount) },
    { label: t('export.totalRawStorage'), value: `${totals.totalRawStorageTiB.toFixed(2)} TB` },
    { label: t('export.totalEffectiveStorage'), value: `${totals.totalEffectiveStorageTiB.toFixed(2)} TB` },
  )
  return rows
}

/**
 * buildAiGpuSlideData — returns label/value rows for AI/GPU workloads slide (PPTX-10)
 * Phase 14: accepts WorkloadDomainConfig directly instead of reading store.workloadDomains[0]
 */
export function buildAiGpuSlideData(
  domain: WorkloadDomainConfig,
  t: (key: string) => string = (k) => k
): Array<{ label: string; value: string }> {
  return [
    { label: t('export.gpuVmCount'), value: String(domain.gpuVmCount) },
    { label: t('export.vgpuMemPerVm'), value: `${domain.vgpuMemoryGB} GB` },
  ]
}

/**
 * buildNvmeTieringSlideData — returns label/value rows for NVMe memory tiering slide (PPTX-11)
 * Phase 14: accepts WorkloadDomainConfig directly instead of reading store.workloadDomains[0]
 */
export function buildNvmeTieringSlideData(
  domain: WorkloadDomainConfig,
  t: (key: string) => string = (k) => k
): Array<{ label: string; value: string }> {
  return [
    { label: t('export.status'), value: t('export.enabled') },
    { label: t('export.activeMemoryPct'), value: `${domain.activeMemoryPct}%` },
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
  t: (key: string) => string = (k) => k
): { topology: Array<{ label: string; value: string }>; checklist: string[] } {
  const topology = [
    { label: t('export.preferredSiteHosts'), value: String(domain.preferredSiteHosts) },
    { label: t('export.secondarySiteHosts'), value: String(domain.secondarySiteHosts) },
    { label: t('export.totalHosts'), value: String(stretch.totalHosts) },
    { label: t('export.minInterSiteBw'), value: `${stretch.minBandwidthGbps} Gbps` },
    { label: t('export.witnessVcpu'), value: String(stretch.witnessCores) },
    { label: t('export.witnessRam'), value: `${stretch.witnessRamGB} GB` },
    { label: t('export.effectivePerSiteStorage'), value: `${stretch.effectivePerSiteStorageTiB.toFixed(2)} TB` },
  ]
  const nc = stretch.networkChecklist
  const checklist = [
    `${t('export.minInterSiteBandwidth')}: ${nc.minInterSiteBandwidthGbps} Gbps`,
    `${t('export.maxInterSiteLatency')}: ${nc.maxInterSiteLatencyMs} ms`,
    `${t('export.maxWitnessLatency')}: ${nc.maxWitnessLatencyMs} ms`,
    `${t('export.jumboFramesRequired')}: ${nc.jumboFramesRequired ? t('export.yes') : t('export.no')}`,
    `${t('export.minWitnessBandwidth')}: ${nc.witnessMinBandwidthMbps} Mbps`,
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
  t: (key: string) => string = (k) => k
): Array<{ label: string; value: string }> {
  return [
    { label: t('export.readyNodeProfile'), value: domain.vsanMaxProfile.toUpperCase() },
    { label: t('export.storageNodeCount'), value: String(vsanMax.storageNodeCount) },
    { label: t('export.computeNodeCount'), value: String(vsanMax.computeNodeCount) },
    { label: t('export.raidScheme'), value: vsanMax.raidScheme },
    { label: t('export.rawCapacity'), value: `${vsanMax.rawCapacityTiB.toFixed(2)} TB` },
    { label: t('export.usableCapacity'), value: `${vsanMax.usableCapacityTiB.toFixed(2)} TB` },
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
 * Phase 22: All slide text uses i18n.global.t() for active locale (PITFALL-3).
 */
export async function generatePptxReport(): Promise<void> {
  const store = useInputStore()
  const calc = useCalculationStore()
  const uiStore = useUiStore()
  const t = i18n.global.t

  // Dynamic import — Vite code-splits this automatically (PPTX-15)
  const PptxGenJS = (await import('pptxgenjs')).default
  // Fresh instance per export — no state carryover (Pitfall 6)
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches

  // MUST call defineSlideMaster() ONCE BEFORE any addSlide() (Pitfall 2)
  // Brand footer remains hardcoded — NOT localized (brand string)
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
  s1.addText(t('export.title'), {
    x: 0.5,
    y: 1.5,
    w: 12,
    h: 1.5,
    fontSize: 36,
    bold: true,
    color: PPTX_WHITE,
  })
  s1.addText(`${t('export.domains')}: ${titleData.domainCount}`, {
    x: 0.5,
    y: 3.2,
    w: 12,
    h: 0.8,
    fontSize: 20,
    color: PPTX_LIGHT_TEXT,
  })
  s1.addText(`${t('export.generated')}: ${titleData.date}`, {
    x: 0.5,
    y: 4.0,
    w: 12,
    h: 0.6,
    fontSize: 14,
    color: PPTX_LIGHT_TEXT,
  })

  // ── Global slide 2: Management Domain Overhead ───────────────────────────────
  const mgmtData = buildMgmtOverheadData(calc.management, t)
  const s2 = pres.addSlide({ masterName: MASTER_NAME })
  s2.addText(t('export.mgmtOverhead'), {
    x: 0.5,
    y: 0.3,
    w: 12,
    h: 0.8,
    fontSize: 24,
    bold: true,
    color: PPTX_WHITE,
  })
  const mgmtRows: TableRow[] = [
    [hdrCell(t('export.component')), hdrCell(t('export.vcpu')), hdrCell(t('export.ramGb'))],
    ...mgmtData.map((r): TableRow => [
      cell(r.label, r.label === t('export.total')),
      cell(String(r.cores), r.label === t('export.total')),
      cell(String(r.ramGB), r.label === t('export.total')),
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
    const configData = buildConfigSummaryData(domain, store.managementArchitecture, t)
    const sCfg = pres.addSlide({ masterName: MASTER_NAME })
    sCfg.addText(`${t('export.domain')}: ${domain.name}`, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 24, bold: true, color: PPTX_WHITE,
    })
    const configRows: TableRow[] = [
      [hdrCell(t('export.parameter')), hdrCell(t('export.value'))],
      ...configData.map((r): TableRow => [cell(r.label), cell(r.value)]),
    ]
    sCfg.addTable(configRows, {
      x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
      fontSize: 13, color: 'F0F0F0',
      border: { type: 'solid', pt: 1, color: '444444' },
    })

    // Domain: Workload Profile
    const workloadData = buildWorkloadSlideData(domain, t)
    const sWkld = pres.addSlide({ masterName: MASTER_NAME })
    sWkld.addText(`${domain.name} — ${t('export.workloadProfile')}`, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 24, bold: true, color: PPTX_WHITE,
    })
    const wkldRows: TableRow[] = [
      [hdrCell(t('export.parameter')), hdrCell(t('export.value'))],
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
    sComp.addText(`${domain.name} — ${t('export.computeSizing')}`, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 24, bold: true, color: PPTX_WHITE,
    })
    const compRows: TableRow[] = [
      [hdrCell(t('export.metric')), hdrCell(t('export.value'))],
      [cell(t('export.recommendedHostCount')), cell(String(computeData.recommendedHostCount), true)],
      [cell(t('export.minHostsCpu')), cell(String(computeData.minHostsForCpu))],
      [cell(t('export.minHostsRam')), cell(String(computeData.minHostsForRam))],
      [cell(t('export.availableVcpu')), cell(String(computeData.availableCores))],
      [cell(t('export.availableRamGb')), cell(String(Math.round(computeData.availableRamGB)))],
      [cell(t('export.cpuUtilization')), cell(`${computeData.coreUtilizationPct.toFixed(1)}%`)],
      [cell(t('export.ramUtilization')), cell(`${computeData.ramUtilizationPct.toFixed(1)}%`)],
    ]
    sComp.addTable(compRows, {
      x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
      fontSize: 13, color: 'F0F0F0',
      border: { type: 'solid', pt: 1, color: '444444' },
    })

    // Domain: Storage Results
    const storageData = buildStorageResultsData(result.storage)
    const sStor = pres.addSlide({ masterName: MASTER_NAME })
    sStor.addText(`${domain.name} — ${t('export.storageSizing')}`, {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 24, bold: true, color: PPTX_WHITE,
    })
    const storRows: TableRow[] = [
      [hdrCell(t('export.metric')), hdrCell(t('export.value'))],
      [cell(t('export.raidScheme')), cell(storageData.raidScheme)],
      [cell(t('export.rawCapacity')), cell(`${storageData.rawCapacityTiB.toFixed(2)} TB`)],
      [cell(t('export.usableAfterRaid')), cell(`${storageData.usableAfterRaidTiB.toFixed(2)} TB`)],
      [cell(t('export.lfsOverhead')), cell(`${storageData.lfsOverheadTiB.toFixed(2)} TB`)],
      [cell(t('export.metadataOverhead')), cell(`${storageData.metadataOverheadTiB.toFixed(2)} TB`)],
      [
        cell(t('export.safeUsableCapacity'), true),
        cell(`${storageData.safeUsableCapacityTiB.toFixed(2)} TB`, true),
      ],
    ]
    sStor.addTable(storRows, {
      x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
      fontSize: 13, color: 'F0F0F0',
      border: { type: 'solid', pt: 1, color: '444444' },
    })

    // Domain: Conditional Slide — AI/GPU Workloads (PPTX-10)
    if (domain.gpuVmCount > 0) {
      const gpuData = buildAiGpuSlideData(domain, t)
      const sGpu = pres.addSlide({ masterName: MASTER_NAME })
      sGpu.addText(`${domain.name} — ${t('export.aiGpu')}`, {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 24, bold: true, color: PPTX_WHITE,
      })
      const gpuRows: TableRow[] = [
        [hdrCell(t('export.parameter')), hdrCell(t('export.value'))],
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
      const nvmeData = buildNvmeTieringSlideData(domain, t)
      const sNvme = pres.addSlide({ masterName: MASTER_NAME })
      sNvme.addText(`${domain.name} — ${t('export.nvmeTiering')}`, {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 24, bold: true, color: PPTX_WHITE,
      })
      const nvmeRows: TableRow[] = [
        [hdrCell(t('export.parameter')), hdrCell(t('export.value'))],
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
      const stretchData = buildStretchTopologySlideData(domain, result.stretch!, t)
      const sStretch = pres.addSlide({ masterName: MASTER_NAME })
      sStretch.addText(`${domain.name} — ${t('export.stretchTopology')}`, {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 24, bold: true, color: PPTX_WHITE,
      })
      const topoRows: TableRow[] = [
        [hdrCell(t('export.parameter')), hdrCell(t('export.value'))],
        ...stretchData.topology.map((r): TableRow => [cell(r.label), cell(r.value)]),
      ]
      sStretch.addTable(topoRows, {
        x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.35,
        fontSize: 11, color: 'F0F0F0',
        border: { type: 'solid', pt: 1, color: '444444' },
      })
      sStretch.addText(t('export.networkChecklist'), {
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
      const vmaxData = buildVsanMaxSlideData(domain, result.vsanMax, t)
      const sVmax = pres.addSlide({ masterName: MASTER_NAME })
      sVmax.addText(`${domain.name} — ${t('export.vsanMaxCluster')}`, {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 24, bold: true, color: PPTX_WHITE,
      })
      const vmaxRows: TableRow[] = [
        [hdrCell(t('export.parameter')), hdrCell(t('export.value'))],
        ...vmaxData.map((r): TableRow => [cell(r.label), cell(r.value)]),
      ]
      sVmax.addTable(vmaxRows, {
        x: 0.5, y: 1.3, w: 12, colW: [6, 6], rowH: 0.45,
        fontSize: 13, color: 'F0F0F0',
        border: { type: 'solid', pt: 1, color: '444444' },
      })
    }
    // Domain: Conditional Slide — Charts (EXPORT-01)
    const domainCharts = uiStore.chartImages[domain.id]
    const chartTypes: Array<{ key: 'cores' | 'ram' | 'storage'; labelKey: string }> = [
      { key: 'cores', labelKey: 'export.cpuUtilization' },
      { key: 'ram', labelKey: 'export.ramUtilization' },
      { key: 'storage', labelKey: 'export.storageSizing' },
    ]
    const availableCharts = chartTypes.filter(ct => domainCharts?.[ct.key])

    if (availableCharts.length > 0) {
      const sCharts = pres.addSlide({ masterName: MASTER_NAME })
      sCharts.addText(`${domain.name} — ${t('export.charts')}`, {
        x: 0.5, y: 0.3, w: 12, h: 0.8,
        fontSize: 24, bold: true, color: PPTX_WHITE,
      })

      // Layout: up to 3 charts side by side on LAYOUT_WIDE (13.33 x 7.5)
      const positions = [
        { x: 0.3, y: 1.5, w: 4.0, h: 3.0 },
        { x: 4.5, y: 1.5, w: 4.0, h: 3.0 },
        { x: 8.7, y: 1.5, w: 4.0, h: 3.0 },
      ]

      availableCharts.forEach((ct, idx) => {
        const pos = positions[idx]
        sCharts.addImage({
          data: domainCharts![ct.key],  // full data:image/png;base64,... (PITFALL-7)
          x: pos.x, y: pos.y, w: pos.w, h: pos.h,
          altText: `${domain.name} ${ct.key} chart`,
        })
      })
    }
  } // end per-domain loop

  // ── After domain loop: Aggregate Totals slide ────────────────────────────────
  const aggData = buildAggregateSlideData(calc.aggregateTotals, store.managementArchitecture, calc.dedicatedMgmtHostCount, store.managementDomain.storageType ?? 'vsan-esa', t)
  const sAgg = pres.addSlide({ masterName: MASTER_NAME })
  sAgg.addText(t('export.aggregateTotals'), {
    x: 0.5, y: 0.3, w: 12, h: 0.8,
    fontSize: 24, bold: true, color: PPTX_WHITE,
  })
  const aggRows: TableRow[] = [
    [hdrCell(t('export.metric')), hdrCell(t('export.value'))],
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
    sWarn.addText(t('export.validationWarnings'), {
      x: 0.5, y: 0.3, w: 12, h: 0.8,
      fontSize: 24, bold: true, color: PPTX_WHITE,
    })
    const warnRows: TableRow[] = [
      [hdrCell(t('export.severity')), hdrCell(t('export.message'))],
      ...warningsData.map((w): TableRow => [
        cell(`[${w.severity.toUpperCase()}]`),
        cell(t(w.messageKey)),
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
