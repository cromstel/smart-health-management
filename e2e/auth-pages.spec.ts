import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('loads and displays all form elements', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // Brand header. The shared Logo renders as role="img" with an accessible
    // name, not a text heading, so assert the accessible name instead.
    await expect(page.getByRole('img', { name: 'Smart MediCare' })).toBeVisible();

    // Page title and subtitle
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.locator('text=Sign in to your clinical workstation')).toBeVisible();

    // Email field
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('placeholder', 'name@smarthealth.com');

    // Password field
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Show/hide password toggle
    await expect(page.locator('#toggle-password-visibility')).toBeVisible();

    // Remember me checkbox
    await expect(page.locator('#remember')).toBeVisible();

    // Forgot password link
    await expect(page.locator('text=Forgot password?')).toBeVisible();

    // Submit button
    await expect(page.locator('#login-submit-btn')).toBeVisible();
    await expect(page.locator('#login-submit-btn')).toContainText('Sign In');

    // Register link
    await expect(page.locator('text=New staff member?')).toBeVisible();
    await expect(page.locator('text=Register here')).toBeVisible();
  });

  test('branding panel is visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Secure, intelligent healthcare management.')).toBeVisible();
    await expect(page.locator('text=Enterprise Security')).toBeVisible();
    await expect(page.locator('text=Real-time Monitoring')).toBeVisible();
    await expect(page.locator('text=System Operational')).toBeVisible();
  });

  test('can toggle password visibility', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.locator('#toggle-password-visibility').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.locator('#toggle-password-visibility').click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('shows validation errors for empty submission', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await page.locator('#login-submit-btn').click();

    await expect(page.locator('#email-error')).toBeVisible();
    await expect(page.locator('#password-error')).toBeVisible();
  });

  test('can type in email and password fields', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await page.locator('#email').fill('doctor@smarthealth.com');
    await expect(page.locator('#email')).toHaveValue('doctor@smarthealth.com');

    await page.locator('#password').fill('Demo@135790');
    await expect(page.locator('#password')).toHaveValue('Demo@135790');
  });

  test('forgot password mode toggle works', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // Click forgot password
    await page.locator('text=Forgot password?').click();

    // Should show reset form
    await expect(page.locator('text=Reset Password')).toBeVisible();
    await expect(page.locator('#forgot-submit-btn')).toBeVisible();
    await expect(page.locator('text=Back to Workstation Sign In')).toBeVisible();

    // Go back to login
    await page.locator('text=Back to Workstation Sign In').click();
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });
});

test.describe('Register Page', () => {
  test('loads and displays all form elements', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    // Brand header
    await expect(page.getByRole('img', { name: 'Smart MediCare' })).toBeVisible();

    // Page title
    await expect(page.getByRole('heading', { name: 'Staff Registration' })).toBeVisible();
    await expect(page.locator('text=Create your verified healthcare provider profile')).toBeVisible();

    // HIPAA badge
    await expect(page.locator('text=HIPAA Verified')).toBeVisible();

    // Form fields
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#role')).toBeVisible();
    await expect(page.locator('#hospital')).toBeVisible();
    await expect(page.locator('#department')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    await expect(page.locator('#terms')).toBeVisible();

    // Submit button
    await expect(page.locator('text=Complete Staff Registration')).toBeVisible();

    // Footer link
    await expect(page.locator('text=Back to Sign In')).toBeVisible();
  });

  test('shows password strength meter when typing', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    // Password strength should not be visible initially
    await expect(page.locator('text=Password Complexity')).not.toBeVisible();

    // Type a weak password
    await page.locator('#password').fill('abc');
    await expect(page.locator('text=Password Complexity')).toBeVisible();
    await expect(page.locator('text=Very Weak')).toBeVisible();

    // Type a stronger password
    await page.locator('#password').fill('Password123!');
    await expect(page.locator('text=Excellent')).toBeVisible();
  });

  test('can fill out the registration form', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    await page.locator('#name').fill('Dr. Test User');
    await page.locator('#email').fill('test@hospital.com');
    await page.locator('#role').selectOption('Doctor');
    await page.locator('#hospital').selectOption('General Hospital');
    await page.locator('#department').selectOption('Cardiology');
    await page.locator('#password').fill('SecurePass123!');
    await page.locator('#confirmPassword').fill('SecurePass123!');
    await page.locator('#terms').check();

    await expect(page.locator('#name')).toHaveValue('Dr. Test User');
    await expect(page.locator('#email')).toHaveValue('test@hospital.com');
  });

  test('can toggle password visibility', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Find the show/hide button for password (first one)
    const toggleBtn = page.locator('button[aria-label="Show password"]').first();
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('shows validation errors for empty submission', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    await page.locator('text=Complete Staff Registration').click();

    await expect(page.locator('#name-error')).toBeVisible();
    await expect(page.locator('#email-error')).toBeVisible();
  });
});

test.describe('Two-Factor Page', () => {
  test('shows the safe recovery state without a pending MFA session', async ({ page }) => {
    await page.goto('/auth/two-factor');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('img', { name: 'Smart MediCare' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No Verification Session' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to Login' })).toBeVisible();
    await expect(page.locator('[aria-label^="Digit "]')).toHaveCount(0);
  });
});

test.describe('Super Admin Login Page', () => {
  test('loads and displays all elements', async ({ page }) => {
    await page.goto('/auth/super-admin/login');
    await page.waitForLoadState('networkidle');

    // Brand header. This portal deliberately does NOT use the shared Logo
    // component (it keeps its own industrial identity), so assert its own
    // marker rather than the site-wide img role.
    await expect(page.getByText('Site Owner Portal', { exact: true })).toBeVisible();

    // Page title. This portal's own identity copy is "Root Access." — it is not
    // the "Super Admin Portal" wording the old (pre-rewrite) spec asserted.
    await expect(page.getByRole('heading', { name: /Root Access/i })).toBeVisible();
    await expect(page.locator('text=Multi-hospital governance')).toBeVisible();

    // Restricted-terminal marker in the header strip
    await expect(page.getByText(/RESTRICTED TERMINAL/)).toBeVisible();

    // Access protocol list
    await expect(page.getByText('Access Protocol', { exact: true })).toBeVisible();
    await expect(page.locator('text=Multi-factor enforced')).toBeVisible();

    // Form fields
    await expect(page.locator('#admin-email')).toBeVisible();
    await expect(page.locator('#admin-password')).toBeVisible();
    await expect(page.getByLabel('Super Admin Email')).toBeVisible();
    await expect(page.getByLabel('Master Password')).toBeVisible();

    // Scope guidance: this portal is for the site owner, not hospital staff.
    await expect(page.locator('text=Site super-admin credentials. Not for hospital staff.')).toBeVisible();

    // Submit button (matched by role so it does not collide with the card title
    // that repeats the same words)
    await expect(page.getByRole('button', { name: 'Authenticate Master Session' })).toBeVisible();

    // Audit advisory
    await expect(page.locator('text=cryptographically signed')).toBeVisible();

    // Cross-portal links. The site-owner portal has no autofill control and no
    // dedicated "return" link; it offers the hospital portal and public sign-in.
    await expect(page.getByRole('link', { name: 'Hospital Admin Portal' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Public Sign In' })).toBeVisible();
  });

  test('has pre-filled demo credentials', async ({ page }) => {
    await page.goto('/auth/super-admin/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#admin-email')).toHaveValue('superadmin@smarthealth.com');
    await expect(page.locator('#admin-password')).toHaveValue('April--2024!!!!');
  });

  test('can toggle password visibility', async ({ page }) => {
    await page.goto('/auth/super-admin/login');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('#admin-password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.locator('button[aria-label="Toggle password"]').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.locator('button[aria-label="Toggle password"]').click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('does not expose a demo-credential autofill control', async ({ page }) => {
    await page.goto('/auth/super-admin/login');
    await page.waitForLoadState('networkidle');

    // The hospital portal's one-click autofill was removed; the site-owner
    // portal must not reintroduce an equivalent shortcut.
    await expect(page.getByRole('button', { name: /autofill/i })).toHaveCount(0);
  });
});

test.describe('Navigation between auth pages', () => {
  test('can navigate from login to register', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await page.locator('text=Register here').click();
    await expect(page).toHaveURL(/\/register|\/signup/);
    await expect(page.getByRole('heading', { name: 'Staff Registration' })).toBeVisible();
  });

  test('starts and cancels the MFA flow after clinician login', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await page.locator('#email').fill('doctor@smarthealth.com');
    await page.locator('#password').fill('Demo@135790');
    await page.locator('#login-submit-btn').click();

    await expect(page).toHaveURL('/auth/two-factor');
    await expect(page.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick Test: Fetch Current Demo TOTP Token' })).toBeVisible();
    await page.getByRole('link', { name: 'Cancel & Return to Login' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('can navigate from register back to login', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    await page.locator('text=Back to Sign In').click();
    await expect(page).toHaveURL('/auth/login');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('can navigate from the guarded two-factor page back to login', async ({ page }) => {
    await page.goto('/auth/two-factor');
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: 'Return to Login' }).click();
    await expect(page).toHaveURL('/auth/login');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('can navigate from super-admin back to public sign-in', async ({ page }) => {
    await page.goto('/auth/super-admin/login');
    await page.waitForLoadState('networkidle');

    // The site-owner portal offers a "Public Sign In" footer link (there is no
    // separate "return to standard staff login" control).
    await page.getByRole('link', { name: 'Public Sign In' }).click();
    await expect(page).toHaveURL('/auth/login');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });
});

test.describe('Responsive design', () => {
  test('login page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // Form should be visible
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#login-submit-btn')).toBeVisible();

    // Branding panel should be hidden on mobile
    await expect(page.locator('text=Secure, intelligent healthcare management.')).not.toBeVisible();
  });

  test('register page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    // Form should be visible
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('text=Complete Staff Registration')).toBeVisible();
  });

  test('two-factor recovery state is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/auth/two-factor');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'No Verification Session' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to Login' })).toBeVisible();
  });

  test('super-admin page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/auth/super-admin/login');
    await page.waitForLoadState('networkidle');

    // Form should be visible
    await expect(page.locator('#admin-email')).toBeVisible();
    await expect(page.locator('#admin-password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Authenticate Master Session' })).toBeVisible();
  });
});
