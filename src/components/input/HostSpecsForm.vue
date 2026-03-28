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
const { coresPerSocket, socketsPerHost, hostRamGB, hostStorageTB, hostCount } = storeToRefs(input)
const { validationErrors } = storeToRefs(calc)

const vcfaBlockerError = computed(() =>
  validationErrors.value.find(e => e.code === 'VCFA_MIN_CORES' && e.severity === 'error')
)
const totalCoresPerHost = computed(() => coresPerSocket.value * socketsPerHost.value)
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
  </section>
</template>
