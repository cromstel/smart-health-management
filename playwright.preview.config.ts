import { defineConfig, devices } from '@playwright/test';
import { publishAppName } from './src/e2e/helpers/appName';

// The preview serves the production build, whose application name was baked
// from the production-mode environment. The Playwright process has to see the
// same value, or the branding assertions would compare the rendered name
// against the shipped one.
publishAppName();

// The port the preview server is served on. Configuration, with the
// documented default in one place: the base URL, the readiness URL and the
// server's own `--port` flag all have to agree, and a change to the port has
// to be a change to one line.
const PREVIEW_PORT = Number(process.env.VITE_PREVIEW_PORT || 3001);
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: PREVIEW_URL,
    trace: 'on-first-retry',
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PREVIEW_PORT}`,
    url: PREVIEW_URL,
    reuseExistingServer: true,
  },
});