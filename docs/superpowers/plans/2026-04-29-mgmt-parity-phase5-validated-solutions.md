# Mgmt Parity Phase 5 — Validated Solutions + Advanced Sizing Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the two remaining UI panels in Step 2 of the wizard — `MgmtValidatedSolutions.vue` (4 toggles for SRM / Ransomware Recovery on-prem / Ransomware Recovery cloud / HCX) and `MgmtAdvancedSizing.vue` (per-appliance override table covering ALL 13 modeled categories with reset-to-profile per row).

**Architecture:** Two new Vue SFCs under `src/components/input/`, both wrapped in `MgmtCollapsibleSection` (the P4.1 primitive). Wired into `ManagementDomainSection.vue` after the existing Optional Appliances collapsible. Validated Solutions writes `inputStore.managementDomain.validatedSolutions`; Advanced Sizing writes `overrides[category]`. Both use `resolveProfileEntry` for the "current effective" view; reset-to-profile removes the override for that category. i18n keys in all 4 locales (en, fr, it, de).

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Tailwind CSS, vue-i18n (with `te()` for fallback), Pinia, existing shared primitives (`MgmtCollapsibleSection`, `NumberSliderInput`).

**Reference spec:** `docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md` — §6 (UI layout: validated solutions section + advanced sizing override section), §11 P5 (this phase).

**Total tasks:** 2. Estimated total time: ~half a day. No new engine, store, or composable code — pure UI.

---

## UI design decisions locked here

| Decision | Choice | Why |
|---|---|---|
| **Validated Solutions layout** | 4 row-style toggles inside `MgmtCollapsibleSection`. Each row: checkbox + label + (for SRM only) size segmented control (Light/Standard) shown only when included. Disabled solutions show muted label; included ones bold. | Matches Optional Appliances row pattern from P4.4 |
| **Validated Solutions namespace** | New `mgmt.validatedSolutions.*` keys for the panel; reuse `mgmt.categories.*` (added in P4.5) for the appliance-line names emitted into the sizing table | Keeps namespacing consistent with P4 |
| **Advanced Sizing layout** | Table with 13 rows (one per `MgmtApplianceCategory`). Columns: Category · Size dropdown · Nodes input · Reset button. Reset is icon-only (small "↺") with tooltip. Disabled when no override exists for that category. | Power-user view; compact; existing patterns |
| **Advanced Sizing collapsibility** | Inside `MgmtCollapsibleSection`, `defaultExpanded={false}` — power-user only | Most users never need it; collapsed-by-default keeps the form scannable |
| **Reset-to-profile mechanic** | Removes the entry for that category from `overrides`. Triggers a re-render that pulls the value from `resolveProfileEntry(profile, category)`. | Clean, no stale state |
| **Per-category sizes** | Size dropdown shows only the sizes that exist in `constants.ts` for that category (same per-category map as in `MgmtOptionalAppliances.vue` from P4.4 — extended to cover the 7 always-on categories) | Avoids invalid lookups |
| **Always-on categories' size lists** | vcenter: tiny/small/medium/large/xlarge · nsxManager: medium/large/xlarge · vrops: small/medium/large/xlarge · vropsCollector: small/standard · vrniCollector: small/medium/large · automation: small/medium/large · fleetManager: (no size variants — read-only "fixed" label) | Matches `constants.ts` exactly |
| **i18n category labels in Advanced Sizing** | Reuse `mgmt.categories.*` from P4.5 (already covers all categories) | No new keys needed for category names |

---

## File Structure

```
src/components/input/
├── ManagementDomainSection.vue            # MODIFIED (Tasks 5.1 + 5.2 — render new panels)
├── MgmtValidatedSolutions.vue             # NEW (Task 5.1)
└── MgmtAdvancedSizing.vue                 # NEW (Task 5.2)

src/i18n/locales/
├── en.json     # MODIFIED (Tasks 5.1 + 5.2)
├── fr.json     # MODIFIED (same)
├── it.json     # MODIFIED (same)
└── de.json     # MODIFIED (same)
```

No engine, store, or composable changes. No tests beyond manual verification (UI components aren't unit-tested by codebase convention).

---

## Task 5.1 — `MgmtValidatedSolutions.vue` collapsible

**Files:**
- Create: `src/components/input/MgmtValidatedSolutions.vue`
- Modify: `src/components/input/ManagementDomainSection.vue` (import + render)
- Modify: `src/i18n/locales/{en,fr,it,de}.json`

A collapsible section with 4 row-style toggles for the validated solutions. SRM has a sub-size segmented control (Light/Standard) shown only when included.

- [ ] **Step 1: Add i18n keys to all 4 locale files**

Each locale file already has a top-level `mgmt` section. Append a `validatedSolutions` subsection.

**EN keys (under `mgmt.validatedSolutions`):**
- `title`: "Validated solutions"
- `hint`: "Optional VMware-validated solutions. Each solution adds VMs to the management cluster."
- `siteProtection.label`: "Site Protection / SRM"
- `siteProtection.description`: "Disaster recovery via Site Recovery Manager. Adds appliances to the management cluster + each protected workload domain."
- `siteProtection.size`: "Size"
- `siteProtection.light`: "Light"
- `siteProtection.standard`: "Standard"
- `ransomwareOnPrem.label`: "Ransomware Recovery (on-prem)"
- `ransomwareOnPrem.description`: "On-premises ransomware recovery via VMware Live Cyber Recovery. Adds the HVM appliance."
- `ransomwareCloud.label`: "Ransomware Recovery (cloud)"
- `ransomwareCloud.description`: "Cloud-based ransomware recovery connector. Adds the connector appliance."
- `crossCloudMobility.label`: "Cross-Cloud Mobility (HCX)"
- `crossCloudMobility.description`: "HCX Connector for workload mobility between on-prem VCF and clouds."

**FR translations:**
- title: "Solutions validées"
- hint: "Solutions optionnelles validées par VMware. Chaque solution ajoute des VMs au cluster de gestion."
- siteProtection.label: "Protection de site / SRM"
- siteProtection.description: "Reprise après sinistre via Site Recovery Manager. Ajoute des appliances au cluster de gestion + à chaque domaine de charge protégé."
- siteProtection.size: "Taille"
- siteProtection.light: "Light"
- siteProtection.standard: "Standard"
- ransomwareOnPrem.label: "Ransomware Recovery (sur site)"
- ransomwareOnPrem.description: "Reprise sur site contre les ransomwares via VMware Live Cyber Recovery. Ajoute l'appliance HVM."
- ransomwareCloud.label: "Ransomware Recovery (cloud)"
- ransomwareCloud.description: "Connecteur cloud de reprise contre les ransomwares. Ajoute l'appliance connecteur."
- crossCloudMobility.label: "Cross-Cloud Mobility (HCX)"
- crossCloudMobility.description: "Connecteur HCX pour la mobilité des charges entre VCF sur site et clouds."

**IT translations:**
- title: "Soluzioni validate"
- hint: "Soluzioni opzionali validate da VMware. Ogni soluzione aggiunge VM al cluster di gestione."
- siteProtection.label: "Protezione sito / SRM"
- siteProtection.description: "Disaster recovery via Site Recovery Manager. Aggiunge appliance al cluster di gestione + a ciascun dominio di carico protetto."
- siteProtection.size: "Dimensione"
- siteProtection.light: "Light"
- siteProtection.standard: "Standard"
- ransomwareOnPrem.label: "Ransomware Recovery (on-premise)"
- ransomwareOnPrem.description: "Recupero ransomware on-premise via VMware Live Cyber Recovery. Aggiunge l'appliance HVM."
- ransomwareCloud.label: "Ransomware Recovery (cloud)"
- ransomwareCloud.description: "Connettore cloud di recupero ransomware. Aggiunge l'appliance connettore."
- crossCloudMobility.label: "Cross-Cloud Mobility (HCX)"
- crossCloudMobility.description: "Connettore HCX per la mobilità dei carichi tra VCF on-premise e cloud."

**DE translations:**
- title: "Validierte Lösungen"
- hint: "Optionale von VMware validierte Lösungen. Jede Lösung fügt VMs zum Management-Cluster hinzu."
- siteProtection.label: "Standortschutz / SRM"
- siteProtection.description: "Disaster Recovery über Site Recovery Manager. Fügt Appliances zum Management-Cluster + zu jeder geschützten Workload-Domain hinzu."
- siteProtection.size: "Größe"
- siteProtection.light: "Light"
- siteProtection.standard: "Standard"
- ransomwareOnPrem.label: "Ransomware Recovery (on-premise)"
- ransomwareOnPrem.description: "On-Premise-Ransomware-Wiederherstellung über VMware Live Cyber Recovery. Fügt die HVM-Appliance hinzu."
- ransomwareCloud.label: "Ransomware Recovery (cloud)"
- ransomwareCloud.description: "Cloud-basierter Ransomware-Wiederherstellungs-Konnektor. Fügt die Konnektor-Appliance hinzu."
- crossCloudMobility.label: "Cross-Cloud Mobility (HCX)"
- crossCloudMobility.description: "HCX-Konnektor für Workload-Mobilität zwischen On-Premise-VCF und Clouds."

- [ ] **Step 2: Create `src/components/input/MgmtValidatedSolutions.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import MgmtCollapsibleSection from '@/components/shared/MgmtCollapsibleSection.vue'
import type { ValidatedSolutionsConfig, SrmSize } from '@/engine/mgmt/types'

const { t } = useI18n()
const input = useInputStore()

const DEFAULT_SOLUTIONS: ValidatedSolutionsConfig = {
  siteProtection: { included: false },
  ransomwareOnPrem: { included: false },
  ransomwareCloud: { included: false },
  crossCloudMobility: { included: false },
}

const solutions = computed<ValidatedSolutionsConfig>({
  get: () => input.managementDomain.validatedSolutions ?? DEFAULT_SOLUTIONS,
  set: (val) => input.updateManagementDomain({ validatedSolutions: val }),
})

function setIncluded(key: keyof ValidatedSolutionsConfig, value: boolean) {
  const next = { ...solutions.value }
  next[key] = { ...next[key], included: value }
  solutions.value = next
}

function setSrmSize(value: SrmSize) {
  solutions.value = {
    ...solutions.value,
    siteProtection: { ...solutions.value.siteProtection, mgmtSize: value },
  }
}

const srmSize = computed<SrmSize>(() => solutions.value.siteProtection.mgmtSize ?? 'standard')
</script>

<template>
  <MgmtCollapsibleSection :title="t('mgmt.validatedSolutions.title')">
    <div class="space-y-3">
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.validatedSolutions.hint') }}</p>

      <!-- Site Protection / SRM (with light/standard sub-size) -->
      <div class="p-3 border border-gray-100 dark:border-gray-800 rounded space-y-2">
        <label class="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            :checked="solutions.siteProtection.included"
            class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            @change="setIncluded('siteProtection', ($event.target as HTMLInputElement).checked)"
          />
          <span class="space-y-0.5">
            <span :class="['block font-medium', solutions.siteProtection.included ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600']">
              {{ t('mgmt.validatedSolutions.siteProtection.label') }}
            </span>
            <span class="block text-xs text-gray-500 dark:text-gray-400">
              {{ t('mgmt.validatedSolutions.siteProtection.description') }}
            </span>
          </span>
        </label>

        <div v-if="solutions.siteProtection.included" class="ml-6 flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.validatedSolutions.siteProtection.size') }}:</span>
          <button
            v-for="opt in [
              { value: 'light' as const,    labelKey: 'mgmt.validatedSolutions.siteProtection.light' },
              { value: 'standard' as const, labelKey: 'mgmt.validatedSolutions.siteProtection.standard' },
            ]"
            :key="opt.value"
            :class="[
              'px-2 py-0.5 text-xs rounded border font-medium transition-colors',
              srmSize === opt.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            ]"
            @click="setSrmSize(opt.value)"
          >
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>

      <!-- Ransomware Recovery on-prem -->
      <label class="flex items-start gap-2 text-sm p-3 border border-gray-100 dark:border-gray-800 rounded cursor-pointer">
        <input
          type="checkbox"
          :checked="solutions.ransomwareOnPrem.included"
          class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          @change="setIncluded('ransomwareOnPrem', ($event.target as HTMLInputElement).checked)"
        />
        <span class="space-y-0.5">
          <span :class="['block font-medium', solutions.ransomwareOnPrem.included ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600']">
            {{ t('mgmt.validatedSolutions.ransomwareOnPrem.label') }}
          </span>
          <span class="block text-xs text-gray-500 dark:text-gray-400">
            {{ t('mgmt.validatedSolutions.ransomwareOnPrem.description') }}
          </span>
        </span>
      </label>

      <!-- Ransomware Recovery cloud -->
      <label class="flex items-start gap-2 text-sm p-3 border border-gray-100 dark:border-gray-800 rounded cursor-pointer">
        <input
          type="checkbox"
          :checked="solutions.ransomwareCloud.included"
          class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          @change="setIncluded('ransomwareCloud', ($event.target as HTMLInputElement).checked)"
        />
        <span class="space-y-0.5">
          <span :class="['block font-medium', solutions.ransomwareCloud.included ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600']">
            {{ t('mgmt.validatedSolutions.ransomwareCloud.label') }}
          </span>
          <span class="block text-xs text-gray-500 dark:text-gray-400">
            {{ t('mgmt.validatedSolutions.ransomwareCloud.description') }}
          </span>
        </span>
      </label>

      <!-- Cross-Cloud Mobility / HCX -->
      <label class="flex items-start gap-2 text-sm p-3 border border-gray-100 dark:border-gray-800 rounded cursor-pointer">
        <input
          type="checkbox"
          :checked="solutions.crossCloudMobility.included"
          class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          @change="setIncluded('crossCloudMobility', ($event.target as HTMLInputElement).checked)"
        />
        <span class="space-y-0.5">
          <span :class="['block font-medium', solutions.crossCloudMobility.included ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600']">
            {{ t('mgmt.validatedSolutions.crossCloudMobility.label') }}
          </span>
          <span class="block text-xs text-gray-500 dark:text-gray-400">
            {{ t('mgmt.validatedSolutions.crossCloudMobility.description') }}
          </span>
        </span>
      </label>
    </div>
  </MgmtCollapsibleSection>
</template>
```

- [ ] **Step 3: Wire into `ManagementDomainSection.vue`**

In the script block, add:

```ts
import MgmtValidatedSolutions from './MgmtValidatedSolutions.vue'
```

In the template, append after `<MgmtOptionalAppliances />` (before the bottom totals summary):

```vue
    <MgmtValidatedSolutions />
```

- [ ] **Step 4: Verify type-check + build**

```bash
npm run type-check
npm run build
```

Expected: clean.

- [ ] **Step 5: Verify existing tests still pass**

```bash
npm run test
```

Expected: 517/517 passing.

- [ ] **Step 6: Verify dev server boots**

```bash
npm run dev &
DEV_PID=$!
sleep 5
(curl -sf http://localhost:5173/ > /dev/null && echo "✓ dev server up on 5173") || \
(curl -sf http://localhost:5174/ > /dev/null && echo "✓ dev server up on 5174") || \
echo "✗ dev server down"
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
```

- [ ] **Step 7: Commit**

```bash
git add src/components/input/MgmtValidatedSolutions.vue src/components/input/ManagementDomainSection.vue src/i18n/locales/*.json
git commit -m "feat(ui): phase 5.1 — MgmtValidatedSolutions collapsible

New component: 4 row-style toggles for validated solutions —
Site Protection / SRM (with Light/Standard size segmented control
shown when included), Ransomware Recovery on-prem, Ransomware
Recovery cloud, Cross-Cloud Mobility / HCX. Each row has label
+ description. Bound to inputStore.managementDomain.
validatedSolutions via getter/setter computed.

Wired into ManagementDomainSection.vue after MgmtOptionalAppliances.

i18n keys: mgmt.validatedSolutions.* in all 4 locales.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §6"
```

## Context

- **`<script setup lang="ts">`** is the codebase convention.
- **`MgmtCollapsibleSection`** (P4.1) takes `title: string`, optional `defaultExpanded?: boolean`.
- **`ValidatedSolutionsConfig`** type is in `@/engine/mgmt/types`. Has 4 fields, each `{ included: boolean; mgmtSize?: SrmSize }` (only siteProtection has mgmtSize).
- **`SrmSize`** is `'light' | 'standard'`.
- **`updateManagementDomain`** is the inputStore mutator (already used by other components in this directory).
- **`rtk` CLI proxy:** if `rtk npx vitest` produces weird npm errors, drop the `rtk` prefix.

## Self-Review Checklist

**Completeness:**
- All 4 locale files updated?
- Component renders 4 toggle rows?
- SRM size segmented control shows ONLY when included?
- Wired into ManagementDomainSection.vue after MgmtOptionalAppliances?

**Quality:**
- Each row has label + description?
- Disabled state styling applied to label when not included?
- Tailwind dark-mode classes match existing pattern?

**Discipline:**
- Only the 6 target files modified?

**Testing:**
- type-check, test, build all clean?
- Dev server boots cleanly?

## Report Format

- **Status:** `DONE` / `DONE_WITH_CONCERNS` / `BLOCKED`
- What you implemented (per file)
- Test/type-check/build/dev-server output (last few lines)
- New commit SHA
- Self-review findings
- Any concerns

---

## Task 5.2 — `MgmtAdvancedSizing.vue` collapsible

**Files:**
- Create: `src/components/input/MgmtAdvancedSizing.vue`
- Modify: `src/components/input/ManagementDomainSection.vue` (import + render)
- Modify: `src/i18n/locales/{en,fr,it,de}.json`

A power-user table with 13 rows (one per `MgmtApplianceCategory`) showing the **current effective** size + nodeCount (resolved through override-on-profile). Each row has a Reset button that removes that category's override.

- [ ] **Step 1: Add i18n keys to all 4 locale files**

Append a `mgmt.advancedSizing` subsection.

**EN:**
- `mgmt.advancedSizing.title`: "Advanced sizing override"
- `mgmt.advancedSizing.hint`: "Override the size or node count for any management appliance. Reset returns the appliance to the current profile's defaults."
- `mgmt.advancedSizing.category`: "Component"
- `mgmt.advancedSizing.size`: "Size"
- `mgmt.advancedSizing.nodes`: "Nodes"
- `mgmt.advancedSizing.action`: "Action"
- `mgmt.advancedSizing.reset`: "Reset"
- `mgmt.advancedSizing.resetTooltip`: "Reset to profile default"
- `mgmt.advancedSizing.fixedSize`: "Fixed"

**FR:**
- title: "Dimensionnement avancé"
- hint: "Surchargez la taille ou le nombre de nœuds de toute appliance de gestion. Réinitialiser ramène l'appliance aux valeurs par défaut du profil actuel."
- category: "Composant"
- size: "Taille"
- nodes: "Nœuds"
- action: "Action"
- reset: "Réinitialiser"
- resetTooltip: "Réinitialiser au profil par défaut"
- fixedSize: "Fixe"

**IT:**
- title: "Dimensionamento avanzato"
- hint: "Sovrascrivi la dimensione o il numero di nodi di qualsiasi appliance di gestione. Reset riporta l'appliance ai valori predefiniti del profilo corrente."
- category: "Componente"
- size: "Dimensione"
- nodes: "Nodi"
- action: "Azione"
- reset: "Reset"
- resetTooltip: "Ripristina ai valori predefiniti del profilo"
- fixedSize: "Fisso"

**DE:**
- title: "Erweiterte Dimensionierung"
- hint: "Überschreiben Sie die Größe oder Knotenanzahl einer beliebigen Management-Appliance. Zurücksetzen stellt die Standardwerte des aktuellen Profils wieder her."
- category: "Komponente"
- size: "Größe"
- nodes: "Knoten"
- action: "Aktion"
- reset: "Zurücksetzen"
- resetTooltip: "Auf Profilstandard zurücksetzen"
- fixedSize: "Fest"

- [ ] **Step 2: Create `src/components/input/MgmtAdvancedSizing.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { resolveProfileEntry } from '@/engine/mgmt/profiles'
import MgmtCollapsibleSection from '@/components/shared/MgmtCollapsibleSection.vue'
import type { MgmtApplianceCategory, ApplianceOverride } from '@/engine/mgmt/types'

const { t, te } = useI18n()
const input = useInputStore()

interface CategoryRow {
  key: MgmtApplianceCategory
  /** Sizes valid for this category in constants.ts. Empty array = no size variants (e.g., fleetManager). */
  sizes: readonly string[]
}

// Per-category size lists — match src/engine/mgmt/constants.ts
const ROWS: readonly CategoryRow[] = [
  { key: 'vcenter',        sizes: ['tiny', 'small', 'medium', 'large', 'xlarge'] },
  { key: 'nsxManager',     sizes: ['medium', 'large', 'xlarge'] },
  { key: 'nsxEdge',        sizes: ['small', 'medium', 'large', 'xlarge'] },
  { key: 'aviLb',          sizes: ['small', 'large', 'xlarge'] },
  { key: 'vrops',          sizes: ['small', 'medium', 'large', 'xlarge'] },
  { key: 'vropsCollector', sizes: ['small', 'standard'] },
  { key: 'vrli',           sizes: ['small', 'medium', 'large'] },
  { key: 'vrni',           sizes: ['small', 'medium', 'large', 'xlarge'] },
  { key: 'vrniCollector',  sizes: ['small', 'medium', 'large'] },
  { key: 'automation',     sizes: ['small', 'medium', 'large'] },
  { key: 'fleetManager',   sizes: [] },   // no size variants — fixed spec
  { key: 'identityBroker', sizes: ['small', 'medium', 'large'] },
  { key: 'ssp',            sizes: ['medium', 'large', 'xlarge'] },
]

const profile = computed(() => input.managementDomain.profile ?? 'standard')

function rowState(cat: MgmtApplianceCategory) {
  return computed({
    get: () => {
      const base = resolveProfileEntry(profile.value, cat)
      const ovr = input.managementDomain.overrides?.[cat] ?? {}
      return {
        included: ovr.included ?? base.included,
        size: (ovr.size ?? base.size) as string,
        nodeCount: ovr.nodeCount ?? base.nodeCount,
        hasOverride: Object.keys(ovr).length > 0,
      }
    },
    set: (next: { size: string; nodeCount: number }) => {
      const old = input.managementDomain.overrides?.[cat] ?? {}
      const newOverride: ApplianceOverride = {
        ...old,
        size: next.size as ApplianceOverride['size'],
        nodeCount: next.nodeCount,
      }
      const oldOverrides = input.managementDomain.overrides ?? {}
      input.updateManagementDomain({
        overrides: { ...oldOverrides, [cat]: newOverride },
      })
    },
  })
}

const states = ROWS.map(r => ({ row: r, state: rowState(r.key) }))

function setSize(idx: number, value: string) {
  const s = states[idx].state.value
  states[idx].state.value = { size: value, nodeCount: s.nodeCount }
}

function setNodeCount(idx: number, value: number) {
  const s = states[idx].state.value
  states[idx].state.value = { size: s.size, nodeCount: value }
}

function resetCategory(cat: MgmtApplianceCategory) {
  const oldOverrides = input.managementDomain.overrides ?? {}
  const { [cat]: _removed, ...rest } = oldOverrides
  input.updateManagementDomain({ overrides: rest })
}

function categoryLabel(key: MgmtApplianceCategory): string {
  const dedicated = `mgmt.categories.${key}`
  if (te(dedicated)) return t(dedicated)
  const optional = `mgmt.optionalAppliances.categories.${key}`
  if (te(optional)) return t(optional)
  return key as string
}
</script>

<template>
  <MgmtCollapsibleSection :title="t('mgmt.advancedSizing.title')">
    <div class="space-y-3">
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.advancedSizing.hint') }}</p>

      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead class="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
            <tr>
              <th class="px-2 py-1 text-left font-medium">{{ t('mgmt.advancedSizing.category') }}</th>
              <th class="px-2 py-1 text-left font-medium">{{ t('mgmt.advancedSizing.size') }}</th>
              <th class="px-2 py-1 text-left font-medium">{{ t('mgmt.advancedSizing.nodes') }}</th>
              <th class="px-2 py-1 text-left font-medium">{{ t('mgmt.advancedSizing.action') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="(item, idx) in states" :key="item.row.key" class="text-gray-900 dark:text-gray-100">
              <td class="px-2 py-1 font-medium">{{ categoryLabel(item.row.key) }}</td>

              <td class="px-2 py-1">
                <select
                  v-if="item.row.sizes.length > 0"
                  :value="item.state.value.size"
                  class="text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1"
                  @change="setSize(idx, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="size in item.row.sizes" :key="size" :value="size">{{ size }}</option>
                </select>
                <span v-else class="text-xs text-gray-500 dark:text-gray-400 italic">{{ t('mgmt.advancedSizing.fixedSize') }}</span>
              </td>

              <td class="px-2 py-1">
                <input
                  type="number"
                  :value="item.state.value.nodeCount"
                  :min="1"
                  :max="20"
                  :step="1"
                  class="w-16 text-sm text-right rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1"
                  @change="setNodeCount(idx, Number(($event.target as HTMLInputElement).value))"
                />
              </td>

              <td class="px-2 py-1">
                <button
                  type="button"
                  :disabled="!item.state.value.hasOverride"
                  :title="t('mgmt.advancedSizing.resetTooltip')"
                  class="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-300 transition-colors"
                  @click="resetCategory(item.row.key)"
                >
                  ↺ {{ t('mgmt.advancedSizing.reset') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </MgmtCollapsibleSection>
</template>
```

- [ ] **Step 3: Wire into `ManagementDomainSection.vue`**

In the script block, add:

```ts
import MgmtAdvancedSizing from './MgmtAdvancedSizing.vue'
```

In the template, append after `<MgmtValidatedSolutions />` (before the bottom totals summary):

```vue
    <MgmtAdvancedSizing />
```

- [ ] **Step 4: Verify type-check + build**

```bash
npm run type-check
npm run build
```

Expected: clean.

- [ ] **Step 5: Verify existing tests still pass**

```bash
npm run test
```

Expected: 517/517 passing.

- [ ] **Step 6: Verify dev server boots**

```bash
npm run dev &
DEV_PID=$!
sleep 5
(curl -sf http://localhost:5173/ > /dev/null && echo "✓ dev server up on 5173") || \
(curl -sf http://localhost:5174/ > /dev/null && echo "✓ dev server up on 5174") || \
echo "✗ dev server down"
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null
```

- [ ] **Step 7: Commit**

```bash
git add src/components/input/MgmtAdvancedSizing.vue src/components/input/ManagementDomainSection.vue src/i18n/locales/*.json
git commit -m "feat(ui): phase 5.2 — MgmtAdvancedSizing override table

New component: power-user table with 13 rows (one per
MgmtApplianceCategory). Each row shows the current effective
size + nodeCount (resolved through override-on-profile) plus a
Reset button that removes that category's override (so the row
falls back to the profile default).

fleetManager has no size variants — its size column shows
'Fixed' label instead of a dropdown.

Wired into ManagementDomainSection.vue after
MgmtValidatedSolutions.

i18n keys: mgmt.advancedSizing.* in all 4 locales. Category
labels reuse mgmt.categories.* (added in P4.5).

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §6"
```

## Context

- **`MgmtApplianceCategory`** has 13 members. The `ROWS` const must include all 13.
- **Per-category size lists must match `src/engine/mgmt/constants.ts`** — if a size doesn't exist there, the dropdown will let users pick it but the engine's `getApplianceSpec()` will throw. The size lists in `ROWS` above are correct for the current `constants.ts`.
- **`fleetManager` has no size variants** — handle it specially (show "Fixed" label).
- **Reset removes the category from `overrides`**: use object destructuring to omit the key (rather than `delete` which mutates).
- **`te()` from `vue-i18n`** is the "translation exists" check, used the same way as in `MgmtSizingTable.vue` (P4.5).

## Self-Review Checklist

**Completeness:**
- All 4 locale files updated with `mgmt.advancedSizing.*`?
- ROWS includes all 13 `MgmtApplianceCategory` members?
- Per-category sizes match `constants.ts`?
- `fleetManager` row shows "Fixed" label, not a dropdown?
- Reset button disabled when `hasOverride === false`?
- Reset removes the category from `overrides` (immutable, doesn't `delete`)?

**Quality:**
- Reuses `mgmt.categories.*` labels via `te()` fallback?
- Tailwind dark-mode classes match existing patterns?
- Tooltip on Reset button via `:title`?

**Discipline:**
- Only the 6 target files modified?

**Testing:**
- type-check, test, build all clean?
- Dev server boots cleanly?

## Report Format

- **Status:** `DONE` / `DONE_WITH_CONCERNS` / `BLOCKED`
- What you implemented
- Test/type-check/build/dev-server output (last few lines)
- New commit SHA
- Self-review findings
- Any concerns

---

## Phase 5 — Acceptance criteria

After both tasks are complete:

- `src/components/input/MgmtValidatedSolutions.vue` and `src/components/input/MgmtAdvancedSizing.vue` both exist and are wired into `ManagementDomainSection.vue` after the existing P4 collapsibles.
- All 4 locale files have `mgmt.validatedSolutions.*` and `mgmt.advancedSizing.*` keys.
- `npm run test` 517/517 passing (no test count change — UI components aren't unit-tested).
- `npm run type-check` clean.
- `npm run build` clean.
- Git log shows 2 atomic commits.
- **User-visible:** Step 2 of the wizard now has the full mgmt-domain configurator: Profile selector, vSAN Max, Capacity headroom, Optional appliances, Validated solutions, Advanced sizing. The Step 2 form is feature-complete.

P6 (the final phase) covers exports — making the new mgmt sizing data appear in Markdown / PPTX exports — plus a workbook-parity snapshot test suite that locks our defaults to VMware's reference output.

---

## Notes for the implementer

- **No new arithmetic, no new types, no new engine code.** P5 is pure UI.
- **`<script setup lang="ts">`** is the codebase convention. Match the patterns from `MgmtCapacityHeadroom.vue` (P4.3) and `MgmtOptionalAppliances.vue` (P4.4).
- **Tailwind CSS** for styling. Match `dark:` variants.
- **`MgmtCollapsibleSection`** (P4.1) is the wrapper. Always use it.
- **Manual browser walkthrough is recommended** at the end of each task. The dev-server-boot check confirms there's no compile error but doesn't catch visual regressions.
- **The `rtk` CLI proxy** sometimes mangles `npx vitest run` output. If a test command's output is unclear, drop the `rtk` prefix.
- **IDE-stale diagnostics** are common after Vue file additions. The source of truth is `npm run type-check` (which runs `vue-tsc --noEmit`).
