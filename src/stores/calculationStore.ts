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
import { validateInputs } from '../engine/validation'

export const useCalculationStore = defineStore('calculation', () => {
  // CRITICAL: call useInputStore() at TOP LEVEL — not inside computed() (Pinia pattern)
  const input = useInputStore()

  // Management domain overhead (depends only on deploymentMode)
  const management = computed(() => calcManagement(input.deploymentMode))

  // When stretch is active, total hosts = preferred + secondary (STRCH-01)
  // For simple/ha, total hosts = hostCount slider
  const effectiveHostCount = computed(() =>
    input.deploymentMode === 'stretch'
      ? input.preferredSiteHosts + input.secondarySiteHosts
      : input.hostCount
  )

  // Compute sizing (workload + management totals)
  const compute = computed(() =>
    calcCompute({
      deploymentMode: input.deploymentMode,
      coresPerSocket: input.coresPerSocket,
      socketsPerHost: input.socketsPerHost,
      hostRamGB: input.hostRamGB,
      hostCount: effectiveHostCount.value,
      vmCount: input.vmCount,
      avgVcpuPerVm: input.avgVcpuPerVm,
      avgVramGbPerVm: input.avgVramGbPerVm,
      cpuOvercommitRatio: input.cpuOvercommitRatio,
      ramOvercommitRatio: input.ramOvercommitRatio,
      managementCores: management.value.totalCores,
      managementRamGB: management.value.totalRamGB,
      nvmeTieringEnabled: input.nvmeTieringEnabled,
      activeMemoryPct: input.activeMemoryPct,
      gpuVmCount: input.gpuVmCount,
      vgpuMemoryGB: input.vgpuMemoryGB,
    })
  )

  // Storage sizing (vSAN ESA overhead stack or FC/NFS pass-through)
  const storage = computed(() =>
    calcStorage({
      storageType: input.storageType,
      hostCount: effectiveHostCount.value,
      hostStorageTB: input.hostStorageTB,
      fttLevel: input.fttLevel,
      raidType: input.raidType,
      dedupEnabled: input.dedupEnabled,
      dedupRatio: input.dedupRatio,
      deploymentMode: input.deploymentMode,
    })
  )

  // Stretch cluster topology (only meaningful when deploymentMode === 'stretch')
  const stretch = computed(() =>
    calcStretch({
      preferredSiteHosts: input.preferredSiteHosts,
      secondarySiteHosts: input.secondarySiteHosts,
      hostStorageTB: input.hostStorageTB,
      vmCount: input.vmCount,
      avgStorageGbPerVm: input.avgStorageGbPerVm,
    })
  )

  // Dedicated management host count recommendation (only meaningful when managementArchitecture === 'dedicated')
  const dedicatedMgmtHostCount = computed<number | null>(() => {
    if (input.managementArchitecture !== 'dedicated') return null
    const coresPerHost = input.coresPerSocket * input.socketsPerHost
    return Math.max(4, Math.ceil(management.value.totalCores / coresPerHost))
  })

  // vSAN Max storage cluster sizing (only meaningful when storageType === 'vsan-max')
  const vsanMax = computed(() =>
    input.storageType === 'vsan-max'
      ? calcVsanMax({
          profile: input.vsanMaxProfile,
          storageNodeCount: input.vsanMaxStorageNodes,
          computeNodeCount: input.hostCount,
        })
      : null
  )

  // Validation warnings and errors
  const validationErrors = computed(() =>
    validateInputs({
      deploymentMode: input.deploymentMode,
      coresPerSocket: input.coresPerSocket,
      socketsPerHost: input.socketsPerHost,
      hostCount: input.hostCount,
      dedupEnabled: input.dedupEnabled,
      storageType: input.storageType,
      preferredSiteHosts: input.preferredSiteHosts,
      secondarySiteHosts: input.secondarySiteHosts,
      managementArchitecture: input.managementArchitecture,
      networkSpeedGbE: input.networkSpeedGbE,
      vsanMaxStorageNodes: input.vsanMaxStorageNodes,
    })
  )

  // All returned values are computed — ZERO ref() in this store (CALC-02)
  return { management, compute, storage, validationErrors, stretch, dedicatedMgmtHostCount, vsanMax }
})
