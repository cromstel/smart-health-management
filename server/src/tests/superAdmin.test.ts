import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

import pool from '../config/database.js';
import { getSecret } from '../config/env.js';
import superAdminRoutes from '../routes/superAdmin.routes.js';
import { getBackupDirectory, listBackups } from '../services/backup.service.js';
import { getScheduledJobStatuses, scheduleBackups } from '../services/cron.service.js';
import { addClient, broadcast, getClientCount, removeClient } from '../events/permissions.js';

const JWT_SECRET = getSecret('JWT_SECRET', 'dev-only-jwt-secret');

const SUPER_ADMIN_ID = 1;
const SUPER_ADMIN_EMAIL = 'superadmin@smarthealth.com';

const TEST_SETTING_KEY = 'agent.superadmin.test';

let server: Server;
let baseUrl = '';
let token = '';

/** Boots the real super-admin router behind a throwaway HTTP server. */
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/super-admin', superAdminRoutes);

  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}/api/super-admin`;

  token = jwt.sign(
    { id: SUPER_ADMIN_ID, email: SUPER_ADMIN_EMAIL, role: 'super_admin', hospital_id: 'HOSP-001' },
    JWT_SECRET,
    { expiresIn: '15m' } as jwt.SignOptions
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM super_admin_settings WHERE setting_key = ?', [TEST_SETTING_KEY]);
  // The console writes a setting to both stores; the seeded
  // super_admin_settings table only held `maintenance_mode`.
  await pool.query('DELETE FROM super_admin_settings WHERE setting_key = ?', ['system_name']);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

const api = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

describe('GET /super-admin/health', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(401);
  });

  it('reports the real database, process and scheduler state', async () => {
    const { status, body } = await api('/health');

    expect(status).toBe(200);
    expect(body.status).toBe('OK');
    expect(body.database).toBe('Connected');
    expect(body.message).toMatch(/healthy/i);

    // The database is measured, not assumed.
    expect(body.checks.database.status).toBe('connected');
    expect(typeof body.checks.database.latencyMs).toBe('number');
    expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.checks.database.error).toBeNull();

    // Process facts.
    expect(body.checks.server.nodeVersion).toBe(process.version);
    expect(body.checks.server.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.checks.server.memory.rssMb).toBeGreaterThan(0);

    // Scheduled jobs are reported as a list, not hardcoded.
    expect(Array.isArray(body.checks.scheduledJobs)).toBe(true);
  });

  it('does not leak a pool connection on every call', async () => {
    const before = (pool as any).pool?._allConnections?.length ?? 0;
    for (let i = 0; i < 5; i++) {
      await api('/health');
    }
    const after = (pool as any).pool?._allConnections?.length ?? 0;
    expect(after).toBe(before);
  });
});

describe('GET /super-admin/settings', () => {
  it('returns both setting stores with unambiguous identifiers', async () => {
    const { status, body } = await api('/settings');

    expect(status).toBe(200);
    expect(Array.isArray(body.settings)).toBe(true);
    expect(body.settings.length).toBeGreaterThan(0);

    for (const setting of body.settings) {
      expect(typeof setting.id).toBe('string');
      expect(setting.id).toMatch(/^(settings|super_admin_settings):\d+$/);
      expect(typeof setting.setting_key).toBe('string');
    }

    // The identifiers are unique even though both tables number their rows
    // independently.
    const ids = body.settings.map((s: any) => s.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(body.settings.some((s: any) => s.setting_key === 'system_name')).toBe(true);
  });
});

describe('PUT /super-admin/settings', () => {
  it('creates a setting that did not exist', async () => {
    const { status, body } = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: TEST_SETTING_KEY, value: 'first-value' }),
    });

    expect(status).toBe(200);
    expect(body.key).toBe(TEST_SETTING_KEY);

    const [rows] = await pool.query(
      'SELECT setting_value FROM super_admin_settings WHERE setting_key = ?',
      [TEST_SETTING_KEY]
    );
    expect((rows as any[])[0].setting_value).toBe('first-value');
  });

  it('updates an existing setting', async () => {
    const { status } = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: TEST_SETTING_KEY, value: 'second-value' }),
    });

    expect(status).toBe(200);

    const [rows] = await pool.query(
      'SELECT setting_value FROM super_admin_settings WHERE setting_key = ?',
      [TEST_SETTING_KEY]
    );
    expect((rows as any[])[0].setting_value).toBe('second-value');
  });

  it('updates a setting addressed by the identifier returned by the list', async () => {
    const list = await api('/settings');
    const target = list.body.settings.find((s: any) => s.setting_key === 'system_name');
    expect(target).toBeTruthy();

    const original = target.setting_value;

    const { status, body } = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: target.id, value: 'Renamed Hospital' }),
    });
    expect(status).toBe(200);
    expect(body.key).toBe('system_name');

    // The value is written to both stores, so the console and the general
    // configuration never disagree about the same key.
    const [rows] = await pool.query(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      ['system_name']
    );
    expect((rows as any[])[0].setting_value).toBe('Renamed Hospital');

    const [superRows] = await pool.query(
      'SELECT setting_value FROM super_admin_settings WHERE setting_key = ?',
      ['system_name']
    );
    expect((superRows as any[])[0].setting_value).toBe('Renamed Hospital');

    // Restore the seeded value.
    await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: target.id, value: original }),
    });
    const [restored] = await pool.query(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      ['system_name']
    );
    expect((restored as any[])[0].setting_value).toBe(original);
  });

  it('rejects a key with invalid characters', async () => {
    const { status, body } = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: 'not a valid key!', value: 'x' }),
    });
    expect(status).toBe(400);
    // The shared validation middleware reports the failures as a list.
    expect(body.errors ?? body.error).toBeTruthy();

    const [rows] = await pool.query(
      'SELECT COUNT(*) AS c FROM super_admin_settings WHERE setting_key = ?',
      ['not a valid key!']
    );
    expect((rows as any[])[0].c).toBe(0);
  });

  it('rejects a missing value', async () => {
    const { status } = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: TEST_SETTING_KEY }),
    });
    expect(status).toBe(400);
  });
});

describe('PATCH /super-admin/settings/:id (existing route)', () => {
  it('still updates a row of the settings table', async () => {
    const [rows] = await pool.query("SELECT id, setting_value FROM settings WHERE setting_key = 'default_language'");
    const row = (rows as any[])[0];
    const original = row.setting_value;

    const { status } = await api(`/settings/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ setting_value: 'fr' }),
    });
    expect(status).toBe(200);

    const [updated] = await pool.query('SELECT setting_value FROM settings WHERE id = ?', [row.id]);
    expect((updated as any[])[0].setting_value).toBe('fr');

    await api(`/settings/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ setting_value: original }),
    });
  });
});

describe('POST /super-admin/upgrade', () => {
  it('reports a plan and does not claim that an upgrade happened', async () => {
    const { status, body } = await api('/upgrade', {
      method: 'POST',
      body: JSON.stringify({ version: '9.9.9', description: 'agent test' }),
    });

    expect(status).toBe(200);
    expect(body.dryRun).toBe(true);
    expect(body.applied).toBe(false);
    expect(body.targetVersion).toBe('9.9.9');
    expect(typeof body.currentVersion).toBe('string');
    expect(body.currentVersion.length).toBeGreaterThan(0);
    expect(Array.isArray(body.steps)).toBe(true);
    expect(body.steps.length).toBeGreaterThan(0);
    expect(body.message).toMatch(/no upgrade was performed/i);
    expect(body.message).not.toMatch(/upgrade initiated/i);
  });

  it('persists the running version so it can be read back', async () => {
    await api('/upgrade', {
      method: 'POST',
      body: JSON.stringify({ version: '9.9.9' }),
    });

    const [rows] = await pool.query(
      'SELECT setting_value FROM super_admin_settings WHERE setting_key = ?',
      ['system.version']
    );
    expect(rows.length).toBe(1);
    expect(typeof (rows as any[])[0].setting_value).toBe('string');
  });

  it('requires a version', async () => {
    const { status } = await api('/upgrade', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(status).toBe(400);
  });
});

describe('backup service', () => {
  it('writes into a directory that is not tracked by git', () => {
    const backupDir = getBackupDirectory();
    expect(backupDir).toContain('backups');
    // The dump directory has to live inside an ignored path: it holds the
    // whole database.
    const repoRoot = path.resolve(backupDir, '..', '..');
    const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/server\/backups\//);
  });

  it('lists the available dumps and tolerates an empty directory', async () => {
    const backups = await listBackups();
    expect(Array.isArray(backups)).toBe(true);
  });

  it('reports a backup failure honestly instead of claiming success', async () => {
    const { status, body } = await api('/backup', { method: 'POST' });

    const dumpAvailable = Boolean(
      process.env.MYSQLDUMP_BIN ||
        ['mysqldump', 'mysqldump.exe'].some((bin) => {
          try {
            return Boolean(process.env.PATH?.split(path.delimiter).some((dir) => fs.existsSync(path.join(dir, bin))));
          } catch {
            return false;
          }
        })
    );

    if (dumpAvailable) {
      expect(status).toBe(200);
      expect(body.fileName).toMatch(/^backup_.*\.sql$/);
      expect(fs.existsSync(body.backupPath)).toBe(true);
      fs.unlinkSync(body.backupPath);
    } else {
      // No dump tool on this host: the endpoint has to say so.
      expect(status).toBe(500);
      expect(body.error).toMatch(/backup/i);
    }
  });
});

describe('cron service', () => {
  it('registers the maintenance jobs and reports their status', async () => {
    scheduleBackups();

    const jobs = getScheduledJobStatuses();
    expect(jobs.length).toBeGreaterThanOrEqual(2);

    const names = jobs.map((job) => job.name);
    expect(names).toContain('database-backup');
    expect(names).toContain('auth-record-cleanup');

    for (const job of jobs) {
      expect(typeof job.schedule).toBe('string');
      expect(typeof job.state).toBe('string');
      expect(job).toHaveProperty('lastRunAt');
      expect(job).toHaveProperty('lastResult');
    }
  });
});

describe('role/permission SSE stream', () => {
  /** Minimal stand-in for an Express response that records what was written. */
  const fakeResponse = () => {
    const res: any = {
      written: [] as string[],
      closed: false,
      destroyed: false,
      writableEnded: false,
      handlers: {} as Record<string, () => void>,
      write(payload: string) {
        res.written.push(payload);
        return true;
      },
      on(event: string, handler: () => void) {
        res.handlers[event] = handler;
        return res;
      },
    };
    return res;
  };

  const connected: any[] = [];

  const connect = () => {
    const res = fakeResponse();
    connected.push(res);
    addClient(res);
    return res;
  };

  afterEach(() => {
    for (const res of connected.splice(0)) {
      removeClient(res);
    }
  });

  it('delivers events to a connected client', () => {
    const baseline = getClientCount();
    const res = connect();
    expect(getClientCount()).toBe(baseline + 1);

    broadcast({ type: 'role.updated' });

    expect(res.written).toHaveLength(1);
    expect(res.written[0]).toContain('role.updated');
  });

  it('removes a client when the connection closes', () => {
    const baseline = getClientCount();
    const res = connect();
    expect(getClientCount()).toBe(baseline + 1);

    res.handlers.close();

    expect(getClientCount()).toBe(baseline);

    // A broadcast after the disconnect must not touch the closed response.
    broadcast({ type: 'role.updated' });
    expect(res.written).toHaveLength(0);
  });

  it('prunes clients whose response is already finished', () => {
    const baseline = getClientCount();
    const res = connect();
    res.writableEnded = true;

    broadcast({ type: 'role.updated' });

    expect(getClientCount()).toBe(baseline);
    expect(res.written).toHaveLength(0);
  });

  it('removes a client explicitly', () => {
    const baseline = getClientCount();
    const res = connect();
    expect(getClientCount()).toBe(baseline + 1);

    removeClient(res);
    expect(getClientCount()).toBe(baseline);

    // Removing twice is harmless.
    removeClient(res);
    expect(getClientCount()).toBe(baseline);
  });
});
