import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n, loadLocale } from '../i18n'
import type { StorageUnit } from '@/utils/formatStorage'

type AppLocale = 'en' | 'fr' | 'de' | 'it'

export type ChartType = 'cores' | 'ram' | 'storage'

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
  // stretch). Holds an i18n message key; auto-dismisses after 5 seconds.
  const autoCorrectionMessageKey = ref<string | null>(null)
  let autoCorrectionTimer: ReturnType<typeof setTimeout> | null = null

  function flashAutoCorrection(messageKey: string): void {
    autoCorrectionMessageKey.value = messageKey
    if (autoCorrectionTimer) clearTimeout(autoCorrectionTimer)
    autoCorrectionTimer = setTimeout(() => {
      autoCorrectionMessageKey.value = null
      autoCorrectionTimer = null
    }, 5000)
  }

  function dismissAutoCorrection(): void {
    autoCorrectionMessageKey.value = null
    if (autoCorrectionTimer) {
      clearTimeout(autoCorrectionTimer)
      autoCorrectionTimer = null
    }
  }

  return { locale, setLocale, localeLoading, currentWizardStep, setWizardStep, topologyConfirmed, confirmTopology, isLandingVisible, dismissLanding, storageUnit, setStorageUnit, chartImages, registerChartImage, autoCorrectionMessageKey, flashAutoCorrection, dismissAutoCorrection }
})
