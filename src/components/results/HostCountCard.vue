<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const calc = useCalculationStore()
const { compute } = storeToRefs(calc)

const isSufficient = computed(() => {
  const c = compute.value
  return c.recommendedHostCount <= c.minHostsForCpu && c.recommendedHostCount <= c.minHostsForRam
})
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
      {{ t('results.hostCount.title') }}
    </h2>
    <div class="flex items-center gap-6">
      <div class="flex flex-col items-center">
        <span
          class="text-5xl font-bold leading-none"
          :class="isSufficient ? 'text-emerald-600' : 'text-red-600'"
        >
          {{ compute.recommendedHostCount }}
        </span>
        <span class="text-xs text-gray-500 mt-1">{{ t('results.hostCount.recommended') }}</span>
      </div>
      <div class="flex flex-col gap-1 text-sm text-gray-600">
        <div class="flex items-center gap-2">
          <span class="w-24 text-right font-medium">{{ t('results.hostCount.minForCpu') }}:</span>
          <span class="font-bold">{{ compute.minHostsForCpu }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-24 text-right font-medium">{{ t('results.hostCount.minForRam') }}:</span>
          <span class="font-bold">{{ compute.minHostsForRam }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
