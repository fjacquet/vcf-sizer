// PPTX export composable — generates VCF sizing report as .pptx browser download
// Visual redesign: modern light theme with VMware teal accent, hero KPIs, native doughnut charts
// Plain TypeScript — NO Vue lifecycle hooks (CALC-01/CALC-02 compliant)
// pptxgenjs is loaded via dynamic import() to keep it out of the main bundle (PPTX-15)
// All user-visible strings localized via i18n.global.t() (EXPORT-02)

import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { useUiStore } from '@/stores/uiStore'
import { i18n } from '@/i18n'
import { formatStorage } from '@/utils/formatStorage'
import type { StorageUnit } from '@/utils/formatStorage'
import type {
  MgmtDomainResult,
  WorkloadDomainResult,
  WorkloadCapacityResult,
  StretchResult,
  VsanMaxResult,
  WorkloadDomainConfig,
  AggregateTotals,
} from '@/engine/types'
import type { ApplianceLine } from '@/engine/mgmt/types'
import { rollupApplianceTotals } from '@/engine/mgmt'
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
    fontFace?: string
  }
}
type TableRow = TableCell[]

// ─── Color palette ────────────────────────────────────────────────────────────
// Modern light theme — VMware teal accent, dark blue primary
// All hex values WITHOUT # prefix — pptxgenjs uses bare 6-digit hex (Pitfall 1)

const PALETTE = {
  slideBg: 'F5F7FA',
  primary: '1A3B6E',
  accent: '00B0CA',
  cardBg: 'FFFFFF',
  altRowBg: 'EEF4FB',
  textDark: '1A1A2E',
  textMuted: '6B7280',
  footerBg: '1A3B6E',
  footerText: 'B0C4DE',
  headerBg: '00B0CA',
  headerText: 'FFFFFF',
  warnBg: 'FEF3C7',
  warnText: '92400E',
  border: 'E5E7EB',
  chartFree: 'E5E7EB',
} as const

// ─── Exported color constants ──────────────────────────────────────────────────

export const PPTX_MASTER_COLOR = PALETTE.primary
export const PPTX_FOOTER_COLOR = PALETTE.footerBg
export const PPTX_WHITE = 'FFFFFF'
export const PPTX_LIGHT_TEXT = PALETTE.footerText
export const PPTX_HEADER_BG = PALETTE.headerBg
export const MASTER_NAME = 'VCF_MODERN'

const FONT = 'Arial'

// P6.4 (CR-4): Maximum data rows that fit on a single appliance-table slide.
// Conservative: with rowH=0.32 and the LAYOUT_WIDE working area (~5.4in vertical
// after frame + footer), ~14 rows is the safe ceiling before the totals footer
// would clip off-slide. When lines.length > MAX_ROWS_PER_SLIDE, the section is
// paginated across multiple slides — header repeated each slide, totals footer
// rendered ONLY on the final slide.
const MAX_ROWS_PER_SLIDE = 14

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** Create a header cell with teal background */
function hdrCell(text: string): TableCell {
  return {
    text,
    options: { bold: true, fill: { color: PALETTE.headerBg }, color: PALETTE.headerText, fontFace: FONT, fontSize: 11 },
  }
}

// Note: individual data cells are built inline by modernTable() and warning row builders

// P6.3: Resolve appliance category to a localized label using vue-i18n's te() fallback chain.
// Copied locally from useMarkdownExport.ts (same 3-namespace lookup as MgmtSizingTable.vue):
// dedicated → optionalAppliances → raw key.
function makeCategoryLabel(t: (key: string) => string, te: (key: string) => boolean) {
  return function categoryLabel(line: ApplianceLine): string {
    const dedicated = `mgmt.categories.${line.category}`
    if (te(dedicated)) return t(dedicated)
    const optional = `mgmt.optionalAppliances.categories.${line.category}`
    if (te(optional)) return t(optional)
    return String(line.category)
  }
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
 * buildConfigSummaryData — returns label/value rows for config summary slide (PPTX-04)
 * Demand-driven: host/cluster counts come from the WorkloadDomainResult (OUTPUTS),
 * not the config. Stretch shows hostsPerSite × 2 = totalHosts.
 */
export function buildConfigSummaryData(
  domain: WorkloadDomainConfig,
  managementArchitecture: string,
  result: WorkloadDomainResult,
  t: (key: string) => string = (k) => k,
  unit: StorageUnit = 'TiB',
): Array<{ label: string; value: string }> {
  const fmtS = (v: number, p = 2) => formatStorage(v, unit, p)
  const isStretch = result.stretch !== null
  return [
    { label: t('export.provisionedHosts'), value: String(result.totalHosts) },
    { label: t('export.demandHostsPerSite'), value: String(result.demandHostsPerSite) },
    { label: t('export.hostsPerSite'), value: String(result.hostsPerSite) },
    ...(isStretch ? [
      { label: t('export.totalHosts'), value: `${result.hostsPerSite} × 2 = ${result.totalHosts}` },
    ] : []),
    { label: t('export.clusterCountPerSite'), value: String(result.clusterCountPerSite) },
    { label: t('export.coresPerSocket'), value: String(domain.coresPerSocket) },
    { label: t('export.socketsPerHost'), value: String(domain.socketsPerHost) },
    { label: t('export.ramPerHost'), value: `${domain.hostRamGB} GB` },
    ...(domain.storageType !== 'fc' && domain.storageType !== 'nfs' ? [
      { label: t('export.storagePerHost'), value: fmtS(domain.hostStorageTiB) },
    ] : []),
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
  // Rollup rows derived directly from the canonical `appliances` array.
  const vcenter = rollupApplianceTotals(mgmt.appliances, ['vcenter'])
  const sddc = rollupApplianceTotals(mgmt.appliances, ['sddcManager'])
  const nsx = rollupApplianceTotals(mgmt.appliances, ['nsxManager'])
  const ops = rollupApplianceTotals(mgmt.appliances, ['vrops', 'vropsCollector', 'fleetManager'])
  const automation = rollupApplianceTotals(mgmt.appliances, ['automation'])
  return [
    { label: t('export.vcenter'), cores: vcenter.cores, ramGB: vcenter.ramGB },
    { label: t('export.sddcManager'), cores: sddc.cores, ramGB: sddc.ramGB },
    { label: t('export.nsx'), cores: nsx.cores, ramGB: nsx.ramGB },
    { label: t('export.ariaOps'), cores: ops.cores, ramGB: ops.ramGB },
    { label: t('export.automation'), cores: automation.cores, ramGB: automation.ramGB },
    { label: t('export.total'), cores: mgmt.totalCores, ramGB: mgmt.totalRamGB },
  ]
}

/**
 * buildComputeResultsData — returns key compute metrics for compute results slide (PPTX-07)
 * Demand-driven: reads flat WorkloadDomainResult fields. provisionedHostCount is the
 * grand total at the provisioned size; provisionedCores/RamGB are physical capacity.
 */
export function buildComputeResultsData(result: WorkloadDomainResult): {
  provisionedHostCount: number
  demandHostsPerSite: number
  clusterCountPerSite: number
  coreUtilizationPct: number
  ramUtilizationPct: number
  provisionedCores: number
  provisionedRamGB: number
  minHostsForCpu: number
  minHostsForRam: number
  minHostsForStorage: number
} {
  return {
    provisionedHostCount: result.totalHosts,
    demandHostsPerSite: result.demandHostsPerSite,
    clusterCountPerSite: result.clusterCountPerSite,
    coreUtilizationPct: result.coreUtilizationPct,
    ramUtilizationPct: result.ramUtilizationPct,
    provisionedCores: result.provisionedCores,
    provisionedRamGB: result.provisionedRamGB,
    minHostsForCpu: result.minHostsForCpu,
    minHostsForRam: result.minHostsForRam,
    minHostsForStorage: result.minHostsForStorage,
  }
}

/**
 * buildStorageResultsData — returns key storage metrics for storage results slide (PPTX-08)
 * FC/NFS surface required pool vs available pool + shortfall; vSAN surfaces the overhead stack.
 */
export function buildStorageResultsData(storage: WorkloadCapacityResult): {
  rawCapacityTiB: number
  usableAfterRaidTiB: number
  lfsOverheadTiB: number
  metadataOverheadTiB: number
  safeUsableCapacityTiB: number
  raidScheme: string
  workloadStorageRequiredTiB: number
  requiredPoolTiB: number
  availablePoolTiB: number
  poolShortfallTiB: number
} {
  return {
    rawCapacityTiB: storage.rawCapacityTiB,
    usableAfterRaidTiB: storage.usableAfterRaidTiB,
    lfsOverheadTiB: storage.lfsOverheadTiB,
    metadataOverheadTiB: storage.metadataOverheadTiB,
    safeUsableCapacityTiB: storage.safeUsableCapacityTiB,
    raidScheme: storage.raidScheme,
    workloadStorageRequiredTiB: storage.workloadStorageRequiredTiB,
    requiredPoolTiB: storage.requiredPoolTiB,
    availablePoolTiB: storage.availablePoolTiB,
    poolShortfallTiB: storage.poolShortfallTiB,
  }
}

/**
 * buildAggregateSlideData — returns label/value rows for the aggregate totals slide (EXP-04, EXPORT-02)
 * Mirrors the app's "Total Procurement Summary" card (AggregateTotalsCard.vue):
 *   grand total → per-site split (stretch only) → workload hosts → management hosts →
 *   total clusters → total VMs → combined raw & effective storage → pool shortfall (only when > 0).
 * Management hosts row shows numeric count for dedicated architecture, or localized 'colocated with WLD-1'.
 */
export function buildAggregateSlideData(
  totals: AggregateTotals,
  managementArchitecture: string,
  dedicatedMgmtHostCount: number | null,
  managementStorageType?: string,
  t: (key: string) => string = (k) => k,
  unit: StorageUnit = 'TiB',
): Array<{ label: string; value: string }> {
  const fmtS = (v: number, p = 2) => formatStorage(v, unit, p)
  const mgmtLine = managementArchitecture === 'dedicated' && dedicatedMgmtHostCount !== null
    ? String(dedicatedMgmtHostCount)
    : t('export.colocatedWld1')
  // Workload-only host count = grand total − management hosts (matches AggregateTotalsCard)
  const workloadHostCount = totals.totalRecommendedHosts - totals.mgmtHostCount
  // Per-site split is defined only when at least one stretched domain exists.
  const isStretch = totals.preferredSiteHosts !== undefined && totals.secondarySiteHosts !== undefined

  const rows: Array<{ label: string; value: string }> = [
    { label: t('export.totalRecommendedHosts'), value: String(totals.totalRecommendedHosts) },
  ]
  if (isStretch) {
    rows.push(
      { label: t('export.aggPreferredSiteHosts'), value: String(totals.preferredSiteHosts) },
      { label: t('export.aggSecondarySiteHosts'), value: String(totals.secondarySiteHosts) },
    )
  }
  rows.push(
    { label: t('export.workloadHosts'), value: String(workloadHostCount) },
    { label: t('export.managementHosts'), value: mgmtLine },
    { label: t('export.totalClusterCount'), value: String(totals.totalClusterCount) },
  )
  if (managementStorageType !== undefined) {
    rows.push({ label: t('export.mgmtStorageType'), value: managementStorageType })
  }
  rows.push(
    { label: t('export.totalVmCount'), value: String(totals.totalVmCount) },
    { label: t('export.totalRawStorage'), value: fmtS(totals.totalRawStorageTiB) },
    { label: t('export.totalEffectiveStorage'), value: fmtS(totals.totalEffectiveStorageTiB) },
  )
  if (totals.totalWorkloadStorageRequiredTiB > 0) {
    rows.push({ label: t('export.totalWorkloadStorageRequired'), value: fmtS(totals.totalWorkloadStorageRequiredTiB) })
  }
  if (totals.totalPoolShortfallTiB > 0) {
    rows.push({ label: t('export.totalPoolShortfall'), value: fmtS(totals.totalPoolShortfallTiB) })
  }
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
 * Demand-driven: per-site host count is symmetric (result.hostsPerSite); total = ×2.
 * Accepts stretch: StretchResult + hostsPerSite directly to keep the function pure/testable.
 */
export function buildStretchTopologySlideData(
  hostsPerSite: number,
  stretch: StretchResult,
  t: (key: string) => string = (k) => k,
  unit: StorageUnit = 'TiB',
): { topology: Array<{ label: string; value: string }>; checklist: string[] } {
  const fmtS = (v: number, p = 2) => formatStorage(v, unit, p)
  // Witness rows apply only to vSAN ESA stretched clusters; FC/NFS (vMSC) has no vSAN witness.
  const topology = [
    { label: t('export.hostsPerSite'), value: String(hostsPerSite) },
    { label: t('export.totalHosts'), value: `${hostsPerSite} × 2 = ${stretch.totalHosts}` },
    { label: t('export.minInterSiteBw'), value: `${stretch.minBandwidthGbps} Gbps` },
    ...(stretch.requiresVsanWitness ? [
      { label: t('export.witnessVcpu'), value: String(stretch.witnessCores) },
      { label: t('export.witnessRam'), value: `${stretch.witnessRamGB} GB` },
    ] : []),
    { label: t('export.effectivePerSiteStorage'), value: fmtS(stretch.effectivePerSiteStorageTiB) },
  ]
  const nc = stretch.networkChecklist
  const checklist = [
    `${t('export.minInterSiteBandwidth')}: ${nc.minInterSiteBandwidthGbps} Gbps`,
    `${t('export.maxInterSiteLatency')}: ${nc.maxInterSiteLatencyMs} ms`,
    ...(stretch.requiresVsanWitness ? [`${t('export.maxWitnessLatency')}: ${nc.maxWitnessLatencyMs} ms`] : []),
    `${t('export.jumboFramesRequired')}: ${nc.jumboFramesRequired ? t('export.yes') : t('export.no')}`,
    ...(stretch.requiresVsanWitness ? [`${t('export.minWitnessBandwidth')}: ${nc.witnessMinBandwidthMbps} Mbps`] : []),
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
  t: (key: string) => string = (k) => k,
  unit: StorageUnit = 'TiB',
): Array<{ label: string; value: string }> {
  const fmtS = (v: number, p = 2) => formatStorage(v, unit, p)
  return [
    { label: t('export.readyNodeProfile'), value: domain.vsanMaxProfile.toUpperCase() },
    { label: t('export.storageNodeCount'), value: String(vsanMax.storageNodeCount) },
    { label: t('export.computeNodeCount'), value: String(vsanMax.computeNodeCount) },
    { label: t('export.raidScheme'), value: vsanMax.raidScheme },
    { label: t('export.rawCapacity'), value: fmtS(vsanMax.rawCapacityTiB) },
    { label: t('export.usableCapacity'), value: fmtS(vsanMax.usableCapacityTiB) },
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
 * Modern visual design: light background, teal accent, hero KPI cards, native doughnut charts.
 * pptxgenjs is dynamically imported to avoid including it in the main bundle (PPTX-15).
 * A fresh PptxGenJS instance is created per call — no state carryover (Pitfall 6).
 */
export async function generatePptxReport(): Promise<void> {
  const store = useInputStore()
  const calc = useCalculationStore()
  const uiStore = useUiStore()
  const t = i18n.global.t
  const unit = uiStore.storageUnit
  const fmtS = (v: number, p = 2) => formatStorage(v, unit, p)

  // Dynamic import — Vite code-splits this automatically (PPTX-15)
  const PptxGenJS = (await import('pptxgenjs')).default
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT }
  pres.author = 'VCF Sizer'
  pres.company = 'VMware by Broadcom'
  pres.title = t('export.title')

  // ── Visual helpers (closures — need pres for ShapeType/ChartType) ───────────

  /** Add standard slide frame: title + teal divider + optional section label */
  function addSlideFrame(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slide: any,
    title: string,
    sectionLabel?: string,
  ) {
    slide.addText(title, {
      x: 0.4, y: 0.25, w: 12, h: 0.7,
      fontSize: 22, bold: true, color: PALETTE.primary, fontFace: FONT,
    })
    slide.addShape(pres.ShapeType.line, {
      x: 0.4, y: 0.95, w: 2.5, h: 0,
      line: { color: PALETTE.accent, width: 3 },
    })
    if (sectionLabel) {
      slide.addText(sectionLabel, {
        x: 0.4, y: 1.05, w: 12, h: 0.35,
        fontSize: 10, color: PALETTE.textMuted, fontFace: FONT,
      })
    }
  }

  /** Render a hero KPI card: white rounded rect with teal left accent, large value, label */
  function addHeroKpi(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slide: any,
    x: number, y: number, w: number, h: number,
    label: string, value: string, unit?: string,
  ) {
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w, h,
      rectRadius: 0.1,
      fill: { color: PALETTE.cardBg },
      shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 270, opacity: 0.12 },
    })
    slide.addShape(pres.ShapeType.rect, {
      x, y: y + 0.12, w: 0.06, h: h - 0.24,
      fill: { color: PALETTE.accent },
    })
    const displayValue = unit ? `${value} ${unit}` : value
    slide.addText(displayValue, {
      x: x + 0.15, y: y + 0.05, w: w - 0.3, h: h * 0.55,
      fontSize: 28, bold: true, color: PALETTE.textDark, fontFace: FONT,
      align: 'center', valign: 'bottom',
    })
    slide.addText(label, {
      x: x + 0.15, y: y + h * 0.55 + 0.05, w: w - 0.3, h: h * 0.35,
      fontSize: 10, color: PALETTE.textMuted, fontFace: FONT,
      align: 'center', valign: 'top',
    })
  }

  /** Render a native doughnut chart with centered percentage overlay */
  function addDoughnutChart(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slide: any,
    x: number, y: number, w: number, h: number,
    pct: number, label: string,
  ) {
    const used = Math.min(Math.max(pct, 0), 100)
    slide.addChart(pres.ChartType.doughnut, [{
      name: label,
      labels: ['Used', 'Free'],
      values: [used, 100 - used],
    }], {
      x, y, w, h,
      holeSize: 70,
      showPercent: false,
      showValue: false,
      showTitle: false,
      showLegend: false,
      showSerName: false,
      chartColors: [PALETTE.accent, PALETTE.chartFree],
    })
    slide.addText(`${pct.toFixed(1)}%`, {
      x, y: y + h * 0.32, w, h: h * 0.36,
      fontSize: 20, bold: true, color: PALETTE.textDark, fontFace: FONT,
      align: 'center', valign: 'middle',
    })
    slide.addText(label, {
      x, y: y + h - 0.05, w, h: 0.35,
      fontSize: 10, color: PALETTE.textMuted, fontFace: FONT,
      align: 'center',
    })
  }

  /** Build a modern table with teal header row and alternating row fills */
  function modernTable(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slide: any,
    headers: string[],
    dataRows: string[][],
    colW: number[],
    opts?: { y?: number; lastRowBold?: boolean },
  ) {
    const startY = opts?.y ?? 1.5
    const lastBold = opts?.lastRowBold ?? false
    const rows: TableRow[] = [
      headers.map(h => hdrCell(h)),
      ...dataRows.map((row, idx): TableRow => {
        const bg = idx % 2 === 0 ? PALETTE.cardBg : PALETTE.altRowBg
        const isBold = lastBold && idx === dataRows.length - 1
        return row.map(text => ({
          text,
          options: {
            fill: { color: bg },
            color: PALETTE.textDark,
            bold: isBold,
            fontFace: FONT,
            fontSize: 11,
          },
        }))
      }),
    ]
    slide.addTable(rows, {
      x: 0.4, y: startY, w: 12.5, colW,
      rowH: 0.38,
      border: { type: 'solid', pt: 0.5, color: PALETTE.border },
    })
  }

  /**
   * P6.3: Render an 8-column appliance sizing table with header + data rows
   * and (optionally) a totals footer.
   *
   * P6.4 (CR-4): `opts.includeFooter` (default true) controls whether the
   * trailing totals row is rendered — used by the paginating wrapper to
   * suppress the footer on every chunk except the final one. `opts.totals`
   * lets the wrapper pass overall totals (across all chunks) to the final
   * footer; if omitted, the footer sums only the `lines` arg (current
   * single-slide behavior).
   */
  function addApplianceTable(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slide: any,
    lines: readonly ApplianceLine[],
    categoryLabel: (line: ApplianceLine) => string,
    opts?: {
      y?: number
      includeFooter?: boolean
      totals?: { cores: number; ramGB: number; diskGB: number }
    },
  ) {
    const startY = opts?.y ?? 1.5
    const includeFooter = opts?.includeFooter ?? true
    const totals = opts?.totals ?? {
      cores: lines.reduce((s, l) => s + l.totalCores, 0),
      ramGB: lines.reduce((s, l) => s + l.totalRamGB, 0),
      diskGB: lines.reduce((s, l) => s + l.totalDiskGB, 0),
    }

    const headers: string[] = [
      t('export.applianceComponent'),
      t('export.applianceNodes'),
      t('export.appliancePerNodeCores'),
      t('export.appliancePerNodeRam'),
      t('export.appliancePerNodeDisk'),
      t('export.applianceTotalCores'),
      t('export.applianceTotalRam'),
      t('export.applianceTotalDisk'),
    ]

    const dataCell = (text: string, bg: string, bold = false): TableCell => ({
      text,
      options: { fill: { color: bg }, color: PALETTE.textDark, bold, fontFace: FONT, fontSize: 10 },
    })

    const rows: TableRow[] = [
      headers.map(h => hdrCell(h)),
      ...lines.map((line, idx): TableRow => {
        const bg = idx % 2 === 0 ? PALETTE.cardBg : PALETTE.altRowBg
        return [
          dataCell(categoryLabel(line), bg),
          dataCell(String(line.nodeCount), bg),
          dataCell(String(line.cores), bg),
          dataCell(String(line.ramGB), bg),
          dataCell(String(line.diskGB), bg),
          dataCell(String(line.totalCores), bg),
          dataCell(String(line.totalRamGB), bg),
          dataCell(String(line.totalDiskGB), bg),
        ]
      }),
    ]

    if (includeFooter) {
      rows.push([
        dataCell(t('export.applianceTotals'), PALETTE.altRowBg, true),
        dataCell('', PALETTE.altRowBg, true),
        dataCell('', PALETTE.altRowBg, true),
        dataCell('', PALETTE.altRowBg, true),
        dataCell('', PALETTE.altRowBg, true),
        dataCell(String(totals.cores), PALETTE.altRowBg, true),
        dataCell(String(totals.ramGB), PALETTE.altRowBg, true),
        dataCell(String(totals.diskGB), PALETTE.altRowBg, true),
      ])
    }

    slide.addTable(rows, {
      x: 0.4, y: startY, w: 12.5,
      colW: [3.0, 1.1, 1.3, 1.4, 1.4, 1.4, 1.45, 1.45],
      rowH: 0.32,
      border: { type: 'solid', pt: 0.5, color: PALETTE.border },
    })
  }

  /**
   * P6.4 (CR-4): Paginated appliance section.
   *
   * Replaces the previous "one slide always" pattern at call sites. If the
   * appliance/wld-overhead list fits on one slide (lines.length <=
   * MAX_ROWS_PER_SLIDE), behavior is identical to the old code path —
   * exactly one slide with header + data + totals footer.
   *
   * If lines.length exceeds the limit, splits across N slides:
   *   - Header row repeats on every slide (built into addApplianceTable).
   *   - Continuation slide titles append " (cont.)".
   *   - The totals footer appears ONLY on the final slide and reflects
   *     the grand total across all chunks (not the per-chunk subtotal).
   */
  function addPaginatedApplianceSection(
    title: string,
    lines: readonly ApplianceLine[],
    categoryLabel: (line: ApplianceLine) => string,
    sectionTitle = 'Management',
  ) {
    if (lines.length === 0) return

    // Grand totals across all chunks — passed to the final slide's footer.
    const grandTotals = {
      cores: lines.reduce((s, l) => s + l.totalCores, 0),
      ramGB: lines.reduce((s, l) => s + l.totalRamGB, 0),
      diskGB: lines.reduce((s, l) => s + l.totalDiskGB, 0),
    }

    const chunks: ApplianceLine[][] = []
    for (let i = 0; i < lines.length; i += MAX_ROWS_PER_SLIDE) {
      chunks.push(lines.slice(i, i + MAX_ROWS_PER_SLIDE))
    }

    chunks.forEach((chunk, idx) => {
      const isLast = idx === chunks.length - 1
      const slide = pres.addSlide({ masterName: MASTER_NAME, sectionTitle })
      const slideTitle = idx === 0 ? title : `${title} ${t('export.continued')}`
      addSlideFrame(slide, slideTitle)
      addApplianceTable(slide, chunk, categoryLabel, {
        includeFooter: isLast,
        totals: isLast ? grandTotals : undefined,
      })
    })
  }

  // ── Slide master: light background with teal accent bar + brand footer ──────
  pres.defineSlideMaster({
    title: MASTER_NAME,
    background: { color: PALETTE.slideBg },
    objects: [
      { rect: { x: 0, y: 0, w: 0.12, h: '100%', fill: { color: PALETTE.accent } } },
      { rect: { x: 0, y: 6.9, w: '100%', h: 0.6, fill: { color: PALETTE.footerBg } } },
      {
        text: {
          text: t('export.slideMasterFooter'),
          options: { x: 0.3, y: 7.0, w: 9, h: 0.35, color: PALETTE.footerText, fontSize: 9, fontFace: FONT },
        },
      },
    ],
    slideNumber: { x: 12.5, y: 7.0, color: PALETTE.footerText, fontSize: 9 },
  })

  // ── Section: Cover ──────────────────────────────────────────────────────────
  pres.addSection({ title: 'Cover' })

  // ── Title slide (custom — no master, split layout) ──────────────────────────
  const titleData = buildTitleSlideData(store.workloadDomains.length)
  const s1 = pres.addSlide({ sectionTitle: 'Cover' })
  s1.background = { color: PALETTE.primary }
  // White right panel
  s1.addShape(pres.ShapeType.rect, {
    x: 5.8, y: 0, w: 7.53, h: 7.5,
    fill: { color: PALETTE.cardBg },
  })
  // Teal accent divider
  s1.addShape(pres.ShapeType.rect, {
    x: 5.8, y: 0, w: 0.06, h: 7.5,
    fill: { color: PALETTE.accent },
  })
  // Title on left panel
  s1.addText(t('export.title'), {
    x: 0.5, y: 1.8, w: 5.0, h: 1.5,
    fontSize: 32, bold: true, color: PPTX_WHITE, fontFace: FONT,
  })
  s1.addText(`${titleData.domainCount} ${t('export.domains')}`, {
    x: 0.5, y: 3.4, w: 5.0, h: 0.6,
    fontSize: 18, color: PALETTE.footerText, fontFace: FONT,
  })
  // Date + decorative accent on right panel
  s1.addShape(pres.ShapeType.line, {
    x: 6.3, y: 3.0, w: 3, h: 0,
    line: { color: PALETTE.accent, width: 3 },
  })
  s1.addText(`${t('export.generated')}: ${titleData.date}`, {
    x: 6.3, y: 3.2, w: 6, h: 0.5,
    fontSize: 14, color: PALETTE.textMuted, fontFace: FONT,
  })
  // Footer bar (title slide has its own)
  s1.addShape(pres.ShapeType.rect, {
    x: 0, y: 6.9, w: '100%', h: 0.6,
    fill: { color: PALETTE.footerBg },
  })
  s1.addText(t('export.slideMasterFooter'), {
    x: 0.3, y: 7.0, w: 9, h: 0.35,
    color: PALETTE.footerText, fontSize: 9, fontFace: FONT,
  })

  // ── Section: Management ─────────────────────────────────────────────────────
  // ALL management content lives here, in order: domain overhead summary, then
  // the itemized appliance + WLD-overhead paginated tables (P6.3). Previously the
  // appliance tables were emitted AFTER the aggregate totals — they now belong to
  // this section so management is never split across the deck.
  pres.addSection({ title: 'Management' })

  // ── Management Domain Overhead ──────────────────────────────────────────────
  const mgmtData = buildMgmtOverheadData(calc.management, t)
  const s2 = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: 'Management' })
  addSlideFrame(s2, t('export.mgmtOverhead'))
  modernTable(
    s2,
    [t('export.component'), t('export.vcpu'), t('export.ramGb')],
    mgmtData.map(r => [r.label, String(r.cores), String(r.ramGB)]),
    [5, 3.75, 3.75],
    { lastRowBold: true },
  )

  // ── P6.3: Management appliance + WLD overhead slides (MOVED UP into Management) ─
  // Mirrors the markdown export's itemized appliance tables (P6.1).
  // Reuses i18n.global.te (same direct-API pattern as i18n.global.t above) so we don't
  // need to introduce a useI18n() call inside this plain TypeScript module.
  // NOTE: te must be bound to i18n.global; pulling it off as a bare reference loses `this`.
  const te = (key: string): boolean => i18n.global.te(key)
  const categoryLabel = makeCategoryLabel(t, te)

  // P6.4 (CR-4): Both sections use the paginated wrapper. With small
  // appliance/wld-overhead lists, behavior is unchanged (single slide,
  // header + data + totals footer). Large lists (Large profile + multiple
  // validated solutions) are now split across multiple slides instead of
  // overflowing the single-slide layout.
  addPaginatedApplianceSection(
    t('export.mgmtAppliances'),
    calc.management.appliances,
    categoryLabel,
  )
  addPaginatedApplianceSection(
    t('export.wldOverheadAuto'),
    calc.management.wldOverhead,
    categoryLabel,
  )

  // ── Per-domain slide groups ──────────────────────────────────────────────────
  for (const domain of store.workloadDomains) {
    const result = calc.domainResults.find(r => r.id === domain.id)!
    pres.addSection({ title: domain.name })

    // Domain: Configuration Summary
    const configData = buildConfigSummaryData(domain, store.managementArchitecture, result, t, unit)
    const sCfg = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: domain.name })
    addSlideFrame(sCfg, `${t('export.domain')}: ${domain.name}`, t('export.hostConfig'))
    modernTable(
      sCfg,
      [t('export.parameter'), t('export.value')],
      configData.map(r => [r.label, r.value]),
      [6.25, 6.25],
    )

    // Domain: Workload Profile
    const workloadData = buildWorkloadSlideData(domain, t)
    const sWkld = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: domain.name })
    addSlideFrame(sWkld, `${domain.name} — ${t('export.workloadProfile')}`)
    modernTable(
      sWkld,
      [t('export.parameter'), t('export.value')],
      workloadData.map(r => [r.label, r.value]),
      [6.25, 6.25],
    )

    // Domain: Compute Results — hero KPIs + doughnut charts
    const computeData = buildComputeResultsData(result)
    const sComp = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: domain.name })
    addSlideFrame(sComp, `${domain.name} — ${t('export.computeSizing')}`)

    // Hero KPI cards across the top (3 or 4 depending on storage constraint)
    if (computeData.minHostsForStorage > 0) {
      addHeroKpi(sComp, 0.4, 1.4, 2.9, 1.3, t('export.provisionedHosts'), String(computeData.provisionedHostCount), 'hosts')
      addHeroKpi(sComp, 3.6, 1.4, 2.9, 1.3, t('export.minHostsCpu'), String(computeData.minHostsForCpu))
      addHeroKpi(sComp, 6.8, 1.4, 2.9, 1.3, t('export.minHostsRam'), String(computeData.minHostsForRam))
      addHeroKpi(sComp, 10.0, 1.4, 2.9, 1.3, t('export.minHostsStorage'), String(computeData.minHostsForStorage))
    } else {
      addHeroKpi(sComp, 0.4, 1.4, 3.9, 1.3, t('export.provisionedHosts'), String(computeData.provisionedHostCount), 'hosts')
      addHeroKpi(sComp, 4.7, 1.4, 3.9, 1.3, t('export.minHostsCpu'), String(computeData.minHostsForCpu))
      addHeroKpi(sComp, 9.0, 1.4, 3.9, 1.3, t('export.minHostsRam'), String(computeData.minHostsForRam))
    }

    // 2 native doughnut charts
    addDoughnutChart(sComp, 1.5, 3.1, 3.5, 3.2, computeData.coreUtilizationPct, t('export.cpuUtilization'))
    addDoughnutChart(sComp, 8.3, 3.1, 3.5, 3.2, computeData.ramUtilizationPct, t('export.ramUtilization'))

    // Compact detail column between doughnuts — physical cores/RAM provisioned
    sComp.addText([
      { text: `${t('export.availableVcpu')}: `, options: { fontSize: 10, color: PALETTE.textMuted } },
      { text: String(computeData.provisionedCores), options: { fontSize: 10, bold: true, color: PALETTE.textDark } },
      { text: '\n', options: { fontSize: 10, breakLine: true } },
      { text: `${t('export.availableRamGb')}: `, options: { fontSize: 10, color: PALETTE.textMuted } },
      { text: `${Math.round(computeData.provisionedRamGB)} GB`, options: { fontSize: 10, bold: true, color: PALETTE.textDark } },
    ], {
      x: 5.4, y: 3.8, w: 2.7, h: 1.5,
      fontFace: FONT, valign: 'middle', align: 'center',
    })

    // Domain: Storage Results
    const storageData = buildStorageResultsData(result.storage)
    const sStor = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: domain.name })
    addSlideFrame(sStor, `${domain.name} — ${t('export.storageSizing')}`)
    const isExternalStorage = domain.storageType === 'fc' || domain.storageType === 'nfs'
    const storDataRows = isExternalStorage
      ? [
          ...(storageData.workloadStorageRequiredTiB > 0 ? [
            [t('export.workloadStorageRequired'), fmtS(storageData.workloadStorageRequiredTiB)],
          ] : []),
          [t('export.requiredPool'), fmtS(storageData.requiredPoolTiB)],
          [t('export.availablePool'), fmtS(storageData.availablePoolTiB)],
          ...(storageData.poolShortfallTiB > 0 ? [
            [t('export.poolShortfall'), fmtS(storageData.poolShortfallTiB)],
          ] : []),
        ]
      : [
          [t('export.raidScheme'), storageData.raidScheme],
          [t('export.rawCapacity'), fmtS(storageData.rawCapacityTiB)],
          [t('export.usableAfterRaid'), fmtS(storageData.usableAfterRaidTiB)],
          [t('export.lfsOverhead'), fmtS(storageData.lfsOverheadTiB)],
          [t('export.metadataOverhead'), fmtS(storageData.metadataOverheadTiB)],
          [t('export.safeUsableCapacity'), fmtS(storageData.safeUsableCapacityTiB)],
        ]
    modernTable(sStor, [t('export.metric'), t('export.value')], storDataRows, [6.25, 6.25], {
      lastRowBold: !isExternalStorage,
    })

    // Domain: Conditional — AI/GPU Workloads (PPTX-10)
    if (domain.gpuVmCount > 0) {
      const gpuData = buildAiGpuSlideData(domain, t)
      const sGpu = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: domain.name })
      addSlideFrame(sGpu, `${domain.name} — ${t('export.aiGpu')}`)
      modernTable(
        sGpu,
        [t('export.parameter'), t('export.value')],
        gpuData.map(r => [r.label, r.value]),
        [6.25, 6.25],
      )
    }

    // Domain: Conditional — NVMe Memory Tiering (PPTX-11)
    if (domain.nvmeTieringEnabled) {
      const nvmeData = buildNvmeTieringSlideData(domain, t)
      const sNvme = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: domain.name })
      addSlideFrame(sNvme, `${domain.name} — ${t('export.nvmeTiering')}`)
      modernTable(
        sNvme,
        [t('export.parameter'), t('export.value')],
        nvmeData.map(r => [r.label, r.value]),
        [6.25, 6.25],
      )
    }

    // Domain: Conditional — Stretch Cluster Topology (PPTX-12)
    if (domain.deploymentMode === 'stretch') {
      const stretchData = buildStretchTopologySlideData(result.hostsPerSite, result.stretch!, t, unit)
      const sStretch = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: domain.name })
      addSlideFrame(sStretch, `${domain.name} — ${t('export.stretchTopology')}`)
      modernTable(
        sStretch,
        [t('export.parameter'), t('export.value')],
        stretchData.topology.map(r => [r.label, r.value]),
        [6.25, 6.25],
        { y: 1.4 },
      )
      sStretch.addText(t('export.networkChecklist'), {
        x: 0.4, y: 4.2, w: 12, h: 0.45,
        fontSize: 14, bold: true, color: PALETTE.primary, fontFace: FONT,
      })
      sStretch.addShape(pres.ShapeType.line, {
        x: 0.4, y: 4.65, w: 1.8, h: 0,
        line: { color: PALETTE.accent, width: 2 },
      })
      const checkText = stretchData.checklist.map(c => `  \u2022  ${c}`).join('\n')
      sStretch.addText(checkText, {
        x: 0.4, y: 4.8, w: 12, h: 1.8,
        fontSize: 11, color: PALETTE.textDark, fontFace: FONT, valign: 'top', lineSpacingMultiple: 1.4,
      })
    }

    // Domain: Conditional — vSAN Max Cluster (PPTX-13)
    if (domain.storageType === 'vsan-max' && result.vsanMax !== null) {
      const vmaxData = buildVsanMaxSlideData(domain, result.vsanMax, t, unit)
      const sVmax = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: domain.name })
      addSlideFrame(sVmax, `${domain.name} — ${t('export.vsanMaxCluster')}`)
      modernTable(
        sVmax,
        [t('export.parameter'), t('export.value')],
        vmaxData.map(r => [r.label, r.value]),
        [6.25, 6.25],
      )
    }

    // Domain: Conditional — Charts (EXPORT-01, PNG images from UI)
    const domainCharts = uiStore.chartImages[domain.id]
    const chartTypes: Array<{ key: 'cores' | 'ram' | 'storage'; labelKey: string }> = [
      { key: 'cores', labelKey: 'export.cpuUtilization' },
      { key: 'ram', labelKey: 'export.ramUtilization' },
      { key: 'storage', labelKey: 'export.storageSizing' },
    ]
    const availableCharts = chartTypes.filter(ct => domainCharts?.[ct.key])

    if (availableCharts.length > 0) {
      const sCharts = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: domain.name })
      addSlideFrame(sCharts, `${domain.name} — ${t('export.charts')}`)

      const positions = [
        { x: 0.4, y: 1.5, w: 3.9, h: 3.5 },
        { x: 4.6, y: 1.5, w: 3.9, h: 3.5 },
        { x: 8.8, y: 1.5, w: 3.9, h: 3.5 },
      ]
      availableCharts.forEach((ct, idx) => {
        const pos = positions[idx]
        // White card backdrop for chart image
        sCharts.addShape(pres.ShapeType.roundRect, {
          x: pos.x - 0.1, y: pos.y - 0.1, w: pos.w + 0.2, h: pos.h + 0.55,
          rectRadius: 0.08,
          fill: { color: PALETTE.cardBg },
          shadow: { type: 'outer', color: '000000', blur: 4, offset: 1, angle: 270, opacity: 0.08 },
        })
        sCharts.addImage({
          data: domainCharts![ct.key], // full data:image/png;base64,... (PITFALL-7)
          x: pos.x, y: pos.y, w: pos.w, h: pos.h,
          altText: `${domain.name} ${ct.key} chart`,
        })
        sCharts.addText(t(ct.labelKey), {
          x: pos.x, y: pos.y + pos.h + 0.05, w: pos.w, h: 0.3,
          fontSize: 10, color: PALETTE.textMuted, fontFace: FONT, align: 'center',
        })
      })
    }
  } // end per-domain loop

  // ── Section: Summary ────────────────────────────────────────────────────────
  // Order: Validation Warnings (if any) FIRST, then the Aggregate Totals slide is
  // the FINAL content slide of the deck (Tasks 3 & 4).
  pres.addSection({ title: 'Summary' })

  // ── Conditional: Validation Warnings (PPTX-14) ──────────────────────────────
  if (calc.aggregateTotals.allValidationErrors.length > 0) {
    const warningsData = buildValidationWarningsSlideData(calc)
    const sWarn = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: 'Summary' })
    addSlideFrame(sWarn, t('export.validationWarnings'))

    const warnRows: TableRow[] = [
      [hdrCell(t('export.severity')), hdrCell(t('export.message'))],
      ...warningsData.map((w, idx): TableRow => {
        const bg = idx % 2 === 0 ? PALETTE.warnBg : PALETTE.cardBg
        return [
          {
            text: `[${w.severity.toUpperCase()}]`,
            options: { fill: { color: bg }, color: PALETTE.warnText, bold: true, fontFace: FONT, fontSize: 11 },
          },
          {
            text: t(w.messageKey),
            options: { fill: { color: bg }, color: PALETTE.textDark, fontFace: FONT, fontSize: 11 },
          },
        ]
      }),
    ]
    sWarn.addTable(warnRows, {
      x: 0.4, y: 1.5, w: 12.5, colW: [2.5, 10],
      rowH: 0.4,
      border: { type: 'solid', pt: 0.5, color: PALETTE.border },
    })
  }

  // ── Aggregate Totals slide — hero KPIs + detail table — ALWAYS LAST ─────────
  const aggData = buildAggregateSlideData(calc.aggregateTotals, store.managementArchitecture, calc.dedicatedMgmtHostCount, store.managementDomain.storageType ?? 'vsan-esa', t, unit)
  const sAgg = pres.addSlide({ masterName: MASTER_NAME, sectionTitle: 'Summary' })
  addSlideFrame(sAgg, t('export.aggregateTotals'))

  // 3 hero KPI cards
  addHeroKpi(sAgg, 0.4, 1.4, 3.9, 1.3, t('export.totalRecommendedHosts'), String(calc.aggregateTotals.totalRecommendedHosts), 'hosts')
  addHeroKpi(sAgg, 4.7, 1.4, 3.9, 1.3, t('export.totalVmCount'), String(calc.aggregateTotals.totalVmCount), 'VMs')
  addHeroKpi(sAgg, 9.0, 1.4, 3.9, 1.3, t('export.totalEffectiveStorage'), fmtS(calc.aggregateTotals.totalEffectiveStorageTiB, 1))

  // Detail table below KPIs
  modernTable(
    sAgg,
    [t('export.metric'), t('export.value')],
    aggData.map(r => [r.label, r.value]),
    [6.25, 6.25],
    { y: 3.1 },
  )

  // Trigger browser download — MUST await (Pitfall 5)
  await pres.writeFile({ fileName: 'vcf-sizing-report.pptx' })
}
