import { test, expect } from '@playwright/test';

/**
 * Signs in through the two-factor step using the seeded demo TOTP.
 * The clinical and admin demo accounts carry a TOTP secret, so login returns
 * a short-lived temp token and the UI routes to /two-factor.
 */
async function signInWithTotp(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL(/\/(two-factor|dashboard)/, { timeout: 30000 });
  if (!page.url().includes('/two-factor')) return;

  const otp = page.getByLabel('Enter 6-digit authentication code');
  await otp.waitFor({ state: 'visible', timeout: 15000 });
  const quickFill = page.getByRole('button', { name: 'Quick Test: Fetch Current Demo TOTP Token' });
  // The fill is asynchronous (fetch then setState), so wait for the value
  // rather than relying on click retry.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await quickFill.click();
    if (/^\d{6}$/.test(await otp.inputValue())) break;
    await page.waitForTimeout(400);
  }
  await page.getByRole('button', { name: 'Confirm & Proceed to Dashboard' }).click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

// The seeded demo clinician is named 'Dr. Smith' (see server/src/database/seed.sql).
// These assertions previously looked for 'Dr. John Smith', which no fixture has
// ever contained, so the row filter and status toggle could not be exercised.
async function signInAsSuperAdmin(page: import('@playwright/test').Page) {
  await page.goto('/super-admin/login');
  await page.locator('#admin-email').fill('superadmin@smarthealth.com');
  await page.locator('#admin-password').fill('April--2024!!!!');
  await page.getByRole('button', { name: 'Authenticate Master Session' }).click();
  await page.waitForURL('**/super-admin/dashboard');
}

test.describe('Super-admin user management', () => {
  test('protects direct access for unauthenticated users', async ({ page }) => {
    await page.goto('/super-admin/users');
    await expect(page).toHaveURL(/\/super-admin\/login$/);
  });

  test('lists, filters, updates status, resets a password, and survives refresh', async ({ page, browser }) => {
    // Covers the reset AND the restore: a second sign-in with two-factor plus a
    // forced password change. The 30s default is not enough for all of it.
    test.setTimeout(120000);
    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.url().includes('/api/super-admin/users') && response.status() >= 400) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await signInAsSuperAdmin(page);
    await page.goto('/super-admin/users');
    // Lazy chunk: the dev server compiles it on first request, which overruns
    // Playwright's 5s default on a cold cache.
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('cell', { name: 'Super Admin', exact: true })).toBeVisible();

    const search = page.getByPlaceholder('Search by name or email...');
    await search.fill('doctor@smarthealth.com');
    await expect(page.getByRole('cell', { name: 'Dr. Smith', exact: true })).toBeVisible();
    await expect(page.getByText('Admin User', { exact: true })).not.toBeVisible();
    await search.fill('');

    await page.getByRole('combobox', { name: 'Filter by role' }).click();
    await page.getByRole('option', { name: 'doctor', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Dr. Smith', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Filter by role' }).click();
    await page.getByRole('option', { name: 'All Roles' }).click();

    await page.getByRole('button', { name: 'Lock Dr. Smith' }).click();
    await expect(page.getByRole('button', { name: 'Unlock Dr. Smith' })).toBeVisible();
    await page.getByRole('button', { name: 'Unlock Dr. Smith' }).click();
    await expect(page.getByRole('button', { name: 'Deactivate Dr. Smith' })).toBeVisible();

    await page.getByRole('button', { name: 'Reset password for Admin User' }).click();
    await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset password', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Temporary password generated' })).toBeVisible();

    // Restore the fixture. This test overwrites the seeded admin password, and
    // nothing put it back, so a second run of the suite failed every login with
    // the documented credential until the database was re-seeded by hand.
    // Completing the forced change also exercises the reset -> change flow.
    const temporaryPassword = (await page.locator('code').first().innerText()).trim();
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);
    await page.getByRole('button', { name: 'Done' }).click();

    const restoreCtx = await browser.newContext();
    const restorePage = await restoreCtx.newPage();
    try {
      await signInWithTotp(restorePage, 'admin@smarthealth.com', temporaryPassword);

      // password_must_change is set by the reset, so the modal gates the app.
      await expect(restorePage.getByRole('heading', { name: 'Change your password' })).toBeVisible({ timeout: 20000 });
      await restorePage.locator('#currentPassword').fill(temporaryPassword);
      await restorePage.locator('#newPassword').fill('Pass@135709');
      await restorePage.locator('#confirmPassword').fill('Pass@135709');
      await restorePage.getByRole('button', { name: /change password/i }).last().click();
      await expect(restorePage.getByRole('heading', { name: 'Change your password' })).toBeHidden({ timeout: 20000 });

      // Prove the documented credential works again.
      await restoreCtx.clearCookies();
      await restorePage.evaluate(() => localStorage.clear());
      await signInWithTotp(restorePage, 'admin@smarthealth.com', 'Pass@135709');
      await expect(restorePage).toHaveURL(/\/dashboard/);
    } finally {
      await restoreCtx.close();
    }

    await page.reload();
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 30000 });
    expect(failedResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});