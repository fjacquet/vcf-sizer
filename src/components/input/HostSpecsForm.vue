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

const domainResult = computed(() =>
  calc.domainResults.find(r => r.id === props.domainId)
)

const coresPerSocket = domainField('coresPerSocket')
const socketsPerHost = domainField('socketsPerHost')
const hostRamGB = domainField('hostRamGB')
const hostStorageTiB = domainField('hostStorageTiB')
const hostCount = domainField('hostCount')
const nvmeTieringEnabled = domainField('nvmeTieringEnabled')
const activeMemoryPct = domainField('activeMemoryPct')
const networkSpeedGbE = domainField('networkSpeedGbE')
const storageType = domainField('storageType')

const vcfaBlockerError = computed(() =>
  domainResult.value?.validationErrors.find(e => e.code === 'VCFA_MIN_CORES' && e.severity === 'error') ?? null
)
const totalCoresPerHost = computed(() => coresPerSocket.value * socketsPerHost.value)
const nvmeTieringActive = computed(() => nvmeTieringEnabled.value && activeMemoryPct.value <= 50)
</script>

<template>
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('host.label') }}</h2>

    <!-- VCFA blocker — must be unmissable (MGMT-07) -->
    <WarningBanner
      v-if="vcfaBlockerError"
      :message="t('warnings.vcfaMinCores')"
      severity="error"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <NumberSliderInput
        v-model="coresPerSocket"
        :label="t('host.coresPerSocket')"
        :min="4"
        :max="64"
        :step="2"
      />
      <NumberSliderInput
        v-model="socketsPerHost"
        :label="t('host.socketsPerHost')"
        :min="1"
        :max="8"
        :step="1"
      />
      <div class="text-sm text-gray-600 dark:text-gray-400 sm:col-span-2">
        {{ t('host.totalCores') }}:
        <span
          :class="totalCoresPerHost < 12 ? 'text-red-600 font-bold' : 'text-gray-900 dark:text-gray-100 font-semibold'"
        >
          {{ totalCoresPerHost }}
        </span>
      </div>
      <NumberSliderInput
        v-model="hostRamGB"
        :label="t('host.ramGB')"
        unit="GB"
        :min="64"
        :max="6144"
        :step="64"
      />
      <NumberSliderInput
        v-if="storageType !== 'fc' && storageType !== 'nfs'"
        v-model="hostStorageTiB"
        :label="t('host.storageTB')"
        unit="TiB"
        :min="0.96"
        :max="30.72"
        :step="0.96"
      />
      <!-- Network speed selector (STOR-05, STRCH-05) -->
      <div class="space-y-1 sm:col-span-2">
        <label class="text-sm font-normal text-gray-700 dark:text-gray-300">
          {{ t('host.networkSpeed') }}
        </label>
        <div class="flex gap-2">
          <button
            v-for="speed in [10, 25, 100]"
            :key="speed"
            :class="[
              'px-3 py-1.5 text-sm rounded border font-normal transition-colors',
              networkSpeedGbE === speed
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            ]"
            @click="networkSpeedGbE = speed as 10 | 25 | 100"
          >
            {{ speed }} GbE
          </button>
        </div>
      </div>
      <NumberSliderInput
        v-model="hostCount"
        :label="t('host.hostCount')"
        :min="4"
        :max="64"
        :step="1"
      />
      <div
        v-if="storageType === 'vsan-max'"
        class="text-xs text-blue-700 dark:text-blue-400 italic sm:col-span-2"
      >
        {{ t('host.vsanMaxComputeNote') }}
      </div>
    </div>

    <!-- NVMe Memory Tiering (NVME-01/02/03/04) -->
    <div class="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          v-model="nvmeTieringEnabled"
          class="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
        />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('host.nvme.label') }}</span>
      </label>
      <template v-if="nvmeTieringEnabled">
        <NumberSliderInput
          v-model="activeMemoryPct"
          :label="t('host.nvme.activeMemoryPct')"
          unit="%"
          :min="0"
          :max="100"
          :step="5"
        />
        <!-- Green indicator when tiering is active (activeMemoryPct <= 50) (NVME-03) -->
        <div
          v-if="nvmeTieringActive"
          class="text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded px-2 py-1"
        >
          {{ t('host.nvme.activeIndicator') }}
        </div>
        <!-- Prerequisite notice always shown when toggle is on (NVME-04) -->
        <div class="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded px-2 py-1">
          {{ t('host.nvme.prerequisite') }}
        </div>
      </template>
    </div>
  </section>
</template>
