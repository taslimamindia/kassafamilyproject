/// <reference types="vitest" />
import { defineConfig } from 'vite'
import type { UserConfig } from 'vite'
import type { InlineConfig } from 'vitest/node'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

interface VitestConfigExport extends UserConfig {
  test?: InlineConfig
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  resolve: {
    alias: {
      // The sign '@src' will now point to the 'src' folder
      '@src': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}','src/**/__tests__/**/*.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
} as VitestConfigExport)
