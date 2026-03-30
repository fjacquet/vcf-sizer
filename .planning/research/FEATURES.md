# Feature Research

**Domain:** Infrastructure sizing calculator — VMware Cloud Foundation 9.x — Export Quality (v2.1 milestone)
**Researched:** 2026-03-29 (v2.1 export quality additions)
**Confidence:** HIGH (Markdown section requirements), HIGH (PptxGenJS capabilities), HIGH (print/CSS layout), MEDIUM (slide content conventions — based on industry patterns, not VCF-specific consulting templates)

---

## Scope Note

This document is the v2.1 milestone research update. It focuses exclusively on the three export export types being built:

1. **Markdown enrichment** — complete all missing sections in `generateMarkdownReport()`
2. **Print/PDF layout overhaul** — proper print CSS with page breaks, header/footer, charts
3. **PPTX export** — browser-side PowerPoint generation via PptxGenJS

The existing core calculator feature research (Table Stakes, Differentiators, Anti-Features for the sizing engine) is preserved in this document for reference, with the export-specific research at the top.

---

## v2.1 Export Quality — Feature Landscape

### Markdown Report: What Is Currently Missing

The existing `generateMarkdownReport()` in `src/composables/useUrlState.ts` covers only 4 of the 12+ data areas the calculationStore exposes. The following is a completeness audit.

#### Currently Covered (do not duplicate)

| Section | Source in calculationStore |
|---------|---------------------------|
| Host Configuration | `inputStore`: hostCount, coresPerSocket, socketsPerHost, hostRamGB, hostStorageTB |
| Management Domain Overhead (total only) | `calc.management.totalCores`, `calc.management.totalRamGB` |
| Compute Sizing | `calc.compute.*` (all 9 fields) |
| Storage Sizing (vSAN ESA) | `calc.storage.*` (all 8 fields) |

#### Missing Sections — Required for a Complete Report

| Section | Store/Input Source | Condition | Priority |
|---------|-------------------|-----------|----------|
| Report header metadata | `inputStore.deploymentMode`, `inputStore.managementArchitecture`, `inputStore.networkSpeedGbE` | Always | P1 |
| Workload profile | `inputStore`: vmCount, avgVcpuPerVm, avgVramGbPerVm, avgStorageGbPerVm, cpuOvercommitRatio, ramOvercommitRatio | Always | P1 |
| Management domain — per-component breakdown | `calc.management`: vcenterCores/RamGB, sddcCores/RamGB, nsxCores/RamGB, opsCores/RamGB, automationCores/RamGB | Always | P1 |
| Management architecture | `inputStore.managementArchitecture`, `calc.dedicatedMgmtHostCount` | When dedicated | P1 |
| NVMe Memory Tiering | `inputStore.nvmeTieringEnabled`, `inputStore.activeMemoryPct` | When enabled | P1 |
| AI/GPU workload profile | `inputStore.gpuVmCount`, `inputStore.vgpuMemoryGB` | When gpuVmCount > 0 | P1 |
| Storage configuration details | `inputStore.storageType`, `inputStore.fttLevel`, `inputStore.raidType`, `inputStore.dedupEnabled`, `inputStore.dedupRatio` | Always | P1 |
| Storage — deduplication results | `calc.storage.usableBeforeDedupTB`, `calc.storage.effectiveCapacityTB` | When dedupEnabled | P2 |
| Stretch cluster topology | `calc.stretch.*` (all 7 fields), `inputStore.preferredSiteHosts`, `inputStore.secondarySiteHosts` | When deploymentMode === 'stretch' | P1 |
| Stretch network checklist | `calc.stretch.networkChecklist.*` | When deploymentMode === 'stretch' | P1 |
| vSAN Max cluster | `calc.vsanMax.*` (all 6 fields), `inputStore.vsanMaxProfile`, `inputStore.vsanMaxStorageNodes` | When storageType === 'vsan-max' | P1 |
| Validation warnings/errors | `calc.validationErrors[]` | When array length > 0 | P1 |
| Shareable URL | `generateShareUrl()` | Always (footer) | P2 |

#### Markdown Report: Table Stakes

Features every professional infrastructure sizing Markdown report must have. Missing any of these makes the report unusable as a standalone deliverable.

| Feature | Why Expected | Complexity | Store Dependency |
|---------|--------------|------------|-----------------|
| Complete configuration snapshot | Reader must be able to reconstruct the inputs from the report alone | LOW | All inputStore fields |
| Per-component management table | Architects present this to justify management overhead — line-by-line breakdown (vCenter, SDDC Manager, NSX, Ops, Automation) | LOW | `calc.management.*` per-component fields |
| Workload profile section | Documents the workload assumptions so a future reader knows what was sized | LOW | `inputStore` workload fields |
| Overcommit ratios documented | Critical assumption — different ratios produce radically different host counts | LOW | `inputStore.cpuOvercommitRatio`, `ramOvercommitRatio` |
| Conditional sections (stretch/vSAN Max/NVMe/GPU) | Report must reflect the actual configuration — a stretch report with no stretch section is wrong | MEDIUM | All conditional computed results |
| Validation warnings section | If errors exist, they must appear prominently in the report — a report that silently omits warnings is dangerous | LOW | `calc.validationErrors[]` |
| Section headers with H2 hierarchy | Allows downstream tools (Pandoc, GitHub, Confluence) to build a table of contents | LOW | Template structure |
| Correct units throughout | TB vs GB, vCPU vs pCPU — inconsistency causes ordering mistakes | LOW | Engine output types |
| Date stamp + generator attribution | Required for report traceability in change management processes | LOW | `new Date()`, static URL |

#### Markdown Report: Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Shareable URL in footer | Anyone reading the report can recreate the exact configuration in the tool | LOW | `generateShareUrl()` already exists |
| Conditional section rendering (stretch/vSAN Max/GPU/NVMe) | Report is always correctly scoped — no irrelevant sections | MEDIUM | Use `if` guards per section |
| Management domain per-component table | Shows the HA breakdown (x3 multiplier for NSX/Ops/Automation) — this is what architects actually present in design documents | LOW | All 10 fields of MgmtDomainResult |
| Dedup effective capacity line | Distinguishes raw-to-usable from usable-after-dedup — a key metric when dedup is enabled | LOW | `calc.storage.effectiveCapacityTB` |

#### Markdown Report: Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Embedded chart images (base64 PNG in Markdown) | "Include charts in the report" | Markdown with base64 PNGs renders poorly in most viewers; file size balloons to 500KB+; not portable | Charts belong in PDF/PPTX exports; Markdown stays text-only |
| HTML formatting in Markdown | "Use color or bold warnings" | GitHub/Confluence render HTML inconsistently; breaks in many Markdown parsers | Use Markdown bold `**WARNING:**` prefix for critical warnings |
| Multi-file export (separate files per section) | "Organize the report better" | Adds download complexity; single file is simpler to share and email | Keep as single `.md` file; use H2 sections for structure |
| i18n in the Markdown report | "Report in the user's language" | Adds complexity to the template; most report consumers are engineers who read EN | Use EN labels in the report; the UI remains fully localized |

---

### Print/PDF Layout: What Makes a Good Browser Print Report

#### Print/PDF: Table Stakes

| Feature | Why Expected | Complexity | Implementation |
|---------|--------------|------------|----------------|
| Page breaks before major sections | Tables and sections that span pages are unreadable | LOW | Tailwind `break-before-page` on H2 sections (confirmed in Tailwind v4 docs) |
| `break-inside: avoid` on tables and charts | Prevents a table from splitting mid-row across page boundaries | LOW | Tailwind `break-inside-avoid` class on each table/card |
| `print:hidden` on UI controls | Input forms, toolbar buttons, navigation must vanish in print | LOW | Already partially done — ExportToolbar has `print:hidden` |
| Print-specific page margins | Browser defaults add huge margins; 0.5in margins are standard for technical reports | LOW | `@media print { @page { margin: 0.5in; } }` in CSS |
| Monochrome-safe colors | Colored badges and alerts must be legible when printed in grayscale | MEDIUM | Use border + text instead of background-only color coding; add `print:border-black` |
| Table header repetition across pages | When a table spans 2+ pages, the header row must appear on each page | LOW | CSS `thead { display: table-header-group; }` — standard behavior |
| Font size adjustment for print | Screen fonts (14px) are too large for A4 print; 11pt is standard | LOW | `@media print { body { font-size: 11pt; } }` |
| `print:hidden` on charts (or print-specific chart rendering) | Chart.js canvas elements do not print cleanly on all browsers | HIGH | Either hide charts in print view, or use a static SVG/table fallback. Hiding is LOW complexity; good SVG fallback is HIGH. |

#### Print/PDF: Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Header with report title + date on every page | Professional documents have running headers; architects expect this | HIGH | Chrome 131+ supports CSS `@top-center` margin boxes. For broad compat, use `position: fixed` with padding-top workaround — MEDIUM. Skip entirely is LOW but looks unpublished. |
| Footer with page numbers + URL on every page | Traceability for multi-page printed reports | HIGH | Same complexity as header. `position: fixed; bottom: 0` works in Chrome/Edge print. |
| Conditional print sections (same as Markdown) | Print output must match the configuration — no empty stretch section if simple mode | MEDIUM | Same conditional rendering as screen; CSS handles the rest |
| Print-only summary table on page 1 | Quick-reference summary before detailed sections — architect's at-a-glance page | MEDIUM | Requires a new `<div class="hidden print:block">` summary component |

#### Print/PDF: Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Server-side PDF generation (Puppeteer/headless) | "Better quality PDF control" | Requires a backend — violates the zero-infrastructure constraint | Browser `window.print()` with quality print CSS is sufficient for the audience |
| jsPDF canvas capture | "Generate PDF without browser print dialog" | jsPDF canvas captures are rasterized (blurry text, no copy-paste); file sizes are large | Browser print-to-PDF produces vector PDF with selectable text |
| Animated/interactive elements in print | "Show charts in print" | Canvas elements don't transfer reliably to print; Chart.js uses WebGL in some paths | Replace charts with data tables in print view using `print:block` / `print:hidden` |
| Dark mode print output | "Print in dark mode" | Dark backgrounds consume enormous amounts of printer ink; unreadable on monochrome | Force `@media print { * { color: black; background: white; } }` |

---

### PPTX Export: Professional Cloud Infrastructure Sizing Deck Structure

#### Library: PptxGenJS 4.0.1

**Source:** Verified via `npm show pptxgenjs version` — current version 4.0.1 (March 2026).
**Capabilities confirmed:** Text, tables, shapes, images, charts, SVGs, Slide Masters, TypeScript definitions, browser blob download, Vite/Vue 3 compatible.
**Bundle impact:** ~800 KB minified (adds ~5x to current 159 KB gzip bundle). Acceptable for a feature only invoked on button click — can be lazy-loaded via dynamic import.

#### Recommended Slide Structure for VCF Sizing Deck

Based on analysis of IT infrastructure assessment presentation conventions (Nutanix Sizer outputs, VMware vSAN ReadyNode Sizer PDF structure, general consulting deliverable patterns):

| Slide # | Title | Content | Store Source | Condition |
|---------|-------|---------|-------------|-----------|
| 1 | Title slide | "VCF 9.x Sizing Report", customer name (if applicable), date, "Generated by VCF Sizer" | Static + `new Date()` | Always |
| 2 | Agenda | Bullet list of slide topics | Static | Always |
| 3 | Configuration Summary | Deployment model, management architecture, storage type, network speed, host count — the key inputs at a glance | `inputStore.*` | Always |
| 4 | Host Specifications | Cores/socket, sockets/host, RAM/host, storage/host, total raw compute pool | `inputStore.*` | Always |
| 5 | Workload Profile | VM count, avg vCPU/VM, avg vRAM/VM, avg storage/VM, overcommit ratios | `inputStore.*` | Always |
| 6 | Management Domain Overhead | Per-component table: vCenter, SDDC Manager, NSX Manager, VCF Operations, VCF Automation — cores + RAM per component, totals | `calc.management.*` | Always |
| 7 | Compute Sizing Results | Recommended host count (large/bold), CPU utilization %, RAM utilization %, min hosts for CPU vs RAM | `calc.compute.*` | Always |
| 8 | Storage Sizing Results | Storage type, RAID scheme, raw → usable waterfall, safe usable capacity | `calc.storage.*` | Always |
| 9 | AI/GPU Workload | GPU VM count, vGPU memory GB, GPU memory overhead note | `inputStore.gpuVmCount`, `inputStore.vgpuMemoryGB` | Only when gpuVmCount > 0 |
| 10 | NVMe Memory Tiering | Tiering enabled/disabled, active memory %, tiering benefit explanation | `inputStore.nvmeTieringEnabled`, `inputStore.activeMemoryPct` | Only when nvmeTieringEnabled |
| 11 | Stretch Cluster Topology | Sites: preferred/secondary host counts, witness specs, per-site effective storage, bandwidth requirement | `calc.stretch.*`, `inputStore.preferredSiteHosts`, `inputStore.secondarySiteHosts` | Only when deploymentMode === 'stretch' |
| 12 | Stretch Network Checklist | MTU 9000, RTT < 5ms inter-site, RTT < 200ms to witness, bandwidth >= 10 Gbps — pass/fail checklist | `calc.stretch.networkChecklist.*` | Only when deploymentMode === 'stretch' |
| 13 | vSAN Max Storage Cluster | Profile, storage node count, compute node count, raw capacity, usable capacity, RAID scheme | `calc.vsanMax.*`, `inputStore.vsanMaxProfile` | Only when storageType === 'vsan-max' |
| 14 | Validation Warnings | Error and warning items from the validation engine, formatted as colored alert rows | `calc.validationErrors[]` | Only when validationErrors.length > 0 |
| 15 | Recommendations | Bullet summary: recommended host count, storage architecture, critical warnings, next steps | Derived from all calc results | Always |
| 16 | Appendix / Methodology | Overhead stack explanation, RAID formula, management HA multiplier rules | Static text | Always |

**Total slides:** 10 always-present + up to 6 conditional = 10–16 slides depending on configuration.

#### PPTX: Table Stakes

| Feature | Why Expected | Complexity | PptxGenJS API |
|---------|--------------|------------|--------------|
| Title slide with date | All decks start with a cover slide | LOW | `slide.addText()` with large font, centered |
| Data tables with bold headers | Infrastructure data is tabular by nature | LOW | `slide.addTable(rows, options)` — first row bold |
| Key metric callouts (large number + label) | Recommended host count should be visually prominent — the primary result | LOW | `slide.addText(count, { fontSize: 48, bold: true })` |
| Conditional slides (stretch/vSAN Max/GPU/NVMe) | Deck must be scoped to actual configuration — no empty slides | MEDIUM | `if (deploymentMode === 'stretch') pres.addSlide(...)` |
| Consistent slide master / color theme | Professional decks use consistent typography and brand colors | MEDIUM | `pres.defineSlideMaster(masterDef)` — define once, apply to all |
| Browser-side `.pptx` download (no server) | Zero infrastructure constraint | LOW | `pres.writeFile({ fileName: 'vcf-sizing.pptx' })` or `pres.write({ outputType: 'blob' })` |
| Validation warnings slide | Engineers must not miss errors — they should appear in the deck | LOW | Conditional on `validationErrors.length > 0` |

#### PPTX: Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Lazy-loaded via dynamic `import()` | PptxGenJS is ~800 KB; should not be in the initial bundle | LOW | `const { default: PptxGenJS } = await import('pptxgenjs')` — Vite handles dynamic import automatically |
| Slide master with VMware-style blues | Deck looks intentional and professional, not like a generic template | MEDIUM | Define master with `pres.defineSlideMaster({ bkgd: 'FFFFFF', objects: [headerBar] })` |
| Waterfall chart on storage slide | Visual representation of raw → RAID → LFS → metadata → safe usable capacity | HIGH | PptxGenJS supports bar charts; a stacked bar can approximate a waterfall. Complex to get right. |
| Recommendations slide derived from calc results | Synthesizes findings into actionable bullet points (e.g., "Minimum 6 hosts required due to RAID-6 policy") | MEDIUM | Logic to generate recommendation text from calc results |
| Shareable URL on title slide | Anyone opening the PPTX can click through to recreate the sizing scenario | LOW | Add URL as hyperlink text on title slide |

#### PPTX: Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Embedded Chart.js canvas as image | "Include the interactive charts in PPTX" | Canvas-to-image in PPTX requires `canvas.toDataURL()` + PptxGenJS `addImage()`; looks pixelated at presentation resolution; adds significant complexity | Use PptxGenJS native table/bar chart API instead |
| Fully branded customer-specific template | "White-label the output per customer" | Requires a customer name input field + template variants; scope creep | Single clean VCF-branded template with "customer: [your org]" as placeholder text |
| Editable chart data tables in PPTX | "Charts should be editable in PowerPoint" | Requires PptxGenJS chart data format — doable but adds a full separate implementation path per chart type | Tables with raw numbers are editable by default; charts are extra complexity |
| Per-locale slide content | "Generate the deck in French/German/Italian" | PPTX template strings would need full i18n pipeline; out of scope for v2.1 | Export deck in English; UI stays fully localized. Engineers present in EN. |
| Animation/transitions between slides | "Make it look professional" | Adds no information value; PptxGenJS supports transitions but they are fragile in Keynote/LibreOffice | No transitions; clean static slides |

---

## Feature Dependencies

```
PPTX export
    └──requires──> PptxGenJS (npm install pptxgenjs@^4.0.1)
    └──reads──> calculationStore (management, compute, storage, stretch, vsanMax, validationErrors)
    └──reads──> inputStore (all fields for configuration sections)
    └──enhances──> lazy dynamic import (keeps initial bundle at 159 kB)

Markdown enrichment
    └──reads──> calculationStore (all 6 computed results)
    └──reads──> inputStore (all 24 fields)
    └──requires──> conditional section logic (stretch/vSAN Max/GPU/NVMe guards)

Print/PDF overhaul
    └──requires──> @media print CSS additions to existing components
    └──requires──> break-inside-avoid on ResultsPanel sections
    └──enhances──> existing window.print() call in ExportToolbar.vue
    └──optional──> print-only summary div (new component)

Markdown conditional sections
    └──enhances──> Markdown enrichment (sections only appear when relevant)

PPTX conditional slides
    └──enhances──> PPTX export (deck scoped to active features)
```

### Dependency Notes

- **PPTX requires PptxGenJS 4.0.1:** Not currently in package.json — must be added as a production dependency. Verify Vite ESM compatibility before assuming it works (`"type": "module"` project).
- **Print/PDF is independent of Markdown and PPTX:** Can be implemented in parallel; only touches CSS/Tailwind.
- **Markdown and PPTX share the same data sources:** Both read the same calculationStore and inputStore. Consider a shared `buildReportSections()` utility that returns structured data both exporters can consume — avoids duplicating conditional logic.

---

## Feature Prioritization Matrix (v2.1)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Markdown: missing sections (workload, per-component mgmt, warnings) | HIGH — report is incomplete without them | LOW — template extension, no new APIs | P1 |
| Markdown: conditional sections (stretch, vSAN Max, GPU, NVMe) | HIGH — wrong report content for non-standard configs | MEDIUM — needs conditional rendering logic | P1 |
| Print/PDF: page break CSS + hide UI controls | HIGH — current print output is unusable | LOW — Tailwind print utilities | P1 |
| PPTX: core slides (title, config, host, workload, management, compute, storage, recommendations) | HIGH — primary deliverable for customer presentations | MEDIUM — PptxGenJS table/text API | P1 |
| PPTX: conditional slides (stretch, vSAN Max, GPU, NVMe, warnings) | HIGH — deck must match configuration | MEDIUM — same conditional logic as Markdown | P1 |
| PPTX: lazy loading via dynamic import | MEDIUM — bundle size impact | LOW — Vite handles automatically | P2 |
| Print/PDF: running header/footer | MEDIUM — professional touch | HIGH — cross-browser print header/footer is complex | P2 |
| Print/PDF: print-only summary page | MEDIUM — useful for multi-page reports | MEDIUM — new component | P2 |
| PPTX: slide master branding | MEDIUM — visual polish | MEDIUM — PptxGenJS defineSlideMaster() | P2 |
| PPTX: waterfall chart on storage slide | LOW — visual, not informational | HIGH — PptxGenJS chart API complexity | P3 |

---

## Markdown Report Completeness Checklist

Every infrastructure sizing report must include these sections. Missing any = incomplete deliverable.

### Always Required

- [ ] **Report header** — title, date, deployment model, management architecture, network speed
- [ ] **Host specification** — cores/socket, sockets/host, RAM/host, storage/host, host count (or per-site counts for stretch)
- [ ] **Workload profile** — VM count, avg vCPU/VM, avg vRAM/VM, avg storage/VM, CPU overcommit, RAM overcommit
- [ ] **Management domain — per-component table** — vCenter, SDDC Manager, NSX Manager (×3 if HA), VCF Operations (×3 if HA), VCF Automation (×3 if HA), totals
- [ ] **Compute sizing results** — recommended host count, min hosts for CPU, min hosts for RAM, CPU/RAM utilization %
- [ ] **Storage configuration** — storage type, FTT level, RAID type, dedup enabled/ratio
- [ ] **Storage sizing results** — raw, RAID overhead, LFS overhead, metadata overhead, safe usable capacity
- [ ] **Footer** — generated by attribution + shareable URL

### Conditional (include only when applicable)

- [ ] **Dedicated management cluster** (when `managementArchitecture === 'dedicated'`) — recommended management host count
- [ ] **NVMe Memory Tiering** (when `nvmeTieringEnabled === true`) — tiering ratio, active memory %, effective memory budget
- [ ] **AI/GPU workload** (when `gpuVmCount > 0`) — GPU VM count, vGPU memory per VM, GPU memory overhead
- [ ] **Storage deduplication results** (when `dedupEnabled === true`) — dedup ratio, effective capacity after dedup
- [ ] **Stretch cluster topology** (when `deploymentMode === 'stretch'`) — preferred/secondary host counts, witness specs, cross-site bandwidth, per-site effective storage
- [ ] **Stretch network checklist** (when `deploymentMode === 'stretch'`) — MTU, RTT inter-site, RTT to witness, bandwidth, jumbo frames
- [ ] **vSAN Max storage cluster** (when `storageType === 'vsan-max'`) — profile, storage nodes, compute nodes, raw/usable capacity, RAID scheme
- [ ] **Validation warnings** (when `validationErrors.length > 0`) — each error/warning with code and description

---

## Print/PDF Layout Conventions

Based on research of print CSS standards and professional technical report conventions:

### Layout Rules

| Rule | CSS/Tailwind | Why |
|------|-------------|-----|
| Section headers force page break | `break-before-page` on `<h2>` | Each major section starts on a new page — standard for multi-section technical reports |
| Cards and tables avoid internal breaks | `break-inside-avoid` on each result card | Prevents half-rendered tables or orphaned rows |
| Charts replaced by data tables in print | `print:hidden` on `<canvas>`, `print:block` on table fallback | Chart.js canvas renders inconsistently across browsers in print mode |
| UI elements hidden | `print:hidden` on toolbar, forms, language switcher, input panel | Print output should be the report only |
| Font size 11pt | `@media print { font-size: 11pt }` | Standard for technical documents; 14px screen size wastes page space |
| Page margins 0.5in | `@media print { @page { margin: 0.5in } }` | Standard A4 technical report margin |
| Table headers repeat across pages | CSS `thead { display: table-header-group }` | Standard — already correct behavior in most browsers, but must be set explicitly |
| Orphans/widows control | `orphans: 3; widows: 3` on paragraphs | Prevents single-line orphaned paragraphs at page bottom |
| Colors forced to black on white | `@media print { color: black; background: white }` | Ink cost and legibility on monochrome printers |

### Tailwind v4 Print Utilities Available

Confirmed in Tailwind CSS docs (verified March 2026):

- `break-inside-avoid` → `break-inside: avoid`
- `break-inside-avoid-page` → `break-inside: avoid-page`
- `break-before-page` → `break-before: page`
- `break-after-page` → `break-after: page`
- `print:hidden` → `display: none` in print media
- `print:block` → `display: block` in print media

---

## Existing Core Feature Landscape (v1.0 — v2.0, for reference)

The sections below are preserved from the prior milestone research. The export quality features above build on top of these already-shipped features.

### Table Stakes (Users Expect These)

Features that cloud architects assume exist in any credible sizing tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Deployment model selector (Simple / HA / Stretch) | VCF 9 has three fundamentally different resource profiles | LOW | Shipped v1.0 |
| Physical host specification input | All downstream calculations depend on hardware specs | LOW | Shipped v1.0 |
| Host minimum-cores hard warning (12 cores / 24 threads) | VCFA is a hard deployment blocker | LOW | Shipped v1.0 |
| Management domain baseline resource display | Shows management overhead before workload sizing | MEDIUM | Shipped v1.0 |
| Workload profile inputs | Without workload data there is nothing to size | LOW | Shipped v1.0 |
| Principal storage selection (vSAN ESA / FC / NFS / vSAN Max) | Storage type determines overhead calculations | MEDIUM | Shipped v1.0/v2.0 |
| vSAN FTT policy selector | Different policies produce different raw-to-usable ratios | MEDIUM | Shipped v1.0 |
| Total host count recommendation | Primary output architects need before purchasing hardware | LOW | Shipped v1.0 |
| Shareable configuration URL | Architects share sizing results with colleagues | LOW | Shipped v1.0 |
| Export to PDF or Markdown | Architects need to include sizing in design documents | MEDIUM | Shipped v1.0 — quality improved in v2.1 |
| Multi-language support: FR, EN, DE, IT | Swiss market requirement | MEDIUM | Shipped v1.0 |
| Static site deployment (no backend) | Zero infrastructure cost | LOW | Shipped v1.0 |

### Differentiators (Shipped in v1.0–v2.0)

| Feature | Status |
|---------|--------|
| NVMe Memory Tiering toggle (ESXi 9.x) | Shipped v1.0 |
| vSAN ESA Global Deduplication toggle | Shipped v1.0 |
| Stretch cluster full sizing with network checklist | Shipped v1.0/v2.0 |
| vSAN Max disaggregated storage cluster sizing | Shipped v2.0 |
| Dedicated vs co-located management architecture | Shipped v2.0 |
| AI/GPU workload inputs | Shipped v1.0 |
| Chart visualizations (Chart.js) | Shipped v1.0 |
| Swiss-locale number formatting | Shipped v1.0 |

---

## Sources

- PptxGenJS v4.0.1 — `npm show pptxgenjs version` (verified 2026-03-29) — [https://gitbrent.github.io/PptxGenJS/](https://gitbrent.github.io/PptxGenJS/)
- Tailwind CSS break-inside documentation — [https://tailwindcss.com/docs/break-inside](https://tailwindcss.com/docs/break-inside) — HIGH confidence
- CSS print page styling best practices — [https://www.docuseal.com/blog/css-print-page-style](https://www.docuseal.com/blog/css-print-page-style) — MEDIUM confidence
- Print CSS headers/footers deep dive — [https://aaronsaray.com/2025/a-deep-dive-into-print-css-headers-and-footers/](https://aaronsaray.com/2025/a-deep-dive-into-print-css-headers-and-footers/) — MEDIUM confidence
- vSAN ReadyNode Sizer report structure — [https://medium.com/@lubomir-tobek/vsan-readynode-sizer-c46ce1365312](https://medium.com/@lubomir-tobek/vsan-readynode-sizer-c46ce1365312) — MEDIUM confidence
- Nutanix sizing report sections — [https://www.nutanix.com/tech-center/blog/hybrid-cloud-sizing-and-capacity-planning](https://www.nutanix.com/tech-center/blog/hybrid-cloud-sizing-and-capacity-planning) — MEDIUM confidence
- IT infrastructure assessment presentation templates — [https://www.slideteam.net/blog/top-10-it-infrastructure-assessment-templates-with-samples-and-examples](https://www.slideteam.net/blog/top-10-it-infrastructure-assessment-templates-with-samples-and-examples) — LOW confidence (marketing site, could not extract template details)
- `src/composables/useUrlState.ts` — existing `generateMarkdownReport()` implementation — HIGH confidence (first-party code)
- `src/stores/calculationStore.ts` — all computed results available — HIGH confidence (first-party code)
- `src/stores/inputStore.ts` — all input fields — HIGH confidence (first-party code)
- `src/engine/types.ts` — all result interfaces — HIGH confidence (first-party code)

---
*Feature research for: VCF 9.x export quality (Markdown, Print/PDF, PPTX)*
*Researched: 2026-03-29*
