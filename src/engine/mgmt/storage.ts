// VCF 9.x Management Domain — storage demand
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All arithmetic uses Decimal.js to avoid IEEE 754 drift (PITFALLS #1)
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 step 5

import Decimal from 'decimal.js'
import type { StorageType } from '../types'

export interface StorageDemandInputs {
  totalDiskGB: number       // sum of all appliance disk
  totalRamGB: number        // sum of all appliance RAM (= swap demand)
  storageType: StorageType
  reservePct: number        // ≥ 0 (e.g. 30 for 30%)
  growthPct: number         // ≥ 0 (e.g. 10 for 10%)
}

export interface StorageDemandResult {
  diskAndSwapGB: number     // totalDiskGB + totalRamGB (swap = RAM)
  swapGB: number            // = totalRamGB; surfaced for reporting
  rawDemandGB: number       // diskAndSwapGB × FTT-multiplier
  withReserveGB: number     // rawDemandGB × (1 + reservePct/100)
  storageDemandGB: number   // withReserveGB × (1 + growthPct/100)
  storageDemandTiB: number  // storageDemandGB / 1024
  fttMultiplier: number     // for diagnostics / explainers
  // Logical demand WITHOUT the FTT multiplier (reserve + growth retained).
  // vSAN ESA host sizing must consume this, not storageDemandTiB:
  // calcMinHostsForVsanEsa() already applies RAID protection internally, so
  // pre-multiplying by the FTT factor here would double-count it. For FC/NFS
  // (fttMultiplier = 1) this equals storageDemandTiB.
  demandBeforeFttTiB: number
}

function fttMultiplierFor(storageType: StorageType): number {
  switch (storageType) {
    case 'vsan-esa':
    case 'vsan-max':
      return 1.5    // ESA-class architecture
    case 'fc':
    case 'nfs':
      return 1      // array handles redundancy
    default: {
      const _exhaustive: never = storageType
      throw new Error(`Unhandled storageType: ${_exhaustive as string}`)
    }
  }
}

export function mgmtStorageDemand(inputs: StorageDemandInputs): StorageDemandResult {
  if (inputs.reservePct < 0) {
    throw new Error(`reservePct must be ≥ 0, got ${inputs.reservePct}`)
  }
  if (inputs.growthPct < 0) {
    throw new Error(`growthPct must be ≥ 0, got ${inputs.growthPct}`)
  }

  const swapGB = inputs.totalRamGB
  const diskAndSwapGB = inputs.totalDiskGB + swapGB

  const fttMultiplier = fttMultiplierFor(inputs.storageType)
  const rawDemandGB = new Decimal(diskAndSwapGB).times(fttMultiplier).toNumber()
  const withReserveGB = new Decimal(rawDemandGB).times(1 + inputs.reservePct / 100).toNumber()
  const storageDemandGB = new Decimal(withReserveGB).times(1 + inputs.growthPct / 100).toNumber()
  const storageDemandTiB = new Decimal(storageDemandGB).div(1024).toNumber()

  // Logical demand: same reserve + growth, but WITHOUT the FTT multiplier.
  const demandBeforeFttTiB = new Decimal(diskAndSwapGB)
    .times(1 + inputs.reservePct / 100)
    .times(1 + inputs.growthPct / 100)
    .div(1024)
    .toNumber()

  return {
    diskAndSwapGB,
    swapGB,
    rawDemandGB,
    withReserveGB,
    storageDemandGB,
    storageDemandTiB,
    fttMultiplier,
    demandBeforeFttTiB,
  }
}
