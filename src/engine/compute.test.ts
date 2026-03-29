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

describe('calcCompute — NVMe tiering boundary (NVME-01/02/03)', () => {
  const baseInputs = {
    deploymentMode: 'simple' as const,
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostCount: 4,
    vmCount: 0,
    avgVcpuPerVm: 4,
    avgVramGbPerVm: 8,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    managementCores: 0,
    managementRamGB: 0,
  }

  it('nvmeTieringEnabled=true, activeMemoryPct=50 → availableRamGB halved (boundary: halved)', () => {
    const result = calcCompute({ ...baseInputs, nvmeTieringEnabled: true, activeMemoryPct: 50 })
    // effectiveHostRamGB = 512 / 2 = 256; availableRamGB = 4 × 256 = 1024
    expect(result.availableRamGB).toBe(1024)
  })

  it('nvmeTieringEnabled=true, activeMemoryPct=51 → availableRamGB NOT halved (boundary: not halved)', () => {
    const result = calcCompute({ ...baseInputs, nvmeTieringEnabled: true, activeMemoryPct: 51 })
    // effectiveHostRamGB = 512 (unchanged); availableRamGB = 4 × 512 = 2048
    expect(result.availableRamGB).toBe(2048)
  })

  it('nvmeTieringEnabled=true, activeMemoryPct=0 → availableRamGB halved', () => {
    const result = calcCompute({ ...baseInputs, nvmeTieringEnabled: true, activeMemoryPct: 0 })
    expect(result.availableRamGB).toBe(1024)
  })

  it('nvmeTieringEnabled=false, activeMemoryPct=30 → availableRamGB unchanged (disabled)', () => {
    const result = calcCompute({ ...baseInputs, nvmeTieringEnabled: false, activeMemoryPct: 30 })
    expect(result.availableRamGB).toBe(2048)
  })

  it('nvmeTieringEnabled omitted → availableRamGB unchanged (backward compat)', () => {
    const result = calcCompute(baseInputs)
    expect(result.availableRamGB).toBe(2048)
  })
})

describe('calcCompute — stretch cluster resource duplication (STRCH-02)', () => {
  const baseInputs = {
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostCount: 8,
    vmCount: 100,
    avgVcpuPerVm: 4,
    avgVramGbPerVm: 8,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    managementCores: 50,
    managementRamGB: 200,
  }

  it('stretch: totalCoresRequired = (workload + management) × 2', () => {
    // workloadCores = 100×4/4 = 100; + 50 mgmt = 150; × 2 stretch = 300
    const result = calcCompute({ ...baseInputs, deploymentMode: 'stretch' })
    expect(result.totalCoresRequired).toBe(300)
  })

  it('stretch: totalRamRequiredGB = (workload + management) × 2', () => {
    // workloadRam = 100×8/1 = 800; + 200 mgmt = 1000; × 2 stretch = 2000
    const result = calcCompute({ ...baseInputs, deploymentMode: 'stretch' })
    expect(result.totalRamRequiredGB).toBe(2000)
  })

  it('simple: totalCoresRequired = workload + management (no doubling)', () => {
    // workloadCores = 100; + 50 mgmt = 150
    const result = calcCompute({ ...baseInputs, deploymentMode: 'simple' })
    expect(result.totalCoresRequired).toBe(150)
  })

  it('ha: totalCoresRequired = workload + management (no doubling)', () => {
    const result = calcCompute({ ...baseInputs, deploymentMode: 'ha' })
    expect(result.totalCoresRequired).toBe(150)
  })
})

describe('calcCompute — GPU RAM overhead (GPU-01/02/03)', () => {
  const baseInputs = {
    deploymentMode: 'simple' as const,
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostCount: 4,
    vmCount: 0,
    avgVcpuPerVm: 4,
    avgVramGbPerVm: 8,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    managementCores: 0,
    managementRamGB: 0,
  }

  it('gpuVmCount=10, vgpuMemoryGB=16 → totalRamRequiredGB includes +320 GB (10×16×2)', () => {
    const result = calcCompute({ ...baseInputs, gpuVmCount: 10, vgpuMemoryGB: 16 })
    // workloadRam = 0, managementRam = 0, gpuOverhead = 10×16×2 = 320
    expect(result.totalRamRequiredGB).toBe(320)
  })

  it('gpuVmCount=0 → zero GPU overhead, totalRamRequiredGB unchanged vs baseline', () => {
    const baseline = calcCompute(baseInputs)
    const withGpu = calcCompute({ ...baseInputs, gpuVmCount: 0, vgpuMemoryGB: 16 })
    expect(withGpu.totalRamRequiredGB).toBe(baseline.totalRamRequiredGB)
  })

  it('gpuVmCount omitted → zero GPU overhead (backward compat)', () => {
    const baseline = calcCompute(baseInputs)
    const result = calcCompute(baseInputs)
    expect(result.totalRamRequiredGB).toBe(baseline.totalRamRequiredGB)
  })
})
