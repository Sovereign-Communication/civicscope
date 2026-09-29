import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    target: 'es2022',
    // Source maps are useful during development and are a 500KB public
    // disclosure of application source in production, so they are opt-in per
    // build rather than always-on.
    sourcemap: mode !== 'production',
  },
  test: {
    environment: 'node',
    // The named gate tests live in tests/, alongside the sources they assert
    // about rather than inside them.
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
}))
