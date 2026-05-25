// VCF 9.x Input Validation Engine
// Pure TypeScript — ZERO Vue imports allowed in this file (CALC-01)

// ─── Validation constants ───────────────────────────────────────────────────

// Stretch Cluster requires minimum 3 data hosts per site (STRCH-01)
export const STRETCH_MIN_HOSTS_PER_SITE = 3

// Dedicated management cluster requires minimum 4 hosts with vSAN (Broadcom KB 392993 — ARCH-01)
export const DEDICATED_MGMT_MIN_HOSTS = 4

// Stretch topology requires min 4 hosts per site × 2 sites = 8 total with vSAN (Broadcom KB 392993)
export const STRETCH_DEDICATED_MGMT_MIN_HOSTS = 8

// FC/NFS dedicated management — VCF 9.0 installer minimum (Broadcom KB 416270 — ARCH-01)
export const DEDICATED_MGMT_MIN_HOSTS_EXTERNAL = 2
export const STRETCH_DEDICATED_MGMT_MIN_HOSTS_EXTERNAL = 4
