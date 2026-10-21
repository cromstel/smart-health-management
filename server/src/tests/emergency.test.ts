/**
 * Emergency triage board and ER bed state.
 *
 * The suite drives the real router over HTTP against the live database, so
 * it covers the whole chain: authentication, the permission check, the
 * express-validator rules, the controller and the service (including the
 * transaction that keeps `emergency_beds` and `emergency_admissions` in
 * step).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mintToken as mintSessionToken } from './helpers/mintToken.js';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import pool from '../config/database.js';
import { encrypt } from '../utils/encryption.js';
import emergencyRoutes from '../routes/emergency.routes.js';

let dbAvailable = false;
let server: Server | null = null;
let baseUrl = '';
let token = '';

/**
 * The database is probed at module scope, not in `beforeAll`: the `it` /
 * `it.skip` choice is made while the suite is being collected, which happens
 * before any hook runs. A flag set in `beforeAll` would therefore still be
 * false here and every test would be skipped.
 */
try {
  await pool.query('SELECT 1 FROM emergency_beds LIMIT 1');
  dbAvailable = true;
} catch (error) {
  console.warn(
    'Emergency tests skipped: database not available',
    error instanceof Error ? error.message : String(error)
  );
}

const maybeIt = dbAvailable ? it : it.skip;

/** Beds this suite touched, so they can be handed back as they were. */
const touchedBeds = new Set<string>();
/** Patient codes this suite created. */
const createdPatients: string[] = [];

/** `patients.patient_id` is a VARCHAR(20), so the code has to stay short. */
let codeCounter = 0;
const uniqueCode = (prefix: string) =>
  `${prefix}-${(codeCounter += 1).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface ApiResponse {
  status: number;
  body: any;
}

const api = async (
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<ApiResponse> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth !== false) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const body = (() => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return { raw: text };
    }
  })();
  return { status: response.status, body };
};

const createPatient = async (code: string): Promise<number> => {
  const [result] = await pool.query<any>(
    `INSERT INTO patients (patient_id, first_name, last_name, age, gender, hospital_id, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    [code, 'Test', 'Triage', 42, 'female', 1]
  );
  createdPatients.push(code);
  return Number(result.insertId);
};

const bedRow = async (bedId: string) => {
  const [rows] = await pool.query<any[]>('SELECT * FROM emergency_beds WHERE id = ? LIMIT 1', [bedId]);
  return rows[0] ?? null;
};

const admissionRow = async (admissionId: number) => {
  const [rows] = await pool.query<any[]>(
    'SELECT * FROM emergency_admissions WHERE id = ? LIMIT 1',
    [admissionId]
  );
  return rows[0] ?? null;
};

describe('Emergency triage board', () => {
  beforeAll(async () => {
    if (!dbAvailable) return;

    const app = express();
    app.use(express.json());
    app.use('/api/emergency', emergencyRoutes);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/emergency`;

    // The super admin holds the 'all' permission, so every emergency
    // permission resolves without a per-module permissions row.
    token = mintSessionToken(1, 'superadmin@smarthealth.com', 'super_admin', { hospital_id: 'HOSP-001' }, '1h');
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
  });

  afterEach(async () => {
    for (const bedId of touchedBeds) {
      await pool.query(
        `UPDATE emergency_beds
            SET status = 'available', patient_id = NULL, triage_level = NULL
          WHERE id = ?`,
        [bedId]
      );
    }
    touchedBeds.clear();

    while (createdPatients.length > 0) {
      const code = createdPatients.pop();
      // The code blue of this patient is audited against the patient code.
      // The patient is deleted here, so the audit row would point at a
      // record that no longer exists.
      await pool.query("DELETE FROM audit_logs WHERE module = 'emergency' AND record_id = ?", [code]);
      await pool.query('DELETE FROM patients WHERE patient_id = ?', [code]);
    }
  });

  const skipIfNoDb = () => maybeIt;

  skipIfNoDb()('rejects an unauthenticated request', async () => {
    const res = await api('/triage-board', { auth: false });
    expect(res.status).toBe(401);
  });

  skipIfNoDb()('seeds the default bays and lists them', async () => {
    const res = await api('/beds');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.beds)).toBe(true);
    expect(res.body.beds.length).toBeGreaterThanOrEqual(6);

    const ids = res.body.beds.map((bed: any) => bed.id);
    expect(ids).toContain('ER-BAY-01');
    expect(ids).toContain('ER-BAY-06');

    const bay = res.body.beds.find((bed: any) => bed.id === 'ER-BAY-01');
    expect(bay.label).toBeTruthy();
    expect(['occupied', 'available', 'cleaning']).toContain(bay.status);
  });

  skipIfNoDb()('returns the board with the active admissions and the beds', async () => {
    const res = await api('/triage-board');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.patients)).toBe(true);
    expect(Array.isArray(res.body.beds)).toBe(true);
    expect(typeof res.body.hotline).toBe('string');
    expect(res.body.hotline.length).toBeGreaterThan(0);
  });

  skipIfNoDb()('rejects a malformed bed id and an unknown status', async () => {
    const badId = await api('/beds/not a bed id', { method: 'PATCH', body: { status: 'available' } });
    expect(badId.status).toBe(400);

    const badStatus = await api('/beds/ER-BAY-01', {
      method: 'PATCH',
      body: { status: 'nonsense' },
    });
    expect(badStatus.status).toBe(400);
  });

  skipIfNoDb()('answers 404 for a bed that does not exist', async () => {
    const res = await api('/beds/ER-BAY-99', {
      method: 'PATCH',
      body: { status: 'available' },
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BED_NOT_FOUND');
  });

  skipIfNoDb()('admits a patient and shows them on the board', async () => {
    const code = uniqueCode('ER-PAT');
    await createPatient(code);

    const admit = await api('/admissions', {
      method: 'POST',
      body: {
        patientId: code,
        triageLevel: 'RED',
        condition: 'Acute chest pain, suspected STEMI',
        systolicBp: 165,
        diastolicBp: 102,
        heartRate: 112,
        spo2: 93,
      },
    });
    expect(admit.status).toBe(201);
    expect(admit.body.admission.triageLevel).toBe('RED');
    expect(admit.body.admission.condition).toBe('Acute chest pain, suspected STEMI');
    expect(admit.body.admission.bedId).toBeNull();

    const board = await api('/triage-board');
    const entry = board.body.patients.find((patient: any) => patient.id === code);
    expect(entry).toBeDefined();
    expect(entry.name).toBe('Test Triage');
    expect(entry.triageLevel).toBe('RED');
    expect(entry.condition).toBe('Acute chest pain, suspected STEMI');
    expect(entry.bed).toBeNull();
    // No vitals row for this patient: the board must not invent numbers.
    expect(entry.systolicBp).toBeNull();
    expect(entry.diastolicBp).toBeNull();
    expect(entry.heartRate).toBeNull();
    expect(entry.spo2).toBeNull();
    expect(typeof entry.admittedAt).toBe('string');
  });

  skipIfNoDb()('refuses a second active admission for the same patient', async () => {
    const code = uniqueCode('ER-PAT');
    await createPatient(code);

    const first = await api('/admissions', {
      method: 'POST',
      body: { patientId: code, triageLevel: 'AMBER' },
    });
    expect(first.status).toBe(201);

    const second = await api('/admissions', {
      method: 'POST',
      body: { patientId: code, triageLevel: 'RED' },
    });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('ALREADY_ADMITTED');
  });

  skipIfNoDb()('allocates a bed and keeps the admission link in step', async () => {
    const code = uniqueCode('ER-PAT');
    const patientId = await createPatient(code);
    touchedBeds.add('ER-BAY-02');

    const admit = await api('/admissions', {
      method: 'POST',
      body: { patientId: code, triageLevel: 'RED' },
    });
    expect(admit.status).toBe(201);
    const admissionId = admit.body.admission.id;

    const allocate = await api('/beds/ER-BAY-02', {
      method: 'PATCH',
      body: { status: 'occupied', patientId: code, triage: 'RED' },
    });
    expect(allocate.status).toBe(200);
    expect(allocate.body.bed.status).toBe('occupied');
    expect(allocate.body.bed.patient).toBe(code);
    expect(allocate.body.bed.triage).toBe('RED');

    const bed = await bedRow('ER-BAY-02');
    expect(Number(bed.patient_id)).toBe(patientId);
    expect(bed.status).toBe('occupied');

    const admission = await admissionRow(admissionId);
    expect(admission.bed_id).toBe('ER-BAY-02');

    const board = await api('/triage-board');
    const entry = board.body.patients.find((patient: any) => patient.id === code);
    expect(entry.bed).toBe('ER-BAY-02');
  });

  skipIfNoDb()('refuses to hand an occupied bed to another patient', async () => {
    const firstCode = uniqueCode('ER-PAT');
    const secondCode = uniqueCode('ER-PAT');
    await createPatient(firstCode);
    await createPatient(secondCode);
    touchedBeds.add('ER-BAY-03');

    const admit = await api('/admissions', {
      method: 'POST',
      body: { patientId: firstCode, triageLevel: 'RED' },
    });
    expect(admit.status).toBe(201);

    const allocate = await api('/beds/ER-BAY-03', {
      method: 'PATCH',
      body: { status: 'occupied', patientId: firstCode },
    });
    expect(allocate.status).toBe(200);

    const steal = await api('/beds/ER-BAY-03', {
      method: 'PATCH',
      body: { status: 'occupied', patientId: secondCode },
    });
    expect(steal.status).toBe(409);
    expect(steal.body.code).toBe('BED_ALREADY_OCCUPIED');
  });

  skipIfNoDb()('refuses to allocate a bed to a patient that is not admitted', async () => {
    const code = uniqueCode('ER-PAT');
    await createPatient(code);
    touchedBeds.add('ER-BAY-04');

    const res = await api('/beds/ER-BAY-04', {
      method: 'PATCH',
      body: { status: 'occupied', patientId: code },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_ACTIVE_ADMISSION');
  });

  skipIfNoDb()('releases a bed and clears the admission link', async () => {
    const code = uniqueCode('ER-PAT');
    await createPatient(code);
    touchedBeds.add('ER-BAY-05');

    const admit = await api('/admissions', {
      method: 'POST',
      body: { patientId: code, triageLevel: 'AMBER' },
    });
    const admissionId = admit.body.admission.id;

    await api('/beds/ER-BAY-05', {
      method: 'PATCH',
      body: { status: 'occupied', patientId: code },
    });

    const release = await api('/beds/ER-BAY-05', {
      method: 'PATCH',
      body: { status: 'available' },
    });
    expect(release.status).toBe(200);
    expect(release.body.bed.status).toBe('available');
    expect(release.body.bed.patient).toBeNull();

    const bed = await bedRow('ER-BAY-05');
    expect(bed.patient_id).toBeNull();
    expect(bed.status).toBe('available');

    const admission = await admissionRow(admissionId);
    expect(admission.bed_id).toBeNull();
  });

  skipIfNoDb()('refuses to allocate a bed that is still being cleaned', async () => {
    const code = uniqueCode('ER-PAT');
    await createPatient(code);
    touchedBeds.add('ER-BAY-06');

    const admit = await api('/admissions', {
      method: 'POST',
      body: { patientId: code, triageLevel: 'AMBER' },
    });
    expect(admit.status).toBe(201);

    await pool.query("UPDATE emergency_beds SET status = 'cleaning' WHERE id = ?", ['ER-BAY-06']);

    const res = await api('/beds/ER-BAY-06', {
      method: 'PATCH',
      body: { status: 'occupied', patientId: code },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BED_NOT_READY');
  });

  skipIfNoDb()('discharges a patient and puts the bed into cleaning', async () => {
    const code = uniqueCode('ER-PAT');
    await createPatient(code);
    touchedBeds.add('ER-BAY-06');

    const admit = await api('/admissions', {
      method: 'POST',
      body: { patientId: code, triageLevel: 'RED' },
    });
    const admissionId = admit.body.admission.id;

    await api('/beds/ER-BAY-06', {
      method: 'PATCH',
      body: { status: 'occupied', patientId: code },
    });

    const discharge = await api(`/admissions/${admissionId}/discharge`, { method: 'POST' });
    expect(discharge.status).toBe(200);
    expect(discharge.body.admission.status).toBe('discharged');
    expect(discharge.body.admission.dischargedAt).toBeTruthy();
    expect(discharge.body.admission.bedId).toBeNull();
    expect(discharge.body.bed.status).toBe('cleaning');

    const bed = await bedRow('ER-BAY-06');
    expect(bed.status).toBe('cleaning');
    expect(bed.patient_id).toBeNull();

    const board = await api('/triage-board');
    expect(board.body.patients.find((patient: any) => patient.id === code)).toBeUndefined();

    // Discharging twice is refused instead of silently succeeding.
    const again = await api(`/admissions/${admissionId}/discharge`, { method: 'POST' });
    expect(again.status).toBe(409);
  });

  skipIfNoDb()('updates the triage level and the condition of an admission', async () => {
    const code = uniqueCode('ER-PAT');
    await createPatient(code);

    const admit = await api('/admissions', {
      method: 'POST',
      body: { patientId: code, triageLevel: 'AMBER', condition: 'Shortness of breath' },
    });
    const admissionId = admit.body.admission.id;

    const update = await api(`/admissions/${admissionId}`, {
      method: 'PATCH',
      body: { triageLevel: 'RED', condition: 'Worsening respiratory distress', heartRate: 118 },
    });
    expect(update.status).toBe(200);
    expect(update.body.admission.triageLevel).toBe('RED');
    expect(update.body.admission.condition).toBe('Worsening respiratory distress');
    expect(update.body.admission.heartRate).toBe(118);
    // The fields that were not sent keep their value.
    expect(update.body.admission.patientCode).toBe(code);
  });

  skipIfNoDb()('records a code blue in the audit trail without claiming a dispatch', async () => {
    const code = uniqueCode('ER-PAT');
    await createPatient(code);

    const res = await api('/code-blue', {
      method: 'POST',
      body: { patientId: code, note: 'Cardiac arrest in the emergency bay' },
    });
    expect(res.status).toBe(201);
    expect(res.body.codeBlue.dispatched).toBe(false);
    expect(res.body.codeBlue.integration).toBe('none');
    expect(res.body.codeBlue.action).toBe('CODE_BLUE_BROADCAST');
    expect(res.body.codeBlue.module).toBe('emergency');
    expect(res.body.codeBlue.patientId).toBe(code);
    expect(res.body.codeBlue.message).toBeTruthy();

    const [rows] = await pool.query<any[]>(
      `SELECT * FROM audit_logs
        WHERE module = 'emergency' AND action = 'CODE_BLUE_BROADCAST' AND record_id = ?
        ORDER BY id DESC LIMIT 1`,
      [code]
    );
    expect(rows.length).toBe(1);
    expect(String(rows[0].record_id)).toBe(code);
    expect(Number(rows[0].user_id)).toBe(1);
  });

  skipIfNoDb()('lists the real patients and the beds in the options', async () => {
    const code = uniqueCode('ER-PAT');
    await createPatient(code);

    const res = await api('/options');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.patients)).toBe(true);
    expect(Array.isArray(res.body.beds)).toBe(true);
    expect(typeof res.body.hotline).toBe('string');

    const option = res.body.patients.find((patient: any) => patient.patientId === code);
    expect(option).toBeDefined();
    expect(option.name).toBe('Test Triage');
  });

  skipIfNoDb()('decrypts a patient name that was stored encrypted', async () => {
    const code = uniqueCode('ER-PAT');
    const first = 'Test Encrypted First';
    const last = 'Test Encrypted Last';
    const [result] = await pool.query<any>(
      `INSERT INTO patients (patient_id, first_name, last_name, age, gender, hospital_id, status)
       VALUES (?, ?, ?, 30, 'male', 1, 'active')`,
      [code, encrypt(first), encrypt(last)]
    );
    createdPatients.push(code);
    expect(Number(result.insertId)).toBeGreaterThan(0);

    const res = await api('/options');
    expect(res.status).toBe(200);

    const option = res.body.patients.find((patient: any) => patient.patientId === code);
    expect(option).toBeDefined();
    // The ciphertext must never reach the browser as a name.
    expect(option.name).toBe(`${first} ${last}`);
  });

  skipIfNoDb()('restores the default bays when the bed table is empty', async () => {
    await pool.query('DELETE FROM emergency_beds');

    const res = await api('/beds');
    expect(res.status).toBe(200);
    expect(res.body.beds.length).toBe(6);
    expect(res.body.beds.map((bed: any) => bed.id)).toContain('ER-BAY-01');
    expect(res.body.beds.every((bed: any) => bed.status === 'available')).toBe(true);
  });

  skipIfNoDb()('answers 404 for a patient that does not exist', async () => {
    const res = await api('/admissions', {
      method: 'POST',
      body: { patientId: 'ER-NOBODY-000', triageLevel: 'RED' },
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PATIENT_NOT_FOUND');
  });
});
