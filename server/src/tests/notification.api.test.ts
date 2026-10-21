/**
 * Notification route tests.
 *
 * The routes are exercised through a real Express app with a minted JWT, so
 * the request validation and the authentication gate are covered as well as
 * the controller.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mintToken as mintSessionToken } from './helpers/mintToken.js';
import express from 'express';
import type { Server } from 'http';
import pool from '../config/database.js';
import notificationRoutes from '../routes/notification.routes.js';

let dbAvailable = false;

const TEST_EMAIL = `notification-api-${Date.now()}@smarthealth.com`;
let testUserId = 0;
let testHospitalId = 0;

let server: Server;
let baseUrl = '';

const mintToken = (userId: number, email: string, role: string): string =>
  mintSessionToken(userId, email, role);

/**
 * The fixture gets its own hospital so the scanner finds nothing for the
 * test user, and the user is a nurse (no pharmacy permission) so the
 * inventory scanner stays out of the way.
 */
async function seedFixture(): Promise<void> {
  const [hospitalResult] = await pool.query(
    `INSERT INTO hospitals (hospital_id, name, status) VALUES (?, 'Notification API Test Hospital', 'active')`,
    [`NAPIH-${Date.now()}`]
  );
  testHospitalId = Number((hospitalResult as any).insertId);

  const [userResult] = await pool.query(
    `INSERT INTO users (email, password, name, status, role_id, hospital_id)
     VALUES (?, 'not-a-real-hash', 'Notification API Tester', 'active', 5, ?)`,
    [TEST_EMAIL, testHospitalId]
  );
  testUserId = Number((userResult as any).insertId);
}

async function cleanupFixture(): Promise<void> {
  if (testUserId) {
    await pool.query('DELETE FROM notification_dedupe WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM notifications WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
  }
  if (testHospitalId) {
    await pool.query('DELETE FROM hospitals WHERE id = ?', [testHospitalId]);
  }
}

// The database is probed before the suite is collected, not in a beforeAll:
// `it.skip` has to be decided while the file is being collected, and a
// beforeAll runs after that, so a probe there would skip every test.
try {
  await pool.query('SELECT 1 FROM notifications LIMIT 1');
  await seedFixture();
  dbAvailable = true;
} catch (error) {
  console.warn(
    'Notification API tests skipped: database not available',
    error instanceof Error ? error.message : String(error)
  );
  dbAvailable = false;
}

const skipIfNoDb = dbAvailable ? it : it.skip;

describe('Notification API', () => {
  beforeAll(async () => {
    if (!dbAvailable) return;

    const app = express();
    app.use(express.json());
    app.use('/api/notifications', notificationRoutes);
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
    fetch(`${baseUrl}/api/notifications${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });

  skipIfNoDb('refuses an unauthenticated request', async () => {
    const response = await request('', '/');
    expect(response.status).toBe(401);
  });

  skipIfNoDb('returns an empty inbox for a user with no notifications', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'admin');
    const response = await request(token, '/');
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(Array.isArray(payload.notifications)).toBe(true);
    expect(payload.notifications.length).toBe(0);
    expect(payload.total).toBe(0);
  });

  skipIfNoDb('creates a notification for the caller', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'admin');

    const response = await request(token, '/', {
      method: 'POST',
      body: JSON.stringify({
        type: 'system',
        priority: 'high',
        title: 'API created notification',
        message: 'hello from the test',
      }),
    });

    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.id).toBeTruthy();
    expect(created.type).toBe('system');
    expect(created.priority).toBe('high');
    expect(created.read).toBe(false);
    expect(typeof created.timestamp).toBe('string');
    expect(typeof created.createdAt).toBe('number');
  });

  skipIfNoDb('rejects a notification without a title or with an unknown type', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'admin');

    const noTitle = await request(token, '/', {
      method: 'POST',
      body: JSON.stringify({ type: 'system', message: 'no title' }),
    });
    expect(noTitle.status).toBe(400);

    const badType = await request(token, '/', {
      method: 'POST',
      body: JSON.stringify({ type: 'not_a_type', title: 'x' }),
    });
    expect(badType.status).toBe(400);
  });

  skipIfNoDb('marks one notification read, and every notification read', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'admin');

    const created = await (
      await request(token, '/', {
        method: 'POST',
        body: JSON.stringify({ type: 'system', title: 'Read me', message: 'read me' }),
      })
    ).json();

    const read = await request(token, `/${created.id}/read`, { method: 'PATCH' });
    expect(read.status).toBe(200);
    expect((await read.json()).read).toBe(true);

    await request(token, '/', {
      method: 'POST',
      body: JSON.stringify({ type: 'system', title: 'Read me too', message: 'read me too' }),
    });

    const readAll = await request(token, '/read-all', { method: 'PATCH' });
    expect(readAll.status).toBe(200);

    const unread = await (await request(token, '/?unread=true')).json();
    expect(unread.notifications.length).toBe(0);
  });

  skipIfNoDb('updates the status and deletes a notification', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'admin');

    const created = await (
      await request(token, '/', {
        method: 'POST',
        body: JSON.stringify({ type: 'pending_confirmation', title: 'Confirm me', message: 'confirm' }),
      })
    ).json();

    const updated = await request(token, `/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'confirmed' }),
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).status).toBe('confirmed');

    const badStatus = await request(token, `/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'nonsense' }),
    });
    expect(badStatus.status).toBe(400);

    const deleted = await request(token, `/${created.id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(200);

    const missing = await request(token, `/${created.id}`, { method: 'DELETE' });
    expect(missing.status).toBe(404);
  });

  skipIfNoDb('runs the scanner on demand', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'admin');

    const response = await request(token, '/scan?force=true', { method: 'POST' });
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(typeof payload.created).toBe('number');
    expect(payload.byType).toBeTruthy();
  });

  skipIfNoDb('rejects a bad id', async () => {
    const token = mintToken(testUserId, TEST_EMAIL, 'admin');

    const response = await request(token, '/not-a-number/read', { method: 'PATCH' });
    expect(response.status).toBe(400);
  });
});
