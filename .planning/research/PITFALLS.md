# Pitfalls Research

**Domain:** VCF 9.x Client-Side Sizing Calculator SPA (Vue 3 / React, multi-language, browser-only)
**Researched:** 2026-03-28
**Confidence:** HIGH (VCF-specific figures from official Broadcom/VMware docs; SPA patterns from verified community sources)

---

## Critical Pitfalls

### Pitfall 1: Floating-Point Arithmetic Errors in Sizing Calculations

**What goes wrong:**
JavaScript's native `Number` type uses IEEE 754 binary floating-point, which cannot exactly represent many decimal fractions. The classic `0.1 + 0.2 === 0.30000000000000004` failure surfaces in sizing tools as host counts drifting by 0.0000x, storage overhead percentages rounding incorrectly, or the NVMe tiering 50% active-memory threshold flipping the wrong direction at boundary values. A user who inputs exactly 50% active memory may see NVMe tiering enabled or disabled depending on whether the comparison is `<=` against a float that accumulated drift.

**Why it happens:**
Developers write `totalRAM * 0.5` and compare with `<=` to detect the threshold, then find that e.g. `48 * 0.5` equals `24.000000000000004` in binary float, causing off-by-epsilon logic errors. The problem is invisible during casual testing because numbers like 48 GB produce no visible drift, but workload-specific combinations (e.g. 4.3 TB storage with 1.13 deduplication ratio) expose accumulation.

**How to avoid:**
Use `decimal.js` (arbitrary-precision) or `Decimal` for all sizing arithmetic — never native `+`, `*`, `/` on floating-point inputs. For integer-bounded quantities (host counts, vCPU counts) use `Math.ceil()` on the result of a Decimal computation, not native division. Define a project-wide `Calc` wrapper that rejects raw numbers and always operates on `Decimal` instances.

**Warning signs:**

- Unit tests show values like `3.0000000000000004` for a host count
- Snapshot tests for known VCF sizing scenarios diverge after adding or removing a workload profile
- The NVMe tiering toggle flips state unexpectedly near the 50% boundary

**Phase to address:** Phase 1 (Foundation / Core Calculation Engine) — establish the Decimal-based math layer before any formula is written.

---

### Pitfall 2: vSAN ESA Adaptive RAID-5 Threshold Miscalculation

**What goes wrong:**
The tool hard-codes "RAID-5 needs minimum 4 hosts" and calculates storage overhead as always 125% (4+1 scheme). In practice, vSAN ESA uses Adaptive RAID-5: clusters of 5 or fewer hosts use the **2+1 scheme (150% overhead)**, while clusters of 6+ hosts switch to the **4+1 scheme (125% overhead)**. A calculator that ignores this threshold will under-estimate required raw capacity by 20% for small clusters, causing undersized hardware orders.

Additionally, when a 6-node cluster loses a host (or has one in maintenance), vSAN automatically downgrades from 4+1 to 2+1 after 24 hours. Sizings that do not account for the spare-host design pattern will output the wrong overhead figure.

**Why it happens:**
Older OSA documentation stated "RAID-5 FTT=1 requires 4 hosts minimum" — this is correct for OSA but wrong for ESA's 4+1 scheme. Developers copy the 4-host minimum and the 125% overhead constant without reading the ESA-specific Adaptive RAID-5 documentation.

**How to avoid:**
Implement a `raidOverhead(hostCount, ftLevel, raidType)` function with the correct ESA thresholds:

- RAID-1 FTT=1: min 3 hosts, 200% overhead (2 copies)
- RAID-5 (2+1): 3 to 5 hosts, 150% overhead
- RAID-5 (4+1): 6+ hosts, 125% overhead
- RAID-6 (4+2) FTT=2: min 6 hosts, 150% overhead
- RAID-1 FTT=2: min 5 hosts, 300% overhead

Source the thresholds from Duncan Epping's January 2024 ESA post, not the OSA guide.

**Warning signs:**

- Storage results for a 5-node cluster look the same as for a 6-node cluster
- RAID-5 overhead is always displayed as 1.25x regardless of host count
- No visual distinction between 2+1 and 4+1 in the UI

**Phase to address:** Phase 2 (Storage Calculation Module) — encode the Adaptive RAID-5 matrix in a dedicated lookup before any storage UI is built.

---

### Pitfall 3: vSAN ESA Capacity Overhead Stack Omission

**What goes wrong:**
The tool calculates "usable capacity = raw / RAID_overhead" and stops, missing two additional compulsory overheads:

1. **vSAN LFS (Log-Structured Filesystem) overhead:** approximately 13% of object + replica data written — this is not optional and does not depend on workload.
2. **Global metadata:** approximately 10% of total raw cluster capacity reserved for metadata.

Applying only the RAID overhead under-reports required raw disk capacity by roughly 20 to 25% for typical deployments.

**Why it happens:**
The LFS and metadata overheads are documented in a separate VMware blog post ("Capacity Overheads for the ESA in vSAN 8") that is less prominent than the RAID guides. Developers read the RAID guide and stop.

**How to avoid:**
The correct formula stack (sequential application):

```
1. raw_after_dedup    = raw_input x dedup_ratio            (if Global Dedup enabled)
2. data_for_raid      = raw_after_dedup
3. usable_before_lfs  = data_for_raid / raid_overhead_multiplier
4. usable_after_lfs   = usable_before_lfs x (1 - 0.13)    (LFS approx 13%)
5. global_meta_pool   = total_raw_cluster x 0.10            (metadata approx 10% of raw)
6. net_usable         = usable_after_lfs - global_meta_pool
```

Apply these as a chain of Decimal operations. Write a unit test that reproduces the worked example from the VMware ESA capacity blog.

**Warning signs:**

- Usable capacity output is suspiciously high compared to vSAN ReadyNode Sizer for the same inputs
- No mention of LFS or metadata overhead fields in the storage breakdown chart
- Storage "surplus" bar in the chart never turns negative even at 100% fill

**Phase to address:** Phase 2 (Storage Calculation Module) — validate formula against vSAN ReadyNode Sizer output before declaring storage module complete.

---

### Pitfall 4: VCFA HA Multiplier Not Applied to All Components

**What goes wrong:**
In HA (Production) mode, the management domain requires 3 instances of NSX Manager, VCF Operations, AND VCF Automation (VCFA). A common mistake is applying the x3 multiplier only to NSX Manager while treating VCF Operations and VCFA as singletons, or forgetting to multiply storage disk requirements by 3 as well. This silently under-counts management domain resource consumption by 50 to 60%.

VCFA specifics that are easy to get wrong:

- VCFA requires 24 vCPU / 96 GB RAM per instance — in HA mode that is 72 vCPU / 288 GB RAM for VCFA alone
- VCFA HA uses medium (150 GB disk) or large (200 GB disk) volumes — not the singleton 75 GB
- Physical hosts must have at least 12 physical cores / 24 threads for VCFA to deploy at all; this is a hard blocker, not a performance concern

**Why it happens:**
The VCF 9 deployment documentation describes HA mode globally but lists per-component specs in separate tables. It is easy to miss that "3-node" applies to every named appliance.

**How to avoid:**
Model each management component (vCenter, SDDC Mgr, NSX Mgr, VCF Ops, VCFA) as a typed object with `{ vCPU, ramGB, diskGB, count }`. The `count` field is driven by deployment mode: `count = 1` (Simple) or `count = 3` (HA). Total management overhead = sum across all components. Validate totals against the known minimums from Broadcom KB 397782 and the VCF 9 deployment guide.

**Warning signs:**

- Management domain vCPU count in HA mode is less than approximately 100 vCPU total (it should be well above this)
- Storage overview shows no disk difference between Simple and HA modes
- The tool never warns about the 12-core / 24-thread physical host requirement for VCFA

**Phase to address:** Phase 1 (Management Domain Baseline) — hard-code component specs as constants sourced from official Broadcom documentation, never as magic numbers inline.

---

### Pitfall 5: NVMe Memory Tiering Threshold Applied to Wrong Metric

**What goes wrong:**
The tool checks if `totalConfiguredRAM * 0.5 >= workloadRAMRequired` to decide whether NVMe tiering can halve physical DRAM. The correct condition is that **active memory** (hot working set) must be at or below 50% of physical DRAM — not total configured or allocated memory. Configured memory and active memory are different: a VM may be allocated 256 GB but only actively use 80 GB at peak. Using allocated memory instead of active memory causes the tool to falsely disqualify NVMe tiering for large-RAM VMs, or falsely enable it for memory-intensive workloads.

**Why it happens:**
The VCF 9 NVMe tiering documentation states "keep active memory at or below 50% of DRAM." Most sizing tools expose only "total VM RAM" as an input, and developers map this directly to "active memory" for simplicity.

**How to avoid:**
Add an explicit "memory activeness %" input (default 70%, representing typical enterprise workloads) alongside total VM RAM. Active memory = total VM RAM x activeness %. NVMe tiering is then beneficial only when active memory is at or below 50% of DRAM. Display both the input assumption and the derived active-memory figure prominently so users can override the default.

**Warning signs:**

- NVMe tiering is triggered for a workload where all VMs are described as memory-intensive databases
- The activeness percentage has no input field — the tool implicitly assumes 100%
- DRAM reduction benefit shows 2x for workloads where active memory clearly exceeds DRAM

**Phase to address:** Phase 3 (Compute / NVMe Tiering Feature) — model active-memory ratio as a first-class user input with a visible tooltip explaining the 50% threshold.

---

### Pitfall 6: Swiss Locale Number Formatting Inconsistency

**What goes wrong:**
Switzerland uses an apostrophe as the thousands separator with a period as the decimal separator: `1'234'567.89`. The four Swiss locales (`fr-CH`, `de-CH`, `it-CH`, `en-CH`) should all use this format, but `Intl.NumberFormat` implementations vary:

- Some browser and OS versions output a regular single quote instead of the Unicode apostrophe (U+2019) — visually identical but causes test assertion failures
- `fr-CH` has documented inconsistencies in some JS runtimes — numbers may render with a space separator instead of apostrophe
- vue-i18n's number format configuration must be explicitly defined for every locale: there is no automatic Swiss format inheritance. An unconfigured locale falls back to its parent (`fr`, not `fr-CH`) and shows European formats such as `1.234.567,89`

**Why it happens:**
vue-i18n delegates to `Intl.NumberFormat` under the hood. Developers define `fr` but forget `fr-CH`, `de-CH`, `it-CH` as distinct entries in `numberFormats`. A locale-switch test works in Chrome on macOS but fails in Firefox on Linux due to CLDR data differences.

**How to avoid:**
Explicitly define `numberFormats` for all four Swiss locales in the vue-i18n configuration. Write cross-locale snapshot tests using `@formatjs/intl-numberformat` as a polyfill to get deterministic output regardless of browser CLDR version. Test input values like `1234567.89` and `0.5` in all four locales.

**Warning signs:**

- Numbers display identically in `fr-CH` and `fr` locale
- Storage figures display as `1.500.000,00` (European format) after switching to German
- CI tests pass but user reports the DE locale shows wrong separators in their browser

**Phase to address:** Phase 1 (i18n Foundation) — configure all four Swiss locales explicitly on day one; never add them as an afterthought.

---

### Pitfall 7: URL State Sharing Breaks with Standard Base64

**What goes wrong:**
Standard Base64 uses `+`, `/`, and `=` characters. When embedded in a URL query string or fragment, these characters have special meaning: `+` decodes as space, `=` is interpreted as key-value separator, `/` confuses path parsing. A URL like `?config=abc+def/xyz==` will silently corrupt to `abc def/xyz` when decoded by a browser's `URLSearchParams`, breaking state restoration.

Additionally, large configurations (many VMs, multiple workload profiles) can push the base64 string past browser-specific URL limits. Chrome truncates at 2 MB, Internet Explorer at 2,083 characters — but email clients, Slack, and Teams preview links break at approximately 500 characters.

**Why it happens:**
Developers use `btoa()` + `JSON.stringify()` directly without applying URL-safe encoding. This works in isolated testing (where the URL is pasted rather than processed) but fails in email links and social sharing.

**How to avoid:**
Use **Base64URL** encoding (RFC 4648 section 5): replace `+` with `-`, `/` with `_`, and strip trailing `=`. In modern browsers, apply `encodeURIComponent(btoa(json))` at minimum, or a library that outputs Base64URL natively. Compress the JSON with `lz-string` or `pako` before encoding to stay well under 2,000 characters for typical configurations. Add a unit test that round-trips a maximum-complexity configuration (all deployment modes, all workloads, all languages) and verifies URL length below 1,800 characters.

**Warning signs:**

- Pasting a shared URL into Outlook strips content after the `+`
- State round-trip test fails when workload names contain spaces or special characters
- URL length exceeds 2,000 characters for a 10-workload configuration

**Phase to address:** Phase 4 (URL State Sharing) — design the encode and decode pipeline with Base64URL plus compression from the start; do not retrofit later.

---

### Pitfall 8: Chart.js and Vue 3 Reactivity Causing Silent Double-Update or Stale Charts

**What goes wrong:**
Wrapping a Chart.js instance in a Vue 3 `reactive()` object triggers the Chart.js internal `update()` method inside Vue's reactive proxy, causing a "Maximum update depth exceeded" recursion error (confirmed GitHub issue #11619). Alternatively, charts that receive data via shallow copies update the labels array but not the datasets, leaving the chart displaying stale bars while Pinia state is correct.

A second pattern: using `watch()` on a large Pinia store that contains all sizing inputs causes a "watcher storm" — every keystroke in any input field re-triggers all chart watchers simultaneously, leading to 300 to 500 ms render delays on mid-range devices.

**Why it happens:**
Vue's deep reactivity wraps every nested object in a Proxy. Chart.js instances maintain internal mutable state that conflicts with Proxy interception. Developers register the chart instance as `const chart = reactive(new Chart(...))` thinking this enables reactive updates, but this is the wrong integration pattern.

**How to avoid:**
Store Chart.js instances in `shallowRef()`, never in `reactive()` or `ref()`. Pass data to charts via computed properties derived from the Pinia store, using `watch(computedChartData, () => chart.value.update())` with `{ flush: 'post' }` to batch updates after the DOM cycle. For Pinia, break the monolithic state store into domain-specific stores (compute store, storage store, network store) so watchers are scoped and do not cascade. Use `vue-chartjs` as the integration layer — it handles the `shallowRef` pattern correctly.

**Warning signs:**

- Browser console shows "Maximum update depth exceeded" when chart inputs change
- Charts correctly update in development but are one update behind in production
- CPU spikes to 100% when the user types quickly in the VM count input field

**Phase to address:** Phase 3 (Visualization / Chart Integration) — prototype the chart and reactivity integration in isolation before integrating with the full store.

---

### Pitfall 9: PDF Export Font and Layout Regression

**What goes wrong:**
`html2canvas` + `jsPDF` rasterizes the DOM into a PNG and embeds it in a PDF. This approach has three VCF-sizer-specific failure modes:

1. **Font rendering:** Web fonts (e.g., Inter, the default Tailwind sans) are not loaded at the time html2canvas captures the DOM — the PDF shows fallback serif fonts or blank text boxes.
2. **CSS layout collapse:** Flex and Grid layouts used by Tailwind lose their computed styles during the DOM clone that html2canvas performs. Charts collapse to zero-height divs.
3. **File size:** A full-page raster at 2x DPI for a complex sizing report produces a 5 to 15 MB PDF — impractical for email attachment.

**Why it happens:**
html2canvas operates on a cloned DOM, and the clone does not inherit computed styles applied via `<link>` stylesheets loaded after initial paint. Charts rendered via `<canvas>` elements are copied as blank because the canvas `toDataURL()` call happens before the animation frame completes.

**How to avoid:**
Use the `@page` CSS print media approach first: a `window.print()` triggered PDF with `@media print` overrides is zero-dependency and preserves fonts and layout correctly. For a "true PDF" button, use `@vueuse/core`'s `useEventListener` to trigger a print dialog styled with a print stylesheet. If a downloadable file (not print dialog) is required, evaluate `jspdf-autotable` for data tables and render charts to `canvas.toDataURL()` explicitly before calling html2canvas. Always test PDF export in both Chrome and Firefox headless.

**Warning signs:**

- PDF preview shows "Helvetica" instead of the project typeface
- Bar charts appear as empty rectangles in the exported PDF
- PDF file sizes exceed 5 MB for a standard 3-workload configuration
- Export works in Chrome dev tools but fails in Playwright headless tests

**Phase to address:** Phase 5 (Export Features) — prototype PDF generation as a standalone spike in week 1 of that phase; do not assume html2canvas works without validation.

---

### Pitfall 10: Stretch Cluster Witness Size Selected Without Component Count Calculation

**What goes wrong:**
The tool offers a "Stretch Cluster" toggle and simply adds a "witness appliance" line to the BOM without calculating the correct witness appliance size tier. vSAN witness appliances have four sizes (Tiny / Medium / Large / Extra Large) supporting up to 750 / 21,833 / 45,000 / 45,000+ components respectively. A Tiny witness for a 200-VM stretched cluster will have too few component slots, causing the cluster to fail health checks at deployment time.

The component count formula is non-trivial: each VM with FTT=1 RAID-1 generates approximately 3 components per disk, plus witness components. The calculator must sum components across all VMs, accounting for snapshot overhead and storage policy variations.

**Why it happens:**
The witness appliance is perceived as a "small helper VM" — developers default to Tiny and move on. The component count calculation is buried in the vSAN Stretched Cluster Guide, not in the main sizing guide.

**How to avoid:**
Implement a `witnessComponentCount(vmCount, disksPerVM, policy)` function. Map the result to witness size tiers:

- Below 750 components: Tiny
- 750 to 21,833 components: Medium
- 21,834 to 45,000 components: Large
- Above 45,000 components: Extra Large

Display the calculated component count alongside the recommended witness tier so users can audit the result.

**Warning signs:**

- The tool always recommends "Tiny" witness regardless of VM count
- No component count figure appears in the stretch cluster section
- The witness section has no inputs for disks-per-VM or storage policy

**Phase to address:** Phase 2 (Stretch Cluster Module) — define the component count model before designing the stretch cluster UI.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Native JS `Number` for all calculations | Simpler code | Off-by-epsilon errors in host count recommendations; potential NVMe threshold flip | Never — use Decimal.js from day one |
| Single monolithic Pinia store for all inputs | Easier to prototype | Watcher storms on every keystroke; chart re-renders for unrelated input changes | MVP prototype only — refactor before Phase 2 |
| Hardcoded English-only strings in components | Faster initial build | Cannot retrofit i18n without full component audit | Never — add vue-i18n from day one |
| `window.btoa()` without Base64URL conversion | Works in local testing | Shared URLs break in email clients and Slack | Never — Base64URL adds 3 lines of code |
| `html2canvas` default settings for PDF | Quick to implement | Blank fonts, collapsed Tailwind layouts, 10 MB PDFs | Prototype only — spike real implementation |
| Assuming deduplication ratio = 2x always | Simpler storage math | Undersized or oversized raw disk estimates depending on workload | Never — make dedupe ratio a user input with 2x default |
| Single `numberFormats` entry for `fr` covering all Swiss locales | Fewer config lines | German and Italian Swiss locales show European thousand/decimal separators | Never — all four Swiss locales must be explicit |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| vue-i18n + Intl.NumberFormat | Define `fr` numberFormat and assume `fr-CH` inherits it | Explicit `numberFormats` block for `fr-CH`, `de-CH`, `it-CH`, `en` — no inheritance |
| Chart.js + Vue 3 Pinia | Store Chart.js instance in `reactive()` | Store in `shallowRef()`; use `vue-chartjs` wrapper; update via `watch(..., { flush: 'post' })` |
| Base64 URL state | Use `btoa()` directly | Compress JSON with `lz-string`, then apply Base64URL encoding (replace `+` to `-`, `/` to `_`, strip `=`) |
| html2canvas + Tailwind | Assume CSS is captured during clone | Inline critical styles; pre-render canvas elements; use `@media print` as primary export path |
| Decimal.js + Vue reactive | Wrap Decimal instances in `reactive()` — Proxy breaks Decimal internals | Extract primitive value before storing in reactive state: `computed(() => myDecimal.toNumber())` |
| vSAN formula constants | Copy from OSA documentation | Always source from ESA-specific docs; OSA and ESA use different overhead percentages |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Deep `watch()` on entire Pinia sizing store | 300 to 500 ms input lag; chart redraws on unrelated field changes | Split into domain stores; use `watchEffect` with explicit dependency tracking | At approximately 10 reactive fields in the same store |
| Re-running all sizing formulas on every keystroke | UI jank during VM count input; Decimal.js chains are not free | Debounce reactive computation triggers (150 ms); use `computed` with Decimal caching | Immediately visible on mid-range mobile |
| Serializing full Pinia state to `localStorage` on every change | localStorage writes block the main thread | Debounce persistence writes; only persist on intentional actions (export, share) | At approximately 50 KB state object |
| Base64-encoding a 500-field JSON without compression | URL exceeds 2,000 characters | Compress with `lz-string` before encoding | At roughly 15+ workload profiles |
| Rendering chart data as deeply nested reactive arrays | Chart.js proxy recursion crash | Use `shallowRef` + explicit `.value` replacement instead of mutating nested arrays | At first chart data update after locale switch |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Deserializing base64-decoded URL state without schema validation | Crafted URLs could inject unexpected values that break calculations or display incorrect results | Use `JSON.parse()` wrapped in try/catch, then validate schema with Zod before trusting any value; reject unknown keys |
| Trusting deduplication ratio inputs without bounds checking | User enters 100x ratio, tool shows 0 GB required storage | Clamp all ratio inputs: dedup 1.0 to 10.0x, compression 1.0 to 8.0x, activeness 10 to 100% |
| Embedding internal company infrastructure data in a shared URL | Base64 is not encryption — anyone receiving the URL can decode the full configuration | Add a visible warning: "Shared URLs contain your full configuration in readable form" |
| No input validation on VM count | User enters negative or NaN counts, Decimal operations throw | Validate all numeric inputs at the store layer before computation; display field-level errors |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw capacity and usable capacity without labeling which is which | Architects order the wrong amount of disks | Always label: "Raw Disk Capacity" vs. "Net Usable (after RAID + LFS + metadata)" with a tooltip explaining the stack |
| Updating all charts on every keystroke | Visual noise; hard to read while typing | Debounce chart updates 300 ms after last input change |
| Presenting NVMe tiering as an on/off toggle with no explanation | Users enable it for all workloads, even latency-sensitive ones | Show a warning when NVMe tiering is enabled: "Not suitable for Fault Tolerance VMs, Monster VMs (more than 1 TB RAM), or SGX workloads" |
| Displaying the sizing result without a confidence indicator | Users treat approximate deduplication estimates as guarantees | Show a banner: "Deduplication savings are workload-dependent; 2x is a conservative baseline" |
| Language-switching causing in-progress calculations to reset | User switches to German mid-session; number fields reset to defaults | Store all computation state in Pinia (language-independent); only apply locale to display layer |
| Sharing a URL that is too long for email | Link appears broken in Outlook | Show URL length indicator in the share dialog with a warning if above 1,800 characters |

---

## "Looks Done But Isn't" Checklist

- [ ] **vSAN ESA RAID overhead:** Verify the Adaptive RAID-5 threshold (3 to 5 hosts = 2+1 scheme; 6+ hosts = 4+1 scheme) is implemented and produces different storage totals for a 5-node vs. 6-node cluster.
- [ ] **LFS + metadata overhead:** Confirm usable capacity includes the approximately 13% LFS and approximately 10% global metadata deductions; compare output to vSAN ReadyNode Sizer for the same inputs.
- [ ] **HA multiplier completeness:** Confirm that switching to HA mode multiplies resource counts for NSX Manager, VCF Operations, AND VCF Automation — not just one of them.
- [ ] **VCFA core/thread blocker:** Confirm a hard warning fires when a host spec shows fewer than 12 cores / 24 threads in HA mode with VCFA enabled.
- [ ] **Swiss locales explicitly configured:** Switch to each of `fr-CH`, `de-CH`, `it-CH`, `en` and verify apostrophe thousands separator and decimal period for a value like `1234567.89`.
- [ ] **Base64URL round-trip:** Paste a shared URL into a raw HTTP client (not a browser that may auto-decode) and verify state restores correctly, including VM names with spaces and special characters.
- [ ] **NVMe tiering activeness input:** Confirm there is an explicit "memory activeness %" input and that the NVMe tiering toggle only activates when active memory is at or below 50% of DRAM.
- [ ] **Witness component count:** Confirm stretch cluster mode outputs a witness size recommendation based on calculated component count, not a hardcoded default.
- [ ] **PDF font rendering:** Open the exported PDF in a PDF viewer (not browser PDF preview) and confirm the project typeface is present and bar charts are visible.
- [ ] **URL length under load:** Generate a URL for a configuration with 3 deployment profiles and 5 workload types; verify URL length is below 1,800 characters.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Floating-point errors discovered after launch | HIGH | Identify all affected formula paths; replace with Decimal.js; re-validate all baseline test scenarios; publish a "calculation corrected" note |
| Wrong vSAN overhead constants shipped | MEDIUM | Patch constants as a hotfix; update unit tests; add a "last verified against Broadcom KB [date]" comment to the constants file |
| i18n number formats missing for `de-CH` and `it-CH` | LOW | Add explicit `numberFormats` entries; snapshot tests will catch regressions |
| PDF export blank charts discovered in Firefox | MEDIUM | Migrate to `@media print` approach; test in Playwright headless against Chrome and Firefox before re-release |
| URL state breaks in email due to standard Base64 | LOW | Add Base64URL normalization step; old shared URLs can be migrated with a one-time redirect handler |
| Chart.js reactivity crash (Proxy recursion) | MEDIUM | Convert chart instance storage to `shallowRef`; audit all `reactive()` usages in chart-adjacent code |
| Witness tier always "Tiny" bug | MEDIUM | Implement component count formula; requires stretch cluster module regression testing |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Floating-point arithmetic errors | Phase 1 (Core Math Engine) | Unit test: `raidOverhead(5, 1, 'RAID5')` returns exactly `1.5`; no float drift |
| Adaptive RAID-5 threshold miscalculation | Phase 2 (Storage Module) | Snapshot test: 5-node cluster storage total differs from 6-node cluster |
| LFS + metadata overhead omission | Phase 2 (Storage Module) | Integration test vs. vSAN ReadyNode Sizer for known input set |
| VCFA HA multiplier incomplete | Phase 1 (Management Domain) | Test: HA mode total vCPU at or above 3 x (VCFA 24 + NSX 18 + Ops 24 + vCenter 8) |
| NVMe tiering wrong metric | Phase 3 (Compute / NVMe) | Unit test: activeness 60%, DRAM 100 GB, total VM RAM 70 GB results in tiering disabled |
| Swiss locale number formatting | Phase 1 (i18n Foundation) | Cross-locale snapshot test: `1234567.89` in all four locales shows apostrophe separator |
| URL state Base64 encoding | Phase 4 (URL State) | Round-trip test in Firefox headless; test with VM name containing `+`, `/`, `=` |
| Chart.js reactivity crash | Phase 3 (Visualization) | Integration test: rapid input changes do not trigger "Maximum update depth exceeded" |
| PDF export blank or wrong output | Phase 5 (Export) | Playwright PDF test: confirm text layer and canvas elements are non-empty |
| Witness size not calculated | Phase 2 (Stretch Cluster) | Test: 200-VM stretch cluster recommends Medium or Large witness, not Tiny |

---

## Sources

- [vSAN ESA Adaptive RAID-5 introduction — Duncan Epping (Yellow Bricks, 2022)](https://www.yellow-bricks.com/2022/11/15/vsan-8-0-esa-introducing-adaptive-raid-5/)
- [vSAN ESA minimum host count with RAID-1/5/6 — Duncan Epping (Yellow Bricks, 2024)](https://www.yellow-bricks.com/2024/01/23/vsan-esa-and-the-minimum-number-of-hosts-with-raid-1-5-6/)
- [Capacity Overheads for the ESA in vSAN 8 — VMware Cloud Foundation Blog (2022)](https://blogs.vmware.com/cloud-foundation/2022/11/02/capacity-overheads-for-the-esa-in-vsan-8/)
- [Global Deduplication in vSAN ESA for VMware Cloud Foundation 9.0 — VMware Cloud Foundation Blog (2025)](https://blogs.vmware.com/cloud-foundation/2025/06/19/global-deduplication-in-vsan-esa-for-vmware-cloud-foundation-9-0/)
- [NVMe Memory Tiering Design and Sizing on VMware Cloud Foundation 9 — VMware Cloud Foundation Blog (2025)](https://blogs.vmware.com/cloud-foundation/2025/11/04/nvme-memory-tiering-design-and-sizing-on-vmware-cloud-foundation-9-part-1/)
- [VCF Operations 9.0 Sizing Guidelines — Broadcom KB 397782](https://knowledge.broadcom.com/external/article/397782/vcf-operations-90-sizing-guidelines.html)
- [Minimal resources for deploying VCF 9.0 in a Lab — William Lam (2025)](https://williamlam.com/2025/06/minimal-resources-for-deploying-vcf-9-0-in-a-lab.html)
- [vSAN Stretched Cluster Bandwidth Sizing — VMware official docs](https://www.vmware.com/docs/vmw-vsan-stretched-cluster-bandwidth-sizing)
- [vue-i18n Number Formatting — official docs](https://vue-i18n.intlify.dev/guide/essentials/number)
- [vue-i18n issue #2053: Use different locale for number and date formatting](https://github.com/intlify/vue-i18n/issues/2053)
- [Wrong number format for Switzerland CH — Intl.js issue #269](https://github.com/andyearnshaw/Intl.js/issues/269)
- [Chart.js issue #11619: update() fails with recursion error in Vue 3](https://github.com/chartjs/Chart.js/issues/11619)
- [7 Vue 3 Performance Pitfalls — Simform Engineering (Medium, 2024)](https://medium.com/simform-engineering/7-vue-3-performance-pitfalls-that-quietly-derail-your-app-33c7180d68d4)
- [Base64URL standard — base64.guru](https://base64.guru/standards/base64url)
- [Decimal.js vs BigNumber.js — DEV Community comparison](https://dev.to/fvictorio/a-comparison-of-bignumber-libraries-in-javascript-2gc5)
- [html2canvas + jsPDF pitfalls — DEV Community](https://dev.to/jringeisen/using-jspdf-html2canvas-and-vue-to-generate-pdfs-1f8l)
- [Tailwind CSS dynamic class purging — official Tailwind v3 docs](https://v3.tailwindcss.com/docs/optimizing-for-production)
- [RAID-5 objects not immediately converted from 2+1 to 4+1 after node count change — Broadcom KB 405876](https://knowledge.broadcom.com/external/article/405876/raid5-objects-not-immediately-converted.html)

---
*Pitfalls research for: VCF 9.x Sizing Calculator SPA*
*Researched: 2026-03-28*
