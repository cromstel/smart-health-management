import { Router } from 'express';
import { body } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { validate } from '../middleware/validator.js';
import { onboardHospital } from '../controllers/onboard.controller.js';

const router = Router();

/**
 * Public onboarding: deliberately unauthenticated, because a prospective
 * hospital has no account yet. What it creates is inactive until a super
 * administrator confirms it, so reaching this endpoint cannot produce a
 * live tenant — and it is rate-limited all the same, because it writes rows.
 */
const onboardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions from this address. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/',
  onboardLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 255 }).withMessage('A hospital name is required'),
    body('subdomain')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('A subdomain of 2-100 characters is required')
      .matches(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/)
      .withMessage('A subdomain may only contain letters, numbers and hyphens'),
    body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('A valid contact email is required'),
    body('address').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
    body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
    validate,
  ],
  onboardHospital
);

export default router;
