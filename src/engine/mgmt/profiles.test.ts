/// <reference types="vitest/globals" />
import { resolveProfileEntry, PROFILES } from './profiles'

describe('resolveProfileEntry — Standard profile (Q4 default)', () => {
  it('vcenter → Medium × 1, included', () => {
    expect(resolveProfileEntry('standard', 'vcenter')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('nsxManager → Medium × 1 (HA fanout applied later by appliances.ts)', () => {
    expect(resolveProfileEntry('standard', 'nsxManager')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('nsxEdge → Large × 2, included (Q4: ON by default)', () => {
    expect(resolveProfileEntry('standard', 'nsxEdge')).toEqual({
      included: true, size: 'large', nodeCount: 2,
    })
  })
  it('aviLb → Small × 3, included (Q4: ON by default)', () => {
    expect(resolveProfileEntry('standard', 'aviLb')).toEqual({
      included: true, size: 'small', nodeCount: 3,
    })
  })
  it('vrops → Medium × 1, included (HA fanout later)', () => {
    expect(resolveProfileEntry('standard', 'vrops')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('vropsCollector → excluded by default (Standard profile)', () => {
    expect(resolveProfileEntry('standard', 'vropsCollector').included).toBe(false)
  })
  it('vrli → Medium × 1, included (Q4: ON; HA fanout later)', () => {
    expect(resolveProfileEntry('standard', 'vrli')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('vrni → Medium × 1, included (Q4: ON)', () => {
    expect(resolveProfileEntry('standard', 'vrni')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('vrniCollector → excluded by default (Standard profile)', () => {
    expect(resolveProfileEntry('standard', 'vrniCollector').included).toBe(false)
  })
  it('automation → Medium × 1, included (HA fanout later)', () => {
    expect(resolveProfileEntry('standard', 'automation')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('fleetManager → always included × 1', () => {
    expect(resolveProfileEntry('standard', 'fleetManager').included).toBe(true)
    expect(resolveProfileEntry('standard', 'fleetManager').nodeCount).toBe(1)
  })
  it('identityBroker → excluded by default (Q4: OFF)', () => {
    expect(resolveProfileEntry('standard', 'identityBroker').included).toBe(false)
  })
  it('ssp → excluded by default (Q4: OFF — opt-in only)', () => {
    expect(resolveProfileEntry('standard', 'ssp').included).toBe(false)
  })
})

describe('resolveProfileEntry — Lab profile', () => {
  it('vcenter → Small × 1', () => {
    expect(resolveProfileEntry('lab', 'vcenter')).toEqual({
      included: true, size: 'small', nodeCount: 1,
    })
  })
  it('nsxEdge → excluded (no edge in lab)', () => {
    expect(resolveProfileEntry('lab', 'nsxEdge').included).toBe(false)
  })
  it('aviLb → excluded (no LB in lab)', () => {
    expect(resolveProfileEntry('lab', 'aviLb').included).toBe(false)
  })
  it('vrli → excluded (no logging in lab)', () => {
    expect(resolveProfileEntry('lab', 'vrli').included).toBe(false)
  })
  it('vrni → excluded', () => {
    expect(resolveProfileEntry('lab', 'vrni').included).toBe(false)
  })
})

describe('resolveProfileEntry — Large profile', () => {
  it('vcenter → Large × 1', () => {
    expect(resolveProfileEntry('large', 'vcenter')).toEqual({
      included: true, size: 'large', nodeCount: 1,
    })
  })
  it('nsxEdge → XLarge × 2', () => {
    expect(resolveProfileEntry('large', 'nsxEdge')).toEqual({
      included: true, size: 'xlarge', nodeCount: 2,
    })
  })
  it('aviLb → Large × 3', () => {
    expect(resolveProfileEntry('large', 'aviLb')).toEqual({
      included: true, size: 'large', nodeCount: 3,
    })
  })
  it('vrops → Large × 1 (HA fanout later)', () => {
    expect(resolveProfileEntry('large', 'vrops')).toEqual({
      included: true, size: 'large', nodeCount: 1,
    })
  })
  it('vrniCollector → Medium × 1 (only enabled in Large)', () => {
    expect(resolveProfileEntry('large', 'vrniCollector')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('identityBroker → Medium × 1 (only enabled in Large)', () => {
    expect(resolveProfileEntry('large', 'identityBroker')).toEqual({
      included: true, size: 'medium', nodeCount: 1,
    })
  })
  it('ssp → still excluded (always opt-in regardless of profile)', () => {
    expect(resolveProfileEntry('large', 'ssp').included).toBe(false)
  })
})

describe('PROFILES table integrity', () => {
  it('every profile has an entry for every category', () => {
    const categories = [
      'vcenter','nsxManager','nsxEdge','aviLb','vrops','vropsCollector',
      'vrli','vrni','vrniCollector','automation','fleetManager',
      'identityBroker','ssp',
    ] as const
    for (const profile of ['lab','standard','large'] as const) {
      for (const cat of categories) {
        const entry = PROFILES[profile][cat]
        expect(entry, `${profile} missing ${cat}`).toBeDefined()
        expect(typeof entry.included).toBe('boolean')
        expect(typeof entry.size).toBe('string')
        expect(typeof entry.nodeCount).toBe('number')
      }
    }
  })
})
