# Project Research Summary

**Project:** vcf-sizer — VCF 9.x On-Premises Sizing Calculator
**Domain:** Client-side SPA infrastructure sizing tool (VMware Cloud Foundation 9.x)
**Researched:** 2026-03-28
**Confidence:** HIGH

## Executive Summary

The vcf-sizer project is a browser-only, zero-backend single-page application that enables VMware Cloud Foundation 9.x architects to compute management domain overhead, workload host requirements, and vSAN storage sizing without relying on existing tools that are either VMC-focused, storage-only, or too outdated for VCF 9.x specifics. Research confirms a genuine gap in the public tooling landscape: no existing tool combines VCF 9 management domain sizing, NVMe Memory Tiering, vSAN ESA Global Deduplication, stretch cluster support, per-component HA/Simple toggling, VCF Fleet topology awareness, and Swiss four-language localization in a single client-side interface.

The recommended approach is Vue 3 (Composition API) + Pinia 3 + Vite 8 + Tailwind CSS 4 + vue-i18n 11. This stack is specifically advantageous over React for this domain: Vue's fine-grained reactivity is a better fit than React's re-render model for deeply nested reactive computation trees, vue-i18n has materially stronger four-language localization support than any React alternative, and the Pinia store model maps directly to the sizing domains (input, calculation, UI). All versions are verified against GitHub releases as of 2026-03-28 and are mutually compatible. The entire stack produces a static `/dist/` folder deployable to GitHub Pages or any CDN at zero recurring cost.

The primary risks are in the calculation layer, not the UI: VCF 9.x has several non-obvious formula subtleties (vSAN ESA Adaptive RAID-5 thresholds, mandatory LFS + metadata overhead stacking, HA multiplier completeness, NVMe tiering active-memory vs. allocated-memory distinction). Floating-point arithmetic must be addressed in Phase 1 using Decimal.js before any formula is written, because retrofitting arbitrary-precision math after the fact carries high recovery cost. Swiss locale number formatting (apostrophe as thousands separator) must also be configured explicitly for all four Swiss locales on day one — vue-i18n does not inherit `fr-CH` from `fr` automatically.

## Key Findings

### Recommended Stack

Vue 3 + Pinia 3 is the foundation. The Composition API via `<script setup>` is mandatory; Options API should not be used. The calculation engine must be isolated in pure TypeScript modules with zero Vue imports so formulas are independently testable. Vite 8 with the Rolldown bundler provides substantially faster builds and explicit Tailwind v4 support. The `@tailwindcss/vite` plugin eliminates the PostCSS configuration entirely.

**Core technologies:**
- **Vue 3.5.31:** UI framework — fine-grained reactivity ideal for live sizing math; Composition API keeps computation logic separated from templates
- **Pinia 3.0.4:** State management — Vue 3-only focus; three-store split (inputStore / calculationStore / uiStore) enforces unidirectional data flow
- **Vite 8.0.3:** Build tool — Rolldown-powered, 10–30x faster builds; static deployment to GitHub Pages with `base: '/vcf-sizer/'`
- **Tailwind CSS 4.2.2:** Styling — Oxide (Rust) engine via `@tailwindcss/vite`; single `@import "tailwindcss"` line, no config file
- **vue-i18n 11.3.0:** Localization — Composition API (`useI18n()`); lazy locale loading; `unplugin-vue-i18n` pre-compiles JSON at build time
- **TypeScript 5.7+:** Type safety — `strict: true`; `moduleResolution: "bundler"`; `vue-tsc` for SFC type checking in CI
- **vue-chartjs 5.3.3 + Chart.js 4.5.1:** Visualizations — `shallowRef` integration; 11 KB gzipped; canvas-based (performant reactive updates)
- **jsPDF 4.2.1 + html2canvas 1.4.1:** PDF export — v4.2.x mandatory for security fixes
- **lz-string 1.5.0:** URL compression — keeps shared config URLs under 2,000 characters
- **@vueuse/core 14.2.1:** Composable utilities — `useClipboard`, `useUrlSearchParams`, `useLocalStorage`
- **Decimal.js:** Arbitrary-precision arithmetic — mandatory for all sizing formulas; must be adopted in Phase 1

**What not to use:** Vuex (superseded), vue-i18n v9/v10 (maintenance mode), html2pdf.js (outdated jsPDF 2.x dependency), Options API, full component libraries (Vuetify/Quasar), Axios (no backend needed).

### Expected Features

Research identified a clear three-tier prioritization. The management domain constants (vCPU, RAM, disk per component for Simple and HA modes) are fully documented and ready to encode directly.

**Must have (table stakes — P1, launch-blocking):**
- Deployment model selector (Simple / HA) with per-component HA/Simple toggle for NSX, VCF Operations, VCF Automation
- Physical host specification inputs with hard blocking warning when host cores < 12 (VCFA 24-vCPU hard requirement)
- VCF Fleet position selector (first instance vs. additional — determines Fleet Manager overhead inclusion)
- Management domain baseline calculation using verified component specs from Broadcom TechDocs
- Workload profile inputs (VM count, avg vCPU, avg vRAM, CPU overcommit ratio)
- vSAN ESA storage type with FTT/RAID policy selection and Adaptive RAID-5 capacity math
- Host count recommendation (compute-bound vs. storage-bound, N+1 admission control)
- vCPU and memory headroom display (management vs. workload vs. available)
- Shareable URL (lz-string compressed, Base64URL encoded)
- EN/FR/DE/IT localization with Swiss locale number formatting

**Should have (competitive differentiators — P2, v1.x):**
- NVMe Memory Tiering toggle with explicit "memory activeness %" input (guards 50% active-memory threshold)
- vSAN ESA Global Deduplication toggle (mutually exclusive with stretch cluster)
- Stretch cluster mode (2-site + witness node with component count-based witness size selection)
- Chart visualizations (doughnut/bar for CPU/RAM/storage breakdown)
- Export to PDF and Markdown

**Defer (v2+):**
- AI/GPU workload sizing section
- VCF Operations appliance size sub-calculator
- Multi-workload-domain scenario planning
- Additional vCenter/NSX size tiers (Large, XL) for hyperscale environments

**Anti-features (explicitly excluded):** Backend API, user accounts, vSphere 7.x/VCF 5.x support, network topology designer, hardware vendor SKU matching, RVTools import, license cost calculator.

### Architecture Approach

The architecture enforces strict separation between three layers: a pure TypeScript calculation engine (zero Vue imports), Pinia stores (inputStore as single source of truth for mutable state, calculationStore as read-only computed getters, uiStore for locale/layout), and thin Vue components that only read stores and emit events. This separation makes formulas independently testable with Vitest before any UI exists, prevents business logic from leaking into components, and ensures circular reactivity is impossible by construction.

**Major components:**
1. **`engine/*.ts`** — Pure TypeScript sizing formulas: `mgmtDomainCalc.ts`, `workloadCalc.ts`, `storageCalc.ts`, `stretchCalc.ts`, `nvmeTieringCalc.ts`, `validationRules.ts`
2. **`stores/inputStore.ts`** — All user inputs; single mutable source of truth; serialized to URL for sharing
3. **`stores/calculationStore.ts`** — Read-only computed results derived from inputStore via engine functions
4. **`components/input/`** — Input panels (DeploymentModePanel, HostSpecPanel, WorkloadPanel, StoragePanel, StretchClusterPanel)
5. **`components/output/`** — Result components (SummaryCard, ResourceResult, StorageResult, ChartPanel)
6. **`composables/`** — Cross-cutting logic: `useUrlState.ts`, `useExport.ts`, `useValidation.ts`, `useChartData.ts`
7. **`i18n/locales/`** — Flat JSON per locale (en, fr, de, it); lazy-loaded on demand except EN

**Key patterns:**
- Unidirectional reactive data flow: UI input → inputStore → calculationStore computed → output components
- Pure calculation engine: all formulas take typed input objects, return typed result objects, no Vue dependency
- URL state as sole persistence: `lz-string.compressToEncodedURIComponent()` → `?state=` param; no localStorage
- `shallowRef` for Chart.js instances (never `reactive()`); `watch(..., { flush: 'post' })` for chart updates

### Critical Pitfalls

Research identified 10 pitfalls with severity ratings. The top 5 by impact and recovery cost:

1. **Floating-point arithmetic errors** — Use Decimal.js for all sizing arithmetic from day one; never native `+`, `*`, `/` on float inputs; establish a project-wide `Calc` wrapper before any formula is written. Recovery cost after launch: HIGH.

2. **vSAN ESA Adaptive RAID-5 threshold miscalculation** — Hard-code: RAID-5 with 3–5 hosts = 2+1 scheme (150% overhead); RAID-5 with 6+ hosts = 4+1 scheme (125% overhead). Source from ESA-specific docs, not OSA guide. Failure produces 20% raw capacity under-estimate for small clusters.

3. **vSAN LFS + metadata overhead omission** — Apply the full formula stack sequentially: raw → dedup → RAID overhead → minus 13% LFS → minus 10% global metadata. Missing these two overheads under-reports required raw disk capacity by 20–25%.

4. **VCFA HA multiplier not applied to all components** — NSX Manager, VCF Operations, AND VCF Automation all scale x3 in HA mode. VCFA alone is 72 vCPU / 288 GB RAM in HA. Model each component as `{ vCPU, ramGB, diskGB, count }` where count is 1 (Simple) or 3 (HA).

5. **Swiss locale number formatting inconsistency** — Explicitly define `numberFormats` for `fr-CH`, `de-CH`, `it-CH`, `en` in vue-i18n; `fr-CH` does NOT inherit from `fr`. Write cross-locale snapshot tests on day one. Failure: European separators render for DE/IT Swiss users.

Additional important pitfalls: NVMe tiering must check active memory (not allocated), URL state requires Base64URL encoding (not standard Base64), Chart.js instances must use `shallowRef` (never `reactive()`), PDF export with html2canvas has known Tailwind layout collapse and font-loading issues that require early spike validation.

## Implications for Roadmap

Research is unambiguous about phase order. Dependencies run strictly downward: types and engine functions must exist before stores, stores must exist before input components, input components and calculation results must exist before output components and charts. The build order from ARCHITECTURE.md maps cleanly to a phased roadmap.

### Phase 1: Foundation and Core Engine

**Rationale:** All downstream phases depend on the calculation engine and type system. Decimal.js math, i18n configuration, and Pinia store structure must be established before any UI work begins — retrofitting any of these after the fact carries high or medium recovery cost. This phase has zero UI; everything is validated via unit tests.

**Delivers:** TypeScript types (`engine/types.ts`), all pure calculation engine modules (management domain, workload, storage, NVMe tiering), Pinia store scaffolding (inputStore, calculationStore, uiStore), vue-i18n setup with all four Swiss locales explicitly configured, Vite + Tailwind project scaffold, Vitest test suite validating all formulas against known Broadcom reference values.

**Addresses:** Management domain baseline (P1), host minimum-cores hard warning (P1), deployment model selector logic (P1), EN localization baseline (P1).

**Avoids:** Floating-point arithmetic errors (Pitfall 1), VCFA HA multiplier incompleteness (Pitfall 4), Swiss locale misconfiguration (Pitfall 6).

**Research flag:** Standard patterns — well-documented Vue 3 + Pinia setup; no phase-level research needed.

### Phase 2: Input Panel and Core Storage Module

**Rationale:** Input components can be built once inputStore is stable. The vSAN storage calculation module is placed here (not Phase 3) because it contains the highest-risk formulas (Adaptive RAID-5, LFS + metadata overhead stack) and must be fully validated before building output displays that depend on it.

**Delivers:** All input panel components (DeploymentModePanel, HostSpecPanel, WorkloadPanel, StoragePanel), vSAN ESA + OSA storage calculation module with Adaptive RAID-5 matrix and full overhead stack, FC/NFS storage type selection, warning system (VCFA min-cores blocker), per-component HA/Simple toggle, VCF Fleet position selector.

**Addresses:** Physical host spec inputs (P1), workload profile inputs (P1), principal storage selection (P1), vSAN FTT policy selector (P1), vSAN ESA vs. OSA capacity math (P2).

**Avoids:** Adaptive RAID-5 threshold miscalculation (Pitfall 2), LFS + metadata overhead omission (Pitfall 3).

**Research flag:** Storage formula validation against vSAN ReadyNode Sizer output is required before declaring this phase complete — use as acceptance test.

### Phase 3: Output Panel and Visualizations

**Rationale:** Output components are built once calculationStore is stable and feeding correct results from Phase 2. Chart integration requires early prototype validation (Chart.js + Vue 3 reactivity has a known proxy recursion pitfall) before full integration.

**Delivers:** calculationStore computed results, SummaryCard, ResourceResult, StorageResult, ChartPanel with doughnut/bar charts, useChartData composable, ExportToolbar scaffold.

**Addresses:** Total host count recommendation (P1), vCPU/RAM headroom display (P1), storage raw vs. usable visualization (P1), chart visualizations (P2).

**Avoids:** Chart.js reactivity crash via Proxy (Pitfall 8) — use `shallowRef` and `vue-chartjs`; prototype in isolation before integration.

**Research flag:** Chart.js + vue-chartjs integration is standard but needs careful `shallowRef` application — no research phase needed, but integration spike recommended.

### Phase 4: URL State Sharing and Export

**Rationale:** URL state can only be implemented correctly once all input state is stable (changing the inputStore schema after URL encoding is deployed breaks shared links). Export requires complete output components.

**Delivers:** `useUrlState` composable with lz-string compression and Base64URL encoding, `useExport` composable (PDF + Markdown), ExportToolbar, LanguageSwitcher component, shareable URL copy-to-clipboard.

**Addresses:** Shareable configuration URL (P1), export to PDF and Markdown (P2).

**Avoids:** URL state Base64 corruption (Pitfall 7) — Base64URL encoding from the start; URL length validation; PDF export font and layout regression (Pitfall 9) — spike html2canvas vs. `@media print` approach early in this phase.

**Research flag:** PDF export implementation strategy (html2canvas vs. print stylesheet) needs a spike in week 1 of this phase before committing to an approach.

### Phase 5: Advanced Features (NVMe Tiering, Stretch Cluster, Global Dedup)

**Rationale:** These features are high-complexity and depend on the core engine being fully stable. Stretch cluster adds significant input UI complexity; NVMe tiering adds a new formula path; Global Dedup adds mutual-exclusion logic with stretch cluster. All are P2 (v1.x) and can be released incrementally.

**Delivers:** NVMe Memory Tiering toggle with explicit activeness % input, `nvmeTieringCalc.ts` integration, StretchClusterPanel with site inputs and witness component count calculation, `stretchCalc.ts`, Global Deduplication toggle with mutual exclusion enforcement (dedup ↔ stretch, dedup ↔ encryption).

**Addresses:** NVMe Memory Tiering (P2), vSAN ESA Global Deduplication (P2), stretch cluster 2-site (P2).

**Avoids:** NVMe tiering active vs. allocated memory confusion (Pitfall 5) — explicit activeness % input field with tooltip; witness size always "Tiny" bug (Pitfall 10) — implement component count formula.

**Research flag:** Stretch cluster witness component count formula needs validation against Broadcom vSAN Stretched Cluster Guide before implementation.

### Phase 6: Localization Completion and Polish

**Rationale:** FR, DE, IT translations are deferred until all UI components are complete and all translation keys are known, to avoid translating then immediately refactoring. Validation rules and accessibility are final-pass concerns.

**Delivers:** Complete FR, DE, IT locale JSON files, lazy locale loading, full validation composable (`useValidation.ts`), responsive/mobile layout testing, accessibility (aria-label, keyboard navigation), security hardening (Zod schema validation on URL state deserialization, input bounds clamping).

**Addresses:** FR/DE/IT translations (P1 — deferred within v1 to this phase per FEATURES.md MVP guidance), responsive layout (P1), input bounds validation for security.

**Avoids:** Language-switch resetting in-progress calculations (UX pitfall) — all state in Pinia is locale-independent; only display layer applies `t()`.

**Research flag:** Standard patterns — no research phase needed.

### Phase Ordering Rationale

- **Engine before stores before UI:** The calculation engine is the highest-risk component (VCF formulas are precise and sourced from official docs); it must be unit-tested before any UI is built on top of it.
- **Storage module early:** The vSAN capacity math (Adaptive RAID-5 + LFS + metadata) has the most pitfalls by count and the highest risk of shipping silently wrong results. Placing it in Phase 2 allows validation against vSAN ReadyNode Sizer before the output panel is built.
- **Charts after calculation is stable:** Building charts against unstable computed values creates churn. Phase 3 starts only after Phase 2 formulas are validated.
- **URL state after schema is stable:** The inputStore schema must be frozen before URL state encoding is deployed. Changing the schema after sharing breaks all existing shared links.
- **Advanced features after core:** NVMe Tiering, Stretch Cluster, and Global Dedup are differentiators but are not blocking for an MVP that architects can use for standard HA sizing.
- **Translations last:** Translating keys that will be renamed or deleted during feature development wastes effort.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Storage Module):** Validate Adaptive RAID-5 formula constants against Duncan Epping's January 2024 ESA post and Broadcom KB 405876 before implementation.
- **Phase 4 (Export):** PDF export implementation strategy (html2canvas + jsPDF vs. `@media print` CSS) needs a spike — do not assume html2canvas works with Tailwind without testing.
- **Phase 5 (Stretch Cluster):** Witness component count formula from vSAN Stretched Cluster Guide needs implementation reference before coding.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Vue 3 + Pinia + Vite + Tailwind setup is fully documented; versions are verified. Use the install commands from STACK.md directly.
- **Phase 3 (Output + Charts):** vue-chartjs + `shallowRef` pattern is documented; use `vue-chartjs` wrapper to avoid manual Chart.js proxy issues.
- **Phase 6 (i18n + Polish):** vue-i18n 11 lazy loading pattern is documented in ARCHITECTURE.md; apply directly.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against GitHub releases as of 2026-03-28; version compatibility matrix explicitly checked |
| Features | HIGH (management domain specs), MEDIUM (GPU/AI workload) | Management domain constants sourced from official Broadcom TechDocs, William Lam lab data, and driftar.ch (Feb 2026); GPU sizing rules are documented but GPU SKUs evolve rapidly |
| Architecture | HIGH | Vue 3 + Pinia + vue-i18n patterns from official docs; VCF 9.x formula constants from Broadcom TechDocs and VCF blog (verified 2026-03-28) |
| Pitfalls | HIGH (VCF formulas), MEDIUM (PDF export implementation) | VCF-specific pitfalls sourced from official Broadcom KB and Duncan Epping; PDF export pitfalls from community sources and GitHub issues |

**Overall confidence:** HIGH

### Gaps to Address

- **Deduplication ratio variability:** Global Deduplication savings are workload-dependent. Research recommends defaulting to 2x conservative estimate with a visible disclaimer. The actual ratio input range (1x–10x) needs UX review during Phase 5 planning to set appropriate bounds and communicate uncertainty.
- **PDF export implementation:** ARCHITECTURE.md notes the html2canvas approach but PITFALLS.md documents known failure modes (Tailwind layout collapse, web font loading, file size). A concrete implementation decision (html2canvas + jsPDF vs. `@media print` CSS) cannot be made until a spike in Phase 4.
- **OSA-specific storage math:** Research covers vSAN ESA (Adaptive RAID-5) in depth. OSA calculations use a different disk group model and different overhead percentages. The OSA path is flagged as a valid selection in the UI but the precise OSA-specific formulas are not fully specified in the research. Needs verification against OSA documentation during Phase 2.
- **vGPU profile mapping:** AI/GPU workload sizing (Phase P3/v2+) references NVIDIA H100 examples but the full vGPU profile-to-host-RAM mapping requires ongoing maintenance as GPU SKUs change. Defer until v2.

## Sources

### Primary (HIGH confidence)
- Broadcom TechDocs VCF 9.0 — management domain component specs, stretch cluster guide, vSAN space efficiency features
- William Lam (williamlam.com/2025/06) — VCF 9.0 minimal lab resources; Simple deployment component vCPU/RAM table
- Broadcom KB 397782 — VCF Operations 9.0 sizing guidelines; appliance size tiers
- VMware Cloud Foundation Blog — NVMe Memory Tiering Parts 1 and 3 (Nov–Dec 2025); Global Deduplication in vSAN ESA (June 2025); VCF 9.0 Deployment Pathways (July 2025)
- Duncan Epping / Yellow Bricks — vSAN ESA Adaptive RAID-5 (2022, 2024); minimum host counts
- GitHub releases — Vue 3.5.31, Vite 8.0.3, Pinia 3.0.4, vue-i18n 11.3.0, Tailwind CSS 4.2.2, Chart.js 4.5.1, vue-chartjs 5.3.3, jsPDF 4.2.1 (all verified 2026-03-28)
- Pinia official documentation — composing stores, setup stores
- vue-i18n 11 official documentation — Composition API, number formatting, lazy loading
- VMware VCF Blog — vSAN ESA capacity overheads (2022)

### Secondary (MEDIUM confidence)
- driftar.ch (Feb 2026) — VCF 9 appliance sizing; community-verified SDDC Manager specs
- Medium / Lubomir Tobek — stretch cluster ISL bandwidth formula
- GitHub issue #11619 (Chart.js) — Vue 3 proxy recursion on `reactive()` chart instance
- @vueuse/core 14.2.1 — version from npm metadata; Vue 3.5+ requirement from official docs
- lz-string 1.5.0 — stable library; version from npm; minimal recent activity

### Tertiary (LOW confidence / needs validation)
- OSA-specific vSAN overhead constants — not deeply covered in research; needs verification against OSA documentation during Phase 2 implementation
- GPU workload host RAM formula (2–3x GPU VRAM) — sourced from VMware Private AI sizing guide v9 references; single source; validate during v2 planning

---
*Research completed: 2026-03-28*
*Ready for roadmap: yes*
