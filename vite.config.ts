import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import path from 'path'

export default defineConfig({
  base: '/vcf-sizer/',
  plugins: [
    vue(),
    tailwindcss(),
    // Note: include is omitted to avoid rolldown/JSON conflict with Vite 8.
    // JSON locale files are processed natively by rolldown.
    // The plugin still handles SFC <i18n> blocks if needed in future.
    VueI18nPlugin({
      runtimeOnly: false,
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
