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
    // The client posts snake_case (first_name / last_name) while other
    // clients post camelCase. Both spellings are accepted; the old
    // `body('firstName')` rule rejected every snake_case request with 400.
    body()
      .custom((value: Record<string, unknown>) => {
        const firstName = value?.firstName ?? value?.first_name;
        const lastName = value?.lastName ?? value?.last_name;
        if (typeof firstName !== 'string' || firstName.trim() === '') {
          throw new Error('First name is required');
        }
        if (typeof lastName !== 'string' || lastName.trim() === '') {
          throw new Error('Last name is required');
        }
        return true;
      })
      .withMessage('First and last name are required'),
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail()
      .withMessage('Valid email is required'),
    validate
  ],
  requirePermission('patients', 'add'),
  patientController.createPatient
);
// The sync endpoint applies a batch of changes queued while the device was
// offline. It is registered before `/:id` so the literal path is matched
// first, and it is guarded by the same permission as the single-patient
// writes it performs.
router.post(
  '/sync',
  [
    body('operations').isArray({ min: 1 }).withMessage('Operations must be a non-empty array'),
    body('operations.*.action')
      .isIn(['CREATE', 'UPDATE', 'DELETE', 'create', 'update', 'delete'])
      .withMessage('Each operation needs a CREATE, UPDATE or DELETE action'),
    body('operations.*.id').notEmpty().withMessage('Each operation needs an id'),
    validate
  ],
  requirePermission('patients', 'add'),
  patientController.syncPatients
);
router.put('/:id', requirePermission('patients', 'edit'), patientController.updatePatient);
router.delete('/:id', requirePermission('patients', 'delete'), patientController.deletePatient);

export default router;