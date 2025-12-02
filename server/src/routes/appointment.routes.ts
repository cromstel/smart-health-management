import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { cacheResponse, invalidateCache, CacheConfigs, InvalidationPatterns } from '../middleware/cache.js';
import * as appointmentController from '../controllers/appointment.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

// Cache appointment list for 1 minute (frequently changing)
router.get('/',
  requirePermission('appointments', 'view'),
  cacheResponse({
    ttl: 60, // 1 minute
    key: (req) => `appointments:list:${req.user?.hospital_id || 'all'}:${JSON.stringify(req.query)}`,
    headers: CacheConfigs.volatile.headers
  }),
  appointmentController.getAppointments
);

// Cache individual appointment details for 2 minutes
router.get('/:id',
  requirePermission('appointments', 'view'),
  cacheResponse({
    ttl: 120, // 2 minutes
    key: (req) => `appointment:detail:${req.params.id}`,
    headers: CacheConfigs.user.headers
  }),
  appointmentController.getAppointmentById
);

// Create appointment - invalidate appointment cache
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
  invalidateCache(InvalidationPatterns.appointments),
  appointmentController.createAppointment
);

// Update appointment - invalidate appointment cache
router.put(
  '/:id',
  [
    body('appointmentDate').optional().isDate().withMessage('Valid date is required'),
    body('appointmentTime').optional().notEmpty().withMessage('Time is required'),
    validate
  ],
  requirePermission('appointments', 'edit'),
  invalidateCache(InvalidationPatterns.appointments),
  appointmentController.updateAppointment
);

// Delete appointment - invalidate appointment cache
router.delete('/:id',
  requirePermission('appointments', 'delete'),
  invalidateCache(InvalidationPatterns.appointments),
  appointmentController.deleteAppointment
);
router.get('/availability', requirePermission('appointments', 'view'), appointmentController.getDoctorAvailability);
router.get('/:id/ics', requirePermission('appointments', 'view'), appointmentController.getAppointmentIcs);

export default router;