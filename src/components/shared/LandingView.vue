<script setup lang="ts">
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from 'vue-i18n'

const ui = useUiStore()
const { t } = useI18n()

const steps = [
  { num: 1, titleKey: 'landing.step1.title', descKey: 'landing.step1.desc' },
  { num: 2, titleKey: 'landing.step2.title', descKey: 'landing.step2.desc' },
  { num: 3, titleKey: 'landing.step3.title', descKey: 'landing.step3.desc' },
]
</script>

<template>
  <div class="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12 print:hidden">
    <h2 class="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 text-center max-w-2xl">
      {{ t('landing.title') }}
    </h2>
    <p class="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center max-w-lg">
      {{ t('landing.subtitle') }}
    </p>

    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
      <div
        v-for="step in steps"
        :key="step.num"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col items-center text-center"
      >
        <div
          class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold"
          aria-hidden="true"
        >
          {{ step.num }}
        </div>
        <h3 class="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ t(step.titleKey) }}
        </h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t(step.descKey) }}
        </p>
      </div>
    </div>

    <button
      class="mt-8 bg-blue-600 text-white hover:bg-blue-700 px-6 py-3 text-base font-semibold rounded-md transition-colors"
      @click="ui.dismissLanding()"
    >
      {{ t('landing.cta') }}
    </button>
  </div>
</template>
