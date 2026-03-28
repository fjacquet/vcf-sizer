<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue'
const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans">
    <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <h1 class="text-lg font-bold text-gray-900">{{ t('app.title') }}</h1>
      <LanguageSwitcher />
    </header>
    <main class="p-6">
      <!-- Input panels wired in Plan 03 -->
      <p class="text-gray-400 text-sm">Input panels coming in Phase 1, Plan 03.</p>
    </main>
  </div>
</template>
