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
