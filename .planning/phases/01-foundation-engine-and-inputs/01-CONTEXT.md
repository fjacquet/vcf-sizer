# Phase 1: Foundation, Engine and Inputs - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the project from zero, port the vSAN calculation engine from raidy, implement all VCF 9.x management domain and compute formulas as pure TypeScript (tested with Vitest), wire up i18n for all four Swiss locales, and build all input panels (deployment model, host specs, workload profiles, storage). No charts, no results panel, no export — those are Phase 2. The phase is complete when an architect can enter a full VCF 9.x specification and the engine produces correct sizing numbers, even without a polished output view.

</domain>

<decisions>
## Implementation Decisions

### Framework & Toolchain
- **Vue 3 (Composition API)** — not React. Stronger i18n story (vue-i18n v11 SFC blocks, unplugin-vue-i18n Vite plugin), Pinia reactive stores, Composition API `computed()` pattern maps cleanly to the calculation engine's unidirectional flow
- **Vite 8** as build tool — use `npm create vite@latest -- --template vue-ts`
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin only — no PostCSS config, no content array, just `@import "tailwindcss"` in main CSS
- **Pinia 3** for state — two stores: `inputStore` (mutable user inputs) and `calculationStore` (read-only `computed()` results derived from inputStore)
- **Decimal.js** for all arithmetic — no native JS float math anywhere in the calculation engine
- **Vitest** for unit tests — calculation engine formulas must have passing tests before any UI component uses them
- **vue-i18n v11** (not v9 or v10 — both entered maintenance mode July 2025)

### raidy Port Approach
- **Copy relevant functions + adapt to TypeScript + Decimal.js** — do not import raidy as a package dependency (zero-dependency static deployment requirement). Port vSAN ESA capacity math functions directly into `src/engine/storage.ts`
- Port checklist: Adaptive RAID-5 thresholds (2+1 at 5 hosts, 4+1 at 6+), LFS overhead (~13%), global metadata pool (~10% of raw), FTT policy multipliers (FTT=1 RAID-1 = 2×, FTT=1 RAID-5 = 1.33×, FTT=2 RAID-6 = 1.5×)
- Write Vitest tests against raidy reference input/output pairs to verify the port is bit-for-bit correct before any UI uses the engine

### Input Interaction Design
- **Number inputs as primary control** — architects need precise values, not sliders
- **Sliders as secondary helper** for key discovery parameters: host count, VM count, vCPU per VM — sliders allow quick sensitivity exploration while the number input shows the exact value
- Number input + slider are coupled: changing either updates the other
- All inputs update the Pinia store reactively (no submit button anywhere in the app)
- Input validation inline (e.g., red border when host cores < 12 for VCFA blocker)

### i18n / Locale Strategy
- **Browser locale detection on first load** — use `navigator.language` to pick initial locale; fall back to `en` if not one of the four
- **Persistent language switcher** in app header, always visible — four buttons or a dropdown: EN / FR / DE / IT
- **Explicit Swiss locales declared**: `fr-CH`, `de-CH`, `it-CH`, `en` — do NOT inherit from `fr` or `de` (Intl does not auto-apply Swiss formatting)
- Number formatting: apostrophe as thousands separator in `de-CH`, space in `fr-CH` — use `Intl.NumberFormat` via vue-i18n's `$n()` helper, not manual string formatting
- All visible text (labels, warnings, descriptions, unit suffixes) must be in locale message files from day one — no hardcoded English strings

### Calculation Engine Architecture
- All formulas live in `src/engine/*.ts` — zero Vue imports in these files (pure TypeScript, testable without mounting any component)
- Module breakdown:
  - `src/engine/management.ts` — VCF management domain components (vCenter, SDDC Manager, NSX, Operations, Automation) with HA multiplier logic
  - `src/engine/compute.ts` — total vCPU and RAM (workload + management), utilization %, over-commitment ratios
  - `src/engine/storage.ts` — vSAN ESA (ported from raidy), FC/NFS pass-through, host count recommendation
  - `src/engine/validation.ts` — hard constraint checks (VCFA 12-core blocker, Global Dedup mutual exclusion)
- `calculationStore` uses Pinia `computed()` refs that call engine functions with `inputStore` values as arguments
- Engine functions are pure: `(inputs: SizingInputs) => SizingResult` — no side effects, no global state

### Management Domain Constants (VCF 9.x, locked)
- vCenter Server: 4 vCPU / 21 GB RAM (×1, always)
- SDDC Manager: 4 vCPU / 16 GB RAM (×1, always)
- NSX Manager: 6 vCPU / 24 GB RAM (×1 Simple, ×3 HA/Stretch)
- VCF Operations: 4 vCPU / 16 GB RAM (×1 Simple, ×3 HA/Stretch) + Fleet Manager 12 GB + Collector 16 GB
- VCF Automation (VCFA): 24 vCPU / 96 GB RAM (×1 Simple, ×3 HA/Stretch)
- VCFA requires minimum 12 physical cores / 24 threads per host — hard blocker warning, not a soft suggestion

### Deployment Models (Phase 1 scope)
- Simple (Lab/POC): no multipliers, 1× all management components
- High Availability (Production): ×3 for NSX Manager, VCF Operations, VCFA
- Stretch Cluster: same ×3 multipliers as HA for management components; full Stretch-specific inputs (per-site host counts, witness) are Phase 3
- In Phase 1, Stretch Cluster selection triggers the ×3 management overhead — Phase 3 adds the site-level inputs on top

### Claude's Discretion
- Exact Tailwind component styling and color palette (use clean defaults — architects, not designers, are the audience)
- Vitest test file organization within `src/engine/`
- TypeScript type definitions for input/output interfaces
- Exact slot layout for the language switcher component
- Whether to use `<script setup>` sugar or explicit `defineComponent` (prefer `<script setup>` for conciseness)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Project vision, constraints (static-only, Swiss locales), raidy asset note
- `.planning/REQUIREMENTS.md` — All 45 Phase 1 requirements (FOUND, I18N, DEPLOY, MGMT, HOST, WKLD, STOR, CALC groups)

### Research Outputs
- `.planning/research/STACK.md` — Verified library versions, Tailwind v4 setup (no PostCSS), vue-i18n v11 installation, exact npm commands
- `.planning/research/ARCHITECTURE.md` — Two-store Pinia pattern, engine module breakdown, VCF formulas with sources, build order
- `.planning/research/PITFALLS.md` — Floating-point pitfalls (use Decimal.js), Swiss locale apostrophe trap, Chart.js shallowRef issue (Phase 2), vSAN ESA Adaptive RAID-5 threshold edge cases
- `.planning/research/SUMMARY.md` — Synthesized recommendations and phase boundary rationale

### VCF 9.x Specification (embedded in research)
- VCF management domain component specs: see `.planning/research/FEATURES.md` §Management Domain Components table
- NVMe Memory Tiering prerequisites: see `.planning/research/FEATURES.md` §NVMe Memory Tiering
- vSAN ESA overhead formula: see `.planning/research/ARCHITECTURE.md` §Storage Engine

No external specs outside .planning/ — all VCF 9.x constants sourced during research phase and captured in research files above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **raidy vSAN calculation logic** — exists in raidy project (separate repo). Contains verified Adaptive RAID-5 thresholds, LFS overhead, metadata pool math. Port `storage.ts` engine functions from raidy to `src/engine/storage.ts` with Decimal.js substitution. Reference raidy test cases as ground-truth for Vitest assertions.

### Established Patterns
- Greenfield: no existing patterns in this repo. Follow patterns documented in `.planning/research/ARCHITECTURE.md`:
  - Two-store Pinia split (inputStore / calculationStore)
  - Pure TS engine functions with zero Vue imports
  - vue-i18n `<i18n>` SFC blocks for component-level strings

### Integration Points
- Phase 1 creates the full foundation — Phase 2 reads `calculationStore` to drive charts and results panel
- `calculationStore` API surface (the `computed()` refs it exposes) must be stable before Phase 2 begins
- i18n locale files establish the translation key namespace that Phase 3 fills out with FR/DE/IT translations

</code_context>

<specifics>
## Specific Ideas

- Tool should feel like a professional infrastructure calculator, not a consumer app — clean, dense, functional (similar to AWS cost calculator or VMware Sizing tools)
- The VCFA 12-core blocker warning must be unmissable — red banner or prominent inline error, not a footnote
- raidy is referenced as the authoritative source for vSAN formula correctness — the port must produce identical results for identical inputs
- Context7 MCP must be used to verify all library API calls before implementation (per CALC-05 and project constraints)

</specifics>

<deferred>
## Deferred Ideas

- Chart visualizations (Chart.js, vue-chartjs) — Phase 2
- Split-screen layout with results panel — Phase 2
- Shareable URL / export — Phase 2
- NVMe Memory Tiering inputs — Phase 3
- Stretch Cluster per-site inputs (witness sizing, cross-site bandwidth) — Phase 3
- AI/GPU workload inputs — Phase 3
- FR/DE/IT translation completion — Phase 3 (Phase 1 wires the i18n infrastructure with EN strings; translations filled in Phase 3)
- Dark mode — v2 backlog

</deferred>

---

*Phase: 01-foundation-engine-and-inputs*
*Context gathered: 2026-03-28*
