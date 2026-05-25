// VCF 9.x Management Domain — appliance resolution
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// Walks all 15 user-overridable categories: profile default → merge override
// → apply HA fanout (×3 for nsxManager/vrops/automation/vrli/vcfmsControl/
//   vcfmsWorker in HA/Stretch)
// → multiply per-node specs by nodeCount → emit ApplianceLine.
// Always-on: SDDC Manager + Fleet Manager.
// Validated solutions handled by calcValidatedSolutions().
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §5 steps 1 + 3

import {
  getApplianceSpec,
  SDDC_MANAGER_SPEC,
  FLEET_MANAGER_SPEC,
  VALIDATED_SOLUTIONS_SPECS,
} from './constants'
import { resolveProfileEntry } from './profiles'
import type {
  ManagementDomainConfig,
  ApplianceLine,
  ApplianceLineCategory,
  MgmtApplianceCategory,
  ApplianceOverride,
  ProfileEntry,
  ApplianceSpec,
  ValidatedSolutionsConfig,
  SrmSize,
} from './types'
import type { DeploymentMode } from '../types'

const HA_FANOUT_CATEGORIES: ReadonlySet<MgmtApplianceCategory> = new Set<MgmtApplianceCategory>([
  'nsxManager',
  'vrops',
  'automation',
  'vrli',
  // VCF Management Services runtime (9.1): both control + worker tiers run as
  // 3-node clusters under HA/stretch, same fan-out pattern as NSX Manager/vROps.
  'vcfmsControl',
  'vcfmsWorker',
])

const ALL_CATEGORIES: readonly MgmtApplianceCategory[] = [
  'vcenter', 'nsxManager', 'nsxEdge', 'aviLb',
  'vrops', 'vropsCollector', 'vrli', 'vrni', 'vrniCollector',
  'automation', 'fleetManager', 'identityBroker', 'ssp',
  'vcfmsControl', 'vcfmsWorker',
]

function applyHaFanout(
  category: MgmtApplianceCategory,
  baseNodeCount: number,
  mode: DeploymentMode,
): number {
  if (HA_FANOUT_CATEGORIES.has(category) && (mode === 'ha' || mode === 'stretch')) {
    return baseNodeCount * 3
  }
  return baseNodeCount
}

function mergeOverride(base: ProfileEntry, ovr: ApplianceOverride | undefined): ProfileEntry {
  if (!ovr) return base
  return {
    included: ovr.included ?? base.included,
    size: ovr.size ?? base.size,
    nodeCount: ovr.nodeCount ?? base.nodeCount,
  }
}

function buildLine(
  category: ApplianceLineCategory,
  spec: ApplianceSpec,
  nodeCount: number,
  source: ApplianceLine['source'],
): ApplianceLine {
  return {
    category,
    nodeCount,
    cores: spec.cores,
    ramGB: spec.ramGB,
    diskGB: spec.diskGB,
    totalCores: spec.cores * nodeCount,
    totalRamGB: spec.ramGB * nodeCount,
    totalDiskGB: spec.diskGB * nodeCount,
    source,
  }
}

export function calcAppliances(config: ManagementDomainConfig): ApplianceLine[] {
  const profile = config.profile ?? 'standard'
  const mode = config.deploymentMode
  const overrides = config.overrides ?? {}

  const lines: ApplianceLine[] = []

  // Always-on: SDDC Manager
  lines.push(buildLine('sddcManager', SDDC_MANAGER_SPEC, 1, 'profile'))

  // 15 user-overridable categories. Fleet Manager is special (no size variants).
  for (const category of ALL_CATEGORIES) {
    const base = resolveProfileEntry(profile, category)
    const ovr = overrides[category]
    const merged = mergeOverride(base, ovr)
    if (!merged.included) continue

    // Fleet Manager is a singleton — skip HA fanout (MGMT-04 invariant).
    const nodeCount = category === 'fleetManager'
      ? merged.nodeCount
      : applyHaFanout(category, merged.nodeCount, mode)
    const wasOverridden = ovr !== undefined && Object.keys(ovr).length > 0

    if (category === 'fleetManager') {
      lines.push(buildLine(category, FLEET_MANAGER_SPEC, nodeCount, wasOverridden ? 'override' : 'profile'))
      continue
    }

    const spec = getApplianceSpec(category, merged.size)
    lines.push(buildLine(category, spec, nodeCount, wasOverridden ? 'override' : 'profile'))
  }

  return lines
}

export function calcValidatedSolutions(
  config: ValidatedSolutionsConfig,
  _mode: DeploymentMode,
): ApplianceLine[] {
  const lines: ApplianceLine[] = []

  if (config.siteProtection.included) {
    const size: SrmSize = config.siteProtection.mgmtSize ?? 'standard'
    const spec = VALIDATED_SOLUTIONS_SPECS.siteProtection[size]
    lines.push(buildLine('siteRecovery', spec, 1, 'validated-solution'))
  }
  if (config.ransomwareOnPrem.included) {
    lines.push(buildLine('ransomwareOnPrem', VALIDATED_SOLUTIONS_SPECS.ransomwareOnPrem, 1, 'validated-solution'))
  }
  if (config.ransomwareCloud.included) {
    lines.push(buildLine('ransomwareCloud', VALIDATED_SOLUTIONS_SPECS.ransomwareCloud, 1, 'validated-solution'))
  }
  if (config.crossCloudMobility.included) {
    lines.push(buildLine('crossCloudMobility', VALIDATED_SOLUTIONS_SPECS.crossCloudMobility, 1, 'validated-solution'))
  }

  return lines
}
