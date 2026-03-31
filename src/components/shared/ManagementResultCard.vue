<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()

const hostCountDisplay = computed(() => {
  if (input.managementArchitecture === 'dedicated') {
    return String(calc.dedicatedMgmtHostCount ?? 0)
  }
  return t('wizard.mgmtResult.colocatedLabel')
})

const architectureLabel = computed(() => {
  if (input.managementArchitecture === 'dedicated') {
    return t('wizard.mgmtResult.dedicated')
  }
  return t('wizard.mgmtResult.colocated')
})
</script>

<template>
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
      {{ t('wizard.mgmtResult.title') }}
      <span class="ml-2 font-normal text-gray-500 dark:text-gray-400 text-xs">{{ architectureLabel }}</span>
    </h3>
    <div class="grid grid-cols-3 gap-4 text-sm">
      <div>
        <p class="text-gray-500 dark:text-gray-400">{{ t('wizard.mgmtResult.hostCount') }}</p>
        <p class="font-medium text-gray-900 dark:text-gray-100">{{ hostCountDisplay }}</p>
      </div>
      <div>
        <p class="text-gray-500 dark:text-gray-400">{{ t('wizard.mgmtResult.vcpu') }}</p>
        <p class="font-medium text-gray-900 dark:text-gray-100">{{ calc.management.totalCores }}</p>
      </div>
      <div>
        <p class="text-gray-500 dark:text-gray-400">{{ t('wizard.mgmtResult.ram') }}</p>
        <p class="font-medium text-gray-900 dark:text-gray-100">{{ calc.management.totalRamGB }} GB</p>
      </div>
    </div>
  </section>
</template>
