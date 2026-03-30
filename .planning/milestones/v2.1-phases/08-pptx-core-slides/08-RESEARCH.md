# Phase 8: PPTX Core Slides - Research

**Researched:** 2026-03-30
**Domain:** pptxgenjs 4.x, Vue 3 + Vite composable pattern, browser file download
**Confidence:** HIGH

## Summary

Phase 8 adds a `.pptx` download button to the export toolbar by implementing a `usePptxExport.ts` composable that mirrors the structure of `useMarkdownExport.ts`. The composable uses a dynamic `import('pptxgenjs')` inside the export function body so Vite places the pptxgenjs bundle in an async chunk, preserving initial page-load time (PPTX-15).

pptxgenjs 4.0.1 (the current latest release) provides a clean API: `defineSlideMaster()` is called first with a `{ title, background, objects }` props object, `addSlide({ masterName })` creates a slide referencing that master, and `writeFile({ fileName })` triggers a browser download directly — no manual Blob wrangling needed. The library has zero runtime dependencies and its Vite integration is automatic via the `exports` field in its package.json.

All seven always-present slides can be populated from values already exposed by `useInputStore` and `useCalculationStore`. Testing follows the same `createPinia() + setActivePinia()` pattern used in Phase 6, but because pptxgenjs is loaded via dynamic import the tests must mock the import or test only the exported function signature and data-mapping logic. The safe approach is to keep slide-data extraction in a separate pure function and test only that function.

**Primary recommendation:** Implement `usePptxExport.ts` as a plain TypeScript composable (no Vue lifecycle hooks). Call `defineSlideMaster()` once at the top of `generatePptxReport()`, add the seven slides with `addSlide({ masterName: 'VCF_MASTER' })`, then call `pres.writeFile({ fileName: 'vcf-sizing-report.pptx' })`. Add the button to `ExportToolbar.vue` following the identical pattern of `handleExportMarkdown`.

---

## Project Constraints (from CLAUDE.md)

- Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library.
- `calculationStore.ts` must never contain `ref()` — only `computed()`.
- Validation warnings must use i18n message keys, not English strings.
- Composables live in `src/composables/` — plain TypeScript modules, no Vue lifecycle hooks.
- `@/` path alias maps to `src/`.
- Tests use Vitest, node environment, cover `src/composables/**/*.test.ts`.
- `VueI18nPlugin` configured with `include` omitted intentionally.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PPTX-01 | Download .pptx via button in ExportToolbar.vue | Button follows existing `handleExportMarkdown` pattern; `writeFile()` triggers browser download |
| PPTX-02 | VCF-branded slide master: Broadcom blue #003087, fonts, logo placeholder | `pres.defineSlideMaster({ title, background: { color: '003087' }, objects: [...] })` |
| PPTX-03 | Title slide: deployment mode label + generation date | `inputStore.deploymentMode`, `new Date().toISOString().split('T')[0]` |
| PPTX-04 | Config summary slide: host specs, storage type, network speed, mgmt arch | All from `inputStore` — same fields as Markdown Host Configuration section |
| PPTX-05 | Workload profile slide: VM count, vCPU, vRAM, overcommit ratios | `inputStore.vmCount`, `avgVcpuPerVm`, `avgVramGbPerVm`, `cpuOvercommitRatio`, `ramOvercommitRatio` |
| PPTX-06 | Management domain overhead slide: per-component vCPU and RAM table | `calc.management` — `MgmtDomainResult` has all 6 component pairs (vcenter, sddc, nsx, ops, automation + totals) |
| PPTX-07 | Compute results slide: host count, CPU and RAM utilization % | `calc.compute.recommendedHostCount`, `coreUtilizationPct`, `ramUtilizationPct` |
| PPTX-08 | Storage results slide: capacity breakdown table | `calc.storage` — rawCapacityTB, usableAfterRaidTB, lfsOverheadTB, metadataOverheadTB, safeUsableCapacityTB |
| PPTX-09 | Recommendations slide: key sizing outputs + active warnings summary | Derived from compute + storage results; `calc.validationErrors` length/summary |
| PPTX-15 | pptxgenjs NOT in synchronous chunk — dynamic import() | `const PptxGenJS = (await import('pptxgenjs')).default` inside function body |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pptxgenjs | 4.0.1 | Generate .pptx files in browser/Node | De-facto JS PPTX library; zero dependencies; TypeScript-first; Vite-compatible via package.json exports field |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | All other dependencies already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pptxgenjs | officegen | Node-only; no browser support |
| pptxgenjs | docx (pptx fork) | Immature PPTX support |
| pptxgenjs | html-to-pptx | Heavier, layout-sensitive |

**Installation:**
```bash
npm install pptxgenjs
```

**Version verification (confirmed 2026-03-30):**
```bash
npm view pptxgenjs version
# 4.0.1
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── composables/
│   ├── useMarkdownExport.ts    # Phase 6 — reference pattern
│   ├── usePptxExport.ts        # Phase 8 — new composable
│   └── usePptxExport.test.ts   # Phase 8 — Wave 0 TDD
├── components/results/
│   └── ExportToolbar.vue       # Add PPTX button + handleExportPptx()
└── i18n/locales/
    ├── en.json                 # Add results.toolbar.exportPptx key
    ├── fr.json
    ├── de.json
    └── it.json
```

### Pattern 1: Dynamic Import for Code Splitting
**What:** Load pptxgenjs only when the user clicks "Download PPTX" — never on page load.
**When to use:** Any large library that is not needed for initial render.
**Example:**
```typescript
// src/composables/usePptxExport.ts
// Source: pptxgenjs docs + Vite dynamic import docs

export async function generatePptxReport(): Promise<void> {
  // Dynamic import — Vite places this in a separate async chunk automatically
  const PptxGenJS = (await import('pptxgenjs')).default
  const pres = new PptxGenJS()

  // MUST call defineSlideMaster() BEFORE any addSlide() call
  pres.defineSlideMaster({
    title: 'VCF_MASTER',
    background: { color: '003087' },       // Broadcom blue — NO leading #
    objects: [
      // footer bar
      { rect: { x: 0, y: 6.8, w: '100%', h: 0.5, fill: { color: '001F5B' } } },
      // logo placeholder text (replace with image path when asset available)
      { text: { text: 'VMware by Broadcom', options: { x: 0.3, y: 6.85, w: 4, h: 0.4, color: 'FFFFFF', fontSize: 10 } } },
    ],
  })

  // ... add slides ...
  await pres.writeFile({ fileName: 'vcf-sizing-report.pptx' })
}
```

### Pattern 2: Slide Creation with Master
**What:** Each slide references the master by its `title` string.
**When to use:** Every slide added in this phase.
**Example:**
```typescript
// Source: https://gitbrent.github.io/PptxGenJS/docs/masters/
const slide = pres.addSlide({ masterName: 'VCF_MASTER' })
slide.addText('Title Text', {
  x: 0.5, y: 0.5, w: 9, h: 1.2,
  fontSize: 28, bold: true, color: 'FFFFFF',
})
```

### Pattern 3: Table Slide
**What:** addTable() for per-row data (management overhead, storage breakdown).
**When to use:** PPTX-06 (management domain), PPTX-08 (storage results).
**Example:**
```typescript
// Source: https://gitbrent.github.io/PptxGenJS/docs/api-tables.html
const rows = [
  [
    { text: 'Component', options: { bold: true, fill: 'E8E8E8', color: '000000' } },
    { text: 'vCPU',      options: { bold: true, fill: 'E8E8E8', color: '000000' } },
    { text: 'RAM (GB)',  options: { bold: true, fill: 'E8E8E8', color: '000000' } },
  ],
  ['vCenter',    String(mgmt.vcenterCores),    String(mgmt.vcenterRamGB)],
  ['SDDC Mgr',  String(mgmt.sddcCores),       String(mgmt.sddcRamGB)],
  ['NSX',       String(mgmt.nsxCores),        String(mgmt.nsxRamGB)],
  ['OPS/Fleet', String(mgmt.opsCores),        String(mgmt.opsRamGB)],
  ['Automation',String(mgmt.automationCores), String(mgmt.automationRamGB)],
  [{ text: 'Total', options: { bold: true } }, String(mgmt.totalCores), String(mgmt.totalRamGB)],
]
slide.addTable(rows, {
  x: 0.5, y: 1.5, w: 9,
  colW: [3.5, 2.5, 3],
  rowH: 0.5,
  fontSize: 12,
  color: 'F0F0F0',
  border: { type: 'solid', pt: 1, color: '444444' },
})
```

### Pattern 4: ExportToolbar Button Addition
**What:** Mirror the existing `handleExportMarkdown` async pattern; add loading state.
**When to use:** PPTX-01 — adding the "Download PPTX" button.
**Example:**
```typescript
// src/components/results/ExportToolbar.vue — add to <script setup>
import { generatePptxReport } from '@/composables/usePptxExport'

const pptxLoading = ref(false)

async function handleExportPptx() {
  pptxLoading.value = true
  try {
    await generatePptxReport()
  } finally {
    pptxLoading.value = false
  }
}
```
```html
<!-- Template — follow same button class pattern as existing buttons -->
<button
  class="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
  :disabled="pptxLoading"
  @click="handleExportPptx"
>
  {{ pptxLoading ? t('results.toolbar.exportPptxLoading') : t('results.toolbar.exportPptx') }}
</button>
```

### Pattern 5: Store Data Access in Composable
**What:** Call `useInputStore()` and `useCalculationStore()` at composable call-time (same as `useMarkdownExport.ts`).
**When to use:** Any composable that needs store values at export time.
**Example:**
```typescript
// Source: src/composables/useMarkdownExport.ts (Phase 6)
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

export async function generatePptxReport(): Promise<void> {
  const store = useInputStore()
  const calc = useCalculationStore()
  const now = new Date().toISOString().split('T')[0]
  // ... use store.*, calc.* to populate slides
}
```

### Anti-Patterns to Avoid
- **Call `addSlide()` before `defineSlideMaster()`:** The master will not be found; slides render without branding. Always define master first.
- **Re-use a `pres` instance across exports:** Slides accumulate from prior calls (PPTX-15 cleanliness requirement). Always instantiate `new PptxGenJS()` inside the export function body.
- **Hex color with `#` prefix:** pptxgenjs color values are bare hex strings (`'003087'` not `'#003087'`).
- **Top-level static import of pptxgenjs:** Defeats PPTX-15 — the library would land in the main synchronous chunk.
- **`writeFile()` without `await`:** The method returns a Promise; omitting `await` means the file may not finish generating before the function returns.
- **Calling store access inside a `computed()`:** Not applicable here (composable, not store), but store calls must stay at function-call level, not nested inside callbacks.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PPTX binary generation | Custom OOXML writer | pptxgenjs | OOXML is a 7000-page spec; slide masters, relationships, part references all managed by library |
| Browser download trigger | Manual Blob + `<a>` click | `pres.writeFile({ fileName })` | Library handles MIME type, object URL lifecycle, cross-browser quirks internally |
| Slide template system | Custom placeholder engine | `defineSlideMaster({ objects })` | Master objects layer is already a template system |
| ZIP packaging | JSZip manual assembly | pptxgenjs (JSZip included internally) | Library bundles and manages its own ZIP layer |

**Key insight:** pptxgenjs abstracts the entire OOXML zip structure. Any attempt to produce raw PPTX bytes directly would require implementing relationships, content types, theme XML, slide layout XML, and the full Open Packaging Convention.

---

## Common Pitfalls

### Pitfall 1: `#` in Color Codes
**What goes wrong:** `background: { color: '#003087' }` — the leading `#` is passed to XML attributes and PowerPoint fails to parse the color, rendering the background black or throwing an open error.
**Why it happens:** pptxgenjs follows OOXML color conventions which omit the hash.
**How to avoid:** Always pass bare 6-digit hex: `color: '003087'`.
**Warning signs:** Slides open with black/default background despite the option being set.

### Pitfall 2: `addSlide()` Called Before `defineSlideMaster()`
**What goes wrong:** The slide is created without a recognized master name; PowerPoint opens the file but resets the slide to its default blank layout.
**Why it happens:** `defineSlideMaster()` registers the master in the presentation's internal table; `addSlide({ masterName })` looks up that table at call time.
**How to avoid:** Strict ordering: all `defineSlideMaster()` calls at the top of the function, before any `addSlide()`.
**Warning signs:** PPTX opens but slides show no branding color.

### Pitfall 3: Static Import Breaks Bundle Splitting
**What goes wrong:** `import PptxGenJS from 'pptxgenjs'` at the top of `usePptxExport.ts` causes Vite to include ~800 KB (gzip ~230 KB estimated) in the main bundle.
**Why it happens:** Top-level static imports are resolved at module evaluation time; Vite cannot split them.
**How to avoid:** `const PptxGenJS = (await import('pptxgenjs')).default` inside the async function body.
**Warning signs:** `npx vite build --report` shows pptxgenjs in the main entry chunk.

### Pitfall 4: TypeScript Type Import Conflict
**What goes wrong:** `import type PptxGenJS from 'pptxgenjs'` at module top for type annotations causes the type import to fail if the module only has a default export with certain TypeScript settings.
**Why it happens:** pptxgenjs uses `export default` with `export =` in some older typings.
**How to avoid:** Use `typeof import('pptxgenjs')` for type narrowing, or declare a local type alias after the dynamic import: `type PptxType = typeof PptxGenJS`.
**Warning signs:** `TS2305: Module 'pptxgenjs' has no exported member 'default'` — switch to `.default` access.

### Pitfall 5: `writeFile()` Not Awaited
**What goes wrong:** The function returns before the internal JSZip assembly completes; no download is triggered.
**Why it happens:** `writeFile()` is async and returns `Promise<string>`.
**How to avoid:** Always `await pres.writeFile({ fileName: '...' })`.
**Warning signs:** Button click does nothing; no network/download activity in DevTools.

### Pitfall 6: Per-Export State Contamination
**What goes wrong:** Calling the export function twice produces a PPTX with 14 slides (double the expected 7).
**Why it happens:** `pres` is declared at module scope (not inside the function body), so `addSlide()` appends to the existing instance.
**How to avoid:** Always declare `const pres = new PptxGenJS()` inside the function body, not at module scope.
**Warning signs:** Second export has double slides or carries content from the previous run.

### Pitfall 7: Vitest Cannot Dynamically Import pptxgenjs in Node Environment
**What goes wrong:** `import('pptxgenjs')` inside the composable fails in tests with an error about browser globals (`Blob`, `URL.createObjectURL`) not being available.
**Why it happens:** pptxgenjs uses browser APIs for the download path; `vitest.config.ts` uses `environment: 'node'`.
**How to avoid:** In tests, mock the dynamic import — do not call `generatePptxReport()` end-to-end. Instead, extract the data-mapping logic (what goes on each slide) into a pure function `buildPptxData(store, calc)` and test that function only. The pptxgenjs call is integration-level and can be verified manually or with a jsdom environment if needed.
**Warning signs:** `ReferenceError: Blob is not defined` in test output.

---

## Code Examples

### Complete usePptxExport.ts Skeleton
```typescript
// Source: pptxgenjs 4.0.1 docs + useMarkdownExport.ts pattern
// src/composables/usePptxExport.ts
// Plain TypeScript — NO Vue lifecycle hooks (CALC-01/CALC-02 compliant)
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

const MASTER_NAME = 'VCF_MASTER'
const COLOR_BROADCOM_BLUE = '003087'
const COLOR_WHITE = 'FFFFFF'
const COLOR_LIGHT_TEXT = 'CCCCCC'

export async function generatePptxReport(): Promise<void> {
  const store = useInputStore()
  const calc = useCalculationStore()
  const now = new Date().toISOString().split('T')[0]

  // Dynamic import — Vite code-splits this automatically (PPTX-15)
  const PptxGenJS = (await import('pptxgenjs')).default
  // Fresh instance per export — no state carryover (PPTX-15 cleanliness)
  const pres = new PptxGenJS()

  // MUST be called before any addSlide() (Pitfall 2)
  pres.defineSlideMaster({
    title: MASTER_NAME,
    background: { color: COLOR_BROADCOM_BLUE },
    objects: [
      { rect: { x: 0, y: 6.8, w: '100%', h: 0.5, fill: { color: '001F5B' } } },
      { text: { text: 'VMware by Broadcom  |  VCF Sizer', options: {
        x: 0.3, y: 6.85, w: 9, h: 0.4,
        color: COLOR_LIGHT_TEXT, fontSize: 9,
      } } },
    ],
  })

  // Slide 1: Title (PPTX-03)
  addTitleSlide(pres, store.deploymentMode, now)

  // Slide 2: Config Summary (PPTX-04)
  addConfigSummarySlide(pres, store)

  // Slide 3: Workload Profile (PPTX-05)
  addWorkloadProfileSlide(pres, store)

  // Slide 4: Management Domain Overhead (PPTX-06)
  addManagementOverheadSlide(pres, calc.management)

  // Slide 5: Compute Results (PPTX-07)
  addComputeResultsSlide(pres, calc.compute)

  // Slide 6: Storage Results (PPTX-08)
  addStorageResultsSlide(pres, store, calc.storage)

  // Slide 7: Recommendations (PPTX-09)
  addRecommendationsSlide(pres, store, calc, now)

  // Triggers browser download (Pitfall 5: must await)
  await pres.writeFile({ fileName: 'vcf-sizing-report.pptx' })
}
```

### defineSlideMaster with Broadcom Branding (PPTX-02)
```typescript
// Source: https://gitbrent.github.io/PptxGenJS/docs/masters/
pres.defineSlideMaster({
  title: 'VCF_MASTER',
  background: { color: '003087' },  // Broadcom blue — NO '#' prefix (Pitfall 1)
  objects: [
    // Footer bar
    { rect: { x: 0, y: 6.8, w: '100%', h: 0.5, fill: { color: '001F5B' } } },
    // Footer text
    { text: {
        text: 'VMware by Broadcom  |  VCF Sizer',
        options: { x: 0.3, y: 6.85, w: 8, h: 0.4, color: 'AAAAAA', fontSize: 9 },
    } },
  ],
  slideNumber: { x: 9.5, y: 6.85, color: 'AAAAAA', fontSize: 9 },
})
```

### writeFile for Browser Download (PPTX-01)
```typescript
// Source: https://gitbrent.github.io/PptxGenJS/docs/usage-saving/
await pres.writeFile({ fileName: 'vcf-sizing-report.pptx' })
// In browser: triggers automatic download with correct MIME type
// Returns Promise<string> resolving to fileName
```

---

## Store Field → Slide Mapping

This table tells the planner exactly which store fields populate each slide.

| Slide | Req | Store Source | Fields |
|-------|-----|--------------|--------|
| Title | PPTX-03 | inputStore | `deploymentMode`, date (`new Date()`) |
| Config Summary | PPTX-04 | inputStore | `hostCount`, `coresPerSocket`, `socketsPerHost`, `hostRamGB`, `hostStorageTB`, `storageType`, `networkSpeedGbE`, `managementArchitecture` |
| Workload Profile | PPTX-05 | inputStore | `vmCount`, `avgVcpuPerVm`, `avgVramGbPerVm`, `avgStorageGbPerVm`, `cpuOvercommitRatio`, `ramOvercommitRatio` |
| Mgmt Overhead | PPTX-06 | calc.management | `vcenterCores/RamGB`, `sddcCores/RamGB`, `nsxCores/RamGB`, `opsCores/RamGB`, `automationCores/RamGB`, `totalCores/RamGB` |
| Compute Results | PPTX-07 | calc.compute | `recommendedHostCount`, `minHostsForCpu`, `minHostsForRam`, `coreUtilizationPct`, `ramUtilizationPct`, `availableCores`, `availableRamGB` |
| Storage Results | PPTX-08 | inputStore + calc.storage | `storageType` (input); `raidScheme`, `rawCapacityTB`, `usableAfterRaidTB`, `lfsOverheadTB`, `metadataOverheadTB`, `safeUsableCapacityTB` (calc) |
| Recommendations | PPTX-09 | calc.compute + calc.storage + calc.validationErrors | `recommendedHostCount`, `safeUsableCapacityTB`, `validationErrors.length` |

---

## i18n Keys Required

The following keys must be added to all 4 locale files (`en.json`, `fr.json`, `de.json`, `it.json`) under `results.toolbar`:

```json
"exportPptx": "Download PPTX",
"exportPptxLoading": "Generating..."
```

Current `results.toolbar` keys (from `en.json`):
- `share`, `copied`, `exportMd`, `print`

No PPTX-specific slide content needs i18n — slide text is English-only for v2.1 (localization deferred per REQUIREMENTS.md future requirements).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | pptxgenjs install | Yes | node v22+ (inferred from package.json deps) | — |
| pptxgenjs | PPTX-01..15 | Not yet installed | 4.0.1 (latest) | — |
| Vitest | Phase 8 tests | Yes | ^4.1.2 (in devDependencies) | — |

**Missing dependencies with no fallback:**
- `pptxgenjs` — must be installed with `npm install pptxgenjs` before any implementation task.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/composables/usePptxExport.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PPTX-01 | `generatePptxReport` is an async function | unit | `npx vitest run src/composables/usePptxExport.test.ts` | ❌ Wave 0 |
| PPTX-03 | Title slide data includes deploymentMode and date | unit (data mapping) | same | ❌ Wave 0 |
| PPTX-04 | Config summary data includes all 8 host/config fields | unit (data mapping) | same | ❌ Wave 0 |
| PPTX-05 | Workload slide data includes vmCount, overcommit ratios | unit (data mapping) | same | ❌ Wave 0 |
| PPTX-06 | Mgmt overhead data includes all 6 component rows | unit (data mapping) | same | ❌ Wave 0 |
| PPTX-07 | Compute results data includes recommendedHostCount, utilization | unit (data mapping) | same | ❌ Wave 0 |
| PPTX-08 | Storage results data includes safeUsableCapacityTB | unit (data mapping) | same | ❌ Wave 0 |
| PPTX-09 | Recommendations data includes key outputs | unit (data mapping) | same | ❌ Wave 0 |
| PPTX-02 | Slide master uses color '003087' | unit (config object) | same | ❌ Wave 0 |
| PPTX-15 | generatePptxReport uses dynamic import (not static) | smoke (source inspection) | manual | N/A — code review |

**Test strategy note:** Because pptxgenjs itself uses browser globals (`Blob`, `URL.createObjectURL`), the Vitest node environment cannot run `generatePptxReport()` end-to-end without mocking. The recommended approach is to extract data-mapping into pure helper functions (`buildTitleSlideData`, `buildConfigSummaryData`, etc.) and test only those. The `generatePptxReport()` integration test is manual-only.

### Sampling Rate
- **Per task commit:** `npx vitest run src/composables/usePptxExport.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/composables/usePptxExport.test.ts` — covers PPTX-01..09 data-mapping assertions
- [ ] Framework install: `npm install pptxgenjs` — must run before Wave 1

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Script-tag CDN load | ESM + dynamic import() | pptxgenjs v3+ | Bundler-native; no global namespace pollution |
| `pptx.save()` (v2 API) | `pres.writeFile()` returns Promise | v3.0 | Must `await`; no callback style |
| `fill` property on BackgroundProps | `color` property (fill deprecated) | v3.6.0 | Use `background: { color: 'XXXXXX' }` not `background: { fill: 'XXXXXX' }` |

**Deprecated/outdated:**
- `background.fill` property: deprecated in v3.6.0; use `background.color` instead.
- `background.src` property: deprecated in v3.6.0; use `background.path` for image backgrounds.
- Callback-style `save(fileName, callback)`: removed in v3; use `await writeFile({ fileName })`.

---

## Open Questions

1. **pptxgenjs bundle size impact**
   - What we know: pptxgenjs has zero runtime dependencies; gzip size estimated ~200-300 KB for v4.
   - What's unclear: Exact gzip size with Vite 8 + rolldown bundler.
   - Recommendation: Run `npx vite build --report` after `npm install pptxgenjs` as the first implementation task (tracked in STATE.md pending todos).

2. **`defineSlideMaster()` option-object mutation**
   - What we know: STATE.md flags this as "pitfall A-2" requiring prototyping.
   - What's unclear: Whether pptxgenjs mutates the objects array passed to it (which would corrupt re-use of a shared constant).
   - Recommendation: Define the master config object inline (object literal, not a shared constant) to avoid any mutation side effects. Prototype in Wave 1 before designing master template.

3. **Slide dimensions**
   - What we know: pptxgenjs defaults to `LAYOUT_16x9` (10 x 7.5 inches); `LAYOUT_WIDE` is 13.33 x 7.5 inches.
   - What's unclear: Which layout Broadcom standard decks use.
   - Recommendation: Use `pres.layout = 'LAYOUT_WIDE'` (13.33 × 7.5) which is the modern widescreen standard; adjust all `x`, `w` coordinates accordingly.

---

## Sources

### Primary (HIGH confidence)
- https://gitbrent.github.io/PptxGenJS/docs/quick-start/ — constructor, addSlide, addText, writeFile
- https://gitbrent.github.io/PptxGenJS/docs/masters/ — defineSlideMaster API, SlideMasterProps, calling order
- https://gitbrent.github.io/PptxGenJS/docs/api-text.html — addText() full options
- https://gitbrent.github.io/PptxGenJS/docs/api-tables.html — addTable() full API
- https://gitbrent.github.io/PptxGenJS/docs/usage-saving/ — writeFile(), write() with all output types
- `npm view pptxgenjs version` — confirmed 4.0.1 as of 2026-03-30

### Secondary (MEDIUM confidence)
- https://github.com/gitbrent/PptxGenJS/blob/master/types/index.d.ts — TypeScript interfaces (WebFetch)
- npm registry JSON for version/dist-tags verification

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pptxgenjs 4.0.1 version confirmed via npm registry; API verified via official docs
- Architecture: HIGH — pattern follows useMarkdownExport.ts exactly; Vite dynamic import behavior is well-established
- Pitfalls: HIGH — hex color without `#`, calling order, fresh instance per export all verified from official docs and API behavior
- Store field mapping: HIGH — fields read directly from existing store files (inputStore.ts, calculationStore.ts, management.ts)

**Research date:** 2026-03-30
**Valid until:** 2026-06-30 (pptxgenjs 4.x API is stable; check for patch releases)
