<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue'
import DeploymentModelSelector from '@/components/input/DeploymentModelSelector.vue'
import HostSpecsForm from '@/components/input/HostSpecsForm.vue'
import WorkloadProfileForm from '@/components/input/WorkloadProfileForm.vue'
import StorageConfigForm from '@/components/input/StorageConfigForm.vue'
import ManagementSummary from '@/components/shared/ManagementSummary.vue'

const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans">
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
      <h1 class="text-lg font-bold text-gray-900">{{ t('app.title') }}</h1>
      <LanguageSwitcher />
    </header>

    <main class="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <DeploymentModelSelector />
      <ManagementSummary />
      <HostSpecsForm />
      <WorkloadProfileForm />
      <StorageConfigForm />
    </main>
  </div>
</template>
