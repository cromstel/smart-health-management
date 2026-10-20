import { describe, it, expect, afterEach } from 'vitest';
import pool from '../config/database.js';
import {
  createStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
} from '../controllers/staff.controller.js';

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

/**
 * The database probe runs at module load, not in a beforeAll hook: the
 * `it` registrations below are evaluated while the file is collected, which
 * happens before any hook runs, so a flag set in beforeAll would still be
 * false here and every case would be skipped.
 */
const dbAvailable = await (async () => {
  try {
    await pool.query('SELECT 1 FROM staff LIMIT 1');
    return true;
  } catch (error) {
    console.warn(
      'Staff tests skipped: database not available',
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
})();

describe('Staff CRUD', () => {
  const createdIds: number[] = [];

  afterEach(async () => {
    while (createdIds.length > 0) {
      const id = createdIds.pop();
      await pool.query('DELETE FROM staff WHERE id = ?', [id]);
    }
  });

  const skipIfNoDb = () => (dbAvailable ? it : it.skip);

  skipIfNoDb()('creates a staff member with a generated staff_id', async () => {
    const res = makeRes();
    await createStaff(
      makeReq({
        body: {
          firstName: 'Test',
          lastName: 'Nurse',
          email: 'test.nurse@example.com',
          phone: '+233201000002',
          role: 'nurse',
          hospitalId: 1,
          status: 'Active',
        },
      }),
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.jsonData.staffId).toMatch(/^STF-[A-Z2-9]{6}$/);
    // staff.id is a BIGINT UNSIGNED AUTO_INCREMENT column.
    expect(typeof res.jsonData.id).toBe('number');
    createdIds.push(res.jsonData.id);

    const [rows] = await pool.query('SELECT id, staff_id, role, status FROM staff WHERE id = ?', [
      res.jsonData.id,
    ]);
    expect((rows as any[]).length).toBe(1);
    expect((rows as any[])[0].staff_id).toBe(res.jsonData.staffId);
    expect((rows as any[])[0].status).toBe('active');
  });

  skipIfNoDb()('stores the role name, never the numeric role id', async () => {
    const [roleRows] = await pool.query('SELECT id, name FROM roles ORDER BY id LIMIT 1');
    const role = (roleRows as any[])[0];
    expect(role).toBeDefined();

    const res = makeRes();
    await createStaff(
      makeReq({
        body: {
          firstName: 'Role',
          lastName: 'Resolution',
          roleId: role.id,
          hospitalId: 1,
        },
      }),
      res
    );

    expect(res.statusCode).toBe(201);
    createdIds.push(res.jsonData.id);

    const [rows] = await pool.query('SELECT role FROM staff WHERE id = ?', [res.jsonData.id]);
    expect((rows as any[])[0].role).toBe(role.name);
    expect(String((rows as any[])[0].role)).not.toBe(String(role.id));
  });

  skipIfNoDb()('rejects a staff member without a role', async () => {
    const res = makeRes();
    await createStaff(
      makeReq({ body: { firstName: 'No', lastName: 'Role', hospitalId: 1 } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  skipIfNoDb()('rejects a staff member for an unknown hospital', async () => {
    const res = makeRes();
    await createStaff(
      makeReq({ body: { firstName: 'No', lastName: 'Hospital', role: 'nurse', hospitalId: 999999 } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  skipIfNoDb()('rejects a department that belongs to another hospital', async () => {
    const [departmentRows] = await pool.query(
      'SELECT id, hospital_id FROM departments ORDER BY id LIMIT 1'
    );
    const department = (departmentRows as any[])[0];
    if (!department) return;

    const res = makeRes();
    await createStaff(
      makeReq({
        body: {
          firstName: 'Wrong',
          lastName: 'Hospital',
          role: 'nurse',
          hospitalId: 999999,
          departmentId: department.id,
        },
      }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  skipIfNoDb()('reads a staff member by id', async () => {
    const createRes = makeRes();
    await createStaff(
      makeReq({ body: { firstName: 'Read', lastName: 'Back', role: 'nurse', hospitalId: 1 } }),
      createRes
    );
    expect(createRes.statusCode).toBe(201);
    const id = createRes.jsonData.id;
    createdIds.push(id);

    const res = makeRes();
    await getStaffById(makeReq({ params: { id: String(id) } }), res);
    expect(res.statusCode).toBe(200);
    expect(Number(res.jsonData.id)).toBe(id);
    expect(res.jsonData.first_name).toBe('Read');
    expect(res.jsonData.role).toBe('nurse');
  });

  skipIfNoDb()('answers 404 for a staff member that does not exist', async () => {
    const res = makeRes();
    await getStaffById(makeReq({ params: { id: '99999999' } }), res);
    expect(res.statusCode).toBe(404);
  });

  skipIfNoDb()('updates a staff member and ignores mass assignment', async () => {
    const createRes = makeRes();
    await createStaff(
      makeReq({ body: { firstName: 'Before', lastName: 'Update', role: 'nurse', hospitalId: 1 } }),
      createRes
    );
    const id = createRes.jsonData.id;
    const originalStaffId = createRes.jsonData.staffId;
    createdIds.push(id);

    const updateRes = makeRes();
    await updateStaff(
      makeReq({
        params: { id: String(id) },
        body: {
          firstName: 'After',
          phone: '+233201000003',
          status: 'On Leave',
          // Neither of these may reach the database.
          staff_id: 'STF-HACKED',
          id: 424242,
        },
      }),
      updateRes
    );

    expect(updateRes.statusCode).toBe(200);

    const [rows] = await pool.query(
      'SELECT id, staff_id, first_name, phone, status FROM staff WHERE id = ?',
      [id]
    );
    const row = (rows as any[])[0];
    expect(row.staff_id).toBe(originalStaffId);
    expect(row.status).toBe('on_leave');
    expect(Number(row.id)).toBe(id);

    const readRes = makeRes();
    await getStaffById(makeReq({ params: { id: String(id) } }), readRes);
    expect(readRes.jsonData.first_name).toBe('After');
  });

  skipIfNoDb()('rejects an update without a single updatable field', async () => {
    const createRes = makeRes();
    await createStaff(
      makeReq({ body: { firstName: 'Nothing', lastName: 'ToChange', role: 'nurse' } }),
      createRes
    );
    const id = createRes.jsonData.id;
    createdIds.push(id);

    const updateRes = makeRes();
    await updateStaff(
      makeReq({ params: { id: String(id) }, body: { staff_id: 'STF-HACKED' } }),
      updateRes
    );
    expect(updateRes.statusCode).toBe(400);
  });

  skipIfNoDb()('deletes a staff member', async () => {
    const createRes = makeRes();
    await createStaff(
      makeReq({ body: { firstName: 'To', lastName: 'Delete', role: 'nurse' } }),
      createRes
    );
    const id = createRes.jsonData.id;

    const res = makeRes();
    await deleteStaff(makeReq({ params: { id: String(id) } }), res);
    expect(res.statusCode).toBe(200);

    const [rows] = await pool.query('SELECT id FROM staff WHERE id = ?', [id]);
    expect((rows as any[]).length).toBe(0);
  });
});
