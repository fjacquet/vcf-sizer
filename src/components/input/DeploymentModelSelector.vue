<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()
const { deploymentMode } = storeToRefs(input)
const { management } = storeToRefs(calc)

const modes = [
  { value: 'simple' as const, labelKey: 'deployment.simple' },
  { value: 'ha' as const, labelKey: 'deployment.ha' },
  { value: 'stretch' as const, labelKey: 'deployment.stretch' },
]
</script>

<template>
  <section class="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900">{{ t('deployment.label') }}</h2>
    <div class="flex gap-2 flex-wrap">
      <button
        v-for="mode in modes"
        :key="mode.value"
        :class="[
          'px-4 py-2 text-sm rounded-md border font-medium transition-colors',
          deploymentMode === mode.value
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
        ]"
        @click="deploymentMode = mode.value"
      >
        {{ t(mode.labelKey) }}
      </button>
    </div>
    <!-- Management domain overhead summary (per MGMT-06) -->
    <div class="text-xs text-gray-500 grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-gray-100">
      <span>{{ t('management.totalCores') }}</span>
      <span class="font-mono text-right">{{ management.totalCores }}</span>
      <span>{{ t('management.totalRam') }}</span>
      <span class="font-mono text-right">{{ management.totalRamGB }} GB</span>
    </div>
  </section>
</template>
