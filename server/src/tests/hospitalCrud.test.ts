import { describe, it, expect, afterEach } from 'vitest';
import pool from '../config/database.js';
import {
  createHospital,
  getHospitalById,
  getHospitalDepartments,
  updateHospital,
  deleteHospital,
} from '../controllers/hospital.controller.js';

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
    await pool.query('SELECT 1 FROM hospitals LIMIT 1');
    return true;
  } catch (error) {
    console.warn(
      'Hospital tests skipped: database not available',
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
})();

describe('Hospital CRUD', () => {
  const createdIds: number[] = [];

  afterEach(async () => {
    while (createdIds.length > 0) {
      const id = createdIds.pop();
      await pool.query('DELETE FROM hospitals WHERE id = ?', [id]);
    }
  });

  const skipIfNoDb = () => (dbAvailable ? it : it.skip);

  skipIfNoDb()('creates a hospital with a generated hospital_id and the postal columns', async () => {
    const res = makeRes();
    await createHospital(
      makeReq({
        body: {
          name: 'Test General Hospital',
          address: '1 Test Street',
          city: 'Accra',
          state: 'Greater Accra',
          zipCode: 'GA-123-4567',
          phone: '+233302000001',
          email: 'hospital@example.com',
        },
      }),
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.jsonData.hospitalId).toMatch(/^HOSP-[A-Z2-9]{6}$/);
    // hospitals.id is a BIGINT UNSIGNED AUTO_INCREMENT column.
    expect(typeof res.jsonData.id).toBe('number');
    createdIds.push(res.jsonData.id);

    const [rows] = await pool.query(
      'SELECT id, hospital_id, name, city, state, zip_code FROM hospitals WHERE id = ?',
      [res.jsonData.id]
    );
    const hospital = (rows as any[])[0];
    expect(hospital.hospital_id).toBe(res.jsonData.hospitalId);
    expect(hospital.name).toBe('Test General Hospital');
    expect(hospital.city).toBe('Accra');
    expect(hospital.state).toBe('Greater Accra');
    expect(hospital.zip_code).toBe('GA-123-4567');
  });

  skipIfNoDb()('rejects a hospital without a name', async () => {
    const res = makeRes();
    await createHospital(makeReq({ body: { city: 'Accra' } }), res);
    expect(res.statusCode).toBe(400);
  });

  skipIfNoDb()('reads a hospital by id', async () => {
    const createRes = makeRes();
    await createHospital(makeReq({ body: { name: 'Readable Hospital' } }), createRes);
    expect(createRes.statusCode).toBe(201);
    const id = createRes.jsonData.id;
    createdIds.push(id);

    const res = makeRes();
    await getHospitalById(makeReq({ params: { id: String(id) } }), res);
    expect(res.statusCode).toBe(200);
    expect(Number(res.jsonData.id)).toBe(id);
    expect(res.jsonData.name).toBe('Readable Hospital');
  });

  skipIfNoDb()('lists the departments of a hospital', async () => {
    const [hospitalRows] = await pool.query('SELECT id FROM hospitals ORDER BY id LIMIT 1');
    const hospital = (hospitalRows as any[])[0];
    if (!hospital) return;

    const res = makeRes();
    await getHospitalDepartments(makeReq({ params: { id: String(hospital.id) } }), res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.jsonData)).toBe(true);
  });

  skipIfNoDb()('updates a hospital and ignores mass assignment', async () => {
    const createRes = makeRes();
    await createHospital(makeReq({ body: { name: 'Before Update', city: 'Accra' } }), createRes);
    const id = createRes.jsonData.id;
    const originalHospitalId = createRes.jsonData.hospitalId;
    createdIds.push(id);

    const res = makeRes();
    await updateHospital(
      makeReq({
        params: { id: String(id) },
        body: {
          name: 'After Update',
          city: 'Kumasi',
          state: 'Ashanti',
          zip_code: 'AK-000-1111',
          // Neither of these may reach the database.
          hospital_id: 'HOSP-HACKED',
          id: 424242,
        },
      }),
      res
    );

    expect(res.statusCode).toBe(200);

    const [rows] = await pool.query(
      'SELECT id, hospital_id, name, city, state, zip_code FROM hospitals WHERE id = ?',
      [id]
    );
    const hospital = (rows as any[])[0];
    expect(hospital.name).toBe('After Update');
    expect(hospital.city).toBe('Kumasi');
    expect(hospital.state).toBe('Ashanti');
    expect(hospital.zip_code).toBe('AK-000-1111');
    expect(hospital.hospital_id).toBe(originalHospitalId);
    expect(Number(hospital.id)).toBe(id);
  });

  skipIfNoDb()('rejects an update without a single updatable field', async () => {
    const createRes = makeRes();
    await createHospital(makeReq({ body: { name: 'Nothing To Change' } }), createRes);
    const id = createRes.jsonData.id;
    createdIds.push(id);

    const res = makeRes();
    await updateHospital(
      makeReq({ params: { id: String(id) }, body: { hospital_id: 'HOSP-HACKED' } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  skipIfNoDb()('deletes a hospital', async () => {
    const createRes = makeRes();
    await createHospital(makeReq({ body: { name: 'To Delete' } }), createRes);
    const id = createRes.jsonData.id;

    const res = makeRes();
    await deleteHospital(makeReq({ params: { id: String(id) } }), res);
    expect(res.statusCode).toBe(200);

    const [rows] = await pool.query('SELECT id FROM hospitals WHERE id = ?', [id]);
    expect((rows as any[]).length).toBe(0);
  });
});
