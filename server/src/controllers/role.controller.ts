import type { Response } from 'express';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { broadcast } from '../events/permissions.js';

/**
 * Columns a client may change through PUT /api/roles/:id.
 *
 * The update used to build its SET clause from every key of the request body,
 * which allowed a caller to rewrite `id`, `user_count` or any other column
 * of the table. Only the descriptive columns are writable.
 */
const ALLOWED_UPDATE_FIELDS = ['name', 'description'];

/** Raised for input the caller can correct; answered with 400, not 500. */
class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

/** Path parameters are strings; only a positive integer can address a row. */
const parseId = (value: unknown): number | null => {
  const asString = String(value ?? '');
  if (!/^\d+$/.test(asString)) return null;
  const parsed = Number(asString);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const isDuplicateEntry = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'ER_DUP_ENTRY';

type PermissionFlags = {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
};

/**
 * Groups the permission rows of the joined query by role and by module, which
 * is the shape the client expects (`role.permissions[module].view`).
 */
const attachPermissions = (roles: any[], permissionRows: any[]): any[] => {
  const byRole = new Map<number, Record<string, PermissionFlags>>();

  for (const permission of permissionRows) {
    if (!permission || !permission.module) continue;
    const roleId = Number(permission.role_id);
    const modules = byRole.get(roleId) ?? {};
    modules[permission.module] = {
      view: Boolean(permission.can_view),
      add: Boolean(permission.can_add),
      edit: Boolean(permission.can_edit),
      delete: Boolean(permission.can_delete),
    };
    byRole.set(roleId, modules);
  }

  return roles.map((role) => ({
    ...role,
    permissions: byRole.get(Number(role.id)) ?? {},
  }));
};

/** Reads a permission flag under either the short or the column name. */
const readFlag = (
  entry: Record<string, unknown>,
  shortKey: 'view' | 'add' | 'edit' | 'delete',
  columnKey: 'can_view' | 'can_add' | 'can_edit' | 'can_delete'
): boolean => {
  if (entry[shortKey] !== undefined) return Boolean(entry[shortKey]);
  if (entry[columnKey] !== undefined) return Boolean(entry[columnKey]);
  return false;
};

export const getRoles = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    // The permissions table has no department_id column; a permission is
    // (role, module) and nothing more. Roles and permissions are read
    // separately and joined in memory, so a role with many permissions is not
    // returned once per permission.
    // `user_count` is a stored column that nothing ever maintained, so it
    // always read 0. It is derived here instead, from the users that
    // actually point at the role.
    const [roleRows] = await pool.query(
      `SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
       FROM roles r ORDER BY r.id`
    );
    const [permissionRows] = await pool.query(
      'SELECT role_id, module, can_view, can_add, can_edit, can_delete FROM permissions ORDER BY role_id, module'
    );

    res.json(attachPermissions(roleRows as any[], permissionRows as any[]));
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

export const getRoleById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const roleId = parseId(id);

    if (roleId === null) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const [roleRows] = await pool.query(
      `SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
       FROM roles r WHERE r.id = ?`,
      [roleId]
    );
    if ((roleRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const [permissionRows] = await pool.query(
      'SELECT role_id, module, can_view, can_add, can_edit, can_delete FROM permissions WHERE role_id = ? ORDER BY module',
      [roleId]
    );

    res.json(attachPermissions(roleRows as any[], permissionRows as any[])[0]);
  } catch (error) {
    console.error('Get role by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
};

export const createRole = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = body.name;
    const description = body.description;

    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Role name is required' });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Role name is too long' });
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return res.status(400).json({ error: 'Description must be a string' });
    }

    // The roles table has no parent_id column, so a hierarchy is not modelled
    // and a client supplied parent_id is ignored rather than written.
    // roles.id is a BIGINT UNSIGNED AUTO_INCREMENT column, so the identifier
    // comes from the insert result.
    const [result] = await pool.query('INSERT INTO roles (name, description) VALUES (?, ?)', [
      name.trim(),
      description ?? null,
    ]);
    const id = (result as any).insertId;

    const userId = (req.user && req.user.id) || null;
    const oldValue = null;
    const newValue = JSON.stringify({ id, name: name.trim(), description: description ?? null });
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, 'create', 'role', ?, ?, ?, ?, ?)`,
      [userId, String(id), oldValue, newValue, req.ip, req.headers['user-agent'] || '']
    );

    broadcast({ type: 'role_created', roleId: id, name: name.trim() });

    res.status(201).json({ message: 'Role created successfully', id });
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return res.status(409).json({ error: 'A role with that name already exists' });
    }
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
};

export const updateRole = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const roleId = parseId(id);

    if (roleId === null) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    for (const column of ALLOWED_UPDATE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(body, column)) continue;
      const value = body[column];

      if (column === 'name') {
        if (typeof value !== 'string' || value.trim() === '') {
          throw new InvalidInputError('Role name cannot be empty');
        }
        if (value.trim().length > 100) {
          throw new InvalidInputError('Role name is too long');
        }
        updates[column] = value.trim();
      } else {
        if (value === null) {
          updates[column] = null;
          continue;
        }
        if (typeof value !== 'string') {
          throw new InvalidInputError('Description must be a string');
        }
        updates[column] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const [existingRows] = await pool.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    const before = (existingRows as any[])[0] || null;

    if (!before) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const fields = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    await pool.query(`UPDATE roles SET ${fields} WHERE id = ?`, [...values, roleId]);

    const [afterRows] = await pool.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    const after = (afterRows as any[])[0] || null;

    const userId = (req.user && req.user.id) || null;
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, 'update', 'role', ?, ?, ?, ?, ?)`,
      [userId, String(roleId), JSON.stringify(before), JSON.stringify(after), req.ip, req.headers['user-agent'] || '']
    );
    broadcast({ type: 'role_updated', roleId });
    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return res.status(400).json({ error: error.message });
    }
    if (isDuplicateEntry(error)) {
      return res.status(409).json({ error: 'A role with that name already exists' });
    }
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

export const deleteRole = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const roleId = parseId(id);

    if (roleId === null) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const [existingRows] = await pool.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    const before = (existingRows as any[])[0] || null;

    if (!before) {
      return res.status(404).json({ error: 'Role not found' });
    }

    await pool.query('DELETE FROM roles WHERE id = ?', [roleId]);

    const userId = (req.user && req.user.id) || null;
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, 'delete', 'role', ?, ?, ?, ?, ?)`,
      [userId, String(roleId), JSON.stringify(before), null, req.ip, req.headers['user-agent'] || '']
    );
    broadcast({ type: 'role_deleted', roleId });
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
};

export const updateRolePermissions = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params; // role id
    const roleId = parseId(id);

    if (roleId === null) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const permissions = body.permissions;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Invalid permissions payload' });
    }

    const [roleRows] = await pool.query('SELECT id FROM roles WHERE id = ? LIMIT 1', [roleId]);
    if ((roleRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    for (const rawEntry of permissions) {
      if (!rawEntry || typeof rawEntry !== 'object') {
        return res.status(400).json({ error: 'Invalid permissions payload' });
      }

      const entry = rawEntry as Record<string, unknown>;
      const module = String(entry.module ?? '').trim();

      if (!module) {
        return res.status(400).json({ error: 'Permission module is required' });
      }
      if (module.length > 50) {
        return res.status(400).json({ error: 'Permission module is too long' });
      }

      // The permissions table has no department_id column: a permission is
      // (role, module) plus the four capability flags. A department_id in the
      // payload is ignored.
      const canView = readFlag(entry, 'view', 'can_view');
      const canAdd = readFlag(entry, 'add', 'can_add');
      const canEdit = readFlag(entry, 'edit', 'can_edit');
      const canDelete = readFlag(entry, 'delete', 'can_delete');

      const [existing] = await pool.query(
        'SELECT * FROM permissions WHERE role_id = ? AND module = ?',
        [roleId, module]
      );
      const before = (existing as any[])[0] || null;

      if (before) {
        await pool.query(
          'UPDATE permissions SET can_view = ?, can_add = ?, can_edit = ?, can_delete = ? WHERE id = ?',
          [canView, canAdd, canEdit, canDelete, before.id]
        );
      } else {
        await pool.query(
          'INSERT INTO permissions (role_id, module, can_view, can_add, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)',
          [roleId, module, canView, canAdd, canEdit, canDelete]
        );
      }

      const [afterRows] = await pool.query(
        'SELECT * FROM permissions WHERE role_id = ? AND module = ?',
        [roleId, module]
      );
      const after = (afterRows as any[])[0] || null;

      const userId = (req.user && req.user.id) || null;
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address, user_agent)
         VALUES (?, 'permission_update', 'permissions', ?, ?, ?, ?, ?)`,
        [userId, after?.id || before?.id || null, JSON.stringify(before), JSON.stringify(after), req.ip, req.headers['user-agent'] || '']
      );
      broadcast({ type: 'permission_updated', roleId, module });
    }

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Update role permissions error:', error);
    res.status(500).json({ error: 'Failed to update role permissions' });
  }
};
