import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

import { getProductionApiUrlError } from './tooling/productionApiUrl.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    const apiUrlError = getProductionApiUrlError(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL)
    if (apiUrlError) throw new Error(apiUrlError)
  }

  return {
    plugins: [react()],
    build: {
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      clearMocks: true,
    },
  }
})
