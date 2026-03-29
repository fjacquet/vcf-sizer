# Stack Research

**Domain:** Client-side SPA sizing calculator (VCF 9.x)
**Researched:** 2026-03-29
**Confidence:** HIGH (all versions verified; domain research against Broadcom TechDocs as of 2026-03-29)

---

## MILESTONE v2.0 ADDENDUM: Stack Changes for vSAN Max, Architecture Validation, Stretch Networking

This section is the **primary output for the v2.0 milestone**. It answers whether the existing stack needs any additions or changes to support:

1. vSAN Max disaggregated storage cluster sizing (5 ReadyNode profiles, renamed vSAN-SC-* in VCF 9)
2. Standard vs Consolidated VCF architecture validation
3. Stretch cluster network requirement checklist (MTU 9000, RTT <5ms, bandwidth floor)
4. Bandwidth floor enforcement (10 Gbps minimum inter-site)

### Verdict: No New Dependencies Required

The existing stack — **TypeScript + Decimal.js engine pattern + Pinia stores + Zod + Vue 3 + Tailwind v4** — is fully sufficient to implement all four v2.0 features. The required additions are pure domain logic within the existing `src/engine/` module boundary.

No new npm packages are needed for v2.0.

---

## What Changes in v2.0 (Engine Layer Only)

### 1. vSAN Max / Storage Cluster Sizing

**Current state:** `src/engine/storage.ts` handles `vsan-esa | fc | nfs` storage types. vSAN Max (officially "vSAN storage clusters" in VCF 9.0) is not modeled.

**What to add:** A new `vsan-max` storage type in `types.ts` and a new branch in `calcStorage()` — or a dedicated `calcVsanMax()` function. The arithmetic remains pure TypeScript + Decimal.js.

**Domain data needed (hardcoded as constants):**

vSAN-Max / vSAN-SC ReadyNode profiles (authoritative: Broadcom VCF Blog, verified Mar 2026):

| Profile | Storage / host | Min NVMe | CPU (min) | RAM (min) | Backend NIC | Min hosts | Max hosts |
|---------|----------------|----------|-----------|-----------|-------------|-----------|-----------|
| vSAN-SC-XS | 20 TB | 2 | 16 cores | 128 GB | 10 Gbps | 4 | — |
| vSAN-SC-SM | 50 TB | 4 | 24–32 cores | 384 GB | 25 Gbps | 4 | — |
| vSAN-SC-MED | 100 TB | 4–6 | 32–40 cores | 512 GB | 25 Gbps | 4 | — |
| vSAN-SC-LRG | 150 TB | 6–8 | 48 cores | 768 GB | 100 Gbps | 4 | — |
| vSAN-SC-XL | 200–360 TB | 8 | 64 cores | 1024 GB | 100 Gbps | 4 | — |

**Source confidence:** MEDIUM-HIGH. March 2024 Broadcom blog ("Greater Flexibility with vSAN Max") documents XS/SM/MED/LRG/XL with above specs. November 2025 blog ("Driving Down Storage Costs") documents further reductions: vSAN-SC-SM lost 33% CPU and 50% RAM; vSAN-SC-MED 50% RAM cut; vSAN-SC-LRG 67% RAM cut. Exact updated absolute numbers not given in the November 2025 article — it cites percentage reductions only. Profile names in VCF 9 changed from `vSAN-Max-*` to `vSAN-SC-*` for the storage cluster variant. The compatibility guide at `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance` is the single authoritative source for current certified specs (verify during implementation).

**RAID behavior in vSAN Max:**
- 4-host cluster: ESA RAID-5 with 4+1 scheme (min 4 hosts for vSAN-SC-XS and vSAN-SC-SM)
- 6+ hosts: RAID-6 supported (4+2 scheme)
- No PFTT site-mirroring overhead (vSAN Max is a storage cluster; stretched behavior requires a dedicated stretched storage cluster topology with a witness)

**Network architecture for vSAN Max (VCF 9.0):**
- **Backend traffic (intra-cluster):** 25 Gbps required for most profiles; 10 Gbps for XS only
- **Frontend client traffic (compute-to-storage):** 10 Gbps minimum
- Two distinct VMkernel port tags: `vSAN storage cluster client` (frontend) and `vSAN` (backend) — traffic separation is supported in VCF 9.0
- Compute-to-storage cluster latency: < 5 ms RTT (same threshold as stretched inter-site)

**Source:** Broadcom TechDocs VCF 9.0 bandwidth/latency page + VCF Blog June 2025 network separation article. HIGH confidence.

**Capacity overhead model for vSAN Max:**
vSAN Max uses the same ESA overhead stack as vSAN ESA HCI. The RAID multipliers, LFS overhead (13%), metadata pool (10% of raw), and safe slack (70%) constants already in `storage.ts` apply unchanged. The only material differences from the HCI path are:
1. No PFTT mirroring factor (vSAN Max is a single cluster; stretched vSAN Max is a separate topology)
2. `minHostsRequired` comes from profile table above (minimum 4, not 3)
3. Backend NIC requirement surfaces as a checklist item (not a sizing formula)

### 2. Standard vs Consolidated Architecture Validation

**Current state:** `validation.ts` has `VCFA_MIN_CORES`, `DEDUP_STRETCH_EXCLUSION`, and `STRETCH_MIN_HOSTS` rules. No architecture model selection (Standard vs Consolidated).

**Domain facts established (MEDIUM confidence — terminology is in flux in VCF 9):**

In VCF 9.0, the terms "Standard" and "Consolidated" are no longer first-class terms in Broadcom documentation. The distinction is:

- **Separate Management + Workload domains** (the former "Standard"): Management domain has its own dedicated cluster of hosts. The VCF 9.0 installer mandates **4 hosts minimum** for the management cluster when using vSAN (OSA or ESA). This is non-negotiable per KB 392993 / design constraint VCF-VSAN-REQD-CFG-002. For external storage (FC VMFS, NFS), the installer accepts 3 hosts for vSAN or 2 hosts for external storage.

- **Co-located / Collapsed domain** (the former "Consolidated"): Management and workload VMs share a single cluster. Isolation is via vSphere resource pools. Minimum footprint is the same 4-host vSAN minimum (or lower with external storage). Used for POC/small deployments.

**What to add to `validation.ts`:**

A new validation rule: when the user selects "Standard" architecture (separate management domain with vSAN), enforce `hostCount >= 4` with code `MGMT_MIN_HOSTS` and severity `error`. When the user selects vSAN + external storage, use the 3/2 host minimums from the installer docs.

This is a pure logic addition — no new libraries.

**Source:** Broadcom KB 392993 ("Minimum number of ESXi hosts required on vSAN clusters for deployment of VCF Management Domain"), Broadcom deployment pathways blog July 2025, defaultreasoning.com analysis Jan 2025 referencing VCF-VSAN-REQD-CFG-002. MEDIUM-HIGH confidence.

### 3. Stretch Cluster Network Requirements Checklist

**Current state:** `stretch.ts` computes `minBandwidthGbps` as `totalWorkloadStorageTB × 0.1`. No MTU, no RTT warnings, no witness RTT check, no bandwidth floor.

**Authoritative network requirements (HIGH confidence — from Broadcom TechDocs VCF 9.0 directly):**

| Requirement | Value | Source |
|-------------|-------|--------|
| Inter-site bandwidth minimum | 10 Gbps (floor) | TechDocs bandwidth page |
| Inter-site RTT maximum | < 5 ms | TechDocs bandwidth page |
| MTU recommendation | 9000 (jumbo frames) | Community + design guides |
| Witness bandwidth | 2 Mbps / 1,000 components | TechDocs bandwidth page |
| Witness RTT (≤10 hosts/site) | < 200 ms | TechDocs bandwidth page |
| Witness RTT (11-15 hosts/site) | < 100 ms | TechDocs bandwidth page |
| Witness RTT (1 host/site) | < 500 ms | TechDocs bandwidth page |
| Single-site intra-cluster RTT | < 1 ms | TechDocs bandwidth page |

**Bandwidth floor enforcement:** The current formula (`totalWorkloadStorageTB × 0.1`) computes a workload-based estimate. Add an explicit floor: `max(formulaResult, 10)` to enforce the 10 Gbps minimum from the spec. This remains pure Decimal.js arithmetic.

**New fields to add to `StretchResult` in `types.ts`:**
- `bandwidthFloorEnforced: boolean` — true when formula result is below the 10 Gbps floor
- `witnessRttMaxMs: number` — maximum tolerated witness RTT in ms (derived from hosts/site count)
- `mtuRequired: number` — always 9000 for stretch

**New validation rules to add to `validateInputs()`:**
- `STRETCH_BANDWIDTH_BELOW_FLOOR`: warn when formula gives <10 Gbps (before floor is applied) — inform user
- `STRETCH_MTU_REMINDER`: informational warning that MTU 9000 must be set end-to-end

These additions are logic-only. No new libraries.

**Source:** `techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/vsan-deployment-administration-and-monitoring/vsan-network-design/...bandwidth-and-latency-requirements.html`. HIGH confidence — official Broadcom TechDocs, VCF 9.0.

### 4. Bandwidth Floor Enforcement (10 Gbps Minimum)

This is addressed by the change to `calcStretch()` described in item 3 above. The formula becomes:

```
minBandwidthGbps = max(totalWorkloadStorageTB × 0.1, 10)
```

`Decimal.js` handles this with `Decimal.max(formulaResult, 10)`. No new libraries needed.

---

## Existing Stack — Unchanged for v2.0

The following decisions from the original v1.0 research remain valid and are not revisited here:

| Technology | Version | Status |
|------------|---------|--------|
| Vue 3 | 3.5.31 | Unchanged — no new Vue-level dependencies |
| Vite 8 | 8.0.3 | Unchanged |
| TypeScript | 5.7+ | Unchanged — strict mode |
| Tailwind CSS | 4.2.2 | Unchanged — new UI elements use existing utilities |
| Pinia | 3.0.4 | Unchanged — new `vsanMaxStore.ts` if needed, follows existing pattern |
| vue-i18n | 11.3.0 | Unchanged — new i18n keys for vSAN Max and network checklist |
| Decimal.js | 10.6.0 | Unchanged — all new arithmetic uses it |
| Zod | 4.3.6 | Unchanged — extend existing schemas for new input fields |
| lz-string | 1.5.0 | Unchanged — URL state encoding handles new fields automatically |
| @vueuse/core | 14.2.1 | Unchanged |
| vue-chartjs + Chart.js | 5.3.3 + 4.5.1 | Unchanged — new charts for vSAN Max capacity follow existing pattern |
| Vitest | 4.1.2 | Unchanged — new unit tests in `storage.test.ts` and `stretch.test.ts` |

---

## What NOT to Add

| Do Not Add | Why |
|------------|-----|
| Any new npm package for vSAN Max sizing | All arithmetic is Decimal.js; profile data is hardcoded constants |
| A chart library upgrade | Chart.js 4.x handles the new storage breakdown chart without changes |
| A separate "validation framework" library | Current `ValidationWarning[]` pattern scales cleanly to new rules |
| An API client library | Tool remains 100% client-side; no Broadcom API integration in scope |
| React/Zustand (any React library) | Existing Vue 3 + Pinia serves all needs |

---

## Integration Points for v2.0 Features

### Engine changes

```
src/engine/types.ts
  + StorageType: add 'vsan-max' union member
  + VsanMaxProfile: new type (enum or discriminated union of 5 profiles)
  + VsanMaxInputs: new interface (profileName, hostCount, dedicatedStorageHosts)
  + VsanMaxResult: new interface (rawCapacityTB, usableCapacityTB, backendNicGbps, clientNicGbps)
  + StretchResult: add bandwidthFloorEnforced, witnessRttMaxMs, mtuRequired
  + ArchitectureModel: new type ('standard' | 'consolidated')
  + ValidationInputs: add architectureModel field

src/engine/storage.ts
  + VSAN_MAX_PROFILES: const map of profile specs
  + calcVsanMax(inputs: VsanMaxInputs): VsanMaxResult
  (branches off existing overhead stack; RAID multipliers identical)

src/engine/stretch.ts
  + STRETCH_BANDWIDTH_FLOOR_GBPS = 10
  + Update calcStretch() to apply floor and set bandwidthFloorEnforced
  + Add witnessRttMaxMs derivation from site host count

src/engine/validation.ts
  + MGMT_MIN_HOSTS_VSAN = 4
  + MGMT_MIN_HOSTS_EXTERNAL = 2
  + New rules: MGMT_MIN_HOSTS, STRETCH_BANDWIDTH_BELOW_FLOOR, STRETCH_MTU_REMINDER
```

### Store changes

```
src/stores/inputStore.ts
  + architectureModel field (default: 'standard')
  + vsanMaxProfileName field (when storageType === 'vsan-max')
  + stretchInterSiteBandwidthGbps: optional user input (for display vs floor)
```

### UI changes

```
src/components/
  + ArchitectureSelector.vue   (Standard / Consolidated radio)
  + VsanMaxProfileSelector.vue (dropdown of 5 profiles with capacity hint)
  + StretchNetworkChecklist.vue (MTU / RTT / bandwidth checklist display)
  (All use Tailwind v4 utilities — no new component library needed)
```

---

## Authoritative Sources for vSAN Max / VCF 9.x

| Source | URL | Confidence | Notes |
|--------|-----|------------|-------|
| Broadcom TechDocs: Bandwidth and Latency Requirements (VCF 9.0) | https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/vsan-deployment-administration-and-monitoring/vsan-network-design/understanding-vsan-networking/network-requirements-for-vsan/bandwidth-and-latency-requirements.html | HIGH | Official; all RTT/bandwidth numbers from here |
| Broadcom KB 392993: Minimum ESXi hosts for VCF Management Domain | https://knowledge.broadcom.com/external/article/392993/minimum-number-of-esxi-hosts-required-on.html | HIGH | 4 hosts / stretched = 8 hosts (4 per site) |
| Broadcom Blog: Greater Flexibility with vSAN Max (Mar 2024) | https://blogs.vmware.com/cloud-foundation/2024/03/13/greater-flexibility-with-vsan-max-through-lower-hardware-and-cluster-requirements/ | HIGH | ReadyNode profile table: XS/SM/MED/LRG/XL with specs |
| Broadcom Blog: Driving Down Storage Costs (Nov 2025) | https://blogs.vmware.com/cloud-foundation/2025/11/14/driving-down-storage-costs-with-lower-hardware-requirements-for-vsan/ | MEDIUM | % reductions for vSAN-SC profiles; no absolute table |
| Broadcom Blog: Network Traffic Separation for VCF 9.0 (Jun 2025) | https://blogs.vmware.com/cloud-foundation/2025/06/19/network-traffic-separation-in-vsan-storage-clusters-for-vcf-9-0/ | HIGH | 25Gb backend; 10Gb client; VMkernel tag split |
| Broadcom Compatibility Guide: vSAN ESA ReadyNode Hardware Guidance | https://compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance | HIGH | Single authoritative source for certified profiles; verify during implementation |
| Broadcom Blog: vSAN Storage Clusters + Stretched Topologies (Jun 2025) | https://blogs.vmware.com/cloud-foundation/2025/06/19/stretched-topologies-using-vsan-storage-clusters-in-vcf-9-0/ | MEDIUM | Stretched vSAN Max topology; witness required; vSAN OSA compute clusters excluded |
| Broadcom Blog: VCF 9.0 Deployment Pathways (Jul 2025) | https://blogs.vmware.com/cloud-foundation/2025/07/03/vcf-9-0-deployment-pathways/ | HIGH | 4-host minimum for management cluster; co-located model described |
| Medium: Strategic Bandwidth Sizing for vSAN Stretched Clusters in VCF 9.0 | https://medium.com/@lubomir-tobek/strategic-bandwidth-sizing-for-vsan-stretched-clusters-in-vcf-9-0-a-roadmap-to-resilience-ce55545b96a2 | MEDIUM | ISL sizing formula with IOPS × I/O size × md × mr × CR; good for future extension |
| Design and Operational Guidance for vSAN Storage Clusters | https://www.vmware.com/docs/vmw-vsan-storage-clusters-design-and-operations | HIGH | Official PDF design guide; ReadyNode profiles, topology options |

---

## Gaps to Address During Implementation

1. **vSAN-SC profile absolute specs after November 2025 update:** The Nov 2025 blog gives percentage reductions only. Before hardcoding constants, verify the final absolute numbers for vSAN-SC-SM/MED/LRG against the Broadcom compatibility guide (`compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance`). Use values from the Mar 2024 blog as a conservative baseline if the guide is behind a login wall.

2. **Architecture model naming in VCF 9.0:** The terms "Standard" and "Consolidated" were retired in VCF 9. The UI should use "Separate Management + Workload Domains" and "Co-located (Single Domain)" respectively, or match whatever Broadcom's current UI uses. Research the current SDDC Manager terminology before writing the i18n keys.

3. **Stretch vSAN Max topology complexity:** A stretched vSAN storage cluster (vSAN Max across two sites) is a distinct topology that requires its own witness and has additional constraints (vSAN OSA compute clusters cannot use it). This is likely out of scope for v2.0 — the v2.0 stretch checklist applies to vSAN ESA HCI stretched clusters, not to stretched vSAN Max. Confirm scope with the milestone plan before adding stretch + vSAN Max combined path.

4. **Bandwidth floor formula vs. formula result:** The current `totalWorkloadStorageTB × 0.1` heuristic is not identical to the ISL formula documented in the Medium article (`IOPS × I/O_size × md × mr × CR`). The heuristic is simpler to use without IOPS input. A future enhancement could add an IOPS-based path. For v2.0, the heuristic + 10 Gbps floor is sufficient.

---

*Stack research for: VCF 9.x sizing calculator — v2.0 milestone additions*
*Researched: 2026-03-29*
*Original v1.0 stack decisions below this line (preserved for reference)*

---

## Original v1.0 Stack Research (2026-03-28)

### Decision: Vue 3 over React

**Use Vue 3 (Composition API).** The project constraints already lean toward Vue 3 + Pinia, and the evidence supports that choice:

- Vue 3's Composition API avoids the React Hooks rules-of-hooks caveats (no conditional hooks, no exhaustive-deps). Sizing calculators have deeply nested reactive computation trees — Vue's fine-grained reactivity is a better fit than React's re-render-everything model.
- `vue-i18n` is the most mature i18n library for Vue by a wide margin; there is no React-equivalent that matches its pluralization, datetime/number formatting, and SFC `<i18n>` block integration.
- Pinia 3 (official Vue state manager, Vue 3 only) is lighter and more type-safe than Zustand. The stores map naturally to the sizing domains (deployment profile, workload inputs, compute summary, storage summary).
- The full Vue ecosystem (Vue Router 5, @vueuse/core, vue-chartjs) forms a tighter integration surface than mixing React with equivalent libraries.

**Do not choose React** unless the team has no Vue experience and a hard preference. The localization ecosystem advantage alone tips the scale.

---

### Recommended Stack

#### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vue 3 | 3.5.31 | UI framework | Fine-grained reactivity ideal for live sizing math; Composition API provides clean separation of computation logic from templates; 3.6 vapor mode in beta adds future performance headroom |
| Vite 8 | 8.0.3 | Build tool / dev server | Rolldown-powered (Rust bundler): 10-30x faster builds vs Vite 6; built-in tsconfig paths; static deploy with `vite build` produces a single `/dist` folder ready for GitHub Pages / Vercel / Netlify |
| TypeScript | 5.7+ | Type safety | `strict: true` mandatory; `moduleResolution: "bundler"` required for Vite 8; catches sizing formula bugs at compile time |
| Tailwind CSS | 4.2.2 | Utility-first styling | v4 uses Oxide (Rust) engine with `@tailwindcss/vite` plugin — no PostCSS config, no content file declaration, single `@import "tailwindcss"` line; 5x faster full builds, 100x faster incremental; v4.2.2 explicitly supports Vite 8 |
| Pinia | 3.0.4 | State management | Official Vue state manager (Vuex successor); Vue 2 support dropped in v3 — pure Vue 3 focus; composition stores map cleanly to sizing domains; full TypeScript inference; DevTools timeline |
| vue-i18n | 11.3.0 | FR/EN/DE/IT localization | Definitive Vue i18n solution; Composition API (`useI18n()`); `<i18n>` SFC blocks; pluralization, datetime/number formatting with locale-aware Intl; v11 is mainstream (v9/v10 in maintenance mode; v8 EOL 2025) |
| vue-router | 5.0.4 | Client-side routing | Vue 3 official router; v5 merges unplugin-vue-router into core; hash mode for GitHub Pages compatibility with no server rewrite rules |

#### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vue-chartjs | 5.3.3 | Chart.js wrapper for Vue 3 | Bar/doughnut charts for compute vs available, storage raw vs usable; reactive computed props via Composition API; Chart.js 4.x is a peer dep — full version control |
| Chart.js | 4.5.1 | Canvas-based charting engine | Peer dep of vue-chartjs; 11 KB gzipped; Canvas rendering (not SVG) = performant reactive updates on number changes; use for 4-6 charts in this tool |
| jsPDF | 4.2.1 | Client-side PDF export | Pure browser PDF generation; v4.2.x fixes security vulnerabilities (use no earlier version); combine with `html2canvas` for HTML-to-PDF; produces selectable text if you use the jsPDF text API directly rather than html2canvas |
| html2canvas | 1.4.1 | HTML-to-canvas capture | Used alongside jsPDF to export the sizing summary view to PDF; screenshot-style (rasterizes DOM); acceptable fidelity for a results summary page |
| lz-string | 1.5.0 | LZ compression for URL state | Compress JSON sizing config → `compressToEncodedURIComponent()` → URL query param; decompresses client-side on load; keeps URL under typical browser 2048-char limit even for large configs |
| @vueuse/core | 14.2.1 | Vue Composition utilities | `useClipboard`, `useShare`, `useLocalStorage`, `useUrlSearchParams` — accelerate URL state sync and copy-to-clipboard for share links; requires Vue 3.5+ (matches our stack) |
| vue-tsc | 2.x | TypeScript type-check for SFCs | Run `vue-tsc --noEmit` in CI; Vite transpiles TypeScript without type checking — vue-tsc fills this gap |

#### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite 8 (`npm create vite@latest`) | Project scaffold | Use template `vue-ts` for TypeScript; produces clean Vite 8 + Vue 3 + TypeScript baseline |
| ESLint 9 (flat config) | Linting | `eslint-plugin-vue` + `@vue/eslint-config-typescript` + `@vue/eslint-config-prettier`; flat config (`eslint.config.js`) is default in ESLint 9 |
| Prettier | Code formatting | Pair with ESLint's `skipFormatting` option; do not configure formatting rules in ESLint |
| Vitest | Unit testing | Vite-native test runner; shares Vite config; use with `@vue/test-utils` for component tests and `@testing-library/vue` for behavioral tests; supports Browser Mode (4x faster than jsdom) |
| @vue/test-utils | Component test utilities | Official low-level Vue component mounting library; works directly with Vitest |
| vue-devtools (browser ext) | Dev debugging | Pinia store inspector + component tree; essential for sizing formula debugging |
| unplugin-vue-i18n | Vite i18n plugin | Companion to vue-i18n 11; pre-compiles translation files at build time (removes runtime parser overhead); required for production builds |

---

### Installation

```bash
# Scaffold with Vite 8 + Vue 3 + TypeScript
npm create vite@latest vcf-sizer -- --template vue-ts
cd vcf-sizer

# Core runtime dependencies
npm install vue-router@^5.0.4 pinia@^3.0.4
npm install vue-i18n@^11.3.0
npm install vue-chartjs@^5.3.3 chart.js@^4.5.1
npm install jspdf@^4.2.1 html2canvas@^1.4.1
npm install lz-string@^1.5.0
npm install @vueuse/core@^14.2.1

# Tailwind CSS v4 with Vite plugin
npm install tailwindcss@^4.2.2 @tailwindcss/vite@^4.2.2

# Build-time i18n compilation
npm install @intlify/unplugin-vue-i18n@^6.0.0

# Dev dependencies
npm install -D typescript vue-tsc
npm install -D vitest @vitest/ui jsdom
npm install -D @vue/test-utils @testing-library/vue
npm install -D eslint eslint-plugin-vue @vue/eslint-config-typescript @vue/eslint-config-prettier prettier
```

**Tailwind CSS v4 setup** — replace PostCSS config with Vite plugin:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

export default defineConfig({
  base: '/vcf-sizer/', // required for GitHub Pages repo subpath
  plugins: [
    vue(),
    tailwindcss(),
    VueI18nPlugin({ include: './src/locales/**' }),
  ],
  resolve: {
    alias: { '@': '/src' },
    tsconfigPaths: true, // Vite 8 built-in tsconfig paths
  },
})
```

```css
/* src/style.css — single line, no config file needed */
@import "tailwindcss";
```

---

### Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vue 3 + Pinia | React + Zustand | If the team has zero Vue experience and strong React preference; React ecosystem is larger but i18n story is weaker and the reactivity model adds Hooks complexity for deeply computed values |
| vue-i18n 11 | react-i18next / i18next | With React only; i18next is framework-agnostic but lacks SFC `<i18n>` block integration and vue-i18n's localized number/datetime composables |
| Chart.js + vue-chartjs | Recharts | With React; Recharts is SVG-only and React-specific; for Vue use vue-chartjs (Chart.js wrapper) or ApexCharts (heavier but richer) |
| Chart.js + vue-chartjs | ApexCharts | When you need interactive zooming, richer chart types, or built-in annotations; heavier bundle (~120 KB gzip vs ~40 KB for Chart.js); overkill for 4-6 static bar/doughnut charts |
| jsPDF 4 + html2canvas | pdfmake | When document is entirely programmatic/data-driven with no need to match screen layout; pdfmake's declarative JSON model is elegant but cannot overlay elements or reproduce complex CSS layouts |
| jsPDF 4 + html2canvas | html2pdf.js | html2pdf.js wraps html2canvas + jsPDF 2.x; outdated jsPDF dependency (misses security fixes in v4.x); use jsPDF 4 directly instead |
| lz-string | Native btoa/atob | btoa handles JSON state up to ~1 KB cleanly; lz-string needed when config JSON exceeds ~800 bytes after base64 encoding (likely with stretch cluster + AI workload inputs combined) |
| Vite 8 | Vite 6 | Vite 6 is stable and well-documented; choose it if Vite 8 ecosystem compatibility is a concern (e.g., some plugins not yet updated). Vite 8 is recommended here because Tailwind v4.2.2 explicitly supports it and Rolldown builds are substantially faster |
| Vitest | Jest + vue-jest | Jest requires heavy transform configuration for Vue SFCs; Vitest shares Vite config with zero extra setup |

---

### What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vuex | Officially superseded by Pinia; verbose mutation/action boilerplate; no TypeScript inference without heavy augmentation; Vue team considers it legacy | Pinia 3 |
| vue-i18n v9 / v10 | Both entered maintenance mode July 2025; no new features; v8 is EOL | vue-i18n v11 |
| html2pdf.js | Wraps jsPDF 2.x, missing all security fixes from v3 and v4; last maintained 2021; produces image-only PDFs (non-selectable text) | jsPDF 4 + html2canvas directly |
| Options API (Vue 3) | Harder to share computation logic across components; sizing formulas belong in composables, not component options; Composition API (`<script setup>`) is the 2025 standard | `<script setup>` + Composition API |
| Vuetify / Quasar / PrimeVue | Full component libraries conflict with Tailwind's utility classes; adds 200–400 KB bundle weight for a single-page tool; heavy override ceremony | Tailwind CSS v4 with custom components |
| Vue CLI | Deprecated in favor of Vite; last update 2023; slower dev server; no rolldown support | Vite 8 (`npm create vite@latest`) |
| Moment.js | 67 KB gzip, tree-shaking hostile, in maintenance mode; locale files are large | Native `Intl.DateTimeFormat` (built into all target browsers) |
| Axios | Unnecessary for a zero-backend SPA; only native browser APIs needed for URL sharing and optional static JSON loading | Native `fetch` or `@vueuse/core` composables |

---

### Stack Patterns by Variant

**Deployment target: GitHub Pages**

- Set `base: '/vcf-sizer/'` in `vite.config.ts`
- Use `vue-router` in hash mode (`createWebHashHistory()`) — no server rewrite rules required
- Add `.nojekyll` file at repo root to disable Jekyll processing of `_` directories
- GitHub Actions workflow: `actions/setup-node` → `npm ci` → `npm run build` → `actions/deploy-pages`

**Deployment target: Vercel or Netlify**

- Set `base: '/'`
- Use `createWebHistory()` (HTML5 history mode) — both platforms handle SPA rewrites natively
- Add `vercel.json` or `netlify.toml` with `/* → /index.html` rewrite rule

**Locale strategy: Switzerland four-language**

- Default locale: `en` (fallback chain: `fr` → `en`, `de` → `en`, `it` → `en`)
- Locale files: `src/locales/en.json`, `fr.json`, `de.json`, `it.json`
- Browser-based locale detection: `navigator.language` mapped to supported locales at app init
- Number formatting: use `vue-i18n`'s `n()` composable with `CHF` currency config per locale
- The `unplugin-vue-i18n` Vite plugin pre-compiles all 4 locale files at build time (eliminates runtime `@intlify/message-compiler` dependency)

**URL state sharing**

- Serialize active Pinia store state to JSON → `lz-string.compressToEncodedURIComponent()` → append as `?config=<value>` URL param
- On app load: read `?config=`, `lz-string.decompressFromEncodedURIComponent()`, JSON.parse, hydrate Pinia store
- Use `@vueuse/core`'s `useUrlSearchParams()` for reactive URL param access
- Provide "Copy Link" button with `useClipboard()` from `@vueuse/core`

---

### Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vue@3.5.31 | pinia@3.0.4 | Pinia 3 requires Vue 3.5+ |
| vue@3.5.31 | @vueuse/core@14.2.1 | VueUse 14+ requires Vue 3.5+ |
| tailwindcss@4.2.2 | @tailwindcss/vite@4.2.2 | Must keep versions in sync; v4.2.2 confirmed Vite 8 support |
| vite@8.0.3 | @vitejs/plugin-vue@latest | Use `@vitejs/plugin-vue` v5.x for Vue 3; do not use v4 |
| chart.js@4.5.1 | vue-chartjs@5.3.3 | Chart.js 4.x required as peer dep; Chart.js 5 not yet released |
| vue-i18n@11.3.0 | @intlify/unplugin-vue-i18n@6.x | Companion Vite plugin; must match vue-i18n major; v9/v10 plugins incompatible with v11 |
| jspdf@4.2.1 | html2canvas@1.4.1 | Use together for HTML-to-PDF; jsPDF 4 requires modern browser APIs (all target browsers qualify) |
| typescript@5.7+ | vue-tsc@2.x | `vue-tsc` 2.x requires TypeScript 5.x; set `moduleResolution: "bundler"` in tsconfig |

---

### v1.0 Sources

- Vue 3.5.31 — [github.com/vuejs/core/releases](https://github.com/vuejs/core/releases) — verified 2026-03-28 (HIGH confidence)
- Vue Router 5.0.4 — [github.com/vuejs/router/releases](https://github.com/vuejs/router/releases) — verified 2026-03-28 (HIGH confidence)
- Pinia 3.0.4 — [github.com/vuejs/pinia/releases](https://github.com/vuejs/pinia/releases) — verified 2026-03-28 (HIGH confidence)
- vue-i18n 11.3.0 — [github.com/intlify/vue-i18n/releases](https://github.com/intlify/vue-i18n/releases) + [vue-i18n.intlify.dev](https://vue-i18n.intlify.dev/guide/migration/breaking11) — HIGH confidence
- Tailwind CSS 4.2.2 — [github.com/tailwindlabs/tailwindcss/releases](https://github.com/tailwindlabs/tailwindcss/releases) — HIGH confidence; v4.2.2 confirmed Vite 8 support
- Vite 8.0.3 — [github.com/vitejs/vite/releases](https://github.com/vitejs/vite/releases) + [vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8) — HIGH confidence
- Chart.js 4.5.1 — [github.com/chartjs/Chart.js/releases](https://github.com/chartjs/Chart.js/releases) — HIGH confidence
- vue-chartjs 5.3.3 — [github.com/apertureless/vue-chartjs/releases](https://github.com/apertureless/vue-chartjs/releases) — HIGH confidence
- jsPDF 4.2.1 — [github.com/parallax/jsPDF/releases](https://github.com/parallax/jsPDF/releases) — HIGH confidence; security fixes are why v4.2.x must be used
- @vueuse/core 14.2.1 — [vueuse.org](https://vueuse.org) + npm metadata — MEDIUM confidence (version from npm; Vue 3.5+ requirement from official docs)
- lz-string — [pieroxy.net/blog/pages/lz-string](https://pieroxy.net/blog/pages/lz-string/index.html) — MEDIUM confidence (stable library, no major release in years; version 1.5.0 current)
- Vite 8 + Rolldown announcement — [vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8) — HIGH confidence
- Tailwind CSS v4 + Vite integration — [tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4) + [vueschool.io tailwind 4 for vue](https://vueschool.io/articles/vuejs-tutorials/master-tailwindcss-4-for-vue/) — HIGH confidence
- ESLint 9 flat config for Vue 3 — [eslint.vuejs.org/user-guide](https://eslint.vuejs.org/user-guide/) — HIGH confidence

---

*Stack research for: VCF 9.x sizing calculator (client-side SPA)*
*v1.0 research: 2026-03-28 | v2.0 addendum: 2026-03-29*
