// Markdown export composable — generates complete VCF sizing report as Markdown string
// Extracted from useUrlState.ts (MD-01); enriched with all sections (MD-02..09)
// This is a plain TypeScript module — NO Vue lifecycle hooks (CALC-01/CALC-02 compliant)
// Phase 14: Full multi-domain loop — one named section per workload domain (EXP-01, EXP-02)
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

/**
 * generateMarkdownReport — called on Markdown export click.
 * Pure string template, no library. Snapshot of current computed values.
 * Returns a string only — all download/Blob logic stays in ExportToolbar.vue (Pitfall 5).
 * Phase 14: Full multi-domain loop — Management sections appear exactly once outside loop.
 */
export function generateMarkdownReport(): string {
  const calc = useCalculationStore()
  const store = useInputStore()
  const now = new Date().toISOString().split('T')[0]

  const sections: string[] = [
    `# VCF 9.x Sizing Report`,
    ``,
    `**Generated:** ${now}  `,
    ``,
  ]

  // Global: Management Architecture section (outside per-domain loop — appears exactly once)
  sections.push(
    `## Management Architecture`,
    ``,
    `| Parameter | Value |`,
    `|-----------|-------|`,
    `| Architecture | ${store.managementArchitecture} |`,
    `| Storage type | ${store.managementDomain.storageType ?? 'vsan-esa'} |`,
  )
  if (calc.dedicatedMgmtHostCount !== null) {
    sections.push(`| Dedicated host count | ${calc.dedicatedMgmtHostCount} |`)
  }

  // Global: Management Domain Overhead section (outside per-domain loop — appears exactly once)
  sections.push(
    ``,
    `## Management Domain Overhead`,
    ``,
    `| Resource | Required |`,
    `|----------|---------|`,
    `| Total vCPU | ${calc.management.totalCores} |`,
    `| Total RAM | ${calc.management.totalRamGB} GB |`,
  )

  // Per-domain loop — one ## Domain: {name} section per workload domain (EXP-01)
  for (const domain of store.workloadDomains) {
    const result = calc.domainResults.find(r => r.id === domain.id)!

    sections.push(
      ``,
      `## Domain: ${domain.name}`,
      ``,
      `**Deployment Model:** ${domain.deploymentMode}`,
    )

    // H3: Host Configuration
    sections.push(
      ``,
      `### Host Configuration`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| Hosts | ${domain.hostCount} |`,
      `| Cores per socket | ${domain.coresPerSocket} |`,
      `| Sockets per host | ${domain.socketsPerHost} |`,
      `| RAM per host | ${domain.hostRamGB} GB |`,
      `| Storage per host | ${domain.hostStorageTB} TB |`,
    )

    // H3: Workload Profile
    sections.push(
      ``,
      `### Workload Profile`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| VM count | ${domain.vmCount} |`,
      `| vCPU per VM | ${domain.avgVcpuPerVm} |`,
      `| vRAM per VM | ${domain.avgVramGbPerVm} GB |`,
      `| Storage per VM | ${domain.avgStorageGbPerVm} GB |`,
      `| CPU overcommit ratio | ${domain.cpuOvercommitRatio}:1 |`,
      `| RAM overcommit ratio | ${domain.ramOvercommitRatio}:1 |`,
    )

    // H3: Compute Sizing
    sections.push(
      ``,
      `### Compute Sizing`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| **Recommended Host Count** | **${result.compute.recommendedHostCount}** |`,
      `| Min hosts for CPU | ${result.compute.minHostsForCpu} |`,
      `| Min hosts for RAM | ${result.compute.minHostsForRam} |`,
      `| Total vCPU required | ${result.compute.totalCoresRequired} |`,
      `| Available vCPU | ${result.compute.availableCores} |`,
      `| CPU utilization | ${result.compute.coreUtilizationPct.toFixed(1)}% |`,
      `| Total RAM required | ${result.compute.totalRamRequiredGB.toFixed(0)} GB |`,
      `| Available RAM | ${result.compute.availableRamGB.toFixed(0)} GB |`,
      `| RAM utilization | ${result.compute.ramUtilizationPct.toFixed(1)}% |`,
    )

    // H3: Storage Sizing
    sections.push(
      ``,
      `### Storage Sizing`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Storage type | ${domain.storageType} |`,
      `| RAID scheme | ${result.storage.raidScheme} |`,
      `| Raw capacity | ${result.storage.rawCapacityTB.toFixed(2)} TB |`,
      `| Usable after RAID | ${result.storage.usableAfterRaidTB.toFixed(2)} TB |`,
      `| LFS overhead | ${result.storage.lfsOverheadTB.toFixed(2)} TB |`,
      `| Metadata overhead | ${result.storage.metadataOverheadTB.toFixed(2)} TB |`,
      `| **Safe usable capacity** | **${result.storage.safeUsableCapacityTB.toFixed(2)} TB** |`,
    )

    // H3: Network Configuration (always present per domain)
    sections.push(
      ``,
      `### Network Configuration`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| Network speed | ${domain.networkSpeedGbE} GbE |`,
      `| Dedup enabled | ${domain.dedupEnabled ? 'Yes' : 'No'} |`,
      `| Dedup ratio | ${domain.dedupRatio}:1 |`,
    )

    // H3: NVMe Memory Tiering (conditional: nvmeTieringEnabled per domain)
    if (domain.nvmeTieringEnabled) {
      sections.push(
        ``,
        `### NVMe Memory Tiering`,
        ``,
        `| Parameter | Value |`,
        `|-----------|-------|`,
        `| Status | Enabled |`,
        `| Active memory percentage | ${domain.activeMemoryPct}% |`,
      )
    }

    // H3: AI/GPU Workloads (conditional: gpuVmCount > 0 per domain)
    if (domain.gpuVmCount > 0) {
      sections.push(
        ``,
        `### AI/GPU Workloads`,
        ``,
        `| Parameter | Value |`,
        `|-----------|-------|`,
        `| GPU VM count | ${domain.gpuVmCount} |`,
        `| vGPU memory per VM | ${domain.vgpuMemoryGB} GB |`,
      )
    }

    // H3: Stretch Cluster Topology (conditional: deploymentMode === 'stretch' per domain)
    if (domain.deploymentMode === 'stretch') {
      const s = result.stretch
      sections.push(
        ``,
        `### Stretch Cluster Topology`,
        ``,
        `| Parameter | Value |`,
        `|-----------|-------|`,
        `| Preferred site hosts | ${domain.preferredSiteHosts} |`,
        `| Secondary site hosts | ${domain.secondarySiteHosts} |`,
        `| Total hosts | ${s!.totalHosts} |`,
        `| Min inter-site bandwidth | ${s!.minBandwidthGbps} Gbps |`,
        `| Witness vCPU | ${s!.witnessCores} |`,
        `| Witness RAM | ${s!.witnessRamGB} GB |`,
        `| Effective per-site storage | ${s!.effectivePerSiteStorageTB.toFixed(2)} TB |`,
        ``,
        `**Network Checklist:**`,
        ``,
        `| Requirement | Value |`,
        `|-------------|-------|`,
        `| Min inter-site bandwidth | ${s!.networkChecklist.minInterSiteBandwidthGbps} Gbps |`,
        `| Max inter-site latency | ${s!.networkChecklist.maxInterSiteLatencyMs} ms |`,
        `| Max witness latency | ${s!.networkChecklist.maxWitnessLatencyMs} ms |`,
        `| Jumbo frames required | ${s!.networkChecklist.jumboFramesRequired ? 'Yes' : 'No'} |`,
        `| Min witness bandwidth | ${s!.networkChecklist.witnessMinBandwidthMbps} Mbps |`,
      )
    }

    // H3: vSAN Max Cluster (conditional: storageType === 'vsan-max' AND result.vsanMax !== null)
    if (domain.storageType === 'vsan-max' && result.vsanMax !== null) {
      const v = result.vsanMax
      sections.push(
        ``,
        `### vSAN Max Cluster`,
        ``,
        `| Parameter | Value |`,
        `|-----------|-------|`,
        `| ReadyNode profile | ${domain.vsanMaxProfile.toUpperCase()} |`,
        `| Storage node count | ${v.storageNodeCount} |`,
        `| Compute node count | ${v.computeNodeCount} |`,
        `| RAID scheme | ${v.raidScheme} |`,
        `| Raw capacity | ${v.rawCapacityTB.toFixed(2)} TB |`,
        `| Usable capacity | ${v.usableCapacityTB.toFixed(2)} TB |`,
      )
    }
  }

  // Aggregate Totals section (after per-domain loop — EXP-02)
  const totals = calc.aggregateTotals
  sections.push(
    ``,
    `## Aggregate Totals`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total recommended hosts (all domains) | ${totals.totalRecommendedHosts} |`,
    `| Management hosts | ${store.managementArchitecture === 'dedicated' && calc.dedicatedMgmtHostCount !== null ? String(calc.dedicatedMgmtHostCount) : 'colocated with WLD-1'} |`,
    `| Total VM count | ${totals.totalVmCount} |`,
    `| Total raw storage | ${totals.totalRawStorageTB.toFixed(2)} TB |`,
    `| Total effective storage | ${totals.totalEffectiveStorageTB.toFixed(2)} TB |`,
  )

  // Validation Warnings (conditional: allValidationErrors.length > 0)
  // Note: messageKey is an i18n key (e.g. 'validation.hostCount.tooFew') — rendered as-is.
  // i18n resolution in composable context is out of scope (Pitfall 6).
  const allValidationErrors = totals.allValidationErrors
  if (allValidationErrors.length > 0) {
    sections.push(``, `## Validation Warnings`, ``)
    for (const w of allValidationErrors) {
      sections.push(`- **[${w.severity.toUpperCase()}]** ${w.messageKey}`)
    }
  }

  sections.push(``, `---`, `*Generated by VCF Sizer — https://github.com/fjacquet/vcf-sizer*`)
  return sections.join('\n')
}
