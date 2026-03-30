# Feature Landscape: Multi-Domain Support (v3.0)

**Domain:** Infrastructure sizing calculator — VMware Cloud Foundation 9.x — Multi-Workload Domain Support
**Researched:** 2026-03-30 (v3.0 multi-domain milestone)
**Confidence:** HIGH (tab UX patterns — NN/g + industry sources), HIGH (VCF domain architecture — Broadcom techdocs), MEDIUM (Nutanix Sizer multi-workload patterns — community docs), HIGH (delete confirmation UX — multiple verified sources)

---

## Scope Note

This document replaces the v2.1 export-quality research. It focuses on the v3.0 milestone: adding N independent workload domains to an existing single-domain sizing calculator. Key existing architecture constraints:

- `inputStore.ts` holds all mutable state as flat `ref()` fields — no arrays today
- `calculationStore.ts` is zero-`ref()`, pure `computed()` — must remain so
- `useUrlState.ts` uses a flat Zod schema — must expand to variable-length array
- Engine functions (compute, storage, management, stretch, vsanMax) are pure TypeScript with no Vue imports
- All 4 locales (en/fr/de/it) must be served from day one

---

## VCF Workload Domain Architecture Context

Understanding what a "workload domain" IS in VCF 9.x informs what must be independently configurable per domain.

A VI workload domain in VCF is:
- A pool of hosts managed by its own dedicated vCenter Server instance
- Independent network configuration and policy boundaries
- Independent storage (vSAN ESA, FC, NFS, or vSAN Max per domain)
- Independent lifecycle management (patching, upgrades per domain)
- Sized independently from other domains

**Implication for the calculator:** Each domain must independently carry ALL of the inputs currently in `inputStore.ts`:
- Host specs (cores, sockets, RAM, storage per host)
- Workload profile (VM count, vCPU/vRAM/storage per VM, overcommit ratios)
- Storage type + configuration (FTT, RAID, dedup, vSAN Max profile)
- Optional features: NVMe tiering, AI/GPU workloads, stretch cluster, vSAN Max
- Deployment model (simple/ha/stretch — stretch is per-domain in VCF)
- Network speed (affects dedup eligibility and stretch bandwidth cap)

The management domain (vCenter, SDDC Manager, NSX Manager, VCF Ops, VCF Automation) is shared across ALL workload domains in a VCF instance. It must have its own independent host specs but does NOT carry a workload profile.

---

## Table Stakes

Features users expect. Missing any of these makes the multi-domain feature unusable or feels incomplete.

| Feature | Why Expected | Complexity | Architecture Note |
|---------|--------------|------------|-------------------|
| Tab-per-domain UI | Industry standard for multi-item editing (IDEs, browsers, spreadsheets, Nutanix Sizer). Users cannot reason about N configs in one scrolling form. | MEDIUM | New tabbed layout wrapping existing input components |
| Add domain button | Dynamic addition is required — users configure domains one at a time as they plan their VCF deployment | LOW | Appends to domains array in store |
| Remove domain button per tab | Users need to delete domains they no longer need. Single-domain state (last domain) must be protected. | LOW | Must not allow deleting the last domain |
| Named domains | Each domain should have a user-visible name (e.g. "Production", "Dev/Test", "GPU Cluster"). Anonymous "Domain 1/2/3" labels are confusing for export reports. | LOW | Name is just a string field on each domain object |
| Default name on add | When adding a domain, provide a sensible default name ("Domain 2", "Domain 3") so users can immediately add and configure without a required name step | LOW | Auto-increment label |
| Per-domain independent config | Every existing input (host specs, workload, storage, optional features) applies independently per domain — this is the entire value proposition | HIGH | inputStore refactor to domains array |
| Management domain with own host specs | Management domain overhead is fixed (existing calcManagement() engine), but the hardware carrying it must be independently specifiable | MEDIUM | Separate mgmt host spec inputs decoupled from WLD |
| Per-domain results | Host count recommendation, compute utilization %, storage capacity — per domain, shown when that tab is active | MEDIUM | calculationStore iterates over domains array |
| Aggregate totals | Total host count across all domains + management domain is what gets sent to procurement. This is a primary deliverable. | MEDIUM | Sum across all domain results |
| URL state with multi-domain | The shareable URL must encode the full multi-domain configuration. This is the persistence mechanism — no localStorage. | HIGH | Zod schema change: add `domains: z.array(DomainSchema)` |
| Per-domain sections in Markdown export | A sizing report covering 3 domains must have 3 domain sections. Single-domain export format is insufficient. | HIGH | useMarkdownExport.ts refactor |
| Per-domain sections in PPTX export | Each domain should have its own slide(s) in the PowerPoint output. The aggregate summary slide replaces the current single-domain summary. | HIGH | usePptxExport.ts refactor |

---

## Differentiators

Features that set this tool apart from generic sizing tools. Not table stakes, but add significant value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Domain duplication ("Copy from...") | Cloud architects frequently configure multiple similar domains (e.g., two VI domains with the same host type but different workload profiles). Copy avoids re-entering host specs. | MEDIUM | Deep-clone domain object, auto-rename copy |
| Inline tab rename (double-click) | Standard in browsers (Arc, Warp) and IDEs. Faster than a modal dialog. Consistent with user mental model of named tabs. | LOW | Replace tab label with `<input>` on dblclick, commit on blur/Enter |
| Aggregate totals panel | Pinned summary card showing total hosts across all domains + management = total servers for procurement. This is the number that goes on the PO. | MEDIUM | Computed from sum of all domain results + mgmt hosts |
| Delete confirmation only when domain has data | Skip the "are you sure?" dialog if the domain is empty/default. Show it only when the domain has been meaningfully configured (vmCount > 0 or non-default host specs). Context-sensitive confirmation reduces dialog fatigue. | LOW | Check if domain has non-default values before showing modal |
| Tab scrolling with overflow | When a user adds 5+ domains, tabs must scroll horizontally rather than wrap or shrink labels into illegibility. Gradient fade at container edge hints at more tabs. | LOW | CSS overflow-x: auto on tab list, Tailwind `scrollbar-hide` |
| Domain-name-in-export filenames | Markdown and PPTX filenames reflect the project or first domain name (e.g. "vcf-sizer-production.md") for easier file management | LOW | Pass domain metadata to export composables |
| Validation per domain | Each domain independently reports its own warnings (too few hosts, dedup ineligible, etc.). Aggregate warnings panel shows all domain issues. | MEDIUM | validateInputs() called per domain, results merged |

---

## Anti-Features

Features to explicitly NOT build in v3.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Side-by-side domain comparison columns | Complex layout, breaks responsive design, duplicates the per-domain tab info | Use the aggregate totals panel for cross-domain summary |
| Drag-to-reorder tabs | Adds significant implementation complexity (drag events, touch support, state reorder) for minimal user benefit — domains are not ordered by importance | Provide simple "left/right" reorder arrows on the tab if order matters, deferred to post-v3.0 |
| Per-domain color theming | Cosmetic, adds accessibility concerns, zero sizing value | Use tab index + name for differentiation |
| localStorage persistence of domains | URL sharing IS the persistence model. localStorage adds sync complexity, stale-state bugs, and cross-device confusion | Keep URL state as sole persistence mechanism |
| Import from VCF Planning Workbook | Parsing an external Excel/CSV file adds significant scope and is a separate feature | Out of scope for v3.0 |
| Domain "locking" to prevent edits | Premature optimization — users who want a snapshot use the shareable URL | Not needed |
| Nested sub-domains | VCF workload domains can have multiple clusters but the calculator models at the domain level | Keep domain = single cluster sizing model (clusters not modeled separately) |
| Type-to-confirm delete dialog | Appropriate for repository deletion (permanent, irrecoverable). Overkill for a domain config in a client-side tool where the user can simply re-add the domain | Use a simple "Delete domain?" modal with Cancel/Delete buttons |

---

## Feature Dependencies

```
Management domain host specs independent from workload domains
  → Requires: separate mgmt host spec section in UI
  → Requires: mgmt host spec inputs NOT part of domain array

Add/Remove domain tabs
  → Requires: domains array in inputStore (replaces flat fields)
  → Requires: domain schema in useUrlState Zod schema
  → Requires: per-domain calculationStore computed iteration

Per-domain results
  → Requires: domains array in calculationStore
  → Requires: engine functions accept domain config objects (already pure functions, no change to signatures needed — just called per-domain)

Aggregate totals
  → Requires: per-domain results (all domains computed)
  → Requires: management domain host count

Per-domain export sections
  → Requires: per-domain results
  → Requires: named domains (for section headers)
  → Requires: aggregate totals

URL state with domains array
  → Requires: Zod schema update (z.array(DomainSchema))
  → Requires: hydrateFromUrl() updated to restore domains array
  → Requires: generateShareUrl() serializes full domains array

Domain duplication (differentiator)
  → Requires: add domain (table stake)
  → Requires: domain objects are plain serializable data (no reactive refs at domain level)
```

---

## Domain Object: What Each Domain Carries

Based on the existing `inputStore.ts` fields, each workload domain must carry:

```
WorkloadDomain {
  id: string           // uuid or nanoid — stable key for v-for/keying
  name: string         // user-visible label

  // Host specs (currently global in inputStore)
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTB: number
  hostCount: number        // or preferredSiteHosts/secondarySiteHosts for stretch

  // Deployment model
  deploymentMode: 'simple' | 'ha' | 'stretch'
  preferredSiteHosts: number
  secondarySiteHosts: number
  networkSpeedGbE: 10 | 25 | 100

  // Workload profile
  vmCount: number
  avgVcpuPerVm: number
  avgVramGbPerVm: number
  avgStorageGbPerVm: number
  cpuOvercommitRatio: number
  ramOvercommitRatio: number

  // Optional: NVMe tiering
  nvmeTieringEnabled: boolean
  activeMemoryPct: number

  // Optional: AI/GPU
  gpuVmCount: number
  vgpuMemoryGB: number

  // Storage config
  storageType: 'vsan-esa' | 'fc' | 'nfs' | 'vsan-max'
  fttLevel: 1 | 2
  raidType: 'raid1' | 'raid5' | 'raid6'
  dedupEnabled: boolean
  dedupRatio: number
  vsanMaxProfile: 'xs' | 'sm' | 'med' | 'lrg' | 'xl'
  vsanMaxStorageNodes: number
}
```

Management domain carries only:
```
ManagementDomainConfig {
  coresPerSocket: number
  socketsPerHost: number
  hostRamGB: number
  hostStorageTB: number
  managementArchitecture: 'shared' | 'dedicated'
}
```

Note: `managementArchitecture` moves from a workload-domain-level concern to a global/management-domain concern in v3.0, since it only applies to the management domain itself.

---

## Tab UX Patterns: Actionable Guidelines

Based on NN/g research and industry patterns, the following guidelines apply directly to the domain tab implementation:

### When to use tabs (applies here)
- Content sections are mutually exclusive and independent
- Users need to switch context frequently without losing progress in the other tabs
- The number of items is known at runtime but bounded (VCF practically limits to 5-10 workload domains)

### Tab rendering rules
- Active tab: distinct background (Tailwind `bg-white` or brand color), full border, elevated
- Inactive tab: muted background, bottom border only — visually "behind" the active tab
- Tab strip: horizontally scrollable when tabs overflow (`overflow-x: auto`, no wrapping)
- Overflow hint: gradient fade at right edge of tab strip when more tabs exist off-screen

### Add tab button
- Position: immediately after the last tab in the tab strip (right side), not in a toolbar
- Label: "+" or "+ Add Domain" depending on available space
- On click: appends new domain with default name ("Domain N"), activates the new tab immediately

### Tab naming (inline rename)
- Double-click on tab label replaces it with a focused `<input>` element
- Width: clamp input to min 80px, max 200px
- Commit: on Enter keypress or blur (focus loss)
- Cancel: on Escape keypress (restore previous name)
- Validation: prevent empty name (restore previous name if blank on commit)
- Do NOT require a rename dialog/modal — inline edit is the table-stakes pattern

### Remove tab button
- "×" icon appears inside each tab label on hover (or always visible on small screens)
- Minimum domains: disable or hide remove button when only 1 domain exists
- Confirmation: show a simple modal ("Delete domain '[name]'? This cannot be undone.") ONLY when the domain has non-default data (vmCount > 0 OR host specs differ from defaults). Skip confirmation for default/empty domains.
- After delete: activate the previous tab (left neighbor), or the next tab if deleting the first

### Keyboard accessibility
- Tab strip items are `role="tab"` in a `role="tablist"` (ARIA tabs pattern)
- Active tab content region is `role="tabpanel"` with `aria-labelledby` pointing to the tab
- Arrow keys navigate between tabs (left/right)
- Delete key on focused tab triggers delete flow

---

## Aggregate Totals: What to Show

The aggregate totals panel (pinned, always visible or at bottom of page) must answer the procurement question: "How many servers total?"

| Metric | Source | Why It Matters |
|--------|--------|---------------|
| Total workload domain hosts | Sum of `recommendedHostCount` across all domains | Goes to procurement |
| Management domain hosts | `dedicatedMgmtHostCount` when dedicated, or included in first domain when shared | Required for total |
| Grand total hosts | Sum of above | The number on the PO |
| Total vCPU capacity | Sum of `availableCores` across all domains | Cross-domain sanity check |
| Total RAM capacity (TB) | Sum of `availableRamGB` across all domains | Cross-domain sanity check |
| Total usable storage (TB) | Sum of `safeUsableCapacityTB` across all domains | Cross-domain sanity check |
| Domains with warnings | Count of domains with `validationErrors.length > 0` | Flag for review |

The panel should use progressive disclosure: show the headline numbers (total hosts), with a "Details" expansion for per-domain breakdown.

---

## URL State: Multi-Domain Schema

The existing flat Zod schema in `useUrlState.ts` must be restructured. The clean approach:

```typescript
// Per-domain Zod schema (all fields optional with defaults)
const WorkloadDomainSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default('Domain 1'),
  // ... all domain fields with defaults matching current inputStore defaults
}).strip()

// Top-level schema replaces flat InputStateSchema
const AppStateSchema = z.object({
  domains: z.array(WorkloadDomainSchema).min(1).default(() => [defaultDomain()]),
  management: ManagementConfigSchema,
}).strip()
```

Key constraints:
- `z.array().min(1)` — at least one domain always required
- `.default()` with a factory function — generates a domain with all defaults if `domains` is missing from the URL (backward compatibility with v2.x URLs)
- `.strip()` at both levels — unknown keys discarded at domain and top level
- IDs must be stable across hydration (don't regenerate on parse — use the stored ID)

Backward compatibility with v2.x single-domain URLs: If a v2.x compressed URL is loaded, `AppStateSchema.safeParse()` will fail (no `domains` key). The fallback behavior should produce a single default domain — effectively a fresh start, which is acceptable.

---

## Export: Multi-Domain Structure

### Markdown Report Structure

```
# VCF Sizing Report
[Report metadata: date, tool version, locale]

## Deployment Overview
[Aggregate totals table: total hosts by domain + management]

## Management Domain
[Host specs, management overhead breakdown, dedicated/shared architecture]

## Workload Domain: [Domain Name] (1 of N)
[Full existing single-domain report structure: workload profile, host specs,
 compute results, storage results, optional sections (stretch/NVMe/GPU/vSAN Max),
 validation warnings]

## Workload Domain: [Domain Name] (2 of N)
[Same structure]

...

## Summary
[Shareable URL]
```

### PPTX Structure

```
Slide 1: Title (existing)
Slide 2: Deployment Overview (new — aggregate totals)
Slide 3: Management Domain (existing slide adapted)
Slide 4..N+3: Per-domain slides (one slide per domain minimum)
  - Domain name as slide title
  - Compute + storage results
  - Conditional: stretch/NVMe/GPU sub-section
Slide N+4: Warnings (if any domain has warnings)
```

---

## Phase-Specific Complexity Notes

### Highest complexity: inputStore refactor
Replacing 20+ flat `ref()` fields with a `domains` array is the foundational change. Every input component, the calculationStore, and useUrlState must change together. The TDD discipline from prior phases (Wave 0: failing tests first) is critical here.

### Medium complexity: calculationStore multi-domain
The store must iterate over all domains and expose both per-domain results AND aggregate computed values. The CALC-02 rule (zero `ref()`) must hold — all results remain `computed()`.

### Medium complexity: URL state schema migration
The Zod schema change is a breaking change to URL format. Existing v2.x shared URLs will produce empty/default state on load. This is acceptable — document it in the release notes. The schema migration must maintain `.strip()` at all levels and handle the `crypto.randomUUID()` default for domain IDs.

### Low complexity: Tab UI itself
The tab component is CSS + Vue conditional rendering. Tailwind handles overflow scrolling. The inline rename pattern is ~30 lines of Vue component logic. This is NOT the risky part.

### Low complexity: Export refactor
The markdown and PPTX composables are already pure TypeScript with no Vue lifecycle hooks. They just need to iterate over the domains array rather than reading from a single flat state object.

---

## MVP Recommendation for v3.0 Phase Structure

**Phase 1: Domain data model + store refactor**
- WorkloadDomain interface + factory function in engine/types.ts
- inputStore refactored: flat fields replaced by `domains: WorkloadDomain[]` + `management: ManagementConfig`
- calculationStore: per-domain computed array + aggregate totals
- useUrlState: AppStateSchema with domains array
- All existing engine tests still pass (engines are called per-domain with same signatures)

**Phase 2: Tab UI**
- Domain tab strip with add/remove/rename
- Existing input components rendered inside active domain tab
- Management domain section (separate, not a tab)

**Phase 3: Results + aggregate panel**
- Per-domain results shown in active tab
- Aggregate totals panel (total hosts)
- Per-domain validation warnings

**Phase 4: Export refactor**
- Markdown: per-domain sections + aggregate overview
- PPTX: per-domain slides + aggregate summary slide

Defer:
- Domain duplication (copy): can be added in Phase 2 cleanup or post-v3.0
- Drag-to-reorder tabs: post-v3.0

---

## Sources

- [Tabs, Used Right — Nielsen Norman Group](https://www.nngroup.com/articles/tabs-used-right/)
- [Tabs UX: Best Practices — Eleken](https://www.eleken.co/blog-posts/tabs-ux)
- [Dynamic Tabs in React (URL params strategy) — remix-run/react-router discussion #11040](https://github.com/remix-run/react-router/discussions/11040)
- [Workload Domains in VMware Cloud Foundation — Broadcom TechDocs](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-5-2-and-earlier/5-1/getting-started-with-vcf-5-1/cloud-foundation-architecture/workload-domains-in-vmware-cloud-foundation.html)
- [Architecture Models and Workload Domain Types — Broadcom TechDocs](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-5-2-and-earlier/5-2/vcf-design-5-2/vmware-cloud-foundation-concepts/vmware-cloud-foundation-architecture-models.html)
- [Nutanix Sizer Overview — Read the Docs](https://sizing-workshop.readthedocs.io/en/latest/sizer/overview/overview.html)
- [Delete with Additional Confirmation — Cloudscape Design System](https://cloudscape.design/patterns/resource-management/delete/delete-with-additional-confirmation/)
- [How to Design Destructive Actions That Prevent Data Loss — UX Movement](https://uxmovement.com/buttons/how-to-design-destructive-actions-that-prevent-data-loss/)
- [Tabs Overflow — Spectrum Web Components (Adobe)](https://opensource.adobe.com/spectrum-web-components/components/tabs-overflow/)
- [Double-click tab rename — cmux GitHub issue #1654](https://github.com/manaflow-ai/cmux/issues/1654)
- [Inline tab rename — pgadmin4 GitHub issue #8896](https://github.com/pgadmin-org/pgadmin4/issues/8896)
