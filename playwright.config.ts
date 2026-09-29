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
    // credentials and a seeded database, per AGENTS.md section 6.
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      // The API's rate limiters are per-IP and secure by default: 5 login and
      // 10 TOTP attempts per 5 minutes, and 100 API calls per 15 minutes. A
      // suite that performs dozens of logins and hundreds of requests from one
      // address exceeds all three and then fails with 429 for reasons unrelated
      // to the code. Raised for the test environment only -- start the API with
      // the same values (see the comment above) to exercise the suite.
      LOGIN_RATE_LIMIT_MAX: '1000',
      TWO_FACTOR_RATE_LIMIT_MAX: '1000',
      RATE_LIMIT_MAX_REQUESTS: '100000',
      RATE_LIMIT_WINDOW_MS: '60000',
    },
  },
});
