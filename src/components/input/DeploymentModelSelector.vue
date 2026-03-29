<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()
const { deploymentMode, preferredSiteHosts, secondarySiteHosts } = storeToRefs(input)
const { management, stretch } = storeToRefs(calc)

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

    <!-- Stretch cluster per-site inputs (STRCH-01/02/05) -->
    <template v-if="deploymentMode === 'stretch'">
      <div class="space-y-3 pt-2 border-t border-gray-100">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberSliderInput
            v-model="preferredSiteHosts"
            :label="t('deployment.stretchSites.preferredSiteHosts')"
            :min="3"
            :max="32"
            :step="1"
          />
          <NumberSliderInput
            v-model="secondarySiteHosts"
            :label="t('deployment.stretchSites.secondarySiteHosts')"
            :min="3"
            :max="32"
            :step="1"
          />
        </div>

        <!-- Witness node overhead (STRCH-02) — ESA M profile: 4 vCPU / 16 GB -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 bg-gray-50 rounded p-2">
          <span class="col-span-2 font-medium text-gray-700">{{ t('deployment.stretchSites.witnessLabel') }}</span>
          <span>{{ t('deployment.stretchSites.witnessCpu') }}</span>
          <span class="font-mono text-right">{{ stretch.witnessCores }}</span>
          <span>{{ t('deployment.stretchSites.witnessRam') }}</span>
          <span class="font-mono text-right">{{ stretch.witnessRamGB }} GB</span>
        </div>

        <!-- Cross-site bandwidth recommendation (STRCH-05) -->
        <div class="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
          {{ t('deployment.stretchSites.bandwidthLabel') }}:
          <span class="font-mono font-semibold">{{ stretch.minBandwidthGbps.toFixed(2) }} Gb/s</span>
        </div>

        <!-- Per-site storage note (STRCH-03) -->
        <div class="text-xs text-gray-500 italic">
          {{ t('deployment.stretchSites.storageNote') }}
        </div>
      </div>
    </template>
  </section>
</template>
