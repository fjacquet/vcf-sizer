/// <reference types="vitest/globals" />
import { calcWldOverhead, pickVcenterSize, pickNsxSize } from './wldOverhead'
import type { WorkloadDomainConfig } from '../types'

function wld(overrides: Partial<WorkloadDomainConfig> = {}): WorkloadDomainConfig {
  return {
    id: 'w01',
    name: 'wld-01',
    coresPerSocket: 32,
    socketsPerHost: 2,
    hostRamGB: 512,
    hostStorageTiB: 8,
    externalStorageUsableTiB: 0,
    hostCount: 4,
    nvmeTieringEnabled: false,
    activeMemoryPct: 50,
    preferredSiteHosts: 4,
    secondarySiteHosts: 4,
    vmCount: 100,
    avgVcpuPerVm: 2,
    avgVramGbPerVm: 4,
    avgStorageGbPerVm: 100,
    cpuOvercommitRatio: 4,
    ramOvercommitRatio: 1,
    gpuVmCount: 0,
    vgpuMemoryGB: 16,
    storageType: 'vsan-esa',
    fttLevel: 1,
    raidType: 'raid5',
    dedupEnabled: false,
    dedupRatio: 1,
    vsanMaxProfile: 'med',
    vsanMaxStorageNodes: 4,
    networkSpeedGbE: 25,
    deploymentMode: 'simple',
    ...overrides,
  }
}

describe('pickVcenterSize — VMware Supported Limits table', () => {
  it('≤ 10 hosts AND ≤ 100 VMs → Tiny', () => {
    expect(pickVcenterSize(100, 10)).toBe('tiny')
  })
  it('≤ 100 hosts AND ≤ 1000 VMs → Small', () => {
    expect(pickVcenterSize(1000, 100)).toBe('small')
  })
  it('≤ 400 hosts AND ≤ 4000 VMs → Medium', () => {
    expect(pickVcenterSize(4000, 400)).toBe('medium')
  })
  it('≤ 1000 hosts AND ≤ 10000 VMs → Large', () => {
    expect(pickVcenterSize(10000, 1000)).toBe('large')
  })
  it('> 1000 hosts OR > 10000 VMs → XLarge', () => {
    expect(pickVcenterSize(10001, 1000)).toBe('xlarge')
    expect(pickVcenterSize(10000, 1001)).toBe('xlarge')
  })
  it('takes the larger required size when host vs VM dimensions disagree', () => {
    // 50 hosts fits Small (≤100), but 2000 VMs requires Medium (≤4000) — take Medium.
    expect(pickVcenterSize(2000, 50)).toBe('medium')
  })
})

describe('pickNsxSize — NSX Manager support tiers by host count', () => {
  it('≤ 128 hosts → Medium', () => {
    expect(pickNsxSize(128)).toBe('medium')
    expect(pickNsxSize(1)).toBe('medium')
  })
  it('≤ 1024 hosts → Large', () => {
    expect(pickNsxSize(129)).toBe('large')
    expect(pickNsxSize(1024)).toBe('large')
  })
  it('> 1024 hosts → XLarge', () => {
    expect(pickNsxSize(1025)).toBe('xlarge')
  })
})

describe('calcWldOverhead — empty input', () => {
  it('zero WLDs → empty array', () => {
    expect(calcWldOverhead([])).toEqual([])
  })
})

describe('calcWldOverhead — single WLD, default-sized', () => {
  it('emits 1 vCenter Tiny + 1 NSX Manager Medium (Simple → nodeCount=1)', () => {
    const lines = calcWldOverhead([wld({ hostCount: 4, vmCount: 100, deploymentMode: 'simple' })])
    expect(lines.length).toBe(2)
    const vc = lines.find(l => l.category === 'wldVcenter')
    const nsx = lines.find(l => l.category === 'wldNsxManager')
    expect(vc).toBeDefined()
    expect(nsx).toBeDefined()
    expect(vc!.cores).toBe(2)         // Tiny: 4 hosts ≤ 10 AND 100 VMs ≤ 100
    expect(nsx!.cores).toBe(6)        // Medium NSX
    expect(nsx!.nodeCount).toBe(1)    // Simple mode
    expect(vc!.source).toBe('auto-derived')
    expect(nsx!.source).toBe('auto-derived')
  })

  it('HA WLD: NSX Manager nodeCount = 3', () => {
    const lines = calcWldOverhead([wld({ deploymentMode: 'ha' })])
    const nsx = lines.find(l => l.category === 'wldNsxManager')!
    expect(nsx.nodeCount).toBe(3)
    expect(nsx.totalCores).toBe(18)   // 6 × 3
  })

  it('Stretch WLD: NSX Manager nodeCount = 3 (same as HA)', () => {
    const lines = calcWldOverhead([wld({ deploymentMode: 'stretch' })])
    const nsx = lines.find(l => l.category === 'wldNsxManager')!
    expect(nsx.nodeCount).toBe(3)
  })
})

describe('calcWldOverhead — multiple WLDs', () => {
  it('5 WLDs → 10 lines (1 vCenter + 1 NSX Manager cluster per WLD)', () => {
    const lines = calcWldOverhead([
      wld({ id: 'w01' }), wld({ id: 'w02' }), wld({ id: 'w03' }),
      wld({ id: 'w04' }), wld({ id: 'w05' }),
    ])
    expect(lines.length).toBe(10)
    expect(lines.filter(l => l.category === 'wldVcenter').length).toBe(5)
    expect(lines.filter(l => l.category === 'wldNsxManager').length).toBe(5)
  })

  it('large WLD: vCenter Medium + NSX Manager Large × 3 in HA', () => {
    const lines = calcWldOverhead([
      wld({ vmCount: 3000, hostCount: 200, deploymentMode: 'ha' }),
    ])
    const vc = lines.find(l => l.category === 'wldVcenter')!
    const nsx = lines.find(l => l.category === 'wldNsxManager')!
    expect(vc.cores).toBe(8)          // Medium
    expect(nsx.cores).toBe(12)        // Large per-node
    expect(nsx.nodeCount).toBe(3)
    expect(nsx.totalCores).toBe(36)
  })
})
