// VCF 9.x Management Domain — legacy shim
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// This file maintains the legacy `calcManagement(mode: DeploymentMode)` API
// for callers that haven't migrated to `calcManagementFull(config, wlds)`.
// It builds a synthetic ManagementDomainConfig that reproduces the historical
// component set (vCenter Small, NSX Mgr Medium, vROps Small + Fleet + Collector,
// Automation Small) and delegates to the orchestrator.
//
// Migration plan: as P3 wires stores onto calcManagementFull directly, this
// shim becomes dead code and is deleted. The legacy flat fields on the result
// (vcenterCores, sddcCores, etc.) are populated from the new `appliances`
// array so usePptxExport.ts continues to compile during the transition.

import { calcManagementFull } from './mgmt'
import type { DeploymentMode, MgmtDomainResult } from './types'
import type { ManagementDomainConfig, ApplianceLine } from './mgmt/types'

function buildLegacyConfig(mode: DeploymentMode): ManagementDomainConfig {
  return {
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 8,
    deploymentMode: mode,
    profile: 'lab',
    overrides: {
      // Lab default excludes vROps Collector; legacy MGMT-04 invariant
      // requires it as a Small singleton (always nodeCount=1).
      vropsCollector: { included: true, size: 'small', nodeCount: 1 },
      // Lab profile uses NSX Mgr 'small', but constants.ts has no 'small'
      // size for NSX Manager — only medium/large/xlarge. Force medium.
      nsxManager: { size: 'medium' },
    },
    validatedSolutions: {
      siteProtection: { included: false },
      ransomwareOnPrem: { included: false },
      ransomwareCloud: { included: false },
      crossCloudMobility: { included: false },
    },
    cpuOversubscription: 2,
    ramOversubscription: 1,
    reservePct: 30,
    growthPct: 10,
    storageType: 'vsan-esa',
  }
}

function sumByCategory(lines: ApplianceLine[], categories: string[]): { cores: number; ramGB: number } {
  const matching = lines.filter(l => categories.includes(l.category as string))
  return {
    cores: matching.reduce((s, l) => s + l.totalCores, 0),
    ramGB: matching.reduce((s, l) => s + l.totalRamGB, 0),
  }
}

export function calcManagement(mode: DeploymentMode): MgmtDomainResult {
  const result = calcManagementFull(buildLegacyConfig(mode), [])

  // Populate legacy flat fields from the new appliances array so existing
  // consumers (usePptxExport.ts) keep working unchanged.
  const vcenter = sumByCategory(result.appliances, ['vcenter'])
  const sddc = sumByCategory(result.appliances, ['sddcManager'])
  const nsx = sumByCategory(result.appliances, ['nsxManager'])
  const ops = sumByCategory(result.appliances, ['vrops', 'vropsCollector', 'fleetManager'])
  const automation = sumByCategory(result.appliances, ['automation'])

  return {
    ...result,
    vcenterCores: vcenter.cores,
    vcenterRamGB: vcenter.ramGB,
    sddcCores: sddc.cores,
    sddcRamGB: sddc.ramGB,
    nsxCores: nsx.cores,
    nsxRamGB: nsx.ramGB,
    opsCores: ops.cores,
    opsRamGB: ops.ramGB,
    automationCores: automation.cores,
    automationRamGB: automation.ramGB,
  }
}
