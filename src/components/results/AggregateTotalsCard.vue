<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AggregateTotals } from '@/engine/types'
import { useStorageFormat } from '@/composables/useStorageFormat'

const props = defineProps<{ totals: AggregateTotals; managementHostCount: number | null }>()
const { t } = useI18n()
const { fmt } = useStorageFormat()

// totalRecommendedHosts already equals workloadHosts + mgmtHosts — do not add mgmt again
const grandTotal = computed(() => props.totals.totalRecommendedHosts)

// Workload-only count for the "Workload Hosts" row
const workloadHostCount = computed(() =>
  props.totals.totalRecommendedHosts - props.totals.mgmtHostCount
)

// P5.5: per-site split — defined only when at least one stretched domain exists
const isStretchTotal = computed(() =>
  props.totals.preferredSiteHosts !== undefined && props.totals.secondarySiteHosts !== undefined
)
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid">
    <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
      {{ t('results.aggregate.title') }}
    </h2>

    <!-- Grand total hero row -->
    <div class="flex items-center gap-4 mb-4">
      <div class="flex flex-col items-center">
        <span class="text-5xl font-bold leading-none text-blue-600 dark:text-blue-400">
          {{ grandTotal }}
        </span>
        <span class="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
          {{ t('results.aggregate.grandTotal') }}
        </span>
      </div>
    </div>

    <!-- Data grid -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
      <!-- P5.5: per-site split (visible only when at least one domain is stretch) -->
      <template v-if="isStretchTotal">
        <span class="text-amber-700 dark:text-amber-400 italic">{{ t('results.aggregate.preferredSiteHosts') }}</span>
        <span class="font-mono text-right text-amber-700 dark:text-amber-400 italic">{{ totals.preferredSiteHosts }}</span>
        <span class="text-amber-700 dark:text-amber-400 italic">{{ t('results.aggregate.secondarySiteHosts') }}</span>
        <span class="font-mono text-right text-amber-700 dark:text-amber-400 italic">{{ totals.secondarySiteHosts }}</span>
      </template>

      <span>{{ t('results.aggregate.totalHosts') }}</span>
      <span class="font-mono text-right font-semibold">{{ workloadHostCount }}</span>
      <template v-if="isStretchTotal">
        <span class="text-xs text-gray-400 dark:text-gray-500 italic pl-3">└ {{ t('results.aggregate.preferredSite') }}</span>
        <span class="font-mono text-right text-xs text-gray-400 dark:text-gray-500">{{ totals.workloadPreferredSiteHosts }}</span>
        <span class="text-xs text-gray-400 dark:text-gray-500 italic pl-3">└ {{ t('results.aggregate.secondarySite') }}</span>
        <span class="font-mono text-right text-xs text-gray-400 dark:text-gray-500">{{ totals.workloadSecondarySiteHosts }}</span>
      </template>

      <template v-if="managementHostCount !== null">
        <span>{{ t('results.aggregate.managementHosts') }}</span>
        <span class="font-mono text-right font-semibold">{{ managementHostCount }}</span>
        <template v-if="isStretchTotal && (totals.mgmtPreferredSiteHosts ?? 0) > 0">
          <span class="text-xs text-gray-400 dark:text-gray-500 italic pl-3">└ {{ t('results.aggregate.preferredSite') }}</span>
          <span class="font-mono text-right text-xs text-gray-400 dark:text-gray-500">{{ totals.mgmtPreferredSiteHosts }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500 italic pl-3">└ {{ t('results.aggregate.secondarySite') }}</span>
          <span class="font-mono text-right text-xs text-gray-400 dark:text-gray-500">{{ totals.mgmtSecondarySiteHosts }}</span>
        </template>
      </template>

      <span>{{ t('results.aggregate.totalClusters') }}</span>
      <span class="font-mono text-right">{{ totals.totalClusterCount }}</span>

      <span>{{ t('results.aggregate.totalVms') }}</span>
      <span class="font-mono text-right">{{ totals.totalVmCount }}</span>

      <span>{{ t('results.aggregate.totalRawStorage') }}</span>
      <span class="font-mono text-right">{{ fmt(totals.totalRawStorageTiB) }}</span>

      <span>{{ t('results.aggregate.totalEffectiveStorage') }}</span>
      <span class="font-mono text-right">{{ fmt(totals.totalEffectiveStorageTiB) }}</span>

      <!-- FC/NFS external pool shortfall (only when at least one pool is undersized) -->
      <template v-if="totals.totalPoolShortfallTiB > 0">
        <span class="text-red-600 dark:text-red-400 font-medium">{{ t('results.aggregate.poolShortfall') }}</span>
        <span class="font-mono text-right text-red-600 dark:text-red-400 font-semibold">{{ fmt(totals.totalPoolShortfallTiB) }}</span>
      </template>
    </div>

    <!-- Aggregate validation warnings -->
    <div v-if="totals.allValidationErrors.length > 0" class="mt-3 space-y-2">
      <div
        v-for="w in totals.allValidationErrors"
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
