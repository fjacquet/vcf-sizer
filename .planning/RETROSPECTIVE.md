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

## Cross-Milestone Trends

| Metric | v2.0 |
|--------|------|
| Phases | 5 |
| Plans | 11 |
| Tests at completion | 120 |
| TypeScript errors at completion | 0 |
| Build size (gzip) | 159 kB |
| Locales | 4 (en/fr/de/it) |
| Duration | 2 days |
