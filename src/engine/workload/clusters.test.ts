import { describe, it, expect } from 'vitest'
import { splitIntoClusters } from './clusters'
import type { ClusterSplitInputs } from './types'

function inp(o: Partial<ClusterSplitInputs> = {}): ClusterSplitInputs {
  return {
    demandHostsPerSite: 79,
    deploymentMode: 'stretch',
    storageType: 'fc',
    hostFailuresToTolerate: 1,
    ...o,
  }
}

describe('splitIntoClusters', () => {
  it('report scenario: FC stretch 79/site, N+1 → 2 clusters/site, 41/cluster, 164 total', () => {
    const r = splitIntoClusters(inp())
    expect(r.maxHostsPerCluster).toBe(48) // FC stretched per-site cap
    expect(r.clusterCountPerSite).toBe(2) // ceil(79/48)
    expect(r.hostsPerCluster).toBe(41) // ceil(79/2)=40 + 1 HA
    expect(r.hostsPerSite).toBe(82)
    expect(r.totalHosts).toBe(164) // ×2 sites
    expect(r.exceedsSingleCluster).toBe(true)
    expect(r.clusters).toHaveLength(4) // 2 sites × 2 clusters
    expect(r.clusters.filter(c => c.site === 'preferred')).toHaveLength(2)
  })

  it('vSAN single cluster (≤64) with N+1', () => {
    const r = splitIntoClusters(inp({ demandHostsPerSite: 50, deploymentMode: 'ha', storageType: 'vsan-esa' }))
    expect(r.maxHostsPerCluster).toBe(64)
    expect(r.clusterCountPerSite).toBe(1)
    expect(r.hostsPerCluster).toBe(51) // 50 + 1
    expect(r.hostsPerSite).toBe(51)
    expect(r.totalHosts).toBe(51) // not stretched
    expect(r.exceedsSingleCluster).toBe(false)
    expect(r.clusters).toHaveLength(1)
    expect(r.clusters[0].site).toBe('single')
  })

  it('vSAN splits above 64 hosts; each cluster ≤ 64', () => {
    const r = splitIntoClusters(inp({ demandHostsPerSite: 130, deploymentMode: 'simple', storageType: 'vsan-esa', hostFailuresToTolerate: 0 }))
    expect(r.clusterCountPerSite).toBe(3) // ceil(130/64)
    expect(r.hostsPerCluster).toBe(44) // ceil(130/3) + 0
    expect(r.hostsPerCluster).toBeLessThanOrEqual(64)
    expect(r.hostsPerSite).toBe(132)
  })

  it('stretched vSAN respects the 20-data-hosts-per-site cap', () => {
    const r = splitIntoClusters(inp({ demandHostsPerSite: 25, deploymentMode: 'stretch', storageType: 'vsan-esa' }))
    expect(r.maxHostsPerCluster).toBe(20)
    expect(r.clusterCountPerSite).toBe(2) // ceil(25/20)
    expect(r.exceedsSingleCluster).toBe(true)
    r.clusters.forEach(c => expect(c.demandHosts).toBeLessThanOrEqual(20))
  })

  it('HA reserve is additive per cluster; 0 for simple', () => {
    const ha = splitIntoClusters(inp({ demandHostsPerSite: 10, deploymentMode: 'ha', storageType: 'vsan-esa', hostFailuresToTolerate: 1 }))
    expect(ha.hostsPerCluster).toBe(11)
    const simple = splitIntoClusters(inp({ demandHostsPerSite: 10, deploymentMode: 'simple', storageType: 'vsan-esa', hostFailuresToTolerate: 0 }))
    expect(simple.hostsPerCluster).toBe(10)
  })
})
