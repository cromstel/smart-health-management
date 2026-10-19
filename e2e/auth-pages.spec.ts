import { test, expect, type Page } from '@playwright/test';

test.describe('Login Page', () => {
  test('loads and displays all form elements', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // Brand header. The shared Logo renders as role="img" with an accessible
    // name, not a text heading, so assert the accessible name instead.
    await expect(page.getByRole('img', { name: 'Smart MediCare' })).toBeVisible();

    // Page title and subtitle
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.locator('text=Sign in to your clinical portal')).toBeVisible();

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

  /**
   * The marketing side panel was dropped from every authentication surface:
   * LoginPage, RegisterPage, TwoFactorPage and SuperAdminLogin all render
   * `<AuthLayout showBranding={false}>`, so the panel's feature list never
   * reaches the DOM. The photograph spans the whole layout instead.
   *
   * This asserts the absence deliberately. Asserting the panel is *present*
   * was the old contract, and it silently rotted when the panel was removed --
   * the string assertions in it kept passing on the pages that do still use
   * AuthLayout, so nothing flagged the removal on the login page itself.
   */
  test('renders the form without a marketing side panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Secure, intelligent healthcare management.')).toHaveCount(0);
    await expect(page.getByText('Enterprise Security', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Real-time Monitoring', { exact: true })).toHaveCount(0);

    // The credential form still owns the viewport at desktop width.
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#login-submit-btn')).toBeVisible();
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

/**
 * Registration is a three-step wizard (identity -> organization -> account
 * security). Fields belonging to a later step are not in the DOM until the
 * earlier step validates, so these tests walk the steps they need.
 *
 * Field labels are intentionally hidden visually and carried by the
 * placeholders, so the accessible name must come from the visually hidden
 * <label> -- those pairings are asserted explicitly below.
 */
test.describe('Register Page', () => {
  const openRegister = async (page: Page) => {
    // /register is not a route (it falls through to the catch-all redirect),
    // so the wizard lives at /auth/signup — the path the app links to.
    await page.goto('/auth/signup');
    await page.waitForLoadState('networkidle');
  };

  const fillIdentity = async (page: Page, confirmEmail = 'k.mensah@smarthealth.com') => {
    await page.locator('#firstName').fill('Kwame');
    await page.locator('#lastName').fill('Mensah');
    await page.locator('#email').fill('k.mensah@smarthealth.com');
    await page.locator('#confirmEmail').fill(confirmEmail);
  };

  const proceedToOrganization = async (page: Page) => {
    await page.getByRole('button', { name: /proceed to organization/i }).click();
    await expect(page.locator('#role')).toBeVisible();
  };

  const proceedToSecurity = async (page: Page) => {
    await page.locator('#role').selectOption('Doctor');
    await page.locator('#hospital').selectOption('General Hospital');
    await page.locator('#department').selectOption('Cardiology');
    await page.getByRole('button', { name: /proceed to account security/i }).click();
    await expect(page.locator('#password')).toBeVisible();
  };

  const expectVisuallyHidden = async (locator: ReturnType<Page['locator']>) => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(1);
    expect(box!.height).toBeLessThanOrEqual(1);
  };

  test('rejects a name that is only whitespace', async ({ page }) => {
    await openRegister(page);

    // Two spaces satisfy a bare `min(2)`, and the submitted name is built as
    // `${first} ${last}`.trim()` -- so without trimming, the API could be handed
    // an empty name for a record that then displays as blank.
    await page.locator('#firstName').fill('   ');
    await page.locator('#lastName').fill('   ');
    await page.locator('#email').fill('k.mensah@smarthealth.com');
    await page.locator('#confirmEmail').fill('k.mensah@smarthealth.com');

    await page.getByRole('button', { name: /proceed to organization/i }).click();

    await expect(page.locator('#firstName-error')).toBeVisible();
    await expect(page.getByText('First name must be at least 2 characters')).toBeVisible();
    // Still on the identity step: nothing was submitted.
    await expect(page.locator('#role')).toHaveCount(0);
  });

  test('announces the current step as text, not only as a percentage', async ({ page }) => {
    await openRegister(page);

    // aria-valuenow is 1-based, so assistive tech computes step one as 0%.
    // The accessible text is what makes it correct.
    const progress = page.getByRole('progressbar');
    await expect(progress).toHaveAttribute('aria-valuetext', 'Step 1 of 3');

    await fillIdentity(page);
    await proceedToOrganization(page);
    await proceedToSecurity(page);

    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Step 3 of 3');
  });

  test('step one splits the name, confirms the email and leans on placeholders', async ({ page }) => {
    await openRegister(page);

    // Brand mark and page framing
    await expect(page.locator('[aria-label="Smart MediCare"]').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Build your clinical workspace.' })).toBeVisible();
    await expect(page.locator('text=Set up a verified profile')).toBeVisible();
    await expect(page.locator('text=01 / 03')).toBeVisible();

    // Identity fields
    await expect(page.locator('#firstName')).toBeVisible();
    await expect(page.locator('#lastName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#confirmEmail')).toBeVisible();

    // The full name is collected as two fields sitting on one row ...
    const firstNameBox = await page.locator('#firstName').boundingBox();
    const lastNameBox = await page.locator('#lastName').boundingBox();
    expect(Math.abs(firstNameBox!.y - lastNameBox!.y)).toBeLessThan(2);
    expect(lastNameBox!.x).toBeGreaterThan(firstNameBox!.x);

    // ... and so are the email and its confirmation
    const emailBox = await page.locator('#email').boundingBox();
    const confirmEmailBox = await page.locator('#confirmEmail').boundingBox();
    expect(Math.abs(emailBox!.y - confirmEmailBox!.y)).toBeLessThan(2);
    expect(confirmEmailBox!.x).toBeGreaterThan(emailBox!.x);

    // Labels are visually hidden, but still name the field for assistive tech,
    // while the placeholder carries the visible cue.
    for (const [label, placeholder, id] of [
      ['First name', 'First name', 'firstName'],
      ['Last name', 'Last name', 'lastName'],
      ['Work email', 'Work email', 'email'],
      ['Confirm email', 'Confirm email', 'confirmEmail'],
    ] as const) {
      const field = page.getByLabel(label);
      await expect(field).toHaveCount(1);
      await expect(field).toHaveAttribute('placeholder', placeholder);
      await expect(field).toHaveAttribute('id', id);
      await expectVisuallyHidden(page.locator(`label[for="${id}"]`));
    }

    // Primary action and footer
    await expect(page.getByRole('button', { name: /proceed to organization/i })).toBeVisible();
    await expect(page.locator('text=Secure enrollment')).toBeVisible();
  });

  test('rejects an identity step submitted empty', async ({ page }) => {
    await openRegister(page);

    await page.getByRole('button', { name: /proceed to organization/i }).click();

    await expect(page.locator('#firstName-error')).toBeVisible();
    await expect(page.locator('#lastName-error')).toBeVisible();
    await expect(page.locator('#email-error')).toBeVisible();
    await expect(page.locator('#confirmEmail-error')).toBeVisible();
  });

  test('rejects a confirmation email that does not match', async ({ page }) => {
    await openRegister(page);
    await fillIdentity(page, 'someone.else@smarthealth.com');

    await page.getByRole('button', { name: /proceed to organization/i }).click();

    await expect(page.locator('#confirmEmail-error')).toHaveText(/do not match/i);
    // Still on step one
    await expect(page.locator('#firstName')).toBeVisible();
  });

  test('accepts a confirmation email that differs only in case', async ({ page }) => {
    await openRegister(page);
    await fillIdentity(page, 'K.Mensah@SmartHealth.com');

    await proceedToOrganization(page);

    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Your organization');
  });

  test('organization step requires a role, hospital and department', async ({ page }) => {
    await openRegister(page);
    await fillIdentity(page);
    await proceedToOrganization(page);

    await expect(page.locator('#hospital')).toBeVisible();
    await expect(page.locator('#department')).toBeVisible();

    // Each select opens on its own prompt rather than a real value
    await expect(page.locator('#role')).toHaveValue('');
    await expect(page.locator('#hospital')).toHaveValue('');
    await expect(page.locator('#department')).toHaveValue('');

    await page.getByRole('button', { name: /proceed to account security/i }).click();

    await expect(page.locator('#role-error')).toBeVisible();
    await expect(page.locator('#hospital-error')).toBeVisible();
    await expect(page.locator('#department-error')).toBeVisible();
  });

  test('shows the password strength meter once the security step is reached', async ({ page }) => {
    await openRegister(page);
    await fillIdentity(page);
    await proceedToOrganization(page);
    await proceedToSecurity(page);

    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Secure your account');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await expect(page.locator('#password')).toHaveAttribute('placeholder', 'Create password');
    await expect(page.locator('#confirmPassword')).toHaveAttribute('placeholder', 'Confirm password');

    await expect(page.locator('text=Password Complexity')).not.toBeVisible();
    await page.locator('#password').fill('abc');
    await expect(page.locator('text=Password Complexity')).toBeVisible();
    await expect(page.locator('text=Very Weak')).toBeVisible();

    await page.locator('#password').fill('Password123!');
    await expect(page.locator('text=Excellent')).toBeVisible();
  });

  test('can toggle password visibility', async ({ page }) => {
    await openRegister(page);
    await fillIdentity(page);
    await proceedToOrganization(page);
    await proceedToSecurity(page);

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.locator('button[aria-label="Show password"]').first().click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('can fill out the whole registration form', async ({ page }) => {
    await openRegister(page);
    await fillIdentity(page);
    await proceedToOrganization(page);
    await proceedToSecurity(page);

    await page.locator('#password').fill('SecurePass123!');
    await page.locator('#confirmPassword').fill('SecurePass123!');
    await page.locator('#terms').check();

    // The earlier steps are unmounted, and the final action is offered
    await expect(page.locator('#firstName')).not.toBeVisible();
    await expect(page.locator('#terms')).toBeChecked();
    await expect(page.getByRole('button', { name: /complete secure registration/i })).toBeVisible();
  });

  test('gives every control the same height and the same inner padding', async ({ page }) => {
    await openRegister(page);

    // The wizard mounts its first step after the route resolves, which is later
    // than `networkidle` -- measuring immediately found an empty document and
    // reported four of the nine controls as missing.
    await expect(page.locator('#firstName')).toBeVisible();

    // The wizard mounts one step at a time, so the boxes have to be collected
    // as the steps are walked.
    const measure = () =>
      page.evaluate(() =>
        ['firstName', 'lastName', 'email', 'confirmEmail', 'role', 'hospital', 'department', 'password', 'confirmPassword']
          .map((id) => document.getElementById(id))
          .filter((el): el is HTMLElement => el !== null)
          .map((el) => {
            const style = getComputedStyle(el);
            return {
              id: el.id,
              height: Math.round(el.getBoundingClientRect().height),
              paddingTop: style.paddingTop,
              paddingBottom: style.paddingBottom,
              paddingLeft: style.paddingLeft,
            };
          })
      );

    const boxes = [...(await measure())];
    await fillIdentity(page);
    await proceedToOrganization(page);
    boxes.push(...(await measure()));
    await proceedToSecurity(page);
    boxes.push(...(await measure()));

    // Every control was seen, once
    expect(boxes.map((box) => box.id)).toHaveLength(9);

    // Text inputs and dropdowns share one height and one inner padding
    for (const property of ['height', 'paddingTop', 'paddingBottom', 'paddingLeft'] as const) {
      expect(Array.from(new Set(boxes.map((box) => box[property])))).toHaveLength(1);
    }
  });

  test('aligns the acknowledgement sentence with its checkbox', async ({ page }) => {
    await openRegister(page);
    await fillIdentity(page);
    await proceedToOrganization(page);
    await proceedToSecurity(page);

    const termsLabel = page.locator('label[for="terms"]');

    // The sentence has to flow as running text. The Label primitive is a flex
    // box, which would otherwise split the sentence and its link into columns.
    expect(await termsLabel.evaluate((el) => getComputedStyle(el).display)).toBe('block');

    // A flex item would be blockified, so the inline link staying `inline`
    // proves the sentence wraps as one paragraph across the full width.
    const link = termsLabel.locator('span');
    expect(await link.evaluate((el) => getComputedStyle(el).display)).toBe('inline');

    // The paragraph stays within a few lines rather than being squeezed into a column
    const lineHeight = parseFloat(await termsLabel.evaluate((el) => getComputedStyle(el).lineHeight));
    const label = (await termsLabel.boundingBox())!;
    expect(label.height).toBeLessThanOrEqual(lineHeight * 3);

    const checkbox = (await page.locator('#terms').boundingBox())!;

    // The checkbox sits centred on the sentence's first line ...
    const centredOnFirstLine = (lineHeight - checkbox.height) / 2;
    expect(Math.abs(checkbox.y - label.y - centredOnFirstLine)).toBeLessThan(1);

    // ... and the text begins to its right, across the remaining width.
    expect(label.x).toBeGreaterThan(checkbox.x + checkbox.width);
    expect(label.width).toBeGreaterThan(checkbox.width * 5);
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
  /**
   * This portal keeps its own industrial identity: it does not go through
   * AuthLayout at all, so there is no marketing side panel and no
   * `showBranding` to pass. CardTitle renders a div (not a heading element),
   * so the title is matched by text rather than by heading role.
   */
  test('loads and displays all elements', async ({ page }) => {
    await page.goto('/auth/super-admin/login');
    await page.waitForLoadState('networkidle');

    // Shared wordmark. It renders as role="img" with an accessible name.
    await expect(page.getByRole('img', { name: 'Smart MediCare' })).toBeVisible();

    await expect(page.getByText('Welcome to Super Admin Portal', { exact: true })).toBeVisible();
    await expect(page.getByText('Central hospital management console', { exact: true })).toBeVisible();

    // Form fields. The labels are uppercase-styled but their accessible names
    // stay sentence case, so getByLabel matches the source text.
    await expect(page.locator('#admin-email')).toBeVisible();
    await expect(page.locator('#admin-password')).toBeVisible();
    await expect(page.getByLabel('Super Admin Email')).toBeVisible();
    await expect(page.getByLabel('Master Password')).toBeVisible();

    // Submit control.
    await expect(page.getByRole('button', { name: 'Authenticate', exact: true })).toBeVisible();

    // Attribution footer.
    await expect(page.getByLabel('System author CITGROUP')).toBeVisible();
    await expect(page.getByRole('link', { name: 'CITGROUP' })).toBeVisible();
  });

  test('does not expose pre-filled demo credentials', async ({ page }) => {
    await page.goto('/auth/super-admin/login');
    await page.waitForLoadState('networkidle');

    // The site-owner portal has no autofill shortcut; fields start empty.
    await expect(page.locator('#admin-email')).toHaveValue('');
    await expect(page.locator('#admin-password')).toHaveValue('');
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
    await expect(page.getByRole('heading', { name: /Build your clinical workspace/ })).toBeVisible();
  });

  /**
   * Signing in as the seeded clinician is a real credential check against the
   * API, so this is `@db`: there is no mock to answer the login, and the
   * two-factor prompt only appears for an account the database says is
   * enrolled.
   *
   * It stops at the challenge on purpose. Completing it would require a live
   * TOTP, and the dev-only "fetch current token" shortcut that used to supply
   * one has been removed rather than reinstated -- a shortcut that mints
   * authentication material must not come back as a test convenience.
   */
  test('starts and cancels the MFA flow after clinician login', { tag: '@db' }, async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    await page.locator('#email').fill('doctor@smarthealth.com');
    await page.locator('#password').fill('Demo@135790');
    await page.locator('#login-submit-btn').click();

    await expect(page).toHaveURL('/auth/two-factor');
    await expect(page.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeVisible();

    // The removed shortcut must stay removed.
    await expect(page.getByRole('button', { name: /Quick Test/i })).toHaveCount(0);

    await page.getByRole('link', { name: 'Cancel & Return to Login' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('can navigate from register back to login', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: 'Sign-in' }).click();
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

  /**
   * The site-owner portal is a standalone terminal. It deliberately offers no
   * cross-portal navigation -- no "Public Sign In", no "Hospital Admin Portal"
   * -- so an operator cannot walk from the master credential surface into a
   * staff or public session by following a link. The only link on the page is
   * the attribution link in the footer.
   */
  test('offers no cross-portal navigation', async ({ page }) => {
    await page.goto('/auth/super-admin/login');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: 'Public Sign In' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Hospital Admin Portal' })).toHaveCount(0);

    const hrefs = await page.locator('a[href^="/"]').evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLAnchorElement).getAttribute('href')),
    );
    expect(hrefs).toEqual([]);
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
    await page.goto('/auth/signup');
    await page.waitForLoadState('networkidle');

    // The identity fields stack and remain reachable
    await expect(page.locator('#firstName')).toBeVisible();
    await expect(page.locator('#lastName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#confirmEmail')).toBeVisible();
    await expect(page.getByRole('button', { name: /proceed to organization/i })).toBeVisible();

    // No horizontal overflow at mobile width
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
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
    await expect(page.getByRole('button', { name: 'Authenticate', exact: true })).toBeVisible();
  });
});
