/// <reference types="vitest/globals" />
import { getApplianceSpec, SDDC_MANAGER_SPEC, FLEET_MANAGER_SPEC, VALIDATED_SOLUTIONS_SPECS } from './constants'

describe('getApplianceSpec — vCenter sizes (Appendix A)', () => {
  it('Tiny → 2 / 14 / 579', () => {
    expect(getApplianceSpec('vcenter', 'tiny')).toEqual({ cores: 2, ramGB: 14, diskGB: 579 })
  })
  it('Small → 4 / 21 / 694', () => {
    expect(getApplianceSpec('vcenter', 'small')).toEqual({ cores: 4, ramGB: 21, diskGB: 694 })
  })
  it('Medium → 8 / 30 / 908', () => {
    expect(getApplianceSpec('vcenter', 'medium')).toEqual({ cores: 8, ramGB: 30, diskGB: 908 })
  })
  it('Large → 16 / 39 / 1358', () => {
    expect(getApplianceSpec('vcenter', 'large')).toEqual({ cores: 16, ramGB: 39, diskGB: 1358 })
  })
  it('XLarge → 24 / 58 / 2283', () => {
    expect(getApplianceSpec('vcenter', 'xlarge')).toEqual({ cores: 24, ramGB: 58, diskGB: 2283 })
  })
})

describe('getApplianceSpec — NSX Manager sizes', () => {
  it('Medium → 6 / 24 / 300', () => {
    expect(getApplianceSpec('nsxManager', 'medium')).toEqual({ cores: 6, ramGB: 24, diskGB: 300 })
  })
  it('Large → 12 / 48 / 300', () => {
    expect(getApplianceSpec('nsxManager', 'large')).toEqual({ cores: 12, ramGB: 48, diskGB: 300 })
  })
  it('XLarge → 24 / 96 / 400', () => {
    expect(getApplianceSpec('nsxManager', 'xlarge')).toEqual({ cores: 24, ramGB: 96, diskGB: 400 })
  })
})

describe('getApplianceSpec — NSX Edge sizes', () => {
  it('Small → 2 / 4 / 200', () => {
    expect(getApplianceSpec('nsxEdge', 'small')).toEqual({ cores: 2, ramGB: 4, diskGB: 200 })
  })
  it('Medium → 4 / 8 / 200', () => {
    expect(getApplianceSpec('nsxEdge', 'medium')).toEqual({ cores: 4, ramGB: 8, diskGB: 200 })
  })
  it('Large → 8 / 32 / 200', () => {
    expect(getApplianceSpec('nsxEdge', 'large')).toEqual({ cores: 8, ramGB: 32, diskGB: 200 })
  })
  it('XLarge → 16 / 64 / 200', () => {
    expect(getApplianceSpec('nsxEdge', 'xlarge')).toEqual({ cores: 16, ramGB: 64, diskGB: 200 })
  })
})

describe('getApplianceSpec — AVI Load Balancer sizes', () => {
  it('Small → 6 / 32 / 512', () => {
    expect(getApplianceSpec('aviLb', 'small')).toEqual({ cores: 6, ramGB: 32, diskGB: 512 })
  })
  it('Large → 16 / 48 / 1400', () => {
    expect(getApplianceSpec('aviLb', 'large')).toEqual({ cores: 16, ramGB: 48, diskGB: 1400 })
  })
  it('XLarge → 16 / 64 / 1750', () => {
    expect(getApplianceSpec('aviLb', 'xlarge')).toEqual({ cores: 16, ramGB: 64, diskGB: 1750 })
  })
})

describe('getApplianceSpec — VCF Operations (vROps)', () => {
  it('Small → 4 / 16 / 274', () => {
    expect(getApplianceSpec('vrops', 'small')).toEqual({ cores: 4, ramGB: 16, diskGB: 274 })
  })
  it('Medium → 8 / 32 / 274', () => {
    expect(getApplianceSpec('vrops', 'medium')).toEqual({ cores: 8, ramGB: 32, diskGB: 274 })
  })
  it('Large → 16 / 48 / 274', () => {
    expect(getApplianceSpec('vrops', 'large')).toEqual({ cores: 16, ramGB: 48, diskGB: 274 })
  })
})

describe('getApplianceSpec — VCF Operations Collector', () => {
  it('Small → 4 / 16 / 264', () => {
    expect(getApplianceSpec('vropsCollector', 'small')).toEqual({ cores: 4, ramGB: 16, diskGB: 264 })
  })
  it('Standard → 8 / 48 / 264', () => {
    expect(getApplianceSpec('vropsCollector', 'standard')).toEqual({ cores: 8, ramGB: 48, diskGB: 264 })
  })
})

describe('getApplianceSpec — vRLI (Logs)', () => {
  it('Small → 4 / 8 / 530', () => {
    expect(getApplianceSpec('vrli', 'small')).toEqual({ cores: 4, ramGB: 8, diskGB: 530 })
  })
  it('Medium → 8 / 16 / 530', () => {
    expect(getApplianceSpec('vrli', 'medium')).toEqual({ cores: 8, ramGB: 16, diskGB: 530 })
  })
  it('Large → 16 / 32 / 530', () => {
    expect(getApplianceSpec('vrli', 'large')).toEqual({ cores: 16, ramGB: 32, diskGB: 530 })
  })
})

describe('getApplianceSpec — vRNI (Networks)', () => {
  it('Medium → 8 / 32 / 1024', () => {
    expect(getApplianceSpec('vrni', 'medium')).toEqual({ cores: 8, ramGB: 32, diskGB: 1024 })
  })
  it('Large → 12 / 48 / 1024', () => {
    expect(getApplianceSpec('vrni', 'large')).toEqual({ cores: 12, ramGB: 48, diskGB: 1024 })
  })
})

describe('getApplianceSpec — vRNI Collector', () => {
  it('Medium → 4 / 12 / 250', () => {
    expect(getApplianceSpec('vrniCollector', 'medium')).toEqual({ cores: 4, ramGB: 12, diskGB: 250 })
  })
})

describe('getApplianceSpec — VCF Automation', () => {
  it('Small → 24 / 96 / 455', () => {
    expect(getApplianceSpec('automation', 'small')).toEqual({ cores: 24, ramGB: 96, diskGB: 455 })
  })
  it('Medium → 24 / 96 / 334', () => {
    expect(getApplianceSpec('automation', 'medium')).toEqual({ cores: 24, ramGB: 96, diskGB: 334 })
  })
  it('Large → 32 / 128 / 430', () => {
    expect(getApplianceSpec('automation', 'large')).toEqual({ cores: 32, ramGB: 128, diskGB: 430 })
  })
})

describe('getApplianceSpec — Identity Broker (WSA)', () => {
  it('Medium → 8 / 16 / 220', () => {
    expect(getApplianceSpec('identityBroker', 'medium')).toEqual({ cores: 8, ramGB: 16, diskGB: 220 })
  })
})

describe('getApplianceSpec — SSP (Security Services Platform)', () => {
  it('Medium → 112 / 414 / 4096', () => {
    expect(getApplianceSpec('ssp', 'medium')).toEqual({ cores: 112, ramGB: 414, diskGB: 4096 })
  })
  it('Large → 160 / 606 / 5120', () => {
    expect(getApplianceSpec('ssp', 'large')).toEqual({ cores: 160, ramGB: 606, diskGB: 5120 })
  })
  it('XLarge → 192 / 734 / 6656', () => {
    expect(getApplianceSpec('ssp', 'xlarge')).toEqual({ cores: 192, ramGB: 734, diskGB: 6656 })
  })
})

describe('Always-on appliance specs (no size variants)', () => {
  it('SDDC Manager → 4 / 16 / 914', () => {
    expect(SDDC_MANAGER_SPEC).toEqual({ cores: 4, ramGB: 16, diskGB: 914 })
  })
  it('Fleet Manager → 4 / 12 / 194', () => {
    expect(FLEET_MANAGER_SPEC).toEqual({ cores: 4, ramGB: 12, diskGB: 194 })
  })
})

describe('Validated solution specs', () => {
  it('Site Protection / SRM Standard → 8 / 24 / 800', () => {
    expect(VALIDATED_SOLUTIONS_SPECS.siteProtection.standard).toEqual({ cores: 8, ramGB: 24, diskGB: 800 })
  })
  it('Site Protection / SRM Light → 2 / 8 / 20', () => {
    expect(VALIDATED_SOLUTIONS_SPECS.siteProtection.light).toEqual({ cores: 2, ramGB: 8, diskGB: 20 })
  })
  it('Ransomware Recovery (on-prem) → 24 / 800 (HVM)', () => {
    expect(VALIDATED_SOLUTIONS_SPECS.ransomwareOnPrem).toEqual({ cores: 24, ramGB: 800, diskGB: 0 })
  })
  it('Cloud Ransomware Connector → 8 / 12 / 100', () => {
    expect(VALIDATED_SOLUTIONS_SPECS.ransomwareCloud).toEqual({ cores: 8, ramGB: 12, diskGB: 100 })
  })
  it('HCX Connector → 4 / 12 / 65', () => {
    expect(VALIDATED_SOLUTIONS_SPECS.crossCloudMobility).toEqual({ cores: 4, ramGB: 12, diskGB: 65 })
  })
})

describe('getApplianceSpec — invalid lookups', () => {
  it('throws on unknown category', () => {
    // @ts-expect-error testing runtime safety
    expect(() => getApplianceSpec('bogus', 'medium')).toThrow(/unknown mgmt appliance/i)
  })
  it('throws on unknown size for known category', () => {
    // @ts-expect-error testing runtime safety
    expect(() => getApplianceSpec('vcenter', 'humongous')).toThrow(/unknown size/i)
  })
})
