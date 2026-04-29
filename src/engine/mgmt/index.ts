// VCF 9.x Management Domain — public barrel + orchestrator
//
// P1 surface: types + sizing tables + profiles.
// P2 surface (this commit): adds calcManagementFull(config, wlds) — the
// full pipeline that consumes profiles + constants + appliances/storage/
// host-math/validation modules to produce a complete MgmtDomainResult.
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5

export type {
  MgmtProfile,
  ApplianceSize,
  NsxEdgeSize,
  SspSize,
  SrmSize,
  CollectorSize,
  AnyApplianceSize,
  MgmtApplianceCategory,
  AutoApplianceCategory,
  ApplianceLineCategory,
  ApplianceSpec,
  ProfileEntry,
  ApplianceOverride,
  ValidatedSolutionsConfig,
  ManagementDomainConfig,
  ApplianceLine,
  MgmtDomainResult,
} from './types'

export {
  getApplianceSpec,
  SDDC_MANAGER_SPEC,
  FLEET_MANAGER_SPEC,
  VALIDATED_SOLUTIONS_SPECS,
} from './constants'

export {
  PROFILES,
  resolveProfileEntry,
} from './profiles'

// ─── Orchestrator (P2) ────────────────────────────────────────────────────

import { calcAppliances, calcValidatedSolutions } from './appliances'
import { calcWldOverhead } from './wldOverhead'
import { mgmtStorageDemand } from './storage'
import { perHostRequirements } from './hostMath'
import { validateMgmt } from './validation'
import { calcMinHostsForVsanEsa } from '../storage'
import type { ManagementDomainConfig, MgmtDomainResult, ValidatedSolutionsConfig } from './types'
import type { WorkloadDomainConfig } from '../types'

const DEPLOYMENT_FLOOR = { simple: 4, ha: 4, stretch: 8 } as const

const DEFAULT_VALIDATED_SOLUTIONS: ValidatedSolutionsConfig = {
  siteProtection: { included: false },
  ransomwareOnPrem: { included: false },
  ransomwareCloud: { included: false },
  crossCloudMobility: { included: false },
}

/**
 * Run the full management-domain calculation pipeline.
 *
 * Steps (per spec §5):
 *   1-3. Resolve appliances (profile + overrides + HA fanout) + WLD overhead
 *        + validated solutions.
 *   4.   Sum totals (cores, RAM, disk).
 *   5.   Compute storage demand (FTT × reserve × growth).
 *   6.   Compute per-host requirements (N-1 model, dual oversubscription).
 *   7.   Compute recommendedHostCount = max(minHostsCpu, minHostsRam,
 *        minHostsStorage, deploymentFloor).
 *   8.   Run validation rules; attach warnings.
 */
export function calcManagementFull(
  config: ManagementDomainConfig,
  wlds: readonly WorkloadDomainConfig[],
): MgmtDomainResult {
  // Step 1-3: appliance resolution
  const baseAppliances = calcAppliances(config)
  const validatedLines = calcValidatedSolutions(
    config.validatedSolutions ?? DEFAULT_VALIDATED_SOLUTIONS,
    config.deploymentMode,
  )
  const appliances = [...baseAppliances, ...validatedLines]
  const wldOverhead = calcWldOverhead(wlds)

  // Step 4: totals
  const allLines = [...appliances, ...wldOverhead]
  const totalCores = allLines.reduce((s, l) => s + l.totalCores, 0)
  const totalRamGB = allLines.reduce((s, l) => s + l.totalRamGB, 0)
  const totalDiskGB = allLines.reduce((s, l) => s + l.totalDiskGB, 0)
  const totalSwapGB = totalRamGB

  // Step 5: storage demand
  const storage = mgmtStorageDemand({
    totalDiskGB,
    totalRamGB,
    storageType: config.storageType ?? 'vsan-esa',
    reservePct: config.reservePct ?? 30,
    growthPct: config.growthPct ?? 10,
  })

  // Step 6: per-host requirements (preliminary, with floor host count)
  const coresPerHost = config.coresPerSocket * config.socketsPerHost
  const ramPerHost = config.hostRamGB
  const perHost = perHostRequirements({
    totalCores,
    totalRamGB,
    storageDemandGB: storage.storageDemandGB,
    storageDemandTiB: storage.storageDemandTiB,
    hosts: 4,
    cpuOversubscription: config.cpuOversubscription ?? 2,
    ramOversubscription: config.ramOversubscription ?? 1,
    storageType: config.storageType ?? 'vsan-esa',
    coresPerHost,
    ramPerHost,
  })

  // Step 7: recommendedHostCount
  let minHostsForStorage = 0
  if ((config.storageType ?? 'vsan-esa') === 'vsan-esa') {
    minHostsForStorage = calcMinHostsForVsanEsa(
      config.hostStorageTiB,
      1,             // FTT level — mgmt domain default
      'raid5',       // RAID type — mgmt domain default
      false,         // dedup — mgmt domain default
      1,             // dedupRatio — mgmt domain default
      config.deploymentMode,
      storage.storageDemandTiB,
    )
  }
  const floor = DEPLOYMENT_FLOOR[config.deploymentMode]
  const recommendedHostCount = Math.max(
    perHost.minHostsForCpu,
    perHost.minHostsForRam,
    minHostsForStorage,
    floor,
  )

  // Recompute per-host using the actual recommended host count
  const perHostFinal = perHostRequirements({
    totalCores,
    totalRamGB,
    storageDemandGB: storage.storageDemandGB,
    storageDemandTiB: storage.storageDemandTiB,
    hosts: recommendedHostCount,
    cpuOversubscription: config.cpuOversubscription ?? 2,
    ramOversubscription: config.ramOversubscription ?? 1,
    storageType: config.storageType ?? 'vsan-esa',
  })

  // Build draft result, run validation
  const draft: MgmtDomainResult = {
    appliances,
    wldOverhead,
    totalCores,
    totalRamGB,
    totalDiskGB,
    totalSwapGB,
    perHostCores: perHostFinal.perHostCores,
    perHostRamGB: perHostFinal.perHostRamGB,
    perHostStorageGB: perHostFinal.perHostStorageGB,
    storageDemandTiB: storage.storageDemandTiB,
    minHostsForStorage,
    externalPoolRequiredTiB: perHostFinal.externalPoolRequiredTiB,
    recommendedHostCount,
    validationWarnings: [],
  }

  return {
    ...draft,
    validationWarnings: validateMgmt(config, draft),
  }
}
