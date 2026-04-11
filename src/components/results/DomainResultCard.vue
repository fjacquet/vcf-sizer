<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DomainResult } from '@/engine/types'
import StretchNetworkChecklist from './StretchNetworkChecklist.vue'
import VsanMaxClusterCard from './VsanMaxClusterCard.vue'
import CoresChart from './charts/CoresChart.vue'
import RamChart from './charts/RamChart.vue'
import StorageChart from './charts/StorageChart.vue'

const props = defineProps<{ result: DomainResult }>()
const { t } = useI18n()

const isSufficient = computed(() => {
  const c = props.result.compute
  return c.recommendedHostCount <= c.minHostsForCpu && c.recommendedHostCount <= c.minHostsForRam
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid">
    <!-- Domain name heading -->
    <h2 class="text-base font-bold text-gray-800 dark:text-gray-100 mb-3">{{ result.name }}</h2>

    <!-- Host count hero row -->
    <div class="flex items-center gap-6 mb-4">
      <div class="flex flex-col items-center">
        <span
          class="text-5xl font-bold leading-none"
          :class="isSufficient ? 'text-emerald-600' : 'text-red-600'"
        >
          {{ result.compute.recommendedHostCount }}
        </span>
        <span class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ t('results.hostCount.recommended') }}
        </span>
      </div>
      <div class="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
        <div class="flex items-center gap-2">
          <span class="w-28 text-right font-medium">{{ t('results.hostCount.minForCpu') }}:</span>
          <span class="font-bold">{{ result.compute.minHostsForCpu }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-28 text-right font-medium">{{ t('results.hostCount.minForRam') }}:</span>
          <span class="font-bold">{{ result.compute.minHostsForRam }}</span>
        </div>
      </div>
    </div>

    <!-- Utilization and storage grid -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
      <span>{{ t('results.domain.cpuUtilization') }}</span>
      <span
        class="font-mono text-right font-semibold"
        :class="result.compute.coreUtilizationPct > 80 ? 'text-red-600' : 'text-emerald-600'"
      >
        {{ result.compute.coreUtilizationPct.toFixed(1) }}%
      </span>

      <span>{{ t('results.domain.ramUtilization') }}</span>
      <span
        class="font-mono text-right font-semibold"
        :class="result.compute.ramUtilizationPct > 80 ? 'text-red-600' : 'text-emerald-600'"
      >
        {{ result.compute.ramUtilizationPct.toFixed(1) }}%
      </span>

      <span>{{ t('results.domain.storageUsable') }}</span>
      <span class="font-mono text-right">{{ result.storage.safeUsableCapacityTiB.toFixed(2) }} TB</span>

      <span>{{ t('results.domain.raidScheme') }}</span>
      <span class="font-mono text-right">{{ result.storage.raidScheme }}</span>
    </div>

    <!-- Per-domain charts (CHART-01) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <CoresChart :compute="result.compute" :domain-id="result.id" />
      <RamChart :compute="result.compute" :domain-id="result.id" />
      <StorageChart :storage="result.storage" :domain-id="result.id" />
    </div>

    <!-- Stretch network checklist (only when stretch mode) -->
    <StretchNetworkChecklist v-if="result.stretch !== null" :result="result" class="mt-4" />

    <!-- vSAN Max cluster info (only when vSAN Max storage) -->
    <VsanMaxClusterCard v-if="result.vsanMax !== null" :result="result" class="mt-4" />

    <!-- Validation warnings -->
    <div v-if="result.validationErrors.length > 0" class="mt-3 space-y-2">
      <div
        v-for="w in result.validationErrors"
        :key="w.code"
        :class="[
          'p-3 rounded border text-xs font-semibold',
          w.severity === 'error'
            ? 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-700 text-red-800 dark:text-red-300'
            : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-300'
        ]"
        role="alert"
      >
        {{ t(w.messageKey) }}
      </div>
    </div>
  </div>
</template>
