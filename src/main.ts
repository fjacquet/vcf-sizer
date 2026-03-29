import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from './i18n'
import { hydrateFromUrl } from './composables/useUrlState'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(i18n)
hydrateFromUrl() // AFTER pinia installed, BEFORE app.mount() — constraint #5
app.mount('#app')
