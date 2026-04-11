/// <reference types="vitest/globals" />
// Tests for wizard step state management (WIZARD-02, WIZARD-07)
// Validates currentWizardStep state: init, transitions, and inputStore independence

import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './uiStore'
import { useInputStore } from './inputStore'

describe('uiStore — wizard step state (WIZARD-02)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('currentWizardStep initializes to 1', () => {
    const store = useUiStore()
    expect(store.currentWizardStep).toBe(1)
  })

  it('setWizardStep(2) updates currentWizardStep to 2', () => {
    const store = useUiStore()
    store.setWizardStep(2)
    expect(store.currentWizardStep).toBe(2)
  })

  it('setWizardStep(3) updates currentWizardStep to 3', () => {
    const store = useUiStore()
    store.setWizardStep(3)
    expect(store.currentWizardStep).toBe(3)
  })

  it('setWizardStep(1) returns to step 1 from step 3', () => {
    const store = useUiStore()
    store.setWizardStep(3)
    store.setWizardStep(1)
    expect(store.currentWizardStep).toBe(1)
  })

  it('changing wizard step does not modify inputStore.managementDomain', () => {
    const uiStore = useUiStore()
    const inputStore = useInputStore()
    const originalMgmtDomain = JSON.stringify(inputStore.managementDomain)
    uiStore.setWizardStep(2)
    uiStore.setWizardStep(3)
    expect(JSON.stringify(inputStore.managementDomain)).toBe(originalMgmtDomain)
  })

  it('changing wizard step does not modify inputStore.workloadDomains', () => {
    const uiStore = useUiStore()
    const inputStore = useInputStore()
    const originalWorkloads = JSON.stringify(inputStore.workloadDomains)
    uiStore.setWizardStep(2)
    uiStore.setWizardStep(3)
    expect(JSON.stringify(inputStore.workloadDomains)).toBe(originalWorkloads)
  })
})

describe('uiStore -- topologyConfirmed (WIZARD-03)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('topologyConfirmed initializes to false', () => {
    const store = useUiStore()
    expect(store.topologyConfirmed).toBe(false)
  })

  it('confirmTopology() sets topologyConfirmed to true', () => {
    const store = useUiStore()
    store.confirmTopology()
    expect(store.topologyConfirmed).toBe(true)
  })

  it('topologyConfirmed remains false after setWizardStep() calls (orthogonal)', () => {
    const store = useUiStore()
    store.setWizardStep(2)
    store.setWizardStep(3)
    store.setWizardStep(1)
    expect(store.topologyConfirmed).toBe(false)
  })

  it('confirmTopology() is idempotent (calling twice still true)', () => {
    const store = useUiStore()
    store.confirmTopology()
    store.confirmTopology()
    expect(store.topologyConfirmed).toBe(true)
  })
})

describe('uiStore -- landing view (WIZARD-02)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('isLandingVisible initializes to true', () => {
    const store = useUiStore()
    expect(store.isLandingVisible).toBe(true)
  })

  it('dismissLanding() sets isLandingVisible to false', () => {
    const store = useUiStore()
    store.dismissLanding()
    expect(store.isLandingVisible).toBe(false)
  })

  it('dismissLanding() is idempotent (calling twice still false)', () => {
    const store = useUiStore()
    store.dismissLanding()
    store.dismissLanding()
    expect(store.isLandingVisible).toBe(false)
  })

  it('isLandingVisible is orthogonal to topologyConfirmed (confirmTopology does not change isLandingVisible)', () => {
    const store = useUiStore()
    store.confirmTopology()
    expect(store.isLandingVisible).toBe(true)
  })
})

describe('uiStore -- chartImages registry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('chartImages initializes to empty object {}', () => {
    const store = useUiStore()
    expect(store.chartImages).toEqual({})
  })

  it('registerChartImage stores value at chartImages[domainId][chartType]', () => {
    const store = useUiStore()
    store.registerChartImage('domain-1', 'cores', 'data:image/png;base64,abc')
    expect(store.chartImages['domain-1']['cores']).toBe('data:image/png;base64,abc')
  })

  it('registerChartImage for a second domain creates a separate nested record', () => {
    const store = useUiStore()
    store.registerChartImage('domain-1', 'cores', 'data:image/png;base64,abc')
    store.registerChartImage('domain-2', 'ram', 'data:image/png;base64,xyz')
    expect(store.chartImages['domain-1']['cores']).toBe('data:image/png;base64,abc')
    expect(store.chartImages['domain-2']['ram']).toBe('data:image/png;base64,xyz')
  })

  it('registerChartImage for same domainId + chartType overwrites previous value', () => {
    const store = useUiStore()
    store.registerChartImage('domain-1', 'cores', 'data:image/png;base64,old')
    store.registerChartImage('domain-1', 'cores', 'data:image/png;base64,new')
    expect(store.chartImages['domain-1']['cores']).toBe('data:image/png;base64,new')
  })
})

describe('uiStore -- localeLoading guard (PITFALL-10)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('localeLoading initializes to false', () => {
    const store = useUiStore()
    expect(store.localeLoading).toBe(false)
  })

  it('localeLoading remains false after setLocale("en") (bundled, no async)', async () => {
    const store = useUiStore()
    await store.setLocale('en')
    expect(store.localeLoading).toBe(false)
  })
})
