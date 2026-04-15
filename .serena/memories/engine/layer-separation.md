# Architecture — Strict Layer Separation

## Rules
- **CALC-01**: Engine files (`src/engine/*.ts`) must have ZERO Vue/Pinia imports. Pure TypeScript + Decimal.js only.
- **CALC-02**: `calculationStore.ts` must have ZERO `ref()`. Only `computed()` values that call engine functions.
- **EXPORT-02**: All user-visible strings in exports via `i18n.global.t()` — never raw English strings.

## Layer Flow
1. **Engine** (`src/engine/`) — Pure functions: `calcCompute()`, `calcStorage()`, `calcStretch()`, `calcVsanMax()`, `calcManagement()`, `validateInputs()`
2. **Stores** (`src/stores/`) — `inputStore` (mutable `ref()`), `calculationStore` (read-only `computed()`), `uiStore` (locale/UI)
3. **Composables** (`src/composables/`) — `useMarkdownExport.ts`, `usePptxExport.ts`, `useUrlState.ts`. Plain TS modules, no Vue lifecycle hooks.
4. **Components** (`src/components/`) — Read from stores, never call engine directly.

## Multi-domain Pattern
- `inputStore.workloadDomains` is a `ref<WorkloadDomainConfig[]>`
- `calculationStore.domainResults` maps over domains, calling engine per domain
- Management overhead: colocated → WLD-1 absorbs; dedicated → separate hosts
- Exports loop over domains with per-domain sections
