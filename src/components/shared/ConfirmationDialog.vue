<script setup lang="ts">
defineProps<{
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      role="dialog"
      aria-modal="true"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="$emit('cancel')"
      @keydown.escape="$emit('cancel')"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 border border-gray-200 dark:border-gray-700">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ message }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button
            @click="$emit('cancel')"
            class="px-4 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 font-medium transition-colors"
          >
            {{ cancelLabel }}
          </button>
          <button
            @click="$emit('confirm')"
            class="px-4 py-2 text-sm rounded bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 font-medium transition-colors"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
