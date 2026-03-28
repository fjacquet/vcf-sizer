<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const calc = useCalculationStore()
const { management } = storeToRefs(calc)

const rows = [
  { key: 'management.vcenter',    cores: () => management.value.vcenterCores,    ram: () => management.value.vcenterRamGB },
  { key: 'management.sddc',       cores: () => management.value.sddcCores,       ram: () => management.value.sddcRamGB },
  { key: 'management.nsx',        cores: () => management.value.nsxCores,        ram: () => management.value.nsxRamGB },
  { key: 'management.ops',        cores: () => management.value.opsCores,        ram: () => management.value.opsRamGB },
  { key: 'management.automation', cores: () => management.value.automationCores, ram: () => management.value.automationRamGB },
]
</script>

<template>
  <section class="bg-white rounded-lg border border-gray-200 p-4">
    <h2 class="text-base font-semibold text-gray-900 mb-3">{{ t('management.label') }}</h2>
    <table class="w-full text-xs">
      <thead>
        <tr class="text-gray-500 border-b border-gray-100">
          <th class="text-left pb-1">{{ t('management.component') }}</th>
          <th class="text-right pb-1">{{ t('management.vcpu') }}</th>
          <th class="text-right pb-1">{{ t('management.ramLabel') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" class="border-b border-gray-50">
          <td class="py-1">{{ t(row.key) }}</td>
          <td class="text-right font-mono">{{ row.cores() }}</td>
          <td class="text-right font-mono">{{ row.ram() }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="font-semibold text-gray-800 border-t border-gray-200">
          <td class="pt-2">{{ t('management.totalCores') }}</td>
          <td class="text-right font-mono pt-2">{{ management.totalCores }}</td>
          <td class="text-right font-mono pt-2">{{ management.totalRamGB }} GB</td>
        </tr>
      </tfoot>
    </table>
  </section>
</template>
