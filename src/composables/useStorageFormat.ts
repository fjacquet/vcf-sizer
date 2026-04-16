// Vue composable wrapper for centralized storage formatting
// Reads storageUnit preference from uiStore and provides reactive fmt() helper

import { computed } from 'vue'
import { useUiStore } from '@/stores/uiStore'
import { formatStorage, type StorageUnit } from '@/utils/formatStorage'

export function useStorageFormat() {
  const ui = useUiStore()
  const unit = computed<StorageUnit>(() => ui.storageUnit)

  /** Format a TiB value using the user's selected display unit */
  const fmt = (valueTiB: number, precision = 2): string =>
    formatStorage(valueTiB, unit.value, precision)

  return { unit, fmt }
}
