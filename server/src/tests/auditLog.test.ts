/**
 * Audit trail tests.
 *
 * The audit trail used to be a localStorage array in the browser, so the
 * important properties are: the entry is written to the `audit_logs` table,
 * the actor is taken from the JWT rather than the body, and a user without
 * the audit view permission only ever reads their own actions.
 *
 * The routes are exercised through a real Express app with a minted JWT, so
 * the request validation is covered as well as the controller.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mintToken as mintSessionToken } from './helpers/mintToken.js';
import express from 'express';
import type { Server } from 'http';
import pool from '../config/database.js';
import auditLogRoutes from '../routes/auditLog.routes.js';

let dbAvailable = false;

const ADMIN_USER_ID = 2; // seeded administrator: patients:view and friends
const SUPER_ADMIN_USER_ID = 1; // seeded super administrator: the "all" permission module
const TEST_EMAIL = `audit-test-${Date.now()}@smarthealth.com`;
let testUserId = 0;

let server: Server;
let baseUrl = '';

const mintToken = (userId: number, email: string, role: string): string =>
  mintSessionToken(userId, email, role);

async function seedFixture(): Promise<void> {
  const [userResult] = await pool.query(
    `INSERT INTO users (email, password, name, status, role_id, hospital_id)
     VALUES (?, 'not-a-real-hash', 'Audit Trail Tester', 'active', 5, 1)`,
    [TEST_EMAIL]
  );
  testUserId = Number((userResult as any).insertId);
}

async function cleanupFixture(): Promise<void> {
  if (testUserId) {
    await pool.query('DELETE FROM audit_logs WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
  }
}

// The database is probed before the suite is collected, not in a beforeAll:
// `it.skip` has to be decided while the file is being collected, and a
// beforeAll runs after that, so a probe there would skip every test.
try {
  await pool.query('SELECT 1 FROM audit_logs LIMIT 1');
  await seedFixture();
  dbAvailable = true;
} catch (error) {
  console.warn(
    'Audit tests skipped: database not available',
    error instanceof Error ? error.message : String(error)
  );
  dbAvailable = false;
}

const skipIfNoDb = dbAvailable ? it : it.skip;

describe('Audit trail API', () => {
  beforeAll(async () => {
    if (!dbAvailable) return;

    const app = express();
    app.use(express.json());
    app.use('/api/audit-logs', auditLogRoutes);
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

  const post = async (token: string, body: unknown) =>
    fetch(`${baseUrl}/api/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  const get = async (token: string, query = '') =>
    fetch(`${baseUrl}/api/audit-logs${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  skipIfNoDb('writes an entry with the actor taken from the token', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'nurse');

    const response = await post(token, {
      action: 'create',
      module: 'patient',
      recordId: 'PAT-001',
      newValue: 'created',
    });

    expect(response.status).toBe(201);
    const entry = await response.json();

    expect(entry.action).toBe('create');
    expect(entry.module).toBe('patient');
    expect(entry.recordId).toBe('PAT-001');
    expect(entry.newValue).toBe('created');
    expect(entry.userId).toBe(String(testUserId));
    expect(entry.userName).toBe('Audit Trail Tester');
    expect(entry.ipAddress).toBeTruthy();
    expect(entry.userAgent).toBeTruthy();
    expect(typeof entry.timestamp).toBe('string');
  });

  skipIfNoDb('serialises an arbitrary detail object safely', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'nurse');

    const response = await post(token, {
      action: 'adjust_stock',
      module: 'pharmacy',
      details: { medicine: 'Amoxicillin', stock: { from: 40, to: 12 } },
    });

    expect(response.status).toBe(201);
    const entry = await response.json();

    expect(entry.newValue).toContain('Amoxicillin');
    expect(entry.newValue).toContain('"to":12');
  });

  skipIfNoDb('rejects a write without an action or a module', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'nurse');

    const response = await post(token, { module: 'patient' });
    expect(response.status).toBe(400);

    const other = await post(token, { action: 'create' });
    expect(other.status).toBe(400);
  });

  skipIfNoDb('rejects an unauthenticated write', async () => {
    const response = await fetch(`${baseUrl}/api/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', module: 'patient' }),
    });
    expect(response.status).toBe(401);
  });

  skipIfNoDb('reads the trail back with the fields the audit pages read', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'nurse');

    await post(token, {
      action: 'searchable_action',
      module: 'searchable_module',
      recordId: 'REC-42',
      newValue: 'needle',
    });

    const response = await get(token);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.scope).toBe('self');
    expect(Array.isArray(payload.logs)).toBe(true);

    const entry = payload.logs.find((log: any) => log.action === 'searchable_action');
    expect(entry).toBeTruthy();
    expect(entry.userId).toBe(String(testUserId));
    expect(entry.userName).toBe('Audit Trail Tester');
    expect(entry.recordId).toBe('REC-42');
    expect(entry.newValue).toBe('needle');
    expect(typeof entry.timestamp).toBe('string');
  });

  skipIfNoDb('scopes the trail to the caller when they cannot administer', async () => {
    const nurseToken = mintToken(testUserId, TEST_EMAIL, 'nurse');
    const superAdminToken = mintToken(SUPER_ADMIN_USER_ID, 'superadmin@smarthealth.com', 'super_admin');

    await post(nurseToken, { action: 'nurse_only_action', module: 'patient' });

    const nurseView = await (await get(nurseToken)).json();
    expect(nurseView.scope).toBe('self');
    expect(
      nurseView.logs.every((log: any) => log.userId === String(testUserId))
    ).toBe(true);

    const adminView = await (await get(superAdminToken)).json();
    expect(adminView.scope).toBe('all');
    expect(adminView.logs.some((log: any) => log.action === 'nurse_only_action')).toBe(true);
  });

  skipIfNoDb('finds entries with the search filter', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'nurse');
    await post(token, { action: 'unique_search_token_action', module: 'patient' });

    const payload = await (await get(token, '?search=unique_search_token')).json();
    expect(payload.logs.length).toBeGreaterThanOrEqual(1);
    expect(
      payload.logs.every((log: any) =>
        `${log.action} ${log.module} ${log.recordId ?? ''}`.includes('unique_search_token')
      )
    ).toBe(true);
  });

  skipIfNoDb('summarises the trail per day', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'nurse');
    await post(token, { action: 'summary_action', module: 'patient' });

    const response = await fetch(`${baseUrl}/api/audit-logs/summary?range=7d`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.range).toBe('7d');
    expect(payload.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(payload.buckets)).toBe(true);
    expect(Array.isArray(payload.byModule)).toBe(true);
  });

  skipIfNoDb('returns the recent entries', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'nurse');
    await post(token, { action: 'recent_action', module: 'patient' });

    const response = await fetch(`${baseUrl}/api/audit-logs/recent?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(Array.isArray(payload.logs)).toBe(true);
    expect(payload.logs.length).toBeLessThanOrEqual(5);
  });

  skipIfNoDb('stores and reads the report schedule', async () => {
    const token = mintToken(ADMIN_USER_ID, 'admin@smarthealth.com', 'admin');

    const update = await fetch(`${baseUrl}/api/audit-logs/report-schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enabled: false,
        emails: 'records@example.org',
        frequency: 'weekly',
        format: 'json',
        modules: ['patients', 'vitals', 'users'],
      }),
    });
    expect(update.status).toBe(200);

    const saved = await update.json();
    expect(saved.enabled).toBe(false);
    expect(saved.emails).toBe('records@example.org');
    expect(saved.frequency).toBe('weekly');
    expect(saved.modules).toEqual(['patients', 'vitals', 'users']);

    const response = await fetch(`${baseUrl}/api/audit-logs/report-schedule`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);

    const schedule = await response.json();
    expect(schedule.emails).toBe('records@example.org');
    expect(schedule.format).toBe('json');

    // Restore the default so the settings table is left as it was found.
    await fetch(`${baseUrl}/api/audit-logs/report-schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enabled: true,
        emails: 'admin-records@smarthospital.org',
        frequency: 'monthly',
        format: 'csv',
        modules: ['patients', 'vitals'],
      }),
    });
  });
});
