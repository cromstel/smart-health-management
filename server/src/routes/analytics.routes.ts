import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import * as analyticsController from '../controllers/analytics.controller.js';

const router = Router();

/**
 * Analytics beacon.
 *
 * Deliberately unauthenticated: the browser tracker does not attach a bearer
 * token, and the event is anonymous unless a valid token happens to be
 * present. The path is on the CSRF exemption list in middleware/csrf.ts.
 */
router.post(
  '/event',
  body('type')
    .isString()
    .withMessage('type is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('type must be between 1 and 100 characters'),
  body('id').optional({ nullable: true }).isString().withMessage('id must be a string').bail().isLength({ max: 100 }),
  body('timestamp').optional({ nullable: true }).isInt({ min: 0 }).withMessage('timestamp must be an epoch milliseconds integer').toInt(),
  body('sessionId').optional({ nullable: true }).isString().withMessage('sessionId must be a string').bail().isLength({ max: 100 }),
  body('pageUrl').optional({ nullable: true }).isString().withMessage('pageUrl must be a string').bail().isLength({ max: 500 }),
  body('payload').optional({ nullable: true }).isObject().withMessage('payload must be an object'),
  validate,
  analyticsController.recordEvent
);

export default router;
