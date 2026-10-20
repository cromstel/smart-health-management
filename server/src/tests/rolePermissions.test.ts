import { describe, it, expect, afterEach } from 'vitest';
import pool from '../config/database.js';
import {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  updateRolePermissions,
  deleteRole,
} from '../controllers/role.controller.js';

const makeRes = () => {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.jsonData = undefined;
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

const makeReq = (overrides: Record<string, unknown> = {}) => ({
  body: {},
  params: {},
  query: {},
  ip: '127.0.0.1',
  headers: { 'user-agent': 'vitest' },
  user: { id: 1, email: 'superadmin@smarthealth.com', role: 'super_admin' },
  ...overrides,
}) as any;

const uniqueRoleName = () => `test-role-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

/**
 * The database probe runs at module load, not in a beforeAll hook: the
 * `it` registrations below are evaluated while the file is collected, which
 * happens before any hook runs, so a flag set in beforeAll would still be
 * false here and every case would be skipped.
 */
const dbAvailable = await (async () => {
  try {
    await pool.query('SELECT 1 FROM roles LIMIT 1');
    return true;
  } catch (error) {
    console.warn(
      'Role tests skipped: database not available',
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
})();

describe('Role and role permissions', () => {
  const createdRoleIds: number[] = [];

  afterEach(async () => {
    while (createdRoleIds.length > 0) {
      const id = createdRoleIds.pop();
      await pool.query('DELETE FROM roles WHERE id = ?', [id]);
    }
  });

  const skipIfNoDb = () => (dbAvailable ? it : it.skip);

  skipIfNoDb()('creates a role without a parent_id column', async () => {
    const res = makeRes();
    await createRole(
      makeReq({
        body: {
          name: uniqueRoleName(),
          description: 'Created by the role test',
          // The roles table has no parent_id column: a client supplied value is
          // ignored instead of breaking the insert.
          parent_id: 99,
        },
      }),
      res
    );

    expect(res.statusCode).toBe(201);
    // roles.id is a BIGINT UNSIGNED AUTO_INCREMENT column.
    expect(typeof res.jsonData.id).toBe('number');
    expect(res.jsonData.parent_id).toBeUndefined();
    createdRoleIds.push(res.jsonData.id);

    const [rows] = await pool.query('SELECT * FROM roles WHERE id = ?', [res.jsonData.id]);
    const role = (rows as any[])[0];
    expect(role.name).toMatch(/^test-role-/);
    expect(role.parent_id).toBeUndefined();
  });

  skipIfNoDb()('writes the role id into audit_logs.record_id', async () => {
    const res = makeRes();
    await createRole(makeReq({ body: { name: uniqueRoleName() } }), res);
    expect(res.statusCode).toBe(201);
    const id = res.jsonData.id;
    createdRoleIds.push(id);

    const [rows] = await pool.query(
      `SELECT record_id FROM audit_logs WHERE module = 'role' AND action = 'create' ORDER BY id DESC LIMIT 1`
    );
    expect((rows as any[]).length).toBe(1);
    expect(String((rows as any[])[0].record_id)).toBe(String(id));
  });

  skipIfNoDb()('updates a role and ignores mass assignment', async () => {
    const createRes = makeRes();
    await createRole(makeReq({ body: { name: uniqueRoleName() } }), createRes);
    const id = createRes.jsonData.id;
    createdRoleIds.push(id);

    const res = makeRes();
    await updateRole(
      makeReq({
        params: { id: String(id) },
        body: {
          description: 'Updated by the role test',
          // Neither of these may reach the database.
          user_count: 999,
          id: 424242,
        },
      }),
      res
    );

    expect(res.statusCode).toBe(200);

    const [rows] = await pool.query('SELECT id, description, user_count FROM roles WHERE id = ?', [id]);
    const role = (rows as any[])[0];
    expect(role.description).toBe('Updated by the role test');
    expect(Number(role.user_count)).toBe(0);
    expect(Number(role.id)).toBe(id);
  });

  skipIfNoDb()('rejects a role update without a single updatable field', async () => {
    const createRes = makeRes();
    await createRole(makeReq({ body: { name: uniqueRoleName() } }), createRes);
    const id = createRes.jsonData.id;
    createdRoleIds.push(id);

    const res = makeRes();
    await updateRole(
      makeReq({ params: { id: String(id) }, body: { user_count: 999 } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  skipIfNoDb()('stores permissions without a department_id column', async () => {
    const createRes = makeRes();
    await createRole(makeReq({ body: { name: uniqueRoleName() } }), createRes);
    const id = createRes.jsonData.id;
    createdRoleIds.push(id);

    const res = makeRes();
    await updateRolePermissions(
      makeReq({
        params: { id: String(id) },
        body: {
          permissions: [
            { module: 'patients', view: true, add: true, edit: false, delete: false },
            { module: 'staff', view: true, add: false, edit: false, delete: false },
          ],
        },
      }),
      res
    );

    expect(res.statusCode).toBe(200);

    const [rows] = await pool.query(
      'SELECT module, can_view, can_add, can_edit, can_delete FROM permissions WHERE role_id = ? ORDER BY module',
      [id]
    );
    const permissions = rows as any[];
    expect(permissions.length).toBe(2);
    expect(permissions[0].module).toBe('patients');
    expect(permissions[0].can_view).toBe(1);
    expect(permissions[0].can_add).toBe(1);
    expect(permissions[0].can_edit).toBe(0);
    expect(permissions[1].module).toBe('staff');
    expect(permissions[1].can_view).toBe(1);
    expect(permissions[1].can_add).toBe(0);
  });

  skipIfNoDb()('updates an existing permission row instead of duplicating it', async () => {
    const createRes = makeRes();
    await createRole(makeReq({ body: { name: uniqueRoleName() } }), createRes);
    const id = createRes.jsonData.id;
    createdRoleIds.push(id);

    const first = makeRes();
    await updateRolePermissions(
      makeReq({
        params: { id: String(id) },
        body: { permissions: [{ module: 'appointments', view: true, add: false }] },
      }),
      first
    );
    expect(first.statusCode).toBe(200);

    const second = makeRes();
    await updateRolePermissions(
      makeReq({
        params: { id: String(id) },
        body: { permissions: [{ module: 'appointments', view: false, add: true }] },
      }),
      second
    );
    expect(second.statusCode).toBe(200);

    const [rows] = await pool.query(
      'SELECT can_view, can_add FROM permissions WHERE role_id = ? AND module = ?',
      [id, 'appointments']
    );
    expect((rows as any[]).length).toBe(1);
    expect((rows as any[])[0].can_view).toBe(0);
    expect((rows as any[])[0].can_add).toBe(1);
  });

  skipIfNoDb()('rejects a permissions payload that is not an array', async () => {
    const createRes = makeRes();
    await createRole(makeReq({ body: { name: uniqueRoleName() } }), createRes);
    const id = createRes.jsonData.id;
    createdRoleIds.push(id);

    const res = makeRes();
    await updateRolePermissions(
      makeReq({ params: { id: String(id) }, body: { permissions: 'nope' } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  skipIfNoDb()('lists roles together with their permissions', async () => {
    const createRes = makeRes();
    await createRole(makeReq({ body: { name: uniqueRoleName() } }), createRes);
    const id = createRes.jsonData.id;
    createdRoleIds.push(id);

    const permissionRes = makeRes();
    await updateRolePermissions(
      makeReq({
        params: { id: String(id) },
        body: { permissions: [{ module: 'documents', view: true, add: false, edit: true, delete: false }] },
      }),
      permissionRes
    );
    expect(permissionRes.statusCode).toBe(200);

    const res = makeRes();
    await getRoles(makeReq(), res);
    expect(res.statusCode).toBe(200);

    const roles = res.jsonData as any[];
    expect(Array.isArray(roles)).toBe(true);
    const role = roles.find((entry) => Number(entry.id) === id);
    expect(role).toBeDefined();
    expect(role.permissions).toBeDefined();
    expect(role.permissions.documents).toEqual({
      view: true,
      add: false,
      edit: true,
      delete: false,
    });
  });

  skipIfNoDb()('reads a single role with its permissions', async () => {
    const createRes = makeRes();
    await createRole(makeReq({ body: { name: uniqueRoleName() } }), createRes);
    const id = createRes.jsonData.id;
    createdRoleIds.push(id);

    const permissionRes = makeRes();
    await updateRolePermissions(
      makeReq({
        params: { id: String(id) },
        body: { permissions: [{ module: 'financial', view: true }] },
      }),
      permissionRes
    );
    expect(permissionRes.statusCode).toBe(200);

    const res = makeRes();
    await getRoleById(makeReq({ params: { id: String(id) } }), res);
    expect(res.statusCode).toBe(200);
    expect(Number(res.jsonData.id)).toBe(id);
    expect(res.jsonData.permissions.financial.view).toBe(true);
  });

  skipIfNoDb()('deletes a role and its permissions', async () => {
    const createRes = makeRes();
    await createRole(makeReq({ body: { name: uniqueRoleName() } }), createRes);
    const id = createRes.jsonData.id;

    const permissionRes = makeRes();
    await updateRolePermissions(
      makeReq({
        params: { id: String(id) },
        body: { permissions: [{ module: 'patients', view: true }] },
      }),
      permissionRes
    );
    expect(permissionRes.statusCode).toBe(200);

    const res = makeRes();
    await deleteRole(makeReq({ params: { id: String(id) } }), res);
    expect(res.statusCode).toBe(200);

    const [rows] = await pool.query('SELECT id FROM roles WHERE id = ?', [id]);
    expect((rows as any[]).length).toBe(0);

    const [permissionRows] = await pool.query('SELECT id FROM permissions WHERE role_id = ?', [id]);
    expect((permissionRows as any[]).length).toBe(0);
  });
});
