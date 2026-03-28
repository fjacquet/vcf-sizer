/// <reference types="vitest/globals" />
import { calcCompute } from './compute'

describe('calcCompute — basic sizing', () => {
  it('100 VMs × 4 vCPU / 4:1 ratio + 50 mgmt cores = 150 total cores required', () => {
    const result = calcCompute({
      deploymentMode: 'simple',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostCount: 4,
      vmCount: 100,
      avgVcpuPerVm: 4,
      avgVramGbPerVm: 8,
      cpuOvercommitRatio: 4,
      ramOvercommitRatio: 1,
      managementCores: 50,
      managementRamGB: 201,
    })
    // workloadCores = 100 × 4 / 4 = 100
    // totalCores = 100 + 50 = 150
    expect(result.totalCoresRequired).toBe(150)
    // workloadRAM = 100 × 8 / 1 = 800 GB
    // totalRAM = 800 + 201 = 1001 GB
    expect(result.totalRamRequiredGB).toBe(1001)
  })

  it('recommendedHostCount = max(minHostsForCpu, minHostsForRam)', () => {
    const result = calcCompute({
      deploymentMode: 'simple',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostCount: 4,
      vmCount: 100,
      avgVcpuPerVm: 4,
      avgVramGbPerVm: 8,
      cpuOvercommitRatio: 4,
      ramOvercommitRatio: 1,
      managementCores: 50,
      managementRamGB: 201,
    })
    expect(result.recommendedHostCount).toBe(
      Math.max(result.minHostsForCpu, result.minHostsForRam)
    )
  })

  it('availableCores = hostCount × coresPerSocket × socketsPerHost', () => {
    const result = calcCompute({
      deploymentMode: 'ha',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostCount: 4,
      vmCount: 50,
      avgVcpuPerVm: 4,
      avgVramGbPerVm: 16,
      cpuOvercommitRatio: 4,
      ramOvercommitRatio: 1,
      managementCores: 118,
      managementRamGB: 473,
    })
    // 4 hosts × 16 cores/socket × 2 sockets = 128 available cores
    expect(result.availableCores).toBe(128)
    // 4 × 512 = 2048 available RAM
    expect(result.availableRamGB).toBe(2048)
  })
})
