<script setup lang="ts">
import { useUiStore } from '@/stores/uiStore'
const uiStore = useUiStore()
const locales = ['en', 'fr', 'de', 'it'] as const
</script>

<template>
  <nav class="flex gap-2 items-center">
    <button
      v-for="loc in locales"
      :key="loc"
      :class="[
        'px-2 py-1 text-sm font-mono uppercase rounded',
        uiStore.locale === loc
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      ]"
      @click="uiStore.setLocale(loc)"
    >
      {{ loc.toUpperCase() }}
    </button>
  </nav>
</template>
