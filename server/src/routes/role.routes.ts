import { Router } from 'express';
import type { Response, Request } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  updateRolePermissions,
} from '../controllers/role.controller.js';
import { addClient, removeClient } from '../events/permissions.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('role', 'view'), getRoles);

// Declared before '/:id': Express matches in declaration order, so with the
// parameterised route first every GET /stream was treated as a lookup of a role
// whose id is the literal string "stream" and answered 404. The SSE channel
// therefore never connected.
router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  addClient(res);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  req.on('close', () => {
    removeClient(res);
  });
});

const roleIdParam = param('id').isInt().withMessage('Invalid role ID');

router.get('/:id', requirePermission('role', 'view'), [roleIdParam, validate], getRoleById);
router.post(
  '/',
  requirePermission('role', 'add'),
  [
    body('name')
      .isString()
      .notEmpty()
      .withMessage('Role name is required')
      .isLength({ max: 100 })
      .withMessage('Role name is too long'),
    body('description')
      .optional({ nullable: true })
      .isString()
      .withMessage('Description must be a string'),
    validate,
  ],
  createRole
);
router.put(
  '/:id',
  requirePermission('role', 'edit'),
  [
    roleIdParam,
    body('name')
      .optional()
      .isString()
      .notEmpty()
      .withMessage('Role name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Role name is too long'),
    body('description')
      .optional({ nullable: true })
      .isString()
      .withMessage('Description must be a string'),
    validate,
  ],
  updateRole
);
router.put(
  '/:id/permissions',
  requirePermission('role', 'edit'),
  [
    roleIdParam,
    body('permissions').isArray().withMessage('Permissions must be an array'),
    body('permissions.*.module')
      .isString()
      .notEmpty()
      .withMessage('Permission module is required')
      .isLength({ max: 50 })
      .withMessage('Permission module is too long'),
    body('permissions.*.view')
      .optional()
      .isBoolean()
      .withMessage('view must be a boolean'),
    body('permissions.*.add')
      .optional()
      .isBoolean()
      .withMessage('add must be a boolean'),
    body('permissions.*.edit')
      .optional()
      .isBoolean()
      .withMessage('edit must be a boolean'),
    body('permissions.*.delete')
      .optional()
      .isBoolean()
      .withMessage('delete must be a boolean'),
    validate,
  ],
  updateRolePermissions
);
router.delete('/:id', requirePermission('role', 'delete'), [roleIdParam, validate], deleteRole);

export default router;
