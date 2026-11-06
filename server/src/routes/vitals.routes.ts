import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, enforcePasswordChange, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import * as vitalsController from '../controllers/vitals.controller.js';

const router = Router();

router.use(authenticate);
router.use(enforcePasswordChange);

// A client supplied `status` is deliberately not accepted: the server derives
// the clinical status from the measurements and stores that.
const readingValidators = [
  body('patientId')
    .isString()
    .withMessage('patientId is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('patientId must be between 1 and 64 characters'),
  body('patientName').optional({ nullable: true }).isString().withMessage('patientName must be a string').bail().trim().isLength({ max: 255 }),
  body('recordedAt').optional({ nullable: true }).isString().withMessage('recordedAt must be a string').bail().trim().isLength({ max: 40 }),
  body('recordedBy').optional({ nullable: true }).isString().withMessage('recordedBy must be a string').bail().trim().isLength({ max: 255 }),
  body('systolicBp')
    .isInt({ min: 40, max: 300 })
    .withMessage('systolicBp must be an integer between 40 and 300 mmHg')
    .toInt(),
  body('diastolicBp')
    .isInt({ min: 20, max: 200 })
    .withMessage('diastolicBp must be an integer between 20 and 200 mmHg')
    .toInt(),
  body('heartRate')
    .isInt({ min: 20, max: 250 })
    .withMessage('heartRate must be an integer between 20 and 250 bpm')
    .toInt(),
  body('temperature')
    .isFloat({ min: 25, max: 45 })
    .withMessage('temperature must be a number between 25 and 45 degrees Celsius')
    .toFloat(),
  body('respiratoryRate')
    .optional({ nullable: true })
    .isInt({ min: 4, max: 80 })
    .withMessage('respiratoryRate must be an integer between 4 and 80 breaths per minute')
    .toInt(),
  body('oxygenSaturation')
    .optional({ nullable: true })
    .isFloat({ min: 50, max: 100 })
    .withMessage('oxygenSaturation must be a number between 50 and 100 percent')
    .toFloat(),
  body('notes')
    .optional({ nullable: true })
    .isString()
    .withMessage('notes must be a string')
    .bail()
    .isLength({ max: 2000 })
    .withMessage('notes must be at most 2000 characters'),
];

const updateValidators = [
  body('recordedAt').optional({ nullable: true }).isString().withMessage('recordedAt must be a string').bail().trim().isLength({ max: 40 }),
  body('recordedBy').optional({ nullable: true }).isString().withMessage('recordedBy must be a string').bail().trim().isLength({ max: 255 }),
  body('systolicBp').optional({ nullable: true }).isInt({ min: 40, max: 300 }).withMessage('systolicBp must be an integer between 40 and 300 mmHg').toInt(),
  body('diastolicBp').optional({ nullable: true }).isInt({ min: 20, max: 200 }).withMessage('diastolicBp must be an integer between 20 and 200 mmHg').toInt(),
  body('heartRate').optional({ nullable: true }).isInt({ min: 20, max: 250 }).withMessage('heartRate must be an integer between 20 and 250 bpm').toInt(),
  body('temperature').optional({ nullable: true }).isFloat({ min: 25, max: 45 }).withMessage('temperature must be a number between 25 and 45 degrees Celsius').toFloat(),
  body('respiratoryRate').optional({ nullable: true }).isInt({ min: 4, max: 80 }).withMessage('respiratoryRate must be an integer between 4 and 80 breaths per minute').toInt(),
  body('oxygenSaturation').optional({ nullable: true }).isFloat({ min: 50, max: 100 }).withMessage('oxygenSaturation must be a number between 50 and 100 percent').toFloat(),
  body('notes').optional({ nullable: true }).isString().withMessage('notes must be a string').bail().isLength({ max: 2000 }).withMessage('notes must be at most 2000 characters'),
];

// /alerts is registered before /:patientId so the literal segment wins.
router.get(
  '/alerts',
  requirePermission('patients', 'view'),
  vitalsController.getAllAlerts
);

router.get(
  '/',
  requirePermission('patients', 'view'),
  query('patientId').optional({ nullable: true }).isString().withMessage('patientId must be a string').bail().trim().isLength({ max: 64 }),
  query('from').optional({ nullable: true }).isString().withMessage('from must be a date string').bail().trim().isLength({ max: 40 }),
  query('to').optional({ nullable: true }).isString().withMessage('to must be a date string').bail().trim().isLength({ max: 40 }),
  query('limit').optional({ nullable: true }).isInt({ min: 1, max: 1000 }).withMessage('limit must be an integer between 1 and 1000').toInt(),
  validate,
  vitalsController.getVitals
);

router.get(
  '/:patientId',
  requirePermission('patients', 'view'),
  param('patientId').isString().withMessage('patientId is required').bail().trim().isLength({ min: 1, max: 64 }),
  validate,
  vitalsController.getVitals
);

router.get(
  '/:patientId/summary',
  requirePermission('patients', 'view'),
  param('patientId').isString().withMessage('patientId is required').bail().trim().isLength({ min: 1, max: 64 }),
  validate,
  vitalsController.getVitalsSummary
);

router.get(
  '/:patientId/alerts',
  requirePermission('patients', 'view'),
  param('patientId').isString().withMessage('patientId is required').bail().trim().isLength({ min: 1, max: 64 }),
  validate,
  vitalsController.getPatientAlerts
);

router.post(
  '/',
  requirePermission('patients', 'add'),
  readingValidators,
  validate,
  vitalsController.createVital
);

router.put(
  '/:id',
  requirePermission('patients', 'edit'),
  param('id').isInt({ min: 1 }).withMessage('Invalid vitals id').toInt(),
  updateValidators,
  validate,
  vitalsController.updateVital
);

router.delete(
  '/:id',
  requirePermission('patients', 'delete'),
  param('id').isInt({ min: 1 }).withMessage('Invalid vitals id').toInt(),
  validate,
  vitalsController.deleteVital
);

export default router;
