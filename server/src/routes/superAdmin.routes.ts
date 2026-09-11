import { Router } from 'express';
import { param, body } from 'express-validator';
import { authenticate, authorize, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import * as superAdminController from '../controllers/superAdmin.controller.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);
router.use(enforcePasswordChange);

// Apply super admin authorization to all routes
router.use(authorize('Super Admin'));

// System status and statistics
router.get('/system-status', requirePermission('superAdmin', 'view'), superAdminController.getSystemStatus);

// User management
router.get('/users', requirePermission('superAdmin', 'view'), superAdminController.getAllUsers);
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
router.post('/upgrade', requirePermission('superAdmin', 'edit'), superAdminController.triggerUpgrade);
router.post('/restore', requirePermission('superAdmin', 'add'), superAdminController.restoreBackup);
router.get('/health', requirePermission('superAdmin', 'view'), superAdminController.getSystemHealth);
router.get('/backups', requirePermission('superAdmin', 'view'), superAdminController.getBackups);

// Settings management
router.get('/settings', requirePermission('superAdmin', 'view'), superAdminController.getSystemSettings);
router.patch('/settings/:id', requirePermission('superAdmin', 'edit'), superAdminController.updateSystemSetting);

export default router;
