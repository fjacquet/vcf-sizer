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

  // NVMe Memory Tiering (per NVME-01/02)
  const nvmeTieringEnabled = ref(false)
  const activeMemoryPct = ref(50)

  // Stretch Cluster per-site host counts (per STRCH-01)
  const preferredSiteHosts = ref(3)
  const secondarySiteHosts = ref(3)

  // Management architecture: shared (co-located) or dedicated (ARCH-01, ARCH-02)
  const managementArchitecture = ref<'shared' | 'dedicated'>('shared')

  // Workload profile (per WKLD-01/02/03/04/05/06)
  const vmCount = ref(100)
  const avgVcpuPerVm = ref(4)
  const avgVramGbPerVm = ref(8)
  const avgStorageGbPerVm = ref(100)
  const cpuOvercommitRatio = ref(4)
  const ramOvercommitRatio = ref(1)

  // AI/GPU Workloads (per GPU-01/02)
  const gpuVmCount = ref(0)
  const vgpuMemoryGB = ref(16)

  // Storage configuration (per STOR-01/02/03/04/05/06)
  const storageType = ref<'vsan-esa' | 'fc' | 'nfs' | 'vsan-max'>('vsan-esa')
  const fttLevel = ref<1 | 2>(1)
  const raidType = ref<'raid1' | 'raid5' | 'raid6'>('raid5')
  const dedupEnabled = ref(false)
  const dedupRatio = ref(2)

  // vSAN Max storage cluster (VMAX-01, VMAX-02)
  const vsanMaxProfile = ref<'xs' | 'sm' | 'med' | 'lrg' | 'xl'>('med')
  const vsanMaxStorageNodes = ref(4)

  // Network speed (Phase 5 — STOR-05 dedup eligibility, STRCH-05 bandwidth cap)
  const networkSpeedGbE = ref<10 | 25 | 100>(25)

  return {
    deploymentMode,
    coresPerSocket, socketsPerHost, hostRamGB, hostStorageTB, hostCount,
    nvmeTieringEnabled, activeMemoryPct,
    preferredSiteHosts, secondarySiteHosts,
    managementArchitecture,
    vmCount, avgVcpuPerVm, avgVramGbPerVm, avgStorageGbPerVm,
    cpuOvercommitRatio, ramOvercommitRatio,
    gpuVmCount, vgpuMemoryGB,
    storageType, fttLevel, raidType, dedupEnabled, dedupRatio,
    vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE,
  }
})
