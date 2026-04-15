// Markdown export composable — generates complete VCF sizing report as Markdown string
// Extracted from useUrlState.ts (MD-01); enriched with all sections (MD-02..09)
// This is a plain TypeScript module — NO Vue lifecycle hooks (CALC-01/CALC-02 compliant)
// Phase 14: Full multi-domain loop — one named section per workload domain (EXP-01, EXP-02)
// Phase 22: All user-visible strings localized via i18n.global.t() (EXPORT-02)
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { i18n } from '@/i18n'

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
  const t = i18n.global.t
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
  )
  if (calc.dedicatedMgmtHostCount !== null) {
    sections.push(`| ${t('export.dedicatedHostCount')} | ${calc.dedicatedMgmtHostCount} |`)
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
      `| ${t('export.storagePerHost')} | ${domain.hostStorageTiB} TiB |`,
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
      `| ${t('export.minHostsCpu')} | ${result.compute.minHostsForCpu} |`,
      `| ${t('export.minHostsRam')} | ${result.compute.minHostsForRam} |`,
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
        `| ${t('export.externalPoolCapacity')} | ${result.storage.rawCapacityTiB.toFixed(2)} TiB |`,
      ] : [
        `| ${t('export.raidScheme')} | ${result.storage.raidScheme} |`,
        `| ${t('export.rawCapacity')} | ${result.storage.rawCapacityTiB.toFixed(2)} TiB |`,
        `| ${t('export.usableAfterRaid')} | ${result.storage.usableAfterRaidTiB.toFixed(2)} TiB |`,
        `| ${t('export.lfsOverhead')} | ${result.storage.lfsOverheadTiB.toFixed(2)} TiB |`,
        `| ${t('export.metadataOverhead')} | ${result.storage.metadataOverheadTiB.toFixed(2)} TiB |`,
        `| **${t('export.safeUsableCapacity')}** | **${result.storage.safeUsableCapacityTiB.toFixed(2)} TiB** |`,
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
        `| ${t('export.effectivePerSiteStorage')} | ${s!.effectivePerSiteStorageTiB.toFixed(2)} TiB |`,
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
        `| ${t('export.rawCapacity')} | ${v.rawCapacityTiB.toFixed(2)} TiB |`,
        `| ${t('export.usableCapacity')} | ${v.usableCapacityTiB.toFixed(2)} TiB |`,
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
    `| ${t('export.managementHosts')} | ${store.managementArchitecture === 'dedicated' && calc.dedicatedMgmtHostCount !== null ? String(calc.dedicatedMgmtHostCount) : t('export.colocatedWld1')} |`,
    `| ${t('export.totalVmCount')} | ${totals.totalVmCount} |`,
    `| ${t('export.totalRawStorage')} | ${totals.totalRawStorageTiB.toFixed(2)} TiB |`,
    `| ${t('export.totalEffectiveStorage')} | ${totals.totalEffectiveStorageTiB.toFixed(2)} TiB |`,
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
