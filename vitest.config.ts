import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/tests/**/*.test.tsx', 'src/tests/**/*.test.ts', 'server/src/tests/**/*.test.ts', 'src/components/ui/**/*.test.tsx'],
    exclude: [
      'server/node_modules/**',
      'server/dist/**',
      'src/pages/FinancialPage.integration.test.tsx',
      'src/services/api.security.test.ts',
      'src/tests/pages/PharmacyPage.test.tsx',
      'server/src/tests/pharmacyReportsExport.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
})
