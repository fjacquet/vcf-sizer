<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { createDefaultWorkloadDomain } from '@/engine/defaults'
import type { WorkloadDomainConfig } from '@/engine/types'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
import WarningBanner from '@/components/shared/WarningBanner.vue'

const { t } = useI18n()
const props = defineProps<{ domainId: string }>()
const input = useInputStore()
const calc = useCalculationStore()

function domainField<K extends keyof WorkloadDomainConfig>(key: K) {
  return computed({
    get: () => {
      const d = input.workloadDomains.find(d => d.id === props.domainId)
      return (d ?? createDefaultWorkloadDomain(0))[key]
    },
    set: (val: WorkloadDomainConfig[K]) => {
      input.updateDomain(props.domainId, { [key]: val } as Partial<WorkloadDomainConfig>)
    },
  })
}

// Per-domain fields via domainField helper
const deploymentMode = domainField('deploymentMode')
const preferredSiteHosts = domainField('preferredSiteHosts')
const secondarySiteHosts = domainField('secondarySiteHosts')
const networkSpeedGbE = domainField('networkSpeedGbE')
const storageType = domainField('storageType')

// GLOBAL fields — NOT per-domain (locked decision)
const managementArchitecture = computed({
  get: () => input.managementArchitecture,
  set: (val: 'shared' | 'dedicated') => { input.managementArchitecture = val },
})

// Calc results — management and dedicatedMgmtHostCount are still top-level
const management = computed(() => calc.management)
const dedicatedMgmtHostCount = computed(() => calc.dedicatedMgmtHostCount)

// Per-domain calc results
const domainResult = computed(() =>
  calc.domainResults.find(r => r.id === props.domainId)
)
const stretch = computed(() => domainResult.value?.stretch ?? null)
const validationErrors = computed(() => domainResult.value?.validationErrors ?? [])

const modes = [
  { value: 'simple' as const, labelKey: 'deployment.simple' },
  { value: 'ha' as const, labelKey: 'deployment.ha' },
  { value: 'stretch' as const, labelKey: 'deployment.stretch' },
]

const architectureErrors = computed(() =>
  validationErrors.value.filter(e => e.code === 'DEDICATED_MGMT_MIN_HOSTS' || e.code === 'COLLOCATED_MIN_HOSTS')
)

const effectiveBandwidthGbps = computed(() => {
  if (!stretch.value) return 0
  return Math.min(stretch.value.minBandwidthGbps, networkSpeedGbE.value)
})
const bandwidthCappedByLineRate = computed(() => {
  if (!stretch.value) return false
  return stretch.value.minBandwidthGbps > networkSpeedGbE.value
})
</script>

<template>
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('deployment.label') }}</h2>
    <div class="flex gap-2 flex-wrap">
      <button
        v-for="mode in modes"
        :key="mode.value"
        :class="[
          'px-4 py-2 text-sm rounded-md border font-medium transition-colors',
          deploymentMode === mode.value
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
        ]"
        @click="deploymentMode = mode.value"
      >
        {{ t(mode.labelKey) }}
      </button>
    </div>
    <!-- Management domain overhead summary (per MGMT-06) -->
    <div class="text-xs text-gray-500 dark:text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
      <span>{{ t('management.totalCores') }}</span>
      <span class="font-mono text-right">{{ management.totalCores }}</span>
      <span>{{ t('management.totalRam') }}</span>
      <span class="font-mono text-right">{{ management.totalRamGB }} GB</span>
    </div>

    <!-- Stretch cluster per-site inputs (STRCH-01/02/05) -->
    <template v-if="deploymentMode === 'stretch'">
      <div class="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
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
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded p-2">
          <span class="col-span-2 font-medium text-gray-700 dark:text-gray-300">{{ t('deployment.stretchSites.witnessLabel') }}</span>
          <span>{{ t('deployment.stretchSites.witnessCpu') }}</span>
          <span class="font-mono text-right">{{ stretch?.witnessCores }}</span>
          <span>{{ t('deployment.stretchSites.witnessRam') }}</span>
          <span class="font-mono text-right">{{ stretch?.witnessRamGB }} GB</span>
        </div>

        <!-- Cross-site bandwidth recommendation (STRCH-05/STRCH-06/07) -->
        <div class="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded px-2 py-1">
          {{ t('deployment.stretchSites.bandwidthLabel') }}:
          <span class="font-mono font-semibold">{{ effectiveBandwidthGbps.toFixed(2) }} Gb/s</span>
          <span v-if="stretch?.bandwidthFloorApplied" class="block mt-1 text-amber-600 dark:text-amber-400 text-xs italic">
            {{ t('deployment.stretchSites.bandwidthFloorIndicator') }}
          </span>
          <span v-if="bandwidthCappedByLineRate" class="block mt-1 text-amber-600 dark:text-amber-400 text-xs italic">
            {{ t('deployment.stretchSites.bandwidthLineRateCap') }}
          </span>
        </div>

        <!-- Per-site storage note (STRCH-03) -->
        <div class="text-xs text-gray-500 dark:text-gray-400 italic">
          {{ t('deployment.stretchSites.storageNote') }}
        </div>
      </div>
    </template>

    <!-- Management Architecture toggle (ARCH-01/02) — visible in HA and Stretch modes -->
    <template v-if="deploymentMode !== 'simple'">
      <div class="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('deployment.architecture.label') }}
        </label>
        <div class="flex gap-2">
          <button
            v-for="arch in [
              { value: 'shared' as const, labelKey: 'deployment.architecture.shared' },
              { value: 'dedicated' as const, labelKey: 'deployment.architecture.dedicated' },
            ]"
            :key="arch.value"
            :class="[
              'px-3 py-1.5 text-sm rounded border font-medium transition-colors',
              managementArchitecture === arch.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            ]"
            @click="managementArchitecture = arch.value"
          >
            {{ t(arch.labelKey) }}
          </button>
        </div>
        <!-- Dedicated host count output (ARCH-01) -->
        <div v-if="dedicatedMgmtHostCount !== null" class="text-xs text-gray-500 dark:text-gray-400">
          Management hosts: <span class="font-mono font-semibold">{{ dedicatedMgmtHostCount }}</span>
        </div>
        <!-- Architecture validation errors (ARCH-01/02) -->
        <WarningBanner
          v-for="err in architectureErrors"
          :key="err.code"
          :message="err.code === 'COLLOCATED_MIN_HOSTS' ? t(err.messageKey, { min: storageType === 'vsan-esa' ? 3 : 2 }) : t(err.messageKey)"
          :severity="err.severity"
        />
      </div>
    </template>
  </section>
</template>
