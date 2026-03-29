<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()
const { stretch } = storeToRefs(calc)
</script>

<template>
  <section
    v-if="input.deploymentMode === 'stretch'"
    class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3"
  >
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
      {{ t('deployment.stretchSites.networkChecklist.title') }}
    </h3>
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
      <span>{{ t('deployment.stretchSites.networkChecklist.minBandwidth') }}</span>
      <span class="font-mono text-right">{{ stretch.networkChecklist.minInterSiteBandwidthGbps }} Gbps</span>

      <span>{{ t('deployment.stretchSites.networkChecklist.maxLatency') }}</span>
      <span class="font-mono text-right">&lt; {{ stretch.networkChecklist.maxInterSiteLatencyMs }} ms</span>

      <span>{{ t('deployment.stretchSites.networkChecklist.maxWitnessLatency') }}</span>
      <span class="font-mono text-right">&lt; {{ stretch.networkChecklist.maxWitnessLatencyMs }} ms</span>

      <span>{{ t('deployment.stretchSites.networkChecklist.jumboFrames') }}</span>
      <span class="font-mono text-right text-green-600 dark:text-green-400">
        {{ t('deployment.stretchSites.networkChecklist.required') }}
      </span>

      <span>{{ t('deployment.stretchSites.networkChecklist.witnessBandwidth') }}</span>
      <span class="font-mono text-right">{{ stretch.networkChecklist.witnessMinBandwidthMbps }} Mbps</span>
    </div>
    <!-- High host count note (>15 hosts/site) -->
    <p
      v-if="Math.max(input.preferredSiteHosts, input.secondarySiteHosts) > 15"
      class="text-xs text-amber-600 dark:text-amber-400 italic"
    >
      {{ t('deployment.stretchSites.networkChecklist.highHostNote') }}
    </p>
  </section>
</template>
