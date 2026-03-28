<script setup lang="ts">
defineProps<{ message: string; severity?: 'error' | 'warning' }>()
</script>

<template>
  <div
    :class="[
      'p-3 rounded border text-sm font-semibold',
      severity === 'error'
        ? 'bg-red-50 border-red-400 text-red-800'
        : 'bg-yellow-50 border-yellow-400 text-yellow-800'
    ]"
    role="alert"
  >
    {{ message }}
  </div>
</template>
