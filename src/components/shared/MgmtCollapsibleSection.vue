<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  /** Heading text (already-translated string from caller) */
  title: string
  /** Whether the section is expanded by default. Defaults to false. */
  defaultExpanded?: boolean
}>()

const expanded = ref(props.defaultExpanded ?? false)
</script>

<template>
  <section class="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
    <button
      type="button"
      class="w-full flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ title }}
      </span>
      <svg
        :class="['w-4 h-4 text-gray-400 transition-transform', expanded ? 'rotate-90' : '']"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path fill-rule="evenodd" d="M7.05 4.05a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L11.586 10 7.05 5.464a1 1 0 010-1.414z" clip-rule="evenodd"/>
      </svg>
    </button>
    <div v-show="expanded" class="p-4 bg-white dark:bg-gray-900">
      <slot />
    </div>
  </section>
</template>
