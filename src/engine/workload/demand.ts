// VCF 9.1 Workload Sizing — per-site compute/RAM demand
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All arithmetic via Decimal.js (PITFALLS #1).

import Decimal from 'decimal.js'
import type { WorkloadDemandInputs, WorkloadDemand } from './types'

/**
 * Per-site workload demand. Demand is computed PER SITE — there is NO stretch
 * multiplier here. A stretch cluster runs the full workload independently at each
 * site, so both sites size to this same per-site demand (doubling happens only at
 * the host-count/topology layer, never on demand). This is the fix for the prior
 * "demand ×2 then host count ×2" double-count.
 *
 *   coresPerHost   = coresPerSocket × socketsPerHost
 *   effRamPerHost  = nvmeTiering && activeMemoryPct ≤ 50 ? hostRamGB/2 : hostRamGB
 *   siteCores      = vmCount × avgVcpuPerVm / cpuOvercommit + mgmtCores
 *   siteRamGB      = vmCount × avgVramGbPerVm / ramOvercommit + gpuVmCount×vgpuMemoryGB×2 + mgmtRamGB
 *   minHostsForCpu = ceil(siteCores / coresPerHost)
 *   minHostsForRam = ceil(siteRamGB / effRamPerHost)
 */
export function calcWorkloadDemand(inputs: WorkloadDemandInputs): WorkloadDemand {
  const {
    vmCount,
    avgVcpuPerVm,
    avgVramGbPerVm,
    cpuOvercommitRatio,
    ramOvercommitRatio,
    gpuVmCount,
    vgpuMemoryGB,
    nvmeTieringEnabled,
    activeMemoryPct,
    coresPerSocket,
    socketsPerHost,
    hostRamGB,
    mgmtCores,
    mgmtRamGB,
  } = inputs

  const coresPerHost = new Decimal(coresPerSocket).times(socketsPerHost).toNumber()

  // NVMe Memory Tiering: when enabled and active memory ≤ 50%, effective DRAM halves.
  // Boundary: activeMemoryPct=50 → halved; 51 → not halved (matches prior NVME-03 behavior).
  // NOTE (VCF 9.1): Enhanced NVMe Memory Tiering supports higher DRAM:NVMe ratios; the 0.5
  // factor is the conservative default and the seam to generalize when 9.1 ratios are wired in.
  const effRamPerHost =
    nvmeTieringEnabled && activeMemoryPct <= 50
      ? new Decimal(hostRamGB).dividedBy(2).toNumber()
      : hostRamGB

  const workloadCores = new Decimal(vmCount)
    .times(avgVcpuPerVm)
    .dividedBy(cpuOvercommitRatio || 1)
    .toNumber()

  const workloadRamGB = new Decimal(vmCount)
    .times(avgVramGbPerVm)
    .dividedBy(ramOvercommitRatio || 1)
    .toNumber()

  // GPU RAM overhead: 2× vGPU memory per GPU VM (conservative vGPU host overhead).
  const gpuRamOverheadGB = new Decimal(gpuVmCount).times(vgpuMemoryGB).times(2).toNumber()

  const siteCoresRequired = new Decimal(workloadCores).plus(mgmtCores).toNumber()
  const siteRamRequiredGB = new Decimal(workloadRamGB)
    .plus(gpuRamOverheadGB)
    .plus(mgmtRamGB)
    .toNumber()

  const minHostsForCpu =
    coresPerHost > 0
      ? Math.ceil(new Decimal(siteCoresRequired).dividedBy(coresPerHost).toNumber())
      : 0
  const minHostsForRam =
    effRamPerHost > 0
      ? Math.ceil(new Decimal(siteRamRequiredGB).dividedBy(effRamPerHost).toNumber())
      : 0

  return {
    coresPerHost,
    effRamPerHost,
    siteCoresRequired,
    siteRamRequiredGB,
    minHostsForCpu,
    minHostsForRam,
  }
}
