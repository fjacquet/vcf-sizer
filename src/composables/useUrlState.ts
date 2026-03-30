// URL state composable — lz-string compression + Zod schema validation
// Exports: hydrateFromUrl, generateShareUrl
// Called from main.ts (hydration) and ExportToolbar.vue (share URL generation)
// This is a plain TypeScript module — NO Vue lifecycle hooks

import LZString from 'lz-string' // DEFAULT import — not named exports (constraint #3)
import { z } from 'zod'
import { useInputStore } from '@/stores/inputStore'

// Zod schema — mirrors inputStore exactly, all fields optional with defaults
// .strip() discards unknown keys from untrusted input (constraint #4)
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
    storageType: z.enum(['vsan-esa', 'fc', 'nfs', 'vsan-max']).default('vsan-esa'),
    fttLevel: z.union([z.literal(1), z.literal(2)]).default(1),
    raidType: z.enum(['raid1', 'raid5', 'raid6']).default('raid5'),
    dedupEnabled: z.boolean().default(false),
    dedupRatio: z.number().min(1).max(10).default(2),
    managementArchitecture: z.enum(['shared', 'dedicated']).default('shared'),
    vsanMaxProfile: z.enum(['xs', 'sm', 'med', 'lrg', 'xl']).default('med'),
    vsanMaxStorageNodes: z.number().int().min(4).max(64).default(4),
    networkSpeedGbE: z.union([z.literal(10), z.literal(25), z.literal(100)]).default(25),
  })
  .strip()

type InputState = z.infer<typeof InputStateSchema>

/**
 * hydrateFromUrl — called once at startup, AFTER pinia is initialized, BEFORE app.mount()
 * Reads ?c= param, decompresses with lz-string, validates with Zod, hydrates inputStore.
 * Silently ignores malformed/invalid params (constraint #6 + CONTEXT.md).
 */
export function hydrateFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  const compressed = params.get('c')
  if (!compressed) return

  // LZString.decompressFromEncodedURIComponent returns null on malformed input
  // MUST null-check before JSON.parse (constraint #6)
  const json = LZString.decompressFromEncodedURIComponent(compressed)
  if (!json) {
    console.warn('[vcf-sizer] URL state: decompression failed (malformed ?c= param)')
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    console.warn('[vcf-sizer] URL state: JSON parse error')
    return
  }

  const result = InputStateSchema.safeParse(parsed)
  if (!result.success) {
    console.warn('[vcf-sizer] URL state: schema validation failed', result.error.issues)
    return
  }

  const store = useInputStore()
  const state: InputState = result.data
  // Assign each field individually (Pinia ref stores need direct assignment)
  store.deploymentMode = state.deploymentMode
  store.coresPerSocket = state.coresPerSocket
  store.socketsPerHost = state.socketsPerHost
  store.hostRamGB = state.hostRamGB
  store.hostStorageTB = state.hostStorageTB
  store.hostCount = state.hostCount
  store.vmCount = state.vmCount
  store.avgVcpuPerVm = state.avgVcpuPerVm
  store.avgVramGbPerVm = state.avgVramGbPerVm
  store.avgStorageGbPerVm = state.avgStorageGbPerVm
  store.cpuOvercommitRatio = state.cpuOvercommitRatio
  store.ramOvercommitRatio = state.ramOvercommitRatio
  store.storageType = state.storageType
  store.fttLevel = state.fttLevel
  store.raidType = state.raidType
  store.dedupEnabled = state.dedupEnabled
  store.dedupRatio = state.dedupRatio
  store.managementArchitecture = state.managementArchitecture
  store.vsanMaxProfile = state.vsanMaxProfile
  store.vsanMaxStorageNodes = state.vsanMaxStorageNodes
  store.networkSpeedGbE = state.networkSpeedGbE
}

/**
 * generateShareUrl — called on Share button click.
 * Reads inputStore, compresses to lz-string, returns full URL with ?c= param.
 */
export function generateShareUrl(): string {
  const store = useInputStore()
  const state: InputState = {
    deploymentMode: store.deploymentMode,
    coresPerSocket: store.coresPerSocket,
    socketsPerHost: store.socketsPerHost,
    hostRamGB: store.hostRamGB,
    hostStorageTB: store.hostStorageTB,
    hostCount: store.hostCount,
    vmCount: store.vmCount,
    avgVcpuPerVm: store.avgVcpuPerVm,
    avgVramGbPerVm: store.avgVramGbPerVm,
    avgStorageGbPerVm: store.avgStorageGbPerVm,
    cpuOvercommitRatio: store.cpuOvercommitRatio,
    ramOvercommitRatio: store.ramOvercommitRatio,
    storageType: store.storageType,
    fttLevel: store.fttLevel,
    raidType: store.raidType,
    dedupEnabled: store.dedupEnabled,
    dedupRatio: store.dedupRatio,
    managementArchitecture: store.managementArchitecture,
    vsanMaxProfile: store.vsanMaxProfile,
    vsanMaxStorageNodes: store.vsanMaxStorageNodes,
    networkSpeedGbE: store.networkSpeedGbE,
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(state))
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('c', compressed)
  return url.toString()
}
