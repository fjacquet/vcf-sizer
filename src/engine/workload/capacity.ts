// VCF 9.1 Workload Sizing — capacity + FC/NFS reconciliation
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// Splits the old 107-line calcStorage switch into focused pure functions and adds
// FC/NFS demand-vs-capacity reconciliation (previously demand was reported AS capacity).
// vSAN ESA overhead math reuses the helpers/constants already exported from storage.ts (DRY).

import Decimal from 'decimal.js'
import {
  vsanEsaRaidOverhead,
  VSAN_LFS_OVERHEAD,
  VSAN_METADATA_PCT,
  VSAN_SAFE_SLACK,
} from '../storage'
import { calcWorkloadStorageTiB } from '../shared'
import type { WorkloadCapacityInputs, WorkloadCapacityResult } from './types'

function emptyStack() {
  return {
    rawCapacityTiB: 0,
    raidMultiplier: 1,
    usableAfterRaidTiB: 0,
    lfsOverheadTiB: 0,
    metadataOverheadTiB: 0,
    effectiveCapacityTiB: 0,
    safeUsableCapacityTiB: 0,
    raidScheme: 'Pass-through',
  }
}

/** FC/NFS external pool: reconcile workload demand against available pool capacity. */
function calcExternalPoolCapacity(
  storageType: WorkloadCapacityInputs['storageType'],
  workloadStorageRequiredTiB: number,
  externalStorageUsableTiB: number | undefined,
): WorkloadCapacityResult {
  const availablePoolTiB = externalStorageUsableTiB ?? 0
  // Each site (stretch) or the single array must hold the full workload data.
  const requiredPoolTiB = workloadStorageRequiredTiB
  const poolShortfallTiB = Math.max(
    0,
    new Decimal(requiredPoolTiB).minus(availablePoolTiB).toNumber(),
  )
  return {
    storageType,
    ...emptyStack(),
    rawCapacityTiB: availablePoolTiB,
    usableAfterRaidTiB: availablePoolTiB,
    effectiveCapacityTiB: availablePoolTiB,
    safeUsableCapacityTiB: availablePoolTiB,
    workloadStorageRequiredTiB,
    requiredPoolTiB,
    availablePoolTiB,
    poolShortfallTiB,
    poolSufficient: poolShortfallTiB === 0,
  }
}

/** vSAN Max: compute nodes carry no local storage; capacity is a separate cluster. */
function calcVsanMaxPassthrough(
  hostsPerSite: number,
  hostStorageTiB: number,
): WorkloadCapacityResult {
  const raw = new Decimal(hostsPerSite).times(hostStorageTiB).toNumber()
  return {
    storageType: 'vsan-max',
    ...emptyStack(),
    rawCapacityTiB: raw,
    usableAfterRaidTiB: raw,
    effectiveCapacityTiB: raw,
    safeUsableCapacityTiB: raw,
    raidScheme: 'Pass-through (vSAN Max compute)',
    workloadStorageRequiredTiB: 0,
    requiredPoolTiB: 0,
    availablePoolTiB: 0,
    poolShortfallTiB: 0,
    poolSufficient: true,
  }
}

/** vSAN ESA full overhead stack. hostsPerSite is already per-site (no stretch halving). */
function calcVsanEsaCapacity(inputs: WorkloadCapacityInputs): WorkloadCapacityResult {
  const {
    hostStorageTiB,
    hostsPerSite,
    clusterCountPerSite,
    fttLevel,
    raidType,
    dedupEnabled,
    dedupRatio,
  } = inputs

  // RAID scheme is a per-CLUSTER property (2+1 vs 4+1 depends on hosts in a cluster).
  const hostsPerCluster =
    clusterCountPerSite > 0 ? Math.floor(hostsPerSite / clusterCountPerSite) : hostsPerSite
  const { multiplier: raidMultiplier, scheme: raidScheme } = vsanEsaRaidOverhead(
    hostsPerCluster,
    fttLevel,
    raidType,
  )

  const raw = new Decimal(hostsPerSite).times(hostStorageTiB)
  const rawForRaid = dedupEnabled ? raw.times(dedupRatio) : raw
  const usableAfterRaid = rawForRaid.dividedBy(raidMultiplier)
  const lfsOverheadTiB = usableAfterRaid.times(VSAN_LFS_OVERHEAD).toNumber()
  const usableAfterLfs = usableAfterRaid.times(1 - VSAN_LFS_OVERHEAD)
  const metadataOverheadTiB = raw.times(VSAN_METADATA_PCT).toNumber()
  const netUsable = usableAfterLfs.minus(metadataOverheadTiB)
  const safeUsableCapacityTiB = netUsable.times(VSAN_SAFE_SLACK).toNumber()

  return {
    storageType: 'vsan-esa',
    rawCapacityTiB: raw.toNumber(),
    raidMultiplier,
    usableAfterRaidTiB: usableAfterRaid.toNumber(),
    lfsOverheadTiB,
    metadataOverheadTiB,
    effectiveCapacityTiB: netUsable.toNumber(),
    safeUsableCapacityTiB,
    raidScheme,
    workloadStorageRequiredTiB: 0, // vSAN ESA: demand drives host count via minHostsForStorage, not this field
    requiredPoolTiB: 0, // vSAN demand is satisfied via the storage-driven host minimum, not a pool
    availablePoolTiB: 0,
    poolShortfallTiB: 0,
    poolSufficient: true,
  }
}

export function calcWorkloadCapacity(inputs: WorkloadCapacityInputs): WorkloadCapacityResult {
  const workloadStorageRequiredTiB = calcWorkloadStorageTiB(inputs.vmCount, inputs.avgStorageGbPerVm)
  switch (inputs.storageType) {
    case 'fc':
    case 'nfs':
      return calcExternalPoolCapacity(
        inputs.storageType,
        workloadStorageRequiredTiB,
        inputs.externalStorageUsableTiB,
      )
    case 'vsan-max':
      return calcVsanMaxPassthrough(inputs.hostsPerSite, inputs.hostStorageTiB)
    case 'vsan-esa':
      return calcVsanEsaCapacity(inputs)
    default: {
      const _exhaustive: never = inputs.storageType
      throw new Error(`Unhandled storageType: ${_exhaustive}`)
    }
  }
}
