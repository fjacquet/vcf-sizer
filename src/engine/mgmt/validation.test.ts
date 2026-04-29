/// <reference types="vitest/globals" />
import { validateMgmt } from './validation'
import type { ManagementDomainConfig, MgmtDomainResult, ApplianceLine } from './types'

function baseConfig(): ManagementDomainConfig {
  return {
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 8,
    deploymentMode: 'simple',
    profile: 'standard',
    overrides: {},
    validatedSolutions: {
      siteProtection: { included: false },
      ransomwareOnPrem: { included: false },
      ransomwareCloud: { included: false },
      crossCloudMobility: { included: false },
    },
    cpuOversubscription: 2,
    ramOversubscription: 1,
    reservePct: 30,
    growthPct: 10,
    storageType: 'vsan-esa',
  }
}

function baseResult(overrides: Partial<MgmtDomainResult> = {}): MgmtDomainResult {
  return {
    appliances: [],
    wldOverhead: [],
    totalCores: 50,
    totalRamGB: 200,
    totalDiskGB: 1000,
    totalSwapGB: 200,
    perHostCores: 0,
    perHostRamGB: 0,
    perHostStorageGB: 0,
    storageDemandTiB: 0,
    minHostsForStorage: 0,
    externalPoolRequiredTiB: 0,
    recommendedHostCount: 4,
    validationWarnings: [],
    ...overrides,
  }
}

function appliance(category: string, nodeCount: number): ApplianceLine {
  return {
    category: category as ApplianceLine['category'],
    nodeCount, cores: 1, ramGB: 1, diskGB: 0,
    totalCores: nodeCount, totalRamGB: nodeCount, totalDiskGB: 0,
    source: 'profile',
  }
}

describe('validateMgmt — MGMT-EDGE-PAIR (warning)', () => {
  it('flags when nsxEdge included with nodeCount < 2', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('nsxEdge', 1)] })
    const warns = validateMgmt(cfg, result)
    expect(warns.find(w => w.code === 'MGMT-EDGE-PAIR')).toMatchObject({
      severity: 'warning',
      messageKey: 'validation.mgmt.edgePairRequired',
    })
  })

  it('does not flag when nsxEdge nodeCount >= 2', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('nsxEdge', 2)] })
    const warns = validateMgmt(cfg, result)
    expect(warns.find(w => w.code === 'MGMT-EDGE-PAIR')).toBeUndefined()
  })

  it('does not flag when nsxEdge is excluded', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [] })
    const warns = validateMgmt(cfg, result)
    expect(warns.find(w => w.code === 'MGMT-EDGE-PAIR')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-AVI-CLUSTER (warning)', () => {
  it('flags when aviLb nodeCount < 3', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('aviLb', 2)] })
    const warns = validateMgmt(cfg, result)
    expect(warns.find(w => w.code === 'MGMT-AVI-CLUSTER')).toMatchObject({
      severity: 'warning',
      messageKey: 'validation.mgmt.aviClusterRequired',
    })
  })

  it('does not flag when aviLb nodeCount = 3', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('aviLb', 3)] })
    expect(validateMgmt(cfg, result).find(w => w.code === 'MGMT-AVI-CLUSTER')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-SSP-HOSTS (error)', () => {
  it('errors when ssp included and recommendedHostCount < 8', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('ssp', 1)], recommendedHostCount: 4 })
    const warns = validateMgmt(cfg, result)
    expect(warns.find(w => w.code === 'MGMT-SSP-HOSTS')).toMatchObject({
      severity: 'error',
      messageKey: 'validation.mgmt.sspMinHosts',
    })
  })

  it('does not error when ssp included and recommendedHostCount >= 8', () => {
    const cfg = baseConfig()
    const result = baseResult({ appliances: [appliance('ssp', 1)], recommendedHostCount: 8 })
    expect(validateMgmt(cfg, result).find(w => w.code === 'MGMT-SSP-HOSTS')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-OVERSUB-RANGE (warning)', () => {
  it('flags when cpuOversubscription > 4', () => {
    const cfg = { ...baseConfig(), cpuOversubscription: 5 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-OVERSUB-RANGE'))
      .toMatchObject({ severity: 'warning' })
  })

  it('flags when ramOversubscription > 1.5', () => {
    const cfg = { ...baseConfig(), ramOversubscription: 2 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-OVERSUB-RANGE'))
      .toMatchObject({ severity: 'warning' })
  })

  it('does not flag default 2:1 / 1:1', () => {
    const cfg = baseConfig()
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-OVERSUB-RANGE')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-RESERVE-RANGE (warning)', () => {
  it('flags reservePct < 15', () => {
    const cfg = { ...baseConfig(), reservePct: 10 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-RESERVE-RANGE'))
      .toMatchObject({ severity: 'warning' })
  })

  it('flags reservePct > 50', () => {
    const cfg = { ...baseConfig(), reservePct: 60 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-RESERVE-RANGE'))
      .toMatchObject({ severity: 'warning' })
  })

  it('does not flag reservePct in range [15, 50]', () => {
    expect(validateMgmt({ ...baseConfig(), reservePct: 30 }, baseResult())
      .find(w => w.code === 'MGMT-RESERVE-RANGE')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-FC-NEEDS-POOL (error)', () => {
  it('errors when storageType is fc and externalStorageUsableTiB is undefined', () => {
    const cfg = { ...baseConfig(), storageType: 'fc' as const, externalStorageUsableTiB: undefined }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-FC-NEEDS-POOL'))
      .toMatchObject({ severity: 'error', messageKey: 'validation.mgmt.externalPoolRequired' })
  })

  it('errors when storageType is nfs and externalStorageUsableTiB is undefined', () => {
    const cfg = { ...baseConfig(), storageType: 'nfs' as const, externalStorageUsableTiB: undefined }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-FC-NEEDS-POOL'))
      .toMatchObject({ severity: 'error' })
  })

  it('does not error when fc/nfs and externalStorageUsableTiB is provided', () => {
    const cfg = { ...baseConfig(), storageType: 'fc' as const, externalStorageUsableTiB: 10 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-FC-NEEDS-POOL')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-VSANMAX-NODES (error)', () => {
  it('errors when vsan-max and storage nodes < 4', () => {
    const cfg = { ...baseConfig(), storageType: 'vsan-max' as const, vsanMaxStorageNodes: 3 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-VSANMAX-NODES'))
      .toMatchObject({ severity: 'error' })
  })

  it('does not error when vsan-max and >= 4 nodes', () => {
    const cfg = { ...baseConfig(), storageType: 'vsan-max' as const, vsanMaxStorageNodes: 4 }
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-VSANMAX-NODES')).toBeUndefined()
  })
})

describe('validateMgmt — MGMT-VALIDATED-COUNT (warning)', () => {
  it('flags when ≥ 3 validated solutions enabled', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions!.siteProtection.included = true
    cfg.validatedSolutions!.ransomwareOnPrem.included = true
    cfg.validatedSolutions!.crossCloudMobility.included = true
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-VALIDATED-COUNT'))
      .toMatchObject({ severity: 'warning' })
  })

  it('does not flag when 2 enabled', () => {
    const cfg = baseConfig()
    cfg.validatedSolutions!.siteProtection.included = true
    cfg.validatedSolutions!.crossCloudMobility.included = true
    expect(validateMgmt(cfg, baseResult()).find(w => w.code === 'MGMT-VALIDATED-COUNT')).toBeUndefined()
  })
})
