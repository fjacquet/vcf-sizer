<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'
import WarningBanner from '@/components/shared/WarningBanner.vue'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()
const { storageType, fttLevel, raidType, dedupEnabled, dedupRatio, deploymentMode } = storeToRefs(input)
const { validationErrors, storage } = storeToRefs(calc)

const dedupExclusionError = computed(() =>
  validationErrors.value.find(e => e.code === 'DEDUP_STRETCH_EXCLUSION')
)
const isStretch = computed(() => deploymentMode.value === 'stretch')

const storageTypes = [
  { value: 'vsan-esa' as const, labelKey: 'storage.vsanEsa' },
  { value: 'fc' as const, labelKey: 'storage.fc' },
  { value: 'nfs' as const, labelKey: 'storage.nfs' },
]
</script>

<template>
  <section class="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900">{{ t('storage.label') }}</h2>

    <!-- Storage type buttons (STOR-01) -->
    <div class="flex gap-2 flex-wrap">
      <button
        v-for="type in storageTypes"
        :key="type.value"
        :class="[
          'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
          storageType === type.value
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
        ]"
        @click="storageType = type.value"
      >
        {{ t(type.labelKey) }}
      </button>
    </div>

    <!-- vSAN ESA options (STOR-02, STOR-04, STOR-05) -->
    <template v-if="storageType === 'vsan-esa'">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="text-sm font-medium text-gray-700">{{ t('storage.fttLevel') }}</label>
          <select
            v-model="fttLevel"
            class="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option :value="1">FTT=1</option>
            <option :value="2">FTT=2</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-gray-700">{{ t('storage.raidType') }}</label>
          <select
            v-model="raidType"
            class="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="raid1">{{ t('storage.raid1') }}</option>
            <option value="raid5">{{ t('storage.raid5') }}</option>
            <option value="raid6" :disabled="fttLevel === 1">{{ t('storage.raid6') }}</option>
          </select>
        </div>
      </div>

      <!-- RAID scheme badge -->
      <div class="text-xs text-gray-500">
        {{ t('storage.raidType') }}: <span class="font-mono text-blue-700">{{ storage.raidScheme }}</span>
        ({{ t('storage.minHosts', { count: storage.minHostsRequired }) }})
      </div>

      <!-- Global Deduplication (STOR-05, STOR-06, STRCH-04) -->
      <div class="space-y-2">
        <label
          :class="['flex items-center gap-2', isStretch ? 'cursor-not-allowed opacity-50' : 'cursor-pointer']"
        >
          <input
            type="checkbox"
            v-model="dedupEnabled"
            :disabled="isStretch"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700">{{ t('storage.dedupEnabled') }}</span>
        </label>
        <!-- Stretch dedup mutual exclusion info (STRCH-04) -->
        <div
          v-if="isStretch"
          class="text-xs text-gray-500 italic"
        >
          {{ t('warnings.stretchDedup') }}
        </div>
        <WarningBanner
          v-if="dedupExclusionError"
          :message="t('warnings.dedupStretchExclusion')"
          severity="warning"
        />
        <NumberSliderInput
          v-if="dedupEnabled && !dedupExclusionError"
          v-model="dedupRatio"
          :label="t('storage.dedupRatio')"
          :min="1"
          :max="10"
          :step="0.5"
        />
      </div>
    </template>

    <!-- Storage capacity summary (STOR-08) -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 border-t border-gray-100 pt-3">
      <span>{{ t('storage.rawCapacity') }}</span>
      <span class="font-mono text-right">{{ storage.rawCapacityTB.toFixed(2) }} TB</span>
      <template v-if="storageType === 'vsan-esa'">
        <span>{{ t('storage.raidOverhead') }}</span>
        <span class="font-mono text-right">{{ storage.raidMultiplier }}x</span>
        <span>{{ t('storage.netUsable') }}</span>
        <span class="font-mono text-right text-green-700 font-semibold">
          {{ storage.safeUsableCapacityTB.toFixed(2) }} TB
        </span>
      </template>
      <template v-else>
        <span>{{ t('storage.netUsablePassthrough') }}</span>
        <span class="font-mono text-right text-green-700 font-semibold">
          {{ storage.rawCapacityTB.toFixed(2) }} TB
        </span>
      </template>
    </div>
  </section>
</template>
