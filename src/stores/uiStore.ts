import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n, loadLocale } from '../i18n'

type AppLocale = 'en' | 'fr' | 'de' | 'it'

export const useUiStore = defineStore('ui', () => {
  // Detect browser locale on init — fall back to 'en' if not one of the four
  const browserLocale: AppLocale = navigator.language.startsWith('fr') ? 'fr'
    : navigator.language.startsWith('de') ? 'de'
    : navigator.language.startsWith('it') ? 'it'
    : 'en'
  const locale = ref<AppLocale>(browserLocale)

  async function setLocale(newLocale: AppLocale): Promise<void> {
    locale.value = newLocale
    if (newLocale === 'en') {
      i18n.global.locale.value = 'en'
    } else {
      await loadLocale(newLocale)
    }
  }

  // Apply detected locale on store init
  if (locale.value !== 'en') {
    loadLocale(locale.value as 'fr' | 'de' | 'it')
  }

  return { locale, setLocale }
})
