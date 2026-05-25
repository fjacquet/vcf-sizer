// URL state composable — lz-string compression + Zod schema validation
// Exports: hydrateFromUrl, generateShareUrl, WorkloadDomainSchema, ManagementDomainSchema, InputStateSchema
// Called from main.ts (hydration) and ExportToolbar.vue (share URL generation)
// This is a plain TypeScript module — NO Vue lifecycle hooks

import LZString from 'lz-string' // DEFAULT import — not named exports (constraint #3)
import { z } from 'zod'
import { useInputStore } from '@/stores/inputStore'
import { createDefaultWorkloadDomain } from '@/engine/defaults'

// ── Section 1: Schema definitions ─────────────────────────────────────────────
// .strip() discards unknown keys from untrusted input (constraint #4)

export const WorkloadDomainSchema = z
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
    vmCount: z.number().int().min(0).default(100),
    avgVcpuPerVm: z.number().positive().default(4),
    avgVramGbPerVm: z.number().positive().default(8),
    avgStorageGbPerVm: z.number().positive().default(100),
    cpuOvercommitRatio: z.number().positive().max(20).default(4),
    ramOvercommitRatio: z.number().positive().max(4).default(1),
    gpuVmCount: z.number().int().min(0).default(0),
    vgpuMemoryGB: z.number().positive().default(16),
    // Demand-driven: host/cluster counts are outputs; HA reserve is the only host-side input.
    hostFailuresToTolerate: z.number().int().min(0).max(8).default(1),
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

export const ManagementDomainSchema = z
  .object({
    coresPerSocket: z.number().int().min(1).max(256).default(16),
    socketsPerHost: z.number().int().min(1).max(8).default(2),
    hostRamGB: z.number().positive().default(512),
    hostStorageTiB: z.number().positive().default(3.84),
    deploymentMode: z.enum(['simple', 'ha', 'stretch']).default('ha'),
    // Widened to include 'vsan-max' (per Q5 of design — vSAN Max for mgmt is supported).
    storageType: z.enum(['vsan-esa', 'fc', 'nfs', 'vsan-max']).default('vsan-esa'),

    // FC/NFS only — required pool size when those storage types are selected.
    externalStorageUsableTiB: z.number().positive().optional(),
    // vSAN Max for mgmt only.
    vsanMaxStorageNodes: z.number().int().min(4).max(64).optional(),
    vsanMaxProfile: z.enum(['xs', 'sm', 'med', 'lrg', 'xl']).optional(),

    // Profile + capacity headroom (P3 additions).
    profile: z.enum(['lab', 'standard', 'large']).default('standard'),
    cpuOversubscription: z.number().positive().max(8).default(2),
    ramOversubscription: z.number().positive().max(4).default(1),
    reservePct: z.number().min(0).max(100).default(30),
    growthPct: z.number().min(0).max(100).default(10),

    // Sparse override map — empty by default.
    overrides: z
      .record(
        z.string(),
        z.object({
          included: z.boolean().optional(),
          size: z.string().optional(),
          nodeCount: z.number().int().min(1).max(20).optional(),
        }),
      )
      .default({}),

    // Validated solutions toggles.
    validatedSolutions: z
      .object({
        siteProtection: z
          .object({
            included: z.boolean(),
            mgmtSize: z.enum(['light', 'standard']).optional(),
          })
          .default({ included: false }),
        ransomwareOnPrem: z.object({ included: z.boolean() }).default({ included: false }),
        ransomwareCloud: z.object({ included: z.boolean() }).default({ included: false }),
        crossCloudMobility: z.object({ included: z.boolean() }).default({ included: false }),
      })
      .default({
        siteProtection: { included: false },
        ransomwareOnPrem: { included: false },
        ransomwareCloud: { included: false },
        crossCloudMobility: { included: false },
      }),
  })
  .strip()

export const InputStateSchema = z
  .object({
    managementArchitecture: z.enum(['colocated', 'dedicated']).default('colocated'),
    // Factory defaults required for nested schemas — .default({}) bypasses inner field defaults (Pitfall 1)
    managementDomain: ManagementDomainSchema.default(
      () => ManagementDomainSchema.parse({})
    ),
    // Factory default required for array — .default([]) is a Zod v4 known issue (Pattern 2)
    workloadDomains: z.array(WorkloadDomainSchema).min(1).default(
      () => [createDefaultWorkloadDomain(0)]
    ),
  })
  .strip()

export type InputState = z.infer<typeof InputStateSchema>

// ── Section 2: hydrateFromUrl ─────────────────────────────────────────────────
/**
 * hydrateFromUrl — called once at startup, AFTER pinia is initialized, BEFORE app.mount()
 * Reads ?c= param, decompresses with lz-string, validates with Zod, hydrates inputStore.
 * Silently ignores malformed/invalid params.
 * v2.x flat-schema URLs degrade silently to 1-domain default (URL-02).
 */
export function hydrateFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  const compressed = params.get('c')
  if (!compressed) return

  // LZString.decompressFromEncodedURIComponent returns null on malformed input
  // MUST null-check before JSON.parse
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

  // 3 structured assignments replace the old 20+ flat property assignments
  store.managementArchitecture = state.managementArchitecture
  store.managementDomain = { ...state.managementDomain }
  // Re-generate IDs on hydration — IDs from URL are not meaningful across sessions
  store.workloadDomains = state.workloadDomains.map(d => ({
    ...d,
    id: crypto.randomUUID(),
  }))
  // activeDomainIndex is NOT assigned — stays at 0 (URL-04)
}

// ── Section 3: generateShareUrl ───────────────────────────────────────────────
/**
 * generateShareUrl — called on Share button click.
 * Reads inputStore nested structure, compresses to lz-string, returns full URL with ?c= param.
 * Excludes domain id from serialization (saves ~40 bytes per domain; re-generated on hydration).
 * Excludes activeDomainIndex (ephemeral UI state — URL-04).
 */
export function generateShareUrl(): string {
  const store = useInputStore()
  const state = {
    managementArchitecture: store.managementArchitecture,
    managementDomain: { ...store.managementDomain },
    workloadDomains: store.workloadDomains.map(({ id: _id, ...rest }) => rest),
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(state))
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('c', compressed)
  return url.toString()
}
