import { test, expect, type Page } from '@playwright/test';
import { backendReachable, DB_SKIP_MESSAGE } from '@/e2e/helpers/backend';

/**
 * Route-level checks.
 *
 * There is no mock API any more: every mode talks to the real API at
 * VITE_API_URL. That splits the suite cleanly.
 *
 * The public block only drives the dev server, so it always runs and is what CI
 * gates on. The blocks that sign in -- clinician, super-admin, and the
 * authenticated half of the scroll-to-top boundary -- assert on data that only
 * the real API plus a seeded MySQL provide, so they are tagged `@db` and skip
 * themselves when the API is not running. Without that guard they report a wall
 * of failed logins, which reads like a product regression and is not one.
 * See src/e2e/helpers/backend.ts.
 */

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
  await page.goto('/auth/login');
  await page.locator('#email').fill('admin@smarthealth.com');
  await page.locator('#password').fill('Pass@135709');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

async function signInAsSuperAdmin(page: Page) {
  await page.goto('/auth/super-admin/login');
  await page.locator('#admin-email').fill('superadmin@smarthealth.com');
  await page.locator('#admin-password').fill('April--2024!!!!');
  await page.getByRole('button', { name: 'Authenticate', exact: true }).click();
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

  /**
   * The overflow assertions above never open the menu, so they cannot tell a
   * working trigger from a dead one. That gap is how the tablet-width header
   * shipped: the full navigation no longer fit at 768px and was moved to 1024px,
   * but the panel it toggles kept the old breakpoint, so between the two widths
   * the trigger was visible and did nothing when pressed.
   *
   * The range between the two breakpoints is the whole point, so it is checked
   * explicitly rather than inferred from the absence of overflow.
   */
  for (const width of [768, 1023]) {
    test(`header menu opens at ${width}px, between the compact and full breakpoints`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      // Scoped to the banner: the footer carries its own Contact and Sign In
      // links, so an unscoped name resolves to both.
      const banner = page.getByRole('banner');
      const trigger = banner.getByRole('button', { name: 'Open menu' });
      await expect(trigger).toBeVisible();
      await trigger.click();

      // The panel has to actually appear, and carry the navigation. Destinations
      // are matched by href rather than by label: the wording is a visual choice
      // ("Sign In", "LOGIN", ...) that should not decide whether this passes.
      // `:visible` matters because the collapsed desktop nav keeps the same
      // destinations in the DOM.
      await expect(banner.getByRole('link', { name: 'Contact', exact: true })).toBeVisible();
      await expect(banner.locator('a[href="/auth/login"]:visible')).toHaveCount(1);
      await expect(banner.locator('a[href="/auth/signup"]:visible')).toHaveCount(1);
      await expectNoHorizontalOverflow(page);

      await banner.getByRole('button', { name: 'Close menu' }).click();
      await expect(banner.getByRole('link', { name: 'Contact', exact: true })).toHaveCount(0);
      await expect(banner.locator('a[href="/auth/login"]:visible')).toHaveCount(0);
    });
  }

  // Submitting the form POSTs to the API, so this needs the backend running.
  // There is no mock to absorb it any more, which makes it `@db` by the same
  // criterion as the sign-in specs: it cannot pass without the real API.
  test('request-demo form submits through the local API', { tag: '@db' }, async ({ page }) => {
    await page.goto('/request-demo');
    await page.locator('#demo-name').fill('Avery Doe');
    await page.locator('#demo-email').fill('avery@example.org');
    await page.locator('#demo-organization').fill('Northwind Hospital');
    await page.locator('#demo-role').fill('Clinical Director');
    await page.locator('#demo-organization-size').selectOption('51-200');
    await page.getByRole('button', { name: 'SEND REQUEST' }).click();
    await expect(page.getByRole('heading', { name: 'Your request is on its way.' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  /**
   * A password-reset email already in someone's inbox points at
   * `/reset-password?token=...`. The auth surfaces moved under `/auth`, and a
   * redirect that carried only the pathname sent that link to the catch-all,
   * which dropped the token: the user landed on the public site with no error,
   * and the token is single-use. The compatibility redirect has to carry the
   * query string across, so this asserts the token survives the hop.
   */
  test('legacy auth paths redirect and keep their query string', async ({ page }) => {
    await page.goto('/reset-password?token=a-real-looking-token&source=email');
    await expect(page).toHaveURL(/\/auth\/reset-password\?/);
    await expect(page).toHaveURL(/token=a-real-looking-token/);
    await expect(page).toHaveURL(/source=email/);

    // And the page it lands on is the reset form, not the public site.
    await expect(page.getByRole('heading', { name: 'Set New Password' })).toBeVisible();
  });

  test('a landing-page section link works from another page', async ({ page }) => {
    // Header and footer link to landing sections from the company pages. Those
    // are client-side navigations, which do not move the viewport the way a real
    // page load does, so the URL could change while the visitor stayed at the
    // previous offset.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/contact-us');
    await expect(page.getByRole('heading', { name: /better care/i })).toBeVisible();

    await page.getByRole('banner').getByRole('link', { name: 'How It Works' }).click();
    await expect(page).toHaveURL(/#how-it-works$/);

    // The landing route is lazy, so the target appears after navigation and the
    // scroll follows it. Poll rather than sampling once.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const target = document.getElementById('how-it-works');
            return target ? Math.abs(target.getBoundingClientRect().top) : null;
          }),
        { timeout: 10_000 },
      )
      .toBeLessThan(200);
  });

  test('scroll-to-top control appears on public pages and returns the visitor to the top', async ({ page }) => {
    const scrollToTop = page.getByRole('button', { name: 'Scroll to top' });
    await page.goto('/faq');
    await expect(page.getByRole('heading', { name: 'Questions, answered with care.' })).toBeVisible();

    // Nothing to offer until there is somewhere to scroll back to.
    await expect(scrollToTop).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(scrollToTop).toBeVisible();

    await scrollToTop.click();

    // The scroll is animated, so poll for the resting position.
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBe(0);
    await expect(scrollToTop).toBeHidden();
  });

  test('password recovery, reset and invalid shared-summary states are clear', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page.getByRole('heading', { name: 'Password Recovery' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/auth/reset-password');
    await expect(page.getByRole('heading', { name: 'Set New Password' })).toBeVisible();
    await expect(page.getByText('No active password reset token was detected in your browser URL.')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/shared/patient-summary/not-a-valid-token');
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Access Portal Login' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

// The control is withdrawn on sign-in, so this half of the boundary needs a
// real session: a real credential check against the API and a seeded account.
test.describe('Scroll-to-top visibility boundary', { tag: '@db' }, () => {
  test('the control is absent once a session is authenticated', async ({ page }) => {
    // The seeded administrator has no two-factor enrolment, so this signs in
    // through the real form. The old clinician helper cannot be reused: it
    // depends on the dev-only "fetch current demo TOTP" affordance that was
    // deliberately removed from sign-in surfaces.
    await page.goto('/auth/login');
    await page.locator('#email').fill('admin@smarthealth.com');
    await page.locator('#password').fill('Pass@135709');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30000 });

    await page.goto('/patients');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByRole('button', { name: 'Scroll to top' })).toHaveCount(0);
  });
});

test.describe('Clinician route smoke checks', { tag: '@db' }, () => {
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

test.describe('Super-admin route smoke checks', { tag: '@db' }, () => {
  test.beforeEach(async () => {
    test.skip(!(await backendReachable()), DB_SKIP_MESSAGE);
  });

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
