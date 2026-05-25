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
const networkSpeedGbE = domainField('networkSpeedGbE')
const hostFailuresToTolerate = domainField('hostFailuresToTolerate')
const storageType = domainField('storageType')

// Per-domain calc results
const domainResult = computed(() =>
  calc.domainResults.find(r => r.id === props.domainId)
)
const stretch = computed(() => domainResult.value?.stretch ?? null)
const validationErrors = computed(() => domainResult.value?.validationErrors ?? [])

// Cross-form validation: vSAN Max + Stretch is invalid (rehydrated URLs can bypass UI guard)
const vsanMaxStretchError = computed(() =>
  validationErrors.value.find(e => e.code === 'VSAN_MAX_STRETCH_EXCLUSION') ?? null
)

// vSAN Max disables Stretch mode — keep the radio visible but inactive, with reason tooltip
const stretchDisabledByVsanMax = computed(() => storageType.value === 'vsan-max')

// Read-only demand-driven host/cluster counts (OUTPUTS of the sizing engine)
const isStretch = computed(() => deploymentMode.value === 'stretch')
const demandHostsPerSite = computed(() => domainResult.value?.demandHostsPerSite ?? 0)
const hostsPerSite = computed(() => domainResult.value?.hostsPerSite ?? 0)
const clusterCountPerSite = computed(() => domainResult.value?.clusterCountPerSite ?? 0)
const totalHosts = computed(() => domainResult.value?.totalHosts ?? 0)

const modes = [
  { value: 'simple' as const, labelKey: 'deployment.simple' },
  { value: 'ha' as const, labelKey: 'deployment.ha' },
  { value: 'stretch' as const, labelKey: 'deployment.stretch' },
]

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
        :disabled="mode.value === 'stretch' && stretchDisabledByVsanMax"
        :title="mode.value === 'stretch' && stretchDisabledByVsanMax ? t('warnings.stretchDisabledReason') : ''"
        :aria-label="mode.value === 'stretch' && stretchDisabledByVsanMax
          ? `${t(mode.labelKey)} — ${t('warnings.stretchDisabledReason')}`
          : t(mode.labelKey)"
        :class="[
          'px-4 py-2 text-sm rounded-md border font-medium transition-colors',
          deploymentMode === mode.value
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400',
          mode.value === 'stretch' && stretchDisabledByVsanMax
            ? 'opacity-50 cursor-not-allowed hover:border-gray-300 dark:hover:border-gray-600'
            : ''
        ]"
        @click="deploymentMode = mode.value"
      >
        {{ t(mode.labelKey) }}
      </button>
    </div>

    <!-- Cross-form validation: vSAN Max + Stretch (defensive — URL rehydration may bypass button guard) -->
    <WarningBanner
      v-if="vsanMaxStretchError"
      :message="t('warnings.vsanMaxStretchExclusion')"
      severity="error"
    />

    <!-- Failover (HA) reserve — the only host-side knob in the demand-driven model.
         Host/cluster counts are OUTPUTS shown read-only below. -->
    <div class="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
      <NumberSliderInput
        v-model="hostFailuresToTolerate"
        :label="t('deployment.hostFailuresToTolerate')"
        :min="0"
        :max="8"
        :step="1"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400 italic">{{ t('deployment.hostFailuresToTolerateHint') }}</p>
    </div>

    <!-- Read-only demand-driven sizing outputs -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded p-2">
      <span>{{ t('deployment.demandHostsPerSite') }}</span>
      <span class="font-mono text-right">{{ demandHostsPerSite }}</span>
      <span>{{ t('deployment.hostsPerSite') }}</span>
      <span class="font-mono text-right">{{ hostsPerSite }}</span>
      <span>{{ t('deployment.clusterCountPerSite') }}</span>
      <span class="font-mono text-right">{{ clusterCountPerSite }}</span>
      <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('deployment.totalHostsProvisioned') }}</span>
      <span class="font-mono text-right font-semibold">
        <template v-if="isStretch">{{ hostsPerSite }} × 2 = {{ totalHosts }}</template>
        <template v-else>{{ totalHosts }}</template>
      </span>
    </div>

    <!-- Stretch cluster overhead + bandwidth (STRCH-02/05) -->
    <template v-if="deploymentMode === 'stretch'">
      <div class="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
        <!-- Witness node overhead (STRCH-02) — ESA M profile: 4 vCPU / 16 GB.
             vSAN ESA stretched clusters only; FC/NFS (vMSC) use array-based quorum. -->
        <div v-if="stretch?.requiresVsanWitness" class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded p-2">
          <span class="col-span-2 font-medium text-gray-700 dark:text-gray-300">{{ t('deployment.stretchSites.witnessLabel') }}</span>
          <span>{{ t('deployment.stretchSites.witnessCpu') }}</span>
          <span class="font-mono text-right">{{ stretch?.witnessCores }}</span>
          <span>{{ t('deployment.stretchSites.witnessRam') }}</span>
          <span class="font-mono text-right">{{ stretch?.witnessRamGB }} GB</span>
        </div>
        <div v-else class="text-xs text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700 rounded p-2">
          {{ t('deployment.stretchSites.vmscNote') }}
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

  </section>
</template>
