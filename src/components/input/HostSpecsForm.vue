<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import { storeToRefs } from 'pinia'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
import WarningBanner from '@/components/shared/WarningBanner.vue'

const { t } = useI18n()
const input = useInputStore()
const calc = useCalculationStore()
const {
  coresPerSocket, socketsPerHost, hostRamGB, hostStorageTB, hostCount,
  nvmeTieringEnabled, activeMemoryPct,
} = storeToRefs(input)
const { validationErrors } = storeToRefs(calc)

const vcfaBlockerError = computed(() =>
  validationErrors.value.find(e => e.code === 'VCFA_MIN_CORES' && e.severity === 'error')
)
const totalCoresPerHost = computed(() => coresPerSocket.value * socketsPerHost.value)
const nvmeTieringActive = computed(() => nvmeTieringEnabled.value && activeMemoryPct.value <= 50)
</script>

<template>
  <section class="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900">{{ t('host.label') }}</h2>

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
      <div class="text-sm text-gray-600 sm:col-span-2">
        {{ t('host.totalCores') }}:
        <span
          :class="totalCoresPerHost < 12 ? 'text-red-600 font-bold' : 'text-gray-900 font-semibold'"
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
        v-model="hostStorageTB"
        :label="t('host.storageTB')"
        unit="TB"
        :min="0.96"
        :max="30.72"
        :step="0.96"
      />
      <NumberSliderInput
        v-model="hostCount"
        :label="t('host.hostCount')"
        :min="4"
        :max="64"
        :step="1"
      />
    </div>

    <!-- NVMe Memory Tiering (NVME-01/02/03/04) -->
    <div class="space-y-3 pt-2 border-t border-gray-100">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          v-model="nvmeTieringEnabled"
          class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span class="text-sm font-medium text-gray-700">{{ t('host.nvme.label') }}</span>
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
          class="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1"
        >
          {{ t('host.nvme.activeIndicator') }}
        </div>
        <!-- Prerequisite notice always shown when toggle is on (NVME-04) -->
        <div class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {{ t('host.nvme.prerequisite') }}
        </div>
      </template>
    </div>
  </section>
</template>
