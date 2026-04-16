/// <reference types="vitest/globals" />
import { setActivePinia, createPinia } from 'pinia'
import { useInputStore } from './inputStore'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('inputStore — v3.0 structure (DOM-01)', () => {
  it('has workloadDomains array ref with length 1', () => {
    const store = useInputStore()
    expect(Array.isArray(store.workloadDomains)).toBe(true)
    expect(store.workloadDomains.length).toBe(1)
  })

  it('has managementDomain object ref with host specs', () => {
    const store = useInputStore()
    expect(store.managementDomain.coresPerSocket).toBe(16)
    expect(store.managementDomain.socketsPerHost).toBe(2)
    expect(store.managementDomain.hostRamGB).toBe(512)
    expect(store.managementDomain.hostStorageTiB).toBe(3.84)
  })

  it('has managementArchitecture global ref', () => {
    const store = useInputStore()
    expect(store.managementArchitecture).toBe('colocated')
  })

  it('does NOT have flat coresPerSocket ref (old shape removed)', () => {
    const store = useInputStore()
    expect('coresPerSocket' in store.$state).toBe(false)
  })
})

describe('inputStore — default domain (DOM-04)', () => {
  it('default domain is named "WLD-1"', () => {
    const store = useInputStore()
    expect(store.workloadDomains[0].name).toBe('WLD-1')
  })

  it('default domain has stable id', () => {
    const store = useInputStore()
    expect(typeof store.workloadDomains[0].id).toBe('string')
    expect(store.workloadDomains[0].id.length).toBeGreaterThan(0)
  })

  it('default domain has correct default values', () => {
    const store = useInputStore()
    const d = store.workloadDomains[0]
    expect(d.deploymentMode).toBe('ha')
    expect(d.coresPerSocket).toBe(16)
    expect(d.vmCount).toBe(100)
    expect(d.storageType).toBe('vsan-esa')
  })
})

describe('inputStore — domain mutations (DOM-01)', () => {
  it('addDomain() increases workloadDomains.length to 2', () => {
    const store = useInputStore()
    store.addDomain()
    expect(store.workloadDomains.length).toBe(2)
  })

  it('addDomain() sets activeDomainIndex to new domain', () => {
    const store = useInputStore()
    store.addDomain()
    expect(store.activeDomainIndex).toBe(1)
  })

  it('removeDomain() with last domain does nothing', () => {
    const store = useInputStore()
    const id = store.workloadDomains[0].id
    store.removeDomain(id)
    expect(store.workloadDomains.length).toBe(1)
  })

  it('removeDomain() removes the correct domain', () => {
    const store = useInputStore()
    store.addDomain()
    const firstId = store.workloadDomains[0].id
    const secondId = store.workloadDomains[1].id
    store.removeDomain(firstId)
    expect(store.workloadDomains.length).toBe(1)
    expect(store.workloadDomains[0].id).toBe(secondId)
  })

  it('updateDomain() changes the specified field', () => {
    const store = useInputStore()
    const id = store.workloadDomains[0].id
    store.updateDomain(id, { vmCount: 200 })
    expect(store.workloadDomains[0].vmCount).toBe(200)
  })

  it('updateDomain() does not affect other fields', () => {
    const store = useInputStore()
    const id = store.workloadDomains[0].id
    store.updateDomain(id, { vmCount: 200 })
    expect(store.workloadDomains[0].coresPerSocket).toBe(16)
  })
})

describe('inputStore — renameDomain (UI-04)', () => {
  it('renames domain with trimmed non-empty string', () => {
    const store = useInputStore()
    const id = store.workloadDomains[0].id
    store.renameDomain(id, '  Production  ')
    expect(store.workloadDomains[0].name).toBe('Production')
  })

  it('ignores rename with empty/whitespace-only string', () => {
    const store = useInputStore()
    const id = store.workloadDomains[0].id
    store.renameDomain(id, '   ')
    expect(store.workloadDomains[0].name).toBe('WLD-1')
  })

  it('ignores rename for non-existent domain id', () => {
    const store = useInputStore()
    store.renameDomain('non-existent-id', 'NewName')
    expect(store.workloadDomains[0].name).toBe('WLD-1')
  })
})

describe('inputStore — updateManagementDomain (UI-05)', () => {
  it('patches a single management field', () => {
    const store = useInputStore()
    store.updateManagementDomain({ coresPerSocket: 32 })
    expect(store.managementDomain.coresPerSocket).toBe(32)
  })

  it('does not overwrite unpatched management fields', () => {
    const store = useInputStore()
    store.updateManagementDomain({ hostRamGB: 1024 })
    expect(store.managementDomain.coresPerSocket).toBe(16)
    expect(store.managementDomain.hostRamGB).toBe(1024)
  })

  it('patches multiple management fields at once', () => {
    const store = useInputStore()
    store.updateManagementDomain({ coresPerSocket: 32, socketsPerHost: 4 })
    expect(store.managementDomain.coresPerSocket).toBe(32)
    expect(store.managementDomain.socketsPerHost).toBe(4)
  })
})

describe('inputStore -- duplicateDomain (DOMAIN-01)', () => {
  it('Test 1: inserts clone at idx+1 -- workloadDomains.length increases by 1', () => {
    const store = useInputStore()
    const id = store.workloadDomains[0].id
    store.duplicateDomain(id, 'WLD-1 (copy)')
    expect(store.workloadDomains.length).toBe(2)
  })

  it('Test 2: clone has new UUID different from source', () => {
    const store = useInputStore()
    const id = store.workloadDomains[0].id
    store.duplicateDomain(id, 'WLD-1 (copy)')
    const clone = store.workloadDomains[1]
    expect(clone.id).not.toBe(id)
    expect(typeof clone.id).toBe('string')
    expect(clone.id.length).toBeGreaterThan(0)
  })

  it('Test 3: clone name equals the provided newName parameter', () => {
    const store = useInputStore()
    const id = store.workloadDomains[0].id
    store.duplicateDomain(id, 'WLD-1 (copy)')
    const clone = store.workloadDomains[1]
    expect(clone.name).toBe('WLD-1 (copy)')
  })

  it('Test 4: clone has all 26 config fields deeply equal to source (exclude id and name)', () => {
    const store = useInputStore()
    store.updateDomain(store.workloadDomains[0].id, { vmCount: 200 })
    const id = store.workloadDomains[0].id
    store.duplicateDomain(id, 'WLD-1 (copy)')
    const source = store.workloadDomains[0]
    const clone = store.workloadDomains[1]
    const skip = new Set(['id', 'name'])
    for (const key of Object.keys(source)) {
      if (!skip.has(key)) expect((clone as Record<string, unknown>)[key]).toEqual((source as Record<string, unknown>)[key])
    }
  })

  it('Test 5: activeDomainIndex advances to the new domain index (idx + 1)', () => {
    const store = useInputStore()
    const id = store.workloadDomains[0].id
    store.duplicateDomain(id, 'WLD-1 (copy)')
    expect(store.activeDomainIndex).toBe(1)
  })

  it('Test 6: duplicateDomain with nonexistent id is a no-op', () => {
    const store = useInputStore()
    store.duplicateDomain('nonexistent-id', 'x')
    expect(store.workloadDomains.length).toBe(1)
  })

  it('Test 7: clone is an independent copy -- mutating clone does not affect source', () => {
    const store = useInputStore()
    const id = store.workloadDomains[0].id
    store.duplicateDomain(id, 'WLD-1 (copy)')
    const cloneId = store.workloadDomains[1].id
    store.updateDomain(cloneId, { vmCount: 999 })
    expect(store.workloadDomains[0].vmCount).toBe(100)
    expect(store.workloadDomains[1].vmCount).toBe(999)
  })
})

// Auto-correction cascade — normalizeDomainPatch() in updateDomain()
// Ensures incompatible field combos are silently normalized AND the user is
// notified via uiStore.flashAutoCorrection() for every rule that fired.
describe('inputStore — auto-correction cascade', () => {
  it('Stretch + Dedup: forces dedupEnabled=false and flashes autoCorrectDedupStretch', async () => {
    const { useUiStore } = await import('./uiStore')
    const input = useInputStore()
    const ui = useUiStore()
    const id = input.workloadDomains[0].id
    input.updateDomain(id, { deploymentMode: 'stretch', dedupEnabled: true })
    expect(input.workloadDomains[0].deploymentMode).toBe('stretch')
    expect(input.workloadDomains[0].dedupEnabled).toBe(false)
    expect(ui.autoCorrectionMessageKeys).toContain('warnings.autoCorrectDedupStretch')
  })

  it('vSAN Max + Stretch: forces deploymentMode=ha and flashes autoCorrectDeploymentVsanMax', async () => {
    const { useUiStore } = await import('./uiStore')
    const input = useInputStore()
    const ui = useUiStore()
    const id = input.workloadDomains[0].id
    input.updateDomain(id, { storageType: 'vsan-max', deploymentMode: 'stretch' })
    expect(input.workloadDomains[0].storageType).toBe('vsan-max')
    expect(input.workloadDomains[0].deploymentMode).toBe('ha')
    expect(ui.autoCorrectionMessageKeys).toContain('warnings.autoCorrectDeploymentVsanMax')
  })

  it('FTT=2 + RAID-5: promotes to RAID-6 and flashes autoCorrectRaidFtt2', async () => {
    const { useUiStore } = await import('./uiStore')
    const input = useInputStore()
    const ui = useUiStore()
    const id = input.workloadDomains[0].id
    input.updateDomain(id, { fttLevel: 2, raidType: 'raid5' })
    expect(input.workloadDomains[0].raidType).toBe('raid6')
    expect(ui.autoCorrectionMessageKeys).toContain('warnings.autoCorrectRaidFtt2')
  })

  it('FTT=1 + RAID-6: demotes to RAID-5 and flashes autoCorrectRaidFtt1', async () => {
    const { useUiStore } = await import('./uiStore')
    const input = useInputStore()
    const ui = useUiStore()
    const id = input.workloadDomains[0].id
    // First force into FTT=2/RAID-6 so we can test the demotion
    input.updateDomain(id, { fttLevel: 2, raidType: 'raid6' })
    input.updateDomain(id, { fttLevel: 1 })
    expect(input.workloadDomains[0].raidType).toBe('raid5')
    expect(ui.autoCorrectionMessageKeys).toContain('warnings.autoCorrectRaidFtt1')
  })

  it('Multi-field patch (vSAN Max + Stretch + Dedup): HA rule runs first so dedup is preserved', async () => {
    const { useUiStore } = await import('./uiStore')
    const input = useInputStore()
    const ui = useUiStore()
    const id = input.workloadDomains[0].id
    // Seed state with dedup enabled
    input.updateDomain(id, { dedupEnabled: true })
    // Attempt the invalid combo in a single patch
    input.updateDomain(id, { storageType: 'vsan-max', deploymentMode: 'stretch' })
    // HA fix runs first; because final mode is 'ha', the dedup rule does NOT fire
    expect(input.workloadDomains[0].deploymentMode).toBe('ha')
    expect(input.workloadDomains[0].dedupEnabled).toBe(true)
    expect(ui.autoCorrectionMessageKeys).toContain('warnings.autoCorrectDeploymentVsanMax')
    expect(ui.autoCorrectionMessageKeys).not.toContain('warnings.autoCorrectDedupStretch')
  })

  it('Multiple banners survive a single multi-field patch (no overwrite)', async () => {
    const { useUiStore } = await import('./uiStore')
    const input = useInputStore()
    const ui = useUiStore()
    const id = input.workloadDomains[0].id
    // Seed dedup on; then a single patch that triggers both Stretch/Dedup AND FTT=2/RAID-5
    input.updateDomain(id, { dedupEnabled: true })
    input.updateDomain(id, { deploymentMode: 'stretch', fttLevel: 2, raidType: 'raid5' })
    expect(ui.autoCorrectionMessageKeys).toContain('warnings.autoCorrectDedupStretch')
    expect(ui.autoCorrectionMessageKeys).toContain('warnings.autoCorrectRaidFtt2')
  })

  it('flashAutoCorrection deduplicates — same key pushed twice appears once', async () => {
    const { useUiStore } = await import('./uiStore')
    const ui = useUiStore()
    ui.flashAutoCorrection('warnings.autoCorrectDedupStretch')
    ui.flashAutoCorrection('warnings.autoCorrectDedupStretch')
    expect(ui.autoCorrectionMessageKeys.filter(k => k === 'warnings.autoCorrectDedupStretch')).toHaveLength(1)
  })

  it('dismissAutoCorrection clears all keys', async () => {
    const { useUiStore } = await import('./uiStore')
    const ui = useUiStore()
    ui.flashAutoCorrection('warnings.autoCorrectDedupStretch')
    ui.flashAutoCorrection('warnings.autoCorrectRaidFtt2')
    expect(ui.autoCorrectionMessageKeys.length).toBe(2)
    ui.dismissAutoCorrection()
    expect(ui.autoCorrectionMessageKeys).toEqual([])
  })
})
