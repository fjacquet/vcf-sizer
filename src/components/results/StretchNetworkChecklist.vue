<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { WorkloadDomainResult } from '@/engine/types'

const props = defineProps<{ result: WorkloadDomainResult }>()
const { t } = useI18n()
</script>

<template>
  <section
    v-if="props.result.stretch !== null"
    class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 break-inside-avoid"
  >
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
      {{ t('deployment.stretchSites.networkChecklist.title') }}
    </h3>
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
      <span>{{ t('deployment.stretchSites.networkChecklist.minBandwidth') }}</span>
      <span class="font-mono text-right">{{ props.result.stretch.networkChecklist.minInterSiteBandwidthGbps }} Gbps</span>

      <span>{{ t('deployment.stretchSites.networkChecklist.maxLatency') }}</span>
      <span class="font-mono text-right">&lt; {{ props.result.stretch.networkChecklist.maxInterSiteLatencyMs }} ms</span>

      <template v-if="props.result.stretch.requiresVsanWitness">
        <span>{{ t('deployment.stretchSites.networkChecklist.maxWitnessLatency') }}</span>
        <span class="font-mono text-right">&lt; {{ props.result.stretch.networkChecklist.maxWitnessLatencyMs }} ms</span>
      </template>

      <span>{{ t('deployment.stretchSites.networkChecklist.jumboFrames') }}</span>
      <span class="font-mono text-right text-green-600 dark:text-green-400">
        {{ t('deployment.stretchSites.networkChecklist.required') }}
      </span>

      <template v-if="props.result.stretch.requiresVsanWitness">
        <span>{{ t('deployment.stretchSites.networkChecklist.witnessBandwidth') }}</span>
        <span class="font-mono text-right">{{ props.result.stretch.networkChecklist.witnessMinBandwidthMbps }} Mbps</span>
      </template>
    </div>
    <!-- High host count note (>15 hosts/site) -->
    <p
      v-if="Math.max(props.result.stretch.totalHosts / 2, 0) > 15"
      class="text-xs text-amber-600 dark:text-amber-400 italic"
    >
      {{ t('deployment.stretchSites.networkChecklist.highHostNote') }}
    </p>
  </section>
</template>
