<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { storeToRefs } from 'pinia'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'

const { t } = useI18n()
const input = useInputStore()
const {
  vmCount,
  avgVcpuPerVm,
  avgVramGbPerVm,
  avgStorageGbPerVm,
  cpuOvercommitRatio,
  ramOvercommitRatio,
} = storeToRefs(input)
</script>

<template>
  <section class="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900">{{ t('workload.label') }}</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <NumberSliderInput
        v-model="vmCount"
        :label="t('workload.vmCount')"
        :min="1"
        :max="2000"
        :step="1"
      />
      <NumberSliderInput
        v-model="avgVcpuPerVm"
        :label="t('workload.avgVcpu')"
        unit="vCPU"
        :min="1"
        :max="64"
        :step="1"
      />
      <NumberSliderInput
        v-model="avgVramGbPerVm"
        :label="t('workload.avgVram')"
        unit="GB"
        :min="1"
        :max="512"
        :step="1"
      />
      <NumberSliderInput
        v-model="avgStorageGbPerVm"
        :label="t('workload.avgStorage')"
        unit="GB"
        :min="10"
        :max="10240"
        :step="10"
      />
      <div class="space-y-1">
        <label class="text-sm font-medium text-gray-700">{{ t('workload.cpuOvercommit') }}</label>
        <select
          v-model="cpuOvercommitRatio"
          class="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option :value="1">1:1</option>
          <option :value="2">2:1</option>
          <option :value="4">4:1</option>
          <option :value="8">8:1</option>
        </select>
      </div>
      <div class="space-y-1">
        <label class="text-sm font-medium text-gray-700">{{ t('workload.ramOvercommit') }}</label>
        <select
          v-model="ramOvercommitRatio"
          class="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option :value="1">1:1</option>
          <option :value="1.5">1.5:1</option>
          <option :value="2">2:1</option>
        </select>
      </div>
    </div>
  </section>
</template>
