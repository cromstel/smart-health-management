import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import * as authController from '../controllers/auth.controller.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Brute-force protection for login attempts
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 5 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Brute-force protection for TOTP code guessing (6-digit space is small)
const twoFactorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 TOTP attempts per windowMs
  message: 'Too many verification attempts from this IP, please try again after 5 minutes',
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

router.post(
  '/register',
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
router.post('/logout', authController.logout);

router.post(
  '/forgot-password',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    validate
  ],
  authController.forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
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
  authenticate,
  twoFactorLimiter, // Apply brute-force protection
  [
    body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
    validate
  ],
  authController.verifyTwoFactor
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

// DEV-ONLY: current demo TOTP code for the auto-fill buttons. Never exposed
// in production.
if (process.env.NODE_ENV !== 'production') {
  router.get('/dev-totp-current', authController.devCurrentTotp);
}

router.get('/me', authenticate, authController.getMe);

export default router;