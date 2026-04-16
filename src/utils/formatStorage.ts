// Central storage formatting — TiB/TB conversion + consistent precision
// Pure TypeScript, zero Vue imports (CALC-01 compliant)

export type StorageUnit = 'TiB' | 'TB'

/** 1 TiB = 2^40 bytes; 1 TB = 10^12 bytes → 1 TiB = 1.099511627776 TB */
const TIB_TO_TB = 1.099511627776

/**
 * Format a storage value (always stored internally as TiB) for display.
 * Converts to TB when requested, with configurable decimal precision.
 */
export function formatStorage(valueTiB: number, unit: StorageUnit, precision = 2): string {
  const converted = unit === 'TB' ? valueTiB * TIB_TO_TB : valueTiB
  return `${converted.toFixed(precision)} ${unit}`
}
