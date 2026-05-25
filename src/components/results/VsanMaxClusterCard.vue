<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { WorkloadDomainResult } from '@/engine/types'
import WarningBanner from '@/components/shared/WarningBanner.vue'
import { useStorageFormat } from '@/composables/useStorageFormat'

const props = defineProps<{ result: WorkloadDomainResult }>()
const { t } = useI18n()
const { fmt } = useStorageFormat()
</script>

<template>
  <section
    v-if="props.result.vsanMax !== null"
    class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid"
  >
    <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
      {{ t('results.vsanMaxTitle') }}
    </h2>

    <!-- Storage node count hero row -->
    <div class="flex items-center gap-6 mb-3">
      <div class="flex flex-col">
        <span
          class="text-5xl font-semibold leading-none"
          :class="props.result.vsanMax.belowMinNodes ? 'text-red-600' : 'text-emerald-600'"
        >
          {{ props.result.vsanMax.storageNodeCount }}
        </span>
        <span class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ t('results.vsanMaxStorageNodes') }}
        </span>
      </div>
    </div>

    <!-- Data grid -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
      <span>{{ t('results.vsanMaxRawCapacity') }}</span>
      <span class="font-mono text-right">{{ fmt(props.result.vsanMax.rawCapacityTiB) }}</span>

      <span>{{ t('results.vsanMaxUsableCapacity') }}</span>
      <span class="font-mono text-right text-green-700 dark:text-green-400 font-semibold">
        {{ fmt(props.result.vsanMax.usableCapacityTiB) }}
      </span>

      <span>{{ t('results.vsanMaxRaidScheme') }}</span>
      <span class="font-mono text-right">{{ props.result.vsanMax.raidScheme }}</span>
    </div>

    <!-- Min node validation error -->
    <WarningBanner
      v-if="props.result.vsanMax.belowMinNodes"
      :message="t('validation.vsanMaxMinNodes')"
      severity="error"
      class="mt-3"
    />
  </section>
</template>
