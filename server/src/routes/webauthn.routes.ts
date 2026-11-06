// server/src/routes/webauthn.routes.ts

import { Router } from 'express';
import { authenticate, authenticatePendingMfa } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import {
  registerOptions,
  registerVerify,
  loginOptions,
  loginVerify,
  listCredentials,
  deleteCredential
} from '../controllers/webauthn.controller.js';

const router = Router();

const challengeLimiter = rateLimit({
  windowMs: 5 * 60_000,
  max: 20,
  message: 'Too many WebAuthn challenge requests, please try again after 5 minutes',
  standardHeaders: true,
  legacyHeaders: false
});

const assertionLimiter = rateLimit({
  windowMs: 5 * 60_000,
  max: 10,
  message: 'Too many passkey verification attempts, please try again after 5 minutes',
  standardHeaders: true,
  legacyHeaders: false
});

// ── Passkey enrollment (authenticated: a full session token) ───────────────────
// The ceremony binds the credential to the account in the token, so a token
// that is still waiting for its second factor is not enough: enrolling a
// passkey is how a second factor is added, and it must not happen before the
// account holder has proved the one they already have.
router.post('/register/options', authenticate, challengeLimiter, registerOptions);
router.post('/register/verify',  authenticate, assertionLimiter, registerVerify);

// ── Passkey login (public for options; the assertion carries the temp token) ──
// The assertion is presented with the short-lived token that the password
// step issued, so this endpoint accepts a token that is still waiting for
// its second factor. It is the one endpoint that does.
router.post('/login/options', challengeLimiter, loginOptions);
router.post('/login/verify',  authenticatePendingMfa, assertionLimiter, loginVerify);

// ── Credential management (authenticated — full or temp JWT both work) ────────────────────────────
router.get('/credentials', authenticate, listCredentials);
router.delete('/credentials/:id', authenticate, deleteCredential);

export default router;