import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as batchController from '../controllers/batch.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('pharmacy', 'view'), batchController.getBatches);
router.get('/:id', requirePermission('pharmacy', 'view'), batchController.getBatchById);
router.post(
  '/',
  [
    body('medicineId').notEmpty().withMessage('Medicine ID is required'),
    body('batchNumber').notEmpty().withMessage('Batch number is required'),
    body('expiryDate').isDate().withMessage('Valid expiry date is required'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    validate,
  ],
  requirePermission('pharmacy', 'add'),
  batchController.createBatch
);
router.put(
  '/:id',
  [
    body('batchNumber').optional().notEmpty().withMessage('Batch number cannot be empty'),
    body('expiryDate').optional().isDate().withMessage('Valid expiry date is required'),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    body('recalled').optional().isBoolean().withMessage('Recalled must be a boolean'),
    validate,
  ],
  requirePermission('pharmacy', 'edit'),
  batchController.updateBatch
);
router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('Batch ID is required'), validate],
  requirePermission('pharmacy', 'delete'),
  batchController.deleteBatch
);
router.post(
  '/:id/recall',
  [param('id').notEmpty().withMessage('Batch ID is required'), validate],
  requirePermission('pharmacy', 'edit'),
  batchController.recallBatch
);

export default router;