// Markdown export composable — generates complete VCF sizing report as Markdown string
// Extracted from useUrlState.ts (MD-01); enriched with all sections (MD-02..09)
// This is a plain TypeScript module — NO Vue lifecycle hooks (CALC-01/CALC-02 compliant)
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

/**
 * generateMarkdownReport — called on Markdown export click.
 * Pure string template, no library. Snapshot of current computed values.
 * Returns a string only — all download/Blob logic stays in ExportToolbar.vue (Pitfall 5).
 */
export function generateMarkdownReport(): string {
  const calc = useCalculationStore()
  const store = useInputStore()
  const now = new Date().toISOString().split('T')[0]

  const sections: string[] = [
    `# VCF 9.x Sizing Report`,
    ``,
    `**Generated:** ${now}  `,
    `**Deployment Model:** ${store.deploymentMode}`,
    ``,
    `## Host Configuration`,
    ``,
    `| Parameter | Value |`,
    `|-----------|-------|`,
    `| Hosts | ${store.hostCount} |`,
    `| Cores per socket | ${store.coresPerSocket} |`,
    `| Sockets per host | ${store.socketsPerHost} |`,
    `| RAM per host | ${store.hostRamGB} GB |`,
    `| Storage per host | ${store.hostStorageTB} TB |`,
  ]

  // MD-02: Workload Profile (always present)
  sections.push(
    ``,
    `## Workload Profile`,
    ``,
    `| Parameter | Value |`,
    `|-----------|-------|`,
    `| VM count | ${store.vmCount} |`,
    `| vCPU per VM | ${store.avgVcpuPerVm} |`,
    `| vRAM per VM | ${store.avgVramGbPerVm} GB |`,
    `| Storage per VM | ${store.avgStorageGbPerVm} GB |`,
    `| CPU overcommit ratio | ${store.cpuOvercommitRatio}:1 |`,
    `| RAM overcommit ratio | ${store.ramOvercommitRatio}:1 |`,
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
  if (store.nvmeTieringEnabled) {
    sections.push(
      ``,
      `## NVMe Memory Tiering`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| Status | Enabled |`,
      `| Active memory percentage | ${store.activeMemoryPct}% |`,
    )
  }

  // MD-05: AI/GPU Workloads (conditional: gpuVmCount > 0)
  if (store.gpuVmCount > 0) {
    sections.push(
      ``,
      `## AI/GPU Workloads`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| GPU VM count | ${store.gpuVmCount} |`,
      `| vGPU memory per VM | ${store.vgpuMemoryGB} GB |`,
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
    `| **Recommended Host Count** | **${calc.compute.recommendedHostCount}** |`,
    `| Min hosts for CPU | ${calc.compute.minHostsForCpu} |`,
    `| Min hosts for RAM | ${calc.compute.minHostsForRam} |`,
    `| Total vCPU required | ${calc.compute.totalCoresRequired} |`,
    `| Available vCPU | ${calc.compute.availableCores} |`,
    `| CPU utilization | ${calc.compute.coreUtilizationPct.toFixed(1)}% |`,
    `| Total RAM required | ${calc.compute.totalRamRequiredGB.toFixed(0)} GB |`,
    `| Available RAM | ${calc.compute.availableRamGB.toFixed(0)} GB |`,
    `| RAM utilization | ${calc.compute.ramUtilizationPct.toFixed(1)}% |`,
    ``,
    `## Storage Sizing`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Storage type | ${store.storageType} |`,
    `| RAID scheme | ${calc.storage.raidScheme} |`,
    `| Raw capacity | ${calc.storage.rawCapacityTB.toFixed(2)} TB |`,
    `| Usable after RAID | ${calc.storage.usableAfterRaidTB.toFixed(2)} TB |`,
    `| LFS overhead | ${calc.storage.lfsOverheadTB.toFixed(2)} TB |`,
    `| Metadata overhead | ${calc.storage.metadataOverheadTB.toFixed(2)} TB |`,
    `| **Safe usable capacity** | **${calc.storage.safeUsableCapacityTB.toFixed(2)} TB** |`,
  )

  // MD-09: Network Configuration (always present)
  sections.push(
    ``,
    `## Network Configuration`,
    ``,
    `| Parameter | Value |`,
    `|-----------|-------|`,
    `| Network speed | ${store.networkSpeedGbE} GbE |`,
    `| Dedup enabled | ${store.dedupEnabled ? 'Yes' : 'No'} |`,
    `| Dedup ratio | ${store.dedupRatio}:1 |`,
  )

  // MD-06: Stretch Cluster Topology (conditional: deploymentMode === 'stretch')
  if (store.deploymentMode === 'stretch') {
    const s = calc.stretch
    sections.push(
      ``,
      `## Stretch Cluster Topology`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| Preferred site hosts | ${store.preferredSiteHosts} |`,
      `| Secondary site hosts | ${store.secondarySiteHosts} |`,
      `| Total hosts | ${s.totalHosts} |`,
      `| Min inter-site bandwidth | ${s.minBandwidthGbps} Gbps |`,
      `| Witness vCPU | ${s.witnessCores} |`,
      `| Witness RAM | ${s.witnessRamGB} GB |`,
      `| Effective per-site storage | ${s.effectivePerSiteStorageTB.toFixed(2)} TB |`,
      ``,
      `**Network Checklist:**`,
      ``,
      `| Requirement | Value |`,
      `|-------------|-------|`,
      `| Min inter-site bandwidth | ${s.networkChecklist.minInterSiteBandwidthGbps} Gbps |`,
      `| Max inter-site latency | ${s.networkChecklist.maxInterSiteLatencyMs} ms |`,
      `| Max witness latency | ${s.networkChecklist.maxWitnessLatencyMs} ms |`,
      `| Jumbo frames required | ${s.networkChecklist.jumboFramesRequired ? 'Yes' : 'No'} |`,
      `| Min witness bandwidth | ${s.networkChecklist.witnessMinBandwidthMbps} Mbps |`,
    )
  }

  // MD-07: vSAN Max Cluster (conditional: storageType === 'vsan-max' AND vsanMax !== null)
  if (store.storageType === 'vsan-max' && calc.vsanMax !== null) {
    const v = calc.vsanMax
    sections.push(
      ``,
      `## vSAN Max Cluster`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| ReadyNode profile | ${store.vsanMaxProfile.toUpperCase()} |`,
      `| Storage node count | ${v.storageNodeCount} |`,
      `| Compute node count | ${v.computeNodeCount} |`,
      `| RAID scheme | ${v.raidScheme} |`,
      `| Raw capacity | ${v.rawCapacityTB.toFixed(2)} TB |`,
      `| Usable capacity | ${v.usableCapacityTB.toFixed(2)} TB |`,
    )
  }

  // MD-08: Validation Warnings (conditional: validationErrors.length > 0)
  // Note: messageKey is an i18n key (e.g. 'validation.hostCount.tooFew') — rendered as-is.
  // i18n resolution in composable context is out of scope for Phase 6 (Pitfall 6).
  if (calc.validationErrors.length > 0) {
    sections.push(``, `## Validation Warnings`, ``)
    for (const w of calc.validationErrors) {
      sections.push(`- **[${w.severity.toUpperCase()}]** ${w.messageKey}`)
    }
  }

  sections.push(``, `---`, `*Generated by VCF Sizer — https://github.com/fjacquet/vcf-sizer*`)
  return sections.join('\n')
}
