<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/uiStore'
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'

const { t } = useI18n()
const ui = useUiStore()
const input = useInputStore()
const calc = useCalculationStore()

const steps = [
  { step: 1 as const, labelKey: 'wizard.step1.label' },
  { step: 2 as const, labelKey: 'wizard.step2.label' },
  { step: 3 as const, labelKey: 'wizard.step3.label' },
]

// Step-specific forward gate (WIZARD-03, WIZARD-04)
const canAdvance = computed(() => {
  if (ui.currentWizardStep === 1) return ui.topologyConfirmed
  if (ui.currentWizardStep === 2) {
    if (input.managementArchitecture === 'dedicated') {
      return calc.dedicatedMgmtHostCount !== null
    }
    return true
  }
  return false
})

function isClickable(step: 1 | 2 | 3): boolean {
  // Already on this step — not clickable
  if (step === ui.currentWizardStep) return false
  // Go back to completed step
  if (step < ui.currentWizardStep) return true
  // Go forward to next step (only +1, not +2) when validation passes
  if (step === ui.currentWizardStep + 1 && canAdvance.value) return true
  return false
}

function onStepClick(step: 1 | 2 | 3) {
  if (isClickable(step)) ui.setWizardStep(step)
}
</script>

<template>
  <div class="flex items-center justify-center gap-2 mb-4">
    <template v-for="(s, index) in steps" :key="s.step">
      <div
        :class="['flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border font-medium transition-colors',
          ui.currentWizardStep === s.step
            ? 'bg-blue-600 text-white border-blue-600'
            : ui.currentWizardStep > s.step
              ? 'bg-green-100 text-green-700 border-green-400 dark:bg-green-900 dark:text-green-300 dark:border-green-700 cursor-pointer hover:ring-2 hover:ring-green-400'
              : isClickable(s.step)
                ? 'bg-blue-50 text-blue-600 border-blue-400 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-600 cursor-pointer hover:ring-2 hover:ring-blue-400'
                : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700']"
        :role="isClickable(s.step) ? 'button' : undefined"
        :tabindex="isClickable(s.step) ? 0 : undefined"
        @click="onStepClick(s.step)"
        @keydown.enter.space.prevent="onStepClick(s.step)"
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
</template>
