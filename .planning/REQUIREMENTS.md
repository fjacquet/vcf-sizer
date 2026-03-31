# Requirements — v3.1 Sizing Correctness & Guided Workflow

**Milestone:** v3.1 Sizing Correctness & Guided Workflow
**Status:** Active
**Last updated:** 2026-03-30

---

## Milestone v3.1 Requirements

### Engine Correctness

- [x] **ENGINE-01**: Engine sizes management domain first; in dedicated architecture mode, workload domains receive zero management vCPU/RAM overhead (currently management overhead is unconditionally passed to all domains)
- [x] **ENGINE-02**: In colocated architecture mode, engine adds management vCPU/RAM overhead to WLD-1 required resources before computing WLD-1 host count
- [x] **ENGINE-03**: Aggregate totals include dedicated management host count in the procurement total (`dedicatedMgmtHostCount` is currently not added to `totalRecommendedHosts`)
- [x] **ENGINE-04**: TypeScript compiler errors in `useMarkdownExport.ts`, `usePptxExport.ts`, and `useUrlState.ts` are resolved (missing module imports, implicit `any` types)

### Wizard UI

- [x] **WIZARD-01**: User sees a 3-step horizontal wizard with numbered and labeled steps (1: Topology, 2: Management, 3: Workloads) visible throughout the sizing workflow
- [x] **WIZARD-02**: User can navigate back to a previous step without losing any entered data
- [x] **WIZARD-03**: User cannot advance from step 1 until a deployment topology (Simple / HA / Stretch) is selected
- [x] **WIZARD-04**: User cannot advance from step 2 until management domain inputs are valid (host count meets minimum)
- [ ] **WIZARD-05**: User sees the management domain result card (computed host count + utilization) at the end of step 2 before advancing to step 3
- [ ] **WIZARD-06**: User sees a collapsed summary of committed management resources (host count, vCPU, RAM) at the top of step 3
- [ ] **WIZARD-07**: Shareable URL never encodes wizard step position (ephemeral UI state excluded from lz-string payload)

### Export Accuracy

- [ ] **EXPORT-01**: Markdown export aggregate totals section includes a management hosts line: dedicated mode shows host count; colocated mode shows "colocated with WLD-1"
- [ ] **EXPORT-02**: PPTX aggregate totals slide includes a management hosts breakdown row matching the Markdown representation

---

## Future Requirements (Deferred to v4+)

### Wizard Enhancements

- **WIZARD-EXT-01**: User can click a completed step indicator to jump back to that step directly
- **WIZARD-EXT-02**: Wizard shows a "Start Sizing" landing / intro view on first load
- **WIZARD-EXT-03**: Topology change in step 1 after step 2 completion triggers a confirmation dialog

### Advanced Mode

- **ADV-01**: User can toggle between wizard mode and the classic flat tab layout (power user escape hatch)

### Domain Features (carried from v3.0 deferred list)

- Domain duplication ("Copy domain" button) — useful for modeling near-identical domains with minor differences
- Domain reordering (drag-and-drop tab reordering)
- Per-domain Chart.js visualizations (multi-series or per-domain switching)
- Aggregate CPU/RAM/Storage chart across all domains

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-step route-based URLs (vue-router wizard) | Adds router config complexity for no functional benefit; URL encodes domain data only |
| Animated step transitions | CSS complexity with zero correctness value |
| Wizard state saved to localStorage | URL sharing (lz-string) already provides state persistence |
| VCF topology rename (Simple→PoC, HA→Single Site) | Current names confirmed; renaming risks breaking i18n keys across 4 locales |
| VCF 9.x colocated overhead authoritative formula | No official Broadcom spec exists; engine uses engineering-derived absorption formula |

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| ENGINE-01 | Phase 15 | Complete |
| ENGINE-02 | Phase 15 | Complete |
| ENGINE-03 | Phase 15 | Complete |
| ENGINE-04 | Phase 15 | Complete |
| WIZARD-01 | Phase 16 | Complete |
| WIZARD-02 | Phase 16 | Complete |
| WIZARD-07 | Phase 16 | Pending |
| WIZARD-03 | Phase 17 | Complete |
| WIZARD-04 | Phase 17 | Complete |
| WIZARD-05 | Phase 17 | Pending |
| WIZARD-06 | Phase 17 | Pending |
| EXPORT-01 | Phase 17 | Pending |
| EXPORT-02 | Phase 17 | Pending |

**Coverage:**

- v3.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 — traceability updated after roadmap creation*
