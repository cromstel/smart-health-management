import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { getPharmacyItems, createPharmacyItem, generatePharmacyReport, updatePharmacyItem, deletePharmacyItem } from '../controllers/pharmacy.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('pharmacy', 'view'), getPharmacyItems);
router.post('/', requirePermission('pharmacy', 'add'), createPharmacyItem);
router.put('/:id', requirePermission('pharmacy', 'edit'), updatePharmacyItem);
router.patch('/:id', requirePermission('pharmacy', 'edit'), updatePharmacyItem);
router.delete('/:id', requirePermission('pharmacy', 'delete'), deletePharmacyItem);
router.get('/reports', requirePermission('pharmacy', 'view'), generatePharmacyReport);

export default router;