import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { getHospitals, createHospital } from '../controllers/hospital.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('hospital', 'view'), getHospitals);
router.post('/', requirePermission('hospital', 'add'), createHospital);

export default router;