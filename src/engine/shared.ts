// VCF 9.x Engine — shared pure helpers
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)

import Decimal from 'decimal.js'

/**
 * Workload storage demand in TiB = vmCount × avgStorageGbPerVm / 1024.
 *
 * Single source of truth — previously duplicated in storage.ts, stretch.ts and
 * calculationStore.ts (DRY). All arithmetic via Decimal.js (PITFALLS #1).
 */
export const calcWorkloadStorageTiB = (vmCount: number, avgStorageGbPerVm: number): number =>
  new Decimal(vmCount).times(avgStorageGbPerVm).dividedBy(1024).toNumber()
