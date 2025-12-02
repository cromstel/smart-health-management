import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import {
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderById,
  getPurchaseOrders,
  updatePurchaseOrder,
} from '../controllers/purchaseOrder.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('purchaseOrder', 'view'), getPurchaseOrders);
router.post('/', requirePermission('purchaseOrder', 'add'), createPurchaseOrder);
router.get('/:id', requirePermission('purchaseOrder', 'view'), getPurchaseOrderById);
router.put('/:id', requirePermission('purchaseOrder', 'edit'), updatePurchaseOrder);
router.delete('/:id', requirePermission('purchaseOrder', 'delete'), deletePurchaseOrder);

export default router;
