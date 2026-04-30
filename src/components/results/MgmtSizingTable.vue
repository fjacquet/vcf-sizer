<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useCalculationStore } from '@/stores/calculationStore'
import type { ApplianceLine } from '@/engine/mgmt/types'

const { t, te } = useI18n()
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
  // Check `mgmt.categories.*` first; fall back to `mgmt.optionalAppliances.categories.*`;
  // last fallback is the raw category key. `te()` is vue-i18n's "translation exists" check.
  const dedicated = `mgmt.categories.${line.category}`
  if (te(dedicated)) return t(dedicated)
  const optional = `mgmt.optionalAppliances.categories.${line.category}`
  if (te(optional)) return t(optional)
  return String(line.category)
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
