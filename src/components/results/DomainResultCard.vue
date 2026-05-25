<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WorkloadDomainResult } from '@/engine/types'
import StretchNetworkChecklist from './StretchNetworkChecklist.vue'
import VsanMaxClusterCard from './VsanMaxClusterCard.vue'
import CoresChart from './charts/CoresChart.vue'
import RamChart from './charts/RamChart.vue'
import StorageChart from './charts/StorageChart.vue'
import { useStorageFormat } from '@/composables/useStorageFormat'

const props = defineProps<{ result: WorkloadDomainResult }>()
const { t } = useI18n()
const { fmt } = useStorageFormat()

// Demand-driven model: the provisioned total absorbs HA reserve + cluster split,
// so it should always satisfy the raw per-site demand minimums.
const isSufficient = computed(() => {
  const r = props.result
  return r.demandHostsPerSite <= r.minHostsForCpu && r.demandHostsPerSite <= r.minHostsForRam
    ? true
    : r.coreUtilizationPct <= 100 && r.ramUtilizationPct <= 100
})

const isStretch = computed(() => props.result.stretch !== null)
const isExternalStorage = computed(() => props.result.storage.workloadStorageRequiredTiB > 0)
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
          {{ result.totalHosts }}
        </span>
        <span class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {{ t('results.hostCount.provisioned') }}
        </span>
      </div>
      <div class="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
        <div class="flex items-center gap-2">
          <span class="w-32 text-right font-medium">{{ t('results.hostCount.demandPerSite') }}:</span>
          <span class="font-bold">{{ result.demandHostsPerSite }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-32 text-right font-medium">{{ t('results.hostCount.minForCpu') }}:</span>
          <span class="font-bold">{{ result.minHostsForCpu }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-32 text-right font-medium">{{ t('results.hostCount.minForRam') }}:</span>
          <span class="font-bold">{{ result.minHostsForRam }}</span>
        </div>
        <div v-if="result.minHostsForStorage > 0" class="flex items-center gap-2">
          <span class="w-32 text-right font-medium">{{ t('results.hostCount.minForStorage') }}:</span>
          <span class="font-bold">{{ result.minHostsForStorage }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-32 text-right font-medium">{{ t('results.hostCount.clusters') }}:</span>
          <span class="font-bold">{{ result.clusterCountPerSite }}</span>
        </div>
        <!-- Provisioning math: hosts/site × 2 = total (stretch) or hosts/site = total -->
        <div class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 italic">
          <span class="w-32 text-right">{{ t('results.hostCount.layout') }}:</span>
          <span class="font-mono">
            <template v-if="isStretch">{{ result.hostsPerSite }} × 2 = {{ result.totalHosts }}</template>
            <template v-else>{{ result.hostsPerSite }} = {{ result.totalHosts }}</template>
          </span>
        </div>
      </div>
    </div>

    <!-- Utilization and storage grid -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
      <span>{{ t('results.domain.cpuUtilization') }}</span>
      <span
        class="font-mono text-right font-semibold"
        :class="result.coreUtilizationPct > 80 ? 'text-red-600' : 'text-emerald-600'"
      >
        {{ result.coreUtilizationPct.toFixed(1) }}%
      </span>

      <span>{{ t('results.domain.ramUtilization') }}</span>
      <span
        class="font-mono text-right font-semibold"
        :class="result.ramUtilizationPct > 80 ? 'text-red-600' : 'text-emerald-600'"
      >
        {{ result.ramUtilizationPct.toFixed(1) }}%
      </span>

      <!-- FC/NFS: workload demand + available pool + shortfall. Else: safe usable + RAID scheme. -->
      <template v-if="isExternalStorage">
        <span>{{ t('results.domain.workloadRequired') }}</span>
        <span class="font-mono text-right">{{ fmt(result.storage.workloadStorageRequiredTiB) }}</span>

        <span>{{ t('results.domain.availablePool') }}</span>
        <span class="font-mono text-right">{{ fmt(result.storage.availablePoolTiB) }}</span>

        <span :class="result.storage.poolShortfallTiB > 0 ? 'text-red-600' : ''">{{ t('results.domain.poolShortfall') }}</span>
        <span
          class="font-mono text-right"
          :class="result.storage.poolShortfallTiB > 0 ? 'text-red-600 font-semibold' : ''"
        >{{ fmt(result.storage.poolShortfallTiB) }}</span>
      </template>
      <template v-else>
        <span>{{ t('results.domain.storageUsable') }}</span>
        <span class="font-mono text-right">{{ fmt(result.storage.safeUsableCapacityTiB) }}</span>

        <span>{{ t('results.domain.raidScheme') }}</span>
        <span class="font-mono text-right">{{ result.storage.raidScheme }}</span>
      </template>
    </div>

    <!-- Per-domain charts (CHART-01) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <CoresChart :required="result.siteCoresRequired" :available="result.provisionedCores" :domain-id="result.id" />
      <RamChart :required="result.siteRamRequiredGB" :available="result.provisionedRamGB" :domain-id="result.id" />
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
