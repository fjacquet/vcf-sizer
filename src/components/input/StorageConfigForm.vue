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
const { storageType, fttLevel, raidType, dedupEnabled, dedupRatio, deploymentMode, vsanMaxProfile, vsanMaxStorageNodes, networkSpeedGbE } = storeToRefs(input)
const { validationErrors, storage, vsanMax } = storeToRefs(calc)

const dedupExclusionError = computed(() =>
  validationErrors.value.find(e => e.code === 'DEDUP_STRETCH_EXCLUSION')
)
const isStretch = computed(() => deploymentMode.value === 'stretch')

const vsanMaxMinNodesError = computed(() =>
  validationErrors.value.find(e => e.code === 'VSAN_MAX_MIN_NODES')
)
const dedupNetworkSpeedError = computed(() =>
  validationErrors.value.find(e => e.code === 'DEDUP_NETWORK_SPEED')
)

const storageTypes = [
  { value: 'vsan-esa' as const, labelKey: 'storage.vsanEsa' },
  { value: 'fc' as const, labelKey: 'storage.fc' },
  { value: 'nfs' as const, labelKey: 'storage.nfs' },
  { value: 'vsan-max' as const, labelKey: 'storage.vsanMax' },
]
</script>

<template>
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('storage.label') }}</h2>

    <!-- Storage type buttons (STOR-01) -->
    <div class="flex gap-2 flex-wrap">
      <button
        v-for="type in storageTypes"
        :key="type.value"
        :class="[
          'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
          storageType === type.value
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
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
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('storage.fttLevel') }}</label>
          <select
            v-model="fttLevel"
            class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option :value="1">FTT=1</option>
            <option :value="2">FTT=2</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('storage.raidType') }}</label>
          <select
            v-model="raidType"
            class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="raid1">{{ t('storage.raid1') }}</option>
            <option value="raid5">{{ t('storage.raid5') }}</option>
            <option value="raid6" :disabled="fttLevel === 1">{{ t('storage.raid6') }}</option>
          </select>
        </div>
      </div>

      <!-- RAID scheme badge -->
      <div class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('storage.raidType') }}: <span class="font-mono text-blue-700 dark:text-blue-400">{{ storage.raidScheme }}</span>
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
            class="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('storage.dedupEnabled') }}</span>
        </label>
        <!-- Stretch dedup mutual exclusion info (STRCH-04) -->
        <div
          v-if="isStretch"
          class="text-xs text-gray-500 dark:text-gray-400 italic"
        >
          {{ t('warnings.stretchDedup') }}
        </div>
        <WarningBanner
          v-if="dedupExclusionError"
          :message="t('warnings.dedupStretchExclusion')"
          severity="warning"
        />
        <WarningBanner
          v-if="dedupNetworkSpeedError"
          :message="t('validation.dedupNetworkSpeed')"
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

    <!-- vSAN Max options (VMAX-01) -->
    <template v-if="storageType === 'vsan-max'">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Profile dropdown -->
        <div class="space-y-1">
          <label class="text-sm font-normal text-gray-700 dark:text-gray-300">
            {{ t('storage.vsanMaxProfile') }}
          </label>
          <select
            v-model="vsanMaxProfile"
            class="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="xs">XS — 20 TB/node</option>
            <option value="sm">SM — 50 TB/node</option>
            <option value="med">MED — 100 TB/node</option>
            <option value="lrg">LRG — 150 TB/node</option>
            <option value="xl">XL — 200 TB/node</option>
          </select>
        </div>
        <!-- Storage nodes slider -->
        <NumberSliderInput
          v-model="vsanMaxStorageNodes"
          :label="t('storage.vsanMaxStorageNodes')"
          :min="4"
          :max="64"
          :step="1"
        />
      </div>
      <!-- VSAN_MAX_MIN_NODES error banner -->
      <WarningBanner
        v-if="vsanMaxMinNodesError"
        :message="t('validation.vsanMaxMinNodes')"
        severity="error"
      />
    </template>

    <!-- Storage capacity summary (STOR-08) -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
      <span>{{ t('storage.rawCapacity') }}</span>
      <span class="font-mono text-right">
        {{ storageType === 'vsan-max' && vsanMax ? vsanMax.rawCapacityTB.toFixed(2) : storage.rawCapacityTB.toFixed(2) }} TB
      </span>
      <template v-if="storageType === 'vsan-esa'">
        <span>{{ t('storage.raidOverhead') }}</span>
        <span class="font-mono text-right">{{ storage.raidMultiplier }}x</span>
        <span>{{ t('storage.netUsable') }}</span>
        <span class="font-mono text-right text-green-700 dark:text-green-400 font-semibold">
          {{ storage.safeUsableCapacityTB.toFixed(2) }} TB
        </span>
      </template>
      <template v-else-if="storageType === 'vsan-max' && vsanMax">
        <span>{{ t('storage.raidOverhead') }}</span>
        <span class="font-mono text-right">{{ vsanMax.raidScheme }}</span>
        <span>{{ t('storage.netUsable') }}</span>
        <span class="font-mono text-right text-green-700 dark:text-green-400 font-semibold">
          {{ vsanMax.usableCapacityTB.toFixed(2) }} TB
        </span>
      </template>
      <template v-else>
        <span>{{ t('storage.netUsablePassthrough') }}</span>
        <span class="font-mono text-right text-green-700 dark:text-green-400 font-semibold">
          {{ storage.rawCapacityTB.toFixed(2) }} TB
        </span>
      </template>
    </div>
  </section>
</template>
