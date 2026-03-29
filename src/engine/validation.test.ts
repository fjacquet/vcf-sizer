/// <reference types="vitest/globals" />
import { validateInputs } from './validation'

describe('validateInputs — VCFA core blocker (MGMT-07, HOST-06)', () => {
  it('8 cores per socket × 1 socket = 8 cores → VCFA_MIN_CORES error', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 8,
      socketsPerHost: 1,
      hostCount: 4,
      dedupEnabled: false,
      storageType: 'vsan-esa',
    })
    expect(errors.some(e => e.code === 'VCFA_MIN_CORES' && e.severity === 'error')).toBe(true)
  })

  it('12 cores per socket × 1 socket = 12 cores → no VCFA_MIN_CORES error', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 12,
      socketsPerHost: 1,
      hostCount: 4,
      dedupEnabled: false,
      storageType: 'vsan-esa',
    })
    expect(errors.filter(e => e.code === 'VCFA_MIN_CORES').length).toBe(0)
  })

  it('6 cores per socket × 2 sockets = 12 cores → no VCFA_MIN_CORES error', () => {
    const errors = validateInputs({
      deploymentMode: 'simple',
      coresPerSocket: 6,
      socketsPerHost: 2,
      hostCount: 4,
      dedupEnabled: false,
      storageType: 'vsan-esa',
    })
    expect(errors.filter(e => e.code === 'VCFA_MIN_CORES').length).toBe(0)
  })

  it('11 total cores → VCFA_MIN_CORES error (boundary: 11 < 12)', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 11,
      socketsPerHost: 1,
      hostCount: 4,
      dedupEnabled: false,
      storageType: 'vsan-esa',
    })
    expect(errors.some(e => e.code === 'VCFA_MIN_CORES')).toBe(true)
  })
})

describe('validateInputs — Dedup + stretch mutual exclusion', () => {
  it('stretch + dedupEnabled → DEDUP_STRETCH_EXCLUSION error', () => {
    const errors = validateInputs({
      deploymentMode: 'stretch',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 6,
      dedupEnabled: true,
      storageType: 'vsan-esa',
    })
    expect(errors.some(e => e.code === 'DEDUP_STRETCH_EXCLUSION')).toBe(true)
  })

  it('ha + dedupEnabled → no DEDUP_STRETCH_EXCLUSION error', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 4,
      dedupEnabled: true,
      storageType: 'vsan-esa',
    })
    expect(errors.filter(e => e.code === 'DEDUP_STRETCH_EXCLUSION').length).toBe(0)
  })
})

describe('validateInputs — Stretch Cluster minimum hosts (STRCH-01)', () => {
  it('stretch, preferredSiteHosts=2, secondarySiteHosts=2 → STRETCH_MIN_HOSTS error (< 3 per site)', () => {
    const errors = validateInputs({
      deploymentMode: 'stretch',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 4,
      dedupEnabled: false,
      storageType: 'vsan-esa',
      preferredSiteHosts: 2,
      secondarySiteHosts: 2,
    })
    expect(errors.some(e => e.code === 'STRETCH_MIN_HOSTS')).toBe(true)
  })

  it('stretch, preferredSiteHosts=3, secondarySiteHosts=3 → no STRETCH_MIN_HOSTS error', () => {
    const errors = validateInputs({
      deploymentMode: 'stretch',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 6,
      dedupEnabled: false,
      storageType: 'vsan-esa',
      preferredSiteHosts: 3,
      secondarySiteHosts: 3,
    })
    expect(errors.filter(e => e.code === 'STRETCH_MIN_HOSTS').length).toBe(0)
  })

  it('ha mode, preferredSiteHosts=2, secondarySiteHosts=2 → no STRETCH_MIN_HOSTS (not stretch mode)', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 4,
      dedupEnabled: false,
      storageType: 'vsan-esa',
      preferredSiteHosts: 2,
      secondarySiteHosts: 2,
    })
    expect(errors.filter(e => e.code === 'STRETCH_MIN_HOSTS').length).toBe(0)
  })
})
