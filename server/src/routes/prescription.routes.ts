import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as prescriptionController from '../controllers/prescription.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('pharmacy', 'view'), prescriptionController.listPrescriptions);
router.get('/:id', requirePermission('pharmacy', 'view'), prescriptionController.getPrescription);
router.post(
  '/',
  [
    body('patient_id').notEmpty().withMessage('Patient ID is required'),
    body('doctor_id').notEmpty().withMessage('Doctor ID is required'),
    body('medicine_id').notEmpty().withMessage('Medicine ID is required'),
    body('dose').notEmpty().withMessage('Dose is required'),
    body('frequency').notEmpty().withMessage('Frequency is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    validate,
  ],
  requirePermission('pharmacy', 'add'),
  prescriptionController.createPrescription
);
router.put(
  '/:id',
  [
    body('dose').optional().notEmpty().withMessage('Dose cannot be empty'),
    body('frequency').optional().notEmpty().withMessage('Frequency cannot be empty'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    validate,
  ],
  requirePermission('pharmacy', 'edit'),
  prescriptionController.updatePrescription
);
router.delete('/:id', requirePermission('pharmacy', 'delete'), prescriptionController.deletePrescription);

export default router;