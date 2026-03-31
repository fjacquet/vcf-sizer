<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()

// Collapsed by default — user expands to review committed management resources
const isExpanded = ref(false)

const hostCountDisplay = computed(() => {
  if (input.managementArchitecture === 'dedicated') {
    return String(calc.dedicatedMgmtHostCount ?? 0)
  }
  return t('wizard.mgmtResult.colocatedLabel')
})
</script>

<template>
  <!-- READ-ONLY: no store mutations except the expand toggle -->
  <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <button
      @click="isExpanded = !isExpanded"
      class="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
    >
      <span>{{ t('wizard.mgmtCommitted.title') }}</span>
      <span class="text-xs">{{ isExpanded ? '&#9650;' : '&#9660;' }}</span>
    </button>
    <!-- v-show (not v-if) — data preservation on re-expand (WIZARD-02 convention) -->
    <div v-show="isExpanded" class="px-4 pb-3 space-y-1 text-sm">
      <div class="flex justify-between">
        <span class="text-gray-500 dark:text-gray-400">{{ t('wizard.mgmtResult.hostCount') }}</span>
        <span class="font-medium text-gray-900 dark:text-gray-100">{{ hostCountDisplay }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500 dark:text-gray-400">{{ t('wizard.mgmtResult.vcpu') }}</span>
        <span class="font-medium text-gray-900 dark:text-gray-100">{{ calc.management.totalCores }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500 dark:text-gray-400">{{ t('wizard.mgmtResult.ram') }}</span>
        <span class="font-medium text-gray-900 dark:text-gray-100">{{ calc.management.totalRamGB }} GB</span>
      </div>
    </div>
  </section>
</template>
