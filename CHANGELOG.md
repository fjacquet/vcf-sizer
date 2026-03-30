# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- ESLint + Prettier configuration with CI enforcement
- CI workflow with test, lint, and type-check gates on PRs
- Dependabot for automated dependency updates
- LICENSE, CONTRIBUTING, SECURITY, and CHANGELOG files
- PR template and issue templates
- EditorConfig for cross-editor consistency

## [1.0.0] - 2026-03-30

### Added
- VCF 9.x interactive sizing calculator (browser-only, no backend)
- Simple / HA / Stretch cluster topology support
- vSAN ESA storage sizing with FTT/RAID selection and adaptive RAID gate
- vSAN Max disaggregated storage clusters (5 ReadyNode profiles)
- FC / NFS pass-through storage with host count validation
- AI/GPU workload vGPU memory overhead modeling
- NVMe Memory Tiering for ESXi 9.x
- Stretch cluster validation (bandwidth, MTU, RTT, witness)
- Multi-domain support (up to 4 workload domains)
- Shareable URLs with lz-string compression + Zod validation
- Export to Markdown, PDF, and PowerPoint
- 4 Swiss locales: EN, FR-CH, DE-CH, IT-CH
- Real-time Chart.js visualizations
- Pure TypeScript engine with 242 tests
- GitHub Pages deployment via CI/CD
