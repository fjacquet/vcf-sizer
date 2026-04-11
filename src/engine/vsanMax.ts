// VCF 9.x vSAN Max (Storage Clusters) Engine
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// vSAN Max uses disaggregated storage: storage cluster nodes are sized separately from compute nodes

import Decimal from 'decimal.js'
import type { VsanMaxInputs, VsanMaxResult, VsanMaxProfile } from './types'
import { vsanEsaRaidOverhead, VSAN_LFS_OVERHEAD, VSAN_METADATA_PCT, VSAN_SAFE_SLACK } from './storage'

export const READYNODE_PROFILES: Record<VsanMaxProfile, { rawTibPerNode: number; label: string }> = {
  xs:  { rawTibPerNode: 20,  label: 'XS — 20 TiB/node' },
  sm:  { rawTibPerNode: 50,  label: 'SM — 50 TiB/node' },
  med: { rawTibPerNode: 100, label: 'MED — 100 TiB/node' },
  lrg: { rawTibPerNode: 150, label: 'LRG — 150 TiB/node' },
  xl:  { rawTibPerNode: 200, label: 'XL — 200 TiB/node' },
}

const VSAN_MAX_MIN_NODES = 4

/**
 * Calculate vSAN Max disaggregated storage cluster capacity.
 *
 * Uses the same adaptive RAID scheme as vSAN ESA HCI:
 *   - 4–5 nodes: 2+1 RAID-5 (1.5x overhead)
 *   - 6+ nodes:  4+1 RAID-5 (1.25x overhead)
 *
 * Applies full vSAN overhead stack: RAID + LFS + metadata + safe slack.
 * Minimum 4 storage nodes required (belowMinNodes=true when under threshold).
 */
export function calcVsanMax(inputs: VsanMaxInputs): VsanMaxResult {
  const { profile, storageNodeCount, computeNodeCount } = inputs
  const profileData = READYNODE_PROFILES[profile]
  const belowMinNodes = storageNodeCount < VSAN_MAX_MIN_NODES

  // Raw capacity = nodes * TiB per node
  const rawCapacityTiB = new Decimal(storageNodeCount)
    .times(profileData.rawTibPerNode)
    .toNumber()

  // Use same RAID scheme as HCI ESA — call vsanEsaRaidOverhead with storageNodeCount
  // vSAN Max always uses RAID-5 FTT=1 (the adaptive scheme)
  const raidInfo = vsanEsaRaidOverhead(storageNodeCount, 1, 'raid5')

  const rawDecimal = new Decimal(rawCapacityTiB)

  // Step 1: Apply RAID overhead
  const usableAfterRaidTiB = rawDecimal.dividedBy(raidInfo.multiplier)

  // Step 2: Apply LFS overhead (~13%)
  const lfsOverheadTiB = usableAfterRaidTiB.times(VSAN_LFS_OVERHEAD)
  const usableAfterLfsTiB = usableAfterRaidTiB.minus(lfsOverheadTiB)

  // Step 3: Global metadata pool (~10% of raw capacity)
  const metadataOverheadTiB = rawDecimal.times(VSAN_METADATA_PCT)

  // Step 4: Net usable
  const netUsableTiB = usableAfterLfsTiB.minus(metadataOverheadTiB)

  // Step 5: Safe usable (keep 70%, reserve 30% slack)
  const usableCapacityTiB = netUsableTiB.times(VSAN_SAFE_SLACK).toNumber()

  return {
    rawCapacityTiB,
    usableCapacityTiB,
    raidScheme: raidInfo.scheme,
    storageNodeCount,
    computeNodeCount,
    belowMinNodes,
  }
}
