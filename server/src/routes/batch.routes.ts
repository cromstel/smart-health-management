import { Router } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as batchController from '../controllers/batch.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('pharmacy', 'view'), batchController.getBatches);
router.get('/:id', requirePermission('pharmacy', 'view'), batchController.getBatchById);
router.post('/', requirePermission('pharmacy', 'add'), batchController.createBatch);
router.put('/:id', requirePermission('pharmacy', 'edit'), batchController.updateBatch);
router.delete('/:id', requirePermission('pharmacy', 'delete'), batchController.deleteBatch);
router.post('/:id/recall', requirePermission('pharmacy', 'edit'), batchController.recallBatch);

export default router;