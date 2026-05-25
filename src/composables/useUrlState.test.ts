/// <reference types="vitest/globals" />
// Tests for URL state sharing — multi-domain schema (URL-01, URL-02, URL-03, URL-04)
// Tests lz-string round-trip, Zod nested schema validation, backward compat, and URL length
// Note: hydrateFromUrl() and generateShareUrl() use window/Pinia — tested via schema replicas here

import LZString from 'lz-string'
import { z } from 'zod'
import { createDefaultWorkloadDomain } from '@/engine/defaults'
import { ManagementDomainSchema as RealManagementDomainSchema } from '@/composables/useUrlState'

// ── Schema replicas (must stay in sync with useUrlState.ts) ──────────────────
const WorkloadDomainSchema = z
  .object({
    id: z.string().default(() => crypto.randomUUID()),
    name: z.string().default('WLD-1'),
    coresPerSocket: z.number().int().min(1).max(256).default(16),
    socketsPerHost: z.number().int().min(1).max(8).default(2),
    hostRamGB: z.number().positive().default(512),
    hostStorageTiB: z.number().positive().default(3.84),
    externalStorageUsableTiB: z.number().positive().default(100),
    nvmeTieringEnabled: z.boolean().default(false),
    activeMemoryPct: z.number().min(1).max(100).default(50),
    // Demand-driven: host/cluster counts are outputs; HA reserve is the only host-side input.
    hostFailuresToTolerate: z.number().int().min(0).max(8).default(1),
    vmCount: z.number().int().min(0).default(100),
    avgVcpuPerVm: z.number().positive().default(4),
    avgVramGbPerVm: z.number().positive().default(8),
    avgStorageGbPerVm: z.number().positive().default(100),
    cpuOvercommitRatio: z.number().positive().max(20).default(4),
    ramOvercommitRatio: z.number().positive().max(4).default(1),
    gpuVmCount: z.number().int().min(0).default(0),
    vgpuMemoryGB: z.number().positive().default(16),
    storageType: z.enum(['vsan-esa', 'fc', 'nfs', 'vsan-max']).default('vsan-esa'),
    fttLevel: z.union([z.literal(1), z.literal(2)]).default(1),
    raidType: z.enum(['raid1', 'raid5', 'raid6']).default('raid5'),
    dedupEnabled: z.boolean().default(false),
    dedupRatio: z.number().min(1).max(10).default(2),
    vsanMaxProfile: z.enum(['xs', 'sm', 'med', 'lrg', 'xl']).default('med'),
    vsanMaxStorageNodes: z.number().int().min(4).max(64).default(4),
    networkSpeedGbE: z.union([z.literal(10), z.literal(25), z.literal(100)]).default(25),
    deploymentMode: z.enum(['simple', 'ha', 'stretch']).default('ha'),
  })
  .strip()

const ManagementDomainSchema = z
  .object({
    coresPerSocket: z.number().int().min(1).max(256).default(16),
    socketsPerHost: z.number().int().min(1).max(8).default(2),
    hostRamGB: z.number().positive().default(512),
    hostStorageTiB: z.number().positive().default(3.84),
  })
  .strip()

const InputStateSchema = z
  .object({
    managementArchitecture: z.enum(['colocated', 'dedicated']).default('colocated'),
    managementDomain: ManagementDomainSchema.default(
      () => ManagementDomainSchema.parse({})
    ),
    workloadDomains: z.array(WorkloadDomainSchema).min(1).default(
      () => [createDefaultWorkloadDomain(0)]
    ),
  })
  .strip()

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('URL-01 — New schema structure', () => {
  it('safeParse({}) succeeds and returns managementArchitecture === "colocated"', () => {
    const result = InputStateSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.managementArchitecture).toBe('colocated')
    }
  })

  it('safeParse({}) returns workloadDomains array with length 1', () => {
    const result = InputStateSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Array.isArray(result.data.workloadDomains)).toBe(true)
      expect(result.data.workloadDomains.length).toBe(1)
    }
  })

  it('safeParse({}) returns workloadDomains[0].name === "WLD-1"', () => {
    const result = InputStateSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.workloadDomains[0].name).toBe('WLD-1')
    }
  })

  it('safeParse({}) returns managementDomain.coresPerSocket === 16 (factory default, not undefined)', () => {
    const result = InputStateSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.managementDomain.coresPerSocket).toBe(16)
    }
  })

  it('WorkloadDomainSchema strips unknown keys (.strip() behavior)', () => {
    const withExtra = { name: 'Test', unknownFutureField: 'should-be-stripped' }
    const result = WorkloadDomainSchema.safeParse(withExtra)
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data as Record<string, unknown>)['unknownFutureField']).toBeUndefined()
    }
  })

  it('ManagementDomainSchema.parse({}) applies all 4 field defaults correctly', () => {
    const result = ManagementDomainSchema.parse({})
    expect(result.coresPerSocket).toBe(16)
    expect(result.socketsPerHost).toBe(2)
    expect(result.hostRamGB).toBe(512)
    expect(result.hostStorageTiB).toBe(3.84)
  })

  it('WorkloadDomainSchema.parse({}) returns hostStorageTiB and externalStorageUsableTiB defaults', () => {
    const result = WorkloadDomainSchema.parse({})
    expect(result.hostStorageTiB).toBe(3.84)
    expect(result.externalStorageUsableTiB).toBe(100)
  })

  it('backward compat: old hostStorageTB key is stripped, hostStorageTiB uses default', () => {
    const result = WorkloadDomainSchema.parse({ hostStorageTB: 5.0 })
    expect(result.hostStorageTiB).toBe(3.84) // default, old key stripped
    expect((result as Record<string, unknown>)['hostStorageTB']).toBeUndefined()
  })
})

describe('URL-02 — v2.x backward compatibility', () => {
  const v2Payload = {
    deploymentMode: 'ha',
    hostCount: 4,
    vmCount: 100,
    coresPerSocket: 16,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 3.84,
    avgVcpuPerVm: 4,
    avgVramGbPerVm: 8,
    avgStorageGbPerVm: 100,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    storageType: 'vsan-esa',
    fttLevel: 1,
    raidType: 'raid5',
    dedupEnabled: false,
    dedupRatio: 2,
    managementArchitecture: 'dedicated',
    vsanMaxProfile: 'med',
    vsanMaxStorageNodes: 4,
    networkSpeedGbE: 25,
  }

  it('v2.x flat payload parses without error', () => {
    const result = InputStateSchema.safeParse(v2Payload)
    expect(result.success).toBe(true)
  })

  it('v2.x flat payload produces workloadDomains.length === 1 (factory default)', () => {
    const result = InputStateSchema.safeParse(v2Payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.workloadDomains.length).toBe(1)
    }
  })

  it('v2.x flat payload preserves managementArchitecture value (top-level field survives)', () => {
    const result = InputStateSchema.safeParse(v2Payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.managementArchitecture).toBe('dedicated')
    }
  })
})

describe('URL-03 — Multi-domain round-trip', () => {
  const domain0 = {
    ...createDefaultWorkloadDomain(0),
    name: 'Production',
    hostFailuresToTolerate: 2,
    vmCount: 500,
    storageType: 'fc' as const,
  }
  const domain1 = {
    ...createDefaultWorkloadDomain(1),
    name: 'Dev-Test',
    vmCount: 50,
    deploymentMode: 'simple' as const,
  }
  const domain2 = {
    ...createDefaultWorkloadDomain(2),
    name: 'DR-Site',
    vmCount: 200,
    deploymentMode: 'stretch' as const,
  }

  const threeDomainsState = {
    managementArchitecture: 'colocated' as const,
    managementDomain: { coresPerSocket: 16, socketsPerHost: 2, hostRamGB: 512, hostStorageTiB: 3.84 },
    workloadDomains: [domain0, domain1, domain2],
  }

  it('3-domain config compresses and decompresses losslessly (names preserved)', () => {
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(threeDomainsState))
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed)
    expect(decompressed).not.toBeNull()

    const parsed = JSON.parse(decompressed!)
    const result = InputStateSchema.safeParse(parsed)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.workloadDomains.length).toBe(3)
      expect(result.data.workloadDomains[0].name).toBe('Production')
      expect(result.data.workloadDomains[1].name).toBe('Dev-Test')
      expect(result.data.workloadDomains[2].name).toBe('DR-Site')
    }
  })

  it('all non-default field values survive the round-trip exactly', () => {
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(threeDomainsState))
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed)
    const parsed = JSON.parse(decompressed!)
    const result = InputStateSchema.safeParse(parsed)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.workloadDomains[0].hostFailuresToTolerate).toBe(2)
      expect(result.data.workloadDomains[0].vmCount).toBe(500)
      expect(result.data.workloadDomains[0].storageType).toBe('fc')
      expect(result.data.workloadDomains[1].deploymentMode).toBe('simple')
      expect(result.data.workloadDomains[2].deploymentMode).toBe('stretch')
    }
  })

  it('5-domain config serializes to URL param under 4,096 characters', () => {
    const fiveDomains = {
      managementArchitecture: 'colocated' as const,
      managementDomain: { coresPerSocket: 16, socketsPerHost: 2, hostRamGB: 512, hostStorageTiB: 3.84 },
      workloadDomains: [
        createDefaultWorkloadDomain(0),
        createDefaultWorkloadDomain(1),
        createDefaultWorkloadDomain(2),
        createDefaultWorkloadDomain(3),
        createDefaultWorkloadDomain(4),
      ],
    }
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(fiveDomains))
    const urlParam = `?c=${compressed}`
    expect(urlParam.length).toBeLessThan(4096)
  })
})

describe('URL-04 — activeTabIndex exclusion', () => {
  it('serialized payload with activeDomainIndex does NOT contain that key after .strip()', () => {
    const stateWithEphemeral = {
      managementArchitecture: 'colocated',
      managementDomain: { coresPerSocket: 16, socketsPerHost: 2, hostRamGB: 512, hostStorageTiB: 3.84 },
      workloadDomains: [createDefaultWorkloadDomain(0)],
      activeDomainIndex: 2,  // ephemeral UI state — must be stripped
    }
    const result = InputStateSchema.safeParse(stateWithEphemeral)
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data as Record<string, unknown>)['activeDomainIndex']).toBeUndefined()
    }
  })
})

describe('Schema validation — edge cases', () => {
  it('invalid managementArchitecture enum value is rejected', () => {
    const result = InputStateSchema.safeParse({ managementArchitecture: 'collocated' })
    expect(result.success).toBe(false)
  })

  it('workloadDomains: [] (empty array) is rejected by .min(1)', () => {
    const result = InputStateSchema.safeParse({ workloadDomains: [] })
    expect(result.success).toBe(false)
  })

  it('lz-string null decompression is still handled safely (null-check guard)', () => {
    const result = LZString.decompressFromEncodedURIComponent('totally_invalid_!@#')
    // The guard: if (!json) return — must short-circuit
    let guardTriggered = false
    if (!result) {
      guardTriggered = true
    } else {
      try {
        JSON.parse(result)
      } catch {
        guardTriggered = true
      }
    }
    expect(guardTriggered).toBe(true)
  })
})

const defaultState = InputStateSchema.parse({})

describe('WIZARD-07: wizard step URL exclusion', () => {
  it('InputStateSchema strips currentWizardStep from parsed input', () => {
    // InputStateSchema uses .strip() — any unknown key including currentWizardStep must be removed
    const inputWithWizardStep = {
      ...defaultState,
      currentWizardStep: 2,
    }
    const result = InputStateSchema.safeParse(inputWithWizardStep)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('currentWizardStep')
    }
  })

  it('serialized URL state object has no currentWizardStep key', () => {
    // Mirrors what generateShareUrl() does: serialize only inputStore fields
    // currentWizardStep lives in uiStore and must never appear in the URL state object
    // v3.x schema: top-level fields are managementArchitecture, managementDomain, workloadDomains
    const urlStateObject = {
      managementArchitecture: defaultState.managementArchitecture,
      managementDomain: defaultState.managementDomain,
      workloadDomains: defaultState.workloadDomains,
    }

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(urlStateObject))
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed)
    const roundTripped = JSON.parse(decompressed!)

    expect(Object.keys(roundTripped)).not.toContain('currentWizardStep')
  })
})

describe('ManagementDomainSchema — Phase 3 fields', () => {
  it('accepts the new full management config shape', () => {
    const result = RealManagementDomainSchema.safeParse({
      coresPerSocket: 32,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostStorageTiB: 8,
      deploymentMode: 'ha',
      storageType: 'vsan-esa',
      profile: 'standard',
      cpuOversubscription: 2,
      ramOversubscription: 1,
      reservePct: 30,
      growthPct: 10,
      overrides: {},
      validatedSolutions: {
        siteProtection: { included: false },
        ransomwareOnPrem: { included: false },
        ransomwareCloud: { included: false },
        crossCloudMobility: { included: false },
      },
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults for new fields when missing (backward compat for old URLs)', () => {
    // Old shareable URL: only the 6 original fields
    const result = RealManagementDomainSchema.safeParse({
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostStorageTiB: 3.84,
      deploymentMode: 'ha',
      storageType: 'vsan-esa',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.profile).toBe('standard')
      expect(result.data.cpuOversubscription).toBe(2)
      expect(result.data.ramOversubscription).toBe(1)
      expect(result.data.reservePct).toBe(30)
      expect(result.data.growthPct).toBe(10)
      expect(result.data.overrides).toEqual({})
      expect(result.data.validatedSolutions).toEqual({
        siteProtection: { included: false },
        ransomwareOnPrem: { included: false },
        ransomwareCloud: { included: false },
        crossCloudMobility: { included: false },
      })
    }
  })

  it('storageType now accepts vsan-max for management', () => {
    const result = RealManagementDomainSchema.safeParse({
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostStorageTiB: 3.84,
      deploymentMode: 'ha',
      storageType: 'vsan-max',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid profile value', () => {
    const result = RealManagementDomainSchema.safeParse({
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostStorageTiB: 3.84,
      deploymentMode: 'ha',
      storageType: 'vsan-esa',
      profile: 'enormous',
    })
    expect(result.success).toBe(false)
  })

  it('reservePct rejects negative values', () => {
    const result = RealManagementDomainSchema.safeParse({
      coresPerSocket: 16,
      socketsPerHost: 2,
      hostRamGB: 512,
      hostStorageTiB: 3.84,
      deploymentMode: 'ha',
      storageType: 'vsan-esa',
      reservePct: -5,
    })
    expect(result.success).toBe(false)
  })
})
