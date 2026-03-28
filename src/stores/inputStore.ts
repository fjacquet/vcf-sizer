import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useInputStore = defineStore('input', () => {
  // Deployment model (per DEPLOY-01/02/03)
  const deploymentMode = ref<'simple' | 'ha' | 'stretch'>('ha')

  // Host specification (per HOST-01/02/03/04/05)
  const coresPerSocket = ref(16)
  const socketsPerHost = ref(2)
  const hostRamGB = ref(512)
  const hostStorageTB = ref(3.84)
  const hostCount = ref(4)

  // Workload profile (per WKLD-01/02/03/04/05/06)
  const vmCount = ref(100)
  const avgVcpuPerVm = ref(4)
  const avgVramGbPerVm = ref(8)
  const avgStorageGbPerVm = ref(100)
  const cpuOvercommitRatio = ref(4)
  const ramOvercommitRatio = ref(1)

  // Storage configuration (per STOR-01/02/03/04/05/06)
  const storageType = ref<'vsan-esa' | 'fc' | 'nfs'>('vsan-esa')
  const fttLevel = ref<1 | 2>(1)
  const raidType = ref<'raid1' | 'raid5' | 'raid6'>('raid5')
  const dedupEnabled = ref(false)
  const dedupRatio = ref(2)

  return {
    deploymentMode,
    coresPerSocket, socketsPerHost, hostRamGB, hostStorageTB, hostCount,
    vmCount, avgVcpuPerVm, avgVramGbPerVm, avgStorageGbPerVm,
    cpuOvercommitRatio, ramOvercommitRatio,
    storageType, fttLevel, raidType, dedupEnabled, dedupRatio,
  }
})
