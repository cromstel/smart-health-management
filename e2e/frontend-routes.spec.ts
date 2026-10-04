import { test, expect, type Page } from '@playwright/test';

/**
 * Asserts the *document* does not scroll sideways.
 *
 * Elements inside a deliberate horizontal scroller are excluded: the dashboard
 * appointment heat map is a 760px grid inside overflow-x-auto, so its cells sit
 * past a 375px viewport by design. Counting them reported overflow where the
 * page itself never scrolled.
 */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const insideHorizontalScroller = (element: Element) => {
      let node = element.parentElement;
      while (node) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') return true;
        node = node.parentElement;
      }
      return false;
    };
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter(
        (element) =>
          element.getBoundingClientRect().right > viewport + 1 &&
          !insideHorizontalScroller(element)
      )
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}#${element.id}.${element.className}`);
  });
  expect(overflow).toEqual([]);
  // The document itself must not have grown: this is what a user would
  // actually experience as sideways scroll.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

async function signInAsClinician(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill('doctor@smarthealth.com');
  await page.locator('#password').fill('Demo@135790');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/two-factor$/);
  await page.getByRole('button', { name: 'Quick Test: Fetch Current Demo TOTP Token' }).click();
  // Quick Test fills the code asynchronously (fetch, then setState), so the
  // submit button is disabled until it lands. Clicking straight through relies
  // on Playwright's actionability retry, which intermittently exhausted the
  // beforeEach budget and timed the whole test out.
  await expect(page.getByLabel('Enter 6-digit authentication code')).toHaveValue(/^\d{6}$/, { timeout: 15000 });
  await page.getByRole('button', { name: 'Confirm & Proceed to Dashboard' }).click();
  await page.waitForURL('**/dashboard');
}

async function signInAsSuperAdmin(page: Page) {
  await page.goto('/super-admin/login');
  await page.locator('#admin-email').fill('superadmin@smarthealth.com');
  await page.locator('#admin-password').fill('April--2024!!!!');
  await page.getByRole('button', { name: 'Authenticate Master Session' }).click();
  await page.waitForURL('**/super-admin/dashboard');
}

test.describe('Public routes', () => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    test(`landing page is usable at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('link', { name: /request.*demo/i }).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test('request-demo form submits through the local API', async ({ page }) => {
    await page.goto('/request-demo');
    await page.locator('#demo-name').fill('Avery Doe');
    await page.locator('#demo-email').fill('avery@example.org');
    await page.locator('#demo-organization').fill('Northwind Hospital');
    await page.locator('#demo-role').fill('Clinical Director');
    await page.locator('#demo-organization-size').selectOption('51-250');
    await page.getByRole('button', { name: 'Request my demo' }).click();
    await expect(page.getByRole('heading', { name: 'Your request is on its way.' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('password recovery, reset and invalid shared-summary states are clear', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Password Recovery' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'Set New Password' })).toBeVisible();
    await expect(page.getByText('No active password reset token was detected in your browser URL.')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/shared/patient-summary/not-a-valid-token');
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Access Portal Login' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('Clinician route smoke checks', () => {
  test.beforeEach(async ({ page }) => signInAsClinician(page));

  const routes = [
    '/dashboard', '/ai-assistant', '/patients', '/appointments', '/hospitals', '/staff',
    '/staff-dashboard', '/documents', '/pharmacy', '/purchase-orders', '/inventory-reports',
    '/prescriptions', '/financial', '/roles', '/audit-logs', '/settings',
  ];

  for (const path of routes) {
    test(`${path} renders its workstation content`, async ({ page }) => {
      await page.goto(path);
      // Generous: these routes are lazy chunks and the dev server compiles them
      // on first request. Measured 1.1-3.8s, which overruns Playwright's 5s
      // default once several specs run in parallel and compete for the bundler.
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('#main-content').locator('h1:visible').first()).toBeVisible({ timeout: 30000 });
      await expectNoHorizontalOverflow(page);
    });
  }

  test('settings exposes MFA, passkey and security activity controls', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Security' }).click();
    await expect(page.getByText('Security Activity', { exact: true })).toBeVisible();
    await expect(page.getByText('Biometric WebAuthn Passkeys', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register New Passkey' })).toBeVisible();
  });

  test('navigation remains usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    // Lazy chunk again: a full navigation after the viewport change re-requests
    // the dashboard module, and the default 5s was not always enough.
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Toggle navigation menu' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('Super-admin route smoke checks', () => {
  test.beforeEach(async ({ page }) => signInAsSuperAdmin(page));

  for (const path of [
    '/super-admin/dashboard', '/super-admin/users', '/super-admin/hospitals',
    '/super-admin/audit-logs', '/super-admin/settings', '/super-admin/operations',
  ]) {
    test(`${path} renders its console content`, async ({ page }) => {
      await page.goto(path);
      // Same lazy-chunk reason as the clinician route loop below.
      await expect(page.locator('#super-admin-main')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('#super-admin-main').locator('h1').first()).toBeVisible({ timeout: 30000 });
      await expectNoHorizontalOverflow(page);
    });
  }

  test('super-admin navigation remains usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/super-admin/dashboard');
    await expect(page.locator('#super-admin-main')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle navigation menu' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
