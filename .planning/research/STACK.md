# Stack Research

**Domain:** Client-side SPA sizing calculator (VCF 9.x)
**Researched:** 2026-03-29
**Confidence:** HIGH (all versions verified; domain research against Broadcom TechDocs as of 2026-03-29)

---

## MILESTONE v2.1 ADDENDUM: Stack for Export Quality (PPTX, PDF, Markdown Enrichment)

This section is the **primary output for the v2.1 milestone**. It answers exactly which libraries to add (or not add) for:

1. PPTX generation entirely in-browser (no server)
2. PDF quality improvements beyond `window.print()`
3. Markdown report completeness (missing sections)

### Verdict Summary

| Capability | Action | Package |
|------------|--------|---------|
| PPTX generation | Add | `pptxgenjs@4.0.1` (dynamic import) |
| PDF quality | No new package | Print CSS overhaul (`@media print` + `@page`) |
| Markdown enrichment | No new package | Pure TypeScript string assembly in engine layer |
| Markdown preview (optional, deferred) | Add only if preview component enters scope | `markdown-it@14.1.1` (dynamic import) |

**Hard rule:** `jspdf` and `html2canvas` must NOT be added. Their unpacked sizes (28.8 MB and 3.3 MB respectively) would double the project's npm footprint and add ~1.2 MB gzip to any chunk they land in — for an output quality (rasterized images, no text selection) that is worse than native print CSS.

---

### PPTX Generation: pptxgenjs

**Package:** `pptxgenjs`
**Version:** 4.0.1 (latest as of June 2024 — verified via npm registry)
**npm unpacked size:** 2,544 kB (2.5 MB; Vite tree-shakes the ESM build at build time)
**Runtime dependencies:** `jszip@^3.10.1`, `image-size@^1.2.1`, `https@^1.0.0`, `@types/node@^22.8.1`

**Why pptxgenjs and not alternatives:**

- It is the only actively maintained library that generates PPTX (Office Open XML) entirely in the browser without a Node.js process. `officegen` is Node.js only — disqualified by the client-only constraint.
- Ships an ES Module build (`dist/pptxgen.es.js`). Vite selects the ESM build automatically via the `exports` field in `package.json`. Tree-shaking is effective.
- v4.0.0 (May 2024) fixed the Node.js detection logic that previously caused import errors in Vite dev server. v4.0.1 (June 2024) patches border type bugs and hyperlink repair issues.
- Browser file save: `writeFile({ fileName: 'vcf-sizing.pptx' })` triggers a browser download dialog with the correct PPTX MIME type (`application/vnd.openxmlformats-officedocument.presentationml.presentation`). No FileSaver.js dependency required.
- Output formats: `blob`, `base64`, `arraybuffer`, `binarystring`, `uint8array` — enables both download-to-disk and base64 embedding.

**Bundle impact with dynamic import (recommended):**

```typescript
// src/composables/usePptxExport.ts
export function usePptxExport() {
  const generate = async (sizingData: SizingResult) => {
    // pptxgenjs loaded only when user clicks "Export PPTX"
    const pptxgen = (await import('pptxgenjs')).default
    const pptx = new pptxgen()
    // ... build slides
    await pptx.writeFile({ fileName: 'vcf-sizing-report.pptx' })
  }
  return { generate }
}
```

Vite creates a separate async chunk for `pptxgenjs`. The initial bundle (currently 159 kB gzip) is unchanged. The lazy chunk loads only when the user triggers the export.

**Chart integration with existing vue-chartjs:**

The Chart.js instance is accessible via the `ref` on a `vue-chartjs` component. Call `chart.toBase64Image('image/png', 1)` to get a PNG data URL, then pass it to pptxgenjs's `slide.addImage({ data: dataUrl, ... })`:

```typescript
// In the component that holds a chart ref
const chartRef = ref<InstanceType<typeof Bar>>()
// After mount:
const chartImageDataUrl = chartRef.value?.chart?.toBase64Image('image/png', 1) ?? ''
```

`toBase64Image()` is a native Chart.js 4.x API (no additional library). The result is a valid `data:image/png;base64,...` string that pptxgenjs accepts directly.

**Each export must use a fresh pptxgen instance** — reuse causes slide/metadata bleed across exports. Create `new pptxgen()` inside the function that generates the file, not at module scope.

---

### PDF Quality: Print CSS (No New Package)

**Approach:** `@media print` stylesheet + `@page` rules. Zero bundle cost. Produces searchable, selectable, vector-quality text.

**Why not jsPDF:**
- jsPDF@4.2.1 unpacked size: **28.8 MB** (verified via npm registry — font files account for the bulk). Even with dynamic import the gzip transfer is ~900 kB–1.2 MB for a single lazy chunk.
- `jsPDF.html()` has poor compatibility with Tailwind CSS utility classes. It parses DOM styles via its own renderer; Tailwind's JIT-generated classes are often misinterpreted.
- When combined with html2canvas (the only way to capture chart canvases), the PDF output is a rasterized image: text is not selectable, file size is large, and output looks blurry at non-100% zoom.

**Why not html2canvas:**
- html2canvas@1.4.1 unpacked size: **3.3 MB** (verified via npm registry). Last published **2022-01-22** — over 3 years without a release. The project is effectively unmaintained.
- Rasterizes the entire DOM into a canvas image → embeds as a JPEG/PNG in the PDF. No text selection, no accessibility, no searchability.
- Browser canvas size limits (max ~16,384×16,384 px depending on browser/OS/hardware) can clip long pages.

**Why print CSS is sufficient:**

The existing `window.print()` export is not broken — it lacks layout CSS. Adding `@media print` rules and `@page` declarations to the project's CSS is sufficient to produce a professional output:

- `@page { margin: 2cm; size: A4; }` — page dimensions and margins
- `break-before: page` on `.report-section` — forces new page per sizing section
- `break-after: avoid` on `h2, h3` — prevents widowed headings
- `display: none` for navigation, export buttons, input forms — hides interactive UI
- Chart.js 4.x (already in the project) does NOT exhibit the blank-page print bug that plagued Chart.js 2.x. The monitoring div fix (`.chartjs-size-monitor-expand > div { position: fixed !important; }`) is not needed for Chart.js 4.x.
- For print-quality charts: add `canvas { max-width: 100% !important; height: auto !important; }` inside `@media print`. The canvas renders at device pixel ratio — no quality loss.

**Implementation pattern:**

```css
/* src/assets/print.css — imported in main.ts or App.vue */

@media print {
  /* Hide non-report elements */
  nav,
  .export-panel,
  .input-form,
  .chart-controls,
  [aria-label="navigation"] {
    display: none !important;
  }

  /* Page geometry */
  @page {
    size: A4 portrait;
    margin: 2cm 1.5cm;
  }

  @page :first {
    margin-top: 3cm; /* space for cover header */
  }

  /* Section page breaks */
  .report-section {
    break-before: page;
  }
  .report-section:first-child {
    break-before: avoid;
  }

  /* Prevent orphaned headings */
  h2,
  h3 {
    break-after: avoid;
  }

  /* Chart.js canvas sizing */
  canvas {
    max-width: 100% !important;
    height: auto !important;
  }

  /* Keep warning boxes intact across pages */
  .validation-warning {
    break-inside: avoid;
  }
}
```

---

### Markdown Enrichment: Pure TypeScript (No New Package)

The existing Markdown export is string assembly. The missing sections (workload, AI/GPU, NVMe, stretch, vSAN Max, warnings) are all data already present in the Pinia stores. No library is needed — only more complete template literal branches.

Following CALC-01 (engine layer = pure TypeScript, zero Vue imports), the export logic lives in `src/engine/exportMarkdown.ts`:

```typescript
// Pattern for completeness — not prescriptive of function signatures
export function buildMarkdownReport(state: SizingState): string {
  const sections: string[] = [
    buildSummaryHeader(state),
    buildDeploymentTopology(state),
    buildComputeSection(state),
    buildStorageSection(state),
  ]

  if (state.workload.vmCount > 0) {
    sections.push(buildWorkloadSection(state.workload))
  }
  if (state.aiGpu.enabled) {
    sections.push(buildAiGpuSection(state.aiGpu))
  }
  if (state.nvmeMemTiering.enabled) {
    sections.push(buildNvmeSection(state.nvmeMemTiering))
  }
  if (state.deployment === 'stretch') {
    sections.push(buildStretchSection(state.stretch))
  }
  if (state.storage.type === 'vsan-max') {
    sections.push(buildVsanMaxSection(state.vsanMax))
  }
  if (state.validationWarnings.length > 0) {
    sections.push(buildWarningsSection(state.validationWarnings))
  }

  return sections.join('\n\n---\n\n')
}
```

Download pattern (no library):

```typescript
const blob = new Blob([markdownContent], { type: 'text/markdown; charset=utf-8' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'vcf-sizing-report.md'
a.click()
URL.revokeObjectURL(url)
```

**If a Markdown preview component enters scope (deferred):**

`markdown-it@14.1.1` — 749 kB unpacked, ~40 kB gzip, pure ESM, no dependencies. Use with dynamic import to keep it out of the initial bundle. Do NOT add this unless a preview panel is explicitly in scope for v2.1.

---

### Installation

```bash
# PPTX generation — the only new runtime dependency for v2.1
npm install pptxgenjs

# Optional: Markdown preview only — add only if preview panel enters scope
# npm install markdown-it

# No package install for PDF improvements — print CSS only
```

---

### What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `jspdf` | 28.8 MB unpacked (mostly bundled font files). Even with dynamic import adds ~900 kB–1.2 MB gzip to the lazy chunk. HTML renderer incompatible with Tailwind utilities. Paired with html2canvas produces rasterized, non-searchable PDF. | Print CSS — zero bundle, searchable text, vector quality |
| `html2canvas` | 3.3 MB unpacked. Last published 2022-01-22 — unmaintained for 3+ years. Rasterizes DOM: no text selection, large file sizes, canvas size limits on long pages. | No DOM rasterization needed with print CSS approach |
| `html2pdf.js` | Wrapper around html2canvas + jsPDF 2.x. Inherits both their limitations plus known clone-on-Vue-reactive-DOM bug. vue3-html2pdf wrapper is also stale. | Print CSS |
| `pdfmake` | 14.6 MB unpacked. Declarative JSON document definition is a fundamentally different programming model — requires rewriting report logic rather than enhancing it. | Print CSS for layout |
| `officegen` | Node.js only — requires a filesystem API. Does not run in a browser. | `pptxgenjs` |
| `puppeteer` / `playwright` | Server-side headless browser. Requires Node.js runtime process. Violates the zero-infrastructure constraint. | N/A — out of scope for this architecture |
| `@react-pdf/renderer` | React-only. Incompatible with Vue 3. | N/A |

---

### Bundle Size Impact

| Addition | npm Unpacked | Gzip Transfer | Load Strategy | Impact on Initial Bundle |
|----------|-------------|---------------|---------------|--------------------------|
| `pptxgenjs@4.0.1` | 2,544 kB | ~300–400 kB | Dynamic import (lazy chunk) | 0 kB added to initial 159 kB gzip |
| Print CSS rules | 0 kB | ~3–5 kB | Included in main Tailwind output | Negligible CSS addition |
| `markdown-it@14.1.1` (if added later) | 749 kB | ~40 kB | Dynamic import | 0 kB initial; 40 kB on-demand |
| `jspdf` (NOT recommended) | 28,800 kB | ~900 kB+ | Dynamic import | 0 kB initial; 900 kB+ on-demand |
| `html2canvas` (NOT recommended) | 3,299 kB | ~350 kB | Dynamic import | 0 kB initial; 350 kB on-demand |

**Current baseline:** 467 kB / 159 kB gzip
**After v2.1 (pptxgenjs + print CSS only):** 467 kB / 159 kB gzip initial; pptxgenjs in a lazy async chunk of ~300–400 kB gzip loaded only on PPTX export trigger.

---

### Version Compatibility for New Additions

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `pptxgenjs@4.0.1` | `vite@8`, `vue@3.5.31` | ESM build auto-selected by Vite. v4.0.0 fixed the Vite node detection conflict. Dynamic import works with Vite code splitting. |
| `pptxgenjs@4.0.1` | `chart.js@4.5.1` via `vue-chartjs@5.3.3` | Chart images captured via `chart.toBase64Image()` then passed to `slide.addImage()`. No version conflict. |
| Print CSS | `tailwindcss@4.2.2`, `vue@3.5.31` | `@media print` coexists with Tailwind. Add as a separate `print.css` file imported in `main.ts`. Tailwind v4 does not generate print utilities by default — define them explicitly. |
| `markdown-it@14.1.1` (optional) | `vite@8`, `vue@3.5.31` | Pure ESM, zero dependencies. Dynamic import works cleanly. |

---

### Sources for v2.1 Research

- [PptxGenJS official docs — Installation](https://gitbrent.github.io/PptxGenJS/docs/installation/) — browser setup, ESM, jsDelivr bundle (MEDIUM confidence — page last updated May 2025, no explicit version on page)
- [PptxGenJS official docs — Integration](https://gitbrent.github.io/PptxGenJS/docs/integration.html) — Vite/bundler ESM tree-shaking confirmed (HIGH confidence)
- [PptxGenJS official docs — Saving](https://gitbrent.github.io/PptxGenJS/docs/usage-saving/) — writeFile(), blob/base64/arraybuffer, MIME type, fresh-instance requirement (HIGH confidence)
- [PptxGenJS GitHub Releases](https://github.com/gitbrent/PptxGenJS/releases) — v4.0.1 current as of June 2024, v4.0.0 Node detection fix confirmed (HIGH confidence)
- npm registry direct query `npm info pptxgenjs` — version 4.0.1, unpacked 2,544 kB, jszip dependency (HIGH confidence — measured 2026-03-29)
- npm registry direct query `npm info jspdf` — version 4.2.1, unpacked 28,800 kB (HIGH confidence — measured 2026-03-29)
- npm registry direct query `npm info html2canvas` — version 1.4.1, unpacked 3,299 kB, last publish 2022-01-22 (HIGH confidence — measured 2026-03-29)
- npm registry direct query `npm info markdown-it` — version 14.1.1, unpacked 749 kB (HIGH confidence — measured 2026-03-29)
- npm registry direct query `npm info pdfmake` — version 0.3.7, unpacked 14,600 kB (HIGH confidence — measured 2026-03-29)
- [Chart.js GitHub Discussion #10986](https://github.com/chartjs/Chart.js/discussions/10986) — chart.js 3+ does not have blank-page print bug; fix is upgrade to v3+ (MEDIUM confidence — community discussion with resolution)
- [Chart.js API docs — toBase64Image](https://www.chartjs.org/docs/latest/developers/api.html) — chart instance image capture API (HIGH confidence — official docs)
- [Joyfill — PDF library comparison 2025](https://joyfill.io/blog/comparing-open-source-pdf-libraries-2025-edition) — qualitative jsPDF vs pdfmake vs pdf-lib (MEDIUM confidence — 2025 article)
- [print-css.rocks — Chart.js lesson](https://print-css.rocks/lesson/lesson-chart-js) — print CSS with canvas elements (MEDIUM confidence)
- [Chrome headless --print-to-pdf comparison](https://andre.arko.net/2025/05/25/chrome-headless-print-to-pdf/) — server-side vs browser print-to-PDF differences (informational, 2025)

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

## What NOT to Add (v2.0)

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
| lz-string | 1.5.0 | LZ compression for URL state | Compress JSON sizing config → `compressToEncodedURIComponent()` → URL query param; decompresses client-side on load; keeps URL under typical browser 2048-char limit even for large configs |
| @vueuse/core | 14.2.1 | Vue Composition utilities | `useClipboard`, `useShare`, `useLocalStorage`, `useUrlSearchParams` — accelerate URL state sync and copy-to-clipboard for share links; requires Vue 3.5+ (matches our stack) |
| vue-tsc | 2.x | TypeScript type-check for SFCs | Run `vue-tsc --noEmit` in CI; Vite transpiles TypeScript without type checking — vue-tsc fills this gap |

**Note (v2.1 correction):** The v1.0 research listed `jspdf@4.2.1` and `html2canvas@1.4.1` as supporting libraries. These are NOT in the actual `package.json` and should NOT be added. See the v2.1 addendum above for the rationale.

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
| Print CSS + pptxgenjs | jsPDF + html2canvas | Never — 28.8 MB + 3.3 MB unpacked, html2canvas unmaintained since 2022, output is rasterized non-searchable images |
| lz-string | Native btoa/atob | btoa handles JSON state up to ~1 KB cleanly; lz-string needed when config JSON exceeds ~800 bytes after base64 encoding (likely with stretch cluster + AI workload inputs combined) |
| Vite 8 | Vite 6 | Vite 6 is stable and well-documented; choose it if Vite 8 ecosystem compatibility is a concern (e.g., some plugins not yet updated). Vite 8 is recommended here because Tailwind v4.2.2 explicitly supports it and Rolldown builds are substantially faster |
| Vitest | Jest + vue-jest | Jest requires heavy transform configuration for Vue SFCs; Vitest shares Vite config with zero extra setup |

---

### What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vuex | Officially superseded by Pinia; verbose mutation/action boilerplate; no TypeScript inference without heavy augmentation; Vue team considers it legacy | Pinia 3 |
| vue-i18n v9 / v10 | Both entered maintenance mode July 2025; no new features; v8 is EOL | vue-i18n v11 |
| jsPDF + html2canvas | jsPDF 28.8 MB unpacked; html2canvas 3.3 MB + unmaintained (last publish 2022); combined output is rasterized non-searchable images; jsPDF's HTML renderer is incompatible with Tailwind CSS | Print CSS for layout; pptxgenjs for PPTX |
| html2pdf.js | Wraps jsPDF 2.x, missing all security fixes from v3 and v4; last maintained 2021; produces image-only PDFs (non-selectable text) | Print CSS |
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
| typescript@5.7+ | vue-tsc@2.x | `vue-tsc` 2.x requires TypeScript 5.x; set `moduleResolution: "bundler"` in tsconfig |
| pptxgenjs@4.0.1 | vite@8, vue@3.5.31 | ESM build; v4.0.0+ required for Vite node detection fix |

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
- @vueuse/core 14.2.1 — [vueuse.org](https://vueuse.org) + npm metadata — MEDIUM confidence (version from npm; Vue 3.5+ requirement from official docs)
- lz-string — [pieroxy.net/blog/pages/lz-string](https://pieroxy.net/blog/pages/lz-string/index.html) — MEDIUM confidence (stable library, no major release in years; version 1.5.0 current)
- Vite 8 + Rolldown announcement — [vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8) — HIGH confidence
- Tailwind CSS v4 + Vite integration — [tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4) + [vueschool.io tailwind 4 for vue](https://vueschool.io/articles/vuejs-tutorials/master-tailwindcss-4-for-vue/) — HIGH confidence
- ESLint 9 flat config for Vue 3 — [eslint.vuejs.org/user-guide](https://eslint.vuejs.org/user-guide/) — HIGH confidence

---

*Stack research for: VCF 9.x sizing calculator (client-side SPA)*
*Researched: 2026-03-28 (v1.0), updated 2026-03-29 (v2.0 addendum), updated 2026-03-29 (v2.1 addendum)*
