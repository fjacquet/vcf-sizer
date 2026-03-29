# Feature Research

**Domain:** Infrastructure sizing calculator — VMware Cloud Foundation 9.x on-premises deployments
**Researched:** 2026-03-28 (v1.0), updated 2026-03-29 (v2.0 milestone additions)
**Confidence:** HIGH (management domain specs), MEDIUM (GPU/AI workload features), HIGH (storage calculations), HIGH (vSAN Max profiles), HIGH (stretch networking), MEDIUM (architecture host minimums — confirmed 4 mgmt, 3 WLD but terminology has evolved in VCF 9)

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

## v2.0 Milestone — Architecture Correctness Additions

This section documents the four new feature areas added in v2.0, with verified specifications.

---

### 1. vSAN Max Disaggregated Storage Cluster Sizing

**What vSAN Max is:** A storage-only cluster (previously called "vSAN Max," now formally called "vSAN Storage Cluster" in VCF 9.x). Uses vSAN ESA on dedicated storage-only hosts; compute hosts connect to the vSAN datastore over the network without running local vSAN storage. This decouples storage scale-out from compute scale-out.

**Key distinction from vSAN ESA HCI:** In HCI mode, every host both runs VMs and contributes storage. In vSAN Max mode, storage hosts run no VMs — they only serve storage. Compute hosts are standard vSphere hosts with no vSAN requirement (only vSphere HCL compliance needed).

#### vSAN Max ReadyNode Profiles — Current Specifications

Profiles are named `vSAN-SC-<size>` (SC = Storage Cluster). The November 2025 update reduced CPU and RAM minimums significantly. The values below represent the **post-November 2025 minimums** based on verified Broadcom blog content.

| Profile | Min Cores/host | Min RAM/host | Min NVMe drives | Min raw capacity/host | Network | Min cluster hosts | Notes |
|---------|---------------|-------------|----------------|----------------------|---------|------------------|-------|
| vSAN-SC-XS (Extra Small) | 24 | 128 GB | 2 | 20 TB | 10 GbE | 4 | Lowest entry point; 10 GbE acceptable but 25 GbE recommended for greenfield |
| vSAN-SC-SM (Small) | 32 | 384 GB | 4 | 50 TB | 25 GbE | 4 | RAID-5 capable at 4 hosts minimum |
| vSAN-SC-MED (Medium) | 40 | 512 GB | unspecified | 100 TB | 100 GbE | 4–6 | RAID-6 recommended at 6+ hosts |
| vSAN-SC-LRG (Large) | 48 | 768 GB | unspecified | 150 TB | 100 GbE | 4–6 | High-density storage; 100 GbE mandatory |
| vSAN-SC-XL (Extra Large) | 64 | 1 TB | unspecified | 200 TB (up to 360 TB) | 100 GbE | 4–6 | Maximum density; 360 TB/host at max NVMe config |

**Confidence:** MEDIUM. The XS, SM, MED, LRG, XL naming and the XS/SM/LRG/XL core+RAM+capacity numbers are confirmed by multiple Broadcom blog sources (March 2024 + November 2025 update). The MED exact NVMe count and the LRG/XL NVMe counts are not published in the blog posts reviewed — the canonical source is the Broadcom vSAN ESA ReadyNode Hardware Guidance at `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance`. The XS 128 GB RAM minimum is inferred from the November 2025 statement of "as little as 16 cores and 128GB of RAM" for a storage cluster host; this should be verified against the compatibility guide before encoding as a hard constant.

**Important note on profile naming evolution:**
- The original (2023) names were `vSAN-SC-XS`, `vSAN-SC-SM`, `vSAN-SC-Med`, `vSAN-SC-LRG`, `vSAN-SC-XL`
- The March 2024 blog used `vSAN-Max-XS/SM/MED/LRG/XL`
- The November 2025 blog consolidated to three profiles for vSAN storage clusters: `vSAN-SC-SM`, `vSAN-SC-MED`, `vSAN-SC-LRG` (removing XS and XL for HCI, but XS and XL remain for storage clusters per the March 2024 blog still referenced)
- The canonical current list per the compatibility guide should be verified; the tool should use the profile names exactly as listed in the current HCL to avoid customer confusion

#### Cluster Size Constraints

| Constraint | Value | Source confidence |
|-----------|-------|------------------|
| Minimum hosts (RAID-5, 4-host support on XS/SM) | 4 | HIGH — confirmed in multiple Broadcom sources |
| Minimum hosts for RAID-6 | 6 | HIGH — standard vSAN ESA rule |
| Recommended maximum hosts (single rack) | 16 | HIGH — confirmed in design guide |
| Maximum hosts with datastore sharing | 32 (storage) + 96 (compute) = 128 total | MEDIUM — from 2024 design guidance |

#### RAM Scaling with NVMe Drive Count

vSAN consumes additional memory for each claimed storage device. The following minimums apply for storage cluster hosts:

| NVMe drive count | Minimum RAM |
|-----------------|-------------|
| 2 (XS baseline) | 128 GB |
| 4 (SM baseline) | 384 GB |
| 18 | 192 GB (minimum; more drives need more RAM) |
| 24 (maximum supported) | 256 GB (minimum) |

**Note:** These memory/NVMe ratios are sourced from the November 2025 Broadcom blog. The exact per-drive RAM overhead constant is not published — for the sizing calculator, use the profile minimums as conservative lower bounds.

#### vSAN Max Sizing Workflow (How It Differs from HCI)

| Step | vSAN ESA HCI | vSAN Max (Storage Cluster) |
|------|-------------|---------------------------|
| 1. Determine workload storage needs | Per cluster — each cluster sizes independently | Aggregate across all consuming compute clusters — one pool serves many |
| 2. Choose FTT policy | RAID-5 (4 hosts min) or RAID-6 (6 hosts min), per cluster | Same RAID rules, but applied once for the shared pool |
| 3. Select ReadyNode profile | vSAN-HCI-SM/MED/LRG based on IOPS + capacity | vSAN-SC-XS/SM/MED/LRG/XL based on capacity density target |
| 4. Size compute hosts | Compute AND storage per host | Compute hosts need only vSphere HCL compliance — no vSAN requirement |
| 5. Validate networking | 25 GbE+ per host recommended | Same for storage cluster hosts; compute hosts need network path to storage cluster |
| 6. Output | Host count covering both compute and storage | Two separate host counts: storage cluster hosts + compute cluster hosts |

**Key sizing principle for the calculator:** For vSAN Max, the tool needs two separate sizing sections: one for the storage cluster (ReadyNode profile selection, capacity sizing, RAID policy) and one for compute hosts (only vCPU/RAM sizing, no vSAN storage constraints). The storage cluster output is total raw TB, FTT policy, and usable TB. The compute output is host count based only on compute headroom.

---

### 2. Standard vs. Consolidated Architecture Host Minimums

#### Terminology Note

In VCF 9.0, the terms "Standard Architecture" and "Consolidated Architecture" are **no longer the official terminology**. Broadcom deprecated the terms because they caused confusion. The functional distinction still exists but is described differently:

- **Dedicated domains topology** (previously "Standard"): Separate management domain cluster + one or more workload domain clusters. Management components run exclusively on management domain hosts.
- **Co-located topology** (previously "Consolidated"): Management VMs and workload VMs share the same cluster. Isolation is via vSphere resource pools, not separate clusters. VCF 9 supports this as a deployment option.

For the sizing calculator, using the terms **"Dedicated Domains"** and **"Co-located"** is more aligned with VCF 9 documentation. However, the underlying host counts are the functional requirement.

#### Host Minimums

| Architecture | Management Domain | Workload Domain | Total minimum | Storage type |
|-------------|-----------------|-----------------|---------------|-------------|
| Dedicated Domains (separate clusters) — vSAN | 4 hosts minimum | 3 hosts minimum | 7 hosts | vSAN on both |
| Dedicated Domains (separate clusters) — external storage | 2 hosts minimum | 2 hosts minimum | 4 hosts | NFS/FC |
| Co-located (single cluster) — vSAN | 3 hosts minimum (4 recommended) | — (same cluster) | 3–4 hosts | vSAN |
| Co-located (single cluster) — external storage | 2 hosts minimum | — (same cluster) | 2 hosts | NFS/FC |
| Stretch (each site) | 4 hosts/site minimum for management domain | 3 hosts/site minimum | 8 mgmt + 6 WLD + 1 witness | vSAN |

**Confidence for management domain 4-host minimum:** HIGH. Confirmed by:
- Broadcom KB 392993: "Minimum number of ESXi hosts required on vSAN clusters for deployment of VCF Management Domain" — explicitly states "4 x ESXi hosts" for Single Availability Zone
- Multiple community sources and deployment pathway blogs confirm 4 hosts for management domain with vSAN
- Rationale: 3-host management cluster cannot sustain a host going into maintenance mode without losing vSAN quorum; the 4th host provides this headroom

**Confidence for workload domain 3-host minimum:** MEDIUM. Multiple sources indicate 3 vSAN hosts as minimum for a workload domain, but the exact number is not explicitly stated in a single authoritative source reviewed. The import pathway allows 3 vSAN hosts minimum.

**Why this matters for the sizing calculator:**

The tool currently models a single pool of hosts. For the v2.0 architecture correction:
- When "Dedicated Domains" is selected, enforce: management cluster ≥ 4 hosts (vSAN) or ≥ 2 hosts (external), workload cluster ≥ 3 hosts (vSAN) or ≥ 2 hosts (external)
- When "Co-located" is selected, enforce: cluster ≥ 3 hosts (vSAN) or ≥ 2 hosts (external)
- Display total host count as management + workload separately in Dedicated Domains mode
- Surface warning when user selects Dedicated Domains but enters fewer than 4 management hosts

---

### 3. Stretch Network Checklist — Confirmed Requirements

These are the **confirmed VCF 9.x stretch cluster networking requirements** based on multiple official and community sources. All values are consistent across sources.

#### Confirmed Values

| Requirement | Value | Validation action | Confidence |
|------------|-------|------------------|-----------|
| Site-to-site RTT (vSAN data replication) | < 5 ms RTT | Hard error if exceeded; vSAN will not function reliably | HIGH — confirmed in VCF 9.0 official docs + multiple sources |
| Site-to-witness RTT (up to 10 hosts/site) | < 200 ms RTT | Warning threshold; vSAN witness operation degrades above this | HIGH — confirmed across multiple authoritative sources |
| Site-to-witness RTT (11–15 hosts/site) | < 100 ms RTT | Stricter for larger clusters | HIGH |
| Site-to-witness RTT (1 host/site — lab only) | < 500 ms RTT | Lab/POC only; not production | MEDIUM |
| Minimum ISL bandwidth (site-to-site) | 10 Gbps | Hard floor; 25 Gbps recommended for production | HIGH — confirmed in bandwidth guide and eric sloof VCF 9.0 article |
| MTU for vSAN traffic | 9000 (jumbo frames) | Checklist item; not enforced by VCF installer but required for health check pass | HIGH — Broadcom KB 317670 and multiple sources confirm 9000 MTU required for vSAN health check to pass |
| Witness bandwidth minimum | 2 Mbps per 1000 components | Separate from ISL; much lower requirement | MEDIUM |
| Minimum hosts per data site | 3 (workload), 4 (management) | Applies independently per site | HIGH |

#### MTU Nuance

The 9000 MTU requirement applies to the vSAN vmkernel network end-to-end. The witness host typically sits at a third site and often cannot reach 9000 MTU end-to-end. VMware documents a mitigation: separate witness traffic to a dedicated VMkernel with 1500 MTU. This means the 9000 MTU requirement applies to the inter-site data link, not the site-to-witness link. The checklist in the sizing tool should surface this distinction clearly.

#### Stretch Network Checklist Items for UI

Display as a checklist when Stretch mode is selected:

1. Inter-site link MTU configured to 9000 (jumbo frames) on all switches and vSAN VMkernel ports
2. Site-to-site RTT measured and confirmed < 5 ms (not just provisioned — measured under load)
3. Inter-site link bandwidth >= 10 Gbps (25 Gbps recommended for production)
4. Witness site reachable from both data sites with RTT < 200 ms
5. Witness traffic VMkernel separated from vSAN traffic if witness link MTU < 9000
6. Redundant inter-site links (single link = single point of failure)

---

### 4. Bandwidth Floor — 10 Gbps Minimum for Stretch

This is the quantitative enforcement required in the UI, separate from the checklist.

**Rule:** When stretch cluster mode is active, the ISL bandwidth input must be validated against a 10 Gbps floor. Below 10 Gbps, the tool should:
- Display a blocking error: "Inter-site link bandwidth is below the 10 Gbps minimum required for vSAN stretch cluster operation"
- Prevent the ISL adequacy calculation from showing GREEN even if the formula-derived required bandwidth is lower than the physical link

**Why a separate floor matters:** The formula `Wb × 1.4 × 1.25 × CR` calculates required bandwidth for the current workload. At low write IOPS, this formula may produce a number below 10 Gbps. The 10 Gbps minimum is a hard floor independent of workload — it is the link capacity minimum, not the utilization minimum. A link provisioned at 8 Gbps would be non-compliant even if current workload only generates 3 Gbps of replication traffic.

**Source confirmation:** HIGH confidence. Stated in the Lubomir Tobek bandwidth sizing article (VCF 9.0), the Eric Sloof complete guide (VCF 9.0), and consistent with historical vSAN stretch cluster guidance.

---

## Feature Dependencies

```
[Deployment Model Selection]
    └──required by──> [Management Domain Baseline Calculation]
                          └──required by──> [Total Resource Calculation]
                                               └──required by──> [Host Count Recommendation]

[Architecture Model Selection (Dedicated Domains / Co-located)]
    └──modifies──> [Management Domain Host Minimum]   (4 for Dedicated/vSAN, 3 for Co-located/vSAN)
    └──modifies──> [Workload Domain Host Minimum]     (3 for Dedicated/vSAN, N/A for Co-located)
    └──modifies──> [Total Host Count Display]          (separate counts for Dedicated, single count for Co-located)

[Physical Host Specification]
    └──required by──> [Host Count Recommendation]
    └──required by──> [NVMe Memory Tiering Calculation]
    └──required by──> [Min-Cores Warning]

[Storage Type Selection]
    └──required by──> [vSAN FTT Policy Selector]      (only visible if vSAN selected)
    └──required by──> [Global Dedup Toggle]            (only visible if vSAN ESA selected)
    └──required by──> [Stretch Cluster vSAN inputs]    (only visible if vSAN selected)
    └──required by──> [vSAN Max Section]               (only visible if vSAN Max selected)

[vSAN Max Storage Cluster Toggle]
    └──exposes──> [ReadyNode Profile Selector] (XS/SM/MED/LRG/XL)
    └──exposes──> [Storage Cluster Capacity Target]
    └──exposes──> [Compute Cluster Section]    (separate from storage cluster)
    └──requires──> [FTT Policy]                (RAID-5 or RAID-6)
    └──outputs──> [Storage cluster host count]
    └──outputs──> [Compute cluster host count] (independent of storage)

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
    └──requires──> [ISL bandwidth input ≥ 10 Gbps]     (hard floor validation)
    └──requires──> [RTT inputs]                         (< 5ms site-to-site, < 200ms to witness)
    └──exposes──> [Stretch Network Checklist]           (MTU 9000, redundant links, etc.)
    └──conflicts──> [Global Deduplication Toggle]

[Stretch ISL Bandwidth Input]
    └──hard-floor──> 10 Gbps minimum                   (block output if below this, independent of workload formula)
    └──feeds──> [Bandwidth Adequacy Formula]

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

### v2.0 Target Features (Current Milestone)

- [ ] Architecture model selector: Dedicated Domains (Standard) vs. Co-located — changes host minimum enforcement
- [ ] Management domain host minimum enforcement: 4 hosts (vSAN), 2 hosts (external), blocking error on violation
- [ ] Workload domain host minimum enforcement: 3 hosts (vSAN), 2 hosts (external)
- [ ] Stretch network checklist: surface MTU 9000, < 5ms RTT, < 200ms witness RTT, 10 Gbps ISL floor as UI checklist items
- [ ] ISL bandwidth floor: hard validation at 10 Gbps minimum (independent of workload formula result)
- [ ] vSAN Max mode: ReadyNode profile selector (XS/SM/MED/LRG/XL) with profile-specific specs
- [ ] vSAN Max sizing: separate storage cluster and compute cluster host count outputs
- [ ] vSAN Max capacity math: raw → usable with RAID-5/RAID-6 overhead applied to storage-only cluster

### Future Consideration (v3+)

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
| Architecture model selector (Dedicated/Co-located) | HIGH | LOW | P2 (v2.0) |
| Management domain host minimum enforcement | HIGH | LOW | P2 (v2.0) |
| Stretch network checklist | HIGH | LOW | P2 (v2.0) |
| ISL bandwidth floor (10 Gbps hard validation) | HIGH | LOW | P2 (v2.0) |
| vSAN Max ReadyNode profile selector | HIGH | MEDIUM | P2 (v2.0) |
| vSAN Max dual-cluster sizing output | HIGH | MEDIUM | P2 (v2.0) |
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
- P2: Should have — add in v1.x / v2.0 once core is validated
- P2 (v2.0): Specifically targeted for current v2.0 milestone
- P3: Nice to have — future consideration, v3+

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
| vSAN Max storage cluster sizing | Not covered | Partial (hardware only) | Not covered | Yes (P2, v2.0) |
| Standard vs Consolidated architecture model | Not covered | Not covered | Partial | Yes (P2, v2.0) |
| Stretch network checklist | Not covered | Not covered | Not covered | Yes (P2, v2.0) |

**Key insight:** No existing public tool combines VCF 9.x management domain sizing, NVMe Memory Tiering, ESA Global Deduplication, stretch cluster, per-component HA mode, VCF Fleet topology awareness, vSAN Max disaggregated storage, architecture model selection, and Swiss localization in a single client-side interface. This is a genuine gap.

---

## Open Research Questions (Flag for Implementation)

These items require validation against the live Broadcom compatibility guide before encoding as hard constants:

1. **vSAN-SC-XS RAM minimum:** The 128 GB figure is inferred from the November 2025 blog's "as little as 16 cores and 128GB of RAM" statement. Verify against `compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance` — this page requires authentication and could not be scraped.

2. **vSAN-SC-MED, LRG, XL NVMe drive minimums:** Blog posts do not state the NVMe count for MED/LRG/XL profiles. The tool should either not display NVMe count for these profiles or fetch from the live compatibility guide.

3. **Post-November 2025 profile lineup:** The November 2025 blog post states three profiles per type (SM/MED/LRG) but the March 2024 post defined five (XS/SM/MED/LRG/XL). Broadcom may have removed XS and XL from the program. Before implementing the profile selector, verify current active profiles in the HCL.

4. **Co-located minimum for VCF 9.0 specifically:** The 3-host minimum for a co-located deployment is confirmed for vSAN in general and for the "converge" pathway, but whether the VCF 9.0 installer enforces exactly 3 vs 4 for a net-new co-located deployment should be confirmed from the installer docs.

---

## Sources

### v1.0 Sources (Original Research)
- [William Lam — Minimal resources for deploying VCF 9.0 in a Lab](https://williamlam.com/2025/06/minimal-resources-for-deploying-vcf-9-0-in-a-lab.html) — June 2025. Component vCPU/RAM table for Simple deployment.
- [Broadcom KB 397782 — VCF Operations 9.0 Sizing Guidelines](https://knowledge.broadcom.com/external/article/397782/vcf-operations-90-sizing-guidelines.html) — official. Appliance size tiers, object/metric limits.
- [Broadcom TechDocs — NSX Manager 9.0 System Requirements](https://techdocs.broadcom.com/us/en/vmware-cis/nsx/vmware-nsx/9-0/nsx-manager-and-host-transport-node-system-requirements.html) — official. NSX sizing table (XS through XL).
- [Broadcom TechDocs — vCenter Server 9.0 Hardware Requirements](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-0/vcenter-installation-and-setup/deploying-the-vcenter-server-appliance/vcenter-server-appliance-requirements/vcenter-server-appliance-requirements.html) — official. Sizing table Tiny through XL.
- [driftar.ch — VCF 9 Appliance Sizing Information](https://www.driftar.ch/2026/02/20/vcf-9-appliance-sizing-information/) — Feb 2026. Community-verified SDDC Manager and installer specs.
- [VMware Blog — NVMe Memory Tiering Design and Sizing on VCF 9 Part 1](https://blogs.vmware.com/cloud-foundation/2025/11/04/nvme-memory-tiering-design-and-sizing-on-vmware-cloud-foundation-9-part-1/) — Nov 2025.
- [VMware Blog — Global Deduplication in vSAN ESA for VCF 9.0](https://blogs.vmware.com/cloud-foundation/2025/06/19/global-deduplication-in-vsan-esa-for-vmware-cloud-foundation-9-0/) — June 2025.
- [Medium — Strategic Bandwidth Sizing for vSAN Stretched Clusters in VCF 9.0](https://medium.com/@lubomir-tobek/strategic-bandwidth-sizing-for-vsan-stretched-clusters-in-vcf-9-0-a-roadmap-to-resilience-ce55545b96a2)
- [VMware Blog — Deployment Pathways for VCF 9.0](https://blogs.vmware.com/cloud-foundation/2025/07/03/vcf-9-0-deployment-pathways/) — Simple vs. HA appliance counts.
- [mhvmw.wordpress.com — VCF 9: Simple Deployment vs HA Deployment](https://mhvmw.wordpress.com/2025/07/09/vcf-9-simple-deployment-vs-ha-deployment/) — July 2025.
- [Broadcom — vSAN ESA Capacity Overheads](https://blogs.vmware.com/cloud-foundation/2022/11/02/capacity-overheads-for-the-esa-in-vsan-8/) — RAID-5/6 overhead percentages and LFS metadata overhead.
- [VMware Blog — Planning a Successful VCF 9.0 Deployment](https://blogs.vmware.com/cloud-foundation/2025/07/28/planning-a-successful-vmware-cloud-foundation-9-0-deployment/) — July 2025. Fleet topology, management domain models.

### v2.0 Sources (Architecture Correctness + vSAN Max Research)
- [VMware Blog — ReadyNode Profiles Certified for vSAN Max](https://blogs.vmware.com/cloud-foundation/2023/10/02/readynode-profiles-certified-for-vsan-max/) — Oct 2023. Original five-profile introduction.
- [VMware Blog — Greater Flexibility with vSAN Max through Lower Hardware and Cluster Requirements](https://blogs.vmware.com/cloud-foundation/2024/03/13/greater-flexibility-with-vsan-max-through-lower-hardware-and-cluster-requirements/) — March 2024. Lowered minimums; XS at 20TB/24 cores/2 NVMe/10 GbE.
- [VMware Blog — Driving Down Storage Costs with Lower Hardware Requirements for vSAN](https://blogs.vmware.com/cloud-foundation/2025/11/14/driving-down-storage-costs-with-lower-hardware-requirements-for-vsan/) — November 2025. Further reductions; MED down to 40 cores/512 GB RAM; SM down to 32 cores/384 GB RAM.
- [Broadcom KB 392993 — Minimum number of ESXi hosts required on vSAN clusters for deployment of VCF Management Domain](https://knowledge.broadcom.com/external/article/392993/minimum-number-of-esxi-hosts-required-on.html) — Official KB. Confirms 4 hosts minimum for Single AZ, 8 hosts (4/site) for stretched management domain.
- [VMware Blog — vSAN HCI or Storage Clusters — Which Deployment Option is Right for You?](https://blogs.vmware.com/cloud-foundation/2024/01/22/vsan-hci-or-storage-clusters-which-deployment-option-is-right-for-you/) — Jan 2024. Workflow differences between HCI and disaggregated sizing.
- [ntpro.nl — VMware vSAN Stretched Clusters: A Complete Guide for VCF 9.0](https://www.ntpro.nl/blog/archives/3858-VMware-vSAN-Stretched-Clusters-A-Complete-Guide-for-VMware-Cloud-Foundation-9.0.html) — VCF 9.0 confirmed: <5ms site-to-site RTT, <200ms witness RTT, 10 Gbps min, MTU 9000.
- [Broadcom KB 317670 — VMware vSAN Network Health Check for MTU check fails in a Stretched Cluster](https://knowledge.broadcom.com/external/article/317670/vmware-vsan-network-health-check-for-mtu.html) — MTU 9000 health check requirement.
- [Broadcom TechDocs — Stretching vSAN Clusters in VMware Cloud Foundation 9.0](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/building-your-private-cloud-infrastructure/stretching-clusters.html) — Official VCF 9.0 stretch configuration docs.
- [Broadcom Community — VCF Consolidated/Standard Architecture (VCF 9 discussion)](https://community.broadcom.com/vmware-cloud-foundation/discussion/vcf-consolidatedstandard-architecure) — Confirms terminology was dropped in VCF 9; 7 hosts minimum for dedicated domains topology.
- [vSAN ESA ReadyNode Hardware Guidance](https://compatibilityguide.broadcom.com/pages/vsan-esa-readynode-hardware-guidance) — Primary authoritative source for profiles (requires authentication; not fully scraped in this research cycle).

---

*Feature research for: VCF 9.x on-premises sizing calculator*
*Researched: 2026-03-28 (v1.0), updated 2026-03-29 (v2.0 milestone)*
