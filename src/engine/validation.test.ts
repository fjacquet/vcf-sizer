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

describe('validateInputs -- Dedicated management min hosts (ARCH-01)', () => {
  it('dedicated + hostCount=3 -> DEDICATED_MGMT_MIN_HOSTS error', () => {
    const errors = validateInputs({
      managementArchitecture: 'dedicated',
      deploymentMode: 'ha',
      hostCount: 3,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
    })
    expect(errors.some(e => e.code === 'DEDICATED_MGMT_MIN_HOSTS' && e.severity === 'error')).toBe(true)
  })

  it('dedicated + hostCount=4 -> no DEDICATED_MGMT_MIN_HOSTS error', () => {
    const errors = validateInputs({
      managementArchitecture: 'dedicated',
      deploymentMode: 'ha',
      hostCount: 4,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
    })
    expect(errors.filter(e => e.code === 'DEDICATED_MGMT_MIN_HOSTS').length).toBe(0)
  })

  it('shared + hostCount=2 -> no DEDICATED_MGMT_MIN_HOSTS (only fires for dedicated)', () => {
    const errors = validateInputs({
      managementArchitecture: 'colocated',
      deploymentMode: 'ha',
      hostCount: 2,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
    })
    expect(errors.filter(e => e.code === 'DEDICATED_MGMT_MIN_HOSTS').length).toBe(0)
  })

  it('dedicated + FC + hostCount=1 -> DEDICATED_MGMT_MIN_HOSTS error', () => {
    const errors = validateInputs({
      managementArchitecture: 'dedicated',
      deploymentMode: 'ha',
      hostCount: 1,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
      managementStorageType: 'fc',
    })
    expect(errors.some(e => e.code === 'DEDICATED_MGMT_MIN_HOSTS' && e.severity === 'error')).toBe(true)
  })

  it('dedicated + FC + hostCount=2 -> no DEDICATED_MGMT_MIN_HOSTS error (KB 416270)', () => {
    const errors = validateInputs({
      managementArchitecture: 'dedicated',
      deploymentMode: 'ha',
      hostCount: 2,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
      managementStorageType: 'fc',
    })
    expect(errors.filter(e => e.code === 'DEDICATED_MGMT_MIN_HOSTS').length).toBe(0)
  })

  it('dedicated + NFS + hostCount=2 -> no DEDICATED_MGMT_MIN_HOSTS error (KB 416270)', () => {
    const errors = validateInputs({
      managementArchitecture: 'dedicated',
      deploymentMode: 'ha',
      hostCount: 2,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
      managementStorageType: 'nfs',
    })
    expect(errors.filter(e => e.code === 'DEDICATED_MGMT_MIN_HOSTS').length).toBe(0)
  })

  it('dedicated + vSAN + hostCount=3 -> still errors (vSAN floor unchanged)', () => {
    const errors = validateInputs({
      managementArchitecture: 'dedicated',
      deploymentMode: 'ha',
      hostCount: 3,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
      managementStorageType: 'vsan-esa',
    })
    expect(errors.some(e => e.code === 'DEDICATED_MGMT_MIN_HOSTS')).toBe(true)
  })

  it('dedicated + FC + hostCount=4 -> no error (above FC minimum)', () => {
    const errors = validateInputs({
      managementArchitecture: 'dedicated',
      deploymentMode: 'ha',
      hostCount: 4,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
      managementStorageType: 'fc',
    })
    expect(errors.filter(e => e.code === 'DEDICATED_MGMT_MIN_HOSTS').length).toBe(0)
  })
})

describe('validateInputs — vSAN Max min nodes (VMAX-03)', () => {
  it('vsan-max + vsanMaxStorageNodes=3 -> VSAN_MAX_MIN_NODES error', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 8,
      dedupEnabled: false,
      storageType: 'vsan-max',
      vsanMaxStorageNodes: 3,
    })
    expect(errors.some(e => e.code === 'VSAN_MAX_MIN_NODES' && e.severity === 'error')).toBe(true)
  })

  it('vsan-max + vsanMaxStorageNodes=4 -> no VSAN_MAX_MIN_NODES error', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 8,
      dedupEnabled: false,
      storageType: 'vsan-max',
      vsanMaxStorageNodes: 4,
    })
    expect(errors.filter(e => e.code === 'VSAN_MAX_MIN_NODES').length).toBe(0)
  })

  it('vsan-esa + vsanMaxStorageNodes=2 -> no VSAN_MAX_MIN_NODES (only fires for vsan-max)', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 4,
      dedupEnabled: false,
      storageType: 'vsan-esa',
      vsanMaxStorageNodes: 2,
    })
    expect(errors.filter(e => e.code === 'VSAN_MAX_MIN_NODES').length).toBe(0)
  })
})

describe('validateInputs — Dedup network speed (STOR-05)', () => {
  it('dedupEnabled + networkSpeedGbE=10 -> DEDUP_NETWORK_SPEED warning', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 4,
      dedupEnabled: true,
      storageType: 'vsan-esa',
      networkSpeedGbE: 10,
    })
    expect(errors.some(e => e.code === 'DEDUP_NETWORK_SPEED' && e.severity === 'warning')).toBe(true)
  })

  it('dedupEnabled + networkSpeedGbE=25 -> no DEDUP_NETWORK_SPEED', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 4,
      dedupEnabled: true,
      storageType: 'vsan-esa',
      networkSpeedGbE: 25,
    })
    expect(errors.filter(e => e.code === 'DEDUP_NETWORK_SPEED').length).toBe(0)
  })

  it('dedupEnabled=false + networkSpeedGbE=10 -> no DEDUP_NETWORK_SPEED', () => {
    const errors = validateInputs({
      deploymentMode: 'ha',
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostCount: 4,
      dedupEnabled: false,
      storageType: 'vsan-esa',
      networkSpeedGbE: 10,
    })
    expect(errors.filter(e => e.code === 'DEDUP_NETWORK_SPEED').length).toBe(0)
  })
})

describe('validateInputs -- Co-located min hosts (ARCH-02)', () => {
  it('shared + vsan-esa + hostCount=2 -> COLLOCATED_MIN_HOSTS warning', () => {
    const errors = validateInputs({
      managementArchitecture: 'colocated',
      deploymentMode: 'ha',
      hostCount: 2,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
    })
    expect(errors.some(e => e.code === 'COLLOCATED_MIN_HOSTS' && e.severity === 'warning')).toBe(true)
  })

  it('shared + fc + hostCount=1 -> COLLOCATED_MIN_HOSTS warning', () => {
    const errors = validateInputs({
      managementArchitecture: 'colocated',
      deploymentMode: 'ha',
      hostCount: 1,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'fc',
    })
    expect(errors.some(e => e.code === 'COLLOCATED_MIN_HOSTS' && e.severity === 'warning')).toBe(true)
  })

  it('shared + vsan-esa + hostCount=3 -> no COLLOCATED_MIN_HOSTS', () => {
    const errors = validateInputs({
      managementArchitecture: 'colocated',
      deploymentMode: 'ha',
      hostCount: 3,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
    })
    expect(errors.filter(e => e.code === 'COLLOCATED_MIN_HOSTS').length).toBe(0)
  })

  it('shared + fc + hostCount=2 -> no COLLOCATED_MIN_HOSTS', () => {
    const errors = validateInputs({
      managementArchitecture: 'colocated',
      deploymentMode: 'ha',
      hostCount: 2,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'fc',
    })
    expect(errors.filter(e => e.code === 'COLLOCATED_MIN_HOSTS').length).toBe(0)
  })

  it('dedicated + hostCount=1 -> no COLLOCATED_MIN_HOSTS (only fires for non-dedicated)', () => {
    const errors = validateInputs({
      managementArchitecture: 'dedicated',
      deploymentMode: 'ha',
      hostCount: 1,
      coresPerSocket: 16,
      socketsPerHost: 2,
      dedupEnabled: false,
      storageType: 'vsan-esa',
    })
    expect(errors.filter(e => e.code === 'COLLOCATED_MIN_HOSTS').length).toBe(0)
  })
})
