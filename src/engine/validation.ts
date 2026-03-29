// VCF 9.x Input Validation Engine
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
// Returns ValidationWarning[] — i18n keys only, NO English strings

import type { ValidationWarning, ValidationInputs } from './types'

// ─── Validation constants ───────────────────────────────────────────────────
// VCFA requires minimum 12 physical cores per host (HOST-06, MGMT-07)
const VCFA_MIN_CORES_PER_HOST = 12

// Stretch Cluster requires minimum 3 data hosts per site (STRCH-01)
const STRETCH_MIN_HOSTS_PER_SITE = 3

// Dedicated management cluster requires minimum 4 hosts (Broadcom KB 392993 — ARCH-01)
const DEDICATED_MGMT_MIN_HOSTS = 4

// Co-located management minimum hosts by storage type (ARCH-02)
const COLLOCATED_MIN_HOSTS_VSAN = 3
const COLLOCATED_MIN_HOSTS_FC_NFS = 2

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
    managementArchitecture = 'shared',
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
  // Dedicated management cluster requires at least 4 hosts (Broadcom KB 392993)
  if (managementArchitecture === 'dedicated' && hostCount < DEDICATED_MGMT_MIN_HOSTS) {
    errors.push({
      code: 'DEDICATED_MGMT_MIN_HOSTS',
      severity: 'error',
      messageKey: 'validation.dedicatedMgmtMinHosts',
    })
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

  return errors
}
