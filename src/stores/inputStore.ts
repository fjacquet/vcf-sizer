import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createDefaultWorkloadDomain, createDefaultManagementDomain } from '@/engine/defaults'
import type { WorkloadDomainConfig, ManagementDomainConfig } from '@/engine/types'

export const useInputStore = defineStore('input', () => {
  // GLOBAL (deployment-level, not per-domain)
  const managementArchitecture = ref<'shared' | 'dedicated'>('shared')

  // Management domain host specs — independent of workload domains (DOM-03)
  const managementDomain = ref<ManagementDomainConfig>(createDefaultManagementDomain())

  // Workload domains — default: one domain named "WLD-1" (DOM-04)
  // Use ref<[]> NOT reactive([]) — avoids storeToRefs() double-wrap bug
  const workloadDomains = ref<WorkloadDomainConfig[]>([createDefaultWorkloadDomain(0)])

  // Active tab index — UI state only, NOT serialized to URL
  const activeDomainIndex = ref(0)

  // Domain mutations — use direct property assignment, NOT $patch() (shallow merge breaks arrays)
  function addDomain() {
    workloadDomains.value.push(createDefaultWorkloadDomain(workloadDomains.value.length))
    activeDomainIndex.value = workloadDomains.value.length - 1
  }

  function removeDomain(id: string) {
    const idx = workloadDomains.value.findIndex(d => d.id === id)
    if (idx === -1 || workloadDomains.value.length === 1) return
    workloadDomains.value.splice(idx, 1)
    activeDomainIndex.value = Math.min(activeDomainIndex.value, workloadDomains.value.length - 1)
  }

  function updateDomain(id: string, patch: Partial<WorkloadDomainConfig>) {
    const domain = workloadDomains.value.find(d => d.id === id)
    if (domain) Object.assign(domain, patch)
  }

  return {
    managementArchitecture,
    managementDomain,
    workloadDomains,
    activeDomainIndex,
    addDomain,
    removeDomain,
    updateDomain,
  }
})
