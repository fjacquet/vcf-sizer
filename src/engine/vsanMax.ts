// VCF 9.x vSAN Max (Storage Clusters) Engine
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// vSAN Max uses disaggregated storage: storage cluster nodes are sized separately from compute nodes

import Decimal from 'decimal.js'
import type { VsanMaxInputs, VsanMaxResult, VsanMaxProfile } from './types'
import { vsanEsaRaidOverhead, VSAN_LFS_OVERHEAD, VSAN_METADATA_PCT, VSAN_SAFE_SLACK } from './storage'

export const READYNODE_PROFILES: Record<VsanMaxProfile, { rawTbPerNode: number; label: string }> = {
  xs:  { rawTbPerNode: 20,  label: 'XS — 20 TB/node' },
  sm:  { rawTbPerNode: 50,  label: 'SM — 50 TB/node' },
  med: { rawTbPerNode: 100, label: 'MED — 100 TB/node' },
  lrg: { rawTbPerNode: 150, label: 'LRG — 150 TB/node' },
  xl:  { rawTbPerNode: 200, label: 'XL — 200 TB/node' },
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

  // Raw capacity = nodes * TB per node
  const rawCapacityTB = new Decimal(storageNodeCount)
    .times(profileData.rawTbPerNode)
    .toNumber()

  // Use same RAID scheme as HCI ESA — call vsanEsaRaidOverhead with storageNodeCount
  // vSAN Max always uses RAID-5 FTT=1 (the adaptive scheme)
  const raidInfo = vsanEsaRaidOverhead(storageNodeCount, 1, 'raid5')

  const rawDecimal = new Decimal(rawCapacityTB)

  // Step 1: Apply RAID overhead
  const usableAfterRaidTB = rawDecimal.dividedBy(raidInfo.multiplier)

  // Step 2: Apply LFS overhead (~13%)
  const lfsOverheadTB = usableAfterRaidTB.times(VSAN_LFS_OVERHEAD)
  const usableAfterLfsTB = usableAfterRaidTB.minus(lfsOverheadTB)

  // Step 3: Global metadata pool (~10% of raw capacity)
  const metadataOverheadTB = rawDecimal.times(VSAN_METADATA_PCT)

  // Step 4: Net usable
  const netUsableTB = usableAfterLfsTB.minus(metadataOverheadTB)

  // Step 5: Safe usable (keep 70%, reserve 30% slack)
  const usableCapacityTB = netUsableTB.times(VSAN_SAFE_SLACK).toNumber()

  return {
    rawCapacityTB,
    usableCapacityTB,
    raidScheme: raidInfo.scheme,
    storageNodeCount,
    computeNodeCount,
    belowMinNodes,
  }
}
