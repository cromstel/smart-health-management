import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { cacheResponse, invalidateCache, CacheConfigs } from '../middleware/cache.js';
import * as patientController from '../controllers/patient.controller.js';

const router = Router();

router.use(authenticate);
router.use(enforcePasswordChange);

// Cache patient list for 2 minutes (moderate volatility)
router.get('/',
  requirePermission('patients', 'view'),
  cacheResponse({
    ttl: 120, // 2 minutes
    key: (req) => `patients:list:${req.user?.hospital_id || 'all'}:${JSON.stringify(req.query)}`,
    headers: CacheConfigs.user.headers
  }),
  patientController.getAllPatients
);

// Cache individual patient details for 5 minutes (already implemented in controller)
router.get('/:id',
  requirePermission('patients', 'view'),
  patientController.getPatientById
);

// Create patient - invalidate patient cache
router.post(
  '/',
  [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    validate
  ],
  requirePermission('patients', 'add'),
  invalidateCache(['patients:*', 'dashboard:*']),
  patientController.createPatient
);

// Update patient - invalidate specific patient cache and list cache
router.put('/:id',
  requirePermission('patients', 'edit'),
  invalidateCache((req) => [`patient:detail:${req.params.id}`, 'patients:*', 'dashboard:*']),
  patientController.updatePatient
);

// Delete patient - invalidate specific patient cache and list cache
router.delete('/:id',
  requirePermission('patients', 'delete'),
  invalidateCache((req) => [`patient:detail:${req.params.id}`, 'patients:*', 'dashboard:*']),
  patientController.deletePatient
);

export default router;