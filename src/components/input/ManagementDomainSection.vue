<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import type { ManagementDomainConfig } from '@/engine/types'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()

function mgmtField<K extends keyof ManagementDomainConfig>(key: K) {
  return computed({
    get: () => input.managementDomain[key],
    set: (val: ManagementDomainConfig[K]) => input.updateManagementDomain({ [key]: val } as Partial<ManagementDomainConfig>),
  })
}

const coresPerSocket = mgmtField('coresPerSocket')
const socketsPerHost = mgmtField('socketsPerHost')
const hostRamGB = mgmtField('hostRamGB')
const hostStorageTB = mgmtField('hostStorageTB')

const managementArchitecture = computed({
  get: () => input.managementArchitecture,
  set: (val: 'shared' | 'dedicated') => { input.managementArchitecture = val },
})

const management = computed(() => calc.management)
const dedicatedMgmtHostCount = computed(() => calc.dedicatedMgmtHostCount)

const totalCoresPerHost = computed(() => coresPerSocket.value * socketsPerHost.value)
</script>

<template>
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('domain.managementSection') }}</h2>

    <!-- Management architecture toggle (ARCH-01/02) — global, not per-domain -->
    <div class="space-y-2">
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
    </div>

    <!-- Management host specs -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('domain.managementHostSpecs') }}</h3>
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
          <span class="text-gray-900 dark:text-gray-100 font-semibold">{{ totalCoresPerHost }}</span>
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
          v-model="hostStorageTB"
          :label="t('host.storageTB')"
          unit="TB"
          :min="0.96"
          :max="30.72"
          :step="0.96"
        />
      </div>
    </div>

    <!-- Management domain overhead summary -->
    <div class="text-xs text-gray-500 dark:text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
      <span>{{ t('management.totalCores') }}</span>
      <span class="font-mono text-right">{{ management.totalCores }}</span>
      <span>{{ t('management.totalRam') }}</span>
      <span class="font-mono text-right">{{ management.totalRamGB }} GB</span>
      <template v-if="dedicatedMgmtHostCount !== null">
        <span>{{ t('deployment.architecture.dedicatedHosts') }}</span>
        <span class="font-mono text-right font-semibold">{{ dedicatedMgmtHostCount }}</span>
      </template>
    </div>
  </section>
</template>
