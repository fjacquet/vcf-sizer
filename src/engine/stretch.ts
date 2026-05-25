// VCF 9.x Stretch Cluster Engine
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All arithmetic uses Decimal.js (PITFALLS #1)

import Decimal from 'decimal.js'
import { calcWorkloadStorageTiB } from './shared'
import type { StretchInputs, StretchResult, StretchNetworkChecklist } from './types'

// ESA witness minimum profile: M = 4 vCPU / 16 GB
// OSA Tiny (2 vCPU / 8 GB) does NOT exist in vSAN ESA — minimum is M profile
const ESA_WITNESS_CORES = 4
const ESA_WITNESS_RAM_GB = 16

// Minimum hosts per site for stretch cluster (3 data hosts per site minimum)
export const STRETCH_MIN_HOSTS_PER_SITE = 3

// Minimum inter-site bandwidth floor per VCF 9.0 TechDocs (STRCH-06)
export const STRETCH_MIN_BANDWIDTH_GBPS = 10

export function calcStretch(inputs: StretchInputs): StretchResult {
  const { hostsPerSite, vmCount, avgStorageGbPerVm, storageType } = inputs

  // A vSAN witness appliance applies ONLY to vSAN ESA stretched clusters. With external
  // storage (FC/NFS) a stretched cluster is a vSphere Metro Storage Cluster (vMSC): the
  // cross-site quorum/tiebreaker lives at the storage array, NOT in a vSAN witness VM.
  const requiresVsanWitness = storageType === 'vsan-esa'

  // Demand-driven: both sites are provisioned identically, so total = 2 × per-site.
  const totalHosts = new Decimal(hostsPerSite).times(2).toNumber()

  // Total workload storage in TiB (VMs × average storage per VM, converted from GB)
  const totalWorkloadStorageTiB = calcWorkloadStorageTiB(vmCount, avgStorageGbPerVm)

  // Cross-site bandwidth recommendation: 10% of total workload storage as daily change rate heuristic
  // Apply 10 Gbps floor per VCF 9.0 TechDocs minimum requirement (STRCH-06)
  const calculatedBandwidthGbps = new Decimal(totalWorkloadStorageTiB).times(0.1).toNumber()
  const minBandwidthGbps = Math.max(calculatedBandwidthGbps, STRETCH_MIN_BANDWIDTH_GBPS)
  const bandwidthFloorApplied = calculatedBandwidthGbps < STRETCH_MIN_BANDWIDTH_GBPS

  // Each site holds a full independent copy — effective per-site storage = total / 2
  const effectivePerSiteStorageTiB = new Decimal(totalWorkloadStorageTiB).dividedBy(2).toNumber()

  // Witness RTT threshold derived from per-site host count (STRCH-08)
  // <=10 hosts/site: 200ms; 11+ hosts/site: 100ms (conservative fallback)
  const maxWitnessLatencyMs = hostsPerSite <= 10 ? 200 : 100

  const networkChecklist: StretchNetworkChecklist = {
    minInterSiteBandwidthGbps: STRETCH_MIN_BANDWIDTH_GBPS,
    maxInterSiteLatencyMs: 5,
    maxWitnessLatencyMs,
    jumboFramesRequired: true,
    witnessMinBandwidthMbps: 2,
  }

  return {
    totalHosts,
    requiresVsanWitness,
    witnessCores: requiresVsanWitness ? ESA_WITNESS_CORES : 0,
    witnessRamGB: requiresVsanWitness ? ESA_WITNESS_RAM_GB : 0,
    minBandwidthGbps,
    effectivePerSiteStorageTiB,
    storageNote: 'deployment.stretch.storageNote',
    bandwidthFloorApplied,
    networkChecklist,
  }
}
