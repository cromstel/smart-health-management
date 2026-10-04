import { test, expect, Page } from '@playwright/test';

/**
 * Full-application smoke: walk every route as admin, capture ALL issues
 * (console errors, page errors, failed requests, blank content).
 */

const ROUTES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/ai-assistant', name: 'AI Assistant' },
  { path: '/patients', name: 'Patients' },
  { path: '/appointments', name: 'Appointments' },
  { path: '/hospitals', name: 'Hospitals' },
  { path: '/staff', name: 'Staff' },
  { path: '/staff-dashboard', name: 'Staff Dashboard' },
  { path: '/documents', name: 'Documents' },
  { path: '/pharmacy', name: 'Pharmacy' },
  { path: '/purchase-orders', name: 'Purchase Orders' },
  { path: '/inventory-reports', name: 'Inventory Reports' },
  { path: '/prescriptions', name: 'Prescriptions' },
  { path: '/financial', name: 'Financial' },
  { path: '/roles', name: 'Roles' },
  { path: '/audit-logs', name: 'Audit Logs' },
  { path: '/settings', name: 'Settings' },
];

interface Issue {
  type: 'console-error' | 'page-error' | 'request-fail' | 'navigation' | 'content';
  detail: string;
}

function attachIssueCollectors(page: Page, issues: Issue[]) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      issues.push({ type: 'console-error', detail: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    issues.push({ type: 'page-error', detail: `${err.name}: ${err.message}` });
  });
  page.on('requestfailed', (req) => {
    issues.push({ type: 'request-fail', detail: `${req.method()} ${req.url()} -> ${req.failure()?.errorText}` });
  });
  page.on('response', (res) => {
    if (res.status() >= 500) {
      issues.push({ type: 'request-fail', detail: `${res.status()} ${res.request().method()} ${res.url()}` });
    }
  });
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|login/i }).first().click();

  // The seeded clinical accounts carry a TOTP secret, so login returns a
  // short-lived temp token and the UI routes to /two-factor. Accounts without a
  // secret (the super admin) go straight through.
  //
  // Wait for that navigation before probing for the two-factor controls: the
  // quick-fill button lives on /two-factor, so checking for it while still on
  // /login always missed and then timed out on the final URL wait.
  //
  // The button labels previously used here were written against the mock API and
  // no longer matched the real page ("Quick Test: fill demo TOTP" / "Verify
  // code"). Matched to the current page instead. The quick-fill sets the code
  // asynchronously, so wait for the value rather than relying on click retry.
  await page.waitForURL(/\/(two-factor|dashboard|super-admin)/, { timeout: 30000 });

  if (page.url().includes('/two-factor')) {
    const otpInput = page.getByLabel(/enter 6-digit authentication code/i);
    await otpInput.waitFor({ state: 'visible', timeout: 15000 });
    const quickFill = page.getByRole('button', { name: /quick test: fetch current demo totp token/i });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await quickFill.click();
      const filled = await otpInput
        .inputValue()
        .then((value) => /^\d{6}$/.test(value))
        .catch(() => false);
      if (filled) break;
      await page.waitForTimeout(500);
    }
    await page.getByRole('button', { name: /confirm & proceed to dashboard/i }).click();
  }

  await page.waitForURL(/\/(dashboard|super-admin)/, { timeout: 30000 });
}

test('login as admin', async ({ page }) => {
  const issues: Issue[] = [];
  attachIssueCollectors(page, issues);
  await login(page, 'admin@smarthealth.com', 'Pass@135709');
  expect(issues.filter((i) => i.type !== 'console-error' || !i.detail.includes('favicon'))).toEqual([]);
});

test.describe('authenticated pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@smarthealth.com', 'Pass@135709');
  });

  for (const route of ROUTES) {
    test(`${route.name} renders cleanly`, async ({ page }) => {
      const issues: Issue[] = [];
      attachIssueCollectors(page, issues);

      const resp = await page.goto(route.path);
      expect(resp && resp.status() < 400, `${route.path} returned ${resp?.status()}`).toBeTruthy();

      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      const bodyText = await page.locator('body').innerText().catch(() => '');
      expect(bodyText.trim().length, `${route.path} produced blank page`).toBeGreaterThan(50);

      const consoleIssues = issues.filter((i) => i.type === 'console-error' && !i.detail.includes('favicon'));
      const severe = issues.filter((i) => i.type === 'page-error' || i.type === 'request-fail' || i.type === 'navigation');
      expect(consoleIssues, `${route.path} console errors: ${JSON.stringify(consoleIssues)}`).toEqual([]);
      expect(severe, `${route.path} severe issues: ${JSON.stringify(severe)}`).toEqual([]);
    });
  }
});

test('super admin pages render', async ({ page }) => {
  const issues: Issue[] = [];
  attachIssueCollectors(page, issues);
  await login(page, 'superadmin@smarthealth.com', 'April--2024!!!!');

  const superAdminRoutes = ['/super-admin/dashboard', '/super-admin/users', '/super-admin/hospitals', '/super-admin/audit-logs', '/super-admin/settings', '/super-admin/operations'];
  for (const route of superAdminRoutes) {
    const resp = await page.goto(route);
    expect(resp && resp.status() < 400).toBeTruthy();
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText.trim().length, `${route} blank`).toBeGreaterThan(50);
  }
  const consoleIssues = issues.filter((i) => i.type === 'console-error' && !i.detail.includes('favicon'));
  expect(consoleIssues, JSON.stringify(consoleIssues)).toEqual([]);
});

test('public auth pages render cleanly', async ({ page }) => {
  const issues: Issue[] = [];
  attachIssueCollectors(page, issues);
  for (const route of ['/login', '/register', '/forgot-password', '/reset-password']) {
    const resp = await page.goto(route);
    expect(resp && resp.status() < 400).toBeTruthy();
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText.trim().length, `${route} blank`).toBeGreaterThan(50);
  }
  const consoleIssues = issues.filter((i) => i.type === 'console-error' && !i.detail.includes('favicon'));
  expect(consoleIssues, JSON.stringify(consoleIssues)).toEqual([]);
});