// VCF 9.x Stretch Cluster Engine
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All arithmetic uses Decimal.js (PITFALLS #1)

import Decimal from 'decimal.js'
import type { StretchInputs, StretchResult } from './types'

// ESA witness minimum profile: M = 4 vCPU / 16 GB
// OSA Tiny (2 vCPU / 8 GB) does NOT exist in vSAN ESA — minimum is M profile
const ESA_WITNESS_CORES = 4
const ESA_WITNESS_RAM_GB = 16

// Minimum hosts per site for stretch cluster (3 data hosts per site minimum)
export const STRETCH_MIN_HOSTS_PER_SITE = 3

export function calcStretch(inputs: StretchInputs): StretchResult {
  const { preferredSiteHosts, secondarySiteHosts, vmCount, avgStorageGbPerVm } = inputs

  const totalHosts = new Decimal(preferredSiteHosts).plus(secondarySiteHosts).toNumber()

  // Total workload storage in TB (VMs × average storage per VM, converted from GB)
  const totalWorkloadStorageTB = new Decimal(vmCount)
    .times(avgStorageGbPerVm)
    .dividedBy(1024)
    .toNumber()

  // Cross-site bandwidth recommendation: 10% of total workload storage as daily change rate heuristic
  const minBandwidthGbps = new Decimal(totalWorkloadStorageTB).times(0.1).toNumber()

  // Each site holds a full independent copy — effective per-site storage = total / 2
  const effectivePerSiteStorageTB = new Decimal(totalWorkloadStorageTB).dividedBy(2).toNumber()

  return {
    totalHosts,
    witnessCores: ESA_WITNESS_CORES,
    witnessRamGB: ESA_WITNESS_RAM_GB,
    minBandwidthGbps,
    effectivePerSiteStorageTB,
    storageNote: 'deployment.stretch.storageNote',
  }
}
