import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { pageValidators } from '../utils/pagination.js';
import * as pharmacyController from '../controllers/pharmacy.controller.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

/** Fresh chain per route: `medicines_inventory.id` is a VARCHAR(64) uuid. */
const medicineIdParam = () =>
  param('id')
    .isLength({ min: 1, max: 64 })
    .withMessage('Invalid medicine id')
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('Invalid medicine id');

router.get(
  '/medicines',
  requirePermission('pharmacy', 'view'),
  [
    query('lowStock').optional().isIn(['true', 'false']).withMessage('lowStock must be true or false'),
    query('expired').optional().isIn(['true', 'false']).withMessage('expired must be true or false'),
    // The list is a page, so the page size is bounded. A request for a page
    // that is not a page is refused rather than quietly answered with
    // something the caller did not ask for.
    ...pageValidators(),
    validate,
  ],
  pharmacyController.getPharmacyItems
);
router.get('/medicines/:id', requirePermission('pharmacy', 'view'), [medicineIdParam(), validate], pharmacyController.getPharmacyItemById);
router.post(
  '/medicines',
  requirePermission('pharmacy', 'add'),
  [
    body('medicineName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Medicine name is required')
      .escape(),
    body('medicine_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Medicine name is required')
      .escape(),
    body('category')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 100 })
      .withMessage('Category must be at most 100 characters')
      .escape(),
    body('supplier')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 255 })
      .withMessage('Supplier must be at most 255 characters')
      .escape(),
    body('supplierId')
      .optional({ values: 'falsy' })
      .isInt({ min: 1 })
      .withMessage('Supplier id must be a positive integer')
      .toInt(),
    body('supplier_id')
      .optional({ values: 'falsy' })
      .isInt({ min: 1 })
      .withMessage('Supplier id must be a positive integer')
      .toInt(),
    body('stockLevel')
      .optional({ values: 'falsy' })
      .isInt({ min: 0 })
      .withMessage('Stock level must be a non-negative integer')
      .toInt(),
    body('stock_level')
      .optional({ values: 'falsy' })
      .isInt({ min: 0 })
      .withMessage('Stock level must be a non-negative integer')
      .toInt(),
    body('lowStockThreshold')
      .optional({ values: 'falsy' })
      .isInt({ min: 0 })
      .withMessage('Low stock threshold must be a non-negative integer')
      .toInt(),
    body('low_stock_threshold')
      .optional({ values: 'falsy' })
      .isInt({ min: 0 })
      .withMessage('Low stock threshold must be a non-negative integer')
      .toInt(),
    body('expiryDate')
      .optional({ values: 'falsy' })
      .trim()
      .isISO8601()
      .withMessage('Expiry date must be a valid date'),
    body('expiry_date')
      .optional({ values: 'falsy' })
      .trim()
      .isISO8601()
      .withMessage('Expiry date must be a valid date'),
    body('unitPrice')
      .optional({ values: 'falsy' })
      .isFloat({ min: 0 })
      .withMessage('Unit price must be a non-negative number')
      .toFloat(),
    body('unit_price')
      .optional({ values: 'falsy' })
      .isFloat({ min: 0 })
      .withMessage('Unit price must be a non-negative number')
      .toFloat(),
    body('storageLocation')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 255 })
      .withMessage('Storage location must be at most 255 characters')
      .escape(),
    body('storage_location')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 255 })
      .withMessage('Storage location must be at most 255 characters')
      .escape(),
    validate,
  ],
  pharmacyController.createPharmacyItem
);
router.put(
  '/medicines/:id',
  requirePermission('pharmacy', 'edit'),
  [
    medicineIdParam(),
    body('medicineName').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Invalid medicine name').escape(),
    body('medicine_name').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Invalid medicine name').escape(),
    body('category').optional().trim().isLength({ max: 100 }).withMessage('Invalid category').escape(),
    body('supplier').optional().trim().isLength({ max: 255 }).withMessage('Invalid supplier').escape(),
    body('supplierId').optional().isInt({ min: 1 }).withMessage('Invalid supplier id').toInt(),
    body('supplier_id').optional().isInt({ min: 1 }).withMessage('Invalid supplier id').toInt(),
    body('stockLevel').optional().isInt({ min: 0 }).withMessage('Invalid stock level').toInt(),
    body('stock_level').optional().isInt({ min: 0 }).withMessage('Invalid stock level').toInt(),
    body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Invalid low stock threshold').toInt(),
    body('low_stock_threshold').optional().isInt({ min: 0 }).withMessage('Invalid low stock threshold').toInt(),
    body('expiryDate').optional().trim().isISO8601().withMessage('Invalid expiry date'),
    body('expiry_date').optional().trim().isISO8601().withMessage('Invalid expiry date'),
    body('unitPrice').optional().isFloat({ min: 0 }).withMessage('Invalid unit price').toFloat(),
    body('unit_price').optional().isFloat({ min: 0 }).withMessage('Invalid unit price').toFloat(),
    body('storageLocation').optional().trim().isLength({ max: 255 }).withMessage('Invalid storage location').escape(),
    body('storage_location').optional().trim().isLength({ max: 255 }).withMessage('Invalid storage location').escape(),
    validate,
  ],
  pharmacyController.updatePharmacyItem
);
router.delete('/medicines/:id', requirePermission('pharmacy', 'delete'), [medicineIdParam(), validate], pharmacyController.deletePharmacyItem);

router.get(
  '/reports',
  requirePermission('pharmacy', 'view'),
  [
    query('type')
      .optional()
      .isIn(['stock_levels', 'expiry_dates', 'low_stock'])
      .withMessage('Invalid report type'),
    query('reportType')
      .optional()
      .isIn(['stock_levels', 'expiry_dates', 'low_stock'])
      .withMessage('Invalid report type'),
    query('format')
      .optional()
      .isIn(['json', 'csv', 'xlsx', 'pdf'])
      .withMessage('Invalid report format'),
    validate,
  ],
  pharmacyController.generatePharmacyReport
);

export default router;
