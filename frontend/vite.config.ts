/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The vocab-data chunk is the word lists of N5–N2 themselves (~1.2 MB, ~250 kB gzipped).
    chunkSizeWarningLimit: 1300,
    rolldownOptions: {
      output: {
        // The word lists rarely change: keep them and React in their own chunks so browsers
        // keep them cached when only the app code changes.
        codeSplitting: {
          groups: [
            { name: 'vocab-data', test: /[\\/]src[\\/]data[\\/].*\.json$/ },
            { name: 'vendor', test: /[\\/]node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})


