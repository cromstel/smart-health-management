import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { broadcast } from '../events/permissions.js';
import { cacheService, CacheKeys } from '../services/cache.service.js';

export const getRoles = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [roles] = await pool.query('SELECT * FROM roles');
    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

export const getRoleById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [roles] = await pool.query('SELECT * FROM roles WHERE id = ?', [id]);
    const role = (roles as any[])[0];

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json(role);
  } catch (error) {
    console.error('Get role by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
};

export const createRole = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { name, description, parent_id } = req.body;
    const id = uuidv4();
    await pool.query(
      'INSERT INTO roles (id, name, description, parent_id) VALUES (?, ?, ?, ?)',
      [id, name, description, parent_id || null]
    );

    const userId = (req.user && req.user.id) || null;
    const oldValue = null;
    const newValue = JSON.stringify({ id, name, description, parent_id: parent_id || null });
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, 'create', 'role', ?, ?, ?, ?, ?)`,
      [userId, id, oldValue, newValue, req.ip, req.headers['user-agent'] || '']
    );

    broadcast({ type: 'role_created', roleId: id, name, parent_id: parent_id || null });

    res.status(201).json({ message: 'Role created successfully', id });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
};

export const updateRole = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [existingRows] = await pool.query('SELECT * FROM roles WHERE id = ?', [id]);
    const before = (existingRows as any[])[0] || null;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    await pool.query(
      `UPDATE roles SET ${fields} WHERE id = ?`,
      values
    );

    const [afterRows] = await pool.query('SELECT * FROM roles WHERE id = ?', [id]);
    const after = (afterRows as any[])[0] || null;

    const userId = (req.user && req.user.id) || null;
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, 'update', 'role', ?, ?, ?, ?, ?)`,
      [userId, id, JSON.stringify(before), JSON.stringify(after), req.ip, req.headers['user-agent'] || '']
    );
    broadcast({ type: 'role_updated', roleId: id });
    
    // Invalidate cache for this role's permissions
    await cacheService.invalidatePattern(CacheKeys.invalidateRole(id));
    await cacheService.invalidatePattern(CacheKeys.invalidatePermissions());
    
    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

export const deleteRole = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [existingRows] = await pool.query('SELECT * FROM roles WHERE id = ?', [id]);
    const before = (existingRows as any[])[0] || null;
    await pool.query('DELETE FROM roles WHERE id = ?', [id]);

    const userId = (req.user && req.user.id) || null;
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, 'delete', 'role', ?, ?, ?, ?, ?)`,
      [userId, id, JSON.stringify(before), null, req.ip, req.headers['user-agent'] || '']
    );
    broadcast({ type: 'role_deleted', roleId: id });
    
    // Invalidate cache for this role's permissions
    await cacheService.invalidatePattern(CacheKeys.invalidateRole(id));
    await cacheService.invalidatePattern(CacheKeys.invalidatePermissions());
    
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
};

export const updateRolePermissions = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params; // role id
    const { permissions } = req.body as { permissions: Array<{ module: string; department_id?: string | null; view?: boolean; add?: boolean; edit?: boolean; delete?: boolean; }> };
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Invalid permissions payload' });
    }

    for (const p of permissions) {
      const dept = p.department_id || null;
      const [existing] = await pool.query(
        'SELECT * FROM permissions WHERE role_id = ? AND module = ? AND (department_id <=> ?)',
        [id, p.module, dept]
      );
      const before = (existing as any[])[0] || null;

      if (before) {
      await pool.query(
        'UPDATE permissions SET can_view = ?, can_add = ?, can_edit = ?, can_delete = ? WHERE id = ?',
        [!!p.view, !!p.add, !!p.edit, !!p.delete, before.id]
      );
      } else {
      await pool.query(
        'INSERT INTO permissions (role_id, module, department_id, can_view, can_add, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, p.module, dept, !!p.view, !!p.add, !!p.edit, !!p.delete]
      );
      }

      const [afterRows] = await pool.query(
        'SELECT * FROM permissions WHERE role_id = ? AND module = ? AND (department_id <=> ?)',
        [id, p.module, dept]
      );
      const after = (afterRows as any[])[0] || null;

      const userId = (req.user && req.user.id) || null;
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address, user_agent)
         VALUES (?, 'permission_update', 'permissions', ?, ?, ?, ?, ?)`,
        [userId, after?.id || before?.id || null, JSON.stringify(before), JSON.stringify(after), req.ip, req.headers['user-agent'] || '']
      );
      broadcast({ type: 'permission_updated', roleId: id, module: p.module, department_id: dept });
    }

    // Invalidate all permission caches for this role
    await cacheService.invalidatePattern(CacheKeys.invalidateRole(id));
    await cacheService.invalidatePattern(CacheKeys.invalidatePermissions());
    
    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Update role permissions error:', error);
    res.status(500).json({ error: 'Failed to update role permissions' });
  }
};