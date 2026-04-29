// VCF 9.x Calculation Store — read-only computed results
// CRITICAL: All returned values are computed() — ZERO mutable state (CALC-02)
// This store reads from inputStore and calls pure engine functions.

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useInputStore } from './inputStore'
import { calcManagementFull } from '../engine/mgmt'
import { calcCompute } from '../engine/compute'
import { calcStorage, calcMinHostsForVsanEsa } from '../engine/storage'
import { calcVsanMax } from '../engine/vsanMax'
import { calcStretch } from '../engine/stretch'
import { validateInputs, DEDICATED_MGMT_MIN_HOSTS, STRETCH_DEDICATED_MGMT_MIN_HOSTS, DEDICATED_MGMT_MIN_HOSTS_EXTERNAL, STRETCH_DEDICATED_MGMT_MIN_HOSTS_EXTERNAL } from '../engine/validation'
import type { DomainResult, AggregateTotals } from '../engine/types'

export const useCalculationStore = defineStore('calculation', () => {
  // CRITICAL: call useInputStore() at TOP LEVEL — not inside computed() (Pinia pattern)
  const input = useInputStore()

  // Management domain — full pipeline (P3): consumes the full ManagementDomainConfig
  // and the workloadDomains array (for auto-derived per-WLD overhead).
  const management = computed(() =>
    calcManagementFull(input.managementDomain, input.workloadDomains)
  )

  // Dedicated management host count — uses managementDomain host specs (NOT workloadDomains[0])
  // (Pitfall 4: must be independent of workload domain specs)
  const dedicatedMgmtHostCount = computed<number | null>(() => {
    if (input.managementArchitecture !== 'dedicated') return null
    const coresPerHost = input.managementDomain.coresPerSocket * input.managementDomain.socketsPerHost
    const isExternal = input.managementDomain.storageType === 'fc'
      || input.managementDomain.storageType === 'nfs'
    const minHosts = input.managementDomain.deploymentMode === 'stretch'
      ? (isExternal ? STRETCH_DEDICATED_MGMT_MIN_HOSTS_EXTERNAL : STRETCH_DEDICATED_MGMT_MIN_HOSTS)
      : (isExternal ? DEDICATED_MGMT_MIN_HOSTS_EXTERNAL : DEDICATED_MGMT_MIN_HOSTS)
    return Math.max(minHosts, Math.ceil(management.value.totalCores / coresPerHost))
  })

  // Per-domain results — maps over array, returns new array each recompute
  // CALC-02 compliant: computed() is the only reactive primitive used here
  const domainResults = computed<DomainResult[]>(() =>
    input.workloadDomains.map((domain, index) => {
      // Pitfall 6: effectiveHostCount must be computed per-domain inside .map()
      const effectiveHostCount =
        domain.deploymentMode === 'stretch'
          ? domain.preferredSiteHosts + domain.secondarySiteHosts
          : domain.hostCount

      // ENGINE-01/02: management overhead routing
      // dedicated → 0 for all domains (management runs on its own hosts)
      // colocated → WLD-1 (index 0) absorbs overhead; all others receive 0
      const mgmtCoresForDomain = input.managementArchitecture === 'colocated' && index === 0
        ? management.value.totalCores
        : 0
      const mgmtRamForDomain = input.managementArchitecture === 'colocated' && index === 0
        ? management.value.totalRamGB
        : 0

      // Storage-driven host minimum: only applies to vSAN ESA (local storage)
      const workloadStorageTiB = domain.vmCount * domain.avgStorageGbPerVm / 1024
      const minHostsForStorage = domain.storageType === 'vsan-esa'
        ? calcMinHostsForVsanEsa(
            domain.hostStorageTiB,
            domain.fttLevel,
            domain.raidType,
            domain.dedupEnabled,
            domain.dedupRatio,
            domain.deploymentMode,
            workloadStorageTiB,
          )
        : 0

      return {
        id: domain.id,
        name: domain.name,
        compute: calcCompute({
          deploymentMode: domain.deploymentMode,
          coresPerSocket: domain.coresPerSocket,
          socketsPerHost: domain.socketsPerHost,
          hostRamGB: domain.hostRamGB,
          hostCount: effectiveHostCount,
          vmCount: domain.vmCount,
          avgVcpuPerVm: domain.avgVcpuPerVm,
          avgVramGbPerVm: domain.avgVramGbPerVm,
          cpuOvercommitRatio: domain.cpuOvercommitRatio,
          ramOvercommitRatio: domain.ramOvercommitRatio,
          managementCores: mgmtCoresForDomain,
          managementRamGB: mgmtRamForDomain,
          nvmeTieringEnabled: domain.nvmeTieringEnabled,
          activeMemoryPct: domain.activeMemoryPct,
          gpuVmCount: domain.gpuVmCount,
          vgpuMemoryGB: domain.vgpuMemoryGB,
          minHostsForStorage,
        }),
        storage: calcStorage({
          storageType: domain.storageType,
          hostCount: effectiveHostCount,
          hostStorageTiB: domain.hostStorageTiB,
          externalStorageUsableTiB: domain.externalStorageUsableTiB,
          fttLevel: domain.fttLevel,
          raidType: domain.raidType,
          dedupEnabled: domain.dedupEnabled,
          dedupRatio: domain.dedupRatio,
          deploymentMode: domain.deploymentMode,
          vmCount: domain.vmCount,
          avgStorageGbPerVm: domain.avgStorageGbPerVm,
        }),
        stretch: domain.deploymentMode === 'stretch'
          ? calcStretch({
              preferredSiteHosts: domain.preferredSiteHosts,
              secondarySiteHosts: domain.secondarySiteHosts,
              hostStorageTiB: domain.hostStorageTiB,
              vmCount: domain.vmCount,
              avgStorageGbPerVm: domain.avgStorageGbPerVm,
            })
          : null,
        vsanMax: domain.storageType === 'vsan-max'
          ? calcVsanMax({
              profile: domain.vsanMaxProfile,
              storageNodeCount: domain.vsanMaxStorageNodes,
              computeNodeCount: domain.hostCount,
            })
          : null,
        validationErrors: validateInputs({
          deploymentMode: domain.deploymentMode,
          coresPerSocket: domain.coresPerSocket,
          socketsPerHost: domain.socketsPerHost,
          hostCount: domain.hostCount,
          dedupEnabled: domain.dedupEnabled,
          storageType: domain.storageType,
          preferredSiteHosts: domain.preferredSiteHosts,
          secondarySiteHosts: domain.secondarySiteHosts,
          managementArchitecture: input.managementArchitecture,
          managementStorageType:
            input.managementDomain.storageType && input.managementDomain.storageType !== 'vsan-max'
              ? input.managementDomain.storageType
              : 'vsan-esa',
          networkSpeedGbE: domain.networkSpeedGbE,
          vsanMaxStorageNodes: domain.vsanMaxStorageNodes,
        }),
      }
    })
  )

  // Aggregate totals — reduces domainResults; second computed, no mutable state
  // ENGINE-03: totalRecommendedHosts = workload hosts + management hosts (grand procurement total)
  const aggregateTotals = computed<AggregateTotals>(() => {
    const workloadHosts = domainResults.value.reduce(
      (sum, d) => sum + d.compute.effectiveHostCount, 0
    )
    const mgmtHosts = dedicatedMgmtHostCount.value ?? 0
    return {
      totalRecommendedHosts: workloadHosts + mgmtHosts,
      mgmtHostCount: mgmtHosts,
      totalVmCount: input.workloadDomains.reduce((sum, d) => sum + d.vmCount, 0),
      // FC/NFS: use workload demand (what VMs need); vSAN: use physical capacity
      totalRawStorageTiB: domainResults.value.reduce((sum, d) =>
        sum + (d.storage.workloadStorageRequiredTiB > 0 ? d.storage.workloadStorageRequiredTiB : d.storage.rawCapacityTiB), 0),
      totalEffectiveStorageTiB: domainResults.value.reduce((sum, d) =>
        sum + (d.storage.workloadStorageRequiredTiB > 0 ? d.storage.workloadStorageRequiredTiB : d.storage.effectiveCapacityTiB), 0),
      totalWorkloadStorageRequiredTiB: domainResults.value.reduce((sum, d) => sum + d.storage.workloadStorageRequiredTiB, 0),
      allValidationErrors: domainResults.value.flatMap(d => d.validationErrors),
    }
  })

  // ZERO mutable state — CALC-02 compliant
  return { management, domainResults, aggregateTotals, dedicatedMgmtHostCount }
})
