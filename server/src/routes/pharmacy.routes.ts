import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as pharmacyController from '../controllers/pharmacy.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/medicines', requirePermission('pharmacy', 'view'), pharmacyController.getPharmacyItems);
router.get('/medicines/:id', requirePermission('pharmacy', 'view'), pharmacyController.getPharmacyItemById);
router.post('/medicines', requirePermission('pharmacy', 'add'), pharmacyController.createPharmacyItem);
router.put('/medicines/:id', requirePermission('pharmacy', 'edit'), pharmacyController.updatePharmacyItem);
router.delete('/medicines/:id', requirePermission('pharmacy', 'delete'), pharmacyController.deletePharmacyItem);

router.get('/reports', requirePermission('pharmacy', 'view'), pharmacyController.generatePharmacyReport);

export default router;