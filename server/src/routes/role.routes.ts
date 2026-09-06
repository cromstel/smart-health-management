import { Router } from 'express';
import type { Response, Request } from 'express';
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
router.get('/:id', requirePermission('role', 'view'), getRoleById);
router.post('/', requirePermission('role', 'add'), createRole);
router.put('/:id', requirePermission('role', 'edit'), updateRole);
router.put('/:id/permissions', requirePermission('role', 'edit'), updateRolePermissions);
router.delete('/:id', requirePermission('role', 'delete'), deleteRole);

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

export default router;
