# Requirements — v3.0 Multi-Domain Support

**Milestone:** v3.0 Multi-Domain Support
**Status:** Active
**Last updated:** 2026-03-30

---

## Milestone v3.0 Requirements

### Domain Data Model & Store

- [ ] **DOM-01**: `inputStore` is refactored from a flat structure to `managementDomain: ManagementDomainConfig` + `workloadDomains: WorkloadDomainConfig[]`
- [ ] **DOM-02**: `WorkloadDomainConfig` type includes a stable `id` (crypto.randomUUID()), a user-editable `name`, all per-domain host specs, workload profile, storage config, and optional feature toggles (NVMe, AI/GPU, stretch, vSAN Max)
- [ ] **DOM-03**: `ManagementDomainConfig` type contains management host specs (CPU, cores, RAM) and the management architecture toggle — independent from any workload domain
- [ ] **DOM-04**: Default state on first load is one workload domain named "WLD-1" with all existing default values
- [ ] **DOM-05**: `calculationStore` maps over `workloadDomains` to produce a `domainResults` computed array (one result per domain) — zero `ref()` (CALC-02)
- [ ] **DOM-06**: `calculationStore` reduces `domainResults` into `aggregateTotals` (total host count, combined resources) — zero `ref()` (CALC-02)

### Domain Management UI

- [ ] **UI-01**: A tab strip above the input panel shows one tab per workload domain; clicking a tab makes that domain's inputs active
- [ ] **UI-02**: User can add a new workload domain via an "Add Domain" button; new domain appends with default name "WLD-N" (N = current count + 1) and all default values
- [ ] **UI-03**: User can remove a workload domain via a per-tab delete button; a confirmation dialog appears only when the domain has non-default data; the last remaining domain cannot be deleted
- [ ] **UI-04**: User can rename a workload domain by double-clicking its tab label; inline edit field with blur/Enter to confirm, Escape to cancel
- [ ] **UI-05**: Management domain inputs (host specs + architecture toggle) are displayed in a dedicated section separate from the workload domain tab strip — not as a tab

### URL State

- [ ] **URL-01**: `useUrlState.ts` Zod schema is restructured to `{ managementDomain: ManagementDomainSchema, workloadDomains: z.array(WorkloadDomainSchema).min(1) }` with `.strip()` on all sub-schemas
- [ ] **URL-02**: Old flat-schema shared URLs (v2.x format) are not migrated — they fall back to default state on load
- [ ] **URL-03**: Full multi-domain configuration (N workload domains) serializes to and deserializes from a lz-string compressed URL parameter round-trip losslessly
- [ ] **URL-04**: The active tab index is NOT serialized to URL state; on hydration, the first domain tab is always active

### Input Forms (per-domain)

- [ ] **FORM-01**: `HostSpecsForm` accepts a `domainId` prop and reads/writes to the corresponding domain in `workloadDomains` via `computed({ get, set })`
- [ ] **FORM-02**: `WorkloadProfileForm` accepts a `domainId` prop; VM count, vCPU/VM, vRAM/VM, storage/VM, and overcommit ratios are all per-domain
- [ ] **FORM-03**: `StorageConfigForm` accepts a `domainId` prop; storage type selection and all storage-type-specific options (vSAN dedup, vSAN Max profile, etc.) are per-domain
- [ ] **FORM-04**: `DeploymentModelSelector` accepts a `domainId` prop; `deploymentMode` (Simple/HA/Stretch) and all stretch-specific inputs (`preferredSiteHosts`, `secondarySiteHosts`) are per-domain
- [ ] **FORM-05**: NVMe tiering, AI/GPU workload, and vSAN Max options are per-domain — each domain independently enables or disables these features

### Results (per-domain + aggregate)

- [ ] **RES-01**: Each workload domain renders its own result card showing domain name, recommended host count, CPU utilization %, RAM utilization %, and storage breakdown for that domain
- [ ] **RES-02**: An aggregate totals card summarizes all workload domains: total host count (sum), combined compute demand, combined storage demand
- [ ] **RES-03**: Management domain results (mgmt component overhead + recommended management host count) render in their existing dedicated section, unchanged from v2.x

### Exports (per-domain sections)

- [ ] **EXP-01**: Markdown export includes one section per workload domain, each containing the domain name, its configuration inputs, and its sizing results
- [ ] **EXP-02**: Markdown export includes a totals section after all domain sections summarizing aggregate host counts and resources
- [ ] **EXP-03**: PPTX export includes one slide per workload domain showing the domain name, key inputs, and results summary
- [ ] **EXP-04**: PPTX export includes an aggregate totals slide after all per-domain slides

---

## Future Requirements (Deferred to v3.1+)

- Domain duplication ("Copy domain" button) — useful for modeling near-identical domains with minor differences
- Domain reordering (drag-and-drop tab reordering)
- Per-domain Chart.js visualizations (multi-series charts or per-domain chart switching)
- Aggregate CPU/RAM/Storage chart across all domains
- Auto-migration of v2.x flat-schema URLs to single-domain array format

---

## Out of Scope

- Backend/server-side logic — client-only SPA, no backend permitted
- localStorage or session persistence — URL sharing is the only persistence mechanism
- User accounts or named configurations beyond URL sharing
- Cross-domain comparison view (side-by-side columns) — deferred to v3.1+
- vSAN Max stretched topology per domain — still not implemented in engine

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| DOM-01 | Phase 10 | TBD |
| DOM-02 | Phase 10 | TBD |
| DOM-03 | Phase 10 | TBD |
| DOM-04 | Phase 10 | TBD |
| DOM-05 | Phase 10 | TBD |
| DOM-06 | Phase 10 | TBD |
| URL-01 | Phase 11 | TBD |
| URL-02 | Phase 11 | TBD |
| URL-03 | Phase 11 | TBD |
| URL-04 | Phase 11 | TBD |
| UI-01 | Phase 12 | TBD |
| UI-02 | Phase 12 | TBD |
| UI-03 | Phase 12 | TBD |
| UI-04 | Phase 12 | TBD |
| UI-05 | Phase 12 | TBD |
| FORM-01 | Phase 12 | TBD |
| FORM-02 | Phase 12 | TBD |
| FORM-03 | Phase 12 | TBD |
| FORM-04 | Phase 12 | TBD |
| FORM-05 | Phase 12 | TBD |
| RES-01 | Phase 13 | TBD |
| RES-02 | Phase 13 | TBD |
| RES-03 | Phase 13 | TBD |
| EXP-01 | Phase 14 | TBD |
| EXP-02 | Phase 14 | TBD |
| EXP-03 | Phase 14 | TBD |
| EXP-04 | Phase 14 | TBD |
