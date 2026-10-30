/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The progress API: backend/dev_server.py, or a deployed app with API_PROXY=https://<CloudFront domain>.
    proxy: {
      '/api': { target: process.env.API_PROXY ?? 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  build: {
    // The vocab-data chunk is the word lists of N5–N2 and the exam papers (~1.27 MB, ~280 kB gzipped).
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
    // The exam tests render papers of up to 60 questions: a few seconds each next to the other test files.
    testTimeout: 15_000,
  },
})


