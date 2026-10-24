import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, enforcePasswordChange, requirePermission } from '../middleware/auth.js';
import * as clinicalNotesController from '../controllers/clinicalNotes.controller.js';
import { MAX_NOTE_LENGTH } from '../services/clinicalNotes.service.js';

const router = Router();

router.use(authenticate);
router.use(enforcePasswordChange);

/**
 * Clinical notes are part of the patient chart, so they inherit the
 * `patients` permission module: reading a note is a chart read, writing one
 * is a chart write. There is no `clinicalNotes` module in the seeded
 * permission matrix, so a dedicated gate would lock every role out.
 */
router.get(
  '/',
  requirePermission('patients', 'view'),
  query('patientId')
    .isString()
    .withMessage('patientId is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('patientId must be between 1 and 64 characters'),
  query('mine')
    .optional({ nullable: true })
    .isIn(['true', 'false'])
    .withMessage('mine must be true or false'),
  query('limit')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 200 })
    .withMessage('limit must be an integer between 1 and 200')
    .toInt(),
  query('offset')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('offset must be a positive integer')
    .toInt(),
  clinicalNotesController.getClinicalNotes
);

router.get(
  '/:id',
  requirePermission('patients', 'view'),
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
  clinicalNotesController.getClinicalNoteById
);

router.post(
  '/',
  requirePermission('patients', 'add'),
  body('patientId')
    .isString()
    .withMessage('patientId is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('patientId must be between 1 and 64 characters'),
  body('content')
    .isString()
    .withMessage('content must be a string')
    .bail()
    .isLength({ min: 1, max: MAX_NOTE_LENGTH })
    .withMessage(`content must be between 1 and ${MAX_NOTE_LENGTH} characters`),
  body('tags')
    .optional({ nullable: true })
    .isArray({ max: 20 })
    .withMessage('tags must be an array of at most 20 entries')
    .bail()
    .custom((value: unknown[]) => value.every((tag) => typeof tag === 'string'))
    .withMessage('tags must contain only strings'),
  clinicalNotesController.createClinicalNote
);

router.put(
  '/:id',
  requirePermission('patients', 'edit'),
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
  body('content')
    .optional({ nullable: true })
    .isString()
    .withMessage('content must be a string')
    .bail()
    .isLength({ min: 1, max: MAX_NOTE_LENGTH })
    .withMessage(`content must be between 1 and ${MAX_NOTE_LENGTH} characters`),
  body('tags')
    .optional({ nullable: true })
    .isArray({ max: 20 })
    .withMessage('tags must be an array of at most 20 entries')
    .bail()
    .custom((value: unknown[]) => value.every((tag) => typeof tag === 'string'))
    .withMessage('tags must contain only strings'),
  clinicalNotesController.updateClinicalNote
);

router.delete(
  '/:id',
  // Correcting a note is an edit, not a record deletion. The delete
  // permission on the patient record is admin-only, and requiring it here
  // meant the "Delete note" button failed for every clinician.
  requirePermission('patients', 'edit'),
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
  clinicalNotesController.deleteClinicalNote
);

export default router;
