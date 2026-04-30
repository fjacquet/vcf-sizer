# Storage Unit Formatting (TiB / TB)

## Centralized Utility
`src/utils/formatStorage.ts` — pure function, no Vue dependency:
```typescript
export type StorageUnit = 'TiB' | 'TB'
const TIB_TO_TB = 1.099511627776  // 2^40 / 10^12
formatStorage(valueTiB: number, unit: StorageUnit, precision = 2): string
```

## Vue Composable
`src/composables/useStorageFormat.ts` wraps utility with `uiStore.storageUnit`:
```typescript
const { fmt } = useStorageFormat()
fmt(rawTiB)  // '15.36 TiB' or '16.89 TB' based on user preference
```

## Store Integration
`uiStore.storageUnit: ref<StorageUnit>` with `setStorageUnit()` action.

## User Control
`LanguageSwitcher.vue` has two `<select>` dropdowns side-by-side:
- Locale (EN/FR/DE/IT) → `uiStore.setLocale()`
- Unit (TiB/TB) → `v-model="uiStore.storageUnit"`

## Rule
NEVER use inline `.toFixed(2) + ' TiB'` in components or exports. Always use `fmt()` (components) or `formatStorage(v, unit, p)` (pure modules).

Components using `useStorageFormat`: DomainResultCard, AggregateTotalsCard, VsanMaxClusterCard, StorageChart, StorageConfigForm.
Composables using `formatStorage` directly: useMarkdownExport, usePptxExport — pass `unit` as parameter to pure helper functions.

## Internal Representation
All internal values stay in TiB (engine contract). Conversion happens only at display boundaries.
