<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateMarkdownReport } from '@/composables/useMarkdownExport'

// Lazy-loaded module caches — keeps marked + dompurify out of initial bundle (PPTX-15 pattern)
let cachedMarked: typeof import('marked') | null = null
let cachedPurify: typeof import('dompurify') | null = null

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const htmlContent = ref('')
const loading = ref(false)

async function loadPreview() {
  loading.value = true
  try {
    const md = generateMarkdownReport()
    cachedMarked = cachedMarked ?? (await import('marked'))
    cachedPurify = cachedPurify ?? (await import('dompurify'))
    const rawHtml = await cachedMarked.marked.parse(md)
    // CRITICAL: DOMPurify.sanitize() before v-html to prevent XSS (PITFALL-9, T-23-01)
    htmlContent.value = cachedPurify.default.sanitize(rawHtml)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) loadPreview()
  },
)
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 print:hidden"
    @click="emit('close')"
  >
    <div
      class="relative mt-8 mb-8 mx-4 max-w-4xl w-full max-h-[calc(100vh-4rem)] overflow-y-auto rounded-lg bg-white dark:bg-gray-900 shadow-xl"
      @click.stop
    >
      <!-- Sticky header -->
      <div
        class="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ t('results.toolbar.preview') }}
        </h2>
        <button
          class="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          @click="emit('close')"
        >
          {{ t('results.toolbar.previewClose') }}
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-4">
        <p v-if="loading" class="text-gray-500 dark:text-gray-400">...</p>
        <div v-else class="prose dark:prose-invert max-w-none" v-html="htmlContent" />
      </div>
    </div>
  </div>
</template>
