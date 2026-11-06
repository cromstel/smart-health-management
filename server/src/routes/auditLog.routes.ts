import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, enforcePasswordChange } from '../middleware/auth.js';
import * as auditLogController from '../controllers/auditLog.controller.js';

const router = Router();

router.use(authenticate);
router.use(enforcePasswordChange);

/**
 * Strips control characters from free text without HTML-escaping it.
 *
 * The audit trail stores what the user did; escaping it here would corrupt
 * the record ("AT&T" would be stored as "AT&amp;T"). React escapes on
 * render, so the stored text is safe to display.
 *
 * The characters are removed by code point rather than with a regular
 * expression, so the intent is explicit.
 */
const sanitizeAuditText = (value: string): string => {
  let result = '';

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 127) continue;
    if (code < 32) continue;
    result += character;
  }

  return result.trim();
};

/**
 * The audit trail for ordinary users.
 *
 * Authentication is the only gate here: the controller decides the scope --
 * platform administrators read the whole trail, everyone else reads their own
 * actions. That is the same trail the super-admin endpoint reads, served by
 * the same service.
 */
router.get(
  '/',
  query('limit')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 500 })
    .withMessage('limit must be an integer between 1 and 500')
    .toInt(),
  query('offset').optional({ nullable: true }).isInt({ min: 0 }).withMessage('offset must be a positive integer').toInt(),
  query('userId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('userId must be a positive integer').toInt(),
  query('module').optional({ nullable: true }).isString().withMessage('module must be a string').bail().trim().isLength({ max: 50 }),
  query('action').optional({ nullable: true }).isString().withMessage('action must be a string').bail().trim().isLength({ max: 100 }),
  query('search').optional({ nullable: true }).isString().withMessage('search must be a string').bail().trim().isLength({ max: 100 }),
  query('from').optional({ nullable: true }).isString().withMessage('from must be a date string').bail().trim().isLength({ max: 40 }),
  query('to').optional({ nullable: true }).isString().withMessage('to must be a date string').bail().trim().isLength({ max: 40 }),
  // The rules above sanitise the input. The shared `validate` middleware is
  // what turns a failed rule into a 400 instead of letting the request
  // through with a broken value.
  validate,
  auditLogController.getAuditLogs
);

/**
 * Counts per day, for the operations chart.
 */
router.get(
  '/summary',
  query('range')
    .optional({ nullable: true })
    .isIn(['7d', '14d', '30d'])
    .withMessage('range must be one of 7d, 14d or 30d'),
  validate,
  auditLogController.getAuditLogSummary
);

/**
 * The most recent entries.
 */
router.get(
  '/recent',
  query('limit')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100')
    .toInt(),
  validate,
  auditLogController.getRecentAuditLogs
);

/**
 * The audit report schedule configuration, stored in the settings table.
 */
router.get('/report-schedule', auditLogController.getAuditReportSchedule);

router.put(
  '/report-schedule',
  body('enabled').optional().isBoolean().withMessage('enabled must be a boolean').toBoolean(),
  body('emails')
    .optional()
    .isString()
    .withMessage('emails must be a string')
    .bail()
    .customSanitizer(sanitizeAuditText)
    .isLength({ max: 500 })
    .withMessage('emails must be 500 characters or fewer'),
  body('frequency')
    .optional()
    .isString()
    .withMessage('frequency must be a string')
    .bail()
    .customSanitizer(sanitizeAuditText)
    .isLength({ max: 50 })
    .withMessage('frequency must be 50 characters or fewer'),
  body('format')
    .optional()
    .isString()
    .withMessage('format must be a string')
    .bail()
    .customSanitizer(sanitizeAuditText)
    .isLength({ max: 50 })
    .withMessage('format must be 50 characters or fewer'),
  body('modules')
    .optional()
    .isArray({ max: 50 })
    .withMessage('modules must be an array of at most 50 entries')
    .bail()
    .custom((value: unknown[]) => value.every((m) => typeof m === 'string'))
    .withMessage('modules must contain only strings'),
  validate,
  auditLogController.updateAuditReportSchedule
);

/**
 * Writes one entry into the trail.
 *
 * The actor, the display name, the timestamp and the request metadata come
 * from the server. Only the action, the module and the values are supplied
 * by the client.
 */
router.post(
  '/',
  body('action')
    .isString()
    .withMessage('action must be a string')
    .bail()
    .customSanitizer(sanitizeAuditText)
    .isLength({ min: 1, max: 100 })
    .withMessage('action must be between 1 and 100 characters'),
  body('module')
    .isString()
    .withMessage('module must be a string')
    .bail()
    .customSanitizer(sanitizeAuditText)
    .isLength({ min: 1, max: 50 })
    .withMessage('module must be between 1 and 50 characters'),
  body('recordId')
    .optional({ nullable: true })
    .custom((value) => typeof value === 'string' || typeof value === 'number')
    .withMessage('recordId must be a string or a number')
    .bail()
    .customSanitizer((value) => String(value).trim())
    .isLength({ max: 64 })
    .withMessage('recordId must be 64 characters or fewer'),
  body('oldValue')
    .optional({ nullable: true })
    .custom(
      (value) =>
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        (typeof value === 'object' && value !== null)
    )
    .withMessage('oldValue must be a string, number, boolean or object'),
  body('newValue')
    .optional({ nullable: true })
    .custom(
      (value) =>
        value === null ||
        value === undefined ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        (typeof value === 'object' && value !== null)
    )
    .withMessage('newValue must be a string, number, boolean or object'),
  body('details')
    .optional({ nullable: true })
    .custom((value) => typeof value === 'object' && value !== null && !Array.isArray(value))
    .withMessage('details must be an object'),
  validate,
  auditLogController.createAuditLog
);

export default router;
