# Requirements — v2.1 Export Quality

**Milestone:** v2.1 Export Quality
**Status:** Active
**Last updated:** 2026-03-30

---

## Milestone v2.1 Requirements

### Markdown Export

- [ ] **MD-01**: User can download a complete Markdown report generated from `src/composables/useMarkdownExport.ts` (function extracted from `useUrlState.ts`)
- [ ] **MD-02**: Report includes a workload profile section (VM count, vCPU per VM, vRAM per VM, storage per VM, CPU and RAM overcommit ratios)
- [ ] **MD-03**: Report includes a management architecture section (shared vs dedicated, dedicated management host count when applicable)
- [ ] **MD-04**: Report includes an NVMe memory tiering section (enabled/disabled state, active memory percentage)
- [ ] **MD-05**: Report includes an AI/GPU workload section (GPU VM count, vGPU memory per VM)
- [ ] **MD-06**: Report includes a stretch cluster topology section (per-site host counts, bandwidth floor, witness specs, network checklist items)
- [ ] **MD-07**: Report includes a vSAN Max cluster section (ReadyNode profile, storage node count, compute node count, raw and usable capacity)
- [ ] **MD-08**: Report includes a validation warnings section listing all active errors and warnings at export time
- [ ] **MD-09**: Report includes a network configuration section (network speed in GbE, dedup eligibility status)

### Print / PDF

- [ ] **PRINT-01**: User can print the results panel only — input panel is hidden in print mode via Tailwind `print:hidden`
- [ ] **PRINT-02**: Print output applies proper page margins and paper size via `@page` CSS rule in `style.css`
- [ ] **PRINT-03**: Result cards avoid mid-card page breaks (`break-inside-avoid` applied to all result section containers)
- [ ] **PRINT-04**: Printed pages include a running header with the report title and generation date
- [ ] **PRINT-05**: Printed pages include a footer with VCF Sizer attribution
- [ ] **PRINT-06**: Chart.js canvas elements are hidden in print mode; a plain data table is shown as fallback for each chart

### PPTX Export

- [ ] **PPTX-01**: User can download a `.pptx` file via a new button in `ExportToolbar.vue`
- [ ] **PPTX-02**: PPTX file uses a VCF-branded slide master (Broadcom blue `#003087`, consistent heading/body fonts, logo placeholder)
- [ ] **PPTX-03**: PPTX includes a title slide with deployment mode label and generation date
- [ ] **PPTX-04**: PPTX includes a configuration summary slide (host specs, storage type, network speed, management architecture)
- [ ] **PPTX-05**: PPTX includes a workload profile slide (VM count, vCPU, vRAM, overcommit ratios)
- [ ] **PPTX-06**: PPTX includes a management domain overhead slide (per-component vCPU and RAM breakdown table)
- [ ] **PPTX-07**: PPTX includes a compute results slide (recommended host count, CPU and RAM utilization percentages)
- [ ] **PPTX-08**: PPTX includes a storage results slide (capacity breakdown: raw, RAID overhead, LFS, metadata, safe usable)
- [ ] **PPTX-09**: PPTX includes a recommendations slide summarising key sizing outputs and any active warnings
- [ ] **PPTX-10**: PPTX includes a conditional AI/GPU slide when `gpuVmCount > 0`
- [ ] **PPTX-11**: PPTX includes a conditional NVMe memory tiering slide when `nvmeTieringEnabled = true`
- [ ] **PPTX-12**: PPTX includes a conditional stretch cluster topology slide when `deploymentMode = 'stretch'`
- [ ] **PPTX-13**: PPTX includes a conditional vSAN Max cluster slide when `storageType = 'vsan-max'`
- [ ] **PPTX-14**: PPTX includes a conditional validation warnings slide when one or more warnings exist
- [ ] **PPTX-15**: `pptxgenjs` is loaded via dynamic `import()` inside the export function body — zero impact on the initial bundle

---

## Future Requirements (Deferred)

- Localized PPTX and Markdown exports (EN-only for v2.1; localization pipeline to non-Vue context deferred)
- Chart images embedded in PPTX slides (rasterized from Chart.js canvas — deferred to v2.2 pending quality gate)
- In-app Markdown preview panel before download
- Dark mode print stylesheet

---

## Out of Scope

- Server-side PDF rendering — project is client-only; no backend permitted
- `jsPDF` or `html2canvas` — rejected: bundle cost and output quality disqualify both
- vSAN Max stretched topology export slides — not yet implemented in engine (v2.1+ feature)
- Per-locale export file naming (e.g., `rapport-vcf.md` for FR) — deferred

---

## Traceability

_Filled by roadmapper._

| REQ-ID | Phase | Plan |
|--------|-------|------|
| (pending roadmap) | | |
