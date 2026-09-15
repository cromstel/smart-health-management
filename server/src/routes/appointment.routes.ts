import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as appointmentController from '../controllers/appointment.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('appointments', 'view'), appointmentController.getAppointments);
router.get('/availability', requirePermission('appointments', 'view'), appointmentController.getDoctorAvailability);
router.get('/:id/ics', requirePermission('appointments', 'view'), appointmentController.getAppointmentIcs);
router.get('/:id', requirePermission('appointments', 'view'), appointmentController.getAppointmentById);
router.post(
  '/',
  [
    body('patientId').notEmpty().withMessage('Patient ID is required'),
    body('appointmentDate').isDate().withMessage('Valid date is required'),
    body('appointmentTime').notEmpty().withMessage('Time is required'),
    body('recurrenceRule').optional().isString().withMessage('Recurrence rule must be a string'),
    validate
  ],
  requirePermission('appointments', 'add'),
  appointmentController.createAppointment
);
router.put(
  '/:id',
  [
    body('appointmentDate').optional().isDate().withMessage('Valid date is required'),
    body('appointmentTime').optional().notEmpty().withMessage('Time is required'),
    validate
  ],
  requirePermission('appointments', 'edit'),
  appointmentController.updateAppointment
);
router.delete('/:id', requirePermission('appointments', 'delete'), appointmentController.deleteAppointment);

export default router;