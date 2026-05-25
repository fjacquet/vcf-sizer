<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/uiStore'
import type { Theme } from '@/stores/uiStore'

const { t } = useI18n()
const uiStore = useUiStore()

// Cycle order: light → dark → system → light …
const NEXT: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

// Glyph per mode: sun / moon / desktop
const GLYPH: Record<Theme, string> = {
  light: '☀️', // ☀️
  dark: '\u{1F319}', // 🌙
  system: '\u{1F5A5}️', // 🖥️
}

const label = computed(() => t(`ui.theme.${uiStore.theme}`))
const glyph = computed(() => GLYPH[uiStore.theme])

function cycle(): void {
  uiStore.setTheme(NEXT[uiStore.theme])
}
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-1.5 px-2 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
    :aria-label="t('ui.theme.toggle', { mode: label })"
    :title="t('ui.theme.toggle', { mode: label })"
    @click="cycle"
  >
    <span aria-hidden="true">{{ glyph }}</span>
    <span class="hidden sm:inline">{{ label }}</span>
  </button>
</template>
