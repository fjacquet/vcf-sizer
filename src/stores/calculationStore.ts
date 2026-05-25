// VCF 9.x Calculation Store — read-only computed results
// CRITICAL: All returned values are computed() — ZERO mutable state (CALC-02)
// This store reads from inputStore and calls pure engine functions.

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useInputStore } from './inputStore'
import { calcManagementFull } from '../engine/mgmt'
import { validateMgmtStretchParity } from '../engine/mgmt/validation'
import { calcWorkloadFull, DEFAULT_HOST_FAILURES_TO_TOLERATE } from '../engine/workload'
import type { WorkloadDomainResult, AggregateTotals } from '../engine/types'

export const useCalculationStore = defineStore('calculation', () => {
  // CRITICAL: call useInputStore() at TOP LEVEL — not inside computed() (Pinia pattern)
  const input = useInputStore()

  // Management domain — full pipeline (P3): consumes the full ManagementDomainConfig
  // and the workloadDomains array (for auto-derived per-WLD overhead).
  const management = computed(() =>
    calcManagementFull(input.managementDomain, input.workloadDomains)
  )

  // Dedicated management host count — SINGLE source of truth: calcManagementFull.totalHosts
  // (per-site demand with oversubscription + N-1 sizing + storage-type-aware floor, ×2 for
  // stretch). Previously a separate, divergent calc here double-counted the stretch floor and
  // ignored oversubscription; it now simply reads the engine result. null when colocated.
  const dedicatedMgmtHostCount = computed<number | null>(() =>
    input.managementArchitecture === 'dedicated' ? management.value.totalHosts : null
  )

  // Per-domain results — demand-driven: host/cluster counts and capacity are OUTPUTS
  // of calcWorkloadFull. CALC-02 compliant (computed() only).
  const domainResults = computed<WorkloadDomainResult[]>(() =>
    input.workloadDomains.map((domain, index) => {
      // ENGINE-01/02: colocated management overhead routes to WLD-1 (index 0) only,
      // added to that domain's PER-SITE demand. Dedicated → 0 (mgmt runs on its own hosts).
      const colocatedWld1 = input.managementArchitecture === 'colocated' && index === 0
      const mgmtCores = colocatedWld1 ? management.value.totalCores : 0
      const mgmtRamGB = colocatedWld1 ? management.value.totalRamGB : 0

      return calcWorkloadFull({
        id: domain.id,
        name: domain.name,
        deploymentMode: domain.deploymentMode,
        coresPerSocket: domain.coresPerSocket,
        socketsPerHost: domain.socketsPerHost,
        hostRamGB: domain.hostRamGB,
        hostStorageTiB: domain.hostStorageTiB,
        vmCount: domain.vmCount,
        avgVcpuPerVm: domain.avgVcpuPerVm,
        avgVramGbPerVm: domain.avgVramGbPerVm,
        avgStorageGbPerVm: domain.avgStorageGbPerVm,
        cpuOvercommitRatio: domain.cpuOvercommitRatio,
        ramOvercommitRatio: domain.ramOvercommitRatio,
        gpuVmCount: domain.gpuVmCount,
        vgpuMemoryGB: domain.vgpuMemoryGB,
        nvmeTieringEnabled: domain.nvmeTieringEnabled,
        activeMemoryPct: domain.activeMemoryPct,
        storageType: domain.storageType,
        fttLevel: domain.fttLevel,
        raidType: domain.raidType,
        dedupEnabled: domain.dedupEnabled,
        dedupRatio: domain.dedupRatio,
        externalStorageUsableTiB: domain.externalStorageUsableTiB,
        vsanMaxProfile: domain.vsanMaxProfile,
        vsanMaxStorageNodes: domain.vsanMaxStorageNodes,
        hostFailuresToTolerate: domain.hostFailuresToTolerate ?? DEFAULT_HOST_FAILURES_TO_TOLERATE,
        mgmtCores,
        mgmtRamGB,
      })
    })
  )

  // Aggregate totals — reduces domainResults; second computed, no mutable state.
  // totalRecommendedHosts = all workload hosts (every cluster, both sites) + management hosts.
  const aggregateTotals = computed<AggregateTotals>(() => {
    const results = domainResults.value
    const workloadHosts = results.reduce((sum, d) => sum + d.totalHosts, 0)
    const mgmtHosts = dedicatedMgmtHostCount.value ?? 0

    const anyStretch =
      input.managementDomain.deploymentMode === 'stretch'
      || input.workloadDomains.some(d => d.deploymentMode === 'stretch')

    let workloadPreferred: number | undefined
    let workloadSecondary: number | undefined
    let mgmtPreferred: number | undefined
    let mgmtSecondary: number | undefined

    if (anyStretch) {
      // Symmetric sites: each stretched domain contributes hostsPerSite to each site.
      workloadPreferred = results.reduce(
        (sum, d) => sum + (d.deploymentMode === 'stretch' ? d.hostsPerSite : 0), 0
      )
      workloadSecondary = workloadPreferred
      if (
        input.managementArchitecture === 'dedicated'
        && input.managementDomain.deploymentMode === 'stretch'
        && mgmtHosts > 0
      ) {
        const perSite = mgmtHosts / 2
        mgmtPreferred = perSite
        mgmtSecondary = perSite
      } else {
        mgmtPreferred = 0
        mgmtSecondary = 0
      }
    }

    return {
      totalRecommendedHosts: workloadHosts + mgmtHosts,
      mgmtHostCount: mgmtHosts,
      totalVmCount: input.workloadDomains.reduce((sum, d) => sum + d.vmCount, 0),
      totalClusterCount: results.reduce((sum, d) => sum + d.clusters.length, 0),
      totalRawStorageTiB: results.reduce((sum, d) => sum + d.storage.rawCapacityTiB, 0),
      totalEffectiveStorageTiB: results.reduce((sum, d) => sum + d.storage.effectiveCapacityTiB, 0),
      totalWorkloadStorageRequiredTiB: results.reduce((sum, d) => sum + d.storage.workloadStorageRequiredTiB, 0),
      totalRequiredPoolTiB: results.reduce((sum, d) => sum + d.storage.requiredPoolTiB, 0),
      totalPoolShortfallTiB: results.reduce((sum, d) => sum + d.storage.poolShortfallTiB, 0),
      allValidationErrors: [
        ...results.flatMap(d => d.validationErrors),
        ...validateMgmtStretchParity(input.workloadDomains, input.managementDomain),
      ],
      workloadPreferredSiteHosts: workloadPreferred,
      workloadSecondarySiteHosts: workloadSecondary,
      mgmtPreferredSiteHosts: mgmtPreferred,
      mgmtSecondarySiteHosts: mgmtSecondary,
      preferredSiteHosts: workloadPreferred !== undefined && mgmtPreferred !== undefined
        ? workloadPreferred + mgmtPreferred
        : undefined,
      secondarySiteHosts: workloadSecondary !== undefined && mgmtSecondary !== undefined
        ? workloadSecondary + mgmtSecondary
        : undefined,
    }
  })

  // ZERO mutable state — CALC-02 compliant
  return { management, domainResults, aggregateTotals, dedicatedMgmtHostCount }
})
