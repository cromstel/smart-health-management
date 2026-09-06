import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as patientController from '../controllers/patient.controller.js';

const router = Router();

router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('patients', 'view'), patientController.getAllPatients);
router.get('/:id', requirePermission('patients', 'view'), patientController.getPatientById);
router.post(
  '/',
  [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    validate
  ],
  requirePermission('patients', 'add'),
  patientController.createPatient
);
router.put('/:id', requirePermission('patients', 'edit'), patientController.updatePatient);
router.delete('/:id', requirePermission('patients', 'delete'), patientController.deletePatient);

export default router;