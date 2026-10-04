import { defineConfig, devices } from '@playwright/test';

// Keep the app port configurable and, more importantly, verify it is actually
// ours. Port 3000 was held on this machine by a WSL relay serving an unrelated
// application; Vite silently fell back to the next port up while the suite kept
// talking to 3000, so every run measured the wrong software. strictPort in
// vite.config.ts stops the server side of that, and the content check below
// stops the test side from ever trusting a port that is not this app.
//
// VITE_PORT rather than PORT, because PORT is the API server's port (5000).
const PORT = Number(process.env.VITE_PORT || 5175);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
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
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_PORT: String(PORT),
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
  // Refuse to run against whatever happens to be answering on the port. Cheap
  // insurance against repeating the "tested a different app" failure, which is
  // easy to miss because the failures look plausible.
  globalSetup: './e2e/global-setup.ts',
});
