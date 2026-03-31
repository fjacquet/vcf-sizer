// VCF 9.x Calculation Store — read-only computed results
// CRITICAL: All returned values are computed() — ZERO mutable state (CALC-02)
// This store reads from inputStore and calls pure engine functions.

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useInputStore } from './inputStore'
import { calcManagement } from '../engine/management'
import { calcCompute } from '../engine/compute'
import { calcStorage } from '../engine/storage'
import { calcVsanMax } from '../engine/vsanMax'
import { calcStretch } from '../engine/stretch'
import { validateInputs, DEDICATED_MGMT_MIN_HOSTS, STRETCH_DEDICATED_MGMT_MIN_HOSTS } from '../engine/validation'
import type { DomainResult, AggregateTotals } from '../engine/types'

export const useCalculationStore = defineStore('calculation', () => {
  // CRITICAL: call useInputStore() at TOP LEVEL — not inside computed() (Pinia pattern)
  const input = useInputStore()

  // Management domain overhead — uses management domain's own deploymentMode (independent of workload domains)
  const management = computed(() =>
    calcManagement(input.managementDomain.deploymentMode)
  )

  // Dedicated management host count — uses managementDomain host specs (NOT workloadDomains[0])
  // (Pitfall 4: must be independent of workload domain specs)
  const dedicatedMgmtHostCount = computed<number | null>(() => {
    if (input.managementArchitecture !== 'dedicated') return null
    const coresPerHost = input.managementDomain.coresPerSocket * input.managementDomain.socketsPerHost
    const minHosts = input.managementDomain.deploymentMode === 'stretch'
      ? STRETCH_DEDICATED_MGMT_MIN_HOSTS
      : DEDICATED_MGMT_MIN_HOSTS
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
        }),
        storage: calcStorage({
          storageType: domain.storageType,
          hostCount: effectiveHostCount,
          hostStorageTB: domain.hostStorageTB,
          fttLevel: domain.fttLevel,
          raidType: domain.raidType,
          dedupEnabled: domain.dedupEnabled,
          dedupRatio: domain.dedupRatio,
          deploymentMode: domain.deploymentMode,
        }),
        stretch: domain.deploymentMode === 'stretch'
          ? calcStretch({
              preferredSiteHosts: domain.preferredSiteHosts,
              secondarySiteHosts: domain.secondarySiteHosts,
              hostStorageTB: domain.hostStorageTB,
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
      (sum, d) => sum + d.compute.recommendedHostCount, 0
    )
    const mgmtHosts = dedicatedMgmtHostCount.value ?? 0
    return {
      totalRecommendedHosts: workloadHosts + mgmtHosts,
      mgmtHostCount: mgmtHosts,
      totalVmCount: input.workloadDomains.reduce((sum, d) => sum + d.vmCount, 0),
      totalRawStorageTB: domainResults.value.reduce((sum, d) => sum + d.storage.rawCapacityTB, 0),
      totalEffectiveStorageTB: domainResults.value.reduce((sum, d) => sum + d.storage.effectiveCapacityTB, 0),
      allValidationErrors: domainResults.value.flatMap(d => d.validationErrors),
    }
  })

  // ZERO mutable state — CALC-02 compliant
  return { management, domainResults, aggregateTotals, dedicatedMgmtHostCount }
})
