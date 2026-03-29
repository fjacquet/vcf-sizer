<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue'
import DeploymentModelSelector from '@/components/input/DeploymentModelSelector.vue'
import HostSpecsForm from '@/components/input/HostSpecsForm.vue'
import WorkloadProfileForm from '@/components/input/WorkloadProfileForm.vue'
import StorageConfigForm from '@/components/input/StorageConfigForm.vue'
import ManagementSummary from '@/components/shared/ManagementSummary.vue'
import ResultsPanel from '@/components/results/ResultsPanel.vue'

const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans">
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
      <h1 class="text-lg font-bold text-gray-900">{{ t('app.title') }}</h1>
      <LanguageSwitcher />
    </header>

    <main class="grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-56px)]">
      <!-- LEFT PANE: inputs -->
      <div class="border-r border-gray-200 px-4 py-6 space-y-4 overflow-y-auto print:hidden">
        <DeploymentModelSelector />
        <ManagementSummary />
        <HostSpecsForm />
        <WorkloadProfileForm />
        <StorageConfigForm />
      </div>
      <!-- RIGHT PANE: results -->
      <div class="px-4 py-6 bg-gray-50 overflow-y-auto print:col-span-2">
        <ResultsPanel />
      </div>
    </main>
  </div>
</template>
