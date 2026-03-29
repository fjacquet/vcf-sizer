<script setup lang="ts">
defineProps<{ message: string; severity?: 'error' | 'warning' }>()
</script>

<template>
  <div
    :class="[
      'p-3 rounded border text-sm font-semibold',
      severity === 'error'
        ? 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-700 text-red-800 dark:text-red-300'
        : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-300'
    ]"
    role="alert"
  >
    {{ message }}
  </div>
</template>
