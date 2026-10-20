import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
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
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Supplier name is required'),
    body('contact_person').optional().isString().withMessage('Contact person must be a string'),
    body('email').optional().isEmail().withMessage('A valid email is required'),
    body('phone').optional().isString().withMessage('Phone must be a string'),
    body('address').optional().isString().withMessage('Address must be a string'),
    validate,
  ],
  requirePermission('supplier', 'add'),
  createSupplier
);
router.get(
  '/:id',
  [param('id').notEmpty().withMessage('Supplier ID is required'), validate],
  requirePermission('supplier', 'view'),
  getSupplierById
);
router.put(
  '/:id',
  [
    param('id').notEmpty().withMessage('Supplier ID is required'),
    body('name').optional().notEmpty().withMessage('Supplier name cannot be empty'),
    body('email').optional().isEmail().withMessage('A valid email is required'),
    validate,
  ],
  requirePermission('supplier', 'edit'),
  updateSupplier
);
router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('Supplier ID is required'), validate],
  requirePermission('supplier', 'delete'),
  deleteSupplier
);

export default router;
