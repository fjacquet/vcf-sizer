# Phase 21: Per-Domain Chart Visualizations - Research

**Researched:** 2026-04-11
**Domain:** Chart.js / vue-chartjs per-instance rendering with PNG capture
**Confidence:** HIGH

## Summary

Phase 21 transforms the existing three singleton chart components (CoresChart, RamChart, StorageChart) into per-domain chart instances embedded inside each DomainResultCard. Currently, charts live in ResultsPanel.vue at the page level and hardcode `domainResults.value[0]` ("first-domain bridge"). The refactoring requires: (1) accepting domain result data via props instead of direct store access, (2) generating unique canvas IDs per domain to prevent Chart.js instance collisions, and (3) capturing PNG data URLs via `toBase64Image()` and registering them into `uiStore.chartImages[domainId]` for Phase 22 PPTX export.

The uiStore already has the `chartImages` registry and `registerChartImage(domainId, chartType, dataUrl)` action fully implemented and tested (Phase 18). Chart.js 4.5.1 and vue-chartjs 5.3.3 are already installed -- both are the latest stable versions. No new dependencies are needed.

**Primary recommendation:** Refactor chart components to accept `ComputeResult` / `StorageResult` + `domainId` as props, add unique canvas IDs via `id` attribute, disable animation (`animation: false`), and use `Chart.getChart(canvasId).toBase64Image()` in an `onMounted` / `watch` hook to register PNG images into uiStore.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHART-01 | Each workload domain result card shows its own Cores, RAM, and Storage charts (not a shared single chart set) | Refactor chart components to accept per-domain data via props; embed inside DomainResultCard; use unique canvas IDs to prevent Chart.js collisions; register PNGs via existing uiStore.chartImages registry |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chart.js | 4.5.1 | Canvas chart rendering | Already installed, latest stable [VERIFIED: npm registry] |
| vue-chartjs | 5.3.3 | Vue 3 wrapper for Chart.js | Already installed, latest stable [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vueuse/core | (already installed) | `usePreferredDark` for dark mode chart colors | Already used by all chart components |

### Alternatives Considered
None -- no new libraries needed. The existing chart stack covers all requirements.

**Installation:**
```bash
# No installation needed -- all dependencies are already present
```

## Architecture Patterns

### Current Architecture (Before Phase 21)
```
src/components/results/
  ResultsPanel.vue          # Renders DomainResultCard per domain + charts as siblings
  DomainResultCard.vue      # Shows domain data (no charts)
  charts/
    CoresChart.vue          # Singleton, reads domainResults[0] directly from store
    RamChart.vue             # Singleton, reads domainResults[0] directly from store
    StorageChart.vue         # Singleton, reads domainResults[0] directly from store
```

### Target Architecture (After Phase 21)
```
src/components/results/
  ResultsPanel.vue          # Renders DomainResultCard per domain (charts removed from here)
  DomainResultCard.vue      # Shows domain data + embeds 3 chart components with domain props
  charts/
    CoresChart.vue          # Accepts ComputeResult + domainId props, unique canvas ID
    RamChart.vue             # Accepts ComputeResult + domainId props, unique canvas ID
    StorageChart.vue         # Accepts StorageResult + domainId props, unique canvas ID
```

### Pattern 1: Props-Driven Chart Components
**What:** Chart components accept domain-specific data via props instead of reading from the store directly.
**When to use:** When the same chart component is rendered multiple times with different data (per-domain).
**Example:**
```typescript
// Source: Codebase analysis + Chart.js docs
// CoresChart.vue (refactored)
const props = defineProps<{
  compute: ComputeResult
  domainId: string
}>()

const canvasId = computed(() => `cores-chart-${props.domainId}`)

const chartData = computed((): ChartData<'bar'> => ({
  labels: [t('results.charts.required'), t('results.charts.available')],
  datasets: [{
    label: t('results.charts.cores'),
    data: [props.compute.totalCoresRequired, props.compute.availableCores],
    // ... colors
  }],
}))
```

### Pattern 2: Canvas ID Collision Prevention
**What:** Each chart canvas gets a unique ID derived from the domain ID to prevent Chart.js from confusing instances. [VERIFIED: STATE.md accumulated context]
**When to use:** Any time multiple instances of the same chart component coexist in the DOM.
**Example:**
```html
<!-- vue-chartjs Bar component with explicit canvas id -->
<Bar :id="canvasId" :data="chartData" :options="chartOptions" />
```

The vue-chartjs `Bar` component passes the `id` prop through to the underlying `<canvas>` element. [VERIFIED: vue-chartjs source code convention]

### Pattern 3: PNG Capture via Chart.getChart() + toBase64Image()
**What:** After chart renders, retrieve the Chart.js instance by canvas ID and export as PNG data URL. [VERIFIED: STATE.md v3.3 decisions]
**When to use:** When chart images need to be captured for export (PPTX).
**Example:**
```typescript
// Source: Chart.js API docs + STATE.md accumulated decisions
import { Chart as ChartJS } from 'chart.js'

// animation: false is REQUIRED — prevents blank PNG from toBase64Image() (Chart.js #2743)
const chartOptions = computed((): ChartOptions<'bar'> => ({
  animation: false,  // CRITICAL for PNG capture
  responsive: true,
  maintainAspectRatio: false,
  // ... rest of options
}))

// After render, capture PNG
onMounted(() => {
  nextTick(() => {
    const chart = ChartJS.getChart(canvasId.value)
    if (chart) {
      const dataUrl = chart.toBase64Image()
      uiStore.registerChartImage(props.domainId, 'cores', dataUrl)
    }
  })
})
```

### Pattern 4: Reactive PNG Re-capture on Data Change
**What:** When domain data changes (user adjusts inputs), the chart re-renders and the PNG must be re-captured.
**When to use:** To keep chartImages in sync with current chart visuals.
**Example:**
```typescript
// Watch for data changes and re-capture after vue-chartjs updates the chart
watch(() => props.compute, () => {
  nextTick(() => {
    const chart = ChartJS.getChart(canvasId.value)
    if (chart) {
      const dataUrl = chart.toBase64Image()
      uiStore.registerChartImage(props.domainId, 'cores', dataUrl)
    }
  })
}, { deep: true })
```

### Anti-Patterns to Avoid
- **Direct store access in chart components:** Reading `domainResults[0]` in chart components couples them to a single domain. Use props instead.
- **Using chartRef.value.chart:** vue-chartjs Composition API exposes a ref, but `.chart` is null (vue-chartjs #1012). Use `Chart.getChart(canvasId)` instead. [VERIFIED: STATE.md]
- **Shared canvas IDs:** Without per-domain IDs, Chart.js instances collide and only the last-rendered chart updates correctly.
- **Leaving animation enabled:** `animation: false` is required or `toBase64Image()` returns a blank PNG (Chart.js #2743). [VERIFIED: STATE.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom canvas drawing | Chart.js + vue-chartjs | Already working, tested, dark mode support |
| PNG capture | Manual canvas.toDataURL | Chart.getChart(id).toBase64Image() | Chart.js provides this natively; handles pixel ratio |
| Chart image registry | Custom event bus | uiStore.chartImages + registerChartImage() | Already built in Phase 18 with tests |
| Dark mode detection | Media query listener | usePreferredDark from @vueuse/core | Already used in all chart components |

**Key insight:** This phase is a refactoring exercise, not a greenfield build. All infrastructure exists -- the work is restructuring data flow from store-direct to props-driven and adding PNG capture hooks.

## Common Pitfalls

### Pitfall 1: Chart.js Instance Collision
**What goes wrong:** Multiple chart components with the same canvas ID (or no explicit ID) cause Chart.js to reuse or destroy the wrong instance.
**Why it happens:** vue-chartjs auto-generates canvas elements; without explicit IDs, Chart.js getChart() returns wrong instance.
**How to avoid:** Always pass `domainId`-based `:id` prop to `<Bar>` component: `cores-chart-${domainId}`.
**Warning signs:** Charts show data from wrong domain, or only the last domain's chart renders.

### Pitfall 2: Blank PNG from toBase64Image()
**What goes wrong:** `toBase64Image()` returns a blank/white image.
**Why it happens:** Called during animation before rendering completes (Chart.js #2743).
**How to avoid:** Set `animation: false` in chart options. [VERIFIED: STATE.md v3.3 decisions]
**Warning signs:** PPTX export shows white rectangles instead of charts.

### Pitfall 3: vue-chartjs ref.chart is null
**What goes wrong:** Attempting `chartRef.value.chart` returns null in Composition API.
**Why it happens:** vue-chartjs #1012 -- the `.chart` property is not exposed via template refs in Composition API mode.
**How to avoid:** Use `Chart.getChart(canvasId)` static method instead. [VERIFIED: STATE.md v3.3 decisions]
**Warning signs:** TypeError: Cannot read properties of null.

### Pitfall 4: PNG Not Updated After Data Change
**What goes wrong:** chartImages contains stale PNG after user changes domain inputs.
**Why it happens:** PNG capture only runs on mount, not on data updates.
**How to avoid:** Add a `watch` on the data prop with `nextTick` re-capture.
**Warning signs:** Exported PPTX shows old chart values after user adjusts sliders.

### Pitfall 5: Pinia Reactive Proxy in structuredClone
**What goes wrong:** `structuredClone(domainResult)` throws DataCloneError.
**Why it happens:** Pinia wraps objects in reactive proxies that cannot be structuredCloned (Pinia #1412).
**How to avoid:** Use `structuredClone(toRaw(domain))` if cloning is needed. For chart components, pass primitive computed values or use storeToRefs. [VERIFIED: STATE.md]
**Warning signs:** Runtime error when trying to clone store data for chart props.

## Code Examples

### DomainResultCard.vue Integration
```vue
<!-- Source: Codebase analysis — DomainResultCard.vue target structure -->
<script setup lang="ts">
import type { DomainResult } from '@/engine/types'
import CoresChart from './charts/CoresChart.vue'
import RamChart from './charts/RamChart.vue'
import StorageChart from './charts/StorageChart.vue'

const props = defineProps<{ result: DomainResult }>()
</script>

<template>
  <div class="...">
    <h2>{{ result.name }}</h2>
    <!-- ... existing host count and utilization grid ... -->

    <!-- Per-domain charts -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <CoresChart :compute="result.compute" :domain-id="result.id" />
      <RamChart :compute="result.compute" :domain-id="result.id" />
      <StorageChart :storage="result.storage" :domain-id="result.id" />
    </div>
  </div>
</template>
```

### Refactored CoresChart.vue (Full Pattern)
```vue
<!-- Source: Synthesis of codebase + Chart.js API + STATE.md decisions -->
<script setup lang="ts">
import { computed, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferredDark } from '@vueuse/core'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'
import type { ComputeResult } from '@/engine/types'
import { useUiStore } from '@/stores/uiStore'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps<{
  compute: ComputeResult
  domainId: string
}>()

const { t } = useI18n()
const isDark = usePreferredDark()
const uiStore = useUiStore()

const canvasId = computed(() => `cores-chart-${props.domainId}`)

const chartData = computed((): ChartData<'bar'> => ({
  labels: [t('results.charts.required'), t('results.charts.available')],
  datasets: [{
    label: t('results.charts.cores'),
    data: [props.compute.totalCoresRequired, props.compute.availableCores],
    backgroundColor: [
      props.compute.totalCoresRequired > props.compute.availableCores
        ? 'rgba(239,68,68,0.75)' : 'rgba(20,184,166,0.75)',
      'rgba(100,116,139,0.4)',
    ],
  }],
}))

const chartOptions = computed((): ChartOptions<'bar'> => {
  const tickColor = isDark.value ? 'rgb(156,163,175)' : 'rgb(75,85,99)'
  const gridColor = isDark.value ? 'rgba(75,85,99,0.3)' : 'rgba(156,163,175,0.3)'
  return {
    animation: false,  // REQUIRED for toBase64Image() (Chart.js #2743)
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      y: { beginAtZero: true, ticks: { color: tickColor }, grid: { color: gridColor } },
      x: { ticks: { color: tickColor }, grid: { color: gridColor } },
    },
  }
})

function captureChartImage(): void {
  nextTick(() => {
    const chart = ChartJS.getChart(canvasId.value)
    if (chart) {
      uiStore.registerChartImage(props.domainId, 'cores', chart.toBase64Image())
    }
  })
}

onMounted(captureChartImage)
watch(() => props.compute, captureChartImage, { deep: true })
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ t('results.charts.cores') }}</h3>
    <div class="h-48 relative print:hidden">
      <Bar :id="canvasId" :data="chartData" :options="chartOptions" />
    </div>
    <!-- Print fallback table unchanged -->
  </div>
</template>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Singleton charts reading store[0] | Per-domain charts via props | Phase 21 | Enables multi-domain visualization |
| No PNG capture | Chart.getChart(id).toBase64Image() | Phase 21 | Enables PPTX chart embedding (Phase 22) |
| chartRef.value.chart | Chart.getChart(canvasId) | chart.js v4 / vue-chartjs v5 | Avoids null ref bug in Composition API |

**Deprecated/outdated:**
- The "first-domain bridge" pattern (`domainResults.value[0]`) in chart components is the explicit tech debt being retired in this phase. [VERIFIED: codebase comments]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | vue-chartjs `<Bar>` passes `:id` prop through to `<canvas>` element | Architecture Patterns | Canvas ID won't be set; Chart.getChart() will fail -- verify by inspecting rendered DOM |
| A2 | `nextTick` after `onMounted` is sufficient timing for Chart.js to complete rendering with `animation: false` | Code Examples | PNG capture could still be blank; may need requestAnimationFrame fallback |

## Open Questions

1. **Should charts be removed from ResultsPanel.vue entirely?**
   - What we know: Currently CoresChart, RamChart, StorageChart are NOT rendered in ResultsPanel.vue (they appear to be imported elsewhere or are orphaned page-level components)
   - What's unclear: Whether any other component currently renders these charts at page level
   - Recommendation: Grep for chart component usage; if only ResultsPanel imports them, remove those imports after moving charts into DomainResultCard

2. **Print fallback tables in chart components**
   - What we know: Each chart component has a `print:table` fallback that shows data
   - What's unclear: Whether the print table should show per-domain data (it will automatically once using props)
   - Recommendation: Print tables will naturally use prop data -- no special handling needed

## Project Constraints (from CLAUDE.md)

- Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library (CALC-01) -- charts are components, not engine, so no conflict
- `calculationStore.ts` must never contain `ref()` -- only `computed()` (CALC-02) -- charts read from store, do not modify it
- Validation warnings must use i18n message keys, never raw English strings
- Chart PNG capture uses `Chart.getChart(canvasId)` not `chartRef.value.chart` (STATE.md v3.3 decision)
- `animation: false` required on all per-domain charts (STATE.md v3.3 decision)
- Per-domain canvas IDs must be derived from `domain.id` (STATE.md v3.3 decision)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: CoresChart.vue, RamChart.vue, StorageChart.vue, DomainResultCard.vue, ResultsPanel.vue, uiStore.ts
- .planning/STATE.md accumulated context (v3.3-specific decisions on Chart.js patterns)
- npm registry: chart.js@4.5.1, vue-chartjs@5.3.3 (verified current/latest)

### Secondary (MEDIUM confidence)
- [Chart.js API docs](https://www.chartjs.org/docs/latest/developers/api.html) - Chart.getChart(), toBase64Image() API
- [Chart.js #2743](https://github.com/chartjs/Chart.js/issues/2743) - blank PNG with animation enabled

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and at latest versions
- Architecture: HIGH - straightforward props-driven refactoring with clear patterns from existing codebase
- Pitfalls: HIGH - all major pitfalls already documented in STATE.md accumulated context from prior phases

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- chart.js 4.x and vue-chartjs 5.x are mature)
