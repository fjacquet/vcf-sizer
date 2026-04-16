// VCF 9.x Input Validation Engine
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// Returns ValidationWarning[] — i18n keys only, NO English strings

import type { ValidationWarning, ValidationInputs } from './types'

// ─── Validation constants ───────────────────────────────────────────────────
// VCFA requires minimum 12 physical cores per host (HOST-06, MGMT-07)
const VCFA_MIN_CORES_PER_HOST = 12

// Stretch Cluster requires minimum 3 data hosts per site (STRCH-01)
const STRETCH_MIN_HOSTS_PER_SITE = 3

// Dedicated management cluster requires minimum 4 hosts with vSAN (Broadcom KB 392993 — ARCH-01)
export const DEDICATED_MGMT_MIN_HOSTS = 4

// Stretch topology requires min 4 hosts per site × 2 sites = 8 total with vSAN (Broadcom KB 392993)
export const STRETCH_DEDICATED_MGMT_MIN_HOSTS = 8

// FC/NFS dedicated management — VCF 9.0 installer minimum (Broadcom KB 416270 — ARCH-01)
export const DEDICATED_MGMT_MIN_HOSTS_EXTERNAL = 2
export const STRETCH_DEDICATED_MGMT_MIN_HOSTS_EXTERNAL = 4

// Co-located management minimum hosts by storage type (ARCH-02)
const COLLOCATED_MIN_HOSTS_VSAN = 3
const COLLOCATED_MIN_HOSTS_FC_NFS = 2

// vSAN Max requires minimum 4 storage nodes (VMAX-03)
const VSAN_MAX_MIN_STORAGE_NODES = 4

// Global Dedup requires minimum 25 GbE network speed (STOR-05)
const DEDUP_MIN_NETWORK_SPEED_GBE = 25

// ─── validateInputs ────────────────────────────────────────────────────────

/**
 * Validate VCF 9.x sizing inputs and return a list of warnings/errors.
 * Returns ValidationWarning[] — codes are machine-readable, messageKey is i18n only.
 *
 * Rules:
 * 1. VCFA_MIN_CORES: coresPerSocket × socketsPerHost < 12 → error (HOST-06, MGMT-07)
 * 2. DEDUP_STRETCH_EXCLUSION: dedupEnabled && deploymentMode === 'stretch' → error
 */
export function validateInputs(inputs: ValidationInputs): ValidationWarning[] {
  const {
    deploymentMode,
    coresPerSocket,
    socketsPerHost,
    hostCount,
    dedupEnabled,
    storageType,
    preferredSiteHosts = 3,
    secondarySiteHosts = 3,
    managementArchitecture = 'colocated',
    managementStorageType = 'vsan-esa' as const,
    networkSpeedGbE = 25,
    vsanMaxStorageNodes = 4,
  } = inputs
  const errors: ValidationWarning[] = []

  // Rule 1: VCFA minimum cores blocker
  // VCFA (VCF Automation) requires minimum 12 physical cores per host.
  // Hard error — not a soft suggestion. Fires regardless of deployment mode.
  const totalCoresPerHost = coresPerSocket * socketsPerHost
  if (totalCoresPerHost < VCFA_MIN_CORES_PER_HOST) {
    errors.push({
      code: 'VCFA_MIN_CORES',
      severity: 'error',
      messageKey: 'validation.vcfaMinCores',
    })
  }

  // Rule 2: Global Deduplication is incompatible with Stretch Cluster mode.
  // vSAN ESA Global Dedup and Stretch Cluster are mutually exclusive in VCF 9.x.
  if (dedupEnabled && deploymentMode === 'stretch') {
    errors.push({
      code: 'DEDUP_STRETCH_EXCLUSION',
      severity: 'error',
      messageKey: 'validation.dedupStretchExclusion',
    })
  }

  // Dedup is only relevant for vSAN ESA — it is a no-op for FC/NFS.
  // If storageType is FC or NFS and dedup is somehow flagged, warn but don't block.
  if (dedupEnabled && storageType !== 'vsan-esa') {
    errors.push({
      code: 'DEDUP_NOT_APPLICABLE',
      severity: 'warning',
      messageKey: 'validation.dedupNotApplicable',
    })
  }

  // Rule 3: Stretch Cluster requires minimum 3 hosts per site (STRCH-01)
  if (deploymentMode === 'stretch') {
    if (preferredSiteHosts < STRETCH_MIN_HOSTS_PER_SITE || secondarySiteHosts < STRETCH_MIN_HOSTS_PER_SITE) {
      errors.push({
        code: 'STRETCH_MIN_HOSTS',
        severity: 'error',
        messageKey: 'validation.stretchMinHosts',
      })
    }
  }

  // Rule 4: DEDICATED_MGMT_MIN_HOSTS — ARCH-01
  // vSAN: min 4 hosts (simple/HA) / 8 (stretch) — Broadcom KB 392993
  // FC/NFS: min 2 hosts (simple/HA) / 4 (stretch) — VCF 9.0 installer, KB 416270
  if (managementArchitecture === 'dedicated') {
    const isExternal = managementStorageType === 'fc' || managementStorageType === 'nfs'
    const minHosts = deploymentMode === 'stretch'
      ? (isExternal ? STRETCH_DEDICATED_MGMT_MIN_HOSTS_EXTERNAL : STRETCH_DEDICATED_MGMT_MIN_HOSTS)
      : (isExternal ? DEDICATED_MGMT_MIN_HOSTS_EXTERNAL : DEDICATED_MGMT_MIN_HOSTS)
    if (hostCount < minHosts) {
      errors.push({
        code: 'DEDICATED_MGMT_MIN_HOSTS',
        severity: 'error',
        messageKey: isExternal
          ? 'validation.dedicatedMgmtMinHostsExternal'
          : 'validation.dedicatedMgmtMinHosts',
      })
    }
  }

  // Rule 5: COLLOCATED_MIN_HOSTS — ARCH-02
  // Co-located management requires minimum hosts depending on storage type
  if (managementArchitecture !== 'dedicated') {
    const minHosts = storageType === 'vsan-esa' ? COLLOCATED_MIN_HOSTS_VSAN : COLLOCATED_MIN_HOSTS_FC_NFS
    if (hostCount < minHosts) {
      errors.push({
        code: 'COLLOCATED_MIN_HOSTS',
        severity: 'warning',
        messageKey: 'validation.colocatedMinHosts',
      })
    }
  }

  // Rule 6: DEDUP_NETWORK_SPEED — STOR-05
  // Global Deduplication requires minimum 25 GbE network speed
  if (dedupEnabled && networkSpeedGbE < DEDUP_MIN_NETWORK_SPEED_GBE) {
    errors.push({
      code: 'DEDUP_NETWORK_SPEED',
      severity: 'warning',
      messageKey: 'validation.dedupNetworkSpeed',
    })
  }

  // Rule 7: VSAN_MAX_MIN_NODES — VMAX-03
  // vSAN Max storage cluster requires minimum 4 nodes
  if (storageType === 'vsan-max' && vsanMaxStorageNodes < VSAN_MAX_MIN_STORAGE_NODES) {
    errors.push({
      code: 'VSAN_MAX_MIN_NODES',
      severity: 'error',
      messageKey: 'validation.vsanMaxMinNodes',
    })
  }

  // Rule 8: VSAN_MAX_STRETCH_EXCLUSION — vSAN Max is a disaggregated storage topology
  // with a separate storage cluster and cannot be deployed in Stretch Cluster mode.
  // Belt-and-suspenders: UI disables the combo, but URL-state rehydration can bypass that.
  if (storageType === 'vsan-max' && deploymentMode === 'stretch') {
    errors.push({
      code: 'VSAN_MAX_STRETCH_EXCLUSION',
      severity: 'error',
      messageKey: 'validation.vsanMaxStretchExclusion',
    })
  }

  return errors
}
