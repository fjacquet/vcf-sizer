# Architecture Research

**Domain:** Client-side SPA — VMware VCF 9.x Sizing Calculator
**Researched:** 2026-03-28
**Confidence:** HIGH (Vue 3/Pinia/vue-i18n verified via official docs; VCF 9.x sizing data verified via Broadcom TechDocs and VCF blog)

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                          Browser SPA (No Backend)                   │
├──────────────────────────────┬─────────────────────────────────────┤
│         INPUT PANEL          │           OUTPUT PANEL              │
│   (left pane, scrollable)    │    (right pane, sticky/scrollable)  │
│  ┌────────────────────────┐  │  ┌────────────┐  ┌──────────────┐  │
│  │  DeploymentModePanel   │  │  │ SummaryCard│  │  ChartPanel  │  │
│  │  HostSpecPanel         │  │  │            │  │  (Chart.js)  │  │
│  │  WorkloadPanel         │  │  │ CoreResult │  │              │  │
│  │  StoragePanel          │  │  │ RAMResult  │  │ StorageChart │  │
│  │  StretchClusterPanel   │  │  │ StorResult │  │              │  │
│  │  AIGPUPanel            │  │  └────────────┘  └──────────────┘  │
│  └────────────────────────┘  │  ┌──────────────────────────────┐  │
│                               │  │       ExportToolbar          │  │
│                               │  │  [PDF] [Markdown] [Share URL]│  │
│                               │  └──────────────────────────────┘  │
├──────────────────────────────┴─────────────────────────────────────┤
│                        STATE LAYER (Pinia)                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  inputStore     │  │  calculationStore│  │  uiStore          │  │
│  │  (user inputs)  │  │  (computed/pure) │  │  (locale, theme)  │  │
│  └─────────────────┘  └──────────────────┘  └───────────────────┘  │
├────────────────────────────────────────────────────────────────────┤
│                     CALCULATION ENGINE (Pure TS)                    │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────┐  ┌───────────┐  │
│  │ mgmtDomain   │  │ workload    │  │  storage  │  │  stretch  │  │
│  │ Calc.ts      │  │ Calc.ts     │  │  Calc.ts  │  │  Calc.ts  │  │
│  └──────────────┘  └─────────────┘  └───────────┘  └───────────┘  │
├────────────────────────────────────────────────────────────────────┤
│                      CROSS-CUTTING SERVICES                         │
│  ┌───────────┐  ┌──────────────┐  ┌───────────┐  ┌─────────────┐  │
│  │ i18n      │  │ urlState     │  │ export    │  │ validation  │  │
│  │ (vue-i18n)│  │ (base64 URL) │  │ (PDF/MD)  │  │ composable  │  │
│  └───────────┘  └──────────────┘  └───────────┘  └─────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `DeploymentModePanel` | Simple / HA / Stretch toggle; drives conditional rendering | Vue SFC, `v-model` to `inputStore.deploymentMode` |
| `HostSpecPanel` | Physical host inputs: cores/socket, sockets, RAM, NVMe | Vue SFC with numeric inputs, validation feedback |
| `WorkloadPanel` | VM count, average vCPU/vRAM/vStorage, CPU ratio | Vue SFC, slot for AI/GPU sub-section |
| `StoragePanel` | Principal storage type, vSAN ESA toggle, dedup toggle, FTT/RAID | Conditional rendering based on storage selection |
| `StretchClusterPanel` | Preferred/secondary site split, witness node config | Visible only when `deploymentMode === 'stretch'` |
| `AIGPUPanel` | GPU workload count, vGPU memory overhead per profile | Vue SFC, shown/hidden by workload type |
| `SummaryCard` | Green/amber/red host count recommendation | Reads from `calculationStore.results` (computed) |
| `ChartPanel` | Chart.js doughnut/bar charts for CPU/RAM/Storage | `vue-chartjs` wrapper; data from computed getters |
| `ExportToolbar` | PDF/Markdown export buttons, share URL copy | Calls `useExport()` and `useUrlState()` composables |
| `inputStore` | Single source of truth for all user inputs | Pinia setup store with `ref()` and persistence hook |
| `calculationStore` | Derived results; no user-owned state | Pinia setup store with `computed()` over inputStore |
| `uiStore` | Locale, mobile layout state, panel visibility | Pinia setup store; syncs locale to `vue-i18n` |
| `mgmtDomainCalc.ts` | Management domain resource totals (vCenter, NSX, SDDC Mgr, Ops, Automation) | Pure TypeScript functions, zero Vue dependencies |
| `workloadCalc.ts` | Workload host count, CPU overcommit, RAM sizing | Pure TypeScript functions |
| `storageCalc.ts` | Raw vs usable vSAN capacity, dedup/FTT/RAID overhead | Pure TypeScript functions |
| `stretchCalc.ts` | Cross-site sizing, witness node sizing, PFTT/SFTT | Pure TypeScript functions |

---

## Recommended Project Structure

```
src/
├── components/
│   ├── input/
│   │   ├── DeploymentModePanel.vue     # Deployment model selector
│   │   ├── HostSpecPanel.vue           # Physical host specification
│   │   ├── WorkloadPanel.vue           # VM workload parameters
│   │   ├── StoragePanel.vue            # Storage type + vSAN config
│   │   ├── StretchClusterPanel.vue     # Stretch cluster inputs (conditional)
│   │   └── AIGPUPanel.vue              # AI/GPU workload inputs
│   ├── output/
│   │   ├── SummaryCard.vue             # Host count recommendation
│   │   ├── ResourceResult.vue          # CPU / RAM result row (reusable)
│   │   ├── StorageResult.vue           # Raw vs usable storage result
│   │   ├── ChartPanel.vue              # Chart.js container
│   │   ├── CoreUtilChart.vue           # CPU utilization doughnut
│   │   ├── MemoryUtilChart.vue         # RAM utilization doughnut
│   │   └── StorageBreakdownChart.vue   # Storage bar chart
│   ├── shared/
│   │   ├── ExportToolbar.vue           # PDF / Markdown / Share URL
│   │   ├── LanguageSwitcher.vue        # Locale picker
│   │   ├── WarningBanner.vue           # VCFA min-spec warning
│   │   └── InfoTooltip.vue             # Context-sensitive help
│   └── layout/
│       ├── AppShell.vue                # Top-level flex split layout
│       ├── InputPane.vue               # Left scrollable column
│       └── OutputPane.vue              # Right sticky/scrollable column
├── engine/                             # Pure TypeScript — zero Vue imports
│   ├── mgmtDomainCalc.ts               # Management domain sizing formulas
│   ├── workloadCalc.ts                 # Workload CPU/RAM host count
│   ├── storageCalc.ts                  # vSAN overhead, dedup, FTT/RAID
│   ├── stretchCalc.ts                  # Stretch cluster + witness sizing
│   ├── nvmeTieringCalc.ts              # NVMe memory tiering effective RAM
│   ├── validationRules.ts              # All constraint validators
│   └── types.ts                        # Shared input/output TypeScript types
├── stores/
│   ├── inputStore.ts                   # All user inputs (Pinia setup store)
│   ├── calculationStore.ts             # Computed results (reads inputStore)
│   └── uiStore.ts                      # Locale, layout, UI flags
├── composables/
│   ├── useUrlState.ts                  # Base64 encode/decode URL state
│   ├── useExport.ts                    # PDF and Markdown export logic
│   ├── useValidation.ts                # Reactive validation messages
│   └── useChartData.ts                 # Transforms results → Chart.js datasets
├── i18n/
│   ├── index.ts                        # createI18n instance (legacy: false)
│   └── locales/
│       ├── en.json
│       ├── fr.json
│       ├── de.json
│       └── it.json
├── App.vue                             # Root component (AppShell mount)
└── main.ts                             # createApp, Pinia, vue-i18n, vue-router
```

### Structure Rationale

- **`engine/`:** Calculation logic is pure TypeScript with zero Vue imports. This enables isolated unit testing with Vitest, prevents business logic from bleeding into reactive state, and makes formulas auditable independently of the UI.
- **`stores/`:** Two-store split (input vs calculation) enforces unidirectional data flow. The `calculationStore` only has `computed()` getters — it never holds input state. This prevents circular reactivity and makes debugging deterministic.
- **`composables/`:** Cross-cutting logic (URL state, export, chart data transformation) lives in composables rather than components, keeping UI components thin.
- **`components/input/` vs `output/`:** Physical separation enforces that output components never mutate inputs (read-only contract).
- **`i18n/locales/`:** Flat JSON per locale. All keys defined in `en.json` first; other files are translated copies. Missing keys fall back to EN via `fallbackLocale`.

---

## Architectural Patterns

### Pattern 1: Unidirectional Reactive Data Flow

**What:** User inputs flow in one direction — from UI components into `inputStore`, which triggers `calculationStore` computed getters, which feed output components and chart data.

**When to use:** Always — this is the foundational pattern for the entire SPA.

**Trade-offs:** Simple mental model, easy to debug. Slightly verbose for deeply nested inputs (use `storeToRefs` to avoid boilerplate).

**Example:**

```typescript
// stores/inputStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useInputStore = defineStore('input', () => {
  const hostCores = ref(32)
  const hostRamGB = ref(512)
  const vmCount = ref(100)
  const deploymentMode = ref<'simple' | 'ha' | 'stretch'>('ha')
  const storageType = ref<'vsan-esa' | 'fc' | 'nfs'>('vsan-esa')
  const dedupEnabled = ref(false)
  const nvmeTieringEnabled = ref(false)
  const fttLevel = ref<1 | 2>(1)
  const raidType = ref<'raid1' | 'raid5' | 'raid6'>('raid1')

  return {
    hostCores, hostRamGB, vmCount,
    deploymentMode, storageType, dedupEnabled,
    nvmeTieringEnabled, fttLevel, raidType
  }
})

// stores/calculationStore.ts
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useInputStore } from './inputStore'
import { calcMgmtDomain } from '../engine/mgmtDomainCalc'
import { calcWorkloadHosts } from '../engine/workloadCalc'

export const useCalculationStore = defineStore('calculation', () => {
  const input = useInputStore()

  const mgmtResources = computed(() => calcMgmtDomain(input.deploymentMode))
  const workloadResources = computed(() => calcWorkloadHosts(input.$state))
  const totalCoresRequired = computed(() =>
    mgmtResources.value.cores + workloadResources.value.cores
  )
  const totalRAMRequired = computed(() =>
    mgmtResources.value.ramGB + workloadResources.value.ramGB
  )
  const minHostCount = computed(() =>
    Math.ceil(totalCoresRequired.value / input.hostCores)
  )

  return { mgmtResources, workloadResources, totalCoresRequired, totalRAMRequired, minHostCount }
})
```

### Pattern 2: Pure Calculation Engine

**What:** All VCF business logic lives in `engine/*.ts` as pure functions that take typed input objects and return typed result objects. No Vue reactivity, no store access.

**When to use:** Every formula — management domain sizing, vSAN overhead, NVMe tiering, stretch cluster witness sizing.

**Trade-offs:** Slightly more boilerplate (must pass inputs explicitly). Gains: independently unit-testable, auditable formulas, reusable outside Vue context.

**Example:**

```typescript
// engine/types.ts
export interface MgmtDomainInputs {
  deploymentMode: 'simple' | 'ha' | 'stretch'
}

export interface MgmtDomainResult {
  vcenterCores: number;  vcenterRamGB: number
  sddc_cores: number;    sddc_ramGB: number
  nsxCores: number;      nsxRamGB: number
  opsCores: number;      opsRamGB: number
  automationCores: number; automationRamGB: number
  totalCores: number;    totalRamGB: number;  totalDiskGB: number
  warnings: string[]     // e.g. 'VCFA requires 24 vCPU — host must have >=12 cores/24 threads'
}

// engine/mgmtDomainCalc.ts
const HA_MULTIPLIER = 3

const COMPONENT_SPECS = {
  vcenter:    { cores: 4,  ramGB: 21,  diskGB: 642 },
  sddc:       { cores: 4,  ramGB: 16,  diskGB: 931 },
  nsxManager: { cores: 6,  ramGB: 24,  diskGB: 300 },
  ops:        { cores: 4,  ramGB: 16,  diskGB: 290 },
  opsFleet:   { cores: 4,  ramGB: 12,  diskGB: 206 },
  opsCollect: { cores: 4,  ramGB: 16,  diskGB: 280 },
  automation: { cores: 24, ramGB: 96,  diskGB: 626 },
}

export function calcMgmtDomain(mode: 'simple' | 'ha' | 'stretch'): MgmtDomainResult {
  const isHA = mode === 'ha' || mode === 'stretch'
  const haMulti = isHA ? HA_MULTIPLIER : 1

  const nsx   = COMPONENT_SPECS.nsxManager
  const ops   = COMPONENT_SPECS.ops
  const auto  = COMPONENT_SPECS.automation
  const vctr  = COMPONENT_SPECS.vcenter
  const sddc  = COMPONENT_SPECS.sddc

  const warnings: string[] = []
  warnings.push('VCFA (VCF Automation) requires a host with >=12 physical cores / 24 threads')

  const totalCores =
    vctr.cores + sddc.cores +
    (nsx.cores * haMulti) +
    (ops.cores * haMulti) +
    (COMPONENT_SPECS.opsFleet.cores + COMPONENT_SPECS.opsCollect.cores) +
    (auto.cores * haMulti)

  const totalRamGB =
    vctr.ramGB + sddc.ramGB +
    (nsx.ramGB * haMulti) +
    (ops.ramGB * haMulti) +
    (COMPONENT_SPECS.opsFleet.ramGB + COMPONENT_SPECS.opsCollect.ramGB) +
    (auto.ramGB * haMulti)

  return {
    vcenterCores: vctr.cores, vcenterRamGB: vctr.ramGB,
    sddc_cores: sddc.cores,   sddc_ramGB: sddc.ramGB,
    nsxCores: nsx.cores * haMulti,  nsxRamGB: nsx.ramGB * haMulti,
    opsCores: (ops.cores + COMPONENT_SPECS.opsFleet.cores + COMPONENT_SPECS.opsCollect.cores) * haMulti,
    opsRamGB: (ops.ramGB + COMPONENT_SPECS.opsFleet.ramGB + COMPONENT_SPECS.opsCollect.ramGB) * haMulti,
    automationCores: auto.cores * haMulti,
    automationRamGB: auto.ramGB * haMulti,
    totalCores,
    totalRamGB,
    totalDiskGB: (vctr.diskGB + sddc.diskGB + nsx.diskGB * haMulti + ops.diskGB * haMulti +
                  COMPONENT_SPECS.opsFleet.diskGB + COMPONENT_SPECS.opsCollect.diskGB +
                  auto.diskGB * haMulti),
    warnings
  }
}
```

### Pattern 3: Base64 URL State Sharing

**What:** Serialise `inputStore.$state` to JSON, compress (optional), base64-encode, write to `?state=` query param. Decode on load to restore inputs.

**When to use:** The "Share URL" feature. No backend, no cookies, no localStorage required.

**Trade-offs:** URL length grows with input complexity (~400 chars typical, within browser limits). Base64 is not compressed — use `lz-string` if URL length becomes a concern.

**Example:**

```typescript
// composables/useUrlState.ts
import { useInputStore } from '../stores/inputStore'
import { useRouter, useRoute } from 'vue-router'

export function useUrlState() {
  const inputStore = useInputStore()
  const router = useRouter()
  const route = useRoute()

  function saveToUrl(): string {
    const json = JSON.stringify(inputStore.$state)
    const encoded = btoa(unescape(encodeURIComponent(json)))
    router.replace({ query: { ...route.query, state: encoded } })
    return window.location.href
  }

  function loadFromUrl(): boolean {
    const encoded = route.query.state as string | undefined
    if (!encoded) return false
    try {
      const json = decodeURIComponent(escape(atob(encoded)))
      const state = JSON.parse(json)
      inputStore.$patch(state)
      return true
    } catch {
      return false  // silently ignore corrupt state
    }
  }

  return { saveToUrl, loadFromUrl }
}
```

### Pattern 4: i18n Composition API Integration

**What:** `vue-i18n` with `legacy: false` for full Composition API support. All translation keys resolved at component level via `useI18n()`. Locale stored in `uiStore` and synced to `i18n.global.locale`.

**When to use:** Every user-visible string, including chart labels and export content.

**Trade-offs:** `legacy: false` is required; mixing with Options API components needs care. Lazy loading locale files reduces initial bundle size.

**Example:**

```typescript
// i18n/index.ts
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'

export const i18n = createI18n({
  legacy: false,           // REQUIRED for Composition API
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },        // Only EN loaded eagerly; others lazy-loaded
})

// Lazy load other locales on demand (uiStore action)
export async function loadLocale(locale: 'fr' | 'de' | 'it') {
  const messages = await import(`./locales/${locale}.json`)
  i18n.global.setLocaleMessage(locale, messages.default)
  i18n.global.locale.value = locale
}

// In a component:
// const { t } = useI18n()
// t('hostSpec.cores')  →  "Cores per socket" / "Cœurs par socket" / ...
```

---

## Data Flow

### Primary Calculation Flow

```
User edits input field
    |
    v
InputComponent (v-model)
    |
    v
inputStore.$patch({ field: value })
    |
    v (Vue reactivity — automatic)
calculationStore.computed getters invalidated
    |
    v
engine/*.ts pure functions called with new inputs
    |
    v
calculationStore.results updated
    |
    v
Output components re-render (SummaryCard, ResourceResult, etc.)
    |
    v
ChartPanel re-renders (vue-chartjs watches computed data)
```

### URL State Flow (on load)

```
Browser navigates to /?state=<base64>
    |
    v
App.vue onMounted → useUrlState().loadFromUrl()
    |
    v
inputStore.$patch(decoded state)
    |
    v (same as primary flow above)
All outputs render with restored configuration
```

### Export Flow

```
User clicks [PDF] or [Markdown]
    |
    v
ExportToolbar → useExport().exportPdf() or .exportMarkdown()
    |
    v (PDF path)
html2pdf.js captures OutputPane DOM → jsPDF renders PDF
    |
    v (Markdown path)
calculationStore results + inputStore state → template string → .md file download
```

### Locale Switch Flow

```
User selects language in LanguageSwitcher
    |
    v
uiStore.setLocale('fr')
    |
    v
loadLocale('fr') — lazy import fr.json
    |
    v
i18n.global.locale.value = 'fr'
    |
    v
All t() calls in all components re-evaluate reactively
    |
    v (side effect)
Chart labels also update — useChartData() composable uses t()
```

---

## VCF 9.x Calculation Engine: Formulas

### Management Domain Sizing (Verified: Broadcom TechDocs + williamlam.com lab data)

| Component | Simple (lab) | HA (production) |
|-----------|-------------|-----------------|
| vCenter Server | 4 vCPU / 21 GB RAM | 4 vCPU / 21 GB RAM (single) |
| SDDC Manager | 4 vCPU / 16 GB RAM | 4 vCPU / 16 GB RAM (single) |
| NSX Manager | 6 vCPU / 24 GB RAM x1 | 6 vCPU / 24 GB RAM x3 |
| VCF Operations | 4 vCPU / 16 GB RAM x1 | 4 vCPU / 16 GB RAM x3 |
| VCF Ops Fleet Mgr | 4 vCPU / 12 GB RAM | 4 vCPU / 12 GB RAM |
| VCF Ops Collector | 4 vCPU / 16 GB RAM | 4 vCPU / 16 GB RAM |
| VCF Automation | 24 vCPU / 96 GB RAM x1 | 24 vCPU / 96 GB RAM x3 |

**HA Multiplier:** NSX Manager, VCF Operations, and VCF Automation each scale x3 in production/HA mode.

**Critical Warning:** A host with fewer than 12 physical cores (24 threads) cannot schedule the 24 vCPU VCF Automation VM. This is a hard blocker, not a recommendation. The tool must show a blocking error when `hostCores < 12`.

### Workload Domain Host Count

```
effectiveRamPerHost = hostRamGB
if (nvmeTieringEnabled && activeMemoryPct <= 0.50):
    effectiveRamPerHost = hostRamGB * (1 + nvmeDramRatio)
    # nvmeDramRatio: 1 (default 1:1), 2 (1:2), or 4 (1:4)

totalWorkloadCores = vmCount * avgVcpu / cpuOvercommitRatio
totalWorkloadRam   = vmCount * avgVramGB

hostsForCPU   = ceil(totalWorkloadCores / hostCores)
hostsForRAM   = ceil(totalWorkloadRam   / effectiveRamPerHost)
minWorkloadHosts = max(hostsForCPU, hostsForRAM)

# FTT host minimum for vSAN:
# RAID-1: minHosts = 2 * FTT + 1
# RAID-5: minHosts = 4 (FTT=1), requires ESA
# RAID-6: minHosts = 6 (FTT=2), requires ESA
minVsanHosts = vsanMinimumHosts(fttLevel, raidType)
recommendedHosts = max(minWorkloadHosts, minVsanHosts)
```

### NVMe Memory Tiering (Verified: VMware VCF Blog, Part 3 Sizing)

```
# Effective RAM per host when tiering enabled:
effectiveRam = dram + (dram * nvmeDramRatio)
# where nvmeDramRatio in {1, 2, 4} — default is 1

# Precondition for tiering benefit:
# activeMemoryGB <= dram * 0.50

# NVMe capacity needed per host:
nvmeRequired = dram * nvmeDramRatio
# Max supported NVMe partition per host: 4 TB
```

### vSAN ESA Storage Sizing (Verified: vSAN FAQs + community data)

```
# Raw capacity per host: (nvmeDrives * nvmeDriveCapacityGB)

# Space efficiency multipliers:
storageMultiplier =
    if RAID-1, FTT=1: 2.0x      (minimum 3 hosts)
    if RAID-1, FTT=2: 3.0x      (minimum 5 hosts)
    if RAID-5, FTT=1: 1.33x     (minimum 4 hosts, ESA only)
    if RAID-6, FTT=2: 1.5x      (minimum 6 hosts, ESA only)

usableCapacityGB = rawCapacityGB / storageMultiplier

# With Global Deduplication (VCF 9 P01+):
# Conservative estimate: 2x effective dedup ratio (workload-dependent)
# Tool should use configurable dedup ratio with default 2x and note variability
effectiveCapacityGB = usableCapacityGB * dedupRatio

# vSAN slack space: reserve 30% for performance
safeUsableCapacityGB = effectiveCapacityGB * 0.70
```

### Stretch Cluster Sizing (Verified: Broadcom TechDocs VCF 9.0 Stretching Clusters)

```
# Host count: equal per site — symmetric required
hostsPerSite = ceil(totalHosts / 2)
if (hostsPerSite * 2 < minVsanHosts):
    hostsPerSite = ceil(minVsanHosts / 2)

# Witness node: separate third site or zone
# Witness does NOT run customer VMs
# Witness appliance sizing (based on VM count):
witnessSize =
    if vmCount <= 10:   'Tiny'    # <=750 components
    if vmCount <= 500:  'Medium'  # <=21,833 components
    else:               'Large'

# Stretch cluster storage: PFTT=1 (site failure tolerance) always
# SFTT=1 within each site is typical
# Total space multiplier for stretch = siteMultiplier * siteCopies (2)
stretchStorageMultiplier = vsanMultiplier(sfttLevel, raidType) * 2
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Greenfield / static hosting | Pure Vite SPA on GitHub Pages / Vercel / Netlify. No server-side logic needed. Bundle size target <500 KB gzipped. |
| High traffic (shared URL goes viral) | CDN handles it — no compute cost. Vite code-splitting by route keeps initial load fast. |
| Localisation growth (more languages) | Already handled by lazy-loading pattern in `i18n/`. Adding a language = adding a JSON file. |
| More VCF components / formula updates | Pure engine functions in `engine/` — add new `*Calc.ts` file, expose computed in `calculationStore`. Zero UI coupling. |

### Scaling Priorities

1. **First concern (bundle size):** Chart.js is 200 KB. Use dynamic import for the chart panel: `defineAsyncComponent(() => import('./output/ChartPanel.vue'))`. Defer chart code until first render.
2. **Second concern (calculation complexity):** Calculations are synchronous and O(1) — no performance concern. If future formulas become expensive (e.g., Monte Carlo simulations), Web Workers can be introduced without changing the component API.

---

## Anti-Patterns

### Anti-Pattern 1: Business Logic in Components

**What people do:** Put vSAN overhead formulas directly in `<script setup>` of `StorageResult.vue` or a Pinia store.

**Why it's wrong:** Makes formulas untestable in isolation, duplicates logic across components when similar results are needed, couples business rules to rendering lifecycle.

**Do this instead:** All formulas live in `engine/*.ts` as pure functions. Components and stores only call them; they never contain arithmetic.

### Anti-Pattern 2: Single Monolithic Store

**What people do:** One giant Pinia store with inputs, outputs, UI state, and locale all in one `appStore.ts`.

**Why it's wrong:** Computed getters that depend on both inputs and UI state get hard to reason about. TypeScript inference degrades. Debugging requires scanning the whole store.

**Do this instead:** Three stores: `inputStore` (mutable user inputs), `calculationStore` (read-only computed results derived from inputs), `uiStore` (locale, panel visibility, mobile state).

### Anti-Pattern 3: Translating Calculation Values in the Engine

**What people do:** Return translated strings like `"158 coeurs requis"` from `mgmtDomainCalc.ts`.

**Why it's wrong:** The engine becomes locale-aware, which prevents unit testing with fixed locale and breaks the separation between logic and presentation.

**Do this instead:** Engine functions return raw numbers and typed enums. The component layer applies `t()` to labels and `Intl.NumberFormat` for locale-aware number formatting.

### Anti-Pattern 4: Encoding URL State with localStorage as Fallback

**What people do:** Try localStorage first, then URL, creating two sources of truth.

**Why it's wrong:** Shared URLs open with one user's inputs overridden by the local user's localStorage — confusing and misleading for a sharing-first tool.

**Do this instead:** URL state is the only persistence mechanism. On load, URL `?state=` takes priority. No localStorage. If no state in URL, start with sensible defaults.

### Anti-Pattern 5: PDF Export via Window.print()

**What people do:** Use `window.print()` and rely on browser print dialogs for PDF export.

**Why it's wrong:** Print dialog styling is browser-controlled, looks inconsistent across browsers, cannot set filename, and has no programmatic control over page breaks.

**Do this instead:** Use `html2pdf.js` (wraps html2canvas + jsPDF) targeting a dedicated export-template DOM element that is styled for print, not for screen. Keep the export template separate from the live output panel to avoid layout constraints.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Pages / Vercel / Netlify | Static `dist/` deployment via Vite build | `vite.config.ts` `base` setting must match repo path for GitHub Pages |
| None (intentional) | No API calls; no analytics; no telemetry | VCF customer data is sensitive — zero external calls preserves trust |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `InputComponent` → `inputStore` | `v-model` / `store.$patch()` | Components never read from `calculationStore` directly |
| `inputStore` → `calculationStore` | Pinia cross-store `computed()` | `calculationStore` imports `useInputStore()` — one-way dependency |
| `calculationStore` → `ChartPanel` | `useChartData()` composable transforms results to Chart.js datasets | Decouples chart format concerns from store format |
| `engine/*.ts` → `stores/` | Function call with plain objects | Engine has zero store imports — testable without Pinia |
| `uiStore` → `vue-i18n` | `uiStore.setLocale()` calls `i18n.global.locale.value =` | Single locale source of truth in `uiStore` |
| `useUrlState` → `inputStore` | `inputStore.$patch()` on load | Only called once at app mount; idempotent |

---

## Build Order (Phase Boundaries)

The following sequence is dictated by hard dependencies:

```
Phase 1 — Foundation
    TypeScript types (engine/types.ts)
    inputStore (no dependencies)
    Calculation engine pure functions (no Vue dependency)
    i18n setup + EN locale
    AppShell + split-pane layout
    [Can validate all formulas via unit tests before any UI exists]

Phase 2 — Input Panel
    HostSpecPanel, DeploymentModePanel
    WorkloadPanel, StoragePanel
    Warning system (VCFA min-cores check)
    Requires: inputStore, i18n

Phase 3 — Output Panel
    calculationStore (requires inputStore + engine)
    SummaryCard, ResourceResult, StorageResult
    Requires: calculationStore

Phase 4 — Visualisations
    ChartPanel + individual charts
    useChartData() composable
    Requires: calculationStore

Phase 5 — Advanced Features
    StretchClusterPanel + stretchCalc.ts
    AIGPUPanel
    NVMe Tiering toggle + nvmeTieringCalc.ts
    Requires: Phase 2-3 complete

Phase 6 — Export + Sharing
    useExport() — PDF + Markdown
    useUrlState() — base64 URL encoding
    ExportToolbar
    Requires: calculationStore, all input panels

Phase 7 — i18n Completion
    FR, DE, IT locale files
    LanguageSwitcher component
    Lazy locale loading
    Requires: all UI components (to know all translation keys)

Phase 8 — Polish + Validation
    Full validation rules (useValidation composable)
    Responsive/mobile layout testing
    Accessibility (aria-label, keyboard nav)
    Requires: all features complete
```

---

## Sources

- [Pinia Official Documentation — Introduction](https://pinia.vuejs.org/introduction.html) — HIGH confidence
- [Pinia — Composing Stores](https://pinia.vuejs.org/cookbook/composing-stores.html) — HIGH confidence
- [Vue.js Official — Composables](https://vuejs.org/guide/reusability/composables.html) — HIGH confidence
- [Vue I18n — Composition API Guide](https://vue-i18n.intlify.dev/guide/advanced/composition) — HIGH confidence
- [vue-chartjs — Getting Started](https://vue-chartjs.org/guide/) — HIGH confidence
- [Broadcom TechDocs — VCF 9.0 Stretching Clusters](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/building-your-private-cloud-infrastructure/stretching-clusters.html) — HIGH confidence
- [William Lam — Minimal Resources for VCF 9.0 Lab](https://williamlam.com/2025/06/minimal-resources-for-deploying-vcf-9-0-in-a-lab.html) — HIGH confidence (verified against TechDocs)
- [VMware VCF Blog — NVMe Memory Tiering Part 3: Sizing for Success](https://blogs.vmware.com/cloud-foundation/2025/12/02/nvme-memory-tiering-design-and-sizing-on-vmware-cloud-foundation-9-part-3/) — HIGH confidence
- [VMware VCF Blog — Global Deduplication in vSAN ESA for VCF 9.0](https://blogs.vmware.com/cloud-foundation/2025/06/19/global-deduplication-in-vsan-esa-for-vmware-cloud-foundation-9-0/) — HIGH confidence
- [Broadcom TechDocs — vSAN Space Efficiency Features](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/vsan-deployment-administration-and-monitoring/administering-vmware-vsan/increasing-space-efficiency-in-a-vsan-cluster/vsan-space-efficiency-features.html) — HIGH confidence
- [splitpanes — Vue 3 Split Panel Library](https://github.com/antoniandre/splitpanes) — MEDIUM confidence (library exists, API needs Context7 verification before use)
- [html2pdf.js — Client-side HTML-to-PDF](https://ekoopmans.github.io/html2pdf.js/) — MEDIUM confidence (actively maintained; vue3-html2pdf wrapper available)

---

*Architecture research for: VCF 9.x Sizing Calculator SPA (client-side Vue 3)*
*Researched: 2026-03-28*
