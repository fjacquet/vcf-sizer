<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import MgmtCollapsibleSection from '@/components/shared/MgmtCollapsibleSection.vue'
import type { ValidatedSolutionsConfig, SrmSize } from '@/engine/mgmt/types'

const { t } = useI18n()
const input = useInputStore()

const DEFAULT_SOLUTIONS: ValidatedSolutionsConfig = {
  siteProtection: { included: false },
  ransomwareOnPrem: { included: false },
  ransomwareCloud: { included: false },
  crossCloudMobility: { included: false },
}

const solutions = computed<ValidatedSolutionsConfig>({
  get: () => input.managementDomain.validatedSolutions ?? DEFAULT_SOLUTIONS,
  set: (val) => input.updateManagementDomain({ validatedSolutions: val }),
})

function setIncluded(key: keyof ValidatedSolutionsConfig, value: boolean) {
  const next = { ...solutions.value }
  next[key] = { ...next[key], included: value }
  solutions.value = next
}

function setSrmSize(value: SrmSize) {
  solutions.value = {
    ...solutions.value,
    siteProtection: { ...solutions.value.siteProtection, mgmtSize: value },
  }
}

const srmSize = computed<SrmSize>(() => solutions.value.siteProtection.mgmtSize ?? 'standard')
</script>

<template>
  <MgmtCollapsibleSection :title="t('mgmt.validatedSolutions.title')">
    <div class="space-y-3">
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.validatedSolutions.hint') }}</p>

      <!-- Site Protection / SRM (with light/standard sub-size) -->
      <div class="p-3 border border-gray-100 dark:border-gray-800 rounded space-y-2">
        <label class="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            :checked="solutions.siteProtection.included"
            class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            @change="setIncluded('siteProtection', ($event.target as HTMLInputElement).checked)"
          />
          <span class="space-y-0.5">
            <span :class="['block font-medium', solutions.siteProtection.included ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600']">
              {{ t('mgmt.validatedSolutions.siteProtection.label') }}
            </span>
            <span class="block text-xs text-gray-500 dark:text-gray-400">
              {{ t('mgmt.validatedSolutions.siteProtection.description') }}
            </span>
          </span>
        </label>

        <div v-if="solutions.siteProtection.included" class="ml-6 flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('mgmt.validatedSolutions.siteProtection.size') }}:</span>
          <button
            v-for="opt in [
              { value: 'light' as const,    labelKey: 'mgmt.validatedSolutions.siteProtection.light' },
              { value: 'standard' as const, labelKey: 'mgmt.validatedSolutions.siteProtection.standard' },
            ]"
            :key="opt.value"
            :class="[
              'px-2 py-0.5 text-xs rounded border font-medium transition-colors',
              srmSize === opt.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            ]"
            @click="setSrmSize(opt.value)"
          >
            {{ t(opt.labelKey) }}
          </button>
        </div>
      </div>

      <!-- Ransomware Recovery on-prem -->
      <label class="flex items-start gap-2 text-sm p-3 border border-gray-100 dark:border-gray-800 rounded cursor-pointer">
        <input
          type="checkbox"
          :checked="solutions.ransomwareOnPrem.included"
          class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          @change="setIncluded('ransomwareOnPrem', ($event.target as HTMLInputElement).checked)"
        />
        <span class="space-y-0.5">
          <span :class="['block font-medium', solutions.ransomwareOnPrem.included ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600']">
            {{ t('mgmt.validatedSolutions.ransomwareOnPrem.label') }}
          </span>
          <span class="block text-xs text-gray-500 dark:text-gray-400">
            {{ t('mgmt.validatedSolutions.ransomwareOnPrem.description') }}
          </span>
        </span>
      </label>

      <!-- Ransomware Recovery cloud -->
      <label class="flex items-start gap-2 text-sm p-3 border border-gray-100 dark:border-gray-800 rounded cursor-pointer">
        <input
          type="checkbox"
          :checked="solutions.ransomwareCloud.included"
          class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          @change="setIncluded('ransomwareCloud', ($event.target as HTMLInputElement).checked)"
        />
        <span class="space-y-0.5">
          <span :class="['block font-medium', solutions.ransomwareCloud.included ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600']">
            {{ t('mgmt.validatedSolutions.ransomwareCloud.label') }}
          </span>
          <span class="block text-xs text-gray-500 dark:text-gray-400">
            {{ t('mgmt.validatedSolutions.ransomwareCloud.description') }}
          </span>
        </span>
      </label>

      <!-- Cross-Cloud Mobility / HCX -->
      <label class="flex items-start gap-2 text-sm p-3 border border-gray-100 dark:border-gray-800 rounded cursor-pointer">
        <input
          type="checkbox"
          :checked="solutions.crossCloudMobility.included"
          class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          @change="setIncluded('crossCloudMobility', ($event.target as HTMLInputElement).checked)"
        />
        <span class="space-y-0.5">
          <span :class="['block font-medium', solutions.crossCloudMobility.included ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600']">
            {{ t('mgmt.validatedSolutions.crossCloudMobility.label') }}
          </span>
          <span class="block text-xs text-gray-500 dark:text-gray-400">
            {{ t('mgmt.validatedSolutions.crossCloudMobility.description') }}
          </span>
        </span>
      </label>
    </div>
  </MgmtCollapsibleSection>
</template>
