# VCF Sizer

[![Deploy to GitHub Pages](https://github.com/fjacquet/vcf-sizer/actions/workflows/deploy.yml/badge.svg)](https://github.com/fjacquet/vcf-sizer/actions/workflows/deploy.yml)
[![Live App](https://img.shields.io/badge/live-app-blue?logo=github)](https://fjacquet.github.io/vcf-sizer/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-313%20passing-brightgreen)](src/engine)

Interactive sizing calculator for VMware Cloud Foundation 9.x deployments. Runs entirely in the browser — no backend required.

## What It Does

Compute, memory, and storage requirements across all VCF 9 deployment topologies before hardware is ordered:

- **Simple / HA / Stretch Cluster** — management overhead, workload sizing, host count recommendations
- **vSAN ESA** — FTT/RAID selection, global deduplication, adaptive RAID-5 gate (4-5 nodes = 2+1, 6+ nodes = 4+1)
- **vSAN Max** — disaggregated storage clusters, 5 ReadyNode profiles (XS/SM/MED/LRG/XL), independent compute sizing
- **FC / NFS** — external SAN/NAS with workload storage computation and pool capacity display
- **AI/GPU workloads** — vGPU memory overhead modeling
- **NVMe Memory Tiering** — ESXi 9.x 1:1 DRAM:NVMe at ≤50% active memory
- **Stretch cluster validation** — 10 Gbps bandwidth floor, MTU/RTT/witness network checklist

## Features

- Shareable URLs (lz-string + Zod validation) — no backend, no login
- Export to Markdown, PDF, and PPTX (PowerPoint with embedded chart images)
- In-app Markdown preview with XSS sanitization (DOMPurify)
- 3-step guided wizard (Topology, Management, Workloads)
- Domain duplication (copy all 26 fields)
- Topology change confirmation dialog
- Per-domain Chart.js visualizations (Cores, RAM, Storage)
- 4 languages: EN / FR / DE / IT (Switzerland locales)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Vue 3 (Composition API) + Tailwind CSS v4 |
| State | Pinia 3 |
| Engine | Pure TypeScript + Decimal.js |
| i18n | vue-i18n v11 |
| Charts | Chart.js via vue-chartjs |
| Build | Vite 8 |
| Export | pptxgenjs (PPTX), marked + DOMPurify (Markdown preview) |
| Tests | Vitest (313 tests) |

## Development

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run test       # run all tests
npm run build      # production build → dist/
npm run type-check # TypeScript validation
```

## Architecture

The engine layer (`src/engine/`) is pure TypeScript with zero Vue imports (CALC-01). The store layer (`src/stores/calculationStore.ts`) exposes only `computed()` — zero `ref()` (CALC-02). This keeps sizing formulas independently testable.

## License

MIT
