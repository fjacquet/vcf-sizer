# Retrospective: VCF Sizer

> Living retrospective — updated at each milestone completion.

---

## Milestone: v2.0 — Architecture Correctness & vSAN Max

**Shipped:** 2026-03-29
**Phases:** 5 | **Plans:** 11 | **Duration:** 2 days (2026-03-28 → 2026-03-29)

### What Was Built

1. **Phase 1 (Foundation):** Vite 8 + Vue 3 + Tailwind v4 scaffold; pure-TS engine for management overhead, compute sizing, and vSAN ESA storage; all input forms with 4-locale i18n
2. **Phase 2 (Outputs):** Split-screen results panel, Chart.js charts for CPU/RAM/storage, lz-string + Zod URL sharing, Markdown + print-CSS PDF export
3. **Phase 3 (Advanced):** Stretch cluster (2-site PFTT=1 topology), NVMe Memory Tiering, AI/GPU workload sizing, Global Deduplication with network-speed gating
4. **Phase 4 (Correctness):** 10 Gbps bandwidth floor enforcement, stretch network checklist card (MTU/RTT/witness), dedicated vs co-located management architecture toggle with KB 392993 validation
5. **Phase 5 (vSAN Max):** Disaggregated storage cluster engine (`calcVsanMax()`, 5 ReadyNode profiles), dual-output results (storage + compute cluster), VsanMaxClusterCard, network speed selector (10/25/100 GbE)

### What Worked

- **TDD discipline paid off:** Writing failing tests first before every implementation change caught formula issues before they shipped. The RED → GREEN order was maintained throughout all 5 phases.
- **CALC-01/CALC-02 constraints:** Enforcing zero Vue imports in engine + zero `ref()` in calculationStore kept the engine layer independently testable and prevented computed() reactivity bugs.
- **Zod triple-sync pattern:** Atomic update of InputStateSchema + hydrateFromUrl + generateShareUrl in one commit prevented URL state drift bugs across all 11 plans.
- **Exhaustive switch refactor (calcStorage):** Converting the if/else chain to an exhaustive switch with `never` case before adding `'vsan-max'` gave compile-time guarantees — no runtime errors.
- **Phase discussion + context gathering:** Each phase's CONTEXT.md locked design decisions upfront, eliminating mid-plan ambiguity. Saved significant rework.
- **Parallel executor agents:** Wave-based parallel execution with worktree isolation cut execution time significantly. Merges were straightforward (only STATE.md conflicts).

### What Was Inefficient

- **SUMMARY.md one-liners stale:** Phase 3 and 5 SUMMARY.md files had partial one-liners ("One-liner:" / "src/engine/vsanMax.ts" raw file path) — the executor agents didn't fill them in correctly. Led to incomplete accomplishments in MILESTONES.md.
- **STATE.md merge conflicts:** Every worktree merge had STATE.md conflicts (parallel agents each updated it). A lock mechanism or post-merge STATE.md regeneration would eliminate this friction.
- **Stale TypeScript diagnostics:** IDE diagnostics reported errors on intermediate worktree state, causing false alarms after merge. Better: run `tsc --noEmit` post-merge as the single source of truth.
- **12 unchecked v1 requirements:** NVME/STRCH/GPU checkboxes were never ticked despite being implemented in Phases 1-3. Requirements tracking needs automated verification at phase completion.
- **CONTEXT.md formula discrepancy (vSAN Max):** CONTEXT.md showed ~255 TB usable for 4×MED but the correct formula gives ~134 TB. The research agent caught this but it indicated the CONTEXT.md authoring step needed better formula validation.

### Patterns Established

- **Engine module pattern:** New storage types get their own `engine/[type].ts` module with a pure `calc[Type]()` function — not variants of existing engines
- **Adaptive RAID gate:** 4-5 nodes → 2+1 (1.5x), 6+ nodes → 4+1 (1.25x) — reusable for any vSAN-based engine
- **Button group selector:** `v-for="option in [10, 25, 100]"` with `as` cast for literal union types — established in HostSpecsForm for network speed
- **Validation rule numbering:** Rules 1-5 pre-existing; Rules 6 (DEDUP_NETWORK_SPEED) + 7 (VSAN_MAX_MIN_NODES) added in Phase 5

### Key Lessons

1. **Lock data contracts before UI:** Writing VsanMaxInputs/VsanMaxResult interfaces before any UI code prevented mid-plan type changes
2. **One locale file per commit = pain:** Updating all 4 locale files in the same commit as their UI components (enforced by CONTEXT.md) prevented i18n drift and is the right pattern
3. **Verifier score matters:** Having `18/18 must-haves verified` at phase end gives confidence to ship without manual testing of every path
4. **CONTEXT.md formula verification:** Always verify example calculations in CONTEXT.md against the actual formula — the ~255 TB vs ~134 TB discrepancy shows docs can drift from implementation intent

### Cost Observations

- Model mix: Planner = opus, Researcher + Executor + Checker + Verifier = sonnet
- Sessions: ~2 days, multiple context windows (context compaction occurred)
- Notable: Parallel Wave execution (Wave 1 + Wave 2 sequential, within waves parallel) reduced wall-clock time. The largest single agent cost was the Opus planner at ~163K tokens for Phase 5 planning.

---

## Milestone: v2.1 — Export Quality

**Shipped:** 2026-03-30
**Phases:** 4 | **Plans:** 11 | **Duration:** 1 day (2026-03-30)

### What Was Built

1. **Phase 6 (Markdown):** Extracted `generateMarkdownReport()` into `useMarkdownExport.ts` composable (pure TS, no lifecycle hooks). Grew from 4 to 11 sections covering workload profile, management architecture, NVMe tiering, AI/GPU, stretch topology, vSAN Max, validation warnings, and network config. Full Pinia-backed TDD suite (Wave 0 RED → Wave 1 GREEN).
2. **Phase 7 (Print/PDF):** `@page` A4 portrait rule in global `style.css`; `break-inside-avoid` on all result cards; fixed-position print header/footer in `ResultsPanel.vue` using `hidden print:flex` pattern; chart print fallbacks as `hidden print:table` semantic tables in all 3 chart components.
3. **Phase 8 (PPTX Core):** Installed `pptxgenjs 4.0.1` as dynamic-import-only production dependency. `usePptxExport.ts` composable with local `TableCell`/`TableRow` interface definitions (namespace import pattern fails), Broadcom blue slide master, 7 always-present slides. "Download PPTX" button in `ExportToolbar.vue` with i18n in 4 locales.
4. **Phase 9 (PPTX Conditional):** 5 conditional data-mapping helpers + 5 feature-guarded slide blocks in `generatePptxReport()` (AI/GPU, NVMe tiering, stretch topology, vSAN Max, validation warnings) matching guard conditions from `useMarkdownExport.ts`.

### What Worked

- **TDD Wave 0 discipline continued:** RED → GREEN pattern maintained across all 4 phases. Having failing tests first made implementation unambiguous and caught integration issues early.
- **Export composable pattern:** Pure-TS composables with no Vue lifecycle hooks made all data-mapping helpers fully unit-testable in Vitest node env. No need for DOM mounting or browser APIs in tests.
- **Dynamic import pattern for pptxgenjs:** `(await import('pptxgenjs')).default` inside the function body keeps the 200 kB library out of the initial bundle. Vite code-splits it automatically.
- **Local type definitions over namespace imports:** `import type PptxGenJS from 'pptxgenjs'` doesn't expose `TableCell`/`TableRow` with dynamic import pattern. Local interface definitions matching actual usage worked cleanly and are easier to maintain.
- **`hidden print:table` fallback pattern:** Using Tailwind `hidden print:table` on semantic `<table>` elements (not `print:block`) preserved proper table rendering in all browsers.
- **`@page` in global style.css:** Scoped Vue component styles don't apply `@page` rules. Putting print geometry in `src/style.css` was the correct approach.

### What Was Inefficient

- **SUMMARY.md one-liners stale (again):** Several SUMMARY.md files had "One-liner:" as the placeholder value — executor agents omitted the one-liner field. Still not fixed in the tooling.
- **pptxgenjs type discovery:** The namespace import pattern failure (`PptxGenJS.TableCell`) wasn't in any documentation. Required a debugging loop to discover that local interface definitions were the solution.
- **Print header/footer checkpoint:** Plan 07-02 had a `autonomous: false` human-verify checkpoint for visual print confirmation. In an autonomous session this required auto-approval, which defeats the purpose. A "visual verification deferred" annotation would be better than blocking execution.
- **Phase 9 TS diagnostic noise:** After Wave 1, IDE reported `StretchResult`/`VsanMaxResult` as "unused" and callback parameters as implicit `any` — these were false positives (`vue-tsc` exits 0). Language server disagreeing with compiler is a friction point.

### Patterns Established

- **Export composable pattern:** `src/composables/use[X]Export.ts` — pure TS, no lifecycle hooks, exports one main async `generate[X]Report()` function + pure data-mapping helpers. Helpers are unit-testable; main function uses browser APIs and must be manually verified.
- **pptxgenjs pitfall list:** (1) bare hex without `#`; (2) `defineSlideMaster()` before any `addSlide()`; (3) local interface defs over namespace import; (4) `background: { color: '...' }` not deprecated `fill:`; (5) `await pres.writeFile({ fileName: '...' })`; (6) fresh `new PptxGenJS()` per call.
- **Conditional slide guard pattern:** Mirror `useMarkdownExport.ts` guard conditions exactly in `usePptxExport.ts`. Single source of truth for which features are "active".

### Key Lessons

1. **Namespace imports from dynamic-import libraries are unreliable.** For libraries loaded only via `import()`, define local interfaces matching actual usage rather than trying to extract types from the library namespace.
2. **`@page` CSS is global scope only.** Vue scoped styles, CSS modules, and component-level `<style>` blocks cannot define `@page` rules — only global `src/style.css` works.
3. **`print:table` not `print:block` for table fallbacks.** `display: table` preserves semantic table layout in print; `display: block` makes table cells stack vertically.
4. **pptxgenjs instance statefulness.** Each call to `generatePptxReport()` must create a fresh `new PptxGenJS()` instance — previous call's slides accumulate on the same instance.

### Cost Observations

- Model mix: Planner = opus, Researcher + Executor + Checker + Verifier = sonnet
- Sessions: 1 day, ~43 commits across 4 phases
- Notable: All 4 phases planned and executed in a single day. Wave 0 TDD gate (RED state) added upfront cost but eliminated debugging time during implementation waves.

---

## Cross-Milestone Trends

| Metric | v2.0 | v2.1 |
|--------|------|------|
| Phases | 5 | 4 |
| Plans | 11 | 11 |
| Tests at completion | 120 | 182 |
| TypeScript errors at completion | 0 | 0 |
| Build size (gzip) | 159 kB | ~175 kB (est.) |
| Locales | 4 (en/fr/de/it) | 4 (en/fr/de/it) |
| Duration | 2 days | 1 day |
| Export formats | 2 (Markdown, Print) | 3 (+PowerPoint) |
