// VCF 9.x Management Domain — Profile preset mappings
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// Reference: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md
//   Q4 (Standard defaults) and Appendix B (full preset table).
//
// Note on nodeCount: profiles always set nodeCount=1 for components that
// fan out under HA (NSX Manager, vROps, VCF Automation, vRLI). The HA
// fan-out (×3) is applied later in `appliances.ts` (P2) based on the
// resolved deployment mode. Edge nodeCount=2 is hard-coded here because
// the pair count is independent of HA topology.

import type { MgmtProfile, MgmtApplianceCategory, ProfileEntry } from './types'

type ProfileMap = Record<MgmtApplianceCategory, ProfileEntry>

const LAB: ProfileMap = {
  vcenter:        { included: true,  size: 'small',  nodeCount: 1 },
  // NSX Manager has no 'small' size in the workbook (constants.ts only
  // defines medium/large/xlarge); medium is the smallest valid choice.
  nsxManager:     { included: true,  size: 'medium', nodeCount: 1 },
  nsxEdge:        { included: false, size: 'small',  nodeCount: 2 },
  aviLb:          { included: false, size: 'small',  nodeCount: 3 },
  vrops:          { included: true,  size: 'small',  nodeCount: 1 },
  vropsCollector: { included: false, size: 'small',  nodeCount: 1 },
  vrli:           { included: false, size: 'small',  nodeCount: 1 },
  vrni:           { included: false, size: 'medium', nodeCount: 1 },
  vrniCollector:  { included: false, size: 'medium', nodeCount: 1 },
  automation:     { included: true,  size: 'small',  nodeCount: 1 },
  fleetManager:   { included: true,  size: 'medium', nodeCount: 1 },
  identityBroker: { included: false, size: 'medium', nodeCount: 1 },
  ssp:            { included: false, size: 'medium', nodeCount: 1 },
}

const STANDARD: ProfileMap = {
  vcenter:        { included: true,  size: 'medium', nodeCount: 1 },
  nsxManager:     { included: true,  size: 'medium', nodeCount: 1 },
  nsxEdge:        { included: true,  size: 'large',  nodeCount: 2 },
  aviLb:          { included: true,  size: 'small',  nodeCount: 3 },
  vrops:          { included: true,  size: 'medium', nodeCount: 1 },
  vropsCollector: { included: false, size: 'standard', nodeCount: 1 },
  vrli:           { included: true,  size: 'medium', nodeCount: 1 },
  vrni:           { included: true,  size: 'medium', nodeCount: 1 },
  vrniCollector:  { included: false, size: 'medium', nodeCount: 1 },
  automation:     { included: true,  size: 'medium', nodeCount: 1 },
  fleetManager:   { included: true,  size: 'medium', nodeCount: 1 },
  identityBroker: { included: false, size: 'medium', nodeCount: 1 },
  ssp:            { included: false, size: 'medium', nodeCount: 1 },
}

const LARGE: ProfileMap = {
  vcenter:        { included: true,  size: 'large',  nodeCount: 1 },
  nsxManager:     { included: true,  size: 'large',  nodeCount: 1 },
  nsxEdge:        { included: true,  size: 'xlarge', nodeCount: 2 },
  aviLb:          { included: true,  size: 'large',  nodeCount: 3 },
  vrops:          { included: true,  size: 'large',  nodeCount: 1 },
  vropsCollector: { included: true,  size: 'standard', nodeCount: 1 },
  vrli:           { included: true,  size: 'large',  nodeCount: 1 },
  vrni:           { included: true,  size: 'medium', nodeCount: 1 },
  vrniCollector:  { included: true,  size: 'medium', nodeCount: 1 },
  automation:     { included: true,  size: 'large',  nodeCount: 1 },
  fleetManager:   { included: true,  size: 'medium', nodeCount: 1 },
  identityBroker: { included: true,  size: 'medium', nodeCount: 1 },
  ssp:            { included: false, size: 'medium', nodeCount: 1 },
}

export const PROFILES: Record<MgmtProfile, ProfileMap> = {
  lab: LAB,
  standard: STANDARD,
  large: LARGE,
}

/**
 * Resolve the per-category default ProfileEntry for a given profile.
 *
 * The result is the *base* default — overrides are merged on top by the
 * appliance resolver in P2, and HA-fanout (×3 for NSX Mgr, vROps, etc.)
 * is also applied there.
 */
export function resolveProfileEntry(
  profile: MgmtProfile,
  category: MgmtApplianceCategory,
): ProfileEntry {
  return PROFILES[profile][category]
}
