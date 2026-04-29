# Mgmt Parity Phase 4 — UI Step 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the user-visible UI for the new mgmt-domain capabilities — extend Step 2 of the wizard with collapsible sections (Capacity Headroom, Optional Appliances), add a Profile selector + vSAN Max storage option, and add a Mgmt Sizing Table to the results panel.

**Architecture:** Extend the existing `ManagementDomainSection.vue` Step 2 form rather than replacing it. Three new Vue SFCs go under `src/components/input/` (`MgmtCapacityHeadroom`, `MgmtOptionalAppliances`) plus one shared primitive (`MgmtCollapsibleSection`). One new SFC under `src/components/results/` (`MgmtSizingTable`). All user-facing strings are i18n keys; translations land in all 4 locale files (en, fr, it, de — the Swiss variants inherit). Existing wizard structure (3 steps) and existing components (DomainResultCard, AggregateTotalsCard) are unchanged.

**Tech Stack:** Vue 3 Composition API with `<script setup lang="ts">`, Tailwind CSS utility classes, vue-i18n, Pinia, existing shared components (`NumberSliderInput.vue`, `ConfirmationDialog.vue`).

**Reference spec:** `docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md` — §6 (UI layout), §11 P4 (this phase).

**Total tasks:** 5. Estimated total time: 1–1.5 days.

---

## UI design decisions locked here (no per-task brainstorming needed)

These choices follow the existing component patterns in the codebase. Subagents implement them as specified.

| Decision | Choice | Why |
|---|---|---|
| **Profile selector style** | Button group (Lab / Standard / Large), matching the existing `managementArchitecture` toggle pattern in `ManagementDomainSection.vue:47-65` | Visual consistency with the existing UI; 3 options is a comfortable group size |
| **Storage type vSAN Max** | Add 4th button to the existing 3-button group at `ManagementDomainSection.vue:73-89` | Same pattern; minimal disruption |
| **vSAN Max conditional inputs** | Show `vsanMaxStorageNodes` (slider 4–64) and `vsanMaxProfile` (button group of xs/sm/med/lrg/xl) ONLY when `storageType === 'vsan-max'`. Mirror the workload-domain pattern. | Reuse known UX; users familiar with vSAN Max from WLD already understand |
| **Collapsible primitive** | New `MgmtCollapsibleSection.vue` in `src/components/shared/` — heading button + chevron + slot. Internal `ref<boolean>` for expanded state, with optional `defaultExpanded` prop. | Reusable across the 2 P4 collapsibles + 2 future P5 collapsibles |
| **Capacity Headroom inputs** | 4 `NumberSliderInput`s in a 2-column grid: cpu oversub (1–8 step 1), ram oversub (1–4 step 0.5), reserve % (0–100 step 5), growth % (0–100 step 5) | Existing slider pattern; ranges from spec §8 validation rules |
| **Optional Appliances rows** | 6 rows: NSX Edge, AVI LB, vRLI, vRNI, Identity Broker, SSP. Each row is `[checkbox] [size dropdown] [nodeCount slider]`. Size dropdown shows ONLY the sizes valid for that category (per `constants.ts`). When checkbox unchecked, dropdown + slider are visually disabled (still rendered for layout stability) | Spec §6 layout. Disabled-not-hidden keeps visual rhythm |
| **Mgmt sizing table layout** | Two stacked HTML tables: "Management appliances" (sourced from `appliances`) and "Workload-domain overhead" (sourced from `wldOverhead`). Each row: category name (i18n) · nodeCount · cores/node · RAM/node · disk/node · total cores · total RAM · total disk. Footer row with totals. | Itemized; mirrors the VMware workbook output. Two tables clarify what's user-configured vs. auto-derived |
| **Profile-change confirm dialog** | When `Object.keys(input.managementDomain.overrides).length > 0` AND user changes profile, open existing `ConfirmationDialog.vue` from `src/components/shared/`. On confirm, clear overrides AND set new profile. On cancel, do nothing. | Existing component handles dialog UX |
| **i18n key namespace** | All new keys under `mgmt.*` (e.g., `mgmt.profile.label`, `mgmt.profile.lab`, `mgmt.capacityHeadroom.cpuOversub`). Avoid stomping the existing `management.*` namespace which is mostly result labels. | Clean separation; easy to find related keys |
| **Locale coverage** | All keys added to all 4 of `src/i18n/locales/{en,fr,it,de}.json`. Native-speaker accuracy: best-effort from the implementer; any nuance issues land as cleanup later (P6) | Codebase convention requires all 4 |
| **Component testing** | NO `@vue/test-utils` — the codebase doesn't have a JSDom testing setup (CLAUDE.md: "tests cover engine/composables/stores — no DOM environment needed"). Verification is `npm run type-check` + `npm run build` + manual browser walkthrough at end of each task. | Don't introduce a new test infra layer in this phase |

---

## File Structure

```
src/components/
├── shared/
│   └── MgmtCollapsibleSection.vue              # NEW (Task 4.1)
├── input/
│   ├── ManagementDomainSection.vue             # MODIFIED (Task 4.2 — profile + vSAN Max)
│   ├── MgmtCapacityHeadroom.vue                # NEW (Task 4.3)
│   └── MgmtOptionalAppliances.vue              # NEW (Task 4.4)
└── results/
    ├── MgmtSizingTable.vue                     # NEW (Task 4.5)
    └── ResultsPanel.vue                        # MODIFIED (Task 4.5 — wire MgmtSizingTable)

src/i18n/locales/
├── en.json     # MODIFIED (Tasks 4.2 / 4.3 / 4.4 / 4.5 — append mgmt.* keys)
├── fr.json     # MODIFIED (same)
├── it.json     # MODIFIED (same)
└── de.json     # MODIFIED (same)
```

No engine, store, or composable changes in this phase — those landed in P1/P2/P3.

---

## Task 4.1 — `MgmtCollapsibleSection.vue` shared primitive

**Files:**
- Create: `src/components/shared/MgmtCollapsibleSection.vue`

A reusable collapsible: heading button + chevron + slot content. Internal expansion state with `defaultExpanded` prop.

- [ ] **Step 1: Create `src/components/shared/MgmtCollapsibleSection.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  /** Heading text (already-translated string from caller) */
  title: string
  /** Whether the section is expanded by default. Defaults to false. */
  defaultExpanded?: boolean
}>()

const expanded = ref(props.defaultExpanded ?? false)
</script>

<template>
  <section class="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
    <button
      type="button"
      class="w-full flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ title }}
      </span>
      <svg
        :class="['w-4 h-4 text-gray-400 transition-transform', expanded ? 'rotate-90' : '']"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path fill-rule="evenodd" d="M7.05 4.05a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L11.586 10 7.05 5.464a1 1 0 010-1.414z" clip-rule="evenodd"/>
      </svg>
    </button>
    <div v-show="expanded" class="p-4 bg-white dark:bg-gray-900">
      <slot />
    </div>
  </section>
</template>
```

- [ ] **Step 2: Verify type-check passes**

```bash
npm run type-check
```

Expected: clean.

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: clean (only the pre-existing chunk-size warning).

- [ ] **Step 4: Verify existing tests still pass (no regressions)**

```bash
npm run test
```

Expected: 517/517 passing (no test count change — primitive is unused so far).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/MgmtCollapsibleSection.vue
git commit -m "feat(ui): phase 4.1 — MgmtCollapsibleSection shared primitive

Reusable collapsible: heading button + chevron + slotted content.
Caller supplies the already-translated title; expansion state is
managed internally with a defaultExpanded prop.

Used in P4.3 (capacity headroom), P4.4 (optional appliances),
and P5 (validated solutions, advanced sizing).

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §6"
```

---

## Task 4.2 — Profile selector + vSAN Max storage option

**Files:**
- Modify: `src/components/input/ManagementDomainSection.vue`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/it.json`
- Modify: `src/i18n/locales/de.json`

Two changes inside the existing Step 2 form:
1. Add a **Profile selector** button group below the architecture toggle.
2. Add a **vSAN Max** button to the existing storage type group, plus conditional `vsanMaxStorageNodes` slider and `vsanMaxProfile` button group when selected.

When the profile changes AND `Object.keys(input.managementDomain.overrides).length > 0`, prompt for confirmation via the existing `ConfirmationDialog.vue`. On confirm, clear overrides AND set new profile. On cancel, do nothing.

- [ ] **Step 1: Add i18n keys to all 4 locale files**

For each of `src/i18n/locales/{en,fr,it,de}.json`, append these keys (placement: in the existing `management` or `mgmt` object, or top-level if those don't exist as containers — match the file's existing organization). Add a top-level `"mgmt"` section if not present.

**EN (`src/i18n/locales/en.json`):**
```json
{
  "mgmt": {
    "profile": {
      "label": "Profile",
      "lab": "Lab",
      "standard": "Standard",
      "large": "Large",
      "hint": "Profile presets cover common deployment scales. Power users can override individual appliance sizes via the Advanced sizing section."
    },
    "vsanMax": {
      "label": "vSAN Max (disaggregated)",
      "storageNodes": "Storage nodes",
      "profile": "Storage profile",
      "warning": "Beyond VMware's official guidance for management domains — supported by this tool, not by Broadcom."
    },
    "confirmProfileChange": {
      "title": "Switch profile?",
      "message": "Switching profile will reset {count} custom appliance override(s). Continue?",
      "confirm": "Switch profile",
      "cancel": "Keep current profile"
    }
  },
  "storage": {
    "vsanMax": "vSAN Max"
  }
}
```

(If your file has a flat structure with dot-keys, e.g. `"mgmt.profile.label": "Profile"`, follow that pattern. If it's nested, follow that. Match the file's existing convention. The `"storage.vsanMax"` key may already exist for workload domain — check; if it exists, do NOT duplicate.)

**FR (`src/i18n/locales/fr.json`):**
```json
{
  "mgmt": {
    "profile": {
      "label": "Profil",
      "lab": "Lab",
      "standard": "Standard",
      "large": "Large",
      "hint": "Les préréglages de profil couvrent les échelles de déploiement courantes. Les utilisateurs avancés peuvent surcharger les tailles d'appliance via la section Dimensionnement avancé."
    },
    "vsanMax": {
      "label": "vSAN Max (désagrégé)",
      "storageNodes": "Nœuds de stockage",
      "profile": "Profil de stockage",
      "warning": "Au-delà des recommandations officielles de VMware pour les domaines de gestion — pris en charge par cet outil, pas par Broadcom."
    },
    "confirmProfileChange": {
      "title": "Changer de profil ?",
      "message": "Changer de profil réinitialisera {count} surcharge(s) d'appliance personnalisée(s). Continuer ?",
      "confirm": "Changer de profil",
      "cancel": "Conserver le profil actuel"
    }
  },
  "storage": {
    "vsanMax": "vSAN Max"
  }
}
```

**IT (`src/i18n/locales/it.json`):**
```json
{
  "mgmt": {
    "profile": {
      "label": "Profilo",
      "lab": "Lab",
      "standard": "Standard",
      "large": "Large",
      "hint": "I preset di profilo coprono le scale di distribuzione comuni. Gli utenti esperti possono sovrascrivere le dimensioni delle singole appliance tramite la sezione Dimensionamento avanzato."
    },
    "vsanMax": {
      "label": "vSAN Max (disaggregato)",
      "storageNodes": "Nodi di archiviazione",
      "profile": "Profilo di archiviazione",
      "warning": "Oltre le linee guida ufficiali di VMware per i domini di gestione — supportato da questo strumento, non da Broadcom."
    },
    "confirmProfileChange": {
      "title": "Cambiare profilo?",
      "message": "Il cambio di profilo ripristinerà {count} override appliance personalizzati. Continuare?",
      "confirm": "Cambia profilo",
      "cancel": "Mantieni profilo attuale"
    }
  },
  "storage": {
    "vsanMax": "vSAN Max"
  }
}
```

**DE (`src/i18n/locales/de.json`):**
```json
{
  "mgmt": {
    "profile": {
      "label": "Profil",
      "lab": "Lab",
      "standard": "Standard",
      "large": "Large",
      "hint": "Profilvoreinstellungen decken gängige Bereitstellungsgrößen ab. Profis können einzelne Appliance-Größen über den Bereich Erweiterte Dimensionierung überschreiben."
    },
    "vsanMax": {
      "label": "vSAN Max (disaggregiert)",
      "storageNodes": "Speicherknoten",
      "profile": "Speicherprofil",
      "warning": "Über VMwares offizielle Empfehlung für Management-Domains hinaus — von diesem Tool unterstützt, nicht von Broadcom."
    },
    "confirmProfileChange": {
      "title": "Profil wechseln?",
      "message": "Beim Profilwechsel werden {count} angepasste Appliance-Überschreibungen zurückgesetzt. Fortfahren?",
      "confirm": "Profil wechseln",
      "cancel": "Aktuelles Profil behalten"
    }
  },
  "storage": {
    "vsanMax": "vSAN Max"
  }
}
```

**Important:** if a key (e.g. `"storage.vsanMax"`) already exists in the locale file, DO NOT duplicate it. Inspect each file before appending.

- [ ] **Step 2: Modify `src/components/input/ManagementDomainSection.vue`**

Read the file first (it's at `src/components/input/ManagementDomainSection.vue` and currently ~160 lines).

Add the `profile` field-binding near the existing field bindings (around line 25):

```ts
const profile = mgmtField('profile')
const vsanMaxStorageNodes = mgmtField('vsanMaxStorageNodes')
const vsanMaxProfile = mgmtField('vsanMaxProfile')
```

Add the confirm-dialog state + helper (also in `<script setup>`):

```ts
import { ref } from 'vue'
import ConfirmationDialog from '@/components/shared/ConfirmationDialog.vue'
import type { MgmtProfile } from '@/engine/mgmt/types'

const profileChangeDialogOpen = ref(false)
const pendingProfile = ref<MgmtProfile | null>(null)

function attemptProfileChange(next: MgmtProfile) {
  const overrideCount = Object.keys(input.managementDomain.overrides ?? {}).length
  if (overrideCount === 0 || profile.value === next) {
    profile.value = next
    return
  }
  pendingProfile.value = next
  profileChangeDialogOpen.value = true
}

function confirmProfileChange() {
  if (pendingProfile.value !== null) {
    input.updateManagementDomain({
      profile: pendingProfile.value,
      overrides: {},
    })
  }
  pendingProfile.value = null
  profileChangeDialogOpen.value = false
}

function cancelProfileChange() {
  pendingProfile.value = null
  profileChangeDialogOpen.value = false
}

const overrideCount = computed(() => Object.keys(input.managementDomain.overrides ?? {}).length)
```

In the template, **insert** the Profile button group after the existing storage type section (around line 91) and before the deployment mode section. Use the same button-toggle styling pattern as the architecture toggle:

```vue
    <!-- Profile selector (P4) — Lab / Standard / Large -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('mgmt.profile.label') }}
      </label>
      <div class="flex gap-2">
        <button
          v-for="opt in [
            { value: 'lab' as const,      labelKey: 'mgmt.profile.lab' },
            { value: 'standard' as const, labelKey: 'mgmt.profile.standard' },
            { value: 'large' as const,    labelKey: 'mgmt.profile.large' },
          ]"
          :key="opt.value"
          :class="[
            'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
            profile === opt.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
          ]"
          @click="attemptProfileChange(opt.value)"
        >
          {{ t(opt.labelKey) }}
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.profile.hint') }}</p>
    </div>
```

**Update** the storage type button list to include the 4th option (vSAN Max). Find the existing block near line 73:

```ts
v-for="opt in [
  { value: 'vsan-esa' as const, labelKey: 'storage.vsanEsa' },
  { value: 'fc'       as const, labelKey: 'storage.fc'      },
  { value: 'nfs'      as const, labelKey: 'storage.nfs'     },
]"
```

And replace it with:

```ts
v-for="opt in [
  { value: 'vsan-esa' as const, labelKey: 'storage.vsanEsa' },
  { value: 'fc'       as const, labelKey: 'storage.fc'      },
  { value: 'nfs'      as const, labelKey: 'storage.nfs'     },
  { value: 'vsan-max' as const, labelKey: 'storage.vsanMax' },
]"
```

After the storage type block, **append** these conditional inputs (visible only when storageType === 'vsan-max'):

```vue
    <!-- vSAN Max conditional inputs (P4) — only when storageType is vsan-max -->
    <div v-if="storageType === 'vsan-max'" class="space-y-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded">
      <p class="text-xs text-amber-800 dark:text-amber-200">{{ t('mgmt.vsanMax.warning') }}</p>
      <NumberSliderInput
        v-model="vsanMaxStorageNodes"
        :label="t('mgmt.vsanMax.storageNodes')"
        :min="4"
        :max="64"
        :step="1"
      />
      <div class="space-y-1">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('mgmt.vsanMax.profile') }}
        </label>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="opt in [
              { value: 'xs' as const,  label: 'XS' },
              { value: 'sm' as const,  label: 'SM' },
              { value: 'med' as const, label: 'MED' },
              { value: 'lrg' as const, label: 'LRG' },
              { value: 'xl' as const,  label: 'XL' },
            ]"
            :key="opt.value"
            :class="[
              'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
              vsanMaxProfile === opt.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            ]"
            @click="vsanMaxProfile = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>
```

At the very end of the `<template>` (just before `</section>`), append the confirm dialog:

```vue
    <ConfirmationDialog
      v-if="profileChangeDialogOpen"
      :title="t('mgmt.confirmProfileChange.title')"
      :message="t('mgmt.confirmProfileChange.message', { count: overrideCount })"
      :confirm-label="t('mgmt.confirmProfileChange.confirm')"
      :cancel-label="t('mgmt.confirmProfileChange.cancel')"
      @confirm="confirmProfileChange"
      @cancel="cancelProfileChange"
    />
```

**Important:** read `src/components/shared/ConfirmationDialog.vue` first to confirm its props/events match (`title`, `message`, `confirmLabel`, `cancelLabel` props + `confirm` and `cancel` events). If its API differs, adapt the bindings.

- [ ] **Step 3: Verify type-check + build pass**

```bash
npm run type-check
npm run build
```

Expected: clean. If type-check fails, the most likely culprit is a mismatch between `ConfirmationDialog`'s actual API and the bindings above — read the dialog component and adjust.

- [ ] **Step 4: Verify existing tests still pass**

```bash
npm run test
```

Expected: 517/517 passing.

- [ ] **Step 5: Manual browser walkthrough**

```bash
npm run dev
```

In the browser at http://localhost:5173 (or whatever port it picks):
1. Walk through the wizard to Step 2.
2. Verify the Profile selector renders and switching between Lab/Standard/Large updates the `profile` field (you can verify via DevTools → Vue: inspect `inputStore.managementDomain.profile`).
3. Verify the storage type group now has 4 buttons including "vSAN Max".
4. Click vSAN Max — verify the warning banner + storage nodes slider + profile button group appear.
5. Click back to vSAN ESA — verify the conditional block disappears.
6. (Override-clearing not yet testable — `overrides` is empty by default; verify in P4.4 once optional appliances are wired.)

Stop the dev server (Ctrl-C).

- [ ] **Step 6: Commit**

```bash
git add src/components/input/ManagementDomainSection.vue src/i18n/locales/*.json
git commit -m "feat(ui): phase 4.2 — Profile selector + vSAN Max storage option

Step 2 of the wizard now exposes:
- Profile selector (Lab / Standard / Large) — button group following
  the existing architecture-toggle pattern. Profile change triggers a
  confirmation dialog when overrides exist (clears them on confirm).
- vSAN Max as the 4th storage type option, with conditional
  storageNodes slider + profile selector + warning banner ('Beyond
  VMware's official guidance').

i18n keys added to all 4 locales (en, fr, it, de) under mgmt.* +
storage.vsanMax. Swiss variants inherit.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §6"
```

---

## Task 4.3 — `MgmtCapacityHeadroom.vue` collapsible

**Files:**
- Create: `src/components/input/MgmtCapacityHeadroom.vue`
- Modify: `src/components/input/ManagementDomainSection.vue`
- Modify: `src/i18n/locales/{en,fr,it,de}.json`

A collapsible section with 4 numeric inputs: `cpuOversubscription`, `ramOversubscription`, `reservePct`, `growthPct`.

- [ ] **Step 1: Add i18n keys to all 4 locale files**

Append under `mgmt.*` (extend the existing `mgmt` block from Task 4.2):

**EN:**
```json
"capacityHeadroom": {
  "title": "Capacity headroom",
  "cpuOversub": "CPU oversubscription",
  "ramOversub": "RAM oversubscription",
  "reservePct": "Reserve %",
  "growthPct": "Growth %",
  "hint": "Capacity reserved for failover (Reserve %) plus expected workload growth (Growth %). Oversubscription ratios apply when computing per-host requirements (N-1 model)."
}
```

**FR:**
```json
"capacityHeadroom": {
  "title": "Marge de capacité",
  "cpuOversub": "Sursouscription CPU",
  "ramOversub": "Sursouscription RAM",
  "reservePct": "Réserve %",
  "growthPct": "Croissance %",
  "hint": "Capacité réservée pour le basculement (Réserve %) plus la croissance attendue de la charge (Croissance %). Les ratios de sursouscription s'appliquent au calcul des exigences par hôte (modèle N-1)."
}
```

**IT:**
```json
"capacityHeadroom": {
  "title": "Margine di capacità",
  "cpuOversub": "Sovrasottoscrizione CPU",
  "ramOversub": "Sovrasottoscrizione RAM",
  "reservePct": "Riserva %",
  "growthPct": "Crescita %",
  "hint": "Capacità riservata per il failover (Riserva %) più la crescita prevista del carico (Crescita %). I rapporti di sovrasottoscrizione si applicano al calcolo dei requisiti per host (modello N-1)."
}
```

**DE:**
```json
"capacityHeadroom": {
  "title": "Kapazitätsreserve",
  "cpuOversub": "CPU-Übersubskription",
  "ramOversub": "RAM-Übersubskription",
  "reservePct": "Reserve %",
  "growthPct": "Wachstum %",
  "hint": "Reservierte Kapazität für Failover (Reserve %) plus erwartetes Workload-Wachstum (Wachstum %). Übersubskriptionsverhältnisse gelten bei der Berechnung der Anforderungen pro Host (N-1-Modell)."
}
```

- [ ] **Step 2: Create `src/components/input/MgmtCapacityHeadroom.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import type { ManagementDomainConfig } from '@/engine/types'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
import MgmtCollapsibleSection from '@/components/shared/MgmtCollapsibleSection.vue'

const { t } = useI18n()
const input = useInputStore()

function mgmtField<K extends keyof ManagementDomainConfig>(key: K) {
  return computed({
    get: () => input.managementDomain[key],
    set: (val: ManagementDomainConfig[K]) =>
      input.updateManagementDomain({ [key]: val } as Partial<ManagementDomainConfig>),
  })
}

const cpuOversub = mgmtField('cpuOversubscription')
const ramOversub = mgmtField('ramOversubscription')
const reservePct = mgmtField('reservePct')
const growthPct = mgmtField('growthPct')
</script>

<template>
  <MgmtCollapsibleSection :title="t('mgmt.capacityHeadroom.title')">
    <div class="space-y-3">
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.capacityHeadroom.hint') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberSliderInput
          v-model="cpuOversub"
          :label="t('mgmt.capacityHeadroom.cpuOversub')"
          :min="1"
          :max="8"
          :step="1"
        />
        <NumberSliderInput
          v-model="ramOversub"
          :label="t('mgmt.capacityHeadroom.ramOversub')"
          :min="1"
          :max="4"
          :step="0.5"
        />
        <NumberSliderInput
          v-model="reservePct"
          :label="t('mgmt.capacityHeadroom.reservePct')"
          unit="%"
          :min="0"
          :max="100"
          :step="5"
        />
        <NumberSliderInput
          v-model="growthPct"
          :label="t('mgmt.capacityHeadroom.growthPct')"
          unit="%"
          :min="0"
          :max="100"
          :step="5"
        />
      </div>
    </div>
  </MgmtCollapsibleSection>
</template>
```

- [ ] **Step 3: Wire it into `ManagementDomainSection.vue`**

In the script block, add the import:

```ts
import MgmtCapacityHeadroom from './MgmtCapacityHeadroom.vue'
```

In the template, **append** before the existing summary `<div>` (the totals at the bottom — currently around line 149):

```vue
    <MgmtCapacityHeadroom />
```

(Make sure it's inside the parent `<section>` but before the bottom summary.)

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

- [ ] **Step 6: Manual browser walkthrough**

```bash
npm run dev
```

1. Walk to Step 2.
2. Verify "Capacity headroom" collapsible appears below the host specs.
3. Click to expand — verify the 4 sliders show with proper labels.
4. Adjust each slider — verify values bind into `inputStore.managementDomain.cpuOversubscription` etc.
5. Verify clicking the heading collapses the section.

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/components/input/MgmtCapacityHeadroom.vue src/components/input/ManagementDomainSection.vue src/i18n/locales/*.json
git commit -m "feat(ui): phase 4.3 — MgmtCapacityHeadroom collapsible

New component: collapsible section with 4 sliders for
cpuOversubscription (1-8), ramOversubscription (1-4 step 0.5),
reservePct (0-100 step 5), growthPct (0-100 step 5). Bound to
inputStore.managementDomain via mgmtField helper. Wired into
ManagementDomainSection.vue.

i18n keys: mgmt.capacityHeadroom.* in all 4 locales.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §6"
```

---

## Task 4.4 — `MgmtOptionalAppliances.vue` collapsible

**Files:**
- Create: `src/components/input/MgmtOptionalAppliances.vue`
- Modify: `src/components/input/ManagementDomainSection.vue`
- Modify: `src/i18n/locales/{en,fr,it,de}.json`

A collapsible section listing 6 appliance categories (NSX Edge, AVI Load Balancer, vRLI, vRNI, Identity Broker, SSP). Each row: checkbox (included) + size dropdown + nodeCount slider. Reads/writes `inputStore.managementDomain.overrides[category]` for each row.

The "default" view (no overrides) shows what the current profile dictates. When the user changes any field, an override is recorded.

- [ ] **Step 1: Add i18n keys to all 4 locale files**

Append under `mgmt.*`:

**EN:**
```json
"optionalAppliances": {
  "title": "Optional appliances",
  "hint": "Toggle, resize, or scale optional management appliances. Profile presets provide sensible defaults; changes here override the profile.",
  "size": "Size",
  "nodes": "Nodes",
  "categories": {
    "nsxEdge": "NSX Edge",
    "aviLb": "AVI Load Balancer",
    "vrli": "VCF Operations for Logs",
    "vrni": "VCF Operations for Networks",
    "identityBroker": "Identity Broker (WSA)",
    "ssp": "Security Services Platform (SSP)"
  },
  "sspWarning": "SSP is large (≥112 vCPU / 414 GB RAM); typically deployed in sovereign / regulated environments only."
}
```

**FR:**
```json
"optionalAppliances": {
  "title": "Appliances optionnelles",
  "hint": "Activez, redimensionnez ou faites évoluer les appliances de gestion optionnelles. Les préréglages de profil fournissent des valeurs par défaut sensées ; les modifications ici surchargent le profil.",
  "size": "Taille",
  "nodes": "Nœuds",
  "categories": {
    "nsxEdge": "NSX Edge",
    "aviLb": "Équilibreur de charge AVI",
    "vrli": "VCF Operations for Logs",
    "vrni": "VCF Operations for Networks",
    "identityBroker": "Identity Broker (WSA)",
    "ssp": "Security Services Platform (SSP)"
  },
  "sspWarning": "SSP est volumineux (≥112 vCPU / 414 Go RAM) ; généralement déployé uniquement dans les environnements souverains / réglementés."
}
```

**IT:**
```json
"optionalAppliances": {
  "title": "Appliance opzionali",
  "hint": "Attiva, ridimensiona o scala le appliance di gestione opzionali. I preset di profilo forniscono valori predefiniti sensati; le modifiche qui sovrascrivono il profilo.",
  "size": "Dimensione",
  "nodes": "Nodi",
  "categories": {
    "nsxEdge": "NSX Edge",
    "aviLb": "AVI Load Balancer",
    "vrli": "VCF Operations for Logs",
    "vrni": "VCF Operations for Networks",
    "identityBroker": "Identity Broker (WSA)",
    "ssp": "Security Services Platform (SSP)"
  },
  "sspWarning": "SSP è grande (≥112 vCPU / 414 GB RAM); generalmente distribuito solo in ambienti sovrani / regolamentati."
}
```

**DE:**
```json
"optionalAppliances": {
  "title": "Optionale Appliances",
  "hint": "Optionale Management-Appliances umschalten, ihre Größe ändern oder skalieren. Profilvoreinstellungen liefern sinnvolle Standardwerte; Änderungen hier überschreiben das Profil.",
  "size": "Größe",
  "nodes": "Knoten",
  "categories": {
    "nsxEdge": "NSX Edge",
    "aviLb": "AVI Load Balancer",
    "vrli": "VCF Operations for Logs",
    "vrni": "VCF Operations for Networks",
    "identityBroker": "Identity Broker (WSA)",
    "ssp": "Security Services Platform (SSP)"
  },
  "sspWarning": "SSP ist groß (≥112 vCPU / 414 GB RAM); wird typischerweise nur in souveränen / regulierten Umgebungen bereitgestellt."
}
```

- [ ] **Step 2: Create `src/components/input/MgmtOptionalAppliances.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { resolveProfileEntry } from '@/engine/mgmt/profiles'
import MgmtCollapsibleSection from '@/components/shared/MgmtCollapsibleSection.vue'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
import type { MgmtApplianceCategory, ApplianceOverride } from '@/engine/mgmt/types'

const { t } = useI18n()
const input = useInputStore()

interface CategorySpec {
  key: Extract<MgmtApplianceCategory,
    'nsxEdge' | 'aviLb' | 'vrli' | 'vrni' | 'identityBroker' | 'ssp'>
  labelKey: string
  sizes: readonly string[]    // valid size keys for this category, ordered small→large
}

// Sizes per category — these are the keys that exist in src/engine/mgmt/constants.ts
// for each category. Keep in sync with constants.ts if new sizes are added.
const CATEGORIES: readonly CategorySpec[] = [
  { key: 'nsxEdge',        labelKey: 'mgmt.optionalAppliances.categories.nsxEdge',        sizes: ['small', 'medium', 'large', 'xlarge'] },
  { key: 'aviLb',          labelKey: 'mgmt.optionalAppliances.categories.aviLb',          sizes: ['small', 'large', 'xlarge'] },
  { key: 'vrli',           labelKey: 'mgmt.optionalAppliances.categories.vrli',           sizes: ['small', 'medium', 'large'] },
  { key: 'vrni',           labelKey: 'mgmt.optionalAppliances.categories.vrni',           sizes: ['small', 'medium', 'large', 'xlarge'] },
  { key: 'identityBroker', labelKey: 'mgmt.optionalAppliances.categories.identityBroker', sizes: ['small', 'medium', 'large'] },
  { key: 'ssp',            labelKey: 'mgmt.optionalAppliances.categories.ssp',            sizes: ['medium', 'large', 'xlarge'] },
]

function applianceState(cat: MgmtApplianceCategory) {
  return computed({
    get: () => {
      const profile = input.managementDomain.profile ?? 'standard'
      const base = resolveProfileEntry(profile, cat)
      const ovr = input.managementDomain.overrides?.[cat] ?? {}
      return {
        included: ovr.included ?? base.included,
        size: (ovr.size ?? base.size) as string,
        nodeCount: ovr.nodeCount ?? base.nodeCount,
      }
    },
    set: (next: { included: boolean; size: string; nodeCount: number }) => {
      const newOverride: ApplianceOverride = {
        included: next.included,
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

const states = CATEGORIES.map(c => ({
  spec: c,
  state: applianceState(c.key),
}))

function setIncluded(idx: number, value: boolean) {
  states[idx].state.value = { ...states[idx].state.value, included: value }
}
function setSize(idx: number, value: string) {
  states[idx].state.value = { ...states[idx].state.value, size: value }
}
function setNodeCount(idx: number, value: number) {
  states[idx].state.value = { ...states[idx].state.value, nodeCount: value }
}
</script>

<template>
  <MgmtCollapsibleSection :title="t('mgmt.optionalAppliances.title')">
    <div class="space-y-3">
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.optionalAppliances.hint') }}</p>

      <div
        v-for="(row, idx) in states"
        :key="row.spec.key"
        class="grid grid-cols-1 md:grid-cols-[1fr_auto_8rem] gap-3 items-center p-2 border border-gray-100 dark:border-gray-800 rounded"
      >
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            :checked="row.state.value.included"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            @change="setIncluded(idx, ($event.target as HTMLInputElement).checked)"
          />
          <span :class="['font-medium', row.state.value.included ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600']">
            {{ t(row.spec.labelKey) }}
          </span>
          <span v-if="row.spec.key === 'ssp' && row.state.value.included" class="text-xs text-amber-600 dark:text-amber-400">
            ⚠
          </span>
        </label>

        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.optionalAppliances.size') }}:</span>
          <select
            :value="row.state.value.size"
            :disabled="!row.state.value.included"
            class="text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 disabled:opacity-50"
            @change="setSize(idx, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="size in row.spec.sizes" :key="size" :value="size">{{ size }}</option>
          </select>
        </div>

        <NumberSliderInput
          :model-value="row.state.value.nodeCount"
          :label="t('mgmt.optionalAppliances.nodes')"
          :min="1"
          :max="20"
          :step="1"
          :disabled="!row.state.value.included"
          @update:model-value="setNodeCount(idx, $event)"
        />
      </div>

      <p
        v-if="states.find(s => s.spec.key === 'ssp')!.state.value.included"
        class="text-xs text-amber-600 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded"
      >
        {{ t('mgmt.optionalAppliances.sspWarning') }}
      </p>
    </div>
  </MgmtCollapsibleSection>
</template>
```

**Note on `NumberSliderInput`:** read `src/components/shared/NumberSliderInput.vue` first. If it does NOT support a `disabled` prop, either (a) wrap it in a div with `pointer-events-none opacity-50` styling when disabled, or (b) skip the disabled state for the slider and only disable the checkbox + select. Pick the cleanest approach for the existing component's API.

- [ ] **Step 3: Wire it into `ManagementDomainSection.vue`**

In the script block, add:

```ts
import MgmtOptionalAppliances from './MgmtOptionalAppliances.vue'
```

In the template, append after `<MgmtCapacityHeadroom />` (from Task 4.3):

```vue
    <MgmtOptionalAppliances />
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

- [ ] **Step 6: Manual browser walkthrough**

```bash
npm run dev
```

1. Walk to Step 2.
2. Expand "Optional appliances" — verify 6 rows render with correct labels in EN.
3. Switch language to fr/it/de — verify translations.
4. Toggle a checkbox (e.g., uncheck NSX Edge) — verify the size + nodes inputs grey out.
5. Change AVI LB size from Small to Large — verify it updates.
6. Increase NSX Edge nodes to 4 — verify it updates.
7. Now switch profile from Standard to Lab — the confirm dialog from Task 4.2 should fire (since you have overrides). Click "Switch profile" — verify the dialog closes AND the appliances reset to Lab defaults.

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/components/input/MgmtOptionalAppliances.vue src/components/input/ManagementDomainSection.vue src/i18n/locales/*.json
git commit -m "feat(ui): phase 4.4 — MgmtOptionalAppliances collapsible

New component: 6-row table for optional management appliances
(NSX Edge, AVI LB, vRLI, vRNI, Identity Broker, SSP). Each row:
checkbox (included) + size dropdown + nodeCount slider. Reads
profile defaults via resolveProfileEntry and writes overrides
to inputStore.managementDomain.overrides[category].

SSP shows an amber warning when included (≥112 vCPU). Profile
change confirm dialog from Task 4.2 fires when overrides exist.

i18n keys: mgmt.optionalAppliances.* in all 4 locales.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §6"
```

---

## Task 4.5 — `MgmtSizingTable.vue` results component + integration

**Files:**
- Create: `src/components/results/MgmtSizingTable.vue`
- Modify: `src/components/results/ResultsPanel.vue`
- Modify: `src/i18n/locales/{en,fr,it,de}.json`

A two-table results component showing the itemized appliances + WLD overhead, mirroring VMware's workbook output.

- [ ] **Step 1: Add i18n keys to all 4 locale files**

Append under `mgmt.*`:

**EN:**
```json
"sizingTable": {
  "title": "Management appliances",
  "wldOverheadTitle": "Workload-domain overhead (auto-derived)",
  "category": "Component",
  "nodes": "Nodes",
  "perNodeCores": "Cores/node",
  "perNodeRam": "RAM/node",
  "perNodeDisk": "Disk/node",
  "totalCores": "Total cores",
  "totalRam": "Total RAM",
  "totalDisk": "Total disk",
  "totals": "Totals",
  "sources": {
    "profile": "Profile default",
    "override": "User override",
    "auto-derived": "Auto-derived",
    "validated-solution": "Validated solution"
  }
}
```

**FR:**
```json
"sizingTable": {
  "title": "Appliances de gestion",
  "wldOverheadTitle": "Surcoût domaine de charge (auto-dérivé)",
  "category": "Composant",
  "nodes": "Nœuds",
  "perNodeCores": "Cœurs/nœud",
  "perNodeRam": "RAM/nœud",
  "perNodeDisk": "Disque/nœud",
  "totalCores": "Cœurs totaux",
  "totalRam": "RAM totale",
  "totalDisk": "Disque total",
  "totals": "Totaux",
  "sources": {
    "profile": "Défaut du profil",
    "override": "Surcharge utilisateur",
    "auto-derived": "Auto-dérivé",
    "validated-solution": "Solution validée"
  }
}
```

**IT:**
```json
"sizingTable": {
  "title": "Appliance di gestione",
  "wldOverheadTitle": "Overhead dominio di carico (auto-derivato)",
  "category": "Componente",
  "nodes": "Nodi",
  "perNodeCores": "Core/nodo",
  "perNodeRam": "RAM/nodo",
  "perNodeDisk": "Disco/nodo",
  "totalCores": "Core totali",
  "totalRam": "RAM totale",
  "totalDisk": "Disco totale",
  "totals": "Totali",
  "sources": {
    "profile": "Predefinito profilo",
    "override": "Override utente",
    "auto-derived": "Auto-derivato",
    "validated-solution": "Soluzione validata"
  }
}
```

**DE:**
```json
"sizingTable": {
  "title": "Management-Appliances",
  "wldOverheadTitle": "Workload-Domain-Overhead (auto-abgeleitet)",
  "category": "Komponente",
  "nodes": "Knoten",
  "perNodeCores": "Kerne/Knoten",
  "perNodeRam": "RAM/Knoten",
  "perNodeDisk": "Festplatte/Knoten",
  "totalCores": "Gesamtkerne",
  "totalRam": "Gesamt-RAM",
  "totalDisk": "Gesamt-Festplatte",
  "totals": "Summen",
  "sources": {
    "profile": "Profilstandard",
    "override": "Benutzer-Override",
    "auto-derived": "Auto-abgeleitet",
    "validated-solution": "Validierte Lösung"
  }
}
```

For category labels, reuse `mgmt.optionalAppliances.categories.*` from Task 4.4 where applicable, and add new keys for the always-on / always-needed categories that aren't in the optional list (vCenter, NSX Manager, vROps, Automation, Fleet Manager, vROps Collector, SDDC Manager, Site Recovery, Ransomware on-prem/cloud, HCX, WLD vCenter, WLD NSX Manager). Add under `mgmt.categories.*`:

**EN (add to all 4 locales similarly — translate appropriately):**
```json
"categories": {
  "vcenter": "vCenter Server",
  "nsxManager": "NSX Manager",
  "vrops": "VCF Operations",
  "vropsCollector": "VCF Operations Collector",
  "automation": "VCF Automation",
  "fleetManager": "VCF Operations Fleet Manager",
  "sddcManager": "SDDC Manager",
  "siteRecovery": "Site Recovery (SRM)",
  "ransomwareOnPrem": "Ransomware Recovery (on-prem)",
  "ransomwareCloud": "Ransomware Recovery (cloud)",
  "crossCloudMobility": "Cross-Cloud Mobility (HCX)",
  "wldVcenter": "vCenter (per workload domain)",
  "wldNsxManager": "NSX Manager (per workload domain)"
}
```

(Translate FR/IT/DE accordingly. The category names are mostly product names that don't translate; only "per workload domain" qualifier varies.)

- [ ] **Step 2: Create `src/components/results/MgmtSizingTable.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useCalculationStore } from '@/stores/calculationStore'
import type { ApplianceLine } from '@/engine/mgmt/types'

const { t } = useI18n()
const calc = useCalculationStore()
const { management } = storeToRefs(calc)

const appliances = computed(() => management.value.appliances)
const wldOverhead = computed(() => management.value.wldOverhead)

const applianceTotals = computed(() => {
  const lines = appliances.value
  return {
    cores: lines.reduce((s, l) => s + l.totalCores, 0),
    ramGB: lines.reduce((s, l) => s + l.totalRamGB, 0),
    diskGB: lines.reduce((s, l) => s + l.totalDiskGB, 0),
  }
})

const wldTotals = computed(() => {
  const lines = wldOverhead.value
  return {
    cores: lines.reduce((s, l) => s + l.totalCores, 0),
    ramGB: lines.reduce((s, l) => s + l.totalRamGB, 0),
    diskGB: lines.reduce((s, l) => s + l.totalDiskGB, 0),
  }
})

function categoryLabel(line: ApplianceLine): string {
  // Try the dedicated mgmt.categories.* key first; fall back to the optionalAppliances
  // sub-namespace for those 6 categories (which already have labels).
  const dedicated = `mgmt.categories.${line.category}`
  const optional = `mgmt.optionalAppliances.categories.${line.category}`
  // vue-i18n's `t()` returns the key string itself when a key is missing,
  // so check whether the dedicated label resolved.
  const resolvedDedicated = t(dedicated)
  if (resolvedDedicated !== dedicated) return resolvedDedicated
  const resolvedOptional = t(optional)
  if (resolvedOptional !== optional) return resolvedOptional
  return line.category as string
}
</script>

<template>
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
      {{ t('mgmt.sizingTable.title') }}
    </h2>

    <!-- Management appliances table -->
    <div v-if="appliances.length > 0" class="overflow-x-auto">
      <table class="min-w-full text-xs">
        <thead class="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
          <tr>
            <th class="px-2 py-1 text-left font-medium">{{ t('mgmt.sizingTable.category') }}</th>
            <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.nodes') }}</th>
            <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.perNodeCores') }}</th>
            <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.perNodeRam') }}</th>
            <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.perNodeDisk') }}</th>
            <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.totalCores') }}</th>
            <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.totalRam') }}</th>
            <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.totalDisk') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="(line, idx) in appliances" :key="`appl-${idx}`" class="text-gray-900 dark:text-gray-100">
            <td class="px-2 py-1 font-medium">{{ categoryLabel(line) }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ line.nodeCount }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ line.cores }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ line.ramGB }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ line.diskGB }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ line.totalCores }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ line.totalRamGB }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ line.totalDiskGB }}</td>
          </tr>
        </tbody>
        <tfoot class="bg-gray-50 dark:bg-gray-900 font-semibold text-gray-900 dark:text-gray-100">
          <tr>
            <td class="px-2 py-1">{{ t('mgmt.sizingTable.totals') }}</td>
            <td class="px-2 py-1"></td>
            <td class="px-2 py-1"></td>
            <td class="px-2 py-1"></td>
            <td class="px-2 py-1"></td>
            <td class="px-2 py-1 text-right font-mono">{{ applianceTotals.cores }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ applianceTotals.ramGB }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ applianceTotals.diskGB }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Workload-domain overhead table (auto-derived) -->
    <div v-if="wldOverhead.length > 0" class="space-y-2">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('mgmt.sizingTable.wldOverheadTitle') }}
      </h3>
      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead class="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
            <tr>
              <th class="px-2 py-1 text-left font-medium">{{ t('mgmt.sizingTable.category') }}</th>
              <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.nodes') }}</th>
              <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.perNodeCores') }}</th>
              <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.perNodeRam') }}</th>
              <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.perNodeDisk') }}</th>
              <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.totalCores') }}</th>
              <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.totalRam') }}</th>
              <th class="px-2 py-1 text-right font-medium">{{ t('mgmt.sizingTable.totalDisk') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="(line, idx) in wldOverhead" :key="`wld-${idx}`" class="text-gray-900 dark:text-gray-100">
              <td class="px-2 py-1 font-medium">{{ categoryLabel(line) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ line.nodeCount }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ line.cores }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ line.ramGB }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ line.diskGB }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ line.totalCores }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ line.totalRamGB }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ line.totalDiskGB }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-50 dark:bg-gray-900 font-semibold text-gray-900 dark:text-gray-100">
            <tr>
              <td class="px-2 py-1">{{ t('mgmt.sizingTable.totals') }}</td>
              <td class="px-2 py-1"></td>
              <td class="px-2 py-1"></td>
              <td class="px-2 py-1"></td>
              <td class="px-2 py-1"></td>
              <td class="px-2 py-1 text-right font-mono">{{ wldTotals.cores }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ wldTotals.ramGB }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ wldTotals.diskGB }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 3: Wire it into `src/components/results/ResultsPanel.vue`**

In the script block, add:

```ts
import MgmtSizingTable from './MgmtSizingTable.vue'
```

In the template, insert `<MgmtSizingTable />` between the per-domain cards and the aggregate totals card. Around line 35:

```vue
    <!-- Per-domain result cards -->
    <DomainResultCard
      v-for="result in domainResults"
      :key="result.id"
      :result="result"
    />

    <!-- Management sizing table (P4) — itemized appliances + WLD overhead -->
    <MgmtSizingTable />

    <!-- Aggregate totals card -->
    <AggregateTotalsCard
      :totals="aggregateTotals"
      :management-host-count="dedicatedMgmtHostCount"
    />
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

- [ ] **Step 6: Manual browser walkthrough**

```bash
npm run dev
```

1. Walk through wizard to results.
2. Verify the "Management appliances" table renders with multiple rows (SDDC Manager, vCenter, NSX Manager, NSX Edge, AVI LB, vROps, vRLI, vRNI, Automation, Fleet Manager — for the Standard profile defaults).
3. Verify a "Workload-domain overhead" table renders with 2 rows per workload domain (vCenter + NSX Manager).
4. Switch language between en/fr/it/de — verify all translations.
5. Switch profile from Standard to Lab — verify the table shrinks (Edge/AVI/vRLI/vRNI excluded in Lab).
6. Toggle SSP on in Optional Appliances — verify the table grows (SSP row appears with 112/414/4096 spec).

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add src/components/results/MgmtSizingTable.vue src/components/results/ResultsPanel.vue src/i18n/locales/*.json
git commit -m "feat(ui): phase 4.5 — MgmtSizingTable in results panel

New results component: itemized table of management appliances +
workload-domain overhead, mirroring VMware's workbook output.
Each row shows category, nodeCount, per-node cores/RAM/disk, and
total cores/RAM/disk. Footer totals per table.

Wired into ResultsPanel.vue between per-domain cards and the
aggregate totals card.

i18n keys: mgmt.sizingTable.* and mgmt.categories.* in all 4
locales. Category labels resolve through a fallback: dedicated
mgmt.categories.<key> first, then mgmt.optionalAppliances.
categories.<key> for the 6 user-toggleable appliances.

Refs: docs/superpowers/specs/2026-04-28-mgmt-domain-parity-design.md §6"
```

---

## Phase 4 — Acceptance criteria

After all 5 tasks are complete:

- `src/components/shared/MgmtCollapsibleSection.vue` exists and is consumed by Tasks 4.3 and 4.4.
- `src/components/input/MgmtCapacityHeadroom.vue` and `src/components/input/MgmtOptionalAppliances.vue` exist and are wired into `ManagementDomainSection.vue`.
- `src/components/input/ManagementDomainSection.vue` has a Profile selector (Lab/Standard/Large) and a 4th storage type button (vSAN Max) with conditional inputs.
- `src/components/results/MgmtSizingTable.vue` exists and is wired into `ResultsPanel.vue`.
- All 4 locale files (`en`, `fr`, `it`, `de`) have the new `mgmt.*` keys (profile, vsanMax, capacityHeadroom, optionalAppliances, sizingTable, categories, confirmProfileChange).
- `npm run test` 517/517 passing (no test count change — UI components are not unit-tested by convention).
- `npm run type-check` clean.
- `npm run build` clean.
- Git log shows ~5 atomic commits.
- **User-visible:** Step 2 of the wizard shows the new collapsibles + profile selector + vSAN Max option. The results panel includes the itemized mgmt sizing table.

This phase produces the first **user-visible** manifestation of the milestone. P5 will add Validated Solutions toggles and an Advanced Sizing Override panel; P6 ships exports + workbook-parity snapshot tests.

---

## Notes for the implementer

- **No new arithmetic, no new types, no new engine code.** P4 is pure UI on top of the engine + stores from P1/P2/P3.
- **`<script setup lang="ts">`** is the codebase convention. Use it.
- **Tailwind CSS** classes are the styling convention. Match the existing `ManagementDomainSection.vue` patterns (button group toggles, `space-y-*`, `border border-gray-200 dark:border-gray-700`, etc.).
- **i18n:** all user-facing strings go through `t(...)`. Never hardcode English. The 4 locale files must stay in sync.
- **No `@vue/test-utils`:** the codebase doesn't have a JSDom test setup. Don't try to introduce one in this phase. Verification is `type-check` + `build` + manual browser walkthrough.
- **Manual browser walkthrough is required** at the end of every task that touches the UI (Tasks 4.2, 4.3, 4.4, 4.5). Type-check and build catch syntax/type errors but not visual regressions.
- **The `rtk` CLI proxy** sometimes mangles `npx vitest` output. If a test command's output is unclear, drop the `rtk` prefix.
- **IDE-stale diagnostics** are common after Vue file additions/modifications. The source of truth is `npm run type-check` (which runs `vue-tsc --noEmit`).
