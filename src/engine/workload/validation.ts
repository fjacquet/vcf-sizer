// VCF 9.1 Workload Sizing — validation rules
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// Warnings use i18n message KEYS, never English strings.

import type { ValidationWarning } from '../types'
import type { WorkloadCapacityResult, ClusterSplitResult } from './types'

export function validateWorkload(
  capacity: WorkloadCapacityResult,
  split: ClusterSplitResult,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // FC/NFS pool too small for the workload demand (previously silent).
  if (!capacity.poolSufficient) {
    warnings.push({
      code: 'FC_POOL_SHORTFALL',
      severity: 'error',
      messageKey: 'validation.fcPoolShortfall',
    })
  }

  // Demand exceeds a single cluster → the domain spans multiple clusters (informational).
  if (split.exceedsSingleCluster) {
    warnings.push({
      code: 'WORKLOAD_MULTI_CLUSTER',
      severity: 'warning',
      messageKey: 'validation.workloadMultiCluster',
    })
  }

  return warnings
}
