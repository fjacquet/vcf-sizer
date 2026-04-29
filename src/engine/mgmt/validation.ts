// VCF 9.x Management Domain — validation rules
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All messages use i18n keys, NEVER raw English (project convention)
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §8

import type { ManagementDomainConfig, MgmtDomainResult } from './types'
import type { ValidationWarning } from '../types'

export function validateMgmt(
  config: ManagementDomainConfig,
  result: MgmtDomainResult,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // MGMT-EDGE-PAIR
  const edge = result.appliances.find(l => l.category === 'nsxEdge')
  if (edge && edge.nodeCount < 2) {
    warnings.push({
      code: 'MGMT-EDGE-PAIR',
      severity: 'warning',
      messageKey: 'validation.mgmt.edgePairRequired',
    })
  }

  // MGMT-AVI-CLUSTER
  const avi = result.appliances.find(l => l.category === 'aviLb')
  if (avi && avi.nodeCount < 3) {
    warnings.push({
      code: 'MGMT-AVI-CLUSTER',
      severity: 'warning',
      messageKey: 'validation.mgmt.aviClusterRequired',
    })
  }

  // MGMT-SSP-HOSTS
  const ssp = result.appliances.find(l => l.category === 'ssp')
  if (ssp && result.recommendedHostCount < 8) {
    warnings.push({
      code: 'MGMT-SSP-HOSTS',
      severity: 'error',
      messageKey: 'validation.mgmt.sspMinHosts',
    })
  }

  // MGMT-OVERSUB-RANGE
  const cpuOver = config.cpuOversubscription ?? 2
  const ramOver = config.ramOversubscription ?? 1
  if (cpuOver > 4 || ramOver > 1.5) {
    warnings.push({
      code: 'MGMT-OVERSUB-RANGE',
      severity: 'warning',
      messageKey: 'validation.mgmt.oversubAggressive',
    })
  }

  // MGMT-RESERVE-RANGE
  const reserve = config.reservePct ?? 30
  if (reserve < 15 || reserve > 50) {
    warnings.push({
      code: 'MGMT-RESERVE-RANGE',
      severity: 'warning',
      messageKey: 'validation.mgmt.reserveOutOfRange',
    })
  }

  // MGMT-FC-NEEDS-POOL
  if ((config.storageType === 'fc' || config.storageType === 'nfs') &&
      config.externalStorageUsableTiB === undefined) {
    warnings.push({
      code: 'MGMT-FC-NEEDS-POOL',
      severity: 'error',
      messageKey: 'validation.mgmt.externalPoolRequired',
    })
  }

  // MGMT-VSANMAX-NODES
  if (config.storageType === 'vsan-max' &&
      (config.vsanMaxStorageNodes ?? 0) < 4) {
    warnings.push({
      code: 'MGMT-VSANMAX-NODES',
      severity: 'error',
      messageKey: 'validation.mgmt.vsanMaxMinNodes',
    })
  }

  // MGMT-VALIDATED-COUNT
  const vs = config.validatedSolutions
  const enabledCount = vs ? [
    vs.siteProtection.included,
    vs.ransomwareOnPrem.included,
    vs.ransomwareCloud.included,
    vs.crossCloudMobility.included,
  ].filter(Boolean).length : 0
  if (enabledCount >= 3) {
    warnings.push({
      code: 'MGMT-VALIDATED-COUNT',
      severity: 'warning',
      messageKey: 'validation.mgmt.validatedSolutionsHeavy',
    })
  }

  return warnings
}
