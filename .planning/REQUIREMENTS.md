# Requirements — v3.3 UX Polish & Export Quality

## Milestone Goal

Improve user experience through wizard navigation enhancements and domain management features, while enriching exports with visuals, localization, and in-app preview, and correcting storage units to true binary TiB throughout.

## Active Requirements

### WIZARD — Navigation Enhancements

- [ ] **WIZARD-01**: User can click any completed WizardStepper step badge to jump back to that step
- [ ] **WIZARD-02**: User sees a landing/intro view on first load before the wizard starts
- [x] **WIZARD-03**: User is prompted to confirm before changing topology after workloads have been configured

### DOMAIN — Management

- [x] **DOMAIN-01**: User can duplicate a workload domain ("Copy domain") with all its settings cloned and a new name assigned

### CHART — Per-Domain Visualizations

- [ ] **CHART-01**: Each workload domain result card shows its own Cores, RAM, and Storage charts (not a shared single chart set)

### EXPORT — Export Quality

- [ ] **EXPORT-01**: PPTX slides include chart images (PNG, rasterized from the live Chart.js canvas)
- [ ] **EXPORT-02**: Markdown and PPTX exports use the active UI locale instead of always rendering in English
- [ ] **EXPORT-03**: User can preview rendered Markdown in-app before downloading

### STOR — Storage Units & Inputs

- [ ] **STOR-01**: All storage inputs and outputs use TiB (binary, 2^40 bytes) throughout the UI and exports, replacing TB (decimal)
- [ ] **STOR-02**: For vSAN ESA workload domains, the "Raw Storage per Host" input is in TiB
- [ ] **STOR-03**: For FC/NFS workload domains, a "Total Usable Storage Pool (TiB)" input replaces the hidden raw-storage-per-host field
- [ ] **STOR-04**: Engine storage calculations use TiB; URL state schema updated (`hostStorageTiB`, `externalStorageUsableTiB`)

## Future Requirements (deferred)

- Dark mode print stylesheet
- Domain reordering (drag-and-drop tab reordering)
- Advanced mode: toggle between wizard and classic flat layout
- Per-locale export file naming
- `window.confirm()` replacement for domain delete (use shared ConfirmDialog.vue built in WIZARD-03)

## Out of Scope (v3.3)

- Backend/server-side logic — client-only SPA
- User accounts or saved sessions
- vSphere 7.x or VCF 5.x calculations
- vSAN OSA legacy calculations
- vSAN Max storage unit changes (handled by STOR-01 globally)
- Side-by-side comparison columns

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| WIZARD-01 | Phase 18 | Pending |
| WIZARD-02 | Phase 18 | Pending |
| WIZARD-03 | Phase 19 | Complete |
| DOMAIN-01 | Phase 19 | Complete |
| STOR-01 | Phase 20 | Pending |
| STOR-02 | Phase 20 | Pending |
| STOR-03 | Phase 20 | Pending |
| STOR-04 | Phase 20 | Pending |
| CHART-01 | Phase 21 | Pending |
| EXPORT-01 | Phase 22 | Pending |
| EXPORT-02 | Phase 22 | Pending |
| EXPORT-03 | Phase 23 | Pending |
