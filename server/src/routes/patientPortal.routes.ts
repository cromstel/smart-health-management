import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as portalController from '../controllers/patientPortal.controller.js';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('patient', 'view'));

router.get('/', portalController.getMyPortal);
router.get('/appointments', portalController.getMyAppointments);
router.get('/summaries', portalController.getMySharedSummaries);
export default router;
