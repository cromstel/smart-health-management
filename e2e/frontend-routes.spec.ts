import { test, expect, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => element.getBoundingClientRect().right > viewport + 1)
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}#${element.id}.${element.className}`);
  });
  expect(overflow).toEqual([]);
}

async function signInAsClinician(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill('doctor@smarthealth.com');
  await page.locator('#password').fill('Demo@135790');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/two-factor$/);
  await page.getByRole('button', { name: 'Quick Test: Fetch Current Demo TOTP Token' }).click();
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
      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.locator('#main-content').locator('h1:visible').first()).toBeVisible();
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
    await expect(page.locator('#main-content')).toBeVisible();
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
      await expect(page.locator('#super-admin-main')).toBeVisible();
      await expect(page.locator('#super-admin-main').locator('h1').first()).toBeVisible();
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
