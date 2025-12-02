import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { getPatientLoadPredictions } from '../controllers/patientLoadPrediction.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/predictions', requirePermission('dashboard', 'view'), getPatientLoadPredictions);

export default router;