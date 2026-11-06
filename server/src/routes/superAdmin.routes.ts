import { Router } from 'express';
import { param, body } from 'express-validator';
import { authenticate, authorize, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import { pageValidators } from '../utils/pagination.js';
import * as superAdminController from '../controllers/superAdmin.controller.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);
router.use(enforcePasswordChange);

// Apply super admin authorization to all routes
router.use(authorize('Super Admin', 'super_admin'));

/**
 * The page size of a list that is answered in pages.
 *
 * The list used to answer with every row, so one request carried the whole
 * table with it. The page size is bounded, and a request for a page that is
 * not a page is refused rather than quietly answered with something the
 * caller did not ask for.
 */
const pageValidation = [...pageValidators(), validate];

// System status and statistics
router.get('/system-status', requirePermission('superAdmin', 'view'), superAdminController.getSystemStatus);

// User management
router.get(
  '/users',
  requirePermission('superAdmin', 'view'),
  pageValidation,
  superAdminController.getAllUsers
);
router.patch('/users/:userId/status', requirePermission('superAdmin', 'edit'), superAdminController.updateUserStatus);
router.post(
  '/users/:userId/reset-password',
  requirePermission('superAdmin', 'edit'),
  param('userId').isInt().withMessage('Invalid user id'),
  body('clear_two_factor').optional().isBoolean().withMessage('clear_two_factor must be a boolean'),
  superAdminController.resetUserPassword
);

// Hospital management
router.get('/hospitals', requirePermission('superAdmin', 'view'), superAdminController.getAllHospitals);

// Audit logs
router.get('/audit-logs', requirePermission('superAdmin', 'view'), superAdminController.getAuditLogs);

// System operations
router.post('/backup', requirePermission('superAdmin', 'add'), superAdminController.triggerBackup);
router.post(
  '/upgrade',
  requirePermission('superAdmin', 'edit'),
  [
    body('version')
      .trim()
      .notEmpty().withMessage('Version is required')
      .isLength({ max: 50 }).withMessage('Version must be at most 50 characters'),
    body('description')
      .optional()
      .isString().withMessage('Description must be a string')
      .isLength({ max: 500 }).withMessage('Description must be at most 500 characters'),
    validate
  ],
  superAdminController.triggerUpgrade
);
router.post(
  '/restore',
  requirePermission('superAdmin', 'add'),
  [
    body('backupFileName')
      .trim()
      .notEmpty().withMessage('Backup file name is required')
      // Plain file names only: the name is joined onto the backup directory,
      // so anything with a path separator would escape it.
      .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Invalid backup file name'),
    validate
  ],
  superAdminController.restoreBackup
);
router.get('/health', requirePermission('superAdmin', 'view'), superAdminController.getSystemHealth);
router.get('/backups', requirePermission('superAdmin', 'view'), superAdminController.getBackups);

// Settings management
router.get(
  '/settings',
  requirePermission('superAdmin', 'view'),
  pageValidation,
  superAdminController.getSystemSettings
);
router.patch('/settings/:id', requirePermission('superAdmin', 'edit'), superAdminController.updateSystemSetting);

// The super-admin console writes settings with PUT /settings and a
// `{ key, value }` body. Without this route the console got a 404 on every
// save, so no setting could be changed from the UI.
router.put(
  '/settings',
  requirePermission('superAdmin', 'edit'),
  [
    body('key')
      .trim()
      .notEmpty().withMessage('Setting key is required')
      .isLength({ max: 100 }).withMessage('Setting key must be at most 100 characters')
      .matches(/^[A-Za-z0-9._:-]+$/).withMessage('Setting key contains invalid characters'),
    body('value')
      .custom((value: unknown) => value !== undefined && value !== null)
      .withMessage('Setting value is required')
      .custom((value: unknown) => ['string', 'number', 'boolean'].includes(typeof value))
      .withMessage('Setting value must be a string, number or boolean')
      .isLength({ max: 10000 }).withMessage('Setting value must be at most 10000 characters'),
    validate
  ],
  superAdminController.upsertSystemSetting
);

export default router;
