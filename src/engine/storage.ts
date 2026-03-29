// VCF 9.x Storage Engine — vSAN ESA + FC/NFS
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// Ported from raidy with Decimal.js substitution for all arithmetic (PITFALLS #1)
// vSAN ESA Adaptive RAID-5 thresholds from CONTEXT.md / PITFALLS #2

import Decimal from 'decimal.js'
import type { StorageInputs, StorageResult, FttLevel, RaidType } from './types'

// ─── vSAN ESA Adaptive RAID-5 constants ────────────────────────────────────
// Source: Duncan Epping Yellow Bricks Jan 2024 ESA post + Broadcom KB 405876
// CRITICAL: Use HOST COUNT threshold (not drive count — that was raidy's OSA approach)
// 3–5 hosts: 2+1 scheme (1.5× overhead)
// 6+ hosts:  4+1 scheme (1.25× overhead)

export const VSAN_LFS_OVERHEAD = 0.13 // LFS ~13% of usable data written (STOR-03)
export const VSAN_METADATA_PCT = 0.10 // Global metadata pool ~10% of raw cluster capacity
export const VSAN_SAFE_SLACK = 0.70 // Reserve 30% slack for performance; keep 70% net usable

// ─── vsanEsaRaidOverhead ───────────────────────────────────────────────────

interface RaidOverheadResult {
  multiplier: number
  scheme: string
  minHostsRequired: number
}

/**
 * Returns the vSAN ESA RAID overhead multiplier and scheme description.
 *
 * Uses the HOST-COUNT gate (from CONTEXT.md / REQUIREMENTS.md) NOT raidy's drive-count gate.
 * RAID-5 Adaptive:
 *   - 3–5 hosts: 2+1 scheme → multiplier 1.5 (FTT=1)
 *   - 6+ hosts:  4+1 scheme → multiplier 1.25 (FTT=1)
 */
export function vsanEsaRaidOverhead(
  hostCount: number,
  fttLevel: FttLevel,
  raidType: RaidType
): RaidOverheadResult {
  if (raidType === 'raid1') {
    // RAID-1 (mirroring): multiplier = FTT + 1
    // FTT=1: 2 copies → 2.0x (min 3 hosts)
    // FTT=2: 3 copies → 3.0x (min 5 hosts)
    if (fttLevel === 1) {
      return { multiplier: 2.0, scheme: 'RAID-1 FTT=1 (2 copies)', minHostsRequired: 3 }
    } else {
      return { multiplier: 3.0, scheme: 'RAID-1 FTT=2 (3 copies)', minHostsRequired: 5 }
    }
  }

  if (raidType === 'raid5') {
    // ESA Adaptive RAID-5: host count determines the scheme
    // 3–5 hosts → 2+1 (1.5x); 6+ hosts → 4+1 (1.25x)
    if (hostCount >= 6) {
      return { multiplier: 1.25, scheme: '4+1 (FTT=1 RAID-5)', minHostsRequired: 6 }
    } else {
      return { multiplier: 1.5, scheme: '2+1 (FTT=1 RAID-5)', minHostsRequired: 4 }
    }
  }

  if (raidType === 'raid6') {
    // RAID-6 (4+2): FTT=2 → 1.5x overhead (min 6 hosts)
    return { multiplier: 1.5, scheme: 'RAID-6 FTT=2 (4+2)', minHostsRequired: 6 }
  }

  // Fallback (should not reach here with correct type)
  return { multiplier: 2.0, scheme: 'Unknown RAID', minHostsRequired: 3 }
}

// ─── calcStorage ───────────────────────────────────────────────────────────

/**
 * Calculate vSAN ESA storage capacity after full overhead stack, OR pass-through for FC/NFS.
 *
 * vSAN ESA overhead stack (STOR-03, from CONTEXT.md):
 *   Step 1: rawForRaid = rawCapacityTB × dedupRatio (if dedup enabled), else rawCapacityTB
 *   Step 2: usableAfterRaid = rawForRaid / raidMultiplier
 *   Step 3: usableAfterLfs = usableAfterRaid × (1 - 0.13)  [LFS ~13%]
 *   Step 4: metadataPool = rawCapacityTB × 0.10             [metadata ~10% of raw]
 *   Step 5: netUsable = usableAfterLfs - metadataPool
 *   Step 6: safeUsable = netUsable × 0.70                  [30% slack reserve]
 *
 * FC/NFS: raw capacity pass-through — no RAID/LFS/metadata overhead (STOR-07)
 */
export function calcStorage(inputs: StorageInputs): StorageResult {
  const {
    storageType,
    hostCount,
    hostStorageTB,
    fttLevel,
    raidType,
    dedupEnabled,
    dedupRatio,
    deploymentMode = 'simple',
  } = inputs

  const rawCapacityTB = new Decimal(hostCount).times(hostStorageTB).toNumber()

  switch (storageType) {
    case 'fc':
    case 'nfs':
      // FC and NFS: pass-through (no vSAN overhead)
      return {
        rawCapacityTB,
        raidMultiplier: 1,
        usableAfterRaidTB: rawCapacityTB,
        lfsOverheadTB: 0,
        metadataOverheadTB: 0,
        usableBeforeDedupTB: rawCapacityTB,
        effectiveCapacityTB: rawCapacityTB,
        safeUsableCapacityTB: rawCapacityTB,
        raidScheme: 'Pass-through',
        minHostsRequired: 0,
      }

    case 'vsan-max':
      // vSAN Max: compute nodes have no vSAN storage — pass-through
      // Storage cluster sizing is handled separately by calcVsanMax()
      return {
        rawCapacityTB,
        raidMultiplier: 1,
        usableAfterRaidTB: rawCapacityTB,
        lfsOverheadTB: 0,
        metadataOverheadTB: 0,
        usableBeforeDedupTB: rawCapacityTB,
        effectiveCapacityTB: rawCapacityTB,
        safeUsableCapacityTB: rawCapacityTB,
        raidScheme: 'Pass-through (vSAN Max compute)',
        minHostsRequired: 0,
      }

    case 'vsan-esa': {
      // vSAN ESA path
      const raidInfo = vsanEsaRaidOverhead(hostCount, fttLevel, raidType)
      const { multiplier: raidMultiplier, scheme: raidScheme, minHostsRequired } = raidInfo

      const rawDecimal = new Decimal(rawCapacityTB)

      // Step 1: Apply dedup to input data before RAID overhead calculation
      const rawForRaid = dedupEnabled ? rawDecimal.times(dedupRatio) : rawDecimal

      // Step 2: Apply RAID overhead
      const usableAfterRaidTB = rawForRaid.dividedBy(raidMultiplier).toNumber()

      // Step 3: Apply LFS overhead (~13%)
      const usableAfterLfsTB = new Decimal(usableAfterRaidTB).times(1 - VSAN_LFS_OVERHEAD)
      const lfsOverheadTB = new Decimal(usableAfterRaidTB)
        .times(VSAN_LFS_OVERHEAD)
        .toNumber()

      // Step 4: Global metadata pool (~10% of raw cluster capacity)
      const metadataOverheadTB = rawDecimal.times(VSAN_METADATA_PCT).toNumber()

      // Step 5: Net usable
      const netUsableTB = usableAfterLfsTB.minus(metadataOverheadTB)

      // Stretch PFTT=1: site mirroring means all data exists on both sites.
      // Only per-site capacity is "net usable" — the other copy is redundancy overhead.
      // Halve effective/safe usable to reflect this. Raw and RAID numbers remain full-cluster.
      const stretchMirroringFactor = deploymentMode === 'stretch' ? 0.5 : 1.0

      // The usableBeforeDedupTB represents usable before dedup benefit is applied to effective result
      const usableBeforeDedupTB = usableAfterLfsTB
        .minus(metadataOverheadTB)
        .times(stretchMirroringFactor)
        .toNumber()

      // Effective capacity (same as netUsable when no separate dedup boost)
      const effectiveCapacityTB = netUsableTB.times(stretchMirroringFactor).toNumber()

      // Step 6: Safe usable (keep 70%, reserve 30% slack)
      const safeUsableCapacityTB = netUsableTB
        .times(VSAN_SAFE_SLACK)
        .times(stretchMirroringFactor)
        .toNumber()

      return {
        rawCapacityTB,
        raidMultiplier,
        usableAfterRaidTB,
        lfsOverheadTB,
        metadataOverheadTB,
        usableBeforeDedupTB,
        effectiveCapacityTB,
        safeUsableCapacityTB,
        raidScheme,
        minHostsRequired,
      }
    }

    default: {
      const _exhaustive: never = storageType
      throw new Error(`Unhandled storageType: ${_exhaustive}`)
    }
  }
}
