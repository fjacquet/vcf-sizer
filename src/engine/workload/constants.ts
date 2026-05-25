// VCF 9.1 Workload Sizing — cluster maximums & sizing constants
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)
//
// Researched against VCF/vSphere/vSAN 9.1 (GA ~May 2026). VCF 9.1 introduced NO
// cluster-scale changes vs 9.0, so these caps carry forward. Centralized here so a
// single edit corrects them once re-confirmed against configmax.broadcom.com (vSphere 9.1)
// and the VCF 9.1 BOM.
//
// Sources:
//  - Working with Workload Domains (VCF 9): VI WLD vSAN clusters scale to the vSphere max of 64.
//  - vSAN Stretched Cluster Guide: 20 + 20 + 1 (20 data hosts per site, 40 total + witness).
//  - configmax.broadcom.com vSphere 8/9: 96 hosts per (non-vSAN) vSphere cluster.

/** Standard vSAN cluster (ESA & OSA) host maximum. */
export const MAX_HOSTS_PER_VSAN_CLUSTER = 64

/** vSAN stretched cluster: max data hosts PER SITE (20 + 20 + witness). */
export const MAX_HOSTS_PER_VSAN_STRETCHED_SITE = 20

/** Non-vSAN (FC/NFS) vSphere cluster host maximum. */
export const MAX_HOSTS_PER_VSPHERE_CLUSTER = 96

/** Non-vSAN stretched (vMSC) per-site cap = 96 total / 2 symmetric sites. */
export const MAX_HOSTS_PER_VSPHERE_STRETCHED_SITE = 48

/** VCF VI workload-domain cluster minimum. */
export const MIN_HOSTS_PER_CLUSTER = 3

/** Default failover (HA) reserve hosts per cluster — N+1. User-overridable per domain. */
export const DEFAULT_HOST_FAILURES_TO_TOLERATE = 1
