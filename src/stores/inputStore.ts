import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import { createDefaultWorkloadDomain, createDefaultManagementDomain } from '@/engine/defaults'
import type { WorkloadDomainConfig, ManagementDomainConfig } from '@/engine/types'
import { useUiStore } from '@/stores/uiStore'

export const useInputStore = defineStore('input', () => {
  // GLOBAL (deployment-level, not per-domain)
  const managementArchitecture = ref<'colocated' | 'dedicated'>('colocated')

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

  // Auto-correct incompatible field combinations as the user edits a domain.
  // Surfaces a transient banner via uiStore.flashAutoCorrection() so the user knows
  // which field was silently normalized. Runs on every patch (including URL-state
  // rehydration) so rules are enforced regardless of entry point.
  function normalizeDomainPatch(
    domain: WorkloadDomainConfig,
    patch: Partial<WorkloadDomainConfig>,
  ): Partial<WorkloadDomainConfig> {
    const ui = useUiStore()
    const normalized: Partial<WorkloadDomainConfig> = { ...patch }

    // Effective values after patch (for cross-field checks)
    const nextStorage = normalized.storageType ?? domain.storageType
    const nextFtt = normalized.fttLevel ?? domain.fttLevel
    const nextRaid = normalized.raidType ?? domain.raidType
    const nextDedup = normalized.dedupEnabled ?? domain.dedupEnabled
    let nextMode = normalized.deploymentMode ?? domain.deploymentMode

    // Rule: vSAN Max + Stretch is invalid → force HA.
    // Must run BEFORE the Stretch/Dedup rule so the dedup rule does not
    // silently disable dedup based on a mode that we are about to revert.
    if (nextStorage === 'vsan-max' && nextMode === 'stretch') {
      normalized.deploymentMode = 'ha'
      nextMode = 'ha'
      ui.flashAutoCorrection('warnings.autoCorrectDeploymentVsanMax')
    }

    // Rule: Stretch + Dedup is invalid → force dedup off
    if (nextMode === 'stretch' && nextDedup) {
      normalized.dedupEnabled = false
      ui.flashAutoCorrection('warnings.autoCorrectDedupStretch')
    }

    // Rule: RAID-5 requires FTT=1 → promote to RAID-6 when FTT=2
    if (nextFtt === 2 && nextRaid === 'raid5') {
      normalized.raidType = 'raid6'
      ui.flashAutoCorrection('warnings.autoCorrectRaidFtt2')
    }

    // Rule: RAID-6 requires FTT=2 → demote to RAID-5 when FTT=1
    if (nextFtt === 1 && nextRaid === 'raid6') {
      normalized.raidType = 'raid5'
      ui.flashAutoCorrection('warnings.autoCorrectRaidFtt1')
    }

    return normalized
  }

  function updateDomain(id: string, patch: Partial<WorkloadDomainConfig>) {
    const domain = workloadDomains.value.find(d => d.id === id)
    if (!domain) return
    Object.assign(domain, normalizeDomainPatch(domain, patch))
  }

  function renameDomain(id: string, name: string) {
    const trimmed = name.trim()
    if (trimmed) updateDomain(id, { name: trimmed })
  }

  function updateManagementDomain(patch: Partial<ManagementDomainConfig>) {
    Object.assign(managementDomain.value, patch)
  }

  function duplicateDomain(id: string, newName: string): void {
    const idx = workloadDomains.value.findIndex(d => d.id === id)
    if (idx === -1) return
    const source = workloadDomains.value[idx]
    // toRaw() strips Pinia reactive proxy before structuredClone (Pinia #1412)
    const clone = structuredClone(toRaw(source))
    clone.id = crypto.randomUUID()
    clone.name = newName
    workloadDomains.value.splice(idx + 1, 0, clone)
    activeDomainIndex.value = idx + 1
  }

  return {
    managementArchitecture,
    managementDomain,
    workloadDomains,
    activeDomainIndex,
    addDomain,
    removeDomain,
    updateDomain,
    renameDomain,
    updateManagementDomain,
    duplicateDomain,
  }
})
