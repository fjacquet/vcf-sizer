// VCF 9.x Management Domain — per-host capacity math (N-1 model)
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All arithmetic uses Decimal.js to avoid IEEE 754 drift (PITFALLS #1)
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 step 6

import Decimal from 'decimal.js'
import type { StorageType } from '../types'

export interface PerHostInputs {
  totalCores: number
  totalRamGB: number
  storageDemandGB: number       // total mgmt storage demand (after FTT × reserve × growth)
  storageDemandTiB: number      // same value in TiB (for externalPoolRequiredTiB)
  hosts: number
  cpuOversubscription: number   // > 0
  ramOversubscription: number   // > 0
  storageType: StorageType
  coresPerHost?: number         // optional — drives minHostsForCpu when present
  ramPerHost?: number           // optional — drives minHostsForRam when present
}

export interface PerHostResult {
  perHostCores: number
  perHostRamGB: number
  perHostStorageGB: number      // 0 for fc/nfs/vsan-max
  externalPoolRequiredTiB: number   // > 0 only for fc/nfs
  minHostsForCpu: number        // 0 when coresPerHost not supplied
  minHostsForRam: number        // 0 when ramPerHost not supplied
}

export function perHostRequirements(inputs: PerHostInputs): PerHostResult {
  if (inputs.cpuOversubscription <= 0) {
    throw new Error(`cpuOversubscription must be > 0, got ${inputs.cpuOversubscription}`)
  }
  if (inputs.ramOversubscription <= 0) {
    throw new Error(`ramOversubscription must be > 0, got ${inputs.ramOversubscription}`)
  }

  const n = Math.max(inputs.hosts - 1, 1)

  const perHostCores = new Decimal(inputs.totalCores)
    .div(n)
    .div(inputs.cpuOversubscription)
    .ceil()
    .toNumber()
  const perHostRamGB = new Decimal(inputs.totalRamGB)
    .div(n)
    .div(inputs.ramOversubscription)
    .ceil()
    .toNumber()

  let perHostStorageGB = 0
  let externalPoolRequiredTiB = 0
  switch (inputs.storageType) {
    case 'vsan-esa':
      perHostStorageGB = new Decimal(inputs.storageDemandGB).div(n).ceil().toNumber()
      break
    case 'fc':
    case 'nfs':
      externalPoolRequiredTiB = inputs.storageDemandTiB
      break
    case 'vsan-max':
      // Compute hosts hold no local storage; demand is satisfied by the
      // disaggregated storage cluster, sized separately via calcVsanMax.
      break
    default: {
      const _exhaustive: never = inputs.storageType
      throw new Error(`Unhandled storageType: ${_exhaustive as string}`)
    }
  }

  const minHostsForCpu = inputs.coresPerHost !== undefined && inputs.coresPerHost > 0
    ? new Decimal(inputs.totalCores).div(inputs.coresPerHost).div(inputs.cpuOversubscription).ceil().toNumber()
    : 0
  const minHostsForRam = inputs.ramPerHost !== undefined && inputs.ramPerHost > 0
    ? new Decimal(inputs.totalRamGB).div(inputs.ramPerHost).div(inputs.ramOversubscription).ceil().toNumber()
    : 0

  return {
    perHostCores,
    perHostRamGB,
    perHostStorageGB,
    externalPoolRequiredTiB,
    minHostsForCpu,
    minHostsForRam,
  }
}
