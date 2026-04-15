// VCF 9.x Compute Sizing Engine
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All arithmetic uses Decimal.js to avoid IEEE 754 float errors (PITFALLS #1)

import Decimal from 'decimal.js'
import type { ComputeInputs, ComputeResult } from './types'

// ─── calcCompute ───────────────────────────────────────────────────────────

/**
 * Calculate total cluster compute requirements including workload + management overhead.
 *
 * Formula:
 *   workloadCores = vmCount × avgVcpuPerVm / cpuOvercommitRatio
 *   workloadRam = vmCount × avgVramGbPerVm / ramOvercommitRatio
 *   stretchMultiplier = 2 when deploymentMode='stretch', else 1
 *   totalCoresRequired = (workloadCores + managementCores) × stretchMultiplier
 *   totalRamRequiredGB = (workloadRam + managementRamGB) × stretchMultiplier
 *   (stretch: each site runs full workload + full management stack — PFTT=1 HA contract)
 *   availableCores = hostCount × coresPerSocket × socketsPerHost
 *   availableRamGB = hostCount × hostRamGB
 *   minHostsForCpu = ceil(totalCoresRequired / coresPerSocket / socketsPerHost)
 *   minHostsForRam = ceil(totalRamRequiredGB / hostRamGB)
 *   recommendedHostCount = max(minHostsForCpu, minHostsForRam)
 */
export function calcCompute(inputs: ComputeInputs): ComputeResult {
  const {
    coresPerSocket,
    socketsPerHost,
    hostRamGB,
    hostCount,
    vmCount,
    avgVcpuPerVm,
    avgVramGbPerVm,
    cpuOvercommitRatio,
    ramOvercommitRatio,
    managementCores,
    managementRamGB,
    nvmeTieringEnabled = false,
    activeMemoryPct = 50,
    gpuVmCount = 0,
    vgpuMemoryGB = 16,
  } = inputs

  // NVMe Memory Tiering: when enabled and active memory <= 50%, halve effective DRAM
  // Boundary: activeMemoryPct=50 → halved, activeMemoryPct=51 → NOT halved (per NVME-03)
  const effectiveHostRamGB =
    nvmeTieringEnabled && activeMemoryPct <= 50
      ? new Decimal(hostRamGB).dividedBy(2).toNumber()
      : hostRamGB

  // Physical cores per host
  const coresPerHost = new Decimal(coresPerSocket).times(socketsPerHost).toNumber()

  // Workload compute requirements
  const workloadCoresRequired = new Decimal(vmCount)
    .times(avgVcpuPerVm)
    .dividedBy(cpuOvercommitRatio)
    .toNumber()

  const workloadRamRequiredGB = new Decimal(vmCount)
    .times(avgVramGbPerVm)
    .dividedBy(ramOvercommitRatio)
    .toNumber()

  // GPU RAM overhead: 2× vGPU memory per GPU VM (conservative vGPU host overhead)
  // gpuVmCount=0 → zero overhead, no change to existing behavior (per GPU-03)
  const gpuRamOverheadGB = new Decimal(gpuVmCount).times(vgpuMemoryGB).times(2).toNumber()

  // Stretch cluster: each site must independently handle ALL workloads AND management (PFTT=1).
  // Both sites run a full management stack (vCenter, NSX, etc.) for independent operation.
  // Double the entire compute requirement (workload + management + GPU).
  const stretchMultiplier = inputs.deploymentMode === 'stretch' ? 2 : 1

  // Total requirements × stretch multiplier
  const totalCoresRequired = new Decimal(workloadCoresRequired)
    .plus(managementCores)
    .times(stretchMultiplier)
    .toNumber()
  const totalRamRequiredGB = new Decimal(workloadRamRequiredGB)
    .plus(managementRamGB)
    .plus(gpuRamOverheadGB)
    .times(stretchMultiplier)
    .toNumber()

  // Available capacity from current host configuration
  const availableCores = new Decimal(hostCount).times(coresPerHost).toNumber()
  const availableRamGB = new Decimal(hostCount).times(effectiveHostRamGB).toNumber()

  // Utilization percentages (capped at sensible values for display)
  const coreUtilizationPct =
    availableCores > 0
      ? new Decimal(totalCoresRequired).dividedBy(availableCores).times(100).toNumber()
      : 0

  const ramUtilizationPct =
    availableRamGB > 0
      ? new Decimal(totalRamRequiredGB).dividedBy(availableRamGB).times(100).toNumber()
      : 0

  // Minimum hosts required to satisfy compute demand
  const minHostsForCpu = Math.ceil(
    new Decimal(totalCoresRequired).dividedBy(coresPerHost).toNumber()
  )
  const minHostsForRam = Math.ceil(
    new Decimal(totalRamRequiredGB).dividedBy(effectiveHostRamGB).toNumber()
  )

  // Recommended host count = maximum of the two constraints
  const recommendedHostCount = Math.max(minHostsForCpu, minHostsForRam)

  return {
    totalCoresRequired,
    totalRamRequiredGB,
    availableCores,
    availableRamGB,
    coreUtilizationPct,
    ramUtilizationPct,
    minHostsForCpu,
    minHostsForRam,
    recommendedHostCount,
    effectiveHostCount: hostCount,
  }
}
