<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInputStore } from '@/stores/inputStore'
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue'
import DomainTabStrip from '@/components/shared/DomainTabStrip.vue'
import DeploymentModelSelector from '@/components/input/DeploymentModelSelector.vue'
import HostSpecsForm from '@/components/input/HostSpecsForm.vue'
import WorkloadProfileForm from '@/components/input/WorkloadProfileForm.vue'
import StorageConfigForm from '@/components/input/StorageConfigForm.vue'
import ManagementDomainSection from '@/components/input/ManagementDomainSection.vue'
import ManagementSummary from '@/components/shared/ManagementSummary.vue'
import ResultsPanel from '@/components/results/ResultsPanel.vue'

const { t } = useI18n()
const input = useInputStore()

// Derive active domain ID from activeDomainIndex
// Fallback to first domain if index is somehow out of bounds
const activeDomainId = computed(
  () => input.workloadDomains[input.activeDomainIndex]?.id ?? input.workloadDomains[0].id
)
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans">
    <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
      <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ t('app.title') }}</h1>
      <LanguageSwitcher />
    </header>

    <main class="grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-56px)] print:grid-cols-1 print:min-h-0">
      <!-- LEFT PANE: inputs -->
      <div class="border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-6 space-y-4 overflow-y-auto print:hidden">
        <!-- Domain tab strip (UI-01, UI-02, UI-03, UI-04) -->
        <DomainTabStrip />

        <!-- Per-domain input forms — all receive activeDomainId -->
        <DeploymentModelSelector :domainId="activeDomainId" />
        <HostSpecsForm :domainId="activeDomainId" />
        <WorkloadProfileForm :domainId="activeDomainId" />
        <StorageConfigForm :domainId="activeDomainId" />

        <!-- Management domain section — independent of workload tabs (UI-05) -->
        <ManagementDomainSection />
        <ManagementSummary />
      </div>
      <!-- RIGHT PANE: results -->
      <div class="px-4 py-6 bg-gray-50 dark:bg-gray-950 overflow-y-auto print:col-span-2">
        <ResultsPanel />
      </div>
    </main>
  </div>
</template>
