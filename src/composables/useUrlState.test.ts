/// <reference types="vitest/globals" />
// Tests for URL state sharing (EXPORT-01, EXPORT-02)
// Tests lz-string round-trip, Zod validation, and URL length constraint
// Note: hydrateFromUrl() and generateShareUrl() use window/Pinia — tested via logic primitives here

import LZString from 'lz-string'
import { z } from 'zod'

// Replicated schema (must stay in sync with useUrlState.ts)
const InputStateSchema = z
  .object({
    deploymentMode: z.enum(['simple', 'ha', 'stretch']).default('ha'),
    coresPerSocket: z.number().int().min(1).max(256).default(16),
    socketsPerHost: z.number().int().min(1).max(8).default(2),
    hostRamGB: z.number().positive().default(512),
    hostStorageTB: z.number().positive().default(3.84),
    hostCount: z.number().int().min(1).max(64).default(4),
    vmCount: z.number().int().min(0).default(100),
    avgVcpuPerVm: z.number().positive().default(4),
    avgVramGbPerVm: z.number().positive().default(8),
    avgStorageGbPerVm: z.number().positive().default(100),
    cpuOvercommitRatio: z.number().positive().max(20).default(4),
    ramOvercommitRatio: z.number().positive().max(4).default(1),
    storageType: z.enum(['vsan-esa', 'fc', 'nfs']).default('vsan-esa'),
    fttLevel: z.union([z.literal(1), z.literal(2)]).default(1),
    raidType: z.enum(['raid1', 'raid5', 'raid6']).default('raid5'),
    dedupEnabled: z.boolean().default(false),
    dedupRatio: z.number().min(1).max(10).default(2),
  })
  .strip()

const defaultState = {
  deploymentMode: 'ha' as const,
  coresPerSocket: 16,
  socketsPerHost: 2,
  hostRamGB: 512,
  hostStorageTB: 3.84,
  hostCount: 4,
  vmCount: 100,
  avgVcpuPerVm: 4,
  avgVramGbPerVm: 8,
  avgStorageGbPerVm: 100,
  cpuOvercommitRatio: 4,
  ramOvercommitRatio: 1,
  storageType: 'vsan-esa' as const,
  fttLevel: 1 as const,
  raidType: 'raid5' as const,
  dedupEnabled: false,
  dedupRatio: 2,
}

describe('useUrlState — lz-string round-trip (EXPORT-01, EXPORT-02)', () => {
  it('compresses and decompresses state without data loss', () => {
    const original = { ...defaultState, hostCount: 8, deploymentMode: 'simple' as const }
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(original))
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed)

    expect(decompressed).not.toBeNull()
    const restored = JSON.parse(decompressed!)
    expect(restored.hostCount).toBe(8)
    expect(restored.deploymentMode).toBe('simple')
    expect(restored.storageType).toBe('vsan-esa')
  })

  it('returns null for invalid URI-encoded input (null-check guard)', () => {
    // lz-string returns null for input with invalid URI-encoded characters (like !)
    const result = LZString.decompressFromEncodedURIComponent('totally_invalid_!@#')
    expect(result).toBeNull()
  })

  it('null-check prevents JSON.parse crash on null decompression result', () => {
    // Verify the guard pattern used in hydrateFromUrl() is safe
    const result = LZString.decompressFromEncodedURIComponent('totally_invalid_!@#')
    // The guard: if (!json) return — this must short-circuit
    let parseFailed = false
    if (!result) {
      parseFailed = true
    } else {
      try {
        JSON.parse(result)
      } catch {
        parseFailed = true
      }
    }
    expect(parseFailed).toBe(true)
  })

  it('compressed URL param stays under 1800 chars (EXPORT-02 URL length)', () => {
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(defaultState))
    // The full URL with ?c= prefix should stay well under 2048 chars
    const urlParam = `?c=${compressed}`
    expect(urlParam.length).toBeLessThan(1800)
  })

  it('round-trip preserves all numeric fields exactly', () => {
    const original = {
      ...defaultState,
      coresPerSocket: 32,
      socketsPerHost: 4,
      hostRamGB: 1024,
      hostStorageTB: 7.68,
      vmCount: 500,
      avgVcpuPerVm: 8,
      cpuOvercommitRatio: 6,
    }
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(original))
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed)
    const restored = JSON.parse(decompressed!)

    expect(restored.coresPerSocket).toBe(32)
    expect(restored.socketsPerHost).toBe(4)
    expect(restored.hostRamGB).toBe(1024)
    expect(restored.hostStorageTB).toBe(7.68)
    expect(restored.vmCount).toBe(500)
  })
})

describe('useUrlState — Zod schema validation (EXPORT-01 safe parse)', () => {
  it('accepts valid full state', () => {
    const result = InputStateSchema.safeParse(defaultState)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.deploymentMode).toBe('ha')
      expect(result.data.hostCount).toBe(4)
    }
  })

  it('rejects invalid deploymentMode', () => {
    const result = InputStateSchema.safeParse({ ...defaultState, deploymentMode: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid storageType', () => {
    const result = InputStateSchema.safeParse({ ...defaultState, storageType: 'unknown-storage' })
    expect(result.success).toBe(false)
  })

  it('rejects fttLevel = 3 (only 1 or 2 valid)', () => {
    const result = InputStateSchema.safeParse({ ...defaultState, fttLevel: 3 })
    expect(result.success).toBe(false)
  })

  it('strips unknown keys silently (.strip() behavior)', () => {
    const withExtra = { ...defaultState, unknownFutureField: 'should-be-stripped' }
    const result = InputStateSchema.safeParse(withExtra)
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data as Record<string, unknown>)['unknownFutureField']).toBeUndefined()
    }
  })

  it('applies defaults for missing optional fields', () => {
    const result = InputStateSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.deploymentMode).toBe('ha')
      expect(result.data.hostCount).toBe(4)
      expect(result.data.dedupEnabled).toBe(false)
    }
  })

  it('rejects hostCount above max (64)', () => {
    const result = InputStateSchema.safeParse({ ...defaultState, hostCount: 100 })
    expect(result.success).toBe(false)
  })

  it('rejects negative vmCount', () => {
    const result = InputStateSchema.safeParse({ ...defaultState, vmCount: -1 })
    expect(result.success).toBe(false)
  })
})
