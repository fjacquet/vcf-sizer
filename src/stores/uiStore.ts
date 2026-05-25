import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n, loadLocale } from '../i18n'
import type { StorageUnit } from '@/utils/formatStorage'

type AppLocale = 'en' | 'fr' | 'de' | 'it'

export type ChartType = 'cores' | 'ram' | 'storage'

export type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'vcf-sizer-theme'

function readStoredTheme(): Theme {
  // Browser-only: guard on `window` so the node test env never touches the
  // localStorage global (avoids Node's experimental-localStorage warning noise).
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // localStorage unavailable (private mode / SSR-like env) — fall through to default
  }
  return 'system'
}

/** Resolve a Theme to a concrete light/dark value, consulting the OS for 'system'. */
function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return typeof window !== 'undefined'
      && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}

export const useUiStore = defineStore('ui', () => {
  // Detect browser locale on init — fall back to 'en' if not one of the four
  const browserLocale: AppLocale = navigator.language.startsWith('fr') ? 'fr'
    : navigator.language.startsWith('de') ? 'de'
    : navigator.language.startsWith('it') ? 'it'
    : 'en'
  const locale = ref<AppLocale>(browserLocale)
  const localeLoading = ref(false)

  async function setLocale(newLocale: AppLocale): Promise<void> {
    locale.value = newLocale
    if (newLocale === 'en') {
      i18n.global.locale.value = 'en'
    } else {
      localeLoading.value = true
      try {
        await loadLocale(newLocale)
      } finally {
        localeLoading.value = false
      }
    }
  }

  // Apply detected locale on store init
  if (locale.value !== 'en') {
    loadLocale(locale.value as 'fr' | 'de' | 'it')
  }

  // ── Theme (light / dark / system) — persisted to localStorage ──────────────
  // Default 'system' follows prefers-color-scheme. setTheme() persists + re-applies.
  // applyTheme() toggles the `.dark` class on <html> so Tailwind's class-based
  // dark variant (style.css @custom-variant dark) and charts respond to the toggle.
  const theme = ref<Theme>(readStoredTheme())

  function applyTheme(): void {
    if (typeof document === 'undefined') return
    const resolved = resolveTheme(theme.value)
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }

  function setTheme(newTheme: Theme): void {
    theme.value = newTheme
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, newTheme)
      } catch {
        // Persisting is best-effort; the in-memory value still drives the UI.
      }
    }
    applyTheme()
  }

  // Re-apply when the OS preference changes while in 'system' mode.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme.value === 'system') applyTheme()
    }
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
    } else if (typeof mql.addListener === 'function') {
      // Safari < 14 fallback
      mql.addListener(onChange)
    }
  }

  // Wizard step state — WIZARD-02
  // currentWizardStep must NEVER appear in InputStateSchema (WIZARD-07 structural guarantee)
  const currentWizardStep = ref<1 | 2 | 3>(1)

  function setWizardStep(step: 1 | 2 | 3): void {
    currentWizardStep.value = step
  }

  // Topology confirmation flag — WIZARD-03
  // Ephemeral flag: NEVER in InputStateSchema (WIZARD-07 structural guarantee)
  // Set when user clicks a topology button in TopologySelector, or when URL state is hydrated
  const topologyConfirmed = ref<boolean>(false)

  function confirmTopology(): void {
    topologyConfirmed.value = true
  }

  // Landing view visibility — WIZARD-02
  // Ephemeral flag: NEVER in InputStateSchema (WIZARD-07 structural guarantee)
  const isLandingVisible = ref<boolean>(true)

  function dismissLanding(): void {
    isLandingVisible.value = false
  }

  // Storage display unit preference — TiB (binary) or TB (decimal)
  // Ephemeral: NEVER in InputStateSchema (WIZARD-07 structural guarantee)
  const storageUnit = ref<StorageUnit>('TiB')

  function setStorageUnit(unit: StorageUnit): void {
    storageUnit.value = unit
  }

  // Chart image registry — consumed by Phase 21 (per-domain charts) and Phase 22 (PPTX export)
  // Ephemeral: NEVER in InputStateSchema (WIZARD-07 structural guarantee)
  const chartImages = ref<Record<string, Record<ChartType, string>>>({})

  function registerChartImage(domainId: string, chartType: ChartType, dataUrl: string): void {
    if (!chartImages.value[domainId]) {
      chartImages.value[domainId] = {} as Record<ChartType, string>
    }
    chartImages.value[domainId][chartType] = dataUrl
  }

  // Transient auto-correction banner — surfaced by inputStore.updateDomain() when an
  // incompatible field combination is auto-fixed (e.g., dedup disabled on switch to
  // stretch). Holds a deduplicated list of i18n message keys so that multi-field
  // patches (e.g., URL rehydration) do not overwrite earlier warnings. The full
  // list auto-dismisses after 5 seconds; each flash resets the timer.
  const autoCorrectionMessageKeys = ref<string[]>([])
  let autoCorrectionTimer: ReturnType<typeof setTimeout> | null = null

  function flashAutoCorrection(messageKey: string): void {
    if (!autoCorrectionMessageKeys.value.includes(messageKey)) {
      autoCorrectionMessageKeys.value.push(messageKey)
    }
    if (autoCorrectionTimer) clearTimeout(autoCorrectionTimer)
    autoCorrectionTimer = setTimeout(() => {
      autoCorrectionMessageKeys.value = []
      autoCorrectionTimer = null
    }, 5000)
  }

  function dismissAutoCorrection(): void {
    autoCorrectionMessageKeys.value = []
    if (autoCorrectionTimer) {
      clearTimeout(autoCorrectionTimer)
      autoCorrectionTimer = null
    }
  }

  return { locale, setLocale, localeLoading, theme, setTheme, applyTheme, currentWizardStep, setWizardStep, topologyConfirmed, confirmTopology, isLandingVisible, dismissLanding, storageUnit, setStorageUnit, chartImages, registerChartImage, autoCorrectionMessageKeys, flashAutoCorrection, dismissAutoCorrection }
})
