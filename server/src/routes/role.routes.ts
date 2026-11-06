import { Router } from 'express';
import type { Response } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import {
  authenticate,
  requirePermission,
  enforcePasswordChange,
  type AuthRequest,
} from '../middleware/auth.js';
import {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  updateRolePermissions,
} from '../controllers/role.controller.js';
import {
  addClient,
  getClientCountForUser,
  MAX_STREAMS_PER_ACCOUNT,
} from '../events/permissions.js';

const router = Router();
router.use(authenticate);
router.use(enforcePasswordChange);

router.get('/', requirePermission('role', 'view'), getRoles);

// Declared before '/:id': Express matches in declaration order, so with the
// parameterised route first every GET /stream was treated as a lookup of a role
// whose id is the literal string "stream" and answered 404. The SSE channel
// therefore never connected.
//
// The stream carries role and permission changes, which is the same material
// the role list answers with, so it requires the same grant. Without the check
// an authenticated account that cannot read roles could still watch every role
// edit as it happened.
//
// Roles are installation-wide -- `roles` has no hospital column -- so there is
// nothing for a tenant predicate to narrow. The channel is confined by the
// grant instead, and the account's tenant is recorded with the connection so an
// event that does name a hospital is not delivered across tenants.
router.get('/stream', requirePermission('role', 'view'), (req: AuthRequest, res: Response) => {
  const userId = req.user?.id ?? null;

  // A stream is a held-open connection, so one account must not be able to
  // exhaust the registry by opening them in a loop. The ceiling is generous
  // for a browser that reconnects while an old socket is still closing.
  if (getClientCountForUser(userId) >= MAX_STREAMS_PER_ACCOUNT) {
    res.status(429).json({ error: 'Too many open streams for this account' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Tell nginx not to buffer the stream; without it events are held until the
  // buffer fills and the client sees nothing.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  addClient(res, req, {
    userId,
    hospitalId: req.tenant?.hospitalId ?? null,
    platformWide: req.tenant?.platformWide ?? false,
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
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
