import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, enforcePasswordChange, requirePermission } from '../middleware/auth.js';
import * as emergencyController from '../controllers/emergency.controller.js';

const router = Router();

router.use(authenticate);
router.use(enforcePasswordChange);

const TRIAGE_LEVELS = ['RED', 'AMBER', 'GREEN', 'YELLOW'];
const BED_STATUSES = ['occupied', 'available', 'cleaning'];

/** `emergency_beds.id` is a VARCHAR(32) key such as "ER-BAY-01". */
const bedIdParam = () =>
  param('id')
    .isString()
    .withMessage('Bed id is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 32 })
    .withMessage('Bed id must be between 1 and 32 characters')
    .bail()
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('Bed id may only contain letters, digits, dashes and underscores');

/** `emergency_admissions.id` is a BIGINT UNSIGNED auto-increment key. */
const admissionIdParam = () =>
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid admission id')
    .toInt();

/**
 * The board: the active admissions and the bed list in one response.
 */
router.get('/triage-board', requirePermission('emergency', 'view'), emergencyController.getTriageBoard);

/**
 * The bed list on its own.
 */
router.get('/beds', requirePermission('emergency', 'view'), emergencyController.getBeds);

/**
 * Change the state of a bay. The service keeps `emergency_admissions.bed_id`
 * in step with the bed inside one transaction.
 */
router.patch(
  '/beds/:id',
  requirePermission('emergency', 'edit'),
  [
    bedIdParam(),
    body('status')
      .isString()
      .withMessage('status is required')
      .bail()
      .customSanitizer((value) => String(value).trim().toLowerCase())
      .isIn(BED_STATUSES)
      .withMessage(`status must be one of ${BED_STATUSES.join(', ')}`),
    body('patientId')
      .optional({ nullable: true })
      .isString()
      .withMessage('patientId must be a string')
      .bail()
      .trim()
      .isLength({ min: 1, max: 64 })
      .withMessage('patientId must be between 1 and 64 characters'),
    body('triage')
      .optional({ nullable: true })
      .isString()
      .withMessage('triage must be a string')
      .bail()
      .trim()
      .toUpperCase()
      .isIn(TRIAGE_LEVELS)
      .withMessage(`triage must be one of ${TRIAGE_LEVELS.join(', ')}`),
    validate,
  ],
  emergencyController.updateBed
);

/**
 * Admit a patient. `condition` is stored in the `condition_note` column
 * ("condition" is a reserved word in MariaDB).
 */
router.post(
  '/admissions',
  requirePermission('emergency', 'add'),
  [
    body('patientId')
      .isString()
      .withMessage('patientId is required')
      .bail()
      .trim()
      .isLength({ min: 1, max: 64 })
      .withMessage('patientId must be between 1 and 64 characters'),
    body('triageLevel')
      .isString()
      .withMessage('triageLevel is required')
      .bail()
      .trim()
      .toUpperCase()
      .isIn(TRIAGE_LEVELS)
      .withMessage(`triageLevel must be one of ${TRIAGE_LEVELS.join(', ')}`),
    body('condition')
      .optional({ nullable: true })
      .isString()
      .withMessage('condition must be a string')
      .bail()
      .trim()
      .isLength({ max: 255 })
      .withMessage('condition must be at most 255 characters'),
    body('systolicBp')
      .optional({ nullable: true })
      .isInt({ min: 40, max: 300 })
      .withMessage('systolicBp must be an integer between 40 and 300 mmHg')
      .toInt(),
    body('diastolicBp')
      .optional({ nullable: true })
      .isInt({ min: 20, max: 200 })
      .withMessage('diastolicBp must be an integer between 20 and 200 mmHg')
      .toInt(),
    body('heartRate')
      .optional({ nullable: true })
      .isInt({ min: 20, max: 250 })
      .withMessage('heartRate must be an integer between 20 and 250 bpm')
      .toInt(),
    body('spo2')
      .optional({ nullable: true })
      .isFloat({ min: 50, max: 100 })
      .withMessage('spo2 must be a number between 50 and 100 percent')
      .toFloat(),
    body('bedId')
      .optional({ nullable: true })
      .isString()
      .withMessage('bedId must be a string')
      .bail()
      .trim()
      .isLength({ min: 1, max: 32 })
      .withMessage('bedId must be between 1 and 32 characters')
      .matches(/^[A-Za-z0-9_-]+$/)
      .withMessage('bedId may only contain letters, digits, dashes and underscores'),
    validate,
  ],
  emergencyController.createAdmission
);

/**
 * Update the triage level, the presenting condition or the recorded vitals
 * of an admission.
 */
router.patch(
  '/admissions/:id',
  requirePermission('emergency', 'edit'),
  [
    admissionIdParam(),
    body('triageLevel')
      .optional({ nullable: true })
      .isString()
      .withMessage('triageLevel must be a string')
      .bail()
      .trim()
      .toUpperCase()
      .isIn(TRIAGE_LEVELS)
      .withMessage(`triageLevel must be one of ${TRIAGE_LEVELS.join(', ')}`),
    body('condition')
      .optional({ nullable: true })
      .isString()
      .withMessage('condition must be a string')
      .bail()
      .trim()
      .isLength({ max: 255 })
      .withMessage('condition must be at most 255 characters'),
    body('systolicBp')
      .optional({ nullable: true })
      .isInt({ min: 40, max: 300 })
      .withMessage('systolicBp must be an integer between 40 and 300 mmHg')
      .toInt(),
    body('diastolicBp')
      .optional({ nullable: true })
      .isInt({ min: 20, max: 200 })
      .withMessage('diastolicBp must be an integer between 20 and 200 mmHg')
      .toInt(),
    body('heartRate')
      .optional({ nullable: true })
      .isInt({ min: 20, max: 250 })
      .withMessage('heartRate must be an integer between 20 and 250 bpm')
      .toInt(),
    body('spo2')
      .optional({ nullable: true })
      .isFloat({ min: 50, max: 100 })
      .withMessage('spo2 must be a number between 50 and 100 percent')
      .toFloat(),
    validate,
  ],
  emergencyController.updateAdmission
);

/**
 * Discharge a patient: the admission is closed and the bay goes to
 * `cleaning`.
 */
router.post(
  '/admissions/:id/discharge',
  requirePermission('emergency', 'edit'),
  [admissionIdParam(), validate],
  emergencyController.dischargeAdmission
);

/**
 * Record a code-blue broadcast.
 *
 * This is a clinical event, so it is written to the audit trail. The
 * `delete` permission is required on purpose: a code blue is the most
 * intrusive action on the board and is reserved for the roles that are
 * allowed to raise one.
 */
router.post(
  '/code-blue',
  requirePermission('emergency', 'delete'),
  [
    body('patientId')
      .optional({ nullable: true })
      .isString()
      .withMessage('patientId must be a string')
      .bail()
      .trim()
      .isLength({ min: 1, max: 64 })
      .withMessage('patientId must be between 1 and 64 characters'),
    body('note')
      .optional({ nullable: true })
      .isString()
      .withMessage('note must be a string')
      .bail()
      .trim()
      .isLength({ max: 255 })
      .withMessage('note must be at most 255 characters'),
    validate,
  ],
  emergencyController.recordCodeBlue
);

/**
 * The real patient list for the admit form plus the current bed list.
 */
router.get('/options', requirePermission('emergency', 'view'), emergencyController.getOptions);

export default router;
