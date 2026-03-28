// VCF 9.x Calculation Store — read-only computed results
// CRITICAL: All returned values are computed() — ZERO mutable state (CALC-02)
// This store reads from inputStore and calls pure engine functions.

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useInputStore } from './inputStore'
import { calcManagement } from '../engine/management'
import { calcCompute } from '../engine/compute'
import { calcStorage } from '../engine/storage'
import { validateInputs } from '../engine/validation'

export const useCalculationStore = defineStore('calculation', () => {
  // CRITICAL: call useInputStore() at TOP LEVEL — not inside computed() (Pinia pattern)
  const input = useInputStore()

  // Management domain overhead (depends only on deploymentMode)
  const management = computed(() => calcManagement(input.deploymentMode))

  // Compute sizing (workload + management totals)
  const compute = computed(() =>
    calcCompute({
      deploymentMode: input.deploymentMode,
      coresPerSocket: input.coresPerSocket,
      socketsPerHost: input.socketsPerHost,
      hostRamGB: input.hostRamGB,
      hostCount: input.hostCount,
      vmCount: input.vmCount,
      avgVcpuPerVm: input.avgVcpuPerVm,
      avgVramGbPerVm: input.avgVramGbPerVm,
      cpuOvercommitRatio: input.cpuOvercommitRatio,
      ramOvercommitRatio: input.ramOvercommitRatio,
      managementCores: management.value.totalCores,
      managementRamGB: management.value.totalRamGB,
    })
  )

  // Storage sizing (vSAN ESA overhead stack or FC/NFS pass-through)
  const storage = computed(() =>
    calcStorage({
      storageType: input.storageType,
      hostCount: input.hostCount,
      hostStorageTB: input.hostStorageTB,
      fttLevel: input.fttLevel,
      raidType: input.raidType,
      dedupEnabled: input.dedupEnabled,
      dedupRatio: input.dedupRatio,
    })
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
    })
  )

  // All returned values are computed — ZERO ref() in this store (CALC-02)
  return { management, compute, storage, validationErrors }
})
