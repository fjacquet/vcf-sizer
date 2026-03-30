// Markdown export composable — generates complete VCF sizing report as Markdown string
// Extracted from useUrlState.ts (MD-01); enriched with all sections (MD-02..09)
// This is a plain TypeScript module — NO Vue lifecycle hooks (CALC-01/CALC-02 compliant)
// Phase 13: Updated to use first-domain bridge (workloadDomains[0] / domainResults[0])
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

/**
 * generateMarkdownReport — called on Markdown export click.
 * Pure string template, no library. Snapshot of current computed values.
 * Returns a string only — all download/Blob logic stays in ExportToolbar.vue (Pitfall 5).
 * Phase 13 bridge: reads workloadDomains[0] and domainResults[0] for single-domain compat.
 * Full multi-domain Markdown export is Phase 14.
 */
export function generateMarkdownReport(): string {
  const calc = useCalculationStore()
  const store = useInputStore()
  const now = new Date().toISOString().split('T')[0]

  // Phase 13 first-domain bridge — full multi-domain export is Phase 14
  const domain = store.workloadDomains[0]
  const result = calc.domainResults[0]

  const sections: string[] = [
    `# VCF 9.x Sizing Report`,
    ``,
    `**Generated:** ${now}  `,
    `**Deployment Model:** ${domain.deploymentMode}`,
    ``,
    `## Host Configuration`,
    ``,
    `| Parameter | Value |`,
    `|-----------|-------|`,
    `| Hosts | ${domain.hostCount} |`,
    `| Cores per socket | ${domain.coresPerSocket} |`,
    `| Sockets per host | ${domain.socketsPerHost} |`,
    `| RAM per host | ${domain.hostRamGB} GB |`,
    `| Storage per host | ${domain.hostStorageTB} TB |`,
  ]

  // MD-02: Workload Profile (always present)
  sections.push(
    ``,
    `## Workload Profile`,
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

  // MD-03: Management Architecture (always present; dedicated host count row conditional)
  sections.push(
    ``,
    `## Management Architecture`,
    ``,
    `| Parameter | Value |`,
    `|-----------|-------|`,
    `| Architecture | ${store.managementArchitecture} |`,
  )
  if (calc.dedicatedMgmtHostCount !== null) {
    sections.push(`| Dedicated host count | ${calc.dedicatedMgmtHostCount} |`)
  }

  // MD-04: NVMe Memory Tiering (conditional: nvmeTieringEnabled)
  if (domain.nvmeTieringEnabled) {
    sections.push(
      ``,
      `## NVMe Memory Tiering`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| Status | Enabled |`,
      `| Active memory percentage | ${domain.activeMemoryPct}% |`,
    )
  }

  // MD-05: AI/GPU Workloads (conditional: gpuVmCount > 0)
  if (domain.gpuVmCount > 0) {
    sections.push(
      ``,
      `## AI/GPU Workloads`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| GPU VM count | ${domain.gpuVmCount} |`,
      `| vGPU memory per VM | ${domain.vgpuMemoryGB} GB |`,
    )
  }

  // Management Domain Overhead + Compute Sizing + Storage Sizing (always present — existing sections)
  sections.push(
    ``,
    `## Management Domain Overhead`,
    ``,
    `| Resource | Required |`,
    `|----------|---------|`,
    `| Total vCPU | ${calc.management.totalCores} |`,
    `| Total RAM | ${calc.management.totalRamGB} GB |`,
    ``,
    `## Compute Sizing`,
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
    ``,
    `## Storage Sizing`,
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

  // MD-09: Network Configuration (always present)
  sections.push(
    ``,
    `## Network Configuration`,
    ``,
    `| Parameter | Value |`,
    `|-----------|-------|`,
    `| Network speed | ${domain.networkSpeedGbE} GbE |`,
    `| Dedup enabled | ${domain.dedupEnabled ? 'Yes' : 'No'} |`,
    `| Dedup ratio | ${domain.dedupRatio}:1 |`,
  )

  // MD-06: Stretch Cluster Topology (conditional: deploymentMode === 'stretch')
  if (domain.deploymentMode === 'stretch') {
    const s = result.stretch
    sections.push(
      ``,
      `## Stretch Cluster Topology`,
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

  // MD-07: vSAN Max Cluster (conditional: storageType === 'vsan-max' AND vsanMax !== null)
  if (domain.storageType === 'vsan-max' && result.vsanMax !== null) {
    const v = result.vsanMax
    sections.push(
      ``,
      `## vSAN Max Cluster`,
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

  // MD-08: Validation Warnings (conditional: allValidationErrors.length > 0)
  // Note: messageKey is an i18n key (e.g. 'validation.hostCount.tooFew') — rendered as-is.
  // i18n resolution in composable context is out of scope (Pitfall 6).
  const allValidationErrors = calc.aggregateTotals.allValidationErrors
  if (allValidationErrors.length > 0) {
    sections.push(``, `## Validation Warnings`, ``)
    for (const w of allValidationErrors) {
      sections.push(`- **[${w.severity.toUpperCase()}]** ${w.messageKey}`)
    }
  }

  sections.push(``, `---`, `*Generated by VCF Sizer — https://github.com/fjacquet/vcf-sizer*`)
  return sections.join('\n')
}
