import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from './i18n'
import { hydrateFromUrl } from './composables/useUrlState'
import { useUiStore } from './stores/uiStore'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(i18n)
hydrateFromUrl() // AFTER pinia installed, BEFORE app.mount() — constraint #5

// Apply persisted/system theme before mount so the `.dark` class is present on
// first paint (avoids a light→dark flash for dark-preferring users).
useUiStore().applyTheme()

// If URL state was hydrated, topology is already configured — skip step 1 gate (WIZARD-03)
// Only confirm when the URL actually contained state (s= param), not on fresh load
if (window.location.search.includes('s=')) {
  const uiStore = useUiStore()
  uiStore.confirmTopology()
  uiStore.dismissLanding()  // Phase 18: bypass landing for URL-hydrated sessions
}

app.mount('#app')
