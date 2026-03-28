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
 *   totalCoresRequired = workloadCores + managementCores
 *   workloadRam = vmCount × avgVramGbPerVm / ramOvercommitRatio
 *   totalRamRequiredGB = workloadRam + managementRamGB
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
  } = inputs

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

  // Total requirements (workload + management overhead)
  const totalCoresRequired = new Decimal(workloadCoresRequired).plus(managementCores).toNumber()
  const totalRamRequiredGB = new Decimal(workloadRamRequiredGB).plus(managementRamGB).toNumber()

  // Available capacity from current host configuration
  const availableCores = new Decimal(hostCount).times(coresPerHost).toNumber()
  const availableRamGB = new Decimal(hostCount).times(hostRamGB).toNumber()

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
    new Decimal(totalRamRequiredGB).dividedBy(hostRamGB).toNumber()
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
  }
}
