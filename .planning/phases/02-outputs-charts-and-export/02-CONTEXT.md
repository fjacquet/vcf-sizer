# Phase 2: Outputs, Charts and Export — Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface the calculation engine results through a split-screen UI with real-time charts, a host-count summary card, shareable URL encoding, Markdown export, and browser-print PDF. Phase 2 does NOT add new inputs, new calculation formulas, or Phase 3 features (Stretch per-site inputs, NVMe tiering, GPU). The phase is complete when an architect can see their sizing visually, share a URL that restores their configuration, and export a formatted report.

</domain>

<decisions>
## Implementation Decisions

### Layout
- **CSS Grid split-screen**: left pane = input panel (existing App.vue content), right pane = results panel. No third-party split library needed — Tailwind CSS grid-cols-2 with responsive collapse to single column on mobile (`md:grid-cols-2`)
- On mobile: stack vertically, results below inputs
- Sticky header (with language switcher) stays across both panes

### Charts
- **Chart.js 4.x + vue-chartjs 5.x** — Bar charts for cores and RAM, Doughnut or stacked bar for storage breakdown
- **CRITICAL**: All Chart.js component instances must use `shallowRef` — NOT `ref` — to prevent Vue 3 reactivity recursion (documented Vue issue in PITFALLS.md). Pattern: `const chartData = shallowRef({ ... }); watch(source, () => { chartData.value = {...}; triggerRef(chartData) })`
- Three charts: CoresChart, RamChart, StorageChart
- Charts update on every input change — driven by `computed()` data from calculationStore
- Color scheme: use-over-capacity = red, safe capacity = green/teal, overhead = amber

### Host Count Summary Card
- Prominent card at top of results panel showing `recommendedHostCount` from calculationStore.compute
- Also shows minHostsForCpu and minHostsForRam for transparency
- Large number typography (Tailwind text-4xl or text-5xl)

### URL State Sharing (EXPORT-01, EXPORT-02)
- **lz-string** library for compression (NOT native btoa — URL length exceeds 2048 chars with full state)
- Serialize `inputStore.$state` → JSON → LZString.compressToEncodedURIComponent → append to URL as `?c=...`
- On app load: if `?c=` param present, decompress → parse JSON → validate schema → hydrate inputStore
- **Zod** for schema validation on URL load (PITFALLS.md: URL state is untrusted input)
- Base64URL safe: lz-string's `compressToEncodedURIComponent` is already URL-safe

### Markdown Export (EXPORT-03)
- Pure JavaScript string template — no library needed
- Report sections: Summary, Management Domain, Compute Sizing, Storage Sizing, Validation Warnings
- Uses values from calculationStore at time of export (snapshot, not live)
- Download via `URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }))`

### PDF Export (EXPORT-04)
- **`@media print` CSS only** — no html2canvas, no jsPDF, no dependencies
- Add `print:` Tailwind CSS variants to hide input panel, show results panel full-width, hide buttons
- `window.print()` triggers browser's native PDF save
- Zero dependencies, zero file size issues

### Results Panel Component Structure
```
ResultsPanel.vue
├── HostCountCard.vue          (recommendedHostCount, min CPU hosts, min RAM hosts)
├── charts/
│   ├── CoresChart.vue         (bar: required vs available cores)
│   ├── RamChart.vue           (bar: required vs available RAM)
│   └── StorageChart.vue       (stacked bar: usable vs each overhead layer)
└── ExportToolbar.vue          (Share URL button, Markdown download, Print/PDF button)
```

### Claude's Discretion
- Exact Tailwind classes and spacing within results panel
- Chart color palette (must remain accessible — avoid red/green only)
- Exact Markdown report template content/ordering
- Whether to use vue-chartjs `Bar` component or raw Chart.js imperative API (vue-chartjs is preferred)

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — Phase 2 requirements: VIZ-01–07, EXPORT-01–04
- `.planning/research/PITFALLS.md` — Chart.js shallowRef pattern, lz-string vs btoa, html2canvas trap
- `.planning/research/STACK.md` — Chart.js + vue-chartjs versions, lz-string

### Phase 1 outputs consumed by Phase 2
- `src/stores/calculationStore.ts` — management, compute, storage, validationErrors (all computed())
- `src/stores/inputStore.ts` — full $state shape for URL serialization
- `src/engine/types.ts` — ComputeResult, StorageResult, MgmtDomainResult interfaces

**calculationStore API (read-only):**
- `compute.totalCoresRequired`, `compute.availableCores`, `compute.coreUtilizationPct`
- `compute.totalRamRequiredGB`, `compute.availableRamGB`, `compute.ramUtilizationPct`
- `compute.recommendedHostCount`, `compute.minHostsForCpu`, `compute.minHostsForRam`
- `storage.rawCapacityTB`, `storage.safeUsableCapacityTB`, `storage.usableAfterRaidTB`
- `storage.lfsOverheadTB`, `storage.metadataOverheadTB`, `storage.raidScheme`
- `management.totalCores`, `management.totalRamGB`

</canonical_refs>

<code_context>
## Existing Code Insights

### What Phase 1 Delivered
- `src/App.vue` — single-column layout; Phase 2 converts this to split-screen grid
- `src/stores/calculationStore.ts` — all computed() results ready to drive charts
- `src/stores/inputStore.ts` — full reactive state; `inputStore.$state` is the URL serialization target
- `src/stores/uiStore.ts` — locale management
- `src/components/input/` — all 4 input forms (DeploymentModelSelector, HostSpecsForm, WorkloadProfileForm, StorageConfigForm)
- `src/components/shared/` — NumberSliderInput, ManagementSummary

### Integration Points
- `App.vue` refactor: wrap existing input column in left pane div, add right pane div with ResultsPanel
- ExportToolbar URL share: reads `useInputStore().$state`, compresses, writes to `window.location`
- URL hydration: runs in `main.ts` (or a composable) BEFORE `app.mount()` to avoid flash of default state

</code_context>

<specifics>
## Specific Requirements

- Charts must be readable in both light and browser-default dark mode (use CSS variables or neutral colors)
- The host count card must visually distinguish "you have enough hosts" (green) vs "not enough hosts" (red)
- Shareable URL copy must use `navigator.clipboard.writeText()` with a visible confirmation (button label changes to "Copied!")
- Print layout must hide the language switcher, input panel, and export toolbar; show only the results content

</specifics>

<deferred>
## Deferred (Phase 3 only)

- NVMe Memory Tiering inputs and visualization
- Stretch Cluster per-site inputs and witness overhead
- AI/GPU workload inputs
- FR/DE/IT locale completion
- Dark mode toggle (v2 backlog)

</deferred>

---
*Phase: 02-outputs-charts-and-export*
*Context gathered: 2026-03-28*
