import { describe, it, expect, afterEach } from 'vitest';
import pool from '../config/database.js';
import {
  createPatient,
  updatePatient,
  deletePatient,
  getPatientById,
} from '../controllers/patient.controller.js';

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
  // The tenant scope the authentication middleware works out and the
  // permission check confines the request to. The seeded clinician belongs to
  // the first hospital.
  tenant: { hospitalId: 1, hospitalCode: 'HOSP-001', platformWide: true },
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
    await pool.query('SELECT 1 FROM patients LIMIT 1');
    return true;
  } catch (error) {
    console.warn(
      'Patient tests skipped: database not available',
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
})();

describe('Patient CRUD', () => {
  const createdIds: number[] = [];

  afterEach(async () => {
    while (createdIds.length > 0) {
      const id = createdIds.pop();
      await pool.query('DELETE FROM patients WHERE id = ?', [id]);
    }
  });

  const skipIfNoDb = () => (dbAvailable ? it : it.skip);

  skipIfNoDb()('creates a patient with a generated patient_id and a numeric primary key', async () => {
    const res = makeRes();
    await createPatient(
      makeReq({
        body: {
          first_name: 'Test',
          last_name: 'Patient',
          age: 42,
          gender: 'female',
          phone: '+233201000001',
          email: 'test.patient@example.com',
          address: 'Test Address',
        },
      }),
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.jsonData.patientId).toMatch(/^PAT-[A-Z2-9]{6}$/);
    // patients.id is a BIGINT UNSIGNED AUTO_INCREMENT column: the created row
    // is addressed by the generated key, never by a uuid.
    expect(typeof res.jsonData.id).toBe('number');
    expect(res.jsonData.id).toBeGreaterThan(0);
    createdIds.push(res.jsonData.id);

    const [rows] = await pool.query('SELECT id, patient_id, first_name FROM patients WHERE id = ?', [
      res.jsonData.id,
    ]);
    expect((rows as any[]).length).toBe(1);
    expect((rows as any[])[0].patient_id).toBe(res.jsonData.patientId);
  });

  skipIfNoDb()('accepts the camelCase spelling used by some clients', async () => {
    const res = makeRes();
    await createPatient(
      makeReq({ body: { firstName: 'Camel', lastName: 'Case' } }),
      res
    );

    expect(res.statusCode).toBe(201);
    createdIds.push(res.jsonData.id);
  });

  skipIfNoDb()('rejects a patient without a name', async () => {
    const res = makeRes();
    await createPatient(makeReq({ body: { age: 30 } }), res);
    expect(res.statusCode).toBe(400);
  });

  skipIfNoDb()('rejects a patient for an unknown hospital', async () => {
    const res = makeRes();
    await createPatient(
      makeReq({ body: { first_name: 'No', last_name: 'Hospital', hospital_id: 999999 } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  skipIfNoDb()('updates only whitelisted columns and ignores mass assignment', async () => {
    const createRes = makeRes();
    await createPatient(
      makeReq({ body: { first_name: 'Before', last_name: 'Change', age: 30 } }),
      createRes
    );
    expect(createRes.statusCode).toBe(201);
    const id = createRes.jsonData.id;
    createdIds.push(id);

    const updateRes = makeRes();
    await updatePatient(
      makeReq({
        params: { id: String(id) },
        body: {
          first_name: 'After',
          age: 31,
          // Neither of these may reach the database.
          patient_id: 'PAT-HACKED',
          id: 424242,
        },
      }),
      updateRes
    );

    expect(updateRes.statusCode).toBe(200);

    const [rows] = await pool.query(
      'SELECT id, patient_id, first_name, age FROM patients WHERE id = ?',
      [id]
    );
    const row = (rows as any[])[0];
    // first_name is stored encrypted, so the plaintext must not be in the row.
    expect(row.first_name).not.toBe('After');
    expect(row.age).toBe(31);
    expect(row.patient_id).not.toBe('PAT-HACKED');
    expect(Number(row.id)).toBe(id);

    // The read path decrypts the field again, which proves the update landed.
    const readRes = makeRes();
    await getPatientById(makeReq({ params: { id: String(id) } }), readRes);
    expect(readRes.statusCode).toBe(200);
    expect(readRes.jsonData.first_name).toBe('After');
    expect(readRes.jsonData.age).toBe(31);
    expect(readRes.jsonData.patient_id).not.toBe('PAT-HACKED');
  });

  skipIfNoDb()('rejects an update without a single updatable field', async () => {
    const createRes = makeRes();
    await createPatient(makeReq({ body: { first_name: 'Nothing', last_name: 'ToChange' } }), createRes);
    const id = createRes.jsonData.id;
    createdIds.push(id);

    const updateRes = makeRes();
    await updatePatient(
      makeReq({ params: { id: String(id) }, body: { patient_id: 'PAT-HACKED' } }),
      updateRes
    );
    expect(updateRes.statusCode).toBe(400);
  });

  skipIfNoDb()('answers 404 for a patient that does not exist', async () => {
    const res = makeRes();
    await getPatientById(makeReq({ params: { id: '99999999' } }), res);
    expect(res.statusCode).toBe(404);
  });

  skipIfNoDb()('deletes a patient', async () => {
    const createRes = makeRes();
    await createPatient(makeReq({ body: { first_name: 'To', last_name: 'Delete' } }), createRes);
    const id = createRes.jsonData.id;

    const res = makeRes();
    await deletePatient(makeReq({ params: { id: String(id) } }), res);
    expect(res.statusCode).toBe(200);

    const [rows] = await pool.query('SELECT id FROM patients WHERE id = ?', [id]);
    expect((rows as any[]).length).toBe(0);
  });
});
