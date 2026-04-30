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
  sizes: readonly string[]
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

const sspIncluded = computed(() => {
  const ssp = states.find(s => s.spec.key === 'ssp')
  return ssp?.state.value.included ?? false
})
</script>

<template>
  <MgmtCollapsibleSection :title="t('mgmt.optionalAppliances.title')">
    <div class="space-y-3">
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.optionalAppliances.hint') }}</p>

      <div
        v-for="(row, idx) in states"
        :key="row.spec.key"
        class="grid grid-cols-1 md:grid-cols-[1fr_auto_12rem] gap-3 items-center p-2 border border-gray-100 dark:border-gray-800 rounded"
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

        <div class="flex items-center gap-2" :class="{ 'opacity-50': !row.state.value.included }">
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

        <div :class="{ 'opacity-50 pointer-events-none': !row.state.value.included }">
          <NumberSliderInput
            :model-value="row.state.value.nodeCount"
            :label="t('mgmt.optionalAppliances.nodes')"
            :min="1"
            :max="20"
            :step="1"
            @update:model-value="setNodeCount(idx, $event)"
          />
        </div>
      </div>

      <p
        v-if="sspIncluded"
        class="text-xs text-amber-600 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded"
      >
        {{ t('mgmt.optionalAppliances.sspWarning') }}
      </p>
    </div>
  </MgmtCollapsibleSection>
</template>
