import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as settingsController from '../controllers/settings.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('settings', 'view'), settingsController.getSettings);
router.put('/', requirePermission('settings', 'edit'), settingsController.updateSettings);

export default router;