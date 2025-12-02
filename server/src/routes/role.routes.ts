import { Router } from 'express';
import type { Response, Request } from 'express';
import { authenticate, requirePermission, enforcePasswordChange } from '../middleware/auth.js';
import { cacheResponse, invalidateCache, CacheConfigs, InvalidationPatterns } from '../middleware/cache.js';
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

// Cache roles list for 5 minutes (reference data)
router.get('/',
  requirePermission('role', 'view'),
  cacheResponse({
    ttl: 300, // 5 minutes
    key: () => 'roles:list',
    headers: CacheConfigs.reference.headers
  }),
  getRoles
);

// Cache individual role details for 5 minutes
router.get('/:id',
  requirePermission('role', 'view'),
  cacheResponse({
    ttl: 300, // 5 minutes
    key: (req) => `role:detail:${req.params.id}`,
    headers: CacheConfigs.reference.headers
  }),
  getRoleById
);

// Create role - invalidate roles cache
router.post('/',
  requirePermission('role', 'add'),
  invalidateCache(InvalidationPatterns.roles),
  createRole
);

// Update role - invalidate roles cache
router.put('/:id',
  requirePermission('role', 'edit'),
  invalidateCache(InvalidationPatterns.roles),
  updateRole
);

// Update role permissions - invalidate roles and permissions cache
router.put('/:id/permissions',
  requirePermission('role', 'edit'),
  invalidateCache([...InvalidationPatterns.roles, ...InvalidationPatterns.permissions]),
  updateRolePermissions
);

// Delete role - invalidate roles cache
router.delete('/:id',
  requirePermission('role', 'delete'),
  invalidateCache(InvalidationPatterns.roles),
  deleteRole
);

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
