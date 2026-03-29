<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'
import { READYNODE_PROFILES } from '@/engine/vsanMax'
import WarningBanner from '@/components/shared/WarningBanner.vue'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()
const { storageType } = storeToRefs(input)
const { vsanMax } = storeToRefs(calc)

const profileLabel = computed(() => {
  if (!vsanMax.value) return ''
  const key = input.vsanMaxProfile
  const profile = READYNODE_PROFILES[key]
  return `${key.toUpperCase()} (${profile.rawTbPerNode} TB/node)`
})
</script>

<template>
  <section
    v-if="storageType === 'vsan-max' && vsanMax"
    class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
  >
    <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
      {{ t('results.vsanMaxTitle') }}
    </h2>

    <!-- Profile + node count hero row -->
    <div class="flex items-center gap-6 mb-3">
      <div class="flex flex-col">
        <span
          class="text-5xl font-semibold leading-none"
          :class="vsanMax.belowMinNodes ? 'text-red-600' : 'text-emerald-600'"
        >
          {{ vsanMax.storageNodeCount }}
        </span>
        <span class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ t('results.vsanMaxStorageNodes') }}
        </span>
      </div>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        <span class="font-normal">{{ t('results.vsanMaxProfile') }}:</span>
        {{ profileLabel }}
      </div>
    </div>

    <!-- Data grid -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
      <span>{{ t('results.vsanMaxRawCapacity') }}</span>
      <span class="font-mono text-right">{{ vsanMax.rawCapacityTB.toFixed(2) }} TB</span>

      <span>{{ t('results.vsanMaxUsableCapacity') }}</span>
      <span class="font-mono text-right text-green-700 dark:text-green-400 font-semibold">
        {{ vsanMax.usableCapacityTB.toFixed(2) }} TB
      </span>

      <span>{{ t('results.vsanMaxRaidScheme') }}</span>
      <span class="font-mono text-right">{{ vsanMax.raidScheme }}</span>
    </div>

    <!-- Min node validation error -->
    <WarningBanner
      v-if="vsanMax.belowMinNodes"
      :message="t('validation.vsanMaxMinNodes')"
      severity="error"
      class="mt-3"
    />
  </section>
</template>
