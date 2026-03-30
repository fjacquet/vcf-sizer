# Phase 6: Markdown Extraction and Enrichment - Research

**Researched:** 2026-03-29
**Domain:** Vue 3 + Pinia composable refactor — TypeScript template-literal Markdown generation
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MD-01 | Extract `generateMarkdownReport()` from `useUrlState.ts` → `src/composables/useMarkdownExport.ts` | Current function located at line 139 of `useUrlState.ts`; extraction is clean cut — function has no dependency on LZString or Zod |
| MD-02 | Add workload profile section (vmCount, avgVcpuPerVm, avgVramGbPerVm, avgStorageGbPerVm, cpuOvercommitRatio, ramOvercommitRatio) | All six fields exist in `inputStore` as `ref()` — direct read in composable |
| MD-03 | Add management architecture section (managementArchitecture, dedicatedMgmtHostCount) | `inputStore.managementArchitecture` + `calculationStore.dedicatedMgmtHostCount` (returns `null` when not 'dedicated') |
| MD-04 | Add NVMe memory tiering section (nvmeTieringEnabled, activeMemoryPct) | Both fields in `inputStore`; section is conditional on `nvmeTieringEnabled === true` |
| MD-05 | Add AI/GPU section (gpuVmCount, vgpuMemoryGB) | Both fields in `inputStore`; section is conditional on `gpuVmCount > 0` |
| MD-06 | Add stretch cluster section (preferredSiteHosts, secondarySiteHosts, stretch result: bandwidth, witness, networkChecklist) | `inputStore` site host counts + `calculationStore.stretch` (StretchResult); conditional on `deploymentMode === 'stretch'` |
| MD-07 | Add vSAN Max section (vsanMaxProfile, vsanMaxStorageNodes, vsanMax result) | `inputStore` profile/nodes + `calculationStore.vsanMax` (VsanMaxResult \| null); conditional on `storageType === 'vsan-max'` |
| MD-08 | Add validation warnings section (validationErrors from calculationStore) | `calculationStore.validationErrors` returns `ValidationWarning[]`; conditional on `validationErrors.length > 0` |
| MD-09 | Add network configuration section (networkSpeedGbE, dedupEnabled, dedupRatio) | All three fields in `inputStore` |
</phase_requirements>

---

## Summary

Phase 6 is a surgical refactor-then-enrich operation. The entire work is TypeScript string template assembly — no new npm dependencies, no new engine functions, no Vue lifecycle hooks. The deliverable is a dedicated `src/composables/useMarkdownExport.ts` that generates a complete 11-section Markdown report.

The current `generateMarkdownReport()` in `useUrlState.ts` (lines 139–196) already produces 4 sections: Host Configuration, Management Domain Overhead, Compute Sizing, and Storage Sizing. Phase 6 moves that function to its proper home and adds 7 new sections covering all remaining feature areas. The extraction step (MD-01) must be completed before any enrichment work so that tests target the canonical module.

The critical planning insight is that the existing test file `useMarkdownExport.test.ts` calls engine functions directly as a workaround for the lack of Pinia setup. After extraction, the test must be rewritten to call `generateMarkdownReport()` through real Pinia stores using `createPinia()` + `setActivePinia()` in `beforeEach`. This Pinia test setup pattern requires no new dependencies — `createPinia` and `setActivePinia` are already exported by the installed `pinia@3.0.4` package and work in the `node` Vitest environment.

**Primary recommendation:** Extract first (MD-01), rewrite the test file to use Pinia setup immediately after, then add each section in a single function enrichment pass (MD-02 through MD-09), adding test cases for each section's presence/absence as you go.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pinia | 3.0.4 (installed) | Store access in composable | Project's state management; `createPinia`/`setActivePinia` available for tests |
| vitest | 4.1.2 (installed) | Test framework | Already configured in `vitest.config.ts`; `include` covers `src/composables/**/*.test.ts` |
| TypeScript template literals | built-in | Markdown string assembly | Zero bundle cost; same pattern as existing `generateMarkdownReport()` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@pinia/testing` | 1.0.3 (in registry, NOT installed) | Pinia test helper | NOT needed — `createPinia` + `setActivePinia` pattern works without it in Node environment |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `createPinia` + `setActivePinia` in beforeEach | `@pinia/testing` createTestingPinia | `@pinia/testing` mocks computed values; for export tests we want REAL computed values to assert on actual data |
| Pure function (no store access in test) | Call `generateMarkdownReport()` with mocked stores | Real store test is more valuable — catches integration bugs where field names drift |

**Installation:** No new packages needed for Phase 6.

---

## Architecture Patterns

### Recommended Project Structure

```
src/composables/
├── useUrlState.ts          # URL state only (hydrateFromUrl, generateShareUrl)
├── useMarkdownExport.ts    # NEW: generateMarkdownReport() — extracted + enriched
└── useMarkdownExport.test.ts  # REWRITTEN: Pinia setup pattern, 11 describe blocks
```

### Pattern 1: Composable with Real Pinia Store Access

**What:** `useMarkdownExport.ts` is a plain TypeScript module that calls `useInputStore()` and `useCalculationStore()` inside the exported function.

**When to use:** Always — same pattern as the existing `generateMarkdownReport()` in `useUrlState.ts`.

**Example (composable):**
```typescript
// src/composables/useMarkdownExport.ts
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

export function generateMarkdownReport(): string {
  const input = useInputStore()
  const calc = useCalculationStore()
  const now = new Date().toISOString().split('T')[0]

  const sections: string[] = [
    `# VCF 9.x Sizing Report`,
    ``,
    `**Generated:** ${now}  `,
    `**Deployment Model:** ${input.deploymentMode}`,
    // ... existing sections ...
  ]

  // Conditional section: NVMe Tiering (MD-04)
  if (input.nvmeTieringEnabled) {
    sections.push(
      ``,
      `## NVMe Memory Tiering`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| Status | Enabled |`,
      `| Active memory percentage | ${input.activeMemoryPct}% |`,
    )
  }

  // Conditional section: AI/GPU (MD-05)
  if (input.gpuVmCount > 0) {
    sections.push(
      ``,
      `## AI/GPU Workloads`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| GPU VM count | ${input.gpuVmCount} |`,
      `| vGPU memory per VM | ${input.vgpuMemoryGB} GB |`,
    )
  }

  // Conditional section: Stretch Cluster (MD-06)
  if (input.deploymentMode === 'stretch') {
    const s = calc.stretch
    sections.push(
      ``,
      `## Stretch Cluster Topology`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| Preferred site hosts | ${input.preferredSiteHosts} |`,
      `| Secondary site hosts | ${input.secondarySiteHosts} |`,
      `| Min inter-site bandwidth | ${s.minBandwidthGbps} Gbps |`,
      `| Witness vCPU | ${s.witnessCores} |`,
      `| Witness RAM | ${s.witnessRamGB} GB |`,
    )
  }

  // Conditional section: vSAN Max (MD-07)
  if (input.storageType === 'vsan-max' && calc.vsanMax !== null) {
    const v = calc.vsanMax
    sections.push(
      ``,
      `## vSAN Max Cluster`,
      ``,
      `| Parameter | Value |`,
      `|-----------|-------|`,
      `| ReadyNode profile | ${input.vsanMaxProfile.toUpperCase()} |`,
      `| Storage node count | ${v.storageNodeCount} |`,
      `| Compute node count | ${v.computeNodeCount} |`,
      `| Raw capacity | ${v.rawCapacityTB.toFixed(2)} TB |`,
      `| Usable capacity | ${v.usableCapacityTB.toFixed(2)} TB |`,
    )
  }

  // Conditional section: Validation Warnings (MD-08)
  if (calc.validationErrors.length > 0) {
    sections.push(``, `## Validation Warnings`, ``)
    for (const w of calc.validationErrors) {
      sections.push(`- **[${w.severity.toUpperCase()}]** ${w.messageKey}`)
    }
  }

  sections.push(``, `---`, `*Generated by VCF Sizer — https://github.com/fjacquet/vcf-sizer*`)
  return sections.join('\n')
}
```

### Pattern 2: Pinia Test Setup in Node Environment

**What:** Use `createPinia()` + `setActivePinia()` in `beforeEach` to give each test a fresh store. Set store fields directly before calling `generateMarkdownReport()`.

**When to use:** All tests in `useMarkdownExport.test.ts` after the extraction.

**Example (test file):**
```typescript
/// <reference types="vitest/globals" />
import { createPinia, setActivePinia } from 'pinia'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { generateMarkdownReport } from './useMarkdownExport'

describe('generateMarkdownReport — always-present sections', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('contains Host Configuration section', () => {
    const report = generateMarkdownReport()
    expect(report).toContain('## Host Configuration')
  })
})

describe('generateMarkdownReport — conditional: AI/GPU (MD-05)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('AI/GPU section absent when gpuVmCount=0 (default)', () => {
    const report = generateMarkdownReport()
    expect(report).not.toContain('## AI/GPU Workloads')
  })

  it('AI/GPU section present when gpuVmCount > 0', () => {
    const input = useInputStore()
    input.gpuVmCount = 5
    input.vgpuMemoryGB = 32
    const report = generateMarkdownReport()
    expect(report).toContain('## AI/GPU Workloads')
    expect(report).toContain('| GPU VM count | 5 |')
  })
})

describe('generateMarkdownReport — conditional: Stretch Cluster (MD-06)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Stretch section absent when deploymentMode=ha', () => {
    const report = generateMarkdownReport()
    expect(report).not.toContain('## Stretch Cluster Topology')
  })

  it('Stretch section present when deploymentMode=stretch', () => {
    const input = useInputStore()
    input.deploymentMode = 'stretch'
    const report = generateMarkdownReport()
    expect(report).toContain('## Stretch Cluster Topology')
    expect(report).toContain('Min inter-site bandwidth')
  })
})
```

### Pattern 3: Conditional Section Guard Logic

**What:** Each optional section is wrapped in a guard that checks the enabling condition from the store.

| Section | Condition | Store path |
|---------|-----------|-----------|
| Workload Profile (MD-02) | Always present | n/a |
| Management Architecture (MD-03) | Always present; dedicatedMgmtHostCount row conditional on `managementArchitecture === 'dedicated'` | `input.managementArchitecture`, `calc.dedicatedMgmtHostCount` |
| NVMe Tiering (MD-04) | `input.nvmeTieringEnabled === true` | `inputStore.nvmeTieringEnabled` |
| AI/GPU (MD-05) | `input.gpuVmCount > 0` | `inputStore.gpuVmCount` |
| Stretch Cluster (MD-06) | `input.deploymentMode === 'stretch'` | `inputStore.deploymentMode` |
| vSAN Max (MD-07) | `input.storageType === 'vsan-max'` (+ `calc.vsanMax !== null` for safety) | `inputStore.storageType`, `calculationStore.vsanMax` |
| Validation Warnings (MD-08) | `calc.validationErrors.length > 0` | `calculationStore.validationErrors` |
| Network Config (MD-09) | Always present | n/a |

**Key clarification:** The Phase 6 success criteria in ROADMAP.md states sections should be present "when the feature is active and absent when it is not." The REQUIREMENTS.md does NOT describe Markdown sections as conditional — it simply says the report "includes" each section. However, the ROADMAP.md success criterion (#3) explicitly states conditional presence/absence. The per-section condition flags above match the analogous PPTX conditional logic from Phase 9 (PPTX-10 through PPTX-14). Use conditional guards.

### Anti-Patterns to Avoid

- **Calling engine functions directly in the test:** The old `useMarkdownExport.test.ts` calls `calcManagement()`, `calcCompute()`, `calcStorage()` directly to build a reference string. After extraction, this is replaced by simply calling `generateMarkdownReport()` with Pinia stores set to controlled values.
- **Calling engine functions directly in the composable:** Read from `calculationStore` computed values only — never import engine functions into `useMarkdownExport.ts`.
- **Leaving `generateMarkdownReport` import in useUrlState.ts:** ExportToolbar.vue currently imports it from `useUrlState`. After extraction, update that import. Failing to do so causes the old incomplete function to remain callable.
- **Null-unsafe access to `calc.vsanMax`:** `calculationStore.vsanMax` returns `VsanMaxResult | null`. Guard with `calc.vsanMax !== null` before accessing `.rawCapacityTB` etc.
- **Null-unsafe access to `calc.dedicatedMgmtHostCount`:** Returns `number | null`. Render a "N/A" or omit the row when null.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pinia test isolation | Manual store reset functions | `createPinia()` + `setActivePinia()` in `beforeEach` | Each `createPinia()` instance is fully isolated; no state leaks between tests |
| Markdown table formatting | Custom column-width alignment code | Fixed-width `| col | value |` format | Markdown renderers handle alignment; uniform format is readable as raw text |
| File download trigger | XHR/fetch to own origin | `URL.createObjectURL(new Blob([...]))` + anchor click | Standard browser-native pattern; no server needed |

**Key insight:** This phase is pure string assembly. There is no library to learn, no API to verify. The only non-trivial task is the Pinia test setup pattern and the conditional section logic.

---

## Common Pitfalls

### Pitfall 1: Stale Import in ExportToolbar.vue

**What goes wrong:** After extracting `generateMarkdownReport()` to `useMarkdownExport.ts`, the function still exists in `useUrlState.ts` until explicitly removed. ExportToolbar.vue continues calling the old incomplete version.

**Why it happens:** The extraction creates the new file but forgets to (a) delete the function from useUrlState.ts and (b) update the import in ExportToolbar.vue.

**How to avoid:** Do both in the same commit: remove from `useUrlState.ts`, add to `useMarkdownExport.ts`, update the import in `ExportToolbar.vue`.

**Warning signs:** Tests pass but the downloaded report still lacks the new sections — the old function is still being called.

### Pitfall 2: Test File Calling Old Engine Functions After Extraction

**What goes wrong:** The rewritten `useMarkdownExport.test.ts` still imports `calcManagement`, `calcCompute`, `calcStorage` from the engine and manually assembles a reference string. The test never exercises `generateMarkdownReport()` itself, so regressions in the composable go undetected.

**Why it happens:** The old test structure (build reference manually, compare strings) is copy-pasted into the new test file without restructuring.

**How to avoid:** New test structure: call `generateMarkdownReport()` directly, assert on section heading presence/absence and key row content. Never reconstruct the full expected string.

### Pitfall 3: `calc.vsanMax` Null Access

**What goes wrong:** `calc.vsanMax.rawCapacityTB` throws "Cannot read properties of null" at runtime because `storageType` is not 'vsan-max'.

**Why it happens:** `calculationStore.vsanMax` is `VsanMaxResult | null` — it returns null when `storageType !== 'vsan-max'`. TypeScript will catch this if strict null checks are on, but a `!` assertion bypasses the guard.

**How to avoid:** Always guard: `if (input.storageType === 'vsan-max' && calc.vsanMax !== null)`. The double guard is not redundant — the store guard is defensive programming against edge cases during hydration.

### Pitfall 4: `calc.dedicatedMgmtHostCount` Null in Dedicated Mode

**What goes wrong:** When `managementArchitecture === 'dedicated'` the dedicated host count row renders "null" in the Markdown table.

**Why it happens:** `calculationStore.dedicatedMgmtHostCount` returns `number | null` — it returns null when `managementArchitecture !== 'dedicated'`. If you access it unconditionally, you get "null" as a string.

**How to avoid:** In the Management Architecture section: always show the architecture value, and only show the dedicated host count row when `calc.dedicatedMgmtHostCount !== null`.

### Pitfall 5: Node Environment Missing `window` for File Download

**What goes wrong:** Tests fail with "window is not defined" if the download trigger code (`URL.createObjectURL`, anchor click) is called in test context.

**Why it happens:** Vitest uses `environment: 'node'` (confirmed in `vitest.config.ts`). No DOM globals.

**How to avoid:** The `generateMarkdownReport()` function must return a `string` only — no file download logic inside it. The download trigger belongs in `ExportToolbar.vue` (create Blob, click anchor). This is already the case for the existing implementation.

### Pitfall 6: `validationErrors` Contains i18n Keys, Not English Text

**What goes wrong:** The warnings section renders raw i18n keys like `validation.hostCount.tooFew` instead of human-readable messages.

**Why it happens:** `ValidationWarning.messageKey` is an i18n key by design (CLAUDE.md: "Validation warnings must use i18n message keys, not English strings"). The export composable runs outside Vue i18n context.

**How to avoid:** Render the i18n key as-is in the Markdown report with a note that these are validation codes. Do not attempt to resolve i18n keys in the composable — the composable has no access to the i18n instance. This is consistent with CALC-01/CALC-02: the composable is Vue-layer but i18n resolution in a non-component context requires explicit `createI18n` setup which is unnecessary complexity. Alternative: expose a human-readable `message` alongside `messageKey` — but that is out of scope for Phase 6.

---

## Code Examples

### Exact Current Signature (to extract verbatim)

```typescript
// Source: src/composables/useUrlState.ts, lines 139-196
export function generateMarkdownReport(): string {
  const calc = useCalculationStore()
  const store = useInputStore()
  const now = new Date().toISOString().split('T')[0]
  // ... returns joined array of template literal strings
}
```

**What it covers today:** Host Configuration (5 rows), Management Domain Overhead (2 rows), Compute Sizing (9 rows), Storage Sizing (7 rows), footer.

**What it is missing (MD-02 through MD-09):**
- Workload Profile section (vmCount, avgVcpuPerVm, avgVramGbPerVm, avgStorageGbPerVm, cpuOvercommitRatio, ramOvercommitRatio)
- Management Architecture row (managementArchitecture + dedicatedMgmtHostCount)
- NVMe Tiering section (conditional)
- AI/GPU section (conditional)
- Stretch Cluster section (conditional)
- vSAN Max section (conditional)
- Validation Warnings section (conditional)
- Network Configuration section (networkSpeedGbE, dedupEnabled, dedupRatio)

### StretchResult Fields Available for MD-06

```typescript
// Source: src/engine/types.ts — StretchResult interface
interface StretchResult {
  totalHosts: number
  witnessCores: number          // 4 (ESA M profile)
  witnessRamGB: number          // 16 (ESA M profile)
  minBandwidthGbps: number      // bandwidth floor result
  effectivePerSiteStorageTB: number
  storageNote: string           // i18n key
  bandwidthFloorApplied: boolean
  networkChecklist: {
    minInterSiteBandwidthGbps: number
    maxInterSiteLatencyMs: number
    maxWitnessLatencyMs: number
    jumboFramesRequired: boolean
    witnessMinBandwidthMbps: number
  }
}
```

### VsanMaxResult Fields Available for MD-07

```typescript
// Source: src/engine/types.ts — VsanMaxResult interface
interface VsanMaxResult {
  rawCapacityTB: number
  usableCapacityTB: number
  raidScheme: string
  storageNodeCount: number
  computeNodeCount: number
  belowMinNodes: boolean
}
```

### ValidationWarning Structure for MD-08

```typescript
// Source: src/engine/types.ts — ValidationWarning interface
interface ValidationWarning {
  code: string              // short code, e.g. 'HOST_COUNT_TOO_FEW'
  severity: 'error' | 'warning'
  messageKey: string        // i18n key — NOT English text
}
```

### Pinia Test Setup Pattern (no @pinia/testing needed)

```typescript
// Works in Vitest node environment with pinia@3.0.4
import { createPinia, setActivePinia } from 'pinia'
import { useInputStore } from '@/stores/inputStore'

beforeEach(() => {
  setActivePinia(createPinia())
})

it('AI/GPU section present when gpuVmCount=5', () => {
  const input = useInputStore()
  input.gpuVmCount = 5
  input.vgpuMemoryGB = 32
  const report = generateMarkdownReport()
  expect(report).toContain('## AI/GPU Workloads')
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `generateMarkdownReport()` in `useUrlState.ts` | Dedicated `useMarkdownExport.ts` composable | Phase 6 (now) | Clean separation of URL-state vs export responsibility |
| Test builds reference string from engine functions | Test calls `generateMarkdownReport()` via Pinia stores | Phase 6 (now) | Tests catch composable-level bugs, not just engine-level bugs |
| 4-section report | 11-section report | Phase 6 (now) | Complete coverage of all feature areas |

**Deprecated/outdated:**
- `generateMarkdownReport` export from `useUrlState.ts`: removed in this phase; callers must update imports.

---

## Open Questions

1. **Markdown section ordering**
   - What we know: current function order is Host Config → Management → Compute → Storage
   - What's unclear: preferred order for the 7 new sections relative to existing 4
   - Recommendation: Suggested order — Header, Host Config, Workload Profile (MD-02), Management Architecture (MD-03), NVMe Tiering (MD-04, conditional), AI/GPU (MD-05, conditional), Compute Sizing, Storage Sizing, Network Config (MD-09), Stretch Cluster (MD-06, conditional), vSAN Max (MD-07, conditional), Validation Warnings (MD-08, conditional), Footer

2. **i18n keys in validation warnings section**
   - What we know: `ValidationWarning.messageKey` is always an i18n key string, never English
   - What's unclear: whether to render raw keys or try to map them to hard-coded English equivalents in the composable
   - Recommendation: Render raw keys for Phase 6. A comment in the section noting "validation codes" is sufficient. Full i18n resolution in export is a v2.2+ concern.

3. **Stretch network checklist in Markdown**
   - What we know: `StretchResult.networkChecklist` has 5 boolean/numeric fields (MD-06 requirement says "network checklist items")
   - What's unclear: should checklist items be a table or a bullet list with checkboxes?
   - Recommendation: Render as a Markdown checklist (`- [ ] Jumbo frames enabled`) for the boolean fields and a table for the numeric thresholds. This matches the UI component (`StretchNetworkChecklist`) structure.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — this phase is pure TypeScript/string assembly with no CLI tools, databases, or external services)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/composables/useMarkdownExport.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MD-01 | `generateMarkdownReport` importable from `useMarkdownExport.ts` | unit | `npx vitest run src/composables/useMarkdownExport.test.ts` | ✅ (needs rewrite) |
| MD-02 | Workload profile section present in report | unit | same | ✅ (needs new test) |
| MD-03 | Management architecture section present; dedicated host count row conditional | unit | same | ✅ (needs new test) |
| MD-04 | NVMe tiering section absent when disabled, present when enabled | unit | same | ✅ (needs new test) |
| MD-05 | AI/GPU section absent when gpuVmCount=0, present when >0 | unit | same | ✅ (needs new test) |
| MD-06 | Stretch section absent for non-stretch modes, present for deploymentMode=stretch | unit | same | ✅ (needs new test) |
| MD-07 | vSAN Max section absent for non-vsan-max types, present for storageType=vsan-max | unit | same | ✅ (needs new test) |
| MD-08 | Validation warnings section absent when no errors, present when errors exist | unit | same | ✅ (needs new test) |
| MD-09 | Network configuration section present with networkSpeedGbE, dedupEnabled, dedupRatio | unit | same | ✅ (needs new test) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/composables/useMarkdownExport.test.ts`
- **Per wave merge:** `npm test` (all 120+ tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/composables/useMarkdownExport.ts` — the new file (does not exist yet; test imports it)
- [ ] Rewrite `src/composables/useMarkdownExport.test.ts` — replace engine-direct test setup with `createPinia` + `setActivePinia` pattern; add describe blocks for each of MD-02 through MD-09

*(Existing test infrastructure covers all phase requirements once the composable file is created and the test file is rewritten)*

---

## Project Constraints (from CLAUDE.md)

- **CALC-01:** Engine files (`src/engine/*.ts`) must never import from Vue, Pinia, or any Vue ecosystem library. `useMarkdownExport.ts` lives in `src/composables/` — not engine — so this is not a constraint on Phase 6 work.
- **CALC-02:** `calculationStore.ts` must never contain `ref()` — only `computed()`. Phase 6 does not touch `calculationStore.ts`.
- **i18n keys:** Validation warnings must use i18n message keys, not English strings. The export composable renders the raw `messageKey` string — this is correct behavior.
- **No DOM in tests:** `vitest.config.ts` sets `environment: 'node'`. `generateMarkdownReport()` must return a string only — all download/Blob logic stays in `ExportToolbar.vue`.
- **Path alias:** Use `@/` for imports within `src/` (e.g., `@/stores/inputStore`).
- **Test coverage scope:** `vitest.config.ts` includes `src/composables/**/*.test.ts` — `useMarkdownExport.test.ts` is already in scope.

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `src/composables/useUrlState.ts` — confirmed exact `generateMarkdownReport()` signature at lines 139–196
- Direct code inspection: `src/composables/useMarkdownExport.test.ts` — confirmed current test structure (engine-direct, no Pinia setup)
- Direct code inspection: `src/stores/inputStore.ts` — confirmed all 27 `ref()` fields and their names
- Direct code inspection: `src/stores/calculationStore.ts` — confirmed all 7 `computed()` exports: `management`, `compute`, `storage`, `stretch`, `vsanMax`, `validationErrors`, `dedicatedMgmtHostCount`
- Direct code inspection: `src/engine/types.ts` — confirmed `StretchResult`, `VsanMaxResult`, `ValidationWarning` interface shapes
- Direct code inspection: `vitest.config.ts` — confirmed `environment: 'node'`, `globals: true`, include pattern
- `npm info pinia` — version 3.0.4; `createPinia`, `setActivePinia` confirmed exported
- Node REPL verification — `createPinia`/`setActivePinia` accessible from installed pinia package

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md` — Phase 1 (Markdown) description; store field mapping table; anti-pattern documentation
- `.planning/research/ARCHITECTURE.md` — export layer target state diagram; CALC-01/CALC-02 compatibility matrix; data flow diagram

### Tertiary (LOW confidence)

- None — all findings are from direct code inspection of the project.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified by direct inspection of installed `node_modules` and `package.json`
- Architecture: HIGH — current `generateMarkdownReport()` read verbatim; all store fields enumerated from source
- Pitfalls: HIGH — derived from reading actual test file and tracing actual import chain

**Research date:** 2026-03-29
**Valid until:** 2026-04-30 (stable patterns; only invalidated if pinia or vitest major version changes)
