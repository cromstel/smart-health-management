import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { getStaff, createStaff } from '../controllers/staff.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('staff', 'view'), getStaff);
router.post('/', requirePermission('staff', 'add'), createStaff);

export default router;