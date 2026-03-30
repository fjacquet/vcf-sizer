# Feature Research

**Domain:** VCF 9.x sizing calculator — Milestone v3.1: Sizing Correctness & Guided Workflow
**Researched:** 2026-03-30
**Confidence:** MEDIUM (wizard UX: HIGH from multiple sources; VCF sizing order: MEDIUM from official docs; colocated overhead: LOW — no VCF 9 authoritative spec found)

---

## Context: This Is a Subsequent Milestone

The v3.0 multi-domain foundation is complete. This research targets the three new capability clusters introduced in v3.1:

1. Guided 3-step wizard UX (Topology → Management → Workloads)
2. Calculation order fix: management-first sizing
3. Colocated mode: management overhead absorbed into WLD-1 cluster

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must be present for the wizard to feel correct and trustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent step indicator (3 steps numbered) | Users need to see total steps and current position at all times; this is universal wizard UX | LOW | Horizontal layout preferred for 3-step desktop flows; show step number + label |
| Step labels that describe content | "Step 1" alone is insufficient; labels like "Topology", "Management", "Workloads" reduce cognitive load | LOW | Already defined in milestone scope |
| Completed-step visual differentiation | Checkmark or filled icon for done steps vs current vs future; industry standard since Material Design | LOW | Three states: completed, active, upcoming |
| Forward/back navigation on every step | Blocking back navigation increases anxiety and form abandonment; all tested patterns include back | LOW | Back must not lose data entered in previous steps |
| Per-step validation before advancing | Advancing with invalid data causes confusing downstream errors; users expect inline blocking | MEDIUM | Only block advance, never block back; show inline error summary |
| Data persistence across step transitions | Users expect entered values to survive navigation between steps; loss is experienced as a bug | LOW | Already handled by Pinia store; wizard just controls visibility |
| Clear "finish" entry point to results | After step 3 (Workloads), the existing results view must be immediately accessible | LOW | Current tab UI becomes the results view; wizard wraps it |
| Step state NOT persisted in shareable URL | Wizard position is ephemeral UI state, not configuration data; URL encodes domain config only | MEDIUM | activeTabIndex exclusion precedent already set in v3.0 |

### Differentiators (Competitive Advantage)

Features that make the sizing wizard authoritative rather than generic.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Domain-aware step ordering (Topology → Mgmt → Workloads) | Mirrors the actual VCF deployment sequence; forces correct design thinking; differentiates from generic calculators | MEDIUM | This is the core v3.1 thesis: wizard enforces correct mental model |
| Management-first result display before workload entry | Users see management overhead committed before they add workload domains; builds confidence in total | MEDIUM | Show management DomainResultCard at end of step 2 |
| Step 2 summary panel showing management overhead committed | At step 3, display a collapsed summary of management resource commitment as context for workload sizing | MEDIUM | Prevents "where did those hosts go?" confusion |
| Colocated mode: automatic overhead absorption into WLD-1 | When colocated, no separate management hosts are procured; engine adds mgmt vCPU/RAM to WLD-1 sizing | HIGH | Core correctness fix; most complex engine change in v3.1 |
| Aggregate totals recalculated after management-first pass | Procurement total = mgmt hosts (dedicated) OR workload hosts with overhead (colocated); accurate BOM | MEDIUM | Currently the aggregate double-counts or ignores mgmt overhead |
| Validation warning when colocated minimum hosts are insufficient | Colocated requires >= 3 hosts (vSAN) or >= 2 (FC/NFS); must accommodate management overhead | MEDIUM | Already partially implemented; needs colocated-overhead-aware recalculation |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Non-linear step navigation (click any step from indicator) | Power users want to jump between sections quickly | Breaks the management-first design sequence that is the core correctness guarantee of v3.1; users would re-order topology after sizing management | Allow back navigation freely; keep forward navigation linear with validation |
| Saving wizard progress to localStorage | Some users request "resume later" | Adds implementation complexity; URL sharing (lz-string) already covers the use case; localStorage has stale-state risk | URL sharing already provides shareable state; document it clearly |
| Animated step transitions (slide/fade effects) | Modern aesthetic appeal | Adds CSS complexity for zero correctness value; increases perceived latency for users iterating on sizing numbers | Instant transitions; focus on validation feedback animations instead |
| Wizard-only mode that hides the full tab UI forever | Simplicity request | Power users (cloud architects, VI admins) need direct access to the multi-domain tab UI for complex scenarios; wizard should be an onboarding path, not a prison | Wizard as default entry point; "advanced mode" or "edit directly" escape hatch to full tab UI |
| Per-step separate URLs (route-based wizard) | Clean browser history | Requires Vue Router integration; adds significant router config for no functional benefit; back button behavior becomes ambiguous | Internal component state drives step; URL encodes domain data only, not UI step |

---

## Feature Dependencies

```
[Step 1: Topology Selection]
    └──gates──> [Step 2: Management Domain Design]
                    └──gates──> [Step 3: Workload Domains + Export]
                                    └──requires──> [Aggregate Totals (management-first)]

[Management-First Engine Fix]
    └──enables──> [Colocated Overhead Absorption into WLD-1]
    └──enables──> [Correct Aggregate Totals]
    └──enables──> [Accurate Export (Markdown + PPTX)]

[Colocated Architecture Toggle] (already built)
    └──drives──> [Colocated Overhead Engine Logic] (new in v3.1)
    └──drives──> [Colocated Minimum Host Validation] (already built, needs update)

[Step 2 Completion]
    └──unlocks──> [Management DomainResultCard display]

[Step 3 = Current Tab UI]
    └──requires──> [No structural change to per-domain input forms]
    └──requires──> [No change to DomainResultCard or AggregateTotalsCard]
```

### Dependency Notes

- **Wizard step gating requires management engine fix first:** The step 2 to 3 gate is only meaningful if management sizing is calculated independently of workload domains. Engine fix must land before wizard step 2 validation is meaningful.
- **Colocated overhead requires management-first pass:** To know how much overhead to absorb into WLD-1, the engine must calculate management vCPU/RAM first, then pass that delta into WLD-1's host sizing function.
- **Export accuracy depends on engine fix:** Markdown and PPTX exports inherit from calculationStore; once engine is correct, exports are automatically correct (no separate export work required for v3.1 correctness).
- **Step 3 = existing UI:** The workload domain tab UI built in v3.0 becomes the content of step 3 unchanged. Wizard is a wrapper, not a replacement.

---

## MVP Definition for v3.1

### Launch With (v3.1)

Minimum feature set to deliver the stated milestone goal.

- [ ] 3-step wizard component with horizontal step indicator (numbered + labeled) — required to enforce management-first sequence
- [ ] Step 1 (Topology): deployment model selector (Simple / HA / Stretch / vSAN Max) — currently in inputStore, needs to be surfaced as dedicated step
- [ ] Step 2 (Management): management domain host specs + architecture toggle (dedicated/colocated) — already built; wrap in step 2 container
- [ ] Step 2 to Step 3 gate: management sizing must be complete (host count >= minimum) before advancing
- [ ] Management DomainResultCard displayed at end of Step 2 — gives user immediate feedback on management overhead committed
- [ ] Step 3 (Workloads + Export): existing workload domain tab UI unchanged
- [ ] Engine fix: management vCPU/RAM calculated independently, aggregate = mgmt hosts + workload hosts (dedicated) OR colocated absorption into WLD-1
- [ ] Colocated overhead absorption: when architectureMode is colocated, engine adds management component vCPU/RAM to WLD-1 required resources before computing WLD-1 host count
- [ ] Aggregate totals: recomputed after management-first engine fix reflects correct procurement total
- [ ] Back navigation: step 3 to step 2 to step 1 without data loss

### Add After Validation (v3.1.x)

- [ ] Step 2 summary panel collapsed at top of step 3 showing committed management resources — adds clarity but not correctness
- [ ] Step indicator "click to revisit completed step" navigation — convenience for power users
- [ ] Wizard intro/landing view ("Start Sizing" CTA) — only if user research shows confusion at cold start

### Future Consideration (v4+)

- [ ] Guided tooltips and contextual help overlays per step — reduces cold-start friction for less experienced users
- [ ] Wizard state exportable as "project file" (JSON download) — complementary to URL sharing for very large domain configs

---

## VCF 9.x Sizing Order: What the Docs Say

### Official Sizing Sequence (MEDIUM confidence)

Source: Broadcom TechDocs, VMware Cloud Foundation blog posts, community deployment guides.

**The management domain is always deployed and sized first.** This is architecturally mandated:

> "Each VCF instance is configured with a single management domain which is used to house VCF core management components which includes a SDDC Manager appliance. After the management domain is created, you can deploy or import workload domains."
> — VMware Cloud Foundation blog, July 2025

**Sizing order implications for the engine:**

1. Size management domain hosts first (vCenter + NSX Manager + SDDC Manager + VCF Operations + VCF Automation)
2. Determine architecture mode (dedicated vs. colocated)
3. If dedicated: management cluster is a separate procurement line item; workload domains are sized independently
4. If colocated: management VMs run on the same cluster as WLD-1; WLD-1 host count must accommodate both management overhead AND workload VMs

### Management Domain Component Overhead (MEDIUM confidence)

Source: William Lam's lab deployment guide (June 2025) — non-official but widely cited, cross-referenced with the "What Does It Take to Run VCF 9?" production sizing article.

**Simple (single-node) deployment — minimum viable:**

| Component | vCPU | RAM |
|-----------|------|-----|
| vCenter Server | 4 | 21 GB |
| NSX Manager | 6 | 24 GB |
| SDDC Manager | 4 | 16 GB |
| VCF Operations | 4 | 16 GB |
| VCF Operations Fleet Manager | 4 | 12 GB |
| VCF Operations Collector | 4 | 16 GB |
| VCF Automation | 24 | 96 GB |
| **Total (simple)** | **48** | **194 GB** |

**HA (three-node) deployment — production:**

NSX Manager, VCF Operations, and VCF Automation each deploy as 3-node clusters. The existing inputStore already models the HA multiplier (x3) for NSX Manager, VCF Operations, and VCF Automation. This is confirmed correct per the PROJECT.md validated requirements.

**Production-grade sizing (4-node management cluster):**

A full production management domain runs approximately 25 VMs consuming 234 vCPUs and 825 GB RAM allocated across the cluster, including HA appliances, NSX Edge nodes, Identity Broker, and additional operational tools beyond the minimal 7-component stack.

### Colocated Mode: Overhead Absorption (LOW confidence — no official formula found)

**What is established:**

- VCF 9 dropped the term "Consolidated Architecture" (used in VCF 4.x/5.x) to reduce confusion, but running management and workload VMs on the same cluster is supported
- In colocated mode, resource pools provide isolation between management VMs and workload VMs
- Minimum host count for colocated: 3 (vSAN) or 2 (FC/NFS) — already implemented in the tool per validated requirements

**What the engine should do (derived from architectural logic, not an official formula):**

When architectureMode is colocated:

1. Calculate management component vCPU total (simple or HA mode — uses existing component table in engine)
2. Calculate management component RAM total
3. Add these values to WLD-1's required vCPU and required RAM before computing WLD-1 host count
4. WLD-1 host count drives the management cluster count (same physical hosts)
5. Aggregate totals: total hosts = WLD-1 hosts (which already includes management overhead) + WLD-2..N hosts

**Risk:** No official Broadcom document for VCF 9 specifies this calculation formula explicitly. The existing tool already has the HA multiplier and component vCPU/RAM values in the engine. The absorption logic is the missing architectural link and must be designed by the requirements author based on engineering reasoning.

**Recommended approach for requirements:** Define a `managementOverheadVcpu` and `managementOverheadRamGb` computed value in the engine (or calculationStore), then pass it into the WLD-1 sizing function as an additive overhead parameter when architectureMode is colocated.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 3-step wizard component with step indicator | HIGH | LOW | P1 |
| Per-step data persistence (no loss on back/next) | HIGH | LOW (already in Pinia) | P1 |
| Step 2 to 3 gate: management sizing required | HIGH | LOW | P1 |
| Management-first engine calculation order | HIGH | MEDIUM | P1 |
| Colocated overhead absorption into WLD-1 | HIGH | HIGH | P1 |
| Aggregate totals recalculated (correct) | HIGH | MEDIUM | P1 |
| Management DomainResultCard at step 2 | MEDIUM | LOW (card already exists) | P1 |
| Back navigation without data loss | HIGH | LOW | P1 |
| Per-step validation blocking forward advance | MEDIUM | MEDIUM | P1 |
| Step 2 summary panel in step 3 | MEDIUM | LOW | P2 |
| Completed-step click-to-revisit | LOW | LOW | P2 |
| Wizard intro/landing page | LOW | MEDIUM | P3 |
| Animated transitions | LOW | MEDIUM | P3 |

---

## Competitor Feature Analysis

| Feature | Generic Sizing Tools | Broadcom VCF Fleet Planning Sizer | This Tool (VCF Sizer) |
|---------|---------------------|----------------------------------|----------------------|
| Guided wizard flow | Most use flat forms | No wizard; spreadsheet-based | New in v3.1 |
| Management-first sizing order | Not enforced | Manual user responsibility | Enforced by step gating in v3.1 |
| Colocated overhead auto-absorption | Not available | Manual calculation | New in v3.1 engine fix |
| Multi-language (FR/EN/DE/IT) | Typically EN only | EN only | Already shipped |
| Client-side / offline capable | Requires server | Cloud-hosted | Static SPA |
| Shareable URL with full state | Rare | Not available | Already shipped (lz-string) |
| Export (Markdown, PDF, PPTX) | PDF at most | Spreadsheet export | Already shipped |

Note: The Broadcom VCF Fleet Planning Sizer at sizer.vmtechie.blog is a community tool, not the official Broadcom sizer. The official Broadcom sizer requires a Broadcom account and is not publicly accessible for evaluation.

---

## Sources

- [Management Domain Model — Broadcom TechDocs VCF 9.0](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/design/design-library/workload-domain-deployment-models/management-domain-deployment-model.html) — MEDIUM confidence (official doc)
- [Planning a Successful VCF 9.0 Deployment — VMware Cloud Foundation Blog, July 2025](https://blogs.vmware.com/cloud-foundation/2025/07/28/planning-a-successful-vmware-cloud-foundation-9-0-deployment/) — MEDIUM confidence
- [Deployment Pathways for VMware Cloud Foundation 9 — VMware Blog, July 2025](https://blogs.vmware.com/cloud-foundation/2025/07/03/vcf-9-0-deployment-pathways/) — MEDIUM confidence
- [Minimal Resources for Deploying VCF 9.0 in a Lab — William Lam, June 2025](https://williamlam.com/2025/06/minimal-resources-for-deploying-vcf-9-0-in-a-lab.html) — MEDIUM confidence (community, widely cited)
- [What Does It Take to Run VCF 9? — WEI Blog](https://www.wei.com/blog/what-does-it-take-to-run-vcf-9/) — LOW confidence (vendor blog, production spec)
- [Minimum Number of ESXi Hosts — Broadcom KB 392993](https://knowledge.broadcom.com/external/article/392993/minimum-number-of-esxi-hosts-required-on.html) — HIGH confidence (official KB)
- [Sizing Compute Resources for ESXi for the Management Domain — Broadcom TechDocs VCF 4.5](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-5-2-and-earlier/4-5/vcf-design-management-domain-4-5/vcf-esxi-design/vcf-deployment-specification-for-esxi/vcf-physical-design-for-esxi.html) — MEDIUM confidence (VCF 4.5, not VCF 9 — architectural patterns still applicable)
- [Wizard UI Pattern: When to Use It and How to Get It Right — Eleken](https://www.eleken.co/blog-posts/wizard-ui-pattern-explained) — HIGH confidence
- [Best Practices for High-Conversion Wizard UI Design — Lollypop Design, January 2026](https://lollypop.design/blog/2026/january/wizard-ui-design/) — HIGH confidence
- [Beyond the Progress Bar: The Art of Stepper UI Design — David Pham, February 2026](https://medium.com/@david.pham_1649/beyond-the-progress-bar-the-art-of-stepper-ui-design-cfa270a8e862) — HIGH confidence
- [Tailwind CSS Stepper — Flowbite](https://flowbite.com/docs/components/stepper/) — HIGH confidence (implementation reference)
- [Stepper Components — Origin UI Vue](https://www.originui-vue.com/stepper) — HIGH confidence (Tailwind + Vue 3 reference)

---

*Feature research for: VCF 9.x sizing calculator — v3.1 Guided Workflow & Sizing Correctness*
*Researched: 2026-03-30*
