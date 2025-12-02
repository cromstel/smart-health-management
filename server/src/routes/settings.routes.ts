import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { getSettings, updateSettings } from '../controllers/settings.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('settings', 'view'), getSettings);
router.put('/', requirePermission('settings', 'edit'), updateSettings);

export default router;