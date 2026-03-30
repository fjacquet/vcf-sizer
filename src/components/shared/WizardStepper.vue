<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/uiStore'

const { t } = useI18n()
const ui = useUiStore()

const steps = [
  { step: 1 as const, labelKey: 'wizard.step1.label' },
  { step: 2 as const, labelKey: 'wizard.step2.label' },
  { step: 3 as const, labelKey: 'wizard.step3.label' },
]

const canGoBack = computed(() => ui.currentWizardStep > 1)
const canGoForward = computed(() => ui.currentWizardStep < 3)

function goBack() {
  if (canGoBack.value) ui.setWizardStep((ui.currentWizardStep - 1) as 1 | 2 | 3)
}

function goForward() {
  if (canGoForward.value) ui.setWizardStep((ui.currentWizardStep + 1) as 1 | 2 | 3)
}
</script>

<template>
  <div class="flex items-center justify-between gap-4 mb-4">
    <!-- Previous button -->
    <button
      @click="goBack"
      :disabled="!canGoBack"
      :class="['px-3 py-1.5 text-sm rounded border font-medium transition-colors',
        canGoBack
          ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
          : 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200']"
    >
      {{ t('wizard.nav.previous') }}
    </button>

    <!-- Step indicator row -->
    <div class="flex items-center gap-2">
      <template v-for="(s, index) in steps" :key="s.step">
        <div
          :class="['flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border font-medium',
            ui.currentWizardStep === s.step
              ? 'bg-blue-600 text-white border-blue-600'
              : ui.currentWizardStep > s.step
                ? 'bg-green-100 text-green-700 border-green-400 dark:bg-green-900 dark:text-green-300 dark:border-green-700'
                : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700']"
        >
          <span class="font-bold">{{ s.step }}</span>
          <span>{{ t(s.labelKey) }}</span>
        </div>
        <!-- Connector line between steps (not after last) -->
        <div
          v-if="index < steps.length - 1"
          class="w-6 h-px bg-gray-300 dark:bg-gray-600"
        ></div>
      </template>
    </div>

    <!-- Next button -->
    <button
      @click="goForward"
      :disabled="!canGoForward"
      :class="['px-3 py-1.5 text-sm rounded border font-medium transition-colors',
        canGoForward
          ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
          : 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200']"
    >
      {{ t('wizard.nav.next') }}
    </button>
  </div>
</template>
