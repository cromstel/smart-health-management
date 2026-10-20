import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
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

/** `purchase_orders.id` is BIGINT UNSIGNED AUTO_INCREMENT. */
const orderIdParam = () =>
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid purchase order id')
    .toInt();

const lineItemValidators = [
  body('items.*.medicine_id')
    .optional({ values: 'falsy' })
    .isLength({ max: 64 })
    .withMessage('Invalid medicine id'),
  body('items.*.medicine_name')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Invalid medicine name')
    .escape(),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be a positive integer')
    .toInt(),
  body('items.*.unit_price')
    .isFloat({ min: 0 })
    .withMessage('Item unit price must be a non-negative number')
    .toFloat(),
];

router.get('/', requirePermission('purchaseOrder', 'view'), getPurchaseOrders);
router.post(
  '/',
  requirePermission('purchaseOrder', 'add'),
  [
    body('supplier_id')
      .isInt({ min: 1 })
      .withMessage('A valid supplier id is required')
      .toInt(),
    body('order_date')
      .isISO8601()
      .withMessage('Order date must be a valid date'),
    body('expected_delivery_date')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Expected delivery date must be a valid date'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('At least one order item is required'),
    ...lineItemValidators,
    validate,
  ],
  createPurchaseOrder
);
router.get('/:id', requirePermission('purchaseOrder', 'view'), [orderIdParam(), validate], getPurchaseOrderById);
router.put(
  '/:id',
  requirePermission('purchaseOrder', 'edit'),
  [
    orderIdParam(),
    body('status')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 32 })
      .withMessage('Invalid status'),
    body('supplier_id')
      .optional({ values: 'falsy' })
      .isInt({ min: 1 })
      .withMessage('Invalid supplier id')
      .toInt(),
    body('order_date')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Order date must be a valid date'),
    body('expected_delivery_date')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Expected delivery date must be a valid date'),
    body('total_amount')
      .optional({ values: 'falsy' })
      .isFloat({ min: 0 })
      .withMessage('Total amount must be a non-negative number')
      .toFloat(),
    body('items')
      .optional({ values: 'falsy' })
      .isArray()
      .withMessage('Items must be an array'),
    ...lineItemValidators,
    validate,
  ],
  updatePurchaseOrder
);
router.delete('/:id', requirePermission('purchaseOrder', 'delete'), [orderIdParam(), validate], deletePurchaseOrder);

export default router;
