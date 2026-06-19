# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server at http://localhost:5173
npm run build        # type-check (vue-tsc) then Vite production build → dist/
npm run test         # run all tests (Vitest, node environment)
npm run type-check   # run vue-tsc without emitting (included in build)
npm run preview      # preview production build locally
```

Run a single test file:

```bash
npx vitest run src/engine/storage.test.ts
```

Tests cover `src/engine/**/*.test.ts`, `src/composables/**/*.test.ts`, and `src/stores/**/*.test.ts` — no DOM environment needed. Store tests wire real `inputStore` + `calculationStore` instances via Pinia and assert cross-store contracts (e.g., `aggregateTotals`, auto-correction cascade).

## Architecture

### Strict Layer Separation (enforced by convention)

**Engine layer** (`src/engine/`) — Pure TypeScript, **zero Vue imports** (CALC-01). All sizing formulas are plain functions that accept typed inputs and return typed results. This is what the tests cover.

**Store layer** (`src/stores/`) — Two stores with a hard separation:

- `inputStore.ts` — all `ref()` mutable state (slider values, toggles)
- `calculationStore.ts` — **zero `ref()`** (CALC-02); only `computed()` values that call engine functions. Read-only derived state.
- `uiStore.ts` — locale switching and UI flags

**Component layer** (`src/components/`) — split into `input/` (forms), `results/` (display), `shared/` (reusable). Components read from stores, never call engine functions directly.

**Composables** (`src/composables/`) — plain TypeScript modules (no Vue lifecycle hooks). `useUrlState.ts` handles lz-string URL compression + Zod validation for shareable links. `useMarkdownExport.ts` generates Markdown/PDF export.

### i18n

4 locales: `en` (bundled), `fr-CH`, `de-CH`, `it-CH` (lazy-loaded on demand via `uiStore.setLocale`). All validation warning messages use i18n keys — never raw English strings. Swiss locales define explicit `numberFormats` (do not inherit from parent locale `fr`/`de`/`it`).

### URL State

`useUrlState.ts` serializes `inputStore` to JSON, compresses with lz-string, and appends as a URL query param. On load, `main.ts` calls `hydrateFromUrl()` which decompresses and validates through a Zod schema (`.strip()` discards unknown keys). The Zod schema mirrors `inputStore` with all fields optional + defaults.

### Path Alias

`@/` maps to `src/` throughout the project (configured in both `vite.config.ts` and `tsconfig.app.json`).

## Key Constraints

- Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library.
- `calculationStore.ts` must never contain `ref()` — only `computed()`.
- Validation warnings must use i18n message keys (e.g. `'validation.hostCount.tooFew'`), not English strings.
- `VueI18nPlugin` is configured with `include` omitted intentionally to avoid a rolldown/JSON conflict with Vite 8.

## Sizing model: demand-driven (CALC)

The workload engine lives in `src/engine/workload/` (`calcWorkloadFull` orchestrates `demand` →
`clusters` → `capacity` → `validation`). Host/cluster counts and capacity are **outputs**; the only
host-side inputs are the building-block host spec, `deploymentMode`, and `hostFailuresToTolerate`.

- `WorkloadCapacityResult.workloadStorageRequiredTiB` is **non-zero only for FC/NFS** (VM demand =
  `vmCount × avgStorageGbPerVm / 1024`). For vSAN ESA/Max it is **0** — vSAN demand is satisfied via
  `minHostsForStorage`, not a pool. FC/NFS additionally exposes `requiredPoolTiB` / `availablePoolTiB`
  / `poolShortfallTiB` (→ `FC_POOL_SHORTFALL` when the external pool is undersized).
- `minHostsForStorage` is computed **inside the engine** (`calcWorkloadFull` → `calcMinHostsForVsanEsa`,
  per site). It is NOT computed in the store.
- Host counts are per-site/total **outputs**: `demandHostsPerSite` (raw) → `hostsPerCluster` ×
  `clusterCountPerSite` = `hostsPerSite`; `totalHosts` = `hostsPerSite × 2` for stretch. Multi-cluster
  auto-split keeps `demandPerCluster + hostFailuresToTolerate ≤` the VMware per-cluster max.
- `aggregateTotals.totalRecommendedHosts` sums each domain's `totalHosts` (all clusters, both sites)
  plus the management `totalHosts`.
- Management host count is owned solely by `calcManagementFull` (`MgmtDomainResult.totalHosts`); the
  store reads it directly. Per-site floor is storage-type aware (vSAN 4 / FC-NFS 2; KB 392993 / 416270).
- A vSAN witness (`StretchResult.requiresVsanWitness`) applies **only to vSAN ESA** stretch; FC/NFS
  stretch is a vMSC (array-based quorum, no vSAN witness).

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`. Triggers on push to `main` branch. Build output goes to `dist/`. The Vite `base` is `/vcf-sizer/`.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->