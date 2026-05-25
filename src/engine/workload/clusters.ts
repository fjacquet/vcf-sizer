// VCF 9.1 Workload Sizing — HA reserve + multi-cluster auto-split
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// A VCF workload domain is built from one or more vSphere clusters, each capped at a
// host maximum. When per-site demand exceeds that cap we split into N clusters and
// reserve HA (failover) capacity PER cluster. Demand is per site; stretch doubles the
// total at the topology layer (each site runs the full workload independently).

import type { ClusterSplitInputs, ClusterSplitResult, ClusterBreakdown, ClusterSite } from './types'
import {
  MAX_HOSTS_PER_VSAN_CLUSTER,
  MAX_HOSTS_PER_VSAN_STRETCHED_SITE,
  MAX_HOSTS_PER_VSPHERE_CLUSTER,
  MAX_HOSTS_PER_VSPHERE_STRETCHED_SITE,
} from './constants'

function maxHostsPerCluster(storageType: string, stretch: boolean): number {
  const isVsan = storageType === 'vsan-esa' || storageType === 'vsan-max'
  if (stretch) {
    return isVsan ? MAX_HOSTS_PER_VSAN_STRETCHED_SITE : MAX_HOSTS_PER_VSPHERE_STRETCHED_SITE
  }
  return isVsan ? MAX_HOSTS_PER_VSAN_CLUSTER : MAX_HOSTS_PER_VSPHERE_CLUSTER
}

/**
 * Split a site's host demand into clusters capped at the VMware maximum, adding an
 * HA reserve to each cluster.
 *
 *   maxPerCluster   = by storage type (vSAN 64 / vSphere 96; stretched per-site 20 / 48)
 *   clusterCount    = max(1, ceil(demandHostsPerSite / maxPerCluster))
 *   demandPerCluster= ceil(demandHostsPerSite / clusterCount)        (even distribution)
 *   hostsPerCluster = demandPerCluster + hostFailuresToTolerate      (HA reserve per cluster)
 *   hostsPerSite    = hostsPerCluster × clusterCount
 *   totalHosts      = stretch ? hostsPerSite × 2 : hostsPerSite
 */
export function splitIntoClusters(inputs: ClusterSplitInputs): ClusterSplitResult {
  const { demandHostsPerSite, deploymentMode, storageType, hostFailuresToTolerate } = inputs
  const stretch = deploymentMode === 'stretch'
  const reserve = Math.max(0, hostFailuresToTolerate)

  const maxPer = maxHostsPerCluster(storageType, stretch)
  const demand = Math.max(0, demandHostsPerSite)

  const clusterCountPerSite = Math.max(1, Math.ceil(demand / maxPer))
  const demandPerCluster = Math.ceil(demand / clusterCountPerSite)
  const hostsPerCluster = demandPerCluster + reserve
  const hostsPerSite = hostsPerCluster * clusterCountPerSite
  const totalHosts = stretch ? hostsPerSite * 2 : hostsPerSite

  const sites: ClusterSite[] = stretch ? ['preferred', 'secondary'] : ['single']
  const clusters: ClusterBreakdown[] = []
  let index = 0
  for (const site of sites) {
    for (let c = 0; c < clusterCountPerSite; c++) {
      clusters.push({
        index: index++,
        site,
        demandHosts: demandPerCluster,
        haReserveHosts: reserve,
        totalHosts: hostsPerCluster,
      })
    }
  }

  return {
    maxHostsPerCluster: maxPer,
    clusterCountPerSite,
    hostsPerCluster,
    demandHostsPerSite: demand,
    hostsPerSite,
    totalHosts,
    clusters,
    exceedsSingleCluster: clusterCountPerSite > 1,
  }
}
