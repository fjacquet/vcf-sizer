import { describe, it, expect } from 'vitest'
import { calcWorkloadDemand } from './demand'
import type { WorkloadDemandInputs } from './types'

// Building-block host: 32 cores/socket × 2 = 64 cores/host, 1024 GB RAM.
function baseInputs(overrides: Partial<WorkloadDemandInputs> = {}): WorkloadDemandInputs {
  return {
    vmCount: 5000,
    avgVcpuPerVm: 4,
    avgVramGbPerVm: 16,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    gpuVmCount: 0,
    vgpuMemoryGB: 16,
    nvmeTieringEnabled: false,
    activeMemoryPct: 50,
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 1024,
    mgmtCores: 0,
    mgmtRamGB: 0,
    ...overrides,
  }
}

describe('calcWorkloadDemand', () => {
  it('report scenario: 5000 VMs → 5000 cores / 80000 GB per site, 79 hosts each', () => {
    const d = calcWorkloadDemand(baseInputs())
    expect(d.coresPerHost).toBe(64)
    expect(d.effRamPerHost).toBe(1024)
    expect(d.siteCoresRequired).toBe(5000) // 5000 × 4 / 4
    expect(d.siteRamRequiredGB).toBe(80000) // 5000 × 16 / 1
    expect(d.minHostsForCpu).toBe(79) // ceil(5000 / 64)
    expect(d.minHostsForRam).toBe(79) // ceil(80000 / 1024)
  })

  it('is PER SITE — no stretch ×2 applied to demand', () => {
    // Demand is identical regardless of topology; doubling is a topology concern.
    const d = calcWorkloadDemand(baseInputs())
    expect(d.siteCoresRequired).toBe(5000)
  })

  it('applies CPU and RAM overcommit', () => {
    const d = calcWorkloadDemand(
      baseInputs({ vmCount: 100, avgVcpuPerVm: 4, cpuOvercommitRatio: 4, avgVramGbPerVm: 8, ramOvercommitRatio: 2 }),
    )
    expect(d.siteCoresRequired).toBe(100) // 100 × 4 / 4
    expect(d.siteRamRequiredGB).toBe(400) // 100 × 8 / 2
  })

  it('halves effective RAM-per-host when NVMe tiering active (≤50%)', () => {
    const on = calcWorkloadDemand(baseInputs({ nvmeTieringEnabled: true, activeMemoryPct: 50 }))
    expect(on.effRamPerHost).toBe(512)
    expect(on.minHostsForRam).toBe(157) // ceil(80000 / 512)
    const off = calcWorkloadDemand(baseInputs({ nvmeTieringEnabled: true, activeMemoryPct: 51 }))
    expect(off.effRamPerHost).toBe(1024)
  })

  it('adds GPU RAM overhead (2× vGPU memory per GPU VM)', () => {
    const d = calcWorkloadDemand(
      baseInputs({ vmCount: 0, gpuVmCount: 10, vgpuMemoryGB: 16, avgVramGbPerVm: 0 }),
    )
    expect(d.siteRamRequiredGB).toBe(320) // 10 × 16 × 2
  })

  it('adds colocated management overhead to the site demand', () => {
    const d = calcWorkloadDemand(baseInputs({ mgmtCores: 128, mgmtRamGB: 512 }))
    expect(d.siteCoresRequired).toBe(5128)
    expect(d.siteRamRequiredGB).toBe(80512)
  })
})
