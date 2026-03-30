import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node', // Pure TS engine tests — no DOM needed
    globals: true,
    include: ['src/engine/**/*.test.ts', 'src/composables/**/*.test.ts', 'src/stores/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
