# Roadmap: VCF Sizer

## Milestones

- ✅ **v2.0 Architecture Correctness & vSAN Max** — Phases 1-5 (shipped 2026-03-29)
- 🔄 **v2.1 Export Quality** — Phases 6-9 (active)

## Phases

<details>
<summary>✅ v2.0 Architecture Correctness & vSAN Max (Phases 1-5) — SHIPPED 2026-03-29</summary>

- [x] Phase 1: Foundation, Engine and Inputs (3/3 plans) — completed 2026-03-28
- [x] Phase 2: Outputs, Charts and Export (2/2 plans) — completed 2026-03-29
- [x] Phase 3: Advanced Features and Polish (2/2 plans) — completed 2026-03-29
- [x] Phase 4: Correctness and Architecture Validation (2/2 plans) — completed 2026-03-29
- [x] Phase 5: vSAN Max Storage Cluster (2/2 plans) — completed 2026-03-29

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

### v2.1 Export Quality

- [ ] **Phase 6: Markdown Extraction and Enrichment** — Complete, section-rich Markdown report from a dedicated composable
- [ ] **Phase 7: Print/PDF CSS Overhaul** — Professional print layout with page geometry, breaks, header, footer, and chart fallbacks
- [ ] **Phase 8: PPTX Core Slides** — Downloadable VCF-branded PowerPoint covering all always-present slides
- [ ] **Phase 9: PPTX Conditional Slides and Polish** — Conditional slides for optional features plus integration polish

---

## Phase Details

### Phase 6: Markdown Extraction and Enrichment
**Goal**: Users can download a complete, professional Markdown report covering every configuration section
**Depends on**: Nothing (reads existing Pinia stores; zero new dependencies)
**Requirements**: MD-01, MD-02, MD-03, MD-04, MD-05, MD-06, MD-07, MD-08, MD-09
**Success Criteria** (what must be TRUE):
  1. User downloads a Markdown file sourced from `useMarkdownExport.ts`, not `useUrlState.ts`
  2. Downloaded report contains a workload profile section showing VM count, vCPU/VM, vRAM/VM, and overcommit ratios
  3. Downloaded report contains management architecture, NVMe tiering, AI/GPU, stretch topology, vSAN Max, warnings, and network sections — each present when the feature is active and absent when it is not
  4. Downloaded report lists all active validation warnings at export time
  5. All nine section types are covered by passing Vitest tests that assert section presence/absence against controlled store state
**Plans**: 3 plans
Plans:
- [x] 06-01-PLAN.md — Rewrite test file with full Pinia-backed failing test suite (Wave 0 TDD gate)
- [ ] 06-02-PLAN.md — Extract generateMarkdownReport() to useMarkdownExport.ts and update imports (MD-01)
- [ ] 06-03-PLAN.md — Enrich with all new sections: Workload Profile, Management Architecture, NVMe, AI/GPU, Stretch, vSAN Max, Validation Warnings, Network Config (MD-02..09)
**UI hint**: yes

### Phase 7: Print/PDF CSS Overhaul
**Goal**: Users can print or save to PDF a results-only layout with proper page geometry, section breaks, and header/footer
**Depends on**: Phase 6 (result sections finalised; CSS targets known DOM structure)
**Requirements**: PRINT-01, PRINT-02, PRINT-03, PRINT-04, PRINT-05, PRINT-06
**Success Criteria** (what must be TRUE):
  1. When the user prints, only the results panel is visible — the input panel and toolbar are absent from the printed output
  2. Each major result section begins on a new page and no result card is split across a page boundary
  3. Every printed page shows a running header containing the report title and generation date
  4. Every printed page shows a footer with the VCF Sizer attribution text
  5. Charts are hidden in print mode and replaced by a plain data table showing the same values
**Plans**: TBD

### Phase 8: PPTX Core Slides
**Goal**: Users can download a VCF-branded `.pptx` file containing all always-present slides without impacting initial page-load time
**Depends on**: Phase 6 (store field mapping established and tested; slide content specification derived from Markdown sections)
**Requirements**: PPTX-01, PPTX-02, PPTX-03, PPTX-04, PPTX-05, PPTX-06, PPTX-07, PPTX-08, PPTX-09, PPTX-15
**Success Criteria** (what must be TRUE):
  1. A "Download PPTX" button is visible in the export toolbar and triggers a `.pptx` file download
  2. The downloaded file opens in PowerPoint/Keynote/LibreOffice with a Broadcom blue (#003087) slide master applied to all slides
  3. The file contains exactly the seven always-present content slides: title, configuration summary, workload profile, management domain overhead, compute results, storage results, and recommendations
  4. The initial page load time is unaffected — `pptxgenjs` bundle does not appear in the synchronous chunk
  5. Each export produces a clean file with no slides from a previous export session
**Plans**: TBD
**UI hint**: yes

### Phase 9: PPTX Conditional Slides and Polish
**Goal**: The PPTX export includes all configuration-specific slides when the relevant features are active, completing the full export experience
**Depends on**: Phase 8 (composable skeleton, slide master, and color constants established)
**Requirements**: PPTX-10, PPTX-11, PPTX-12, PPTX-13, PPTX-14
**Success Criteria** (what must be TRUE):
  1. When GPU VM count is greater than zero, the downloaded PPTX contains an AI/GPU slide; when GPU VM count is zero, the slide is absent
  2. When NVMe tiering is enabled, the downloaded PPTX contains an NVMe memory tiering slide; when disabled, it is absent
  3. When deployment mode is stretch cluster, the downloaded PPTX contains a stretch topology slide; for other deployment modes, it is absent
  4. When storage type is vSAN Max, the downloaded PPTX contains a vSAN Max cluster slide; for other storage types, it is absent
  5. When one or more validation warnings are active, the downloaded PPTX contains a validation warnings slide; when there are no warnings, it is absent
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation, Engine and Inputs | v2.0 | 3/3 | Complete | 2026-03-28 |
| 2. Outputs, Charts and Export | v2.0 | 2/2 | Complete | 2026-03-29 |
| 3. Advanced Features and Polish | v2.0 | 2/2 | Complete | 2026-03-29 |
| 4. Correctness and Architecture Validation | v2.0 | 2/2 | Complete | 2026-03-29 |
| 5. vSAN Max Storage Cluster | v2.0 | 2/2 | Complete | 2026-03-29 |
| 6. Markdown Extraction and Enrichment | v2.1 | 1/3 | In Progress|  |
| 7. Print/PDF CSS Overhaul | v2.1 | 0/? | Not started | - |
| 8. PPTX Core Slides | v2.1 | 0/? | Not started | - |
| 9. PPTX Conditional Slides and Polish | v2.1 | 0/? | Not started | - |
