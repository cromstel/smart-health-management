import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as controller from '../controllers/dispensingEvent.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

/**
 * The router answers on two prefixes.
 *
 * Mounted as `app.use('/api/dispensing-events', router)` the empty prefix is
 * the one in use, giving `/api/dispensing-events/...`. The second prefix
 * keeps the same URLs working when the router is mounted at `/api`.
 */
const PREFIXES = ['', '/dispensing-events'] as const;

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

/** `dispensing_events.id` is BIGINT UNSIGNED AUTO_INCREMENT. */
const idParam = () =>
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid dispensing event id')
    .toInt();

const dateBoundary = (field: 'from' | 'to') =>
  query(field)
    .optional()
    .custom((value: unknown) => {
      if (typeof value !== 'string' || value.trim() === '') return false;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
      return !Number.isNaN(new Date(value).getTime());
    })
    .withMessage(`${field} must be a valid date`);

register(
  'get',
  '/',
  requirePermission('pharmacy', 'view'),
  [
    query('patientId').optional().isInt({ min: 1 }).withMessage('Invalid patient id'),
    query('medicineId')
      .optional()
      .isLength({ min: 1, max: 64 })
      .withMessage('Invalid medicine id'),
    dateBoundary('from'),
    dateBoundary('to'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Invalid limit'),
    validate,
  ],
  controller.listEvents
);

register('get', '/:id', requirePermission('pharmacy', 'view'), [idParam(), validate], controller.getEvent);

register(
  'post',
  '/',
  requirePermission('pharmacy', 'add'),
  [
    body('prescriptionId')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 64 })
      .withMessage('Invalid prescription id')
      .escape(),
    body('patientId')
      .isInt({ min: 1 })
      .withMessage('A valid patient id is required')
      .toInt(),
    body('medicineId')
      .isLength({ min: 1, max: 64 })
      .withMessage('Invalid medicine id')
      .matches(/^[A-Za-z0-9_-]+$/)
      .withMessage('Invalid medicine id'),
    body('quantity')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer')
      .toInt(),
    body('notes')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Notes must be at most 2000 characters')
      .escape(),
    body('dispensedAt')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('dispensedAt must be a valid ISO 8601 date'),
    validate,
  ],
  controller.createEvent
);

register(
  'delete',
  '/:id',
  requirePermission('pharmacy', 'delete'),
  [idParam(), validate],
  controller.removeEvent
);

export default router;
