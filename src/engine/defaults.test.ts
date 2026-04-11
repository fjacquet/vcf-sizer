/// <reference types="vitest/globals" />
import { createDefaultWorkloadDomain, createDefaultManagementDomain } from './defaults'

describe('createDefaultWorkloadDomain', () => {
  it('returns object with id as non-empty string', () => {
    const d = createDefaultWorkloadDomain(0)
    expect(typeof d.id).toBe('string')
    expect(d.id.length).toBeGreaterThan(0)
  })

  it('name is "WLD-1" when index is 0', () => {
    expect(createDefaultWorkloadDomain(0).name).toBe('WLD-1')
  })

  it('name is "WLD-3" when index is 2', () => {
    expect(createDefaultWorkloadDomain(2).name).toBe('WLD-3')
  })

  it('two calls produce different ids', () => {
    const a = createDefaultWorkloadDomain(0)
    const b = createDefaultWorkloadDomain(0)
    expect(a.id).not.toBe(b.id)
  })

  it('has all 26 WorkloadDomainConfig fields with correct defaults', () => {
    const d = createDefaultWorkloadDomain(0)
    expect(d.coresPerSocket).toBe(16)
    expect(d.socketsPerHost).toBe(2)
    expect(d.hostRamGB).toBe(512)
    expect(d.hostStorageTiB).toBe(3.84)
    expect(d.externalStorageUsableTiB).toBe(100)
    expect(d.hostCount).toBe(4)
    expect(d.nvmeTieringEnabled).toBe(false)
    expect(d.activeMemoryPct).toBe(50)
    expect(d.preferredSiteHosts).toBe(3)
    expect(d.secondarySiteHosts).toBe(3)
    expect(d.vmCount).toBe(100)
    expect(d.avgVcpuPerVm).toBe(4)
    expect(d.avgVramGbPerVm).toBe(8)
    expect(d.avgStorageGbPerVm).toBe(100)
    expect(d.cpuOvercommitRatio).toBe(4)
    expect(d.ramOvercommitRatio).toBe(1)
    expect(d.gpuVmCount).toBe(0)
    expect(d.vgpuMemoryGB).toBe(16)
    expect(d.storageType).toBe('vsan-esa')
    expect(d.fttLevel).toBe(1)
    expect(d.raidType).toBe('raid5')
    expect(d.dedupEnabled).toBe(false)
    expect(d.dedupRatio).toBe(2)
    expect(d.vsanMaxProfile).toBe('med')
    expect(d.vsanMaxStorageNodes).toBe(4)
    expect(d.networkSpeedGbE).toBe(25)
    expect(d.deploymentMode).toBe('ha')
  })
})

describe('createDefaultManagementDomain', () => {
  it('returns correct management host specs', () => {
    const m = createDefaultManagementDomain()
    expect(m.coresPerSocket).toBe(16)
    expect(m.socketsPerHost).toBe(2)
    expect(m.hostRamGB).toBe(512)
    expect(m.hostStorageTiB).toBe(3.84)
  })
})
