<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import { createDefaultWorkloadDomain } from '@/engine/defaults'
import type { WorkloadDomainConfig } from '@/engine/types'

const { t } = useI18n()
const input = useInputStore()

// Inline rename state (local to this component)
const renamingId = ref<string | null>(null)
const renameBuffer = ref('')
const renameRefs = ref<Map<string, HTMLInputElement>>(new Map())

function setRenameRef(id: string, el: HTMLInputElement | null) {
  if (el) renameRefs.value.set(id, el)
  else renameRefs.value.delete(id)
}

function startRename(domain: WorkloadDomainConfig) {
  renamingId.value = domain.id
  renameBuffer.value = domain.name
  nextTick(() => {
    renameRefs.value.get(domain.id)?.focus()
    renameRefs.value.get(domain.id)?.select()
  })
}

function commitRename(id: string) {
  if (renamingId.value !== id) return  // guard against double-fire from blur+enter
  const trimmed = renameBuffer.value.trim()
  if (trimmed) input.renameDomain(id, trimmed)
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

// Delete with confirmation for non-default data
function hasNonDefaultData(domain: WorkloadDomainConfig): boolean {
  const defaults = createDefaultWorkloadDomain(0)
  const skip = new Set<keyof WorkloadDomainConfig>(['id', 'name'])
  return (Object.keys(defaults) as Array<keyof WorkloadDomainConfig>)
    .filter(k => !skip.has(k))
    .some(k => domain[k] !== defaults[k])
}

function requestDelete(domain: WorkloadDomainConfig) {
  if (hasNonDefaultData(domain)) {
    const confirmed = window.confirm(t('domain.deleteConfirm', { name: domain.name }))
    if (!confirmed) return
  }
  input.removeDomain(domain.id)
}
</script>

<template>
  <div class="flex items-end gap-0 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
    <div
      v-for="(domain, index) in input.workloadDomains"
      :key="domain.id"
      :class="[
        'relative flex items-center gap-1 px-3 py-2 text-sm border-b-2 cursor-pointer select-none whitespace-nowrap',
        input.activeDomainIndex === index
          ? 'border-blue-600 text-blue-700 dark:text-blue-400 font-semibold bg-white dark:bg-gray-900'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300'
      ]"
      @click="input.activeDomainIndex = index"
    >
      <!-- Inline rename input -->
      <input
        v-if="renamingId === domain.id"
        :ref="(el) => setRenameRef(domain.id, el as HTMLInputElement)"
        :value="renameBuffer"
        class="w-24 text-sm border border-blue-400 rounded px-1 py-0.5 focus:outline-none bg-white dark:bg-gray-900 dark:text-gray-100"
        @input="renameBuffer = ($event.target as HTMLInputElement).value"
        @blur="commitRename(domain.id)"
        @keydown.enter.prevent="commitRename(domain.id)"
        @keydown.escape.prevent="cancelRename()"
      />
      <!-- Normal label -->
      <span
        v-else
        class="max-w-32 truncate"
        @dblclick.stop="startRename(domain)"
      >
        {{ domain.name }}
      </span>
      <!-- Copy domain button (DOMAIN-01) -- always visible -->
      <button
        class="ml-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded focus:outline-none"
        :aria-label="t('domain.copyDomain', { name: domain.name })"
        @click.stop="input.duplicateDomain(domain.id, `${domain.name} ${t('domain.copyNameSuffix')}`)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16"
             fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true" focusable="false">
          <rect x="5" y="5" width="9" height="9" rx="1" />
          <path d="M2 11V2h9" />
        </svg>
      </button>
      <!-- Delete button — hidden when only 1 domain remains (UI-03) -->
      <button
        v-if="input.workloadDomains.length > 1"
        class="ml-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded focus:outline-none"
        :aria-label="t('domain.deleteConfirm', { name: domain.name })"
        @click.stop="requestDelete(domain)"
      >
        &times;
      </button>
    </div>
    <!-- Add Domain button (UI-02) -->
    <button
      class="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 whitespace-nowrap border-b-2 border-transparent"
      @click="input.addDomain()"
    >
      + {{ t('domain.addDomain') }}
    </button>
  </div>
</template>
