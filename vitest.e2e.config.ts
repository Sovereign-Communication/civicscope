import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Browser-driven verification. Runs against a built app so the assertions cover
 * the production bundle, including the Content-Security-Policy that would block
 * a source that a dev server happily serves.
 *
 * Skipped automatically when CENSUS_KEY is absent.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/e2e/**/*.e2e.ts'],
    testTimeout: 300000,
    hookTimeout: 180000,
    // A single browser instance; parallel runs would each pay the sweep cost.
    fileParallelism: false,
  },
})
