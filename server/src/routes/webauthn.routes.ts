// server/src/routes/webauthn.routes.ts

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
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

// ── Passkey enrollment (authenticated: mfa_pending tempToken via `authenticate`) ──────────────────
router.post('/register/options', authenticate, challengeLimiter, registerOptions);
router.post('/register/verify',  authenticate, assertionLimiter, registerVerify);

// ── Passkey login (public for options; authenticated for assertion — the JWT is a temp mfa_pending token) ──
router.post('/login/options', challengeLimiter, loginOptions);
router.post('/login/verify',  authenticate, assertionLimiter, loginVerify);

// ── Credential management (authenticated — full or temp JWT both work) ────────────────────────────
router.get('/credentials', authenticate, listCredentials);
router.delete('/credentials/:id', authenticate, deleteCredential);

export default router;