/**
 * Clinical notes route tests.
 *
 * The clinical notes endpoints are behind the `patients` permission module,
 * so the tests use the seeded administrator (who holds patients:view,
 * patients:add and patients:edit) and check that an anonymous request is
 * refused.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mintToken as mintSessionToken } from './helpers/mintToken.js';
import express from 'express';
import type { Server } from 'http';
import pool from '../config/database.js';
import clinicalNotesRoutes from '../routes/clinicalNotes.routes.js';

let dbAvailable = false;

const ADMIN_USER_ID = 2;
const ADMIN_EMAIL = 'admin@smarthealth.com';
const TEST_EMAIL = `notes-api-${Date.now()}@smarthealth.com`;
let testUserId = 0;
let testPatientId = 0;
let testPatientCode = '';

let server: Server;
let baseUrl = '';

/**
 * The hospital the seeded administrator belongs to. The JWT carries the
 * hospital code, exactly like the login endpoint does, because the
 * permission middleware refuses a request without a hospital context.
 */
const HOSPITAL_CODE = 'HOSP-001';

const mintToken = (userId: number, email: string, role: string): string =>
  mintSessionToken(userId, email, role, { hospital_id: HOSPITAL_CODE });

async function seedFixture(): Promise<void> {
  const [userResult] = await pool.query(
    `INSERT INTO users (email, password, name, status, role_id, hospital_id)
     VALUES (?, 'not-a-real-hash', 'Notes API Tester', 'active', 2, 1)`,
    [TEST_EMAIL]
  );
  testUserId = Number((userResult as any).insertId);

  testPatientCode = `NAPI-${Date.now()}`;
  const [patientResult] = await pool.query(
    `INSERT INTO patients (patient_id, first_name, last_name, age, gender, hospital_id, status)
     VALUES (?, 'Api', 'Subject', 33, 'other', 1, 'active')`,
    [testPatientCode]
  );
  testPatientId = Number((patientResult as any).insertId);
}

async function cleanupFixture(): Promise<void> {
  if (testPatientId) {
    await pool.query('DELETE FROM clinical_notes WHERE patient_id = ?', [testPatientId]);
    await pool.query('DELETE FROM patients WHERE id = ?', [testPatientId]);
  }
  if (testUserId) {
    await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
  }
}

// The database is probed before the suite is collected, not in a beforeAll:
// `it.skip` has to be decided while the file is being collected, and a
// beforeAll runs after that, so a probe there would skip every test.
try {
  await pool.query('SELECT 1 FROM clinical_notes LIMIT 1');
  await seedFixture();
  dbAvailable = true;
} catch (error) {
  console.warn(
    'Clinical notes API tests skipped: database not available',
    error instanceof Error ? error.message : String(error)
  );
  dbAvailable = false;
}

const skipIfNoDb = dbAvailable ? it : it.skip;

describe('Clinical notes API', () => {
  beforeAll(async () => {
    if (!dbAvailable) return;

    const app = express();
    app.use(express.json());
    app.use('/api/clinical-notes', clinicalNotesRoutes);
    server = await new Promise<Server>((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (dbAvailable) {
      await cleanupFixture();
    }
  });

  const request = (token: string, path: string, init: RequestInit = {}) =>
    fetch(`${baseUrl}/api/clinical-notes${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });

  skipIfNoDb('refuses an unauthenticated request', async () => {
    const response = await request('', `?patientId=${testPatientCode}`);
    expect(response.status).toBe(401);
  });

  skipIfNoDb('requires a patient id', async () => {
    const token = mintToken(ADMIN_USER_ID, ADMIN_EMAIL, 'admin');
    const response = await request(token, '/');
    expect(response.status).toBe(400);
  });

  skipIfNoDb('creates, reads, updates and deletes a note', async () => {
    const token = mintToken(ADMIN_USER_ID, ADMIN_EMAIL, 'admin');

    const created = await request(token, '/', {
      method: 'POST',
      body: JSON.stringify({
        patientId: testPatientCode,
        content: 'Chest clear, no effusion. Plan: continue current therapy.',
        tags: ['General Consultation'],
      }),
    });
    expect(created.status).toBe(201);

    const note = await created.json();
    expect(note.id).toBeTruthy();
    expect(note.content).toContain('Chest clear');
    expect(note.tags).toEqual(['General Consultation']);
    expect(note.doctorName).toBeTruthy();

    const list = await request(token, `?patientId=${testPatientCode}`);
    expect(list.status).toBe(200);
    const payload = await list.json();
    expect(payload.notes.some((entry: any) => entry.id === note.id)).toBe(true);

    const single = await request(token, `/${note.id}`);
    expect(single.status).toBe(200);
    expect((await single.json()).id).toBe(note.id);

    const updated = await request(token, `/${note.id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: 'Updated assessment.', tags: ['Post-Op Assessment'] }),
    });
    expect(updated.status).toBe(200);
    const afterUpdate = await updated.json();
    expect(afterUpdate.content).toBe('Updated assessment.');
    expect(afterUpdate.tags).toEqual(['Post-Op Assessment']);

    const deleted = await request(token, `/${note.id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);

    const gone = await request(token, `/${note.id}`);
    expect(gone.status).toBe(404);
  });

  skipIfNoDb('rejects an empty note and an unknown patient', async () => {
    const token = mintToken(ADMIN_USER_ID, ADMIN_EMAIL, 'admin');

    const empty = await request(token, '/', {
      method: 'POST',
      body: JSON.stringify({ patientId: testPatientCode, content: '   ' }),
    });
    expect(empty.status).toBe(400);

    const unknown = await request(token, '/', {
      method: 'POST',
      body: JSON.stringify({ patientId: 'DOES-NOT-EXIST', content: 'hello' }),
    });
    expect(unknown.status).toBe(404);
  });

  skipIfNoDb('stores the author from the session, not from the request', async () => {
    const token = mintToken(ADMIN_USER_ID, ADMIN_EMAIL, 'admin');

    const created = await request(token, '/', {
      method: 'POST',
      body: JSON.stringify({
        patientId: String(testPatientId),
        content: 'Author check.',
        author_id: 999999,
        author_name: 'Someone Else',
      }),
    });
    expect(created.status).toBe(201);

    const note = await created.json();
    expect(note.authorId).toBe(String(ADMIN_USER_ID));
    expect(note.doctorName).not.toBe('Someone Else');
  });
});
