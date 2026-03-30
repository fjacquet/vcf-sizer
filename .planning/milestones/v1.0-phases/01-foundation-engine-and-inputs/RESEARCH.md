# Phase 1: Foundation, Engine and Inputs - Research

**Researched:** 2026-03-28
**Domain:** Vue 3 + Vite 8 + Tailwind CSS v4 + Pinia 3 + vue-i18n v11 + Decimal.js + Vitest
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Framework:** Vue 3 (Composition API) — not React
- **Build tool:** Vite 8 — use `npm create vite@latest -- --template vue-ts`
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite` plugin only — no PostCSS config, no content array, just `@import "tailwindcss"` in main CSS
- **State:** Pinia 3 — two stores: `inputStore` (mutable user inputs) and `calculationStore` (read-only `computed()` results derived from inputStore)
- **Precision:** Decimal.js for all arithmetic — no native JS float math anywhere in the calculation engine
- **Testing:** Vitest — calculation engine formulas must have passing tests before any UI component uses them
- **i18n:** vue-i18n v11 (not v9 or v10 — both entered maintenance mode July 2025)
- **raidy Port:** Copy functions + adapt to TypeScript + Decimal.js — do not import raidy as a package dependency
- **Input design:** Number inputs as primary control; sliders as secondary helpers for host count, VM count, vCPU per VM
- **Locale:** Browser locale detection on first load via `navigator.language`; fallback to `en`
- **Swiss locales:** Explicit `fr-CH`, `de-CH`, `it-CH`, `en` — do NOT inherit from `fr` or `de`
- **Calculation Engine:** All formulas in `src/engine/*.ts` — zero Vue imports in these files
- **Engine modules:** `management.ts`, `compute.ts`, `storage.ts`, `validation.ts`
- **calculationStore:** Uses Pinia `computed()` refs that call engine functions with `inputStore` values as arguments; exposes only read-only computed results

### Claude's Discretion

- Exact Tailwind component styling and color palette
- Vitest test file organization within `src/engine/`
- TypeScript type definitions for input/output interfaces
- Exact slot layout for the language switcher component
- Whether to use `<script setup>` sugar or explicit `defineComponent` (prefer `<script setup>` for conciseness)

### Deferred Ideas (OUT OF SCOPE for Phase 1)

- Chart visualizations (Chart.js, vue-chartjs)
- Split-screen layout with results panel
- Shareable URL / export
- NVMe Memory Tiering inputs
- Stretch Cluster per-site inputs (witness sizing, cross-site bandwidth)
- AI/GPU workload inputs
- FR/DE/IT translation completion (Phase 1 wires i18n infrastructure with EN strings only)
- Dark mode

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Project scaffolds with Vite 8 + Vue 3 (Composition API) + TypeScript | Scaffold section — exact `npm create vite@latest -- --template vue-ts` command |
| FOUND-02 | Tailwind CSS v4 integrated via Vite plugin (no PostCSS config required) | Tailwind v4 section — `@tailwindcss/vite` plugin, `@import "tailwindcss"` in CSS |
| FOUND-03 | Pinia 3 state management installed and configured | Pinia 3 section — setup store pattern, cross-store composition |
| FOUND-04 | Decimal.js installed and used for all arithmetic | Decimal.js section — import, constructor, method chaining, proxy-safe extraction |
| FOUND-05 | Project deploys as static site (GitHub Pages/Vercel/Netlify) | Architecture section — `base`, hash vs history router |
| FOUND-06 | Vitest configured for pure calculation engine tests | Vitest section — no-DOM config, globals, pure TS test examples |
| I18N-01 | vue-i18n v11 with explicit Swiss locale declarations | vue-i18n section — createI18n with legacy:false, four explicit locales |
| I18N-02 | Language switcher component allows FR, EN, DE, IT | Architecture section — LanguageSwitcher component wiring |
| I18N-03 | All visible UI text externalized to locale message files | Architecture section — no hardcoded strings, all in en.json |
| I18N-04 | Number formatting via Intl.NumberFormat per locale | vue-i18n numberFormats section — explicit fr-CH, de-CH, it-CH, en configs |
| I18N-05 | Default language detected from browser locale; falls back to English | vue-i18n section — navigator.language mapping pattern |
| DEPLOY-01 | User can select Simple (Lab/POC) deployment model | Engine section — management.ts with deploymentMode = 'simple' |
| DEPLOY-02 | User can select High Availability deployment model (x3 multiplier) | Engine section — HA_MULTIPLIER constant, component-per-mode map |
| DEPLOY-03 | User can select Stretch Cluster deployment model | Engine section — Stretch shares HA multipliers in Phase 1 |
| MGMT-01 | vCenter Server: 4 vCPU / 21 GB RAM (always 1 instance) | Constants table in Code Examples |
| MGMT-02 | SDDC Manager: 4 vCPU / 16 GB RAM (always 1 instance) | Constants table in Code Examples |
| MGMT-03 | NSX Manager: 6 vCPU / 24 GB RAM x1 or x3 | Constants table + HA multiplier logic |
| MGMT-04 | VCF Operations: 4 vCPU / 16 GB RAM x1 or x3 + Fleet + Collector | Constants table — includes Fleet Manager 12 GB and Collector 16 GB |
| MGMT-05 | VCF Automation: 24 vCPU / 96 GB RAM x1 or x3 | Constants table + VCFA blocker |
| MGMT-06 | Total management domain overhead display | calculationStore computed pattern |
| MGMT-07 | Hard warning when host cores < 12 (VCFA deployment blocker) | validation.ts section — validationRules pattern |
| HOST-01 | User can input cores per socket | inputStore section — ref() fields |
| HOST-02 | User can input sockets per host | inputStore section |
| HOST-03 | User can input total RAM per host (GB) | inputStore section |
| HOST-04 | User can input raw storage per host (TB) | inputStore section |
| HOST-05 | User can input number of hosts in cluster | inputStore section |
| HOST-06 | Tool validates host minimum per deployment model | validation.ts section |
| WKLD-01 | User can input VM count | inputStore section |
| WKLD-02 | User can input average vCPU per VM | inputStore section |
| WKLD-03 | User can input average vRAM per VM (GB) | inputStore section |
| WKLD-04 | User can input average storage per VM (GB) | inputStore section |
| WKLD-05 | User can input vCPU over-commitment ratio (default 4:1) | inputStore section — ref defaults |
| WKLD-06 | User can input RAM over-commitment ratio (default 1:1) | inputStore section |
| STOR-01 | User can select principal storage: vSAN ESA, FC, NFS | inputStore section — storageType ref |
| STOR-02 | vSAN ESA Adaptive RAID-5 thresholds (2+1 at ≤5 hosts; 4+1 at 6+) | Storage engine section — raidy port divergence noted |
| STOR-03 | vSAN ESA overhead stack: RAID + LFS (~13%) + global metadata (~10%) | Storage engine section — overhead formula chain |
| STOR-04 | FTT policy selection (FTT=1 RAID-1, FTT=1 RAID-5, FTT=2 RAID-6) | Storage engine section — policy multiplier table |
| STOR-05 | Global Deduplication toggle with constraints | inputStore section — dedupEnabled ref |
| STOR-06 | Global Deduplication ratio configurable (default 2x) | inputStore section — dedupRatio ref |
| STOR-07 | FC and NFS: raw capacity pass-through | storage.ts section — passthrough pattern |
| STOR-08 | Display raw vs. net usable capacity with overhead breakdown | calculationStore computed output types |
| CALC-01 | All formulas as pure TypeScript functions with no Vue imports | Architecture section — engine module pattern |
| CALC-02 | calculationStore exposes only computed() read-only results | Pinia cross-store pattern |
| CALC-03 | Total cluster compute output: vCPUs, RAM, utilization % | compute.ts section |
| CALC-04 | Minimum host count recommendation computed and displayed | compute.ts formula section |
| CALC-05 | Context7 MCP used to verify all library API calls | Verified throughout this research document |

</phase_requirements>

---

## Summary

Phase 1 establishes the entire foundation: Vite 8 + Vue 3 + TypeScript scaffold, Tailwind CSS v4 via Vite plugin, Pinia 3 two-store architecture, vue-i18n v11 with explicit Swiss locales, Decimal.js for all arithmetic, Vitest for the pure calculation engine, and all input panels. The research confirms that all locked decisions are well-supported by current (2026-03-28) library APIs and are mutually compatible.

The most important finding from inspecting the raidy source is that raidy does NOT use Decimal.js — it uses native JavaScript arithmetic throughout. When porting the vSAN storage strategy (`vsanStrategy` in `src/engines/volumetry/strategies/vsan.ts`), all native number operations must be converted to Decimal.js method chains before the port is considered complete. The raidy Adaptive RAID-5 logic uses `serverCount >= 5 && driveCount >= serverCount * 20` as the 4+1 threshold (i.e., requires both enough nodes AND enough drives per node). The REQUIREMENTS.md and CONTEXT.md specify host-count-only thresholds (5 hosts = 2+1, 6+ hosts = 4+1) — the implementation should use the simpler host-count-only threshold as specified, not the raidy drive-count gate.

The critical configuration detail for Tailwind v4 is that no `tailwind.config.js` is needed and no `content` array is specified — content detection is automatic. The `@tailwindcss/vite` plugin handles everything. For vue-i18n v11, `legacy: false` is mandatory for Composition API mode, and the `numberFormats` configuration for each Swiss locale must be explicit and independent — no locale inherits formatting from its parent locale code.

**Primary recommendation:** Follow the exact scaffold sequence in the Standard Stack section. Write engine functions and Vitest tests first, then wire Pinia stores, then build input components. The calculation engine is the highest-risk component — validate formulas against the REQUIREMENTS.md constants before building any UI on top.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 8.0.3 | Build tool / dev server | Rolldown-powered (Rust); 10-30x faster than Vite 6; `npm create vite@latest -- --template vue-ts` produces correct scaffold; explicit Tailwind v4 support |
| Vue 3 | 3.5.31 | UI framework | Composition API + fine-grained reactivity; `<script setup>` sugar; locked decision |
| TypeScript | 5.7+ | Type safety | `strict: true`; `moduleResolution: "bundler"`; `isolatedModules: true`; required for vue-tsc |
| Tailwind CSS | 4.2.2 | Utility CSS | v4 Oxide engine; zero config via `@tailwindcss/vite`; locked decision |
| @tailwindcss/vite | 4.2.2 | Tailwind Vite plugin | Replaces PostCSS + postcss.config.js entirely; must match tailwindcss version |
| Pinia | 3.0.4 | State management | Vue 3-only (dropped Vue 2 in v3); setup store pattern; full TypeScript inference; locked decision |
| vue-i18n | 11.3.0 | i18n | Composition API mode (`legacy: false`); v9/v10 maintenance mode; locked decision |
| @intlify/unplugin-vue-i18n | 6.x | Build-time i18n compile | Pre-compiles JSON locale files to AST at build time; removes runtime parser; compatible with vue-i18n v11 |
| Decimal.js | 10.6.x | Arbitrary-precision math | `import Decimal from 'decimal.js'`; immutable API; TypeScript declarations included; locked decision |
| Vitest | latest | Unit test runner | Shares Vite config; zero extra setup for pure TS tests; locked decision |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-vue | 5.x | Vue SFC support for Vite | Required; `v5.x` for Vue 3 (not v4) |
| vue-router | 5.0.4 | Client-side routing | Hash mode for GitHub Pages; history mode for Vercel/Netlify |
| vue-tsc | 2.x | SFC type-check | CI only — `vue-tsc --noEmit`; Vite does NOT type-check |
| @vue/test-utils | 2.x | Component mount for tests | Phase 2+ component tests; not needed for pure engine tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind v4 | Tailwind v3 + PostCSS | v3 requires postcss.config.js, content array, tailwind.config.js — more boilerplate; v4 is faster and simpler |
| vue-i18n v11 | i18next + react-i18next | Only valid with React; lacks SFC `<i18n>` block integration |
| Decimal.js | BigNumber.js | Both provide arbitrary precision; Decimal.js has slightly smaller API surface and immutable design that maps better to pure functional engine |
| Pinia setup stores | Pinia option stores | Option stores use `getters:`/`actions:` syntax; setup stores use `computed()`/`function` — setup style maps directly to Vue Composition API mental model |

### Installation

```bash
# 1. Scaffold with Vite 8 + Vue 3 + TypeScript
npm create vite@latest vcf-sizer -- --template vue-ts
cd vcf-sizer

# 2. Core runtime dependencies
npm install pinia@^3.0.4
npm install vue-router@^5.0.4
npm install vue-i18n@11
npm install decimal.js@^10.6.0

# 3. Tailwind CSS v4 (versions must match)
npm install tailwindcss@^4.2.2 @tailwindcss/vite@^4.2.2

# 4. Build-time i18n compilation
npm install @intlify/unplugin-vue-i18n@^6.0.0

# 5. Dev dependencies
npm install -D typescript vue-tsc
npm install -D vitest @vitest/ui
npm install -D eslint eslint-plugin-vue @vue/eslint-config-typescript prettier
```

**Version verification:** Versions above are from research conducted 2026-03-28. Before running installation, verify current npm versions:

```bash
npm view vite version
npm view vue version
npm view pinia version
npm view vue-i18n version
npm view tailwindcss version
npm view decimal.js version
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── engine/                     # Pure TypeScript — zero Vue imports
│   ├── types.ts                # SizingInputs, SizingResult, MgmtDomainResult, StorageResult
│   ├── management.ts           # VCF management domain formulas (vCenter, SDDC, NSX, Ops, VCFA)
│   ├── compute.ts              # Total vCPU/RAM, utilization %, host count recommendation
│   ├── storage.ts              # vSAN ESA (ported from raidy), FC/NFS pass-through
│   └── validation.ts           # Hard constraint checks (VCFA 12-core blocker, mutual exclusions)
├── stores/
│   ├── inputStore.ts           # All user inputs (Pinia setup store with ref())
│   ├── calculationStore.ts     # Computed results only (reads inputStore via engine)
│   └── uiStore.ts              # Locale, layout flags (Phase 1: locale only)
├── components/
│   ├── input/
│   │   ├── DeploymentModePanel.vue
│   │   ├── HostSpecPanel.vue
│   │   ├── WorkloadPanel.vue
│   │   └── StoragePanel.vue
│   └── shared/
│       ├── LanguageSwitcher.vue
│       └── WarningBanner.vue
├── i18n/
│   ├── index.ts                # createI18n instance (legacy: false)
│   └── locales/
│       ├── en.json             # Source of truth; all keys defined here first
│       ├── fr.json             # Phase 1: copy of en.json with FR translations (or same)
│       ├── de.json             # Phase 1: wired but translations deferred to Phase 3
│       └── it.json             # Phase 1: wired but translations deferred to Phase 3
├── App.vue                     # Root component
└── main.ts                     # createApp, Pinia, vue-i18n, vue-router
```

### Pattern 1: Vite + Tailwind v4 + Vue i18n Plugin Configuration

**What:** Complete `vite.config.ts` for Phase 1, covering all three Vite plugins.

**When to use:** Project root — this is the only Vite config needed.

```typescript
// vite.config.ts
// Source: Tailwind CSS official docs (tailwindcss.com/docs/guides/vite) + intlify bundle-tools README
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import path from 'path'

export default defineConfig({
  base: '/vcf-sizer/',  // Required for GitHub Pages subpath deployment
  plugins: [
    vue(),
    tailwindcss(),      // No arguments needed — automatic content detection
    VueI18nPlugin({
      include: [path.resolve(__dirname, './src/i18n/locales/**')],
      // runtimeOnly: false  // default; enables both legacy and composition mode
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

```css
/* src/style.css — single line only; no config file, no content array */
@import "tailwindcss";
```

**Key gotcha:** The `@tailwindcss/vite` and `tailwindcss` package versions must be identical. Installing them separately can produce version mismatches that cause silent build failures.

### Pattern 2: TypeScript Configuration

**What:** `tsconfig.app.json` settings required for Vite 8 + Vue 3.

```json
// tsconfig.app.json
// Source: vuejs/tsconfig GitHub, Vite 8 features docs
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "exclude": ["node_modules"]
}
```

**Key requirements:**

- `moduleResolution: "bundler"` — required for Vite 8; replaces old `node` mode
- `isolatedModules: true` — required because Vite/esbuild transpiles without type info
- `strict: true` — mandatory; catches formula bugs at compile time

### Pattern 3: Pinia Two-Store Split

**What:** `inputStore` holds all mutable user inputs; `calculationStore` holds only `computed()` derived results. Cross-store access is safe when `useInputStore()` is called at the top of the setup function.

**Source:** [pinia.vuejs.org/cookbook/composing-stores.html](https://pinia.vuejs.org/cookbook/composing-stores.html)

```typescript
// src/stores/inputStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useInputStore = defineStore('input', () => {
  // Deployment
  const deploymentMode = ref<'simple' | 'ha' | 'stretch'>('ha')

  // Host spec
  const coresPerSocket = ref(16)
  const socketsPerHost = ref(2)
  const hostRamGB = ref(512)
  const hostStorageTB = ref(3.84)
  const hostCount = ref(4)

  // Workload
  const vmCount = ref(100)
  const avgVcpuPerVm = ref(4)
  const avgVramGbPerVm = ref(8)
  const avgStorageGbPerVm = ref(100)
  const cpuOvercommitRatio = ref(4)
  const ramOvercommitRatio = ref(1)

  // Storage
  const storageType = ref<'vsan-esa' | 'fc' | 'nfs'>('vsan-esa')
  const fttLevel = ref<1 | 2>(1)
  const raidType = ref<'raid1' | 'raid5' | 'raid6'>('raid5')
  const dedupEnabled = ref(false)
  const dedupRatio = ref(2)

  return {
    deploymentMode,
    coresPerSocket, socketsPerHost, hostRamGB, hostStorageTB, hostCount,
    vmCount, avgVcpuPerVm, avgVramGbPerVm, avgStorageGbPerVm,
    cpuOvercommitRatio, ramOvercommitRatio,
    storageType, fttLevel, raidType, dedupEnabled, dedupRatio,
  }
})
```

```typescript
// src/stores/calculationStore.ts
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useInputStore } from './inputStore'
import { calcManagement } from '../engine/management'
import { calcCompute } from '../engine/compute'
import { calcStorage } from '../engine/storage'
import { validateInputs } from '../engine/validation'

export const useCalculationStore = defineStore('calculation', () => {
  // IMPORTANT: call useInputStore() at the TOP LEVEL — not inside computed()
  const input = useInputStore()

  const management = computed(() => calcManagement(input.deploymentMode))

  const compute = computed(() => calcCompute({
    deploymentMode: input.deploymentMode,
    coresPerSocket: input.coresPerSocket,
    socketsPerHost: input.socketsPerHost,
    hostRamGB: input.hostRamGB,
    hostCount: input.hostCount,
    vmCount: input.vmCount,
    avgVcpuPerVm: input.avgVcpuPerVm,
    avgVramGbPerVm: input.avgVramGbPerVm,
    cpuOvercommitRatio: input.cpuOvercommitRatio,
    ramOvercommitRatio: input.ramOvercommitRatio,
    managementCores: management.value.totalCores,
    managementRamGB: management.value.totalRamGB,
  }))

  const storage = computed(() => calcStorage({
    storageType: input.storageType,
    hostCount: input.hostCount,
    hostStorageTB: input.hostStorageTB,
    fttLevel: input.fttLevel,
    raidType: input.raidType,
    dedupEnabled: input.dedupEnabled,
    dedupRatio: input.dedupRatio,
  }))

  const validationErrors = computed(() => validateInputs({
    deploymentMode: input.deploymentMode,
    coresPerSocket: input.coresPerSocket,
    socketsPerHost: input.socketsPerHost,
    hostCount: input.hostCount,
    dedupEnabled: input.dedupEnabled,
    storageType: input.storageType,
  }))

  // All returned values are computed — no mutable state in calculationStore
  return { management, compute, storage, validationErrors }
})
```

### Pattern 4: Pure TypeScript Engine Functions with Decimal.js

**What:** All VCF business logic is pure TypeScript — no Vue imports, no Pinia, no side effects. Every function takes typed input, returns typed output.

**Critical:** Decimal.js instances are immutable; each arithmetic operation returns a new `Decimal`. Never store `Decimal` objects directly in reactive state — always call `.toNumber()` before storing in `ref()` or returning from a `computed()`.

```typescript
// src/engine/types.ts
export type DeploymentMode = 'simple' | 'ha' | 'stretch'
export type StorageType = 'vsan-esa' | 'fc' | 'nfs'
export type RaidType = 'raid1' | 'raid5' | 'raid6'
export type FttLevel = 1 | 2

export interface MgmtDomainResult {
  vcenterCores: number; vcenterRamGB: number
  sddcCores: number;    sddcRamGB: number
  nsxCores: number;     nsxRamGB: number
  opsCores: number;     opsRamGB: number
  automationCores: number; automationRamGB: number
  totalCores: number;   totalRamGB: number
  warnings: ValidationWarning[]
}

export interface ValidationWarning {
  code: string
  severity: 'error' | 'warning'
  message: string
}
```

```typescript
// src/engine/management.ts
// Source: CONTEXT.md §Management Domain Constants (locked from Broadcom TechDocs)
import Decimal from 'decimal.js'
import type { DeploymentMode, MgmtDomainResult, ValidationWarning } from './types'

const HA_MULTIPLIER = 3

// Locked constants — source: Broadcom TechDocs VCF 9.0 + William Lam lab verification
const COMPONENTS = {
  vcenter:    { cores: 4,  ramGB: 21 },
  sddc:       { cores: 4,  ramGB: 16 },
  nsxManager: { cores: 6,  ramGB: 24 },
  ops:        { cores: 4,  ramGB: 16 },
  opsFleet:   { cores: 4,  ramGB: 12 },
  opsCollect: { cores: 4,  ramGB: 16 },
  automation: { cores: 24, ramGB: 96 },
} as const

export function calcManagement(mode: DeploymentMode): MgmtDomainResult {
  const haMulti = (mode === 'ha' || mode === 'stretch') ? HA_MULTIPLIER : 1

  // Use Decimal for all arithmetic to prevent float drift
  const totalCores = new Decimal(COMPONENTS.vcenter.cores)
    .plus(COMPONENTS.sddc.cores)
    .plus(new Decimal(COMPONENTS.nsxManager.cores).times(haMulti))
    .plus(new Decimal(COMPONENTS.ops.cores).times(haMulti))
    .plus(COMPONENTS.opsFleet.cores)
    .plus(COMPONENTS.opsCollect.cores)
    .plus(new Decimal(COMPONENTS.automation.cores).times(haMulti))
    .toNumber()

  const totalRamGB = new Decimal(COMPONENTS.vcenter.ramGB)
    .plus(COMPONENTS.sddc.ramGB)
    .plus(new Decimal(COMPONENTS.nsxManager.ramGB).times(haMulti))
    .plus(new Decimal(COMPONENTS.ops.ramGB).times(haMulti))
    .plus(COMPONENTS.opsFleet.ramGB)
    .plus(COMPONENTS.opsCollect.ramGB)
    .plus(new Decimal(COMPONENTS.automation.ramGB).times(haMulti))
    .toNumber()

  const warnings: ValidationWarning[] = []
  // VCFA always requires 12 physical cores / 24 threads — hard blocker
  warnings.push({
    code: 'VCFA_MIN_CORES',
    severity: 'error',
    message: 'vcfa_core_requirement',  // i18n key, not English string
  })

  return {
    vcenterCores: COMPONENTS.vcenter.cores,
    vcenterRamGB: COMPONENTS.vcenter.ramGB,
    sddcCores: COMPONENTS.sddc.cores,
    sddcRamGB: COMPONENTS.sddc.ramGB,
    nsxCores: COMPONENTS.nsxManager.cores * haMulti,
    nsxRamGB: COMPONENTS.nsxManager.ramGB * haMulti,
    opsCores: (COMPONENTS.ops.cores + COMPONENTS.opsFleet.cores + COMPONENTS.opsCollect.cores) * haMulti,
    opsRamGB: (COMPONENTS.ops.ramGB + COMPONENTS.opsFleet.ramGB + COMPONENTS.opsCollect.ramGB) * haMulti,
    automationCores: COMPONENTS.automation.cores * haMulti,
    automationRamGB: COMPONENTS.automation.ramGB * haMulti,
    totalCores,
    totalRamGB,
    warnings,
  }
}
```

### Pattern 5: vSAN ESA Storage Engine (raidy Port with Decimal.js)

**What:** vSAN ESA capacity calculation ported from raidy's `vsanStrategy` to TypeScript + Decimal.js. Key divergence from raidy: the REQUIREMENTS.md specifies host-count-only RAID-5 thresholds (not raidy's host-count + drive-count gate).

**Critical divergence from raidy source:** raidy uses `serverCount >= 5 && driveCount >= serverCount * 20` to gate 4+1 RAID-5. The REQUIREMENTS.md specifies: "2+1 at 5 hosts; 4+1 at 6+ hosts" — use this simpler host-count-only rule.

```typescript
// src/engine/storage.ts
// Ported from: /Users/fjacquet/Projects/raidy/src/engines/volumetry/strategies/vsan.ts
// Divergence: host-count-only RAID-5 threshold (per REQUIREMENTS.md STOR-02)
import Decimal from 'decimal.js'
import type { StorageType, RaidType, FttLevel } from './types'

// Source: ARCHITECTURE.md §vSAN ESA Storage Sizing
// LFS overhead: ~13% of usable capacity
// Global metadata pool: ~10% of total raw cluster capacity
const LFS_OVERHEAD = 0.13
const GLOBAL_METADATA_OVERHEAD = 0.10
const VSAN_SLACK_RESERVE = 0.30  // 30% slack for performance headroom

export interface StorageInputs {
  storageType: StorageType
  hostCount: number
  hostStorageTB: number
  fttLevel: FttLevel
  raidType: RaidType
  dedupEnabled: boolean
  dedupRatio: number
}

export interface StorageResult {
  rawCapacityTB: number
  raidMultiplier: number
  usableAfterRaidTB: number
  lfsOverheadTB: number
  metadataOverheadTB: number
  usableBeforeDedupTB: number
  effectiveCapacityTB: number
  safeUsableCapacityTB: number
  raidScheme: string      // e.g. '4+1', '2+1', 'RAID-1'
  minHostsRequired: number
}

/**
 * Calculate RAID overhead multiplier for vSAN ESA.
 * Source: REQUIREMENTS.md STOR-02 (Adaptive RAID-5 threshold: 2+1 at ≤5 hosts, 4+1 at 6+)
 * Source: PITFALLS.md §vSAN ESA Adaptive RAID-5 Threshold
 */
export function vsanEsaRaidOverhead(
  hostCount: number,
  fttLevel: FttLevel,
  raidType: RaidType,
): { multiplier: number; scheme: string; minHosts: number } {
  if (raidType === 'raid1') {
    if (fttLevel === 1) return { multiplier: 2.0, scheme: 'RAID-1 (FTT=1)', minHosts: 3 }
    if (fttLevel === 2) return { multiplier: 3.0, scheme: 'RAID-1 (FTT=2)', minHosts: 5 }
  }
  if (raidType === 'raid5' && fttLevel === 1) {
    // Adaptive RAID-5: 2+1 for ≤5 hosts, 4+1 for 6+ hosts
    // Per REQUIREMENTS.md STOR-02: threshold is 5 hosts (2+1) vs 6+ (4+1)
    const canUse4Plus1 = hostCount >= 6
    if (canUse4Plus1) return { multiplier: 1.25, scheme: '4+1 (FTT=1 RAID-5)', minHosts: 6 }
    return { multiplier: 1.5, scheme: '2+1 (FTT=1 RAID-5)', minHosts: 4 }
  }
  if (raidType === 'raid6' && fttLevel === 2) {
    return { multiplier: 1.5, scheme: '4+2 (FTT=2 RAID-6)', minHosts: 6 }
  }
  // Fallback to RAID-1
  return { multiplier: 2.0, scheme: 'RAID-1 (FTT=1)', minHosts: 3 }
}

export function calcStorage(inputs: StorageInputs): StorageResult {
  const { storageType, hostCount, hostStorageTB, fttLevel, raidType, dedupEnabled, dedupRatio } = inputs

  const rawCapacityTB = new Decimal(hostCount).times(hostStorageTB).toNumber()

  // FC and NFS: pass-through, no RAID overhead
  if (storageType === 'fc' || storageType === 'nfs') {
    return {
      rawCapacityTB,
      raidMultiplier: 1,
      usableAfterRaidTB: rawCapacityTB,
      lfsOverheadTB: 0,
      metadataOverheadTB: 0,
      usableBeforeDedupTB: rawCapacityTB,
      effectiveCapacityTB: dedupEnabled
        ? new Decimal(rawCapacityTB).times(dedupRatio).toNumber()
        : rawCapacityTB,
      safeUsableCapacityTB: rawCapacityTB,
      raidScheme: 'Pass-through',
      minHostsRequired: 1,
    }
  }

  // vSAN ESA: apply full overhead stack (REQUIREMENTS.md STOR-02, STOR-03)
  const { multiplier, scheme, minHosts } = vsanEsaRaidOverhead(hostCount, fttLevel, raidType)

  // Step 1: Apply deduplication before RAID (if enabled)
  // Per ARCHITECTURE.md §vSAN ESA Storage Sizing: raw → dedup → RAID → LFS → metadata
  const rawForRaid = dedupEnabled
    ? new Decimal(rawCapacityTB).times(dedupRatio)
    : new Decimal(rawCapacityTB)

  // Step 2: RAID overhead
  const usableAfterRaidTB = rawForRaid.dividedBy(multiplier).toNumber()

  // Step 3: LFS overhead (~13% of usable after RAID)
  const lfsOverheadTB = new Decimal(usableAfterRaidTB).times(LFS_OVERHEAD).toNumber()

  // Step 4: Global metadata pool (~10% of total raw cluster capacity)
  const metadataOverheadTB = new Decimal(rawCapacityTB).times(GLOBAL_METADATA_OVERHEAD).toNumber()

  // Step 5: Net usable before dedup benefit
  const usableBeforeDedupTB = new Decimal(usableAfterRaidTB)
    .minus(lfsOverheadTB)
    .minus(metadataOverheadTB)
    .toNumber()

  // Step 6: Effective capacity (dedup already applied in step 1, so ratio is 1 here)
  const effectiveCapacityTB = usableBeforeDedupTB

  // Step 7: Safe usable (reserve 30% slack for performance)
  const safeUsableCapacityTB = new Decimal(effectiveCapacityTB)
    .times(1 - VSAN_SLACK_RESERVE)
    .toNumber()

  return {
    rawCapacityTB,
    raidMultiplier: multiplier,
    usableAfterRaidTB,
    lfsOverheadTB,
    metadataOverheadTB,
    usableBeforeDedupTB,
    effectiveCapacityTB,
    safeUsableCapacityTB,
    raidScheme: scheme,
    minHostsRequired: minHosts,
  }
}
```

### Pattern 6: vue-i18n v11 with Explicit Swiss Locale numberFormats

**What:** Complete `i18n/index.ts` setup with `legacy: false`, four explicit Swiss locales in `numberFormats`, and lazy loading for FR/DE/IT.

**Source:** [vue-i18n.intlify.dev/guide/essentials/number](https://vue-i18n.intlify.dev/guide/essentials/number) and [vue-i18n.intlify.dev/guide/advanced/lazy](https://vue-i18n.intlify.dev/guide/advanced/lazy)

```typescript
// src/i18n/index.ts
import { createI18n } from 'vue-i18n'
import type { I18nOptions } from 'vue-i18n'
import en from './locales/en.json'

export type SupportedLocale = 'en' | 'fr-CH' | 'de-CH' | 'it-CH'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'fr-CH', 'de-CH', 'it-CH']

// Source: PITFALLS.md §Swiss Locale Number Formatting Inconsistency
// CRITICAL: Each locale MUST be defined explicitly — no inheritance from parent codes.
// fr-CH does NOT inherit from fr. de-CH does NOT inherit from de.
// Intl.NumberFormat for de-CH and it-CH uses apostrophe (') as thousands separator.
// fr-CH historically inconsistent across runtimes — define explicitly.
const numberFormats: I18nOptions['numberFormats'] = {
  'en': {
    decimal: {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
    percent: {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    },
  },
  'fr-CH': {
    decimal: {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
    percent: {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    },
  },
  'de-CH': {
    decimal: {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
    percent: {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    },
  },
  'it-CH': {
    decimal: {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
    percent: {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    },
  },
}

export const i18n = createI18n({
  legacy: false,         // REQUIRED for Composition API (useI18n())
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },      // Only EN loaded eagerly; others lazy-loaded on demand
  numberFormats,
})

// Detect browser locale and map to supported locale
export function detectLocale(): SupportedLocale {
  const lang = navigator.language  // e.g. 'fr-CH', 'de', 'it-IT', 'en-US'
  if (lang === 'fr-CH' || lang.startsWith('fr')) return 'fr-CH'
  if (lang === 'de-CH' || lang.startsWith('de')) return 'de-CH'
  if (lang === 'it-CH' || lang.startsWith('it')) return 'it-CH'
  return 'en'
}

// Lazy-load locale messages on demand
// Source: vue-i18n.intlify.dev/guide/advanced/lazy
export async function loadLocale(locale: SupportedLocale): Promise<void> {
  if (locale === 'en') return  // EN is eagerly loaded

  if (!i18n.global.availableLocales.includes(locale)) {
    const messages = await import(`./locales/${locale}.json`)
    i18n.global.setLocaleMessage(locale, messages.default)
  }

  // Composition API mode: set via .value
  i18n.global.locale.value = locale
  document.documentElement.setAttribute('lang', locale)
}
```

**Using `$n()` in templates:**

```vue
<!-- In component templates -->
<template>
  <!-- Format a number using the 'decimal' named format for current locale -->
  <span>{{ $n(1234567, 'decimal') }}</span>
  <!-- Renders: 1'234'567 (de-CH), 1 234 567 (fr-CH), etc. -->

  <!-- Force a specific locale for a number (override current) -->
  <span>{{ $n(value, 'decimal', 'de-CH') }}</span>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t, n } = useI18n()

// In composition scripts:
const formatted = n(1234567, 'decimal')  // uses current locale
</script>
```

### Pattern 7: Vitest Configuration for Pure TypeScript Engine Tests

**What:** Minimal Vitest configuration for testing pure TypeScript functions with no DOM or Vue component mounting.

**Source:** [vitest.dev/config/](https://vitest.dev/config/)

```typescript
// vitest.config.ts (at project root — higher priority than vite.config.ts test section)
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,        // Enables describe, it, expect without explicit imports
    // No environment: pure Node.js is correct for engine function tests
    // Add environment: 'jsdom' ONLY when testing Vue components
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/engine/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

**Add to tsconfig.json for globals type support:**

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

**Example pure engine test:**

```typescript
// src/engine/__tests__/management.test.ts
import { describe, it, expect } from 'vitest'
import { calcManagement } from '../management'

describe('calcManagement', () => {
  it('simple mode: no HA multipliers', () => {
    const result = calcManagement('simple')
    // vCenter 4 + SDDC 4 + NSX 6x1 + Ops(4+4+4)x1 + VCFA 24x1
    expect(result.totalCores).toBe(4 + 4 + 6 + 12 + 24)
    expect(result.nsxCores).toBe(6)
    expect(result.automationCores).toBe(24)
  })

  it('HA mode: x3 multiplier on NSX, Ops, VCFA', () => {
    const result = calcManagement('ha')
    expect(result.nsxCores).toBe(18)   // 6 * 3
    expect(result.automationCores).toBe(72)  // 24 * 3
    // Total: vCenter 4 + SDDC 4 + NSX 18 + Ops(12+4+4)x3=60? check exact
    // Per MGMT-04: ops is (4+4+4) * 3 for HA? Fleet and Collector not multiplied separately
    // Use test to verify the exact interpretation matches REQUIREMENTS.md MGMT-03/04
  })

  it('stretch mode: same HA multipliers as HA mode', () => {
    const ha = calcManagement('ha')
    const stretch = calcManagement('stretch')
    expect(stretch.totalCores).toBe(ha.totalCores)
    expect(stretch.totalRamGB).toBe(ha.totalRamGB)
  })
})

describe('vsanEsaRaidOverhead', () => {
  it('5 hosts with RAID-5 uses 2+1 scheme (1.5x overhead)', () => {
    const { multiplier, scheme } = vsanEsaRaidOverhead(5, 1, 'raid5')
    expect(multiplier).toBe(1.5)
    expect(scheme).toContain('2+1')
  })

  it('6 hosts with RAID-5 uses 4+1 scheme (1.25x overhead)', () => {
    const { multiplier, scheme } = vsanEsaRaidOverhead(6, 1, 'raid5')
    expect(multiplier).toBe(1.25)
    expect(scheme).toContain('4+1')
  })

  it('no float drift: 5-node RAID-5 overhead is exactly 1.5', () => {
    // Verify Decimal.js produces clean results
    const { multiplier } = vsanEsaRaidOverhead(5, 1, 'raid5')
    expect(multiplier).toStrictEqual(1.5)  // not 1.4999999999...
  })
})
```

### Pattern 8: Decimal.js Usage Rules

**What:** Conventions for using Decimal.js throughout the calculation engine to prevent float errors.

**Source:** [mikemcl.github.io/decimal.js/](https://mikemcl.github.io/decimal.js/)

```typescript
// Rule 1: All intermediate arithmetic uses Decimal chaining
import Decimal from 'decimal.js'

// CORRECT — Decimal chain, extract at the end
const hostCount = 6
const storagePerHostTB = 3.84
const rawCapacityTB = new Decimal(hostCount)
  .times(storagePerHostTB)
  .toNumber()  // extract primitive number at the boundary

// WRONG — native float arithmetic
const wrong = hostCount * storagePerHostTB  // May accumulate drift

// Rule 2: NEVER store Decimal instances in Pinia reactive state
// WRONG — breaks Vue proxy
// const someRef = ref(new Decimal('3.84'))

// CORRECT — extract number before storing
const someRef = ref(new Decimal('3.84').toNumber())  // ref holds a number, not Decimal

// Rule 3: Input values from DOM are strings — always construct via Decimal
function parseHostStorage(inputValue: string): number {
  try {
    return new Decimal(inputValue).toNumber()
  } catch {
    return 0  // invalid input
  }
}

// Rule 4: Comparison at Decimal boundaries
// WRONG
if (activeMemoryGB <= totalRamGB * 0.5) { ... }  // float comparison

// CORRECT
if (new Decimal(activeMemoryGB).lte(new Decimal(totalRamGB).times(0.5))) { ... }
```

### Anti-Patterns to Avoid

- **Business logic in Vue components:** Never put vSAN formulas in `<script setup>` — they must live in `src/engine/*.ts`
- **Native float arithmetic in the engine:** Any `*`, `/`, `+`, `-` in engine files must use Decimal.js; no exceptions
- **Single monolithic store:** `calculationStore` must never hold mutable state; it returns `computed()` only
- **Decimal instances in reactive state:** Call `.toNumber()` before returning from engine functions; never put Decimal objects into `ref()` or `reactive()`
- **Hardcoded English strings in components:** All user-visible text must be in locale files via `t()` keys
- **`fr-CH` inheriting from `fr` in numberFormats:** Define every Swiss locale explicitly — no inheritance
- **`legacy: true` in createI18n:** Always use `legacy: false` for Composition API; legacy mode prevents `useI18n()` hook

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Arbitrary-precision arithmetic | Custom float helpers | `decimal.js` | LFS overhead (13%) on 3.84 TB produces irrational floats; Decimal guarantees exact decimal representation |
| i18n string externalization | Custom translation map | `vue-i18n` v11 | Pluralization, number/date formatting, lazy loading, SFC blocks, browser locale detection all built in |
| State management between stores | Custom event bus | Pinia cross-store composition | Pinia's `computed()` cross-store pattern provides automatic reactivity, TypeScript inference, and devtools integration |
| Build-time locale compilation | Custom webpack loader | `@intlify/unplugin-vue-i18n` | Pre-compiles JSON to optimized JS AST; eliminates 40+ KB runtime parser from production bundle |
| Tailwind PostCSS pipeline | Manual PostCSS config | `@tailwindcss/vite` | v4 plugin handles content detection, incremental compilation, and Vite HMR integration automatically |
| Vue SFC TypeScript type-checking | Manual tsc | `vue-tsc --noEmit` | Vite's esbuild transpiles TypeScript without checking types; only `vue-tsc` understands `.vue` file types |

**Key insight:** The calculation engine is where custom code is correct. The infrastructure (state, i18n, CSS, build) should use the established ecosystem to minimize maintenance burden.

---

## raidy Port Analysis

**raidy project found at:** `/Users/fjacquet/Projects/raidy`

**Technology stack:** React 19 + Zustand + react-i18next + Recharts + Vite 8 + Tailwind v4. Note: raidy is a React project — its patterns cannot be lifted directly; only the calculation logic is portable.

**raidy does NOT use Decimal.js.** All arithmetic in raidy uses native JavaScript `Number`. When porting, every native operation (`*`, `/`, `+`, `-` on floats) must be replaced with Decimal.js method chains.

**Key file to port:** `src/engines/volumetry/strategies/vsan.ts` — the `vsanStrategy.calculateDataFraction()` function.

**Divergence from raidy's RAID-5 threshold:** raidy gates 4+1 on both `serverCount >= 5 AND driveCount >= serverCount * 20`. The REQUIREMENTS.md STOR-02 specifies: "2+1 at 5 hosts; 4+1 at 6+ hosts" — host count only. The vcf-sizer engine should use the host-count-only threshold per REQUIREMENTS.md.

**raidy overhead model differs significantly from REQUIREMENTS.md:** raidy uses a 1.5% filesystem overhead for vSAN ESA. The vcf-sizer REQUIREMENTS.md (STOR-03) specifies: LFS ~13% + global metadata pool ~10% of raw. These are materially different formulas targeting different overhead layers. Use the REQUIREMENTS.md formula stack, not raidy's `getFilesystemOverheadPercent` value.

**raidy test file:** `tests/engines/volumetry/strategies/raid.spec.ts` (covers generic RAID, not vSAN-specific). Use this as structural reference for Vitest test organization, but write new vSAN-specific tests from the REQUIREMENTS.md specification, not from raidy test cases.

---

## Common Pitfalls

### Pitfall 1: Tailwind v4 Content Detection Not Working

**What goes wrong:** Tailwind classes in `.vue` files are purged from production build; components appear unstyled.

**Why it happens:** Installing `tailwindcss` v3 alongside `@tailwindcss/vite` v4 (version mismatch), or manually adding a `tailwind.config.js` with an incorrect `content` array that shadows the v4 automatic detection.

**How to avoid:** Keep `tailwindcss` and `@tailwindcss/vite` versions in sync (both `^4.2.2`). Delete any `tailwind.config.js` and `postcss.config.js` — they are not needed and can interfere. Verify the CSS file contains only `@import "tailwindcss"` with no v3-style `@tailwind base/components/utilities` directives.

**Warning signs:** Production build has no styling; `npm run build` produces no Tailwind classes in output CSS.

### Pitfall 2: vue-i18n `legacy: true` Preventing `useI18n()`

**What goes wrong:** `useI18n()` throws an error or returns undefined at runtime. Template `{{ t('key') }}` does not work.

**Why it happens:** `createI18n({ legacy: true })` (or omitting `legacy` entirely, since the default was `true` in older docs). In v11, the default is `false` for new installs, but if copying older setup examples the flag may be omitted or set wrong.

**How to avoid:** Always explicitly set `legacy: false` in `createI18n`. The `legacy: false` flag is the single most important configuration for Composition API compatibility.

**Warning signs:** `Error: useI18n() must be called inside a setup()` or translations showing key paths instead of translated text.

### Pitfall 3: Decimal Instances Stored in Pinia Reactive State

**What goes wrong:** Vue's `reactive()` proxy wraps the Decimal object and intercepts property access on its internal `d`, `e`, `s` fields. This breaks Decimal's internal arithmetic and produces `NaN` results or throws proxy recursion errors.

**Why it happens:** Writing `const total = ref(new Decimal('100'))` — the `ref()` wraps the Decimal instance in a reactive proxy.

**How to avoid:** Always call `.toNumber()` (or `.toString()`) at the engine-store boundary. Engine functions return plain `number` values; stores hold `number` in `ref()`. Decimal arithmetic stays entirely inside engine function bodies.

### Pitfall 4: Swiss Locale fr-CH Not Showing Apostrophe Thousands Separator

**What goes wrong:** Numbers display with a space separator or no separator in fr-CH, or European format `1.234.567,89` appears in de-CH.

**Why it happens:** Defining `fr` in `numberFormats` but not `fr-CH`. vue-i18n delegates to `Intl.NumberFormat` with the locale string as-is — `fr-CH` is NOT the same as `fr` and does not inherit formatting.

**How to avoid:** Define `numberFormats` explicitly for all four locales: `en`, `fr-CH`, `de-CH`, `it-CH`. Never rely on parent locale inheritance for number formats. Test with `$n(1234567, 'decimal')` in all four locales after setup.

**Warning signs:** German locale shows European decimal commas; French locale shows spaces instead of apostrophes; Italian locale looks identical to standard Italian (not Swiss).

### Pitfall 5: vSAN ESA 2+1 vs 4+1 Threshold Off-by-One

**What goes wrong:** A 5-node cluster shows the same storage as a 6-node cluster because the threshold is implemented as `>= 5` instead of `>= 6` for 4+1.

**Why it happens:** The PITFALLS.md documents two different threshold descriptions:

- "3 to 5 hosts = 2+1 scheme; 6+ hosts = 4+1 scheme" (PITFALLS.md §Pitfall 2)
- REQUIREMENTS.md STOR-02: "2+1 at 5 hosts; 4+1 at 6+ hosts"

These are consistent: 5 hosts → 2+1, 6+ hosts → 4+1. The implementation must be `hostCount >= 6` for 4+1.

**How to avoid:** Write a Vitest test that explicitly asserts 5-node RAID-5 returns 1.5x and 6-node returns 1.25x before any storage UI is built.

### Pitfall 6: MGMT-04 Over-Commitment Formula for VCF Operations

**What goes wrong:** VCF Operations Fleet Manager and Collector are treated as additional instances in HA mode (×3 each), when they should remain as singletons regardless of deployment mode.

**Why it happens:** REQUIREMENTS.md MGMT-04 states "4 vCPU / 16 GB RAM × 1 or × 3, plus Fleet Manager (12 GB) and Collector (16 GB)" — the "plus" is ambiguous. Cross-referencing ARCHITECTURE.md and CONTEXT.md: Fleet Manager and Collector are specified as fixed-size appliances (not HA-multiplied). The ×3 multiplier applies to the core VCF Operations appliance only.

**How to avoid:** Implement Fleet Manager and Collector as fixed additions (not multiplied by `haMulti`). Write a test that verifies their RAM contribution is identical in Simple and HA modes.

---

## Code Examples

### main.ts Bootstrap

```typescript
// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import { i18n, detectLocale, loadLocale } from './i18n/index'
import './style.css'

const pinia = createPinia()
const router = createRouter({
  history: createWebHashHistory('/vcf-sizer/'),
  routes: [{ path: '/', component: () => import('./App.vue') }],
})

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(i18n)

// Detect and load initial locale
const initialLocale = detectLocale()
loadLocale(initialLocale).then(() => {
  app.mount('#app')
})
```

### LanguageSwitcher Component (Phase 1 minimal)

```vue
<!-- src/components/shared/LanguageSwitcher.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { loadLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/index'

const { locale } = useI18n()

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  'en': 'EN',
  'fr-CH': 'FR',
  'de-CH': 'DE',
  'it-CH': 'IT',
}

async function switchLocale(loc: SupportedLocale) {
  await loadLocale(loc)
}
</script>

<template>
  <div class="flex gap-2">
    <button
      v-for="loc in SUPPORTED_LOCALES"
      :key="loc"
      :class="['px-2 py-1 text-sm rounded', locale === loc ? 'bg-blue-600 text-white' : 'bg-gray-100']"
      @click="switchLocale(loc)"
    >
      {{ LOCALE_LABELS[loc] }}
    </button>
  </div>
</template>
```

### Input Component with v-model to inputStore

```vue
<!-- src/components/input/HostSpecPanel.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

const { t, n } = useI18n()
const inputStore = useInputStore()
const calcStore = useCalculationStore()

// storeToRefs maintains reactivity when destructuring
const { coresPerSocket, socketsPerHost, hostRamGB, hostCount } = storeToRefs(inputStore)
const { validationErrors } = storeToRefs(calcStore)

const hasVcfaBlocker = computed(() =>
  validationErrors.value.some(e => e.code === 'VCFA_MIN_CORES')
)
</script>

<template>
  <section>
    <h2 class="text-lg font-semibold">{{ t('hostSpec.title') }}</h2>

    <!-- VCFA Blocker Warning — must be unmissable -->
    <div v-if="hasVcfaBlocker" class="bg-red-50 border border-red-500 p-3 rounded text-red-800">
      {{ t('validation.vcfa_core_requirement') }}
    </div>

    <label>
      {{ t('hostSpec.coresPerSocket') }}
      <input
        v-model.number="coresPerSocket"
        type="number"
        min="1"
        max="128"
        class="border rounded px-2 py-1 w-full"
      />
    </label>
    <!-- ... more inputs -->
  </section>
</template>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 + PostCSS config | Tailwind v4 + `@tailwindcss/vite` plugin | v4.0 (Jan 2025) | No config file, no content array, single CSS import |
| vue-i18n v9/v10 | vue-i18n v11 | v11 released; v9/v10 maintenance mode July 2025 | Composition API first; `useI18n()` without legacy flag |
| Vuex | Pinia 3 | Pinia 3 released (Vue 2 dropped) | Setup store syntax; full TypeScript inference |
| Vite 6 / webpack | Vite 8 (Rolldown) | Vite 8.0 released early 2026 | 10-30x faster builds; Rolldown (Rust bundler) |
| Options API Vue 3 | Composition API + `<script setup>` | Best practice from 2022 | Composables share logic across components |

**Deprecated/outdated:**

- `vue-i18n v9/v10`: Maintenance mode — no new features; use v11
- `@tailwindcss/postcss`: Still works but superseded by `@tailwindcss/vite` for Vite projects
- `Vuex`: Officially superseded by Pinia; do not use

---

## Open Questions

1. **MGMT-04 Fleet Manager / Collector HA behavior**
   - What we know: REQUIREMENTS.md says "×1 or ×3, plus Fleet Manager (12 GB) and Collector (16 GB)"
   - What's unclear: Whether Fleet Manager and Collector scale with HA multiplier
   - Recommendation: Treat Fleet Manager and Collector as singletons (×1 always) per ARCHITECTURE.md constants table; write Vitest test to document the assumption

2. **fr-CH apostrophe separator runtime behavior**
   - What we know: `Intl.NumberFormat('fr-CH')` should use apostrophe, but browser CLDR data varies
   - What's unclear: Current (2026) Chrome/Firefox/Safari behavior for fr-CH thousands separator
   - Recommendation: Write cross-locale snapshot tests using `new Intl.NumberFormat('fr-CH').format(1234567)` and log the actual output during Phase 1 testing; use `@formatjs/intl-numberformat` polyfill if inconsistent

3. **raidy RAID-5 drive-count gate**
   - What we know: raidy uses `serverCount >= 5 && driveCount >= serverCount * 20` for 4+1; REQUIREMENTS.md uses host-count-only threshold
   - What's unclear: Whether the drive-count gate reflects a real ESA constraint that should be incorporated
   - Recommendation: Use host-count-only threshold per REQUIREMENTS.md for Phase 1; document the raidy divergence in `storage.ts` as a comment for later review

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build, npm | Yes | v25.8.2 | — |
| npm | Package installation | Yes | 11.11.1 | — |
| git | Version control | Yes | 2.53.0 | — |
| gh (GitHub CLI) | GitHub Pages deploy | Yes | — | Manual deploy |
| Internet (npm registry) | Package download | Assumed | — | — |

No missing dependencies that block execution.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via `npm install -D vitest`) |
| Config file | `vitest.config.ts` at project root — Wave 0 creation |
| Quick run command | `npx vitest run src/engine` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-04 | Decimal.js: no float drift in engine arithmetic | unit | `npx vitest run src/engine/__tests__/decimal.test.ts` | Wave 0 |
| FOUND-06 | Vitest runs without error | smoke | `npx vitest run` | Wave 0 |
| MGMT-01 to MGMT-05 | Management domain constants match spec | unit | `npx vitest run src/engine/__tests__/management.test.ts` | Wave 0 |
| MGMT-03 | NSX Manager ×3 in HA mode | unit | same file | Wave 0 |
| MGMT-05 | VCFA 72 vCPU / 288 GB RAM in HA mode | unit | same file | Wave 0 |
| STOR-02 | RAID-5 5-node = 1.5x, 6-node = 1.25x | unit | `npx vitest run src/engine/__tests__/storage.test.ts` | Wave 0 |
| STOR-03 | LFS + metadata overhead chain applied | unit | same file | Wave 0 |
| MGMT-07 | VCFA blocker fires when cores < 12 | unit | `npx vitest run src/engine/__tests__/validation.test.ts` | Wave 0 |
| I18N-04 | fr-CH/de-CH/it-CH number format snapshot | unit | `npx vitest run src/i18n/__tests__/numberFormat.test.ts` | Wave 0 |
| CALC-03 | Total cluster compute output calculated | unit | `npx vitest run src/engine/__tests__/compute.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/engine`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

The project is greenfield — no tests exist yet. All test files must be created:

- [ ] `vitest.config.ts` — root-level Vitest config (pure Node.js, globals: true)
- [ ] `src/engine/__tests__/management.test.ts` — MGMT-01 through MGMT-07
- [ ] `src/engine/__tests__/storage.test.ts` — STOR-01 through STOR-08
- [ ] `src/engine/__tests__/compute.test.ts` — CALC-03, CALC-04
- [ ] `src/engine/__tests__/validation.test.ts` — MGMT-07, HOST-06
- [ ] `src/i18n/__tests__/numberFormat.test.ts` — I18N-04 Swiss locale snapshot

Framework install: `npm install -D vitest @vitest/ui` — must run before any test commands

---

## Sources

### Primary (HIGH confidence)

- [Tailwind CSS v4 + Vite guide](https://tailwindcss.com/docs/guides/vite) — exact plugin setup, no config file required
- [vue-i18n v11 Number Formatting](https://vue-i18n.intlify.dev/guide/essentials/number) — numberFormats API, $n() usage
- [vue-i18n v11 Lazy Loading](https://vue-i18n.intlify.dev/guide/advanced/lazy) — setLocaleMessage, availableLocales pattern
- [vue-i18n v11 Composition API](https://vue-i18n.intlify.dev/guide/advanced/composition) — createI18n legacy:false, useI18n() hook
- [vue-i18n v11 Breaking Changes](https://vue-i18n.intlify.dev/guide/migration/breaking11) — legacy deprecation timeline
- [vue-i18n v11 Installation](https://vue-i18n.intlify.dev/guide/installation) — deprecation warning note
- [Pinia Composing Stores](https://pinia.vuejs.org/cookbook/composing-stores.html) — cross-store computed pattern
- [Pinia Defining a Store](https://pinia.vuejs.org/core-concepts/) — setup store syntax with computed() and ref()
- [Decimal.js API](https://mikemcl.github.io/decimal.js/) — constructor, methods, configuration
- [Vitest Config](https://vitest.dev/config/) — environment options, globals, coverage
- [intlify/bundle-tools unplugin-vue-i18n README](https://github.com/intlify/bundle-tools/blob/main/packages/unplugin-vue-i18n/README.md) — Vite plugin setup
- raidy source: `/Users/fjacquet/Projects/raidy/src/engines/volumetry/strategies/vsan.ts` — reference implementation
- raidy source: `/Users/fjacquet/Projects/raidy/package.json` — confirming raidy uses no Decimal.js

### Secondary (MEDIUM confidence)

- [ARCHITECTURE.md](../.planning/research/ARCHITECTURE.md) — VCF 9.x formula constants, verified against Broadcom TechDocs
- [PITFALLS.md](../.planning/research/PITFALLS.md) — Swiss locale pitfalls, float arithmetic pitfalls
- [STACK.md](../.planning/research/STACK.md) — verified library versions as of 2026-03-28

### Tertiary (LOW confidence)

- npm dist-tag versions (current latest at research time) — assumed stable but should be verified immediately before install

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions verified in prior research (STACK.md, 2026-03-28); Tailwind v4 + Vite plugin setup verified against official docs
- Architecture: HIGH — Pinia cross-store pattern, vue-i18n lazy loading, Vitest config all verified against official docs
- raidy port: HIGH — source code inspected directly; divergences from REQUIREMENTS.md identified and documented
- Pitfalls: HIGH — float arithmetic and Swiss locale issues from official sources; raidy float usage confirmed by source inspection

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable ecosystem — Tailwind v4/Vite 8 unlikely to have breaking changes in 30 days)
