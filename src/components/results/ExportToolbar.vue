<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateShareUrl } from '@/composables/useUrlState'
import { generateMarkdownReport } from '@/composables/useMarkdownExport'

const { t } = useI18n()
const copied = ref(false)

async function handleShare() {
  const url = generateShareUrl()
  window.history.replaceState({}, '', url)
  // navigator.clipboard with "Copied!" feedback (CONTEXT.md specifics + constraint #8)
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // Fallback: URL is already in the address bar
  }
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}

function handleExportMarkdown() {
  const md = generateMarkdownReport()
  const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'vcf-sizing-report.md'
  a.click()
  URL.revokeObjectURL(url)
}

function handlePrint() {
  window.print()
}
</script>

<template>
  <div class="flex flex-wrap gap-2 pt-2 print:hidden">
    <button
      class="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      @click="handleShare"
    >
      {{ copied ? t('results.toolbar.copied') : t('results.toolbar.share') }}
    </button>
    <button
      class="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      @click="handleExportMarkdown"
    >
      {{ t('results.toolbar.exportMd') }}
    </button>
    <button
      class="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      @click="handlePrint"
    >
      {{ t('results.toolbar.print') }}
    </button>
  </div>
</template>
