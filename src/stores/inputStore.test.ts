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
    expect(store.managementDomain.hostStorageTB).toBe(3.84)
  })

  it('has managementArchitecture global ref', () => {
    const store = useInputStore()
    expect(store.managementArchitecture).toBe('shared')
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
