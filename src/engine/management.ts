// VCF 9.x Management Domain Sizing Engine
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// All arithmetic uses Decimal.js to avoid IEEE 754 float errors (PITFALLS #1)

import Decimal from 'decimal.js'
import type { DeploymentMode, MgmtDomainResult } from './types'

// ─── Management Domain Constants (LOCKED from CONTEXT.md) ──────────────────
// Source: Broadcom TechDocs VCF 9.x + williamlam.com lab data
// DO NOT change these values without updating the spec and requirements.

const HA_MULTIPLIER = 3

const VCENTER = { cores: 4, ramGB: 21 } // ×1 always (MGMT-01)
const SDDC = { cores: 4, ramGB: 16 } // ×1 always (MGMT-02)
const NSX = { cores: 6, ramGB: 24 } // ×1 Simple, ×3 HA/Stretch (MGMT-03)
const OPS = { cores: 4, ramGB: 16 } // ×1 Simple, ×3 HA/Stretch (MGMT-04)
const FLEET = { cores: 4, ramGB: 12 } // ×1 ALWAYS — MGMT-04 singleton, NOT HA scaled
const COLLECTOR = { cores: 4, ramGB: 16 } // ×1 ALWAYS — MGMT-04 singleton, NOT HA scaled
const AUTOMATION = { cores: 24, ramGB: 96 } // ×1 Simple, ×3 HA/Stretch (MGMT-05)

// ─── calcManagement ────────────────────────────────────────────────────────

/**
 * Calculate VCF 9.x management domain resource requirements.
 *
 * MGMT-04 note: Fleet Manager (12 GB) and Collector (16 GB) are SINGLETONS.
 * They are NOT scaled with the HA multiplier. Only OPS (4 vCPU / 16 GB),
 * NSX, and AUTOMATION scale ×3 in HA/Stretch mode.
 *
 * Simple totals: 50 vCPU / 201 GB RAM
 * HA totals:    118 vCPU / 473 GB RAM
 */
export function calcManagement(mode: DeploymentMode): MgmtDomainResult {
  const isHA = mode === 'ha' || mode === 'stretch'
  const multi = isHA ? HA_MULTIPLIER : 1

  // Components with fixed count (×1 always)
  const vcenterCores = VCENTER.cores
  const vcenterRamGB = VCENTER.ramGB
  const sddcCores = SDDC.cores
  const sddcRamGB = SDDC.ramGB

  // NSX: scales with HA multiplier
  const nsxCores = new Decimal(NSX.cores).times(multi).toNumber()
  const nsxRamGB = new Decimal(NSX.ramGB).times(multi).toNumber()

  // OPS group: OPS scales with HA; Fleet + Collector are ×1 ALWAYS (MGMT-04)
  const opsCores = new Decimal(OPS.cores)
    .times(multi)
    .plus(FLEET.cores)
    .plus(COLLECTOR.cores)
    .toNumber()
  const opsRamGB = new Decimal(OPS.ramGB)
    .times(multi)
    .plus(FLEET.ramGB)
    .plus(COLLECTOR.ramGB)
    .toNumber()

  // VCF Automation: scales with HA multiplier
  const automationCores = new Decimal(AUTOMATION.cores).times(multi).toNumber()
  const automationRamGB = new Decimal(AUTOMATION.ramGB).times(multi).toNumber()

  // Totals
  const totalCores = new Decimal(vcenterCores)
    .plus(sddcCores)
    .plus(nsxCores)
    .plus(opsCores)
    .plus(automationCores)
    .toNumber()

  const totalRamGB = new Decimal(vcenterRamGB)
    .plus(sddcRamGB)
    .plus(nsxRamGB)
    .plus(opsRamGB)
    .plus(automationRamGB)
    .toNumber()

  return {
    // Legacy flat fields (preserved for backward compat with usePptxExport)
    vcenterCores,
    vcenterRamGB,
    sddcCores,
    sddcRamGB,
    nsxCores,
    nsxRamGB,
    opsCores,
    opsRamGB,
    automationCores,
    automationRamGB,
    totalCores,
    totalRamGB,
    // TODO(P2): the fields below are placeholder zeros / empty arrays.
    // The legacy calcManagement(mode) shim doesn't compute them — that's
    // the job of mgmt/index.ts in Phase 2. Callers consuming these
    // before P2 lands will see semantically-incorrect data (e.g.,
    // recommendedHostCount: 0). Spec: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §11 P2.
    appliances: [],
    wldOverhead: [],
    totalDiskGB: 0,
    totalSwapGB: totalRamGB,
    perHostCores: 0,
    perHostRamGB: 0,
    perHostStorageGB: 0,
    storageDemandTiB: 0,
    minHostsForStorage: 0,
    externalPoolRequiredTiB: 0,
    recommendedHostCount: 0,
    validationWarnings: [],
  }
}
