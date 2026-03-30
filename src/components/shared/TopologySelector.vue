<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'

const { t } = useI18n()
const input = useInputStore()

const currentMode = computed(() => input.managementDomain.deploymentMode)

const modes = [
  { value: 'simple' as const, labelKey: 'deployment.simple' },
  { value: 'ha' as const, labelKey: 'deployment.ha' },
  { value: 'stretch' as const, labelKey: 'deployment.stretch' },
]

function setGlobalTopology(mode: 'simple' | 'ha' | 'stretch') {
  // Write deploymentMode to managementDomain AND all workloadDomains atomically
  // Mixed topologies are not supported (STATE.md decision)
  input.updateManagementDomain({ deploymentMode: mode })
  input.workloadDomains.forEach(d => input.updateDomain(d.id, { deploymentMode: mode }))
}
</script>

<template>
  <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
    <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('deployment.label') }}</h2>
    <div class="flex gap-2 flex-wrap">
      <button
        v-for="mode in modes"
        :key="mode.value"
        :class="['px-4 py-2 text-sm rounded-md border font-medium transition-colors',
          currentMode === mode.value
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400']"
        @click="setGlobalTopology(mode.value)"
      >
        {{ t(mode.labelKey) }}
      </button>
    </div>
  </section>
</template>
