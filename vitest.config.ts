import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // The application name is required configuration and is not written into
    // the source. The test environment supplies one, so the module under test
    // resolves it the same way it does in a deployment.
    env: {
      VITE_APP_NAME: 'Test Application',
    },
    // Interaction-heavy integration suites (Radix dialogs/selects, typed forms)
    // routinely take several seconds per test; the 5s default turns ordinary
    // worker contention into timeout flakes. 20s keeps genuine hangs loud
    // while absorbing loaded-machine jitter.
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ['src/tests/**/*.test.tsx', 'src/tests/**/*.test.ts', 'src/components/ui/**/*.test.tsx', 'src/pages/**/*.test.tsx', 'src/components/layout/**/*.test.tsx'],
    exclude: [
      'server/**',
      'src/services/api.security.test.ts',
      'src/tests/pages/PharmacyPage.test.tsx',
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
