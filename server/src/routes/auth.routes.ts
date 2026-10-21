import { Router } from 'express';
import { authenticate, authenticatePendingMfa } from '../middleware/auth.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import * as authController from '../controllers/auth.controller.js';
import { meetsPasswordPolicy } from '../controllers/auth.controller.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Brute-force protection for login attempts.
//
// The limits are a security control and should not be weakened casually, but
// they are per-IP and the Playwright suite drives dozens of logins from one
// address in parallel. With no way to raise them the suite could not run at
// all: it hit 429 and every auth test failed for a reason unrelated to the
// code under test.
//
// Overridable by environment, defaulting to the secure value so production is
// unaffected. playwright.config.ts raises these for the test run only.
const loginLimitMax = parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '5', 10);
const twoFactorLimitMax = parseInt(process.env.TWO_FACTOR_RATE_LIMIT_MAX || '5', 10);

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: loginLimitMax,
  message: 'Too many login attempts from this IP, please try again after 5 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Brute-force protection for TOTP code guessing (6-digit space is small)
const twoFactorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: twoFactorLimitMax,
  message: 'Too many verification attempts from this IP, please try again after 5 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset endpoints.
//
// The reset link is a bearer credential, and the request that creates it
// sends mail: without a limiter the endpoint is both a mail-bomb vector and
// a way to probe which addresses are registered. The same limiter covers
// both endpoints of the flow, because a reset link is only useful together
// with a redemption attempt.
const passwordResetLimitMax = parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_MAX || '10', 10);
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: passwordResetLimitMax,
  message: 'Too many password reset requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/login',
  loginLimiter, // Apply brute-force protection
  [
    body('email').trim().isEmail().withMessage('Valid email is required').escape(),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],
  authController.login
);

// Registration is a public route, and it creates an account. Without a
// limiter of its own it inherits the broad per-address ceiling, which is
// high enough to sweep the address space of a clinic and create an account
// for every address found.
const registrationLimitMax = parseInt(process.env.REGISTRATION_RATE_LIMIT_MAX || '5', 10);
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: registrationLimitMax,
  message: 'Too many registration attempts from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/register',
  registrationLimiter,
  [
    body('email').trim().isEmail().withMessage('Valid email is required').escape(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Must include uppercase letter')
      .matches(/[a-z]/).withMessage('Must include lowercase letter')
      .matches(/[0-9]/).withMessage('Must include number')
      .matches(/[^A-Za-z0-9]/).withMessage('Must include special character'),
    body('name').trim().notEmpty().withMessage('Name is required').escape(),
    validate
  ],
  authController.register
);

router.post('/refresh', authController.refreshToken);

// Logout is authenticated: the token the caller presents is what gets
// revoked, so the request has to carry it.
router.post('/logout', authenticate, authController.logout);

router.post(
  '/forgot-password',
  passwordResetLimiter,
  [
    // Trimmed but not HTML-escaped: escaping would corrupt an address that
    // legitimately contains `&` and the lookup would then never match.
    body('email').trim().isEmail().withMessage('Valid email is required'),
    validate
  ],
  authController.forgotPassword
);

router.post(
  '/reset-password',
  passwordResetLimiter,
  [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    // The complexity rule lives in the controller so the route and the
    // controller can never disagree about it.
    body('password')
      .custom((value: unknown) => meetsPasswordPolicy(value))
      .withMessage('Password must be at least 8 characters and meet 3 of: uppercase, lowercase, number, special character'),
    validate
  ],
  authController.resetPassword
);

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').isLength({ min: 6 }).withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Must include uppercase letter')
      .matches(/[a-z]/).withMessage('Must include lowercase letter')
      .matches(/[0-9]/).withMessage('Must include number')
      .matches(/[^A-Za-z0-9]/).withMessage('Must include special character'),
    validate
  ],
  authController.changePassword
);

router.post(
  '/postpone-password-change',
  authenticate,
  [],
  authController.postponePasswordChange
);

router.post(
  '/verify-2fa',
  authenticatePendingMfa,
  twoFactorLimiter, // Apply brute-force protection
  [
    body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
    validate
  ],
  authController.verifyTwoFactor
);

// Verify a single-use offline recovery code (backup access when the
// authenticator app is lost). The code space is ~10^6 so it shares the 2FA
// brute-force limiter; a valid code is burned (removed) server-side.
router.post(
  '/verify-recovery',
  authenticatePendingMfa,
  twoFactorLimiter,
  [
    body('code').matches(/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/).withMessage('Recovery code must be in XXXXX-XXXXX format'),
    validate
  ],
  authController.verifyRecovery
);

// ── TOTP enrollment / rotation / disable ───────────────────────────────────
// Authenticated self-service endpoints. The code space is tiny (10^6) so all
// confirmation paths share the two-factor brute-force limiter.

// Generate a fresh secret for authenticator pairing. Stateless: nothing is
// persisted until /totp/confirm proves possession of the new key.
router.post('/totp/enroll', authenticate, twoFactorLimiter, authController.totpEnroll);

// Verify a code against a freshly generated secret and persist it, enabling
// 2FA (or rotating an existing secret).
router.post(
  '/totp/confirm',
  authenticate,
  twoFactorLimiter,
  [
    body('secret').isString().withMessage('Secret is required').isLength({ min: 16, max: 64 }).withMessage('Secret must be 16-64 characters'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
    validate
  ],
  authController.totpConfirm
);

// Verify a current code against the stored secret and remove it, disabling 2FA.
router.post(
  '/totp/disable',
  authenticate,
  twoFactorLimiter,
  [
    body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
    validate
  ],
  authController.totpDisable
);

router.get('/me', authenticate, authController.getMe);
router.get('/mfa-events', authenticate, authController.getMfaEvents);

export default router;