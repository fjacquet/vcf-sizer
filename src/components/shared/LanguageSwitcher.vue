<script setup lang="ts">
import { useUiStore } from '@/stores/uiStore'
const uiStore = useUiStore()
</script>

<template>
  <nav class="flex gap-2 items-center">
    <select
      :value="uiStore.locale"
      class="px-2 py-1 text-sm font-mono rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      @change="uiStore.setLocale(($event.target as HTMLSelectElement).value as 'en' | 'fr' | 'de' | 'it')"
    >
      <option value="en">EN</option>
      <option value="fr">FR</option>
      <option value="de">DE</option>
      <option value="it">IT</option>
    </select>

    <span class="mx-1 text-gray-300 dark:text-gray-600">|</span>

    <select
      v-model="uiStore.storageUnit"
      class="px-2 py-1 text-sm font-mono rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="TiB">TiB</option>
      <option value="TB">TB</option>
    </select>
  </nav>
</template>
