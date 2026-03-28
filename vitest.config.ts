import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',   // Pure TS engine tests — no DOM needed
    globals: true,
    include: ['src/engine/**/*.test.ts'],
  },
})
