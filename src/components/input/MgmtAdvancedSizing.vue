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
  void _removed
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
