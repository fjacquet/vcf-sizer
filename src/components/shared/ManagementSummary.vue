<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCalculationStore } from '@/stores/calculationStore'
import { rollupApplianceTotals } from '@/engine/mgmt'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const calc = useCalculationStore()
const { management } = storeToRefs(calc)

// Rollup rows derived directly from the canonical `appliances` array.
const rows = computed(() => {
  const appliances = management.value.appliances
  const vcenter = rollupApplianceTotals(appliances, ['vcenter'])
  const sddc = rollupApplianceTotals(appliances, ['sddcManager'])
  const nsx = rollupApplianceTotals(appliances, ['nsxManager'])
  const ops = rollupApplianceTotals(appliances, ['vrops', 'vropsCollector', 'fleetManager'])
  const automation = rollupApplianceTotals(appliances, ['automation'])
  return [
    { key: 'management.vcenter',    cores: vcenter.cores,    ram: vcenter.ramGB },
    { key: 'management.sddc',       cores: sddc.cores,       ram: sddc.ramGB },
    { key: 'management.nsx',        cores: nsx.cores,        ram: nsx.ramGB },
    { key: 'management.ops',        cores: ops.cores,        ram: ops.ramGB },
    { key: 'management.automation', cores: automation.cores, ram: automation.ramGB },
  ]
})
</script>

<template>
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">{{ t('management.label') }}</h2>
    <table class="w-full text-xs">
      <thead>
        <tr class="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
          <th class="text-left pb-1">{{ t('management.component') }}</th>
          <th class="text-right pb-1">{{ t('management.vcpu') }}</th>
          <th class="text-right pb-1">{{ t('management.ramLabel') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" class="border-b border-gray-50 dark:border-gray-700 text-gray-700 dark:text-gray-300">
          <td class="py-1">{{ t(row.key) }}</td>
          <td class="text-right font-mono">{{ row.cores }}</td>
          <td class="text-right font-mono">{{ row.ram }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="font-semibold text-gray-800 dark:text-gray-200 border-t border-gray-200 dark:border-gray-600">
          <td class="pt-2">{{ t('management.totalCores') }}</td>
          <td class="text-right font-mono pt-2">{{ management.totalCores }}</td>
          <td class="text-right font-mono pt-2">{{ management.totalRamGB }} GB</td>
        </tr>
      </tfoot>
    </table>
  </section>
</template>
