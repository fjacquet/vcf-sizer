# Feature Research

**Domain:** Infrastructure sizing calculator — VMware Cloud Foundation 9.x on-premises deployments
**Researched:** 2026-03-28
**Confidence:** HIGH (management domain specs), MEDIUM (GPU/AI workload features), HIGH (storage calculations)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that cloud architects assume exist in any credible sizing tool. Missing these means architects will distrust or abandon the tool immediately.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Deployment model selector (Simple / HA / Stretch) | VCF 9 has three fundamentally different resource profiles; architects need to pick one before anything else can be calculated | LOW | Simple=single-node appliances, HA=3-node clusters, Stretch=2-site with witness |
| Physical host specification input (CPU cores/socket, sockets, total RAM, disk config) | All downstream calculations depend on knowing what hardware is available | LOW | Must capture: cores per socket, socket count, total DRAM, NVMe capacity if Memory Tiering used |
| Host minimum-cores hard warning (12 cores / 24 threads) | VCFA requires a 24 vCPU VM — this is a hard blocker. William Lam confirmed: "you MUST have a physical host that has at least 12 Cores / 24 Threads to successfully deploy VCFA." | LOW | Show blocking red warning if user enters fewer than 12 cores per host |
| Management domain baseline resource display | Architects need to know how much of their cluster is consumed by management components before sizing workloads | MEDIUM | Must be computed from deployment model selection |
| Workload profile inputs (VM count, avg vCPU, avg vRAM, storage per VM) | Without workload data there is nothing to size | LOW | Core input form; should support multiple workload tiers |
| Principal storage selection (vSAN ESA / vSAN OSA / Fibre Channel / NFS) | Storage type determines overhead calculations, minimum host counts, and FTT policy options | MEDIUM | vSAN ESA and OSA have fundamentally different capacity math |
| vSAN FTT policy selector (RAID-1 FTT=1, RAID-5 FTT=1, RAID-6 FTT=2) | Different policies produce different raw-to-usable capacity ratios; this is the primary driver of storage host count | MEDIUM | RAID-5 requires 3+ hosts (ESA), RAID-6 requires 6+ hosts; overhead: RAID-5=25%, RAID-6=50% of primary data |
| Total host count recommendation (management + workload) | The primary output architects need before purchasing hardware | LOW | Must show minimum safe count (N+1 for compute, FTT+1 for storage) |
| vCPU-to-pCPU ratio input and headroom calculation | Management domain should not exceed 2:1 overcommit; workloads need an explicit ratio | LOW | Standard VCF design guideline confirmed in Broadcom docs |
| Memory headroom calculation with N+1 admission control | VCF design guidelines require reserving one host worth of RAM for failover | LOW | N+1 host failover capacity must be visible in output |
| Storage raw vs. usable capacity visualization | Architects present this number to procurement; showing raw without overhead is misleading | MEDIUM | Must account for: FTT policy overhead + vSAN metadata (~13% LFS overhead) |
| Real-time calculation (no submit button) | Modern UX expectation — results update as inputs change | LOW | Reactive computation; debounce heavy calculations |
| Shareable configuration URL | Architects share sizing results with colleagues and customers; a URL is the lightweight alternative to an account system | LOW | Base64-encode the full state object into the URL fragment (#state=...) |
| Export to PDF or Markdown | Architects need to include sizing in design documents and proposals | MEDIUM | PDF via browser print API (window.print + print-specific CSS) or jsPDF; Markdown is a text dump |
| Multi-language support: FR, EN, DE, IT | Swiss market requirement — all four national languages; missing any one excludes a significant user segment | MEDIUM | Use vue-i18n or react-i18next; locale-aware number formatting (e.g., 1'000 vs 1,000) |
| Responsive, readable UI | Architects use laptops; the tool must be usable at 1280px width without horizontal scrolling | LOW | Tailwind CSS breakpoints cover this with minimal effort |
| Static site deployment (no backend) | Zero infrastructure cost, instant availability on GitHub Pages / Vercel / Netlify; architects distrust tools that require login | LOW | All calculations must run entirely client-side in JavaScript/TypeScript |

---

### Differentiators (VCF 9.x Competitive Advantage)

These features do not exist in the VMware Cloud Sizer (VMC-focused), vSAN ReadyNode Sizer (storage-only), or community spreadsheets. They represent the unique value of a VCF 9.x-specific tool.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| NVMe Memory Tiering toggle (ESXi 9.x) | Allows 1:1 DRAM-to-NVMe ratio when active memory stays at or below 50% of DRAM — can halve DRAM requirements. No existing public tool accounts for this. | HIGH | Input: DRAM size per host + NVMe capacity per host. Guard: warn if active workload memory > 50% DRAM. Source: VMware blog Nov 2025 — requires Class D+ endurance, Class F+ performance NVMe drives (min 3 DWPD) |
| vSAN ESA Global Deduplication toggle | VCF 9 introduces global deduplication on ESA (limited release via TQR). Changes usable-to-raw capacity ratio. Not covered in any vSAN capacity calculator. | HIGH | Limitation: incompatible with stretch clusters and data-at-rest encryption. Requires 25GbE+. Supported cluster size: 3–16 hosts. Toggle must disable stretch mode when active. |
| Stretch cluster (2-site) full sizing | VCF 9.0 introduced stretch cluster support for both vSAN HCI and storage clusters. Adds witness node overhead, cross-site bandwidth, and preferred/secondary site inputs. No public tool computes this end-to-end. | HIGH | Witness node: virtual appliance at 3rd site. Bandwidth formula: Wb × 1.4 × 1.25 × CR (CR=1.0 for OSA, 0.5 for ESA). ISL minimum: 10 Gbps / <5ms RTT. Site-to-witness: <200ms. |
| Per-component HA vs. Simple mode selection | VCF 9 allows mixing: e.g., HA NSX Manager + Simple VCF Operations. The tool should allow each component to be toggled independently, matching the actual VCF 9 installer behavior. | MEDIUM | NSX Manager: Simple=1×(6vCPU/24GB), HA=3×(6vCPU/24GB)=18vCPU/72GB. VCF Operations: Simple=1×(4vCPU/16GB), HA=3×(4vCPU/16GB)=12vCPU/48GB. VCF Automation: Simple=1×(24vCPU/96GB), HA=3×(24vCPU/96GB)=72vCPU/288GB |
| VCF Fleet topology awareness (instance-level vs. fleet-level) | VCF 9 separates fleet-level services (VCF Operations fleet manager, VCF Automation) from instance-level (vCenter, SDDC Manager, NSX Manager). The tool should correctly model whether a new management domain is the first in a fleet (includes fleet-level overhead) or an additional instance (reduced overhead). | HIGH | First instance: adds VCF Operations Fleet Manager (4vCPU/12GB) + Operations Collector (4vCPU/16GB). Additional instance: Operations Collector only. |
| AI/GPU workload node sizing | VMware Private AI Foundation with NVIDIA on VCF 9.0 — architects need to size GPU hosts alongside compute hosts. Rule: host RAM = 2–3× total GPU VRAM. Example: 4× H100 80GB = 320GB GPU VRAM → 640–960GB host RAM needed. | HIGH | Input: GPU model, GPU count per host, number of GPU hosts. Output: required host RAM, recommended vGPU profiles. Source: VMware Private AI sizing guide v9. |
| VCF Operations sizing sub-calculator | VCF Operations requires its own sizing based on object count and metric count, separate from the infrastructure sizing. The tool should derive recommended VCF Ops appliance size from workload inputs. | MEDIUM | Extra Small (2vCPU/8GB): ≤700 objects. Small (4vCPU/16GB): ≤10K objects. Medium (8vCPU/32GB): ≤30K objects. Large (16vCPU/48GB): ≤44K objects. XL (24vCPU/128GB): ≤100K objects. Source: Broadcom KB 397782 |
| vSAN OSA vs. ESA selection with capacity math differences | ESA and OSA have different RAID-5/6 minimum host requirements and different LFS overhead. No existing calculator covers both in a single interface. | MEDIUM | ESA RAID-5: minimum 3 hosts, 25% overhead + 13% LFS. ESA RAID-6: minimum 6 hosts (7 recommended), 50% overhead + 13% LFS. OSA: different disk group model, different overhead. |
| Chart visualizations (compute, memory, storage breakdown) | Visual representation of resource allocation — management overhead vs. workload headroom — makes the tool useful in customer presentations, not just spreadsheet replacement | MEDIUM | Pie/donut chart: management vs. workload vs. headroom per dimension. Bar chart: raw vs. usable storage. Use Chart.js (lightweight, no React dependency) or Recharts (if React stack chosen). |
| Swiss-locale number formatting | Swiss formatting conventions differ from both US and EU standards: 1'000.00 (apostrophe as thousands separator, period as decimal). Critical for FR-CH, DE-CH contexts. | LOW | Use Intl.NumberFormat with locale 'fr-CH', 'de-CH', 'it-CH', 'en-CH'. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features to deliberately exclude from scope, with documented rationale so they do not reappear during development.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Backend API / server-side calculation engine | "More powerful processing", "save server-side", "multi-user" | Adds hosting cost, deployment complexity, authentication surface, and latency. Destroys the zero-infrastructure value proposition. A client-side SPA on GitHub Pages has 100% uptime at zero cost. | All calculations stay in TypeScript/JavaScript in the browser. State is serialized to URL for sharing. |
| User accounts and saved sessions | "Save my sizing scenarios across devices" | Requires authentication, database, GDPR compliance, session management. Disproportionate scope for a sizing tool. | Shareable URL with base64-encoded full state covers all persistence needs without any server infrastructure. |
| vSphere 7.x / VCF 5.x support | "Backward compatibility for existing customers" | Adds a separate set of constants, minimum requirements, and logic branches. Management domain specs differ significantly between versions. Maintenance burden doubles. | Scope is explicitly VCF 9.x only. Users sizing older versions should use the VMware Cloud Foundation Capacity Planner at vcfcapacityplanner.esp.vmware.com. |
| Network topology designer / NSX segment planner | "Complete deployment planner" | Out of scope for a sizing tool. Network design requires understanding of existing routing, firewall policies, and data center topology — information a sizing calculator cannot collect meaningfully. | Reference the VMware Ports and Protocols tool and VCF Planning and Preparation Workbook for network planning. |
| Hardware vendor catalog integration (Dell, HPE, Lenovo SKU matching) | "Output a specific server model recommendation" | SKUs change quarterly; maintaining a hardware catalog requires a backend and ongoing curation. Breaks the static site model. | The tool outputs requirements (cores, RAM, NVMe capacity). Architects cross-reference with vendor configurators (Dell PowerEdge Selector, HPE QuoteBuilder). |
| RVTools / LiveOptics import | "Auto-size from existing environment scan" | Complex file parsing with unpredictable schema versions; risk of incorrect interpretation creating dangerously wrong sizing. Scope is greenfield/new deployments. | Manual workload profile inputs. For brownfield migrations, direct architects to the VMware Cloud Sizer which supports RVTools import for VMC-bound migrations. |
| License cost calculator | "Show me the TCO" | License pricing changes frequently, is deal-specific, and requires Broadcom partner portal integration. Maintenance burden is high; stale prices mislead. | Scope is resource sizing only. Reference Broadcom licensing calculator at wintelguy.com/vmware-licensing-calc.pl for cost estimation. |
| Real-time collaboration / multi-user editing | "Teams can collaborate on sizing" | Requires WebSockets, a backend, and conflict resolution. Massively disproportionate for the use case. | URL sharing is instant and stateless. One person does sizing, shares URL with the team for review. |

---

## Management Domain Components — VCF 9 Specifications

This section documents all management domain components with exact resource requirements for the Simple and HA deployment modes. These values are the core constants the sizing engine must encode.

### Per-Component Resource Table

| Component | Deployment Mode | Nodes | vCPU/node | RAM/node | Disk/node | Total vCPU | Total RAM |
|-----------|----------------|-------|-----------|----------|-----------|------------|-----------|
| vCenter Server (Small: ≤100 hosts/1K VMs) | N/A (single) | 1 | 4 | 21 GB | 734 GB | 4 | 21 GB |
| vCenter Server (Medium: ≤400 hosts/4K VMs) | N/A (single) | 1 | 8 | 30 GB | 933 GB | 8 | 30 GB |
| SDDC Manager | N/A (fixed) | 1 | 4 | 16 GB | 931 GB | 4 | 16 GB |
| NSX Manager (Medium — default production) | Simple | 1 | 6 | 24 GB | 300 GB | 6 | 24 GB |
| NSX Manager (Medium — default production) | HA | 3 | 6 | 24 GB | 300 GB | 18 | 72 GB |
| NSX Manager (Small — lab/POC only) | Simple | 1 | 4 | 16 GB | 300 GB | 4 | 16 GB |
| VCF Operations (Small) | Simple | 1 | 4 | 16 GB | 290 GB | 4 | 16 GB |
| VCF Operations (Small) | HA | 3 | 4 | 16 GB | 290 GB | 12 | 48 GB |
| VCF Operations Fleet Manager | Fleet-level (first instance only) | 1 | 4 | 12 GB | 206 GB | 4 | 12 GB |
| VCF Operations Collector | Per-instance | 1 | 4 | 16 GB | 280 GB | 4 | 16 GB |
| VCF Automation (VCFA) | Simple | 1 | 24 | 96 GB | 626 GB | 24 | 96 GB |
| VCF Automation (VCFA) | HA | 3 | 24 | 96 GB | 626 GB | 72 | 288 GB |

**Source:** William Lam minimal lab resources (June 2025), Broadcom NSX Manager system requirements (VCF 9.0), Broadcom KB 397782 VCF Operations sizing, driftar.ch VCF 9 appliance sizing (Feb 2026).

### Totals by Deployment Scenario

| Scenario | Total vCPU | Total RAM | Notes |
|----------|-----------|-----------|-------|
| Simple (Lab/POC) — first fleet instance | 48 | 194 GB | Confirmed by William Lam lab resource guide |
| HA (Production) — first fleet instance | 118 | 527 GB | Management components only; workload headroom must be added |
| HA (Production) — additional fleet instances | 34 | 143 GB | vCenter + SDDC Manager + NSX Manager HA + VCF Ops HA + Collector only (no Fleet Manager, no VCFA) |

### Critical Constraint

The VCFA VM (24 vCPU) requires a physical ESXi host with at least **12 physical cores / 24 threads**. This is a hard deployment blocker — the VCF installer will refuse to proceed if no host can schedule a 24-vCPU VM. The sizing tool must display a blocking warning if host CPU specifications do not meet this requirement.

---

## Stretch Cluster Feature Requirements

Stretch cluster is a significant standalone feature requiring its own input section in the UI.

### Inputs Required

| Input | Description | Constraints |
|-------|-------------|-------------|
| Site A name (preferred site) | Label for cross-site display | String |
| Site B name (secondary site) | Label for cross-site display | String |
| Hosts per site | Number of ESXi hosts at each data site | Minimum: 3 per site for vSAN |
| Site-to-site latency (ms RTT) | Must be < 5ms RTT for vSAN data replication | Hard validation: reject > 5ms |
| Site-to-witness latency (ms RTT) | Must be < 200ms (configurations ≤10 hosts/site) | Validation: warn > 200ms |
| ISL bandwidth available (Gbps) | Physical link capacity between sites | Minimum: 10 Gbps |
| Write workload (IOPS + I/O size) | Used for ISL bandwidth adequacy check | Optional: can default to a conservative estimate |
| vSAN architecture (ESA / OSA) | ESA applies 2:1 compression before replication, halving bandwidth needs | Affects CR multiplier: 0.5 for ESA, 1.0 for OSA |

### Outputs Required

| Output | Formula |
|--------|---------|
| Required ISL bandwidth | Wb × 1.4 (metadata) × 1.25 (resync) × CR (0.5 ESA / 1.0 OSA) |
| ISL adequacy verdict | Required vs. available — GREEN if adequate, RED if insufficient |
| Total hosts required (both sites) | 2 × (per-site host count) + 1 (witness node) |
| Witness node resource requirements | Virtual appliance; sized based on component count (see vSAN stretch cluster guide) |

### Incompatibility: Global Deduplication + Stretch Cluster

vSAN ESA Global Deduplication does **not** support stretched clusters (as of VCF 9.0 GA). The tool must enforce this mutual exclusion: enabling Global Deduplication must disable Stretch Cluster mode and vice versa.

---

## Feature Dependencies

```
[Deployment Model Selection]
    └──required by──> [Management Domain Baseline Calculation]
                          └──required by──> [Total Resource Calculation]
                                               └──required by──> [Host Count Recommendation]

[Physical Host Specification]
    └──required by──> [Host Count Recommendation]
    └──required by──> [NVMe Memory Tiering Calculation]
    └──required by──> [Min-Cores Warning]

[Storage Type Selection]
    └──required by──> [vSAN FTT Policy Selector]      (only visible if vSAN selected)
    └──required by──> [Global Dedup Toggle]            (only visible if vSAN ESA selected)
    └──required by──> [Stretch Cluster vSAN inputs]    (only visible if vSAN selected)

[NVMe Memory Tiering Toggle]
    └──requires──> [NVMe Capacity Input] (additional input exposed on toggle)
    └──modifies──> [Effective RAM per host]             (halves DRAM requirement at ≤50% active memory)

[Global Deduplication Toggle]
    └──conflicts──> [Stretch Cluster Mode]              (mutually exclusive)
    └──conflicts──> [Data-at-Rest Encryption]           (mutually exclusive per vSAN ESA limitations)
    └──requires──> [vSAN ESA selection]                 (only valid for ESA)

[Stretch Cluster Mode]
    └──requires──> [Site A + Site B host inputs]
    └──requires──> [Witness node configuration]
    └──conflicts──> [Global Deduplication Toggle]

[VCF Fleet Position (first vs. additional instance)]
    └──modifies──> [Management Domain Overhead]        (fleet manager only on first instance)

[AI/GPU Workload Input]
    └──requires──> [GPU model + count per host]
    └──outputs──> [Host RAM recommendation]
    └──outputs──> [vGPU profile recommendation]

[Chart Visualization]
    └──enhances──> [Total Resource Calculation]        (same data, visual presentation)

[Export to PDF/Markdown]
    └──requires──> [Total Resource Calculation]        (nothing to export until calculated)

[Shareable URL]
    └──requires──> [All input state]                   (must capture complete form state)
```

---

## MVP Definition

### Launch With (v1)

Minimum viable product to validate that architects trust and use the tool for real sizing work.

- [ ] Deployment model selector (Simple / HA) — without stretch cluster, which adds significant complexity
- [ ] Physical host specification input (cores, sockets, RAM)
- [ ] Host minimum-cores hard warning (12 cores / 24 threads blocker)
- [ ] Management domain baseline calculation — all components from the specifications table above, toggled by deployment model
- [ ] Per-component HA vs. Simple mode toggle for NSX, VCF Operations, VCF Automation
- [ ] VCF Fleet position selector (first instance vs. additional instance) — determines whether Fleet Manager overhead is included
- [ ] Workload profile inputs (VM count, avg vCPU, avg vRAM)
- [ ] vSAN ESA storage type with FTT policy selection (RAID-1, RAID-5, RAID-6) and capacity calculation
- [ ] FC / NFS storage type selection (disables vSAN-specific features, simplifies storage section)
- [ ] Host count recommendation (compute-bound and storage-bound, show the binding constraint)
- [ ] vCPU headroom and memory headroom display (management vs. workload vs. available)
- [ ] Shareable URL (base64 state in URL fragment)
- [ ] EN language support as default
- [ ] Responsive layout (Tailwind CSS)

### Add After Validation (v1.x)

- [ ] FR, DE, IT translations — add once core calculation is validated; wrong translation of a validated tool is better than no translation
- [ ] NVMe Memory Tiering toggle — high complexity; validate core sizing first
- [ ] vSAN ESA Global Deduplication toggle — requires TQR context explanation in UI
- [ ] Chart visualizations — enhances presentation value after accuracy is confirmed
- [ ] Export to PDF (print CSS) and Markdown
- [ ] Stretch cluster mode (2-site + witness) — significant UI and calculation complexity

### Future Consideration (v2+)

- [ ] AI/GPU workload sizing section — requires ongoing maintenance as GPU SKUs change; validate core VCF sizing first
- [ ] VCF Operations appliance size recommendation sub-calculator — useful add-on; not blocking architects from sizing infrastructure
- [ ] Additional vCenter appliance sizes (Large, XL) — relevant for large-scale multi-workload-domain deployments
- [ ] NSX Large/XL sizing for >128 hypervisor environments
- [ ] Multi-workload-domain scenario (add multiple VI domains to a single fleet)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Deployment model selector | HIGH | LOW | P1 |
| Host spec inputs | HIGH | LOW | P1 |
| Min-cores hard warning | HIGH | LOW | P1 |
| Management domain baseline | HIGH | MEDIUM | P1 |
| Per-component HA/Simple toggle | HIGH | MEDIUM | P1 |
| Fleet position selector | HIGH | LOW | P1 |
| Workload profile inputs | HIGH | LOW | P1 |
| vSAN ESA FTT + capacity math | HIGH | MEDIUM | P1 |
| Host count recommendation | HIGH | LOW | P1 |
| vCPU/RAM headroom display | HIGH | LOW | P1 |
| Shareable URL | HIGH | LOW | P1 |
| EN language support | HIGH | LOW | P1 |
| FR/DE/IT translations | HIGH | LOW | P1 |
| Chart visualizations | MEDIUM | MEDIUM | P2 |
| Export to PDF | MEDIUM | MEDIUM | P2 |
| Export to Markdown | LOW | LOW | P2 |
| NVMe Memory Tiering | MEDIUM | HIGH | P2 |
| Global Deduplication toggle | MEDIUM | HIGH | P2 |
| Stretch cluster mode | HIGH | HIGH | P2 |
| AI/GPU workload sizing | MEDIUM | HIGH | P3 |
| VCF Operations sub-calculator | LOW | MEDIUM | P3 |
| Multi-workload-domain scenario | MEDIUM | HIGH | P3 |

**Priority key:**

- P1: Must have for launch — tool is not credible without these
- P2: Should have — add in v1.x once core is validated
- P3: Nice to have — future consideration, v2+

---

## Competitor Feature Analysis

| Feature | VMware Cloud Sizer (vmc.vmware.com/sizer) | vSAN ReadyNode Sizer (vsansizer.vmware.com) | VCF Capacity Planner (vcfcapacityplanner.esp.vmware.com) | This Tool (VCF 9.x Sizer) |
|---------|------------------------------------------|---------------------------------------------|----------------------------------------------------------|---------------------------|
| VCF 9.x management domain sizing | Not covered (VMC/cloud focus) | Not covered (storage only) | Partial (may not reflect VCF 9 changes) | Full coverage |
| NVMe Memory Tiering (ESXi 9.x) | Not covered | Not covered | Not covered | Yes (P2) |
| vSAN ESA Global Deduplication | Not covered | Partial | Unclear | Yes (P2, with constraints) |
| Stretch cluster 2-site | Not covered | Partial | Unclear | Yes (P2) |
| Simple vs. HA per-component toggle | Not covered | Not covered | Unclear | Yes (P1) |
| VCF Fleet topology (first vs. additional instance) | Not covered | Not covered | Not covered | Yes (P1) |
| Shareable URL / no login | No (requires VMC account) | No (requires login) | Unclear | Yes (P1) |
| AI/GPU workload sizing | Not covered | Not covered | Not covered | Yes (P3) |
| FR/DE/IT Swiss localization | Not covered | Not covered | Not covered | Yes (P1) |
| Static site / no backend | No | No | No | Yes (core constraint) |
| RVTools import | VMC sizer supports it | No | Unclear | Anti-feature (excluded) |
| Hardware vendor SKU matching | Partial (VMC hosts) | Yes (ReadyNode catalog) | Unclear | Anti-feature (excluded) |

**Key insight:** No existing public tool combines VCF 9.x management domain sizing, NVMe Memory Tiering, ESA Global Deduplication, stretch cluster, per-component HA mode, VCF Fleet topology awareness, and Swiss localization in a single client-side interface. This is a genuine gap.

---

## Sources

- [William Lam — Minimal resources for deploying VCF 9.0 in a Lab](https://williamlam.com/2025/06/minimal-resources-for-deploying-vcf-9-0-in-a-lab.html) — June 2025. Component vCPU/RAM table for Simple deployment.
- [Broadcom KB 397782 — VCF Operations 9.0 Sizing Guidelines](https://knowledge.broadcom.com/external/article/397782/vcf-operations-90-sizing-guidelines.html) — official. Appliance size tiers, object/metric limits.
- [Broadcom TechDocs — NSX Manager 9.0 System Requirements](https://techdocs.broadcom.com/us/en/vmware-cis/nsx/vmware-nsx/9-0/nsx-manager-and-host-transport-node-system-requirements.html) — official. NSX sizing table (XS through XL).
- [Broadcom TechDocs — vCenter Server 9.0 Hardware Requirements](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-0/vcenter-installation-and-setup/deploying-the-vcenter-server-appliance/vcenter-server-appliance-requirements/vcenter-server-appliance-requirements.html) — official. Sizing table Tiny through XL.
- [driftar.ch — VCF 9 Appliance Sizing Information](https://www.driftar.ch/2026/02/20/vcf-9-appliance-sizing-information/) — Feb 2026. Community-verified SDDC Manager and installer specs.
- [VMware Blog — NVMe Memory Tiering Design and Sizing on VCF 9 Part 1](https://blogs.vmware.com/cloud-foundation/2025/11/04/nvme-memory-tiering-design-and-sizing-on-vmware-cloud-foundation-9-part-1/) — Nov 2025. NVMe prerequisites, endurance classes, 50% active memory rule.
- [VMware Blog — Global Deduplication in vSAN ESA for VCF 9.0](https://blogs.vmware.com/cloud-foundation/2025/06/19/global-deduplication-in-vsan-esa-for-vmware-cloud-foundation-9-0/) — June 2025. Constraints: no stretch, no encryption; 25GbE+; 3–16 hosts.
- [Medium — Strategic Bandwidth Sizing for vSAN Stretched Clusters in VCF 9.0](https://medium.com/@lubomir-tobek/strategic-bandwidth-sizing-for-vsan-stretched-clusters-in-vcf-9-0-a-roadmap-to-resilience-ce55545b96a2) — Bandwidth formula, ISL requirements, witness sizing.
- [VMware Blog — Deployment Pathways for VCF 9.0](https://blogs.vmware.com/cloud-foundation/2025/07/03/vcf-9-0-deployment-pathways/) — Simple vs. HA appliance counts.
- [mhvmw.wordpress.com — VCF 9: Simple Deployment vs HA Deployment](https://mhvmw.wordpress.com/2025/07/09/vcf-9-simple-deployment-vs-ha-deployment/) — July 2025. 7 appliances (Simple) vs. 13 appliances (HA).
- [Broadcom — vSAN ESA Capacity Overheads](https://blogs.vmware.com/cloud-foundation/2022/11/02/capacity-overheads-for-the-esa-in-vsan-8/) — RAID-5/6 overhead percentages and LFS metadata overhead.
- [VMware Blog — Planning a Successful VCF 9.0 Deployment](https://blogs.vmware.com/cloud-foundation/2025/07/28/planning-a-successful-vmware-cloud-foundation-9-0-deployment/) — July 2025. Fleet topology, management domain models.

---

*Feature research for: VCF 9.x on-premises sizing calculator*
*Researched: 2026-03-28*
