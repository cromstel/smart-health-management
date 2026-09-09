import { test, expect } from '@playwright/test';

test.describe('Login Presentation and Form UI', () => {
  test('should display login page elements correctly', async ({ page }) => {
    await page.goto('/login');

    // Check titles and headings
    await expect(page.getByRole('heading', { name: 'Smart Health' })).toBeVisible();
    await expect(page.getByText('Sign in to your clinical workstation')).toBeVisible();
    
    // Check form fields
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  });
});
