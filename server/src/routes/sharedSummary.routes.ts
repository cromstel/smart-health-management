import { Router } from 'express';
import { body, query } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { authenticate, enforcePasswordChange, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import * as sharedSummaryController from '../controllers/sharedSummary.controller.js';

const router = Router();

/**
 * Brute-force guard for the public read. The token has 256 bits of entropy,
 * so this only exists to keep a single host from hammering the lookup.
 */
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many shared summary requests from this IP, please try again later',
});

/**
 * Generating a link discloses the patient summary to an anonymous holder of
 * the link, so it is gated on the same patient-view permission the rest of
 * the clinical read surface uses.
 */
router.post(
  '/patient-summary/generate',
  authenticate,
  enforcePasswordChange,
  requirePermission('patients', 'view'),
  body('patientId')
    .isString()
    .withMessage('patientId is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('patientId must be between 1 and 64 characters'),
  body('patientName').optional({ nullable: true }).isString().withMessage('patientName must be a string').bail().trim().isLength({ max: 255 }),
  validate,
  sharedSummaryController.generateSharedSummary
);

/**
 * Public read. Deliberately unauthenticated: the recipient of a shared
 * summary is not a platform user. The token is the credential and it is
 * single-purpose and time limited.
 */
router.get(
  '/patient-summary',
  publicReadLimiter,
  query('token')
    .isString()
    .withMessage('A share token is required')
    .bail()
    .trim()
    .isLength({ min: 20, max: 64 })
    .withMessage('Invalid share token')
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('Invalid share token'),
  validate,
  sharedSummaryController.getSharedSummary
);

export default router;
