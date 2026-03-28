import { createI18n } from 'vue-i18n'
import en from './locales/en.json'

// CRITICAL: legacy: false is REQUIRED for Vue 3 Composition API mode
// Source: vue-i18n v11 docs — Composition API Guide
export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
  // Explicit Swiss locale numberFormats — do NOT inherit from parent locale (fr, de, it)
  // Source: PITFALLS.md §Swiss Locale Number Formatting Inconsistency
  numberFormats: {
    'en': {
      decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
      integer: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 },
      percent: { style: 'percent', minimumFractionDigits: 1 },
    },
    'fr-CH': {
      decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
      integer: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 },
      percent: { style: 'percent', minimumFractionDigits: 1 },
    },
    'de-CH': {
      decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
      integer: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 },
      percent: { style: 'percent', minimumFractionDigits: 1 },
    },
    'it-CH': {
      decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
      integer: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 },
      percent: { style: 'percent', minimumFractionDigits: 1 },
    },
  },
})

// Lazy-load non-EN locale files on demand (called from uiStore.setLocale)
export async function loadLocale(locale: 'fr' | 'de' | 'it'): Promise<void> {
  const localeMap: Record<string, string> = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH' }
  const messages = await import(`./locales/${locale}.json`)
  // Register under the vue-i18n locale key (fr-CH, de-CH, it-CH)
  i18n.global.setLocaleMessage(localeMap[locale], messages.default)
  i18n.global.locale.value = localeMap[locale] as 'fr-CH' | 'de-CH' | 'it-CH'
}
