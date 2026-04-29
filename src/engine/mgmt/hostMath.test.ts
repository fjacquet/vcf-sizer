/// <reference types="vitest/globals" />
import { perHostRequirements } from './hostMath'

describe('perHostRequirements — N-1 capacity model', () => {
  it('divides total demand by (hosts−1) and applies CPU/RAM oversubscription separately', () => {
    const r = perHostRequirements({
      totalCores: 100,
      totalRamGB: 200,
      storageDemandGB: 1024,
      storageDemandTiB: 1,
      hosts: 5,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'vsan-esa',
    })
    // n = 4; cpu = ceil(100/4/2) = 13; ram = ceil(200/4/1) = 50; storage = ceil(1024/4) = 256
    expect(r.perHostCores).toBe(13)
    expect(r.perHostRamGB).toBe(50)
    expect(r.perHostStorageGB).toBe(256)
  })

  it('FC: zero per-host storage; full demand surfaces as externalPoolRequiredTiB', () => {
    const r = perHostRequirements({
      totalCores: 50,
      totalRamGB: 100,
      storageDemandGB: 2048,
      storageDemandTiB: 2,
      hosts: 4,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'fc',
    })
    expect(r.perHostStorageGB).toBe(0)
    expect(r.externalPoolRequiredTiB).toBe(2)
  })

  it('NFS: same FC behavior — external pool, zero per-host storage', () => {
    const r = perHostRequirements({
      totalCores: 50,
      totalRamGB: 100,
      storageDemandGB: 1024,
      storageDemandTiB: 1,
      hosts: 4,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'nfs',
    })
    expect(r.perHostStorageGB).toBe(0)
    expect(r.externalPoolRequiredTiB).toBe(1)
  })

  it('vSAN Max: per-host storage zero (compute hosts only); demand routed through storage cluster', () => {
    const r = perHostRequirements({
      totalCores: 50,
      totalRamGB: 100,
      storageDemandGB: 5120,
      storageDemandTiB: 5,
      hosts: 4,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'vsan-max',
    })
    expect(r.perHostStorageGB).toBe(0)
    expect(r.externalPoolRequiredTiB).toBe(0)
  })

  it('floor of 1 host on n: single-host cluster does not divide by 0', () => {
    const r = perHostRequirements({
      totalCores: 10,
      totalRamGB: 20,
      storageDemandGB: 100,
      storageDemandTiB: 1,
      hosts: 1,
      cpuOversubscription: 1,
      ramOversubscription: 1,
      storageType: 'vsan-esa',
    })
    // n = max(1−1, 1) = 1
    expect(r.perHostCores).toBe(10)
    expect(r.perHostRamGB).toBe(20)
    expect(r.perHostStorageGB).toBe(100)
  })

  it('CPU oversubscription applied independently from RAM oversubscription', () => {
    const r = perHostRequirements({
      totalCores: 80,
      totalRamGB: 80,
      storageDemandGB: 0,
      storageDemandTiB: 0,
      hosts: 3,
      cpuOversubscription: 4,
      ramOversubscription: 1,
      storageType: 'vsan-esa',
    })
    // n = 2; cpu = ceil(80/2/4) = 10; ram = ceil(80/2/1) = 40
    expect(r.perHostCores).toBe(10)
    expect(r.perHostRamGB).toBe(40)
  })

  it('rejects non-positive oversubscription', () => {
    expect(() => perHostRequirements({
      totalCores: 10, totalRamGB: 10, storageDemandGB: 0, storageDemandTiB: 0,
      hosts: 4, cpuOversubscription: 0, ramOversubscription: 1, storageType: 'vsan-esa',
    })).toThrow(/oversubscription/i)
    expect(() => perHostRequirements({
      totalCores: 10, totalRamGB: 10, storageDemandGB: 0, storageDemandTiB: 0,
      hosts: 4, cpuOversubscription: 2, ramOversubscription: -1, storageType: 'vsan-esa',
    })).toThrow(/oversubscription/i)
  })

  it('error message identifies cpu oversubscription specifically', () => {
    expect(() => perHostRequirements({
      totalCores: 10, totalRamGB: 10, storageDemandGB: 0, storageDemandTiB: 0,
      hosts: 4, cpuOversubscription: 0, ramOversubscription: 1, storageType: 'vsan-esa',
    })).toThrow(/cpuOversubscription/)
  })

  it('error message identifies ram oversubscription specifically', () => {
    expect(() => perHostRequirements({
      totalCores: 10, totalRamGB: 10, storageDemandGB: 0, storageDemandTiB: 0,
      hosts: 4, cpuOversubscription: 2, ramOversubscription: -1, storageType: 'vsan-esa',
    })).toThrow(/ramOversubscription/)
  })
})

describe('perHostRequirements — minHostsForCpu/Ram helpers', () => {
  it('exposes minHostsForCpu computed from totals and per-host capacity', () => {
    const r = perHostRequirements({
      totalCores: 100,
      totalRamGB: 200,
      storageDemandGB: 0,
      storageDemandTiB: 0,
      hosts: 5,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'vsan-esa',
      coresPerHost: 32,
      ramPerHost: 128,
    })
    // minHostsCpu = ceil(100 / 32 / 2) = 2
    // minHostsRam = ceil(200 / 128 / 1) = 2
    expect(r.minHostsForCpu).toBe(2)
    expect(r.minHostsForRam).toBe(2)
  })

  it('coresPerHost/ramPerHost optional — minHosts fields are 0 when omitted', () => {
    const r = perHostRequirements({
      totalCores: 100,
      totalRamGB: 200,
      storageDemandGB: 0,
      storageDemandTiB: 0,
      hosts: 5,
      cpuOversubscription: 2,
      ramOversubscription: 1,
      storageType: 'vsan-esa',
    })
    expect(r.minHostsForCpu).toBe(0)
    expect(r.minHostsForRam).toBe(0)
  })
})
