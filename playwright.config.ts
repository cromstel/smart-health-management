import { defineConfig, devices } from '@playwright/test';
import { DEFAULT_LOCAL_HOST } from './server/src/config/runtime';
import { publishAppName } from './src/e2e/helpers/appName';

// Keep the app port configurable and, more importantly, verify it is actually
// ours. Port 3000 was held on this machine by a WSL relay serving an unrelated
// application; Vite silently fell back to the next port up while the suite kept
// talking to 3000, so every run measured the wrong software. strictPort in
// vite.config.ts stops the server side of that, and the content check below
// stops the test side from ever trusting a port that is not this app.
//
// VITE_PORT rather than PORT, because PORT is the API server's port.
// The port is required and comes from the environment: a port written into
// the source has to be changed in the source to be changed at all.
const PORT = Number(process.env.VITE_PORT);
if (!Number.isInteger(PORT) || PORT < 1) {
  throw new Error('Missing or invalid environment variable: VITE_PORT.');
}
const BASE_URL = `http://${DEFAULT_LOCAL_HOST}:${PORT}`;

// The dev server resolves the application name from VITE_APP_NAME; the
// Playwright process has to see the same value, or the branding assertions
// would compare the rendered name against the shipped one.
publishAppName();

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
    // The Vite dev server alone is NOT enough for the whole suite. There is no
    // mock API any more: src/server/mockApi.ts is deleted and every mode calls
    // the real API via VITE_API_URL. So start the backend yourself before
    // running the suite (npm run dev in server/), and Playwright reuses it. The
    // backend needs reachable MySQL credentials and a seeded database, per
    // AGENTS.md section 6.
    //
    // CI does not start one -- the "Frontend e2e" job runs `--grep-invert @db`,
    // which leaves only the specs the dev server can answer unaided. A spec that
    // calls an endpoint must carry the `@db` tag or it fails there for want of
    // a backend, which is a different problem from the one it is testing.
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
  globalSetup: './src/e2e/global-setup.ts',
});
