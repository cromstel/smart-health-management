import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // The Vite dev server alone is NOT enough. The comment that used to sit
    // here claimed the local mock API made a second API process unnecessary,
    // which is wrong: src/server/mockApi.ts has no /api/auth routes at all, and
    // .env.local points VITE_API_URL at the real API on :5000. Without the
    // backend running, every auth call fails with "Failed to fetch" and the
    // suite reports ~47 failures that look like product regressions.
    //
    // Start the API yourself before running the suite (npm run dev in server/),
    // then Playwright will reuse it. The backend in turn needs reachable MySQL
    // credentials; a local server whose DB rejects the configured user will
    // still fail these tests, and that is an environment problem rather than a
    // code one.
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
