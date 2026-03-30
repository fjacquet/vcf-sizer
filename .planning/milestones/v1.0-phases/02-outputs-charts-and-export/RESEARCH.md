# Phase 2: Outputs, Charts and Export — Research

**Researched:** 2026-03-28
**Domain:** Vue 3 data visualization (Chart.js + vue-chartjs), URL state compression (lz-string), schema validation (Zod), CSS print layouts (Tailwind v4)
**Confidence:** HIGH (stack versions verified from npm registry; API patterns from official docs and GitHub source)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **CSS Grid split-screen**: `md:grid-cols-2` (left = inputs, right = results). No third-party split library.
- **Charts**: Chart.js 4.x + vue-chartjs 5.x. Bar charts for cores and RAM, Doughnut or stacked bar for storage.
- **CRITICAL**: All Chart.js component instances MUST use `shallowRef` — NOT `ref` — to prevent Vue 3 reactivity recursion (Chart.js issue #11619).
- **Three charts**: CoresChart, RamChart, StorageChart.
- **Charts driven by computed() data from calculationStore**. Update on every input change.
- **Color scheme**: over-capacity = red, safe capacity = green/teal, overhead = amber.
- **Host Count Summary Card**: shows `recommendedHostCount`, `minHostsForCpu`, `minHostsForRam`.
- **URL sharing**: lz-string library (NOT btoa). Serialize `inputStore.$state` → JSON → `LZString.compressToEncodedURIComponent` → `?c=` param.
- **URL hydration**: decompress → parse → Zod validate → hydrate inputStore. Runs BEFORE `app.mount()`.
- **Zod** for schema validation on URL load (untrusted input).
- **Markdown export**: pure JS string template, download via `URL.createObjectURL(Blob)`.
- **PDF export**: `@media print` CSS only via `window.print()`. NO html2canvas. NO jsPDF.
- **ResultsPanel structure**: `HostCountCard.vue`, `charts/CoresChart.vue`, `charts/RamChart.vue`, `charts/StorageChart.vue`, `ExportToolbar.vue`.
- **URL copy**: `navigator.clipboard.writeText()` with "Copied!" confirmation.

### Claude's Discretion

- Exact Tailwind classes and spacing within results panel.
- Chart color palette (must remain accessible — avoid red/green only).
- Exact Markdown report template content/ordering.
- Whether to use vue-chartjs `Bar` component or raw Chart.js imperative API (vue-chartjs is preferred).

### Deferred Ideas (OUT OF SCOPE)

- NVMe Memory Tiering inputs and visualization (Phase 3).
- Stretch Cluster per-site inputs and witness overhead (Phase 3).
- AI/GPU workload inputs (Phase 3).
- FR/DE/IT locale completion (Phase 3).
- Dark mode toggle (v2 backlog).

</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIZ-01 | Split-screen layout: input panel (left), results panel (right), responsive on mobile | CSS Grid `md:grid-cols-2` pattern; App.vue refactor to add right pane |
| VIZ-02 | Bar chart: Total Cores Required vs. Available | vue-chartjs Bar component with 2-dataset grouped bar; per-dataset colors |
| VIZ-03 | Bar chart: Total RAM Required vs. Available | Same pattern as VIZ-02 with RAM data from calculationStore.compute |
| VIZ-04 | Storage chart: Raw Capacity vs. Usable with overhead breakdown | Stacked bar or grouped bar with 3+ datasets from calculationStore.storage |
| VIZ-05 | Host count summary card prominently displayed | Tailwind typography card; conditional green/red coloring |
| VIZ-06 | Charts update in real-time as inputs change | computed() props to Bar + vue-chartjs default data watcher handles updates |
| VIZ-07 | Chart.js + vue-chartjs using `shallowRef` to prevent recursion | shallowRef + triggerRef pattern; confirmed Chart.js issue #11619 |
| EXPORT-01 | Shareable URL via lz-string + Base64URL encoding of full input state | LZString.compressToEncodedURIComponent API verified; ESM import confirmed |
| EXPORT-02 | Loading shared URL restores all input state exactly | Zod safeParse + Pinia store hydration before app.mount() |
| EXPORT-03 | Markdown export: formatted sizing report | URL.createObjectURL(Blob) download pattern |
| EXPORT-04 | PDF export via @media print CSS only | Tailwind print: variants; @custom-variant print for Tailwind v4 |

</phase_requirements>

---

## Summary

Phase 2 builds the output layer on top of Phase 1's calculation engine. The three interconnected problems are: (1) chart rendering without Vue reactivity conflicts, (2) URL state serialization/deserialization with compression and schema validation, and (3) print-safe CSS for PDF export.

The recommended approach for charts is `vue-chartjs 5.x` with Chart.js 4.x. The critical pattern is passing chart data as a `computed()` property directly to the `:data` prop of the `Bar` component — vue-chartjs has a built-in data watcher since v4 that calls `chart.update()` automatically when the prop changes. The `shallowRef` pattern is needed if you hold a Chart.js instance reference directly, but for the declarative `:data` prop binding pattern, a `computed()` property (read-only ref) works correctly and is the preferred approach.

For URL sharing, `lz-string 1.5.0` is stable, ESM-compatible (uses Vite for its own build), and the `compressToEncodedURIComponent` / `decompressFromEncodedURIComponent` pair is URL-safe by design. Zod 4.3.6 is the current stable version and provides the `safeParse()` + `z.infer<>` + `.strip()` pattern needed for safe URL state hydration.

For print/PDF, Tailwind v4 requires `@custom-variant print (@media print);` in the CSS entry point to activate the `print:` prefix. The `print:hidden` and `print:col-span-2` classes then cover hiding the input panel and expanding the results panel to full width.

**Primary recommendation:** Use `computed()` returning new data objects for chart reactivity (no manual triggerRef needed for this use case), `LZString.compressToEncodedURIComponent` for URL compression, `Zod.safeParse()` for URL state validation, and `@custom-variant print` + `print:hidden` / `print:col-span-2` for PDF layout.

---

## Standard Stack

### Core (all already installed in Phase 1 except chart and compression libraries)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue-chartjs | 5.3.3 | Vue 3 wrapper for Chart.js | Official community wrapper; built-in data/options watchers; typed props; supports Vue 3 Composition API via computed props |
| chart.js | 4.5.1 | Canvas charting engine | Peer dep of vue-chartjs; 11 KB gzipped; Bar and Doughnut chart types needed for this phase |
| lz-string | 1.5.0 | LZ compression for URL state | `compressToEncodedURIComponent` is URL-safe; ESM/CJS dual-format; keeps URL under 2000 chars |
| zod | 4.3.6 | Schema validation for URL state | TypeScript-first; `safeParse` never throws; `z.infer<>` gives compile-time types from schema |
| @vueuse/core | (already in stack.md: 14.2.1) | `useClipboard` for copy-to-clipboard | Provides `copied` auto-reset ref (1.5s); handles clipboard API fallback |

### Version Verification (npm registry, 2026-03-28)

| Package | Registry Version | Confirmed |
|---------|-----------------|-----------|
| lz-string | 1.5.0 | Yes — npm view 2026-03-28 |
| zod | 4.3.6 | Yes — npm view 2026-03-28 |
| chart.js | 4.5.1 | Yes — npm view 2026-03-28 |
| vue-chartjs | 5.3.3 | Yes — npm view 2026-03-28 |

**Note on Zod version:** The current npm version is 4.3.6 (Zod 4, stable). The STACK.md from Phase 1 was written before Zod 4 stabilized and does not list Zod. Zod 4 has the same core API as v3 (safeParse, z.object, z.infer) with performance improvements. Import path remains `import { z } from 'zod'` or `import * as z from 'zod'`.

### Installation (additions to Phase 1 dependencies)

```bash
npm install vue-chartjs@^5.3.3 chart.js@^4.5.1
npm install lz-string@^1.5.0
npm install zod@^4.3.6
# @vueuse/core is already required but not yet installed — add now
npm install @vueuse/core@^14.2.1
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vue-chartjs 5 | Raw Chart.js imperative API | More control but loses built-in reactivity watcher; requires manual `onMounted` + `onBeforeUnmount` lifecycle management |
| vue-chartjs 5 | vue-chart-3 (victorgarciaesgi) | Full composition API composables but smaller community; vue-chartjs 5 covers this project's needs via computed props |
| lz-string | pako (zlib) | pako gives better compression ratios but larger bundle; lz-string's `compressToEncodedURIComponent` is purpose-built for URL params |
| zod 4 | valibot | valibot is smaller but less ecosystem adoption; zod 4 is the industry standard for Vue/TS projects |
| @media print | jsPDF + html2canvas | html2canvas rasterizes canvas to blank in Firefox (PITFALLS.md Pitfall 9); font loss; 5-15 MB files |

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
src/
├── components/
│   ├── input/              (Phase 1 — unchanged)
│   ├── shared/             (Phase 1 — add WarningBanner already exists)
│   └── results/            (Phase 2 — new)
│       ├── ResultsPanel.vue
│       ├── HostCountCard.vue
│       ├── ExportToolbar.vue
│       └── charts/
│           ├── CoresChart.vue
│           ├── RamChart.vue
│           └── StorageChart.vue
├── composables/            (Phase 2 — new)
│   └── useUrlState.ts      (URL compression/decompression + Zod validation)
├── stores/
│   ├── calculationStore.ts (Phase 1 — read-only)
│   ├── inputStore.ts       (Phase 1 — hydration target)
│   └── uiStore.ts          (Phase 1)
└── App.vue                 (refactor: single-col → grid-cols-2)
```

### Pattern 1: Chart Component with Computed Props (vue-chartjs 5)

**What:** Pass chart data as a `computed()` return value to the `:data` prop of the `Bar` component. vue-chartjs has a built-in deep watcher on the `data` prop since v4 and will call `chart.update()` automatically.

**When to use:** All three chart components (CoresChart, RamChart, StorageChart). This is the correct pattern when chart data derives from a Pinia store.

**Example:**

```typescript
// Source: vue-chartjs official guide (vue-chartjs.org/guide) + confirmed behavior from v4 release notes
<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title, Tooltip, Legend,
  BarElement, CategoryScale, LinearScale
} from 'chart.js'
import { useCalculationStore } from '@/stores/calculationStore'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const calc = useCalculationStore()

// Returning a NEW object reference on every computed re-evaluation
// triggers vue-chartjs's built-in data watcher (strict equality check)
const chartData = computed(() => ({
  labels: ['Required', 'Available'],
  datasets: [
    {
      label: 'Cores',
      data: [calc.compute.totalCoresRequired, calc.compute.availableCores],
      backgroundColor: [
        calc.compute.totalCoresRequired > calc.compute.availableCores
          ? 'rgba(239,68,68,0.7)'    // red — over capacity
          : 'rgba(20,184,166,0.7)',  // teal — safe
        'rgba(148,163,184,0.5)',     // slate — available bar
      ],
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } }
}
</script>

<template>
  <div class="relative h-48">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
```

**CRITICAL note about shallowRef vs computed:**
The `shallowRef` + `triggerRef` pattern is required ONLY when you store the Chart.js INSTANCE itself in a ref (e.g., `const chartRef = shallowRef<ChartType | null>(null)`). When using vue-chartjs declaratively via `:data="chartData"` where `chartData` is a `computed()`, the framework handles reactivity correctly and shallowRef is NOT needed for the data. The PITFALLS.md warning about `reactive()` applies to wrapping Chart.js instances, not to chart data objects.

### Pattern 2: shallowRef for Chart Instance Access (if imperative API needed)

**What:** If direct Chart.js instance access is needed (e.g., for imperative `chart.resetZoom()`), store the template ref using `shallowRef`.

**When to use:** Only if ExportToolbar needs to call `chart.toBase64Image()` for Markdown report image embedding (currently not required per CONTEXT.md).

**Example:**

```typescript
// Source: Vue 3 docs (vuejs.org/api/reactivity-advanced#triggerref) + Chart.js issue #11619
import { shallowRef, triggerRef } from 'vue'

// Correct: shallowRef prevents Vue proxy from wrapping Chart.js internal state
const chartRef = shallowRef<InstanceType<typeof Bar> | null>(null)

// If you need to mutate chartData internals without replacing the object:
const chartData = shallowRef({ labels: [], datasets: [] })
// After mutating internals:
chartData.value.datasets[0].data = [newValue1, newValue2]
triggerRef(chartData)  // force vue-chartjs to re-render
```

### Pattern 3: URL State Composable

**What:** Encapsulate URL compression/decompression and Zod validation in a single composable, called from `main.ts` before `app.mount()`.

**When to use:** Called once at startup; called again when user clicks "Share URL".

**Example:**

```typescript
// Source: lz-string API (pieroxy.net) + Zod docs (zod.dev) + Vue 3 patterns
// src/composables/useUrlState.ts
import LZString from 'lz-string'
import { z } from 'zod'
import { useInputStore } from '@/stores/inputStore'

// Mirror the inputStore shape — all fields optional with defaults so
// partial/legacy URLs still hydrate correctly
const InputStateSchema = z.object({
  deploymentMode: z.enum(['simple', 'ha', 'stretch']).default('ha'),
  coresPerSocket: z.number().int().min(1).max(256).default(16),
  socketsPerHost: z.number().int().min(1).max(8).default(2),
  hostRamGB: z.number().positive().default(512),
  hostStorageTB: z.number().positive().default(3.84),
  hostCount: z.number().int().min(1).max(64).default(4),
  vmCount: z.number().int().min(0).default(100),
  avgVcpuPerVm: z.number().positive().default(4),
  avgVramGbPerVm: z.number().positive().default(8),
  avgStorageGbPerVm: z.number().positive().default(100),
  cpuOvercommitRatio: z.number().positive().max(20).default(4),
  ramOvercommitRatio: z.number().positive().max(4).default(1),
  storageType: z.enum(['vsan-esa', 'fc', 'nfs']).default('vsan-esa'),
  fttLevel: z.union([z.literal(1), z.literal(2)]).default(1),
  raidType: z.enum(['raid1', 'raid5', 'raid6']).default('raid5'),
  dedupEnabled: z.boolean().default(false),
  dedupRatio: z.number().min(1).max(10).default(2),
}).strip()  // remove unknown keys from untrusted URL state

type InputState = z.infer<typeof InputStateSchema>

export function hydrateFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  const compressed = params.get('c')
  if (!compressed) return

  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed)
    if (!json) return
    const parsed = JSON.parse(json)
    const result = InputStateSchema.safeParse(parsed)
    if (!result.success) {
      console.warn('[vcf-sizer] URL state validation failed:', result.error.issues)
      return
    }
    // Hydrate AFTER pinia is initialized but BEFORE app.mount()
    const store = useInputStore()
    const state = result.data as InputState
    Object.assign(store, state)
  } catch (e) {
    console.warn('[vcf-sizer] URL state parse error:', e)
  }
}

export function generateShareUrl(): string {
  const store = useInputStore()
  const state = {
    deploymentMode: store.deploymentMode,
    coresPerSocket: store.coresPerSocket,
    socketsPerHost: store.socketsPerHost,
    hostRamGB: store.hostRamGB,
    hostStorageTB: store.hostStorageTB,
    hostCount: store.hostCount,
    vmCount: store.vmCount,
    avgVcpuPerVm: store.avgVcpuPerVm,
    avgVramGbPerVm: store.avgVramGbPerVm,
    avgStorageGbPerVm: store.avgStorageGbPerVm,
    cpuOvercommitRatio: store.cpuOvercommitRatio,
    ramOvercommitRatio: store.ramOvercommitRatio,
    storageType: store.storageType,
    fttLevel: store.fttLevel,
    raidType: store.raidType,
    dedupEnabled: store.dedupEnabled,
    dedupRatio: store.dedupRatio,
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(state))
  const url = new URL(window.location.href)
  url.searchParams.set('c', compressed)
  return url.toString()
}
```

### Pattern 4: App.vue Refactor to Split-Screen Grid

**What:** Wrap existing input content in a left pane div; add right pane with ResultsPanel. The sticky header spans both columns.

**When to use:** App.vue refactor in Wave 1.

**Example:**

```html
<!-- Source: CONTEXT.md layout decision + Tailwind v4 grid utilities -->
<template>
  <div class="min-h-screen bg-gray-50 font-sans">
    <!-- Sticky header spans full width — print:hidden to hide from PDF -->
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center
                   justify-between sticky top-0 z-10 print:hidden">
      <h1 class="text-lg font-bold text-gray-900">{{ t('app.title') }}</h1>
      <LanguageSwitcher />
    </header>

    <!-- Split-screen grid: 2 cols on md+, single col on mobile -->
    <div class="grid grid-cols-1 md:grid-cols-2 min-h-screen">
      <!-- Left pane: inputs — hidden when printing -->
      <aside class="border-r border-gray-200 px-4 py-6 space-y-4 overflow-y-auto
                    print:hidden">
        <DeploymentModelSelector />
        <ManagementSummary />
        <HostSpecsForm />
        <WorkloadProfileForm />
        <StorageConfigForm />
      </aside>

      <!-- Right pane: results — expands to full width when printing -->
      <main class="px-4 py-6 print:col-span-2">
        <ResultsPanel />
      </main>
    </div>
  </div>
</template>
```

### Pattern 5: @media print with Tailwind v4

**What:** Tailwind v4 does NOT include `print:` variant by default. You must register it as a custom variant.

**When to use:** Add to `src/style.css` (the single CSS entry point).

**Example:**

```css
/* src/style.css */
@import "tailwindcss";
@custom-variant print (@media print);
```

Once registered, use `print:hidden`, `print:block`, `print:col-span-2` in templates.

**Critical note:** In Tailwind v4, the `hidden` utility is no longer the last display utility in cascade order (changed from v3). When combining `print:hidden` with other display utilities, ensure correct cascade order. Prefer `class="print:hidden"` as the only display modifier rather than mixing with `block`/`flex` on the same element to avoid specificity collisions.

### Pattern 6: Markdown Export

**What:** Pure JS string template with `URL.createObjectURL` for download.

**When to use:** ExportToolbar "Download Markdown" button click handler.

**Example:**

```typescript
// Source: CONTEXT.md decision + MDN Web API
export function downloadMarkdown(calc: ReturnType<typeof useCalculationStore>): void {
  const md = `# VCF 9.x Sizing Report

## Summary
- **Recommended Host Count:** ${calc.compute.recommendedHostCount}
- **Deployment Mode:** (from inputStore)

## Compute Sizing
| Metric | Required | Available | Utilization |
|--------|----------|-----------|-------------|
| Cores  | ${calc.compute.totalCoresRequired} | ${calc.compute.availableCores} | ${calc.compute.coreUtilizationPct.toFixed(1)}% |
| RAM (GB) | ${calc.compute.totalRamRequiredGB} | ${calc.compute.availableRamGB} | ${calc.compute.ramUtilizationPct.toFixed(1)}% |

## Storage Sizing
- Raw Capacity: ${calc.storage.rawCapacityTB} TB
- Safe Usable: ${calc.storage.safeUsableCapacityTB} TB
- RAID Scheme: ${calc.storage.raidScheme}
`
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'vcf-sizing-report.md'
  a.click()
  URL.revokeObjectURL(url)
}
```

### Pattern 7: Copy to Clipboard with Feedback (@vueuse/core)

**What:** `useClipboard` from `@vueuse/core` — provides auto-resetting `copied` ref.

**Example:**

```typescript
// Source: vueuse.org/core/useclipboard (HIGH confidence — verified 2026-03-28)
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'
import { generateShareUrl } from '@/composables/useUrlState'

const shareUrl = computed(() => generateShareUrl())
const { copy, copied } = useClipboard({ source: shareUrl, copiedDuring: 2000 })
```

```html
<button @click="copy()" class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm">
  {{ copied ? 'Copied!' : 'Share URL' }}
</button>
```

### Anti-Patterns to Avoid

- **Wrapping Chart.js instance in `reactive()` or `ref()`**: Triggers proxy recursion (Chart.js issue #11619). Store Chart.js instances ONLY in `shallowRef` if needed imperatively.
- **Deep `watch()` on entire `calculationStore`**: Creates a watcher storm. Watch specific computed values (e.g., `() => calc.compute.totalCoresRequired`) or rely on vue-chartjs's built-in prop watcher via `computed()` return values.
- **`window.btoa()` for URL compression**: Produces `+`, `/`, `=` characters that break URL parsing. Always use `LZString.compressToEncodedURIComponent`.
- **Hydrating store before pinia is created**: Call `hydrateFromUrl()` after `app.use(pinia)` but before `app.mount()`.
- **Mutating computed() chart data**: vue-chartjs compares data by reference. Always return a new object from `computed()` to trigger the watcher. Do not mutate dataset arrays in-place.
- **Omitting `.strip()` from Zod schema**: Without `.strip()`, unknown keys from crafted URLs pass through into the store — potential injection vector.
- **`print:hidden` cascade conflicts in Tailwind v4**: In v4, `hidden` is no longer last in cascade. Avoid combining `hidden` with other display utilities on the same element unless you verify cascade order.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL-safe LZ compression | Custom Base64URL + deflate pipeline | `LZString.compressToEncodedURIComponent` | lz-string handles Base64URL encoding internally; no `+`/`/`/`=` characters; purpose-built for URL state |
| Runtime schema validation of URL params | Manual type-checking with `typeof` | `Zod.safeParse()` + `InputStateSchema` | Handles nested types, optional fields, unknown key stripping, and type inference in one step |
| Clipboard copy with "Copied!" feedback | Custom `setTimeout` + ref reset | `useClipboard({ copiedDuring: 2000 })` from `@vueuse/core` | Handles async clipboard API, fallback to execCommand, automatic reset |
| Markdown file download | Custom anchor creation logic | Standard `URL.createObjectURL(new Blob(...))` pattern | 4 lines, no dependencies; well-supported across all target browsers |
| Chart reactivity | Custom `watch` + `chart.update()` | vue-chartjs `:data="computed()"` binding | Built-in prop watcher since v4; handles add/remove datasets correctly |

**Key insight:** The three most tempting hand-roll targets (URL encoding, schema validation, clipboard) each have exactly one correct library that eliminates an entire class of bugs. The time to integrate them is trivial compared to the edge cases they handle.

---

## Common Pitfalls

### Pitfall 1: vue-chartjs Data Watcher Not Triggering

**What goes wrong:** Chart does not update when Pinia store changes, even though `chartData` looks reactive.

**Why it happens:** `chartData` is a `computed()` that returns the SAME object reference (shallow copy mutation instead of new object creation). vue-chartjs's internal watcher uses `===` to detect changes — same reference means no update.

**How to avoid:** Always return a NEW plain object from `computed()`:

```typescript
// WRONG — mutates same object
const chartData = computed(() => {
  existing.datasets[0].data = [newVal]  // same object reference
  return existing
})

// CORRECT — new object every time calc changes
const chartData = computed(() => ({
  labels: ['Required', 'Available'],
  datasets: [{ data: [calc.compute.totalCoresRequired, calc.compute.availableCores] }]
}))
```

**Warning signs:** Chart stays blank or frozen after first render; no errors in console.

### Pitfall 2: Chart.js Proxy Recursion with `reactive()` or deep `ref()`

**What goes wrong:** `[Vue warn]: Maximum update depth exceeded` in console when chart data updates.

**Why it happens:** Vue's `reactive()` wraps Chart.js internal objects in a Proxy, causing Chart.js's internal `update()` to trigger Vue watchers, which trigger `update()` again recursively. (Confirmed: Chart.js issue #11619)

**How to avoid:** Never store Chart.js instances in `reactive()` or `ref()`. If you need an imperative reference to the chart instance, use `shallowRef`:

```typescript
const chartRef = shallowRef<InstanceType<typeof Bar> | null>(null)
```

**Warning signs:** `Maximum update depth exceeded` in console; CPU spike to 100% on any input change.

### Pitfall 3: lz-string ESM Named Import vs Default Import

**What goes wrong:** `import { compressToEncodedURIComponent } from 'lz-string'` fails — the function is not a named export in all bundle targets.

**Why it happens:** lz-string 1.5.0 uses a default export (`LZString` object). The ESM build may expose named exports depending on build tool resolution, but the safe pattern uses the default import.

**How to avoid:**

```typescript
// CORRECT — default import (always works with Vite + TypeScript)
import LZString from 'lz-string'
LZString.compressToEncodedURIComponent(json)
LZString.decompressFromEncodedURIComponent(compressed)
```

**Warning signs:** `SyntaxError: The requested module 'lz-string' does not provide an export named 'compress'`

### Pitfall 4: URL Hydration Before Pinia Initialization

**What goes wrong:** `Error: [🍍]: "getActivePinia()" was called but there was no active Pinia.`

**Why it happens:** `hydrateFromUrl()` calls `useInputStore()` before `app.use(pinia)` runs.

**How to avoid:** Strict ordering in `main.ts`:

```typescript
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)         // Step 1: create pinia
hydrateFromUrl()       // Step 2: hydrate (now pinia is active)
app.use(router)
app.mount('#app')      // Step 3: mount
```

**Warning signs:** Console error mentioning `getActivePinia` on first load with `?c=` param.

### Pitfall 5: Tailwind v4 `print:` Variant Missing

**What goes wrong:** `print:hidden` class generates no CSS; elements visible when printing.

**Why it happens:** In Tailwind v4, the `print` variant is not registered by default (changed from v3 where it was built-in).

**How to avoid:** Add `@custom-variant print (@media print);` to `src/style.css` BEFORE any component uses `print:` utilities.

**Warning signs:** `print:hidden` in template but element still prints; Tailwind DevTools show no generated `@media print` rule for that class.

### Pitfall 6: lz-string Returns null on Decompress Failure

**What goes wrong:** `JSON.parse(null)` throws; app crashes on malformed `?c=` param.

**Why it happens:** `LZString.decompressFromEncodedURIComponent()` returns `null` (not empty string) when the input is corrupted or truncated.

**How to avoid:** Always null-check before `JSON.parse`:

```typescript
const json = LZString.decompressFromEncodedURIComponent(compressed)
if (!json) return  // corrupted URL — silently ignore
```

**Warning signs:** `SyntaxError: Unexpected token 'n'` (parsing `null` as JSON string).

### Pitfall 7: StorageChart Stacked Bar Requires Scale Configuration

**What goes wrong:** Stacked bar chart datasets overlap instead of stacking; raw + overhead totals don't add up visually.

**Why it happens:** Chart.js stacked bars require explicit `scales.x.stacked: true` and `scales.y.stacked: true` in options. Without it, bars render side-by-side (grouped) or overlapping.

**How to avoid:**

```typescript
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { stacked: true },
    y: { stacked: true }
  }
}
```

**Warning signs:** Storage chart shows 3 overlapping thin bars instead of stacked bars building up to raw capacity.

---

## Code Examples

All examples are implementation-ready based on verified APIs.

### Chart.js Registration (one-time, per component or in main.ts)

```typescript
// Source: vue-chartjs.org/guide — verified registration pattern
import {
  Chart as ChartJS,
  Title, Tooltip, Legend,
  BarElement, CategoryScale, LinearScale,
  ArcElement  // for Doughnut/Pie
} from 'chart.js'

// Register once globally (preferred) or per chart component
ChartJS.register(
  Title, Tooltip, Legend,
  BarElement, CategoryScale, LinearScale
)
```

### CoresChart.vue — Complete Implementation Pattern

```typescript
// Source: vue-chartjs.org/guide + Chart.js scriptable options docs
<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { useCalculationStore } from '@/stores/calculationStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const calc = useCalculationStore()

const chartData = computed(() => {
  const required = calc.compute.totalCoresRequired
  const available = calc.compute.availableCores
  const overCapacity = required > available
  return {
    labels: [t('chart.required'), t('chart.available')],
    datasets: [{
      label: t('chart.cores'),
      data: [required, available],
      backgroundColor: [
        overCapacity ? 'rgba(239,68,68,0.75)' : 'rgba(20,184,166,0.75)',
        'rgba(148,163,184,0.5)',
      ],
      borderColor: [
        overCapacity ? 'rgb(220,38,38)' : 'rgb(13,148,136)',
        'rgb(100,116,139)',
      ],
      borderWidth: 1,
    }]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: true }
  },
  scales: {
    y: { beginAtZero: true }
  }
}
</script>

<template>
  <div class="relative h-48 w-full">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
```

### StorageChart.vue — Stacked Bar Configuration

```typescript
// Source: Chart.js bar.html docs — stacked configuration
const chartData = computed(() => ({
  labels: [t('chart.storage')],
  datasets: [
    {
      label: t('chart.usable'),
      data: [calc.storage.safeUsableCapacityTB],
      backgroundColor: 'rgba(20,184,166,0.7)',
    },
    {
      label: t('chart.lfsOverhead'),
      data: [calc.storage.lfsOverheadTB],
      backgroundColor: 'rgba(245,158,11,0.7)',
    },
    {
      label: t('chart.metadataOverhead'),
      data: [calc.storage.metadataOverheadTB],
      backgroundColor: 'rgba(251,191,36,0.5)',
    },
  ]
}))

const stackedOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { stacked: true },
    y: { stacked: true, beginAtZero: true }
  }
}
```

### lz-string API (exact function signatures)

```typescript
// Source: pieroxy.net/blog/pages/lz-string/guide.html — verified 2026-03-28
import LZString from 'lz-string'

// Compress: returns URL-safe string (uses Base64 alphabet without +/=/  characters)
const compressed: string = LZString.compressToEncodedURIComponent(jsonString)

// Decompress: returns original string or null if input is malformed/corrupted
const original: string | null = LZString.decompressFromEncodedURIComponent(compressed)
```

### Zod Schema for inputStore Validation

```typescript
// Source: zod.dev/basics — verified API 2026-03-28
import { z } from 'zod'

const InputStateSchema = z.object({
  deploymentMode: z.enum(['simple', 'ha', 'stretch']).default('ha'),
  coresPerSocket: z.number().int().min(1).max(256).default(16),
  // ... all fields with defaults matching inputStore initial values
}).strip()  // removes unknown keys — security: prevents injecting unexpected fields

type InputState = z.infer<typeof InputStateSchema>  // compile-time type safety

const result = InputStateSchema.safeParse(unknownData)
if (result.success) {
  // result.data is typed as InputState
} else {
  // result.error.issues contains validation failures
}
```

### useClipboard Pattern

```typescript
// Source: vueuse.org/core/useclipboard — verified 2026-03-28
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'
import { generateShareUrl } from '@/composables/useUrlState'

const shareUrl = computed(() => generateShareUrl())
const { copy, copied, isSupported } = useClipboard({
  source: shareUrl,
  copiedDuring: 2000  // ms before `copied` resets to false
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| vue-chartjs `reactiveProp` mixin | `:data="computed()"` prop binding | vue-chartjs v4 (2022) | No mixin needed; works with Composition API |
| `btoa()` + `encodeURIComponent()` | `LZString.compressToEncodedURIComponent()` | N/A (always a pitfall) | URL stays under 2000 chars; no character escaping issues |
| `try { const x = schema.parse(data) }` | `const result = schema.safeParse(data)` | Zod v3+ | No try/catch needed; discriminated union result |
| html2canvas + jsPDF for PDF | `@media print` + `window.print()` | Best practice (2023+) | Zero deps; fonts preserved; layout preserved |
| Tailwind v3 `print:` (built-in) | Tailwind v4 `@custom-variant print` | Tailwind v4 (2024) | Must explicitly register variant |
| `Intl.NumberFormat` for chart labels | Chart.js built-in tick formatting | Chart.js v3+ | Use `scales.y.ticks.callback` for locale-aware formatting |

**Deprecated/outdated:**

- vue-chartjs `reactiveProp` and `reactiveData` mixins: Removed in v5; do not use.
- vue-chartjs `v-if` on chart for forced re-render: Anti-pattern; use computed prop returning new object instead.
- `window.location.hash` for URL state: Use `URLSearchParams` (query string) for better compatibility with social link previews.

---

## Open Questions

1. **Chart.js vs vue-chartjs Accessibility**
   - What we know: Charts must be readable in light and browser-default dark mode (CONTEXT.md specifics)
   - What's unclear: Whether Chart.js canvas renders correctly with `prefers-color-scheme: dark` without explicit color overrides
   - Recommendation: Set explicit colors on all datasets (as shown in patterns above); do not rely on Chart.js auto-coloring which may clash with dark backgrounds

2. **lz-string URL Length Budget**
   - What we know: The inputStore has 18 fields; JSON serialization for a typical config is ~300-400 bytes; lz-string reduces this to ~150-200 chars
   - What's unclear: Exact compressed length after `compressToEncodedURIComponent` — depends on field values
   - Recommendation: Add a unit test that round-trips a max-complexity config and asserts URL length < 1800 chars (per PITFALLS.md recommendation)

3. **Zod 4 vs Zod 3 API Compatibility**
   - What we know: npm current version is 4.3.6; core API (safeParse, z.object, z.infer) is identical to v3
   - What's unclear: Whether `.strip()` method name changed in v4 (v3 uses `.strict()` for rejecting unknown keys; `.strip()` is the default behavior)
   - Recommendation: In Zod 4, unknown keys are stripped by default in `z.object()`; explicit `.strip()` may not be needed. Verify with `npm view zod@latest` during Wave 0 implementation. Use `.passthrough()` to opt INTO keeping unknown keys.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build toolchain | Yes | v25.8.2 | — |
| npm | Package management | Yes | 11.11.1 | — |
| Vite 8 | Build/dev server | Yes (in package.json) | ^8.0.3 | — |
| vue-chartjs | VIZ-02/03/04 | No (not yet installed) | 5.3.3 available | — |
| chart.js | VIZ-02/03/04 | No (not yet installed) | 4.5.1 available | — |
| lz-string | EXPORT-01/02 | No (not yet installed) | 1.5.0 available | — |
| zod | EXPORT-01/02 | No (not yet installed) | 4.3.6 available | — |
| @vueuse/core | EXPORT-01/02 (clipboard) | No (not yet installed) | 14.2.1 available | Manual `navigator.clipboard.writeText` |

**Missing dependencies with no fallback:**

- vue-chartjs, chart.js, lz-string, zod — all must be installed in Wave 0

**Missing dependencies with fallback:**

- @vueuse/core useClipboard — can be implemented manually with `navigator.clipboard.writeText()` + `setTimeout` reset if @vueuse/core introduces a conflict

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vite.config.ts (shared config) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIZ-07 | shallowRef pattern: no "Maximum update depth exceeded" when chartData changes | unit | `npm test -- src/composables/useUrlState.test.ts` | No — Wave 0 |
| EXPORT-01 | URL round-trip: compress + decompress returns identical state | unit | `npm test -- src/composables/useUrlState.test.ts` | No — Wave 0 |
| EXPORT-02 | URL hydration: Zod rejects unknown keys; defaults apply for missing fields | unit | `npm test -- src/composables/useUrlState.test.ts` | No — Wave 0 |
| EXPORT-01 | URL length: max-complexity config produces URL < 1800 chars | unit | `npm test -- src/composables/useUrlState.test.ts` | No — Wave 0 |
| EXPORT-03 | Markdown output: contains required sections (Summary, Compute, Storage) | unit | `npm test -- src/composables/useMarkdownExport.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/composables/useUrlState.test.ts` — covers EXPORT-01, EXPORT-02 URL round-trip and Zod validation
- [ ] `src/composables/useMarkdownExport.test.ts` — covers EXPORT-03 Markdown content
- [ ] No chart component unit tests needed (visual behavior; rely on integration + manual review for VIZ-01 through VIZ-07)

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` apply to this phase:

- **Context7 MCP mandatory**: Before writing `import X` or calling any library function, check docs first. This research document serves as the pre-verification step for chart.js, vue-chartjs, lz-string, and zod APIs.
- **No raw CLI commands without validation**: All `npm install` commands listed above have been verified against the npm registry.
- **Serena for code editing**: When implementing chart components, use Serena symbolic tools for navigation and editing rather than text replacement.
- **TypeScript strict mode**: `strict: true` is set in tsconfig; all chart data types must be explicitly typed. Use `z.infer<typeof InputStateSchema>` for URL state types.

---

## Sources

### Primary (HIGH confidence)

- [vue-chartjs.org/guide](https://vue-chartjs.org/guide/) — component props (:data, :options), ChartJS.register pattern, built-in data watcher behavior
- [vue-chartjs.org/api](https://vue-chartjs.org/api/) — full prop list: data, options, datasetIdKey, plugins, updateMode
- [vuejs.org/api/reactivity-advanced#triggerref](https://vuejs.org/api/reactivity-advanced) — triggerRef function signature and shallowRef pattern
- [chartjs.org/docs/latest/charts/bar.html](https://www.chartjs.org/docs/latest/charts/bar.html) — Bar dataset properties, stacked configuration, indexAxis
- [chartjs.org/docs/latest/general/options.html#scriptable-options](https://www.chartjs.org/docs/latest/general/options.html) — scriptable backgroundColor function with context.parsed.y
- [chartjs.org/docs/latest/samples/scriptable/bar.html](https://www.chartjs.org/docs/latest/samples/scriptable/bar.html) — colorize function pattern with ctx.parsed.y threshold coloring
- [pieroxy.net/blog/pages/lz-string/guide.html](https://pieroxy.net/blog/pages/lz-string/guide.html) — full API table for all compress/decompress methods; URL-safe method identification
- [zod.dev/basics](https://zod.dev/basics) — safeParse API, z.object, z.infer, z.enum
- [vueuse.org/core/useclipboard](https://vueuse.org/core/useclipboard/) — useClipboard function signature, copied ref, copiedDuring option
- npm registry (2026-03-28) — version verification for lz-string@1.5.0, zod@4.3.6, chart.js@4.5.1, vue-chartjs@5.3.3

### Secondary (MEDIUM confidence)

- [github.com/pieroxy/lz-string](https://github.com/pieroxy/lz-string) — ESM/CJS dual-format confirmed; Vite used for lz-string's own build; "modern build tools should be happy with it"
- [PITFALLS.md](../.planning/research/PITFALLS.md) — Chart.js issue #11619 (Proxy recursion), URL Base64 pitfall, html2canvas PDF failure modes
- Tailwind v4 `@custom-variant print` — confirmed via [tailwindcss discussions #12887](https://github.com/tailwindlabs/tailwindcss/discussions/12887) and [tailwindlabs issue #15884](https://github.com/tailwindlabs/tailwindcss/issues/15884)

### Tertiary (LOW confidence — flag for validation)

- vue-chartjs Composition API computed() pattern: Inferred from "built-in data watcher since v4" official docs statement + confirmed working in community examples (digitalthriveai.com comparison article). LOW confidence on shallowRef-not-needed claim for declarative `:data` binding — should be validated with a prototype before full implementation.
- Zod 4 `.strip()` behavior: LOW confidence on exact API name change from v3 to v4. Verify during Wave 0: `z.object({}).strip()` may be replaced by default behavior in Zod 4.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions verified from npm registry 2026-03-28
- Architecture patterns: HIGH — vue-chartjs props from official API docs; lz-string functions from official guide; Zod from official docs; Tailwind print from GitHub issues
- Pitfalls: HIGH — sourced from pre-existing verified PITFALLS.md (compiled 2026-03-28) + Chart.js issue #11619 reference
- vue-chartjs Composition API computed() pattern: MEDIUM — official docs confirm built-in watcher; exact shallowRef-not-needed claim for `:data` prop binding needs prototype validation

**Research date:** 2026-03-28
**Valid until:** 2026-06-28 (stable libraries; 90-day validity estimate)
