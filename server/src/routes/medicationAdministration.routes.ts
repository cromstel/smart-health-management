import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as controller from '../controllers/medicationAdministration.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

/**
 * The router answers on two prefixes.
 *
 * Mounted as `app.use('/api/medication-administrations', router)` the empty
 * prefix is the one in use, giving `/api/medication-administrations/...`.
 * The second prefix keeps the same URLs working when the router is mounted
 * at `/api` instead, so the module can be registered either way.
 */
const PREFIXES = ['', '/medication-administrations'] as const;

type RouteMethod = 'get' | 'post' | 'patch' | 'delete';

const register = (
  method: RouteMethod,
  path: string,
  ...handlers: any[]
): void => {
  for (const prefix of PREFIXES) {
    (router[method] as (...args: any[]) => unknown)(`${prefix}${path}`, ...handlers);
  }
};

/** `medication_administrations.id` is BIGINT UNSIGNED AUTO_INCREMENT. */
const idParam = () =>
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid medication administration id')
    .toInt();

/** `medicines_inventory.id` is a VARCHAR(64) uuid-like key. */
const medicineIdBody = () =>
  body('medicineId')
    .isLength({ min: 1, max: 64 })
    .withMessage('Invalid medicine id')
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('Invalid medicine id');

const statusBody = () =>
  body('status')
    .optional({ values: 'falsy' })
    .isIn(['pending', 'administered', 'overdue', 'missed'])
    .withMessage('Invalid status');

/* ------------------------------------------------------------------ read */

register(
  'get',
  '/',
  requirePermission('pharmacy', 'view'),
  [
    query('patientId').optional().isInt({ min: 1 }).withMessage('Invalid patient id'),
    query('status')
      .optional()
      .isIn(['pending', 'administered', 'overdue', 'missed'])
      .withMessage('Invalid status'),
    query('date')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Date must be in YYYY-MM-DD format'),
    query('assignedStaffId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Invalid staff id'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Invalid limit'),
    validate,
  ],
  controller.listAdministrations
);

// Registered before `/:id` so the literal path is not captured as an id.
register('get', '/options', requirePermission('pharmacy', 'view'), controller.listOptions);

register('get', '/:id', requirePermission('pharmacy', 'view'), [idParam(), validate], controller.getAdministration);

/* ----------------------------------------------------------------- write */

register(
  'post',
  '/',
  requirePermission('pharmacy', 'add'),
  [
    body('patientId')
      .isInt({ min: 1 })
      .withMessage('A valid patient id is required')
      .toInt(),
    medicineIdBody(),
    body('dosage')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Dosage is required')
      .escape(),
    body('scheduledTime')
      .isISO8601()
      .withMessage('scheduledTime must be a valid ISO 8601 date'),
    body('assignedStaffId')
      .optional({ values: 'falsy' })
      .isInt({ min: 1 })
      .withMessage('Invalid staff id')
      .toInt(),
    body('criticalNotes')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Critical notes must be at most 2000 characters')
      .escape(),
    validate,
  ],
  controller.createAdministration
);

register(
  'patch',
  '/:id/sign-off',
  requirePermission('pharmacy', 'edit'),
  [
    idParam(),
    body('quantity')
      .optional({ values: 'falsy' })
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer')
      .toInt(),
    validate,
  ],
  controller.signOffAdministration
);

register(
  'patch',
  '/:id',
  requirePermission('pharmacy', 'edit'),
  [
    idParam(),
    statusBody(),
    body('criticalNotes')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Critical notes must be at most 2000 characters')
      .escape(),
    body('assignedStaffId')
      .optional({ values: 'falsy' })
      .isInt({ min: 1 })
      .withMessage('Invalid staff id')
      .toInt(),
    body('dosage')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Invalid dosage')
      .escape(),
    body('scheduledTime')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('scheduledTime must be a valid ISO 8601 date'),
    validate,
  ],
  controller.updateAdministration
);

register(
  'delete',
  '/:id',
  requirePermission('pharmacy', 'delete'),
  [idParam(), validate],
  controller.removeAdministration
);

export default router;
