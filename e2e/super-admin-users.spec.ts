import { test, expect } from '@playwright/test';

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

  test('lists, filters, updates status, resets a password, and survives refresh', async ({ page }) => {
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
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Super Admin', exact: true })).toBeVisible();

    const search = page.getByPlaceholder('Search by name or email...');
    await search.fill('doctor@smarthealth.com');
    await expect(page.getByRole('cell', { name: 'Dr. John Smith', exact: true })).toBeVisible();
    await expect(page.getByText('Admin User', { exact: true })).not.toBeVisible();
    await search.fill('');

    await page.getByRole('combobox', { name: 'Filter by role' }).click();
    await page.getByRole('option', { name: 'doctor', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Dr. John Smith', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Filter by role' }).click();
    await page.getByRole('option', { name: 'All Roles' }).click();

    await page.getByRole('button', { name: 'Lock Dr. John Smith' }).click();
    await expect(page.getByRole('button', { name: 'Unlock Dr. John Smith' })).toBeVisible();
    await page.getByRole('button', { name: 'Unlock Dr. John Smith' }).click();
    await expect(page.getByRole('button', { name: 'Deactivate Dr. John Smith' })).toBeVisible();

    await page.getByRole('button', { name: 'Reset password for Admin User' }).click();
    await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset password', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Temporary password generated' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    expect(failedResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
