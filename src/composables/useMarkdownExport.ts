// Markdown export composable — generates complete VCF sizing report as Markdown string
// Extracted from useUrlState.ts (MD-01); enriched with all sections (MD-02..09)
// This is a plain TypeScript module — NO Vue lifecycle hooks (CALC-01/CALC-02 compliant)
// Phase 14: Full multi-domain loop — one named section per workload domain (EXP-01, EXP-02)
// Phase 22: All user-visible strings localized via i18n.global.t() (EXPORT-02)
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { useUiStore } from '@/stores/uiStore'
import { i18n } from '@/i18n'
import { formatStorage } from '@/utils/formatStorage'
import type { ApplianceLine } from '@/engine/mgmt/types'

// P6.1: Render an ApplianceLine[] as an 8-column markdown table with a totals footer.
// Mirrors the layout of MgmtSizingTable.vue (P4.5) for downloadable parity.
function renderApplianceTable(
  lines: readonly ApplianceLine[],
  t: (key: string) => string,
  categoryLabel: (line: ApplianceLine) => string,
): string[] {
  const rows: string[] = []
  rows.push(
    `| ${t('export.applianceComponent')} | ${t('export.applianceNodes')} | ${t('export.appliancePerNodeCores')} | ${t('export.appliancePerNodeRam')} | ${t('export.appliancePerNodeDisk')} | ${t('export.applianceTotalCores')} | ${t('export.applianceTotalRam')} | ${t('export.applianceTotalDisk')} |`,
    `|-----------|-------|------------|----------|-----------|-------------|------------|------------|`,
  )
  for (const line of lines) {
    rows.push(
      `| ${categoryLabel(line)} | ${line.nodeCount} | ${line.cores} | ${line.ramGB} | ${line.diskGB} | ${line.totalCores} | ${line.totalRamGB} | ${line.totalDiskGB} |`,
    )
  }
  // Footer: totals row
  const totalCores = lines.reduce((s, l) => s + l.totalCores, 0)
  const totalRam = lines.reduce((s, l) => s + l.totalRamGB, 0)
  const totalDisk = lines.reduce((s, l) => s + l.totalDiskGB, 0)
  rows.push(
    `| **${t('export.applianceTotals')}** |  |  |  |  | **${totalCores}** | **${totalRam}** | **${totalDisk}** |`,
  )
  return rows
}

// P6.1: Resolve appliance category to a localized label using vue-i18n's te() fallback chain.
// Same 3-namespace lookup as MgmtSizingTable.vue: dedicated → optionalAppliances → raw key.
function makeCategoryLabel(t: (key: string) => string, te: (key: string) => boolean) {
  return function categoryLabel(line: ApplianceLine): string {
    const dedicated = `mgmt.categories.${line.category}`
    if (te(dedicated)) return t(dedicated)
    const optional = `mgmt.optionalAppliances.categories.${line.category}`
    if (te(optional)) return t(optional)
    return String(line.category)
  }
}

/**
 * generateMarkdownReport — called on Markdown export click.
 * Pure string template, no library. Snapshot of current computed values.
 * Returns a string only — all download/Blob logic stays in ExportToolbar.vue (Pitfall 5).
 * Phase 14: Full multi-domain loop — Management sections appear exactly once outside loop.
 * Phase 22: All labels use i18n.global.t() for active locale (PITFALL-3).
 */
export function generateMarkdownReport(): string {
  const calc = useCalculationStore()
  const store = useInputStore()
  const ui = useUiStore()
  const t = i18n.global.t
  const fmtS = (v: number, p = 2) => formatStorage(v, ui.storageUnit, p)
  const now = new Date().toISOString().split('T')[0]

  const sections: string[] = [
    `# ${t('export.title')}`,
    ``,
    `**${t('export.generated')}:** ${now}  `,
    ``,
  ]

  // Global: Management Architecture section (outside per-domain loop — appears exactly once)
  sections.push(
    `## ${t('export.mgmtArchitecture')}`,
    ``,
    `| ${t('export.parameter')} | ${t('export.value')} |`,
    `|-----------|-------|`,
    `| ${t('export.architecture')} | ${store.managementArchitecture} |`,
    `| ${t('export.storageType')} | ${store.managementDomain.storageType ?? 'vsan-esa'} |`,
    // P5.5: deployment mode is now relevant for the mgmt section (auto-synced from WLDs)
    `| ${t('export.deploymentMode')} | ${store.managementDomain.deploymentMode} |`,
  )
  if (calc.dedicatedMgmtHostCount !== null) {
    // P5.5: in stretch mode, dedicatedMgmtHostCount is the procurement TOTAL across both
    // sites; show per-site breakdown inline. preferredSiteHosts/secondarySiteHosts on
    // calc.management equal recommendedHostCount each (per design Q answer).
    const isStretch = store.managementDomain.deploymentMode === 'stretch'
    const pref = calc.management.preferredSiteHosts
    const sec = calc.management.secondarySiteHosts
    if (isStretch && pref !== undefined && sec !== undefined) {
      sections.push(
        `| ${t('export.dedicatedHostCount')} | ${calc.dedicatedMgmtHostCount} |`,
        `| ${t('export.mgmtPreferredSite')} | ${pref} |`,
        `| ${t('export.mgmtSecondarySite')} | ${sec} |`,
      )
    } else {
      sections.push(`| ${t('export.dedicatedHostCount')} | ${calc.dedicatedMgmtHostCount} |`)
    }
  }

  // Global: Management Domain Overhead section (outside per-domain loop — appears exactly once)
  sections.push(
    ``,
    `## ${t('export.mgmtOverhead')}`,
    ``,
    `| ${t('export.resource')} | ${t('export.required')} |`,
    `|----------|---------|`,
    `| ${t('export.totalVcpu')} | ${calc.management.totalCores} |`,
    `| ${t('export.totalRam')} | ${calc.management.totalRamGB} GB |`,
  )

  // P6.1: Itemized management appliance table + WLD-overhead table.
  // Reuses i18n.global.te (same direct-API pattern as i18n.global.t above) so we don't
  // need to introduce a useI18n() call inside this plain TypeScript module.
  // NOTE: te must be bound to i18n.global; pulling it off as a bare reference loses `this`.
  const te = (key: string): boolean => i18n.global.te(key)
  const categoryLabel = makeCategoryLabel(t, te)

  if (calc.management.appliances.length > 0) {
    sections.push(
      ``,
      `## ${t('export.mgmtAppliances')}`,
      ``,
      ...renderApplianceTable(calc.management.appliances, t, categoryLabel),
    )
  }

  // P6.1: Workload-domain overhead table (auto-derived per-WLD vCenter + NSX Manager)
  if (calc.management.wldOverhead.length > 0) {
    sections.push(
      ``,
      `## ${t('export.wldOverheadAuto')}`,
      ``,
      ...renderApplianceTable(calc.management.wldOverhead, t, categoryLabel),
    )
  }

  // Per-domain loop — one ## Domain: {name} section per workload domain (EXP-01)
  for (const domain of store.workloadDomains) {
    const result = calc.domainResults.find(r => r.id === domain.id)!

    sections.push(
      ``,
      `## ${t('export.domain')}: ${domain.name}`,
      ``,
      `**${t('export.deploymentModel')}:** ${domain.deploymentMode}`,
    )

    // H3: Host Configuration
    sections.push(
      ``,
      `### ${t('export.hostConfig')}`,
      ``,
      `| ${t('export.parameter')} | ${t('export.value')} |`,
      `|-----------|-------|`,
      `| ${t('export.hosts')} | ${result.compute.effectiveHostCount} |`,
      ...(domain.deploymentMode === 'stretch' ? [
        `| ${t('export.preferredSiteHosts')} | ${domain.preferredSiteHosts} |`,
        `| ${t('export.secondarySiteHosts')} | ${domain.secondarySiteHosts} |`,
      ] : []),
      `| ${t('export.coresPerSocket')} | ${domain.coresPerSocket} |`,
      `| ${t('export.socketsPerHost')} | ${domain.socketsPerHost} |`,
      `| ${t('export.ramPerHost')} | ${domain.hostRamGB} GB |`,
      ...(domain.storageType !== 'fc' && domain.storageType !== 'nfs' ? [
        `| ${t('export.storagePerHost')} | ${fmtS(domain.hostStorageTiB)} |`,
      ] : []),
    )

    // H3: Workload Profile
    sections.push(
      ``,
      `### ${t('export.workloadProfile')}`,
      ``,
      `| ${t('export.parameter')} | ${t('export.value')} |`,
      `|-----------|-------|`,
      `| ${t('export.vmCount')} | ${domain.vmCount} |`,
      `| ${t('export.vcpuPerVm')} | ${domain.avgVcpuPerVm} |`,
      `| ${t('export.vramPerVm')} | ${domain.avgVramGbPerVm} GB |`,
      `| ${t('export.storagePerVm')} | ${domain.avgStorageGbPerVm} GB |`,
      `| ${t('export.cpuOvercommit')} | ${domain.cpuOvercommitRatio}:1 |`,
      `| ${t('export.ramOvercommit')} | ${domain.ramOvercommitRatio}:1 |`,
    )

    // H3: Compute Sizing
    sections.push(
      ``,
      `### ${t('export.computeSizing')}`,
      ``,
      `| ${t('export.metric')} | ${t('export.value')} |`,
      `|--------|-------|`,
      `| **${t('export.recommendedHostCount')}** | **${result.compute.recommendedHostCount}** |`,
      // P5.5: stretch — show per-site / total split next to the recommended host count
      ...(domain.deploymentMode === 'stretch' ? [
        `| ${t('export.recommendedPerSite')} | ${domain.preferredSiteHosts} + ${domain.secondarySiteHosts} = ${domain.preferredSiteHosts + domain.secondarySiteHosts} |`,
      ] : []),
      `| ${t('export.minHostsCpu')} | ${result.compute.minHostsForCpu} |`,
      `| ${t('export.minHostsRam')} | ${result.compute.minHostsForRam} |`,
      ...(result.compute.minHostsForStorage > 0 ? [
        `| ${t('export.minHostsStorage')} | ${result.compute.minHostsForStorage} |`,
      ] : []),
      `| ${t('export.totalVcpuRequired')} | ${result.compute.totalCoresRequired} |`,
      `| ${t('export.availableVcpu')} | ${result.compute.availableCores} |`,
      `| ${t('export.cpuUtilization')} | ${result.compute.coreUtilizationPct.toFixed(1)}% |`,
      `| ${t('export.totalRamRequired')} | ${result.compute.totalRamRequiredGB.toFixed(0)} GB |`,
      `| ${t('export.availableRamGb')} | ${result.compute.availableRamGB.toFixed(0)} GB |`,
      `| ${t('export.ramUtilization')} | ${result.compute.ramUtilizationPct.toFixed(1)}% |`,
    )

    // H3: Storage Sizing
    sections.push(
      ``,
      `### ${t('export.storageSizing')}`,
      ``,
      `| ${t('export.metric')} | ${t('export.value')} |`,
      `|--------|-------|`,
      `| ${t('export.storageType')} | ${domain.storageType} |`,
      ...(domain.storageType === 'fc' || domain.storageType === 'nfs' ? [
        ...(result.storage.workloadStorageRequiredTiB > 0 ? [
          `| ${t('export.workloadStorageRequired')} | ${fmtS(result.storage.workloadStorageRequiredTiB)} |`,
        ] : []),
        `| ${t('export.externalPoolCapacity')} | ${fmtS(result.storage.rawCapacityTiB)} |`,
      ] : [
        `| ${t('export.raidScheme')} | ${result.storage.raidScheme} |`,
        `| ${t('export.rawCapacity')} | ${fmtS(result.storage.rawCapacityTiB)} |`,
        `| ${t('export.usableAfterRaid')} | ${fmtS(result.storage.usableAfterRaidTiB)} |`,
        `| ${t('export.lfsOverhead')} | ${fmtS(result.storage.lfsOverheadTiB)} |`,
        `| ${t('export.metadataOverhead')} | ${fmtS(result.storage.metadataOverheadTiB)} |`,
        `| **${t('export.safeUsableCapacity')}** | **${fmtS(result.storage.safeUsableCapacityTiB)}** |`,
      ]),
    )

    // H3: Network Configuration (always present per domain)
    sections.push(
      ``,
      `### ${t('export.networkConfig')}`,
      ``,
      `| ${t('export.parameter')} | ${t('export.value')} |`,
      `|-----------|-------|`,
      `| ${t('export.networkSpeed')} | ${domain.networkSpeedGbE} GbE |`,
      `| ${t('export.dedupEnabled')} | ${domain.dedupEnabled ? t('export.yes') : t('export.no')} |`,
      `| ${t('export.dedupRatio')} | ${domain.dedupRatio}:1 |`,
    )

    // H3: NVMe Memory Tiering (conditional: nvmeTieringEnabled per domain)
    if (domain.nvmeTieringEnabled) {
      sections.push(
        ``,
        `### ${t('export.nvmeTiering')}`,
        ``,
        `| ${t('export.parameter')} | ${t('export.value')} |`,
        `|-----------|-------|`,
        `| ${t('export.status')} | ${t('export.enabled')} |`,
        `| ${t('export.activeMemoryPct')} | ${domain.activeMemoryPct}% |`,
      )
    }

    // H3: AI/GPU Workloads (conditional: gpuVmCount > 0 per domain)
    if (domain.gpuVmCount > 0) {
      sections.push(
        ``,
        `### ${t('export.aiGpu')}`,
        ``,
        `| ${t('export.parameter')} | ${t('export.value')} |`,
        `|-----------|-------|`,
        `| ${t('export.gpuVmCount')} | ${domain.gpuVmCount} |`,
        `| ${t('export.vgpuMemPerVm')} | ${domain.vgpuMemoryGB} GB |`,
      )
    }

    // H3: Stretch Cluster Topology (conditional: deploymentMode === 'stretch' per domain)
    if (domain.deploymentMode === 'stretch') {
      const s = result.stretch
      sections.push(
        ``,
        `### ${t('export.stretchTopology')}`,
        ``,
        `| ${t('export.parameter')} | ${t('export.value')} |`,
        `|-----------|-------|`,
        `| ${t('export.preferredSiteHosts')} | ${domain.preferredSiteHosts} |`,
        `| ${t('export.secondarySiteHosts')} | ${domain.secondarySiteHosts} |`,
        `| ${t('export.totalHosts')} | ${s!.totalHosts} |`,
        `| ${t('export.minInterSiteBw')} | ${s!.minBandwidthGbps} Gbps |`,
        `| ${t('export.witnessVcpu')} | ${s!.witnessCores} |`,
        `| ${t('export.witnessRam')} | ${s!.witnessRamGB} GB |`,
        `| ${t('export.effectivePerSiteStorage')} | ${fmtS(s!.effectivePerSiteStorageTiB)} |`,
        ``,
        `**${t('export.networkChecklist')}:**`,
        ``,
        `| ${t('export.parameter')} | ${t('export.value')} |`,
        `|-------------|-------|`,
        `| ${t('export.minInterSiteBandwidth')} | ${s!.networkChecklist.minInterSiteBandwidthGbps} Gbps |`,
        `| ${t('export.maxInterSiteLatency')} | ${s!.networkChecklist.maxInterSiteLatencyMs} ms |`,
        `| ${t('export.maxWitnessLatency')} | ${s!.networkChecklist.maxWitnessLatencyMs} ms |`,
        `| ${t('export.jumboFramesRequired')} | ${s!.networkChecklist.jumboFramesRequired ? t('export.yes') : t('export.no')} |`,
        `| ${t('export.minWitnessBandwidth')} | ${s!.networkChecklist.witnessMinBandwidthMbps} Mbps |`,
      )
    }

    // H3: vSAN Max Cluster (conditional: storageType === 'vsan-max' AND result.vsanMax !== null)
    if (domain.storageType === 'vsan-max' && result.vsanMax !== null) {
      const v = result.vsanMax
      sections.push(
        ``,
        `### ${t('export.vsanMaxCluster')}`,
        ``,
        `| ${t('export.parameter')} | ${t('export.value')} |`,
        `|-----------|-------|`,
        `| ${t('export.readyNodeProfile')} | ${domain.vsanMaxProfile.toUpperCase()} |`,
        `| ${t('export.storageNodeCount')} | ${v.storageNodeCount} |`,
        `| ${t('export.computeNodeCount')} | ${v.computeNodeCount} |`,
        `| ${t('export.raidScheme')} | ${v.raidScheme} |`,
        `| ${t('export.rawCapacity')} | ${fmtS(v.rawCapacityTiB)} |`,
        `| ${t('export.usableCapacity')} | ${fmtS(v.usableCapacityTiB)} |`,
      )
    }
  }

  // Aggregate Totals section (after per-domain loop — EXP-02)
  const totals = calc.aggregateTotals
  sections.push(
    ``,
    `## ${t('export.aggregateTotals')}`,
    ``,
    `| ${t('export.metric')} | ${t('export.value')} |`,
    `|--------|-------|`,
    `| ${t('export.totalRecommendedHosts')} | ${totals.totalRecommendedHosts} |`,
    // P5.5: per-site split (only when at least one stretched domain exists)
    ...(totals.preferredSiteHosts !== undefined && totals.secondarySiteHosts !== undefined ? [
      `| ${t('export.aggPreferredSiteHosts')} | ${totals.preferredSiteHosts} |`,
      `| ${t('export.aggSecondarySiteHosts')} | ${totals.secondarySiteHosts} |`,
    ] : []),
    `| ${t('export.managementHosts')} | ${store.managementArchitecture === 'dedicated' && calc.dedicatedMgmtHostCount !== null ? String(calc.dedicatedMgmtHostCount) : t('export.colocatedWld1')} |`,
    `| ${t('export.totalVmCount')} | ${totals.totalVmCount} |`,
    `| ${t('export.totalRawStorage')} | ${fmtS(totals.totalRawStorageTiB)} |`,
    `| ${t('export.totalEffectiveStorage')} | ${fmtS(totals.totalEffectiveStorageTiB)} |`,
    ...(totals.totalWorkloadStorageRequiredTiB > 0 ? [
      `| ${t('export.totalWorkloadStorageRequired')} | ${fmtS(totals.totalWorkloadStorageRequiredTiB)} |`,
    ] : []),
  )

  // Validation Warnings (conditional: allValidationErrors.length > 0)
  // Phase 22: messageKey resolved via t() for locale-aware export
  const allValidationErrors = totals.allValidationErrors
  if (allValidationErrors.length > 0) {
    sections.push(``, `## ${t('export.validationWarnings')}`, ``)
    for (const w of allValidationErrors) {
      sections.push(`- **[${w.severity.toUpperCase()}]** ${t(w.messageKey)}`)
    }
  }

  sections.push(``, `---`, `*${t('export.footer')} — https://github.com/fjacquet/vcf-sizer*`)
  return sections.join('\n')
}
