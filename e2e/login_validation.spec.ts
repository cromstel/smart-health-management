import { test, expect } from '@playwright/test';

test.describe('Login Input Validation and Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Log request failures to assist with debugging
    page.on('requestfailed', request => {
      console.log(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
    });
  });

  test('should display login page elements correctly', async ({ page }) => {
    await page.goto('/login');

    // Verify system title and header
    await expect(page.getByRole('heading', { name: 'Smart Health' })).toBeVisible();
    await expect(page.getByText('Sign in to your clinical workstation')).toBeVisible();
    
    // Verify input fields and button presence
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  });

  test('should display Zod validation errors for empty fields', async ({ page }) => {
    await page.goto('/login');

    // Click submit without entering any details
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Check for email validation error
    const emailError = page.locator('#email-error');
    await expect(emailError).toBeVisible();
    await expect(emailError).toContainText('Email address is required');

    // Check for password validation error
    const passwordError = page.locator('#password-error');
    await expect(passwordError).toBeVisible();
    await expect(passwordError).toContainText('Password must be at least 6 characters');
  });

  test('should display Zod validation error for invalid email format', async ({ page }) => {
    await page.goto('/login');

    // Fill invalid email and short password
    await page.getByLabel('Email address').fill('invalid-email-format');
    await page.getByLabel('Password').fill('123');

    // Click submit
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Verify email format error
    const emailError = page.locator('#email-error');
    await expect(emailError).toBeVisible();
    await expect(emailError).toContainText('Please enter a valid work email address');

    // Verify password length error
    const passwordError = page.locator('#password-error');
    await expect(passwordError).toBeVisible();
    await expect(passwordError).toContainText('Password must be at least 6 characters');
  });

  test('should login successfully with valid clinician credentials', async ({ page }) => {
    await page.goto('/login');

    // Enter valid clinical credentials for Dr. John Smith (Doctor role)
    await page.getByLabel('Email address').fill('doctor@smarthealth.com');
    await page.getByLabel('Password').fill('Demo@135790');

    // Submit the form
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Since the doctor role requires MFA verification (as configured in AuthContext for staff),
    // it will redirect to the 2FA MFA verification screen.
    const mfaContainer = page.locator('#mfa-verification-container');
    await expect(mfaContainer).toBeVisible({ timeout: 10000 });

    // Enter standard test verification code (123456)
    const quickTotpBtn = page.locator('#fill-demo-totp-btn');
    await expect(quickTotpBtn).toBeVisible();
    await quickTotpBtn.click();

    // Click verify/submit MFA
    await page.locator('#mfa-submit-btn').click();

    // Verify redirected to dashboard successfully
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.url()).toContain('/dashboard');
  });
});
