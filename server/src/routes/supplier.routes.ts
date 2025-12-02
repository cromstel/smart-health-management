import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import {
  getSuppliers,
  createSupplier,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplier.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('supplier', 'view'), getSuppliers);
router.post('/', requirePermission('supplier', 'add'), createSupplier);
router.get('/:id', requirePermission('supplier', 'view'), getSupplierById);
router.put('/:id', requirePermission('supplier', 'edit'), updateSupplier);
router.delete('/:id', requirePermission('supplier', 'delete'), deleteSupplier);

export default router;
