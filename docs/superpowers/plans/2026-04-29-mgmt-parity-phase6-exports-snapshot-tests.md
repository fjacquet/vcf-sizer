# Mgmt Parity Phase 6 — Exports + Workbook-Parity Snapshot Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the **final phase** of the v3.5 milestone: enrich the Markdown and PPTX exports with itemized appliance/WLD-overhead tables + external pool TiB visibility, and add a snapshot test suite that locks engine defaults to VMware's workbook reference output for the Standard / Medium / Default scenarios.

**Architecture:** Two layers of changes. (1) **Export rendering** — extend `useMarkdownExport.ts` and `usePptxExport.ts` to consume the existing `MgmtDomainResult.appliances` and `wldOverhead` arrays (already populated by P2.6 / P5.5 orchestrator) and render them as multi-column tables. Add an "External pool" row when storageType is FC/NFS. (2) **Snapshot tests** — three new tests in `src/engine/mgmt/index.test.ts` that pin specific numeric outputs for the Standard-profile / Simple, HA, and Stretch scenarios, asserting the engine matches VMware's reference workbook expectations.

**Tech Stack:** Existing — TypeScript, vue-i18n (4-locale parity), pptxgenjs `slide.addTable()` API, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md` — §6 (UI mockup of MgmtSizingTable, mirrored here for exports), §11 P6 (this phase), Appendix A (sizing tables for the snapshot expected values), Appendix B (profile presets).

**Total tasks:** 4. Estimated time: ~half a day.

---

## Reuse from prior phases (already in place)

Both exports already iterate `calc.aggregateTotals` and per-domain results. The new data they need is on `calc.management`:

- `calc.management.appliances: ApplianceLine[]` — itemized appliance set (P2.3)
- `calc.management.wldOverhead: ApplianceLine[]` — auto-derived per-WLD vCenter+NSX (P2.4)
- `calc.management.totalDiskGB`, `totalSwapGB` — already present (P2.6)
- `calc.management.externalPoolRequiredTiB` — already present (P2.6); >0 only for FC/NFS

The UI's `MgmtSizingTable.vue` (P4.5) renders the same data — read it for the layout pattern.

---

## File Structure

```
src/composables/
├── useMarkdownExport.ts        # MODIFIED (Tasks 6.1 + 6.2)
└── usePptxExport.ts            # MODIFIED (Task 6.3)

src/engine/mgmt/
└── index.test.ts               # MODIFIED (Task 6.4 — new snapshot tests appended)

src/i18n/locales/
├── en.json                     # MODIFIED (Tasks 6.1, 6.2, 6.3 — new export.* keys)
├── fr.json                     # MODIFIED (same)
├── it.json                     # MODIFIED (same)
└── de.json                     # MODIFIED (same)
```

No new files. No engine, store, or component changes — exports + tests only.

---

## Task 6.1 — Markdown: itemized appliance + WLD overhead tables

**Files:**
- Modify: `src/composables/useMarkdownExport.ts`
- Modify: `src/i18n/locales/{en,fr,it,de}.json`

The current "Management Domain Overhead" section renders only `totalCores` / `totalRamGB`. Add two new sections after it: **Management Appliance Sizing** (itemized) and **Workload-Domain Overhead (Auto-derived)** (when wldOverhead.length > 0).

- [ ] **Step 1: Add i18n keys to all 4 locales**

Append under the existing `export` namespace.

**EN keys:**
- `export.mgmtAppliances`: "Management Appliance Sizing"
- `export.wldOverheadAuto`: "Workload-Domain Overhead (Auto-derived)"
- `export.applianceComponent`: "Component"
- `export.applianceNodes`: "Nodes"
- `export.appliancePerNodeCores`: "Cores/node"
- `export.appliancePerNodeRam`: "RAM/node (GB)"
- `export.appliancePerNodeDisk`: "Disk/node (GB)"
- `export.applianceTotalCores`: "Total cores"
- `export.applianceTotalRam`: "Total RAM (GB)"
- `export.applianceTotalDisk`: "Total disk (GB)"
- `export.applianceTotals`: "Totals"

**FR translations:**
- mgmtAppliances: "Dimensionnement des appliances de gestion"
- wldOverheadAuto: "Surcout domaine de charge (auto-derive)"
- applianceComponent: "Composant"
- applianceNodes: "Noeuds"
- appliancePerNodeCores: "Coeurs/noeud"
- appliancePerNodeRam: "RAM/noeud (Go)"
- appliancePerNodeDisk: "Disque/noeud (Go)"
- applianceTotalCores: "Coeurs totaux"
- applianceTotalRam: "RAM totale (Go)"
- applianceTotalDisk: "Disque total (Go)"
- applianceTotals: "Totaux"

**IT translations:**
- mgmtAppliances: "Dimensionamento appliance di gestione"
- wldOverheadAuto: "Overhead dominio di carico (auto-derivato)"
- applianceComponent: "Componente"
- applianceNodes: "Nodi"
- appliancePerNodeCores: "Core/nodo"
- appliancePerNodeRam: "RAM/nodo (GB)"
- appliancePerNodeDisk: "Disco/nodo (GB)"
- applianceTotalCores: "Core totali"
- applianceTotalRam: "RAM totale (GB)"
- applianceTotalDisk: "Disco totale (GB)"
- applianceTotals: "Totali"

**DE translations:**
- mgmtAppliances: "Management-Appliance-Dimensionierung"
- wldOverheadAuto: "Workload-Domain-Overhead (auto-abgeleitet)"
- applianceComponent: "Komponente"
- applianceNodes: "Knoten"
- appliancePerNodeCores: "Kerne/Knoten"
- appliancePerNodeRam: "RAM/Knoten (GB)"
- appliancePerNodeDisk: "Festplatte/Knoten (GB)"
- applianceTotalCores: "Gesamtkerne"
- applianceTotalRam: "Gesamt-RAM (GB)"
- applianceTotalDisk: "Gesamt-Festplatte (GB)"
- applianceTotals: "Summen"

- [ ] **Step 2: Add helper function in `src/composables/useMarkdownExport.ts`**

Read the file first. After the existing imports, add a helper that converts an `ApplianceLine[]` into a Markdown table:

```ts
import type { ApplianceLine } from '@/engine/mgmt/types'

function renderApplianceTable(
  lines: readonly ApplianceLine[],
  t: (key: string) => string,
  categoryLabel: (line: ApplianceLine) => string,
): string[] {
  const rows: string[] = []
  rows.push(
    `| ${t('export.applianceComponent')} | ${t('export.applianceNodes')} | ${t('export.appliancePerNodeCores')} | ${t('export.appliancePerNodeRam')} | ${t('export.appliancePerNodeDisk')} | ${t('export.applianceTotalCores')} | ${t('export.applianceTotalRam')} | ${t('export.applianceTotalDisk')} |`,
    `|-----------|-------|------------|----------|-----------|-------------|------------|------------|`,
  )
  for (const line of lines) {
    rows.push(
      `| ${categoryLabel(line)} | ${line.nodeCount} | ${line.cores} | ${line.ramGB} | ${line.diskGB} | ${line.totalCores} | ${line.totalRamGB} | ${line.totalDiskGB} |`,
    )
  }
  // Footer: totals row
  const totalCores = lines.reduce((s, l) => s + l.totalCores, 0)
  const totalRam = lines.reduce((s, l) => s + l.totalRamGB, 0)
  const totalDisk = lines.reduce((s, l) => s + l.totalDiskGB, 0)
  rows.push(
    `| **${t('export.applianceTotals')}** |  |  |  |  | **${totalCores}** | **${totalRam}** | **${totalDisk}** |`,
  )
  return rows
}
```

Right below `renderApplianceTable`, add a category-label helper that uses vue-i18n's `te()` fallback (mirror the pattern in `MgmtSizingTable.vue`):

```ts
function makeCategoryLabel(t: (key: string) => string, te: (key: string) => boolean) {
  return function categoryLabel(line: ApplianceLine): string {
    const dedicated = `mgmt.categories.${line.category}`
    if (te(dedicated)) return t(dedicated)
    const optional = `mgmt.optionalAppliances.categories.${line.category}`
    if (te(optional)) return t(optional)
    return line.category as string
  }
}
```

- [ ] **Step 3: Use the helper after the existing "Management Domain Overhead" section**

Find the existing `## ${t('export.mgmtOverhead')}` block (around line 50). Right after the closing of its table, add:

```ts
  // P6: Itemized management appliance table
  const { te } = useI18n()
  const categoryLabel = makeCategoryLabel(t, te)

  if (calc.management.appliances.length > 0) {
    sections.push(
      ``,
      `## ${t('export.mgmtAppliances')}`,
      ``,
      ...renderApplianceTable(calc.management.appliances, t, categoryLabel),
    )
  }

  // P6: Workload-domain overhead table (auto-derived per-WLD)
  if (calc.management.wldOverhead.length > 0) {
    sections.push(
      ``,
      `## ${t('export.wldOverheadAuto')}`,
      ``,
      ...renderApplianceTable(calc.management.wldOverhead, t, categoryLabel),
    )
  }
```

(If `useI18n` is not yet imported at the top of the file, the existing usage of `t` already imports it — find that usage and reuse the same `te` from the existing destructure. Search for `const { t }` in the file and add `te` to the destructure.)

- [ ] **Step 4: Run type-check + tests + build**

```bash
npm run type-check
npm run test
npm run build
```

Expected: clean. 520/520 tests pass.

- [ ] **Step 5: Manual verification**

```bash
npm run dev &
DEV_PID=$!
sleep 5
curl -sf http://localhost:5173/ > /dev/null && echo "✓ dev server up" || echo "✗ dev server down"
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
```

Server boots cleanly. (Visual verification of the rendered Markdown is for the user to do — open the wizard, click "Export Markdown", inspect the downloaded file.)

- [ ] **Step 6: Commit**

```bash
git add src/composables/useMarkdownExport.ts src/i18n/locales/*.json
git commit -m "feat(export): phase 6.1 — markdown itemized appliance + WLD overhead tables

The markdown export now mirrors VMware's workbook output by rendering
two new tables right under the existing 'Management Domain Overhead'
totals:

1. Management Appliance Sizing — one row per appliance line in
   calc.management.appliances (the 13 user-overridable categories
   + SDDC Manager + always-on Fleet Manager + any enabled validated
   solutions). Eight columns: Component, Nodes, Cores/node, RAM/node,
   Disk/node, Total cores, Total RAM, Total disk. Footer totals row.

2. Workload-Domain Overhead (Auto-derived) — one row per workload
   domain's auto-derived vCenter + NSX Manager appliances on the
   mgmt cluster. Same 8-column layout. Section omitted when no WLDs.

Category labels resolve via vue-i18n te() fallback through three
namespaces (mgmt.categories.* → mgmt.optionalAppliances.categories.*
→ raw key), matching the MgmtSizingTable.vue UI pattern from P4.5.

i18n: 11 new keys per locale (en/fr/it/de) under export.*

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §6 + §11 P6"
```

---

## Task 6.2 — Markdown: external pool TiB + total disk + total swap rows

**Files:**
- Modify: `src/composables/useMarkdownExport.ts`
- Modify: `src/i18n/locales/{en,fr,it,de}.json`

Extend the existing "Management Domain Overhead" section (basic totals) with three more rows: total disk, total swap, and external pool TiB (when FC/NFS).

- [ ] **Step 1: Add i18n keys to all 4 locales**

Append under `export.*`:

**EN:**
- `export.totalDiskGB`: "Total disk (GB)"
- `export.totalSwapGB`: "Total swap (GB)"
- `export.externalPoolRequiredTiB`: "External pool required (TiB)"

**FR:**
- totalDiskGB: "Disque total (Go)"
- totalSwapGB: "Swap total (Go)"
- externalPoolRequiredTiB: "Pool externe requis (Tio)"

**IT:**
- totalDiskGB: "Disco totale (GB)"
- totalSwapGB: "Swap totale (GB)"
- externalPoolRequiredTiB: "Pool esterno richiesto (TiB)"

**DE:**
- totalDiskGB: "Gesamt-Festplatte (GB)"
- totalSwapGB: "Gesamt-Swap (GB)"
- externalPoolRequiredTiB: "Externer Pool erforderlich (TiB)"

- [ ] **Step 2: Modify `src/composables/useMarkdownExport.ts`**

Find the existing "Management Domain Overhead" block (the table with `totalVcpu` and `totalRam` rows). Add three new rows below `totalRam`:

```ts
  sections.push(
    ``,
    `## ${t('export.mgmtOverhead')}`,
    ``,
    `| ${t('export.resource')} | ${t('export.required')} |`,
    `|----------|---------|`,
    `| ${t('export.totalVcpu')} | ${calc.management.totalCores} |`,
    `| ${t('export.totalRam')} | ${calc.management.totalRamGB} GB |`,
    // P6.2: total disk + swap (always present)
    `| ${t('export.totalDiskGB')} | ${calc.management.totalDiskGB} |`,
    `| ${t('export.totalSwapGB')} | ${calc.management.totalSwapGB} |`,
    // P6.2: external pool requirement (FC/NFS only — undefined for vSAN)
    ...(calc.management.externalPoolRequiredTiB > 0 ? [
      `| ${t('export.externalPoolRequiredTiB')} | ${calc.management.externalPoolRequiredTiB.toFixed(2)} |`,
    ] : []),
  )
```

- [ ] **Step 3: Run verification**

```bash
npm run type-check && npm run test && npm run build
```

Expected: clean. 520/520 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/composables/useMarkdownExport.ts src/i18n/locales/*.json
git commit -m "feat(export): phase 6.2 — markdown total disk/swap + external pool rows

The 'Management Domain Overhead' section in the markdown report
now exposes the storage demand alongside the existing core/RAM
totals:

- Total disk (GB) — sum of every appliance's disk allocation
- Total swap (GB) — equal to totalRamGB (mgmt VM swap demand)
- External pool required (TiB) — visible only when storageType is
  FC or NFS (rendered as 0 for vSAN; row hidden via filter)

3 new i18n keys per locale (en/fr/it/de).

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §6"
```

---

## Task 6.3 — PPTX: itemized appliance + WLD overhead tables

**Files:**
- Modify: `src/composables/usePptxExport.ts`
- Modify: `src/i18n/locales/{en,fr,it,de}.json` (only if Task 6.1 keys haven't covered the labels — they should have)

Use pptxgenjs's `slide.addTable(rows, options)` API to render a tabular slide for the management appliances. Same 8-column layout as the markdown.

- [ ] **Step 1: Read `src/composables/usePptxExport.ts`** to understand the existing slide-creation pattern. Look at how `slide.addText`, `slide.addShape`, etc. are composed.

- [ ] **Step 2: Add a helper function in `usePptxExport.ts`**

After the existing helpers, add:

```ts
import type { ApplianceLine } from '@/engine/mgmt/types'

interface ApplianceTableOptions {
  pres: any  // PptxGenJS instance
  slide: any
  title: string
  lines: readonly ApplianceLine[]
  categoryLabel: (line: ApplianceLine) => string
  t: (key: string) => string
  startY: number
  width: number
}

function addApplianceTable(opts: ApplianceTableOptions): number {
  const { pres: _pres, slide, title, lines, categoryLabel, t, startY, width } = opts
  void _pres

  // Title above the table
  slide.addText(title, {
    x: 0.5, y: startY, w: width, h: 0.35,
    fontSize: 14, bold: true, color: '1F2937',
  })

  // Build rows: header + data + footer (totals)
  const headerStyle = { bold: true, fill: { color: 'F3F4F6' }, color: '1F2937' }
  const cellStyle = { color: '1F2937' }
  const footerStyle = { bold: true, fill: { color: 'F9FAFB' }, color: '1F2937' }

  const totalCores = lines.reduce((s, l) => s + l.totalCores, 0)
  const totalRam = lines.reduce((s, l) => s + l.totalRamGB, 0)
  const totalDisk = lines.reduce((s, l) => s + l.totalDiskGB, 0)

  const rows = [
    [
      { text: t('export.applianceComponent'), options: headerStyle },
      { text: t('export.applianceNodes'), options: headerStyle },
      { text: t('export.appliancePerNodeCores'), options: headerStyle },
      { text: t('export.appliancePerNodeRam'), options: headerStyle },
      { text: t('export.appliancePerNodeDisk'), options: headerStyle },
      { text: t('export.applianceTotalCores'), options: headerStyle },
      { text: t('export.applianceTotalRam'), options: headerStyle },
      { text: t('export.applianceTotalDisk'), options: headerStyle },
    ],
    ...lines.map(line => [
      { text: categoryLabel(line), options: cellStyle },
      { text: String(line.nodeCount), options: cellStyle },
      { text: String(line.cores), options: cellStyle },
      { text: String(line.ramGB), options: cellStyle },
      { text: String(line.diskGB), options: cellStyle },
      { text: String(line.totalCores), options: cellStyle },
      { text: String(line.totalRamGB), options: cellStyle },
      { text: String(line.totalDiskGB), options: cellStyle },
    ]),
    [
      { text: t('export.applianceTotals'), options: footerStyle },
      { text: '', options: footerStyle },
      { text: '', options: footerStyle },
      { text: '', options: footerStyle },
      { text: '', options: footerStyle },
      { text: String(totalCores), options: footerStyle },
      { text: String(totalRam), options: footerStyle },
      { text: String(totalDisk), options: footerStyle },
    ],
  ]

  // Estimate table height: ~0.25 inches per row + title + small padding
  const rowH = 0.25
  const tableH = rowH * rows.length + 0.1
  slide.addTable(rows, {
    x: 0.5,
    y: startY + 0.4,
    w: width,
    rowH,
    fontSize: 9,
    border: { type: 'solid', pt: 0.5, color: 'D1D5DB' },
  })

  return startY + 0.4 + tableH + 0.2 // next slide-Y position
}
```

- [ ] **Step 3: Add a new slide with the appliance table to the PPTX export**

Find where slides are added in `usePptxExport.ts`. After the existing management/aggregate slides, add a new "Management Appliance Sizing" slide:

```ts
  // P6.3: Management appliance sizing slide
  if (calc.management.appliances.length > 0) {
    const slide = pres.addSlide()
    slide.addText(t('export.mgmtAppliances'), {
      x: 0.5, y: 0.3, w: 9, h: 0.5,
      fontSize: 22, bold: true, color: '1F2937',
    })
    addApplianceTable({
      pres,
      slide,
      title: t('export.mgmtAppliances'),
      lines: calc.management.appliances,
      categoryLabel: makeCategoryLabel(t, te),
      t,
      startY: 1.0,
      width: 9,
    })
  }

  // P6.3: WLD overhead slide (when applicable)
  if (calc.management.wldOverhead.length > 0) {
    const slide = pres.addSlide()
    slide.addText(t('export.wldOverheadAuto'), {
      x: 0.5, y: 0.3, w: 9, h: 0.5,
      fontSize: 22, bold: true, color: '1F2937',
    })
    addApplianceTable({
      pres,
      slide,
      title: t('export.wldOverheadAuto'),
      lines: calc.management.wldOverhead,
      categoryLabel: makeCategoryLabel(t, te),
      t,
      startY: 1.0,
      width: 9,
    })
  }
```

(Reuse the same `makeCategoryLabel` helper as Task 6.1; if it lives in `useMarkdownExport.ts`, either copy it locally to `usePptxExport.ts` or extract to a small new file `src/composables/applianceLabel.ts`. Pick the simpler path: copy locally for now.)

- [ ] **Step 4: Verify**

```bash
npm run type-check && npm run test && npm run build
```

Expected: clean. 520/520.

If pptxgenjs's `addTable` rejects the row format, inspect the package's TypeScript definitions in `node_modules/pptxgenjs/types/index.d.ts` and adjust the row structure accordingly. The text-cells-with-options format above is canonical for pptxgenjs v3.x+.

- [ ] **Step 5: Commit**

```bash
git add src/composables/usePptxExport.ts src/i18n/locales/*.json
git commit -m "feat(export): phase 6.3 — pptx itemized appliance + WLD overhead slides

The PPTX export now adds two new slides matching the markdown
export's layout (P6.1):

1. 'Management Appliance Sizing' — one row per appliance, 8-column
   table via pptxgenjs's addTable() API. Header + data + footer
   totals.

2. 'Workload-Domain Overhead (Auto-derived)' — same layout for the
   auto-derived per-WLD vCenter + NSX Manager appliances. Slide
   omitted when no WLDs.

Reuses the i18n keys added in P6.1 (export.mgmtAppliances,
applianceComponent, applianceNodes, etc.).

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §6 + §11 P6"
```

---

## Task 6.4 — Workbook-parity snapshot tests

**Files:**
- Modify: `src/engine/mgmt/index.test.ts`

Add a new `describe` block with three locked-value tests for the Standard profile across Simple, HA, and Stretch modes — pinning `totalCores`, `totalRamGB`, `totalDiskGB`, and `recommendedHostCount` to specific numbers derived from VMware's workbook + the profile presets.

- [ ] **Step 1: Add the new test block at the end of `src/engine/mgmt/index.test.ts`**

The expected values come from:
- Standard profile (P1.3 / Appendix B): vCenter Medium, NSX Mgr Medium, NSX Edge Large × 2, AVI Small × 3, vROps Medium, vRLI Medium, vRNI Medium × 1, Automation Medium, Fleet Mgr × 1.
- Constants (P1.2 / Appendix A): SDDC 4/16/914, vCenter Medium 8/30/908, NSX Mgr Medium 6/24/300, NSX Edge Large 8/32/200, AVI Small 6/32/512, vROps Medium 8/32/274, vRLI Medium 8/16/530, vRNI Medium 8/32/1024, Automation Medium 24/96/334, Fleet Mgr 4/12/194.
- HA fanout (P2.3): NSX Mgr × 3, vROps × 3, vRLI × 3, Automation × 3.
- Stretch deployment floor (P2.6): `recommendedHostCount ≥ 8`.

Computed totals for **Standard / Simple** (all single-instance):
- Cores: 4 + 8 + 6 + 16 + 18 + 8 + 8 + 8 + 24 + 4 = **104**
- RAM: 16 + 30 + 24 + 64 + 96 + 32 + 16 + 32 + 96 + 12 = **418**
- Disk: 914 + 908 + 300 + 400 + 1536 + 274 + 530 + 1024 + 334 + 194 = **6414**

Computed totals for **Standard / HA** (NSX Mgr + vROps + vRLI + Automation × 3):
- Cores: 4 + 8 + 18 + 16 + 18 + 24 + 24 + 8 + 72 + 4 = **196**
- RAM: 16 + 30 + 72 + 64 + 96 + 96 + 48 + 32 + 288 + 12 = **754**
- Disk: 914 + 908 + 900 + 400 + 1536 + 822 + 1590 + 1024 + 1002 + 194 = **9290**

(Stretch matches HA in terms of totals — same fanout — but `recommendedHostCount ≥ 8` floor applies.)

Append this block to `index.test.ts`:

```ts
describe('calcManagementFull — workbook-parity snapshots (P6.4)', () => {
  // These tests lock the engine to VMware's reference workbook values
  // for the Standard profile across all three deployment modes.
  // Source values: spec Appendix A (sizing tables) + Appendix B (profile presets).
  // If a defaults table changes, update these expected values DELIBERATELY
  // and reference the spec change in the commit message.

  it('Standard / Simple — totals match VMware workbook (no HA fanout)', () => {
    const cfg = { ...baseConfig(), profile: 'standard' as const, deploymentMode: 'simple' as const }
    const r = calcManagementFull(cfg, [])

    // Appliances summed from Standard preset × per-line spec:
    // SDDC 4/16/914 · vCenter-M 8/30/908 · NSX-Mgr-M ×1 6/24/300 ·
    // NSX-Edge-L ×2 16/64/400 · AVI-S ×3 18/96/1536 · vROps-M ×1 8/32/274 ·
    // vRLI-M ×1 8/16/530 · vRNI-M ×1 8/32/1024 · Auto-M ×1 24/96/334 ·
    // Fleet ×1 4/12/194
    expect(r.totalCores).toBe(104)
    expect(r.totalRamGB).toBe(418)
    expect(r.totalDiskGB).toBe(6414)
    expect(r.recommendedHostCount).toBeGreaterThanOrEqual(4)  // simple/HA floor
  })

  it('Standard / HA — NSX Mgr / vROps / vRLI / Automation fan out ×3', () => {
    const cfg = { ...baseConfig(), profile: 'standard' as const, deploymentMode: 'ha' as const }
    const r = calcManagementFull(cfg, [])

    // Same as Simple but NSX-Mgr ×3, vROps ×3, vRLI ×3, Auto ×3.
    expect(r.totalCores).toBe(196)
    expect(r.totalRamGB).toBe(754)
    expect(r.totalDiskGB).toBe(9290)
    expect(r.recommendedHostCount).toBeGreaterThanOrEqual(4)
  })

  it('Standard / Stretch — same totals as HA, recommended floor of 8', () => {
    const cfg = { ...baseConfig(), profile: 'standard' as const, deploymentMode: 'stretch' as const }
    const r = calcManagementFull(cfg, [])

    // Stretch uses HA fanout (×3), then applies floor=8 to recommendedHostCount.
    expect(r.totalCores).toBe(196)
    expect(r.totalRamGB).toBe(754)
    expect(r.totalDiskGB).toBe(9290)
    expect(r.recommendedHostCount).toBeGreaterThanOrEqual(8)  // stretch floor
    expect(r.preferredSiteHosts).toBe(r.recommendedHostCount)  // P5.5: per-site = total
    expect(r.secondarySiteHosts).toBe(r.recommendedHostCount)
  })
})
```

If `baseConfig()` is not the helper used in this test file, find the existing factory and reuse it. (Per P2.6 / P5.5 work, there's almost certainly a `baseConfig` helper near the top of the file.)

- [ ] **Step 2: Run the new tests to confirm they pass**

```bash
npx vitest run src/engine/mgmt/index.test.ts
```

Expected: ≥ 26 tests pass (was 23 before; +3 new). If a test fails:
- The failure means a constant or profile preset has drifted from VMware's reference. Investigate the actual numeric output (`vitest run --reporter=verbose`) and compare with the spec's Appendix A / B.
- Do NOT silently update the expected value to match the engine output. Instead, dig into which input changed and confirm with the user whether the drift is intentional.

- [ ] **Step 3: Run the full suite**

```bash
npm run test
```

Expected: 523/523 (520 + 3).

- [ ] **Step 4: Type-check + build**

```bash
npm run type-check && npm run build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/mgmt/index.test.ts
git commit -m "test(mgmt): phase 6.4 — workbook-parity snapshot tests

Lock engine output to VMware's reference workbook for the
Standard-profile / Simple, HA, Stretch scenarios. Pins
totalCores, totalRamGB, totalDiskGB, recommendedHostCount,
and per-site hosts (stretch only).

Source values traced explicitly in test comments:
- Standard/Simple: 104 cores / 418 GB RAM / 6414 GB disk
- Standard/HA: 196 cores / 754 GB RAM / 9290 GB disk
  (NSX Mgr/vROps/vRLI/Automation each fan out ×3)
- Standard/Stretch: same totals as HA, but recommendedHostCount
  >= 8 (stretch floor), preferredSiteHosts == secondarySiteHosts
  == recommendedHostCount (P5.5).

If any of these snapshot values drifts in a future commit, the
expected value MUST be updated deliberately with a spec reference
in the commit message — do not silently re-snapshot.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md
      Appendix A (sizing values), Appendix B (profile presets), §11 P6"
```

---

## Phase 6 — Acceptance criteria

After all 4 tasks are complete:

- `useMarkdownExport.ts` renders 2 new tables (Management Appliance Sizing + WLD Overhead) and 3 new rows (total disk / total swap / external pool TiB).
- `usePptxExport.ts` adds 2 new slides (one per table) using `addTable`.
- `mgmt/index.test.ts` has 3 new snapshot tests pinning Standard-profile totals.
- All 4 locale files have the new export.* keys (~14 per locale).
- `npm run test` is **523/523** passing.
- `npm run type-check` clean.
- `npm run build` clean.
- Git log shows ~4 atomic commits.
- The user can regenerate the markdown / PPTX report from any scenario and see the itemized appliance breakdown.

After P6, the **v3.5 milestone is feature-complete and ready to ship**. A small post-P6 housekeeping commit can update the spec doc status from "Draft for review" to "Shipped 2026-04-29" and bump CLAUDE.md / project memory if needed (out of scope for P6 itself).

---

## Notes for the implementer

- **No new engine code.** All inputs to the new tables come from `calc.management.appliances`, `calc.management.wldOverhead`, and the existing `MgmtDomainResult` fields landed in P2 / P5.5.
- **Reuse the `MgmtSizingTable.vue` (P4.5) layout pattern.** That component renders the same data in the UI; the export tasks mirror it for downloads.
- **Manual visual verification is recommended** for both Markdown and PPTX. Open the dev server, generate exports for a Standard / HA scenario with 2 WLDs, inspect the downloads.
- **`pptxgenjs`'s table API** uses an array-of-rows-of-cells structure where each cell is either a string or `{ text: ..., options: { ... } }`. If the API rejects your input, check `node_modules/pptxgenjs/types/index.d.ts`.
- **Translation accuracy** for the new labels (especially Italian / German) is best-effort — open to native-speaker refinement post-merge.
- **`rtk` CLI proxy** sometimes mangles `npx vitest` output. Drop the `rtk` prefix if stuck.
