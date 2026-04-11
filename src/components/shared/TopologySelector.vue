<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { useUiStore } from '@/stores/uiStore'
import ConfirmationDialog from '@/components/shared/ConfirmationDialog.vue'
import { createDefaultWorkloadDomain } from '@/engine/defaults'
import type { WorkloadDomainConfig } from '@/engine/types'

const { t } = useI18n()
const input = useInputStore()
const ui = useUiStore()

const currentMode = computed(() => input.managementDomain.deploymentMode)

const modes = [
  { value: 'simple' as const, labelKey: 'deployment.simple' },
  { value: 'ha' as const, labelKey: 'deployment.ha' },
  { value: 'stretch' as const, labelKey: 'deployment.stretch' },
]

const pendingTopology = ref<'simple' | 'ha' | 'stretch' | null>(null)
const showConfirmDialog = ref(false)

function hasConfiguredDomains(): boolean {
  const defaults = createDefaultWorkloadDomain(0)
  const skip = new Set<keyof WorkloadDomainConfig>(['id', 'name', 'deploymentMode'])
  return input.workloadDomains.some(domain =>
    (Object.keys(defaults) as Array<keyof WorkloadDomainConfig>)
      .filter(k => !skip.has(k))
      .some(k => domain[k] !== defaults[k])
  )
}

function requestTopologyChange(mode: 'simple' | 'ha' | 'stretch') {
  // No-op: same topology click (Pitfall 6)
  if (mode === currentMode.value) return
  // If any workload domain has non-default configured data, show confirmation
  if (hasConfiguredDomains()) {
    pendingTopology.value = mode
    showConfirmDialog.value = true
  } else {
    applyTopology(mode)
  }
}

function applyTopology(mode: 'simple' | 'ha' | 'stretch') {
  input.updateManagementDomain({ deploymentMode: mode })
  input.workloadDomains.forEach(d => input.updateDomain(d.id, { deploymentMode: mode }))
  ui.confirmTopology()
  ui.setWizardStep(1)  // ROADMAP success criterion 3: wizard reset to step 1
  pendingTopology.value = null
  showConfirmDialog.value = false
}

function onConfirm() {
  if (pendingTopology.value) applyTopology(pendingTopology.value)
}

function onCancel() {
  pendingTopology.value = null
  showConfirmDialog.value = false
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
        @click="requestTopologyChange(mode.value)"
      >
        {{ t(mode.labelKey) }}
      </button>
    </div>
    <ConfirmationDialog
      :visible="showConfirmDialog"
      :title="t('topology.confirmTitle')"
      :message="t('topology.confirmMessage')"
      :confirm-label="t('topology.confirmCta')"
      :cancel-label="t('topology.cancelCta')"
      @confirm="onConfirm"
      @cancel="onCancel"
    />
  </section>
</template>
