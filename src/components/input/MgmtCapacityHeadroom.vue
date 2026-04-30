<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import NumberSliderInput from '@/components/shared/NumberSliderInput.vue'
import MgmtCollapsibleSection from '@/components/shared/MgmtCollapsibleSection.vue'

const { t } = useI18n()
const input = useInputStore()

// Wrap each optional numeric field with a default so the slider always has a number.
const cpuOversub = computed<number>({
  get: () => input.managementDomain.cpuOversubscription ?? 2,
  set: (val: number) => input.updateManagementDomain({ cpuOversubscription: val }),
})
const ramOversub = computed<number>({
  get: () => input.managementDomain.ramOversubscription ?? 1,
  set: (val: number) => input.updateManagementDomain({ ramOversubscription: val }),
})
const reservePct = computed<number>({
  get: () => input.managementDomain.reservePct ?? 30,
  set: (val: number) => input.updateManagementDomain({ reservePct: val }),
})
const growthPct = computed<number>({
  get: () => input.managementDomain.growthPct ?? 10,
  set: (val: number) => input.updateManagementDomain({ growthPct: val }),
})
</script>

<template>
  <MgmtCollapsibleSection :title="t('mgmt.capacityHeadroom.title')">
    <div class="space-y-3">
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.capacityHeadroom.hint') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberSliderInput
          v-model="cpuOversub"
          :label="t('mgmt.capacityHeadroom.cpuOversub')"
          :min="1"
          :max="8"
          :step="1"
        />
        <NumberSliderInput
          v-model="ramOversub"
          :label="t('mgmt.capacityHeadroom.ramOversub')"
          :min="1"
          :max="4"
          :step="0.5"
        />
        <NumberSliderInput
          v-model="reservePct"
          :label="t('mgmt.capacityHeadroom.reservePct')"
          unit="%"
          :min="0"
          :max="100"
          :step="5"
        />
        <NumberSliderInput
          v-model="growthPct"
          :label="t('mgmt.capacityHeadroom.growthPct')"
          unit="%"
          :min="0"
          :max="100"
          :step="5"
        />
      </div>
    </div>
  </MgmtCollapsibleSection>
</template>
