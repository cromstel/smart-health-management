/**
 * The hardening tests.
 *
 * Each of these covers a way into the application that was open and is now
 * closed. They are written to fail if the closing is undone.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import pool from '../config/database.js';
import { register, login } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { signToken } from '../config/tokens.js';
import { balanceDelta } from '../services/ledger.service.js';
import { belongsToTenant, tenantPredicate } from '../middleware/tenant.js';
import { isInsideDirectory, safeFileName } from '../utils/files.js';
import { updateSettings } from '../controllers/settings.controller.js';

const mockRes = () => {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.payload = payload;
    return res;
  });
  res.jsonData = undefined;
  return res;
};

let dbAvailable = false;

beforeAll(async () => {
  try {
    await pool.query('SELECT 1 FROM users LIMIT 1');
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  await pool.end();
});

describe('self-service registration', () => {
  const email = `hardening-register-${Date.now()}@test.local`;

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ?', [email]);
  });

  it('refuses a role that a person may not give themselves', async () => {
    if (!dbAvailable) return;
    const res = mockRes();
    await register(
      { body: { email, password: 'Correct#Horse9', name: 'Escalation', roleId: 'admin' } } as any,
      res
    );
    expect(res.statusCode).toBe(400);
    expect(String(res.payload?.error)).toMatch(/role/i);
  });

  it('refuses a role given as a number', async () => {
    if (!dbAvailable) return;
    const res = mockRes();
    // The number is the role's key. Accepting a number would let a caller
    // pick any role in the installation, including the ones that are not on
    // the list.
    await register(
      { body: { email, password: 'Correct#Horse9', name: 'Escalation', roleId: 1 } } as any,
      res
    );
    expect(res.statusCode).toBe(400);
  });

  it('refuses a role that is not on the list even when it is a real one', async () => {
    if (!dbAvailable) return;
    const res = mockRes();
    await register(
      { body: { email, password: 'Correct#Horse9', name: 'Escalation', roleId: 'super_admin' } } as any,
      res
    );
    expect(res.statusCode).toBe(400);
  });
});

describe('an account that has been suspended', () => {
  it('does not sign in, and does not come back to life when it tries', async () => {
    if (!dbAvailable) return;
    const email = `hardening-suspended-${Date.now()}@test.local`;
    const bcrypt = (await import('bcryptjs')).default;
    const hashed = await bcrypt.hash('Correct#Horse9', 10);
    const [result] = await pool.query(
      `INSERT INTO users (email, password, name, status, role_id, hospital_id)
       VALUES (?, ?, ?, 'inactive', 2, 1)`,
      [email, hashed, 'Suspended Clinician']
    );
    const userId = (result as any).insertId;

    try {
      const res = mockRes();
      await login({ body: { email, password: 'Correct#Horse9' } } as any, res);
      expect(res.statusCode).toBe(401);

      // The successful sign-in must not have set the account back to active.
      const [rows] = await pool.query('SELECT status FROM users WHERE id = ?', [userId]);
      expect((rows as any[])[0].status).toBe('inactive');
    } finally {
      await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    }
  });
});

describe('a token that is still waiting for its second factor', () => {
  it('is not a session', async () => {
    const token = signToken(
      { id: '1', email: 'doctor@smarthealth.com', role: 'doctor', mfa_pending: true },
      '5m'
    );
    const res = mockRes();
    const next = vi.fn();
    await authenticate({ headers: { authorization: `Bearer ${token}` }, query: {} } as any, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

describe('the ledger', () => {
  it('measures an asset by its debits and an income by its credits', () => {
    expect(balanceDelta('asset', 100, 0)).toBe(100);
    expect(balanceDelta('expense', 100, 0)).toBe(100);
    expect(balanceDelta('income', 0, 100)).toBe(100);
    expect(balanceDelta('liability', 0, 100)).toBe(100);
  });

  it('moves the balance the other way for the other side of the entry', () => {
    expect(balanceDelta('asset', 0, 100)).toBe(-100);
    expect(balanceDelta('income', 100, 0)).toBe(-100);
  });
});

describe('the tenant a request is confined to', () => {
  it('is the caller\'s own hospital', () => {
    const params: unknown[] = [];
    const predicate = tenantPredicate(
      { hospitalId: 7, hospitalCode: 'HOSP-007', platformWide: false },
      'p',
      params
    );
    expect(predicate).toContain('p.hospital_id = ?');
    expect(params).toEqual([7]);
  });

  it('is nothing at all for a caller with no hospital', () => {
    const params: unknown[] = [];
    tenantPredicate({ hospitalId: null, hospitalCode: null, platformWide: false }, 'p', params);
    // A value that matches no row: the answer is an empty list, not the
    // whole table.
    expect(params).toEqual([-1]);
  });

  it('is everything for the platform-wide caller', () => {
    const params: unknown[] = [];
    const predicate = tenantPredicate(
      { hospitalId: null, hospitalCode: null, platformWide: true },
      'p',
      params
    );
    expect(predicate).toBe('');
    expect(params).toEqual([]);
  });

  it('decides whether a record belongs to it', () => {
    const scope = { hospitalId: 7, hospitalCode: 'HOSP-007', platformWide: false };
    expect(belongsToTenant(scope, 7)).toBe(true);
    expect(belongsToTenant(scope, 8)).toBe(false);
    expect(belongsToTenant(scope, null)).toBe(false);
    expect(belongsToTenant({ hospitalId: null, hospitalCode: null, platformWide: true }, 8)).toBe(true);
  });
});

describe('a file name from a client', () => {
  it('cannot climb out of the directory it is stored in', () => {
    expect(safeFileName('../../../etc/passwd')).toBe('passwd');
    // Both separators are refused, whichever platform the server runs on: a
    // name may have been composed on one system and stored on another.
    expect(safeFileName('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
    expect(safeFileName('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
    expect(safeFileName('a/b/c/report.pdf')).toBe('report.pdf');
    expect(safeFileName('a\\b\\c\\report.pdf')).toBe('report.pdf');
  });

  it('keeps the characters a name normally has', () => {
    expect(safeFileName('Chest X-ray (2026-10-21).pdf')).toBe('Chest_X-ray__2026-10-21_.pdf');
  });

  it('falls back to a name when there is nothing to keep', () => {
    expect(safeFileName('')).toBe('file');
    expect(safeFileName('...')).toBe('file');
  });

  it('cannot be written outside the directory', () => {
    expect(isInsideDirectory('/srv/uploads', '/srv/uploads/a/b.pdf')).toBe(true);
    expect(isInsideDirectory('/srv/uploads', '/srv/uploads/../secrets.txt')).toBe(false);
    // A directory whose name starts with the other's is not inside it.
    expect(isInsideDirectory('/srv/uploads', '/srv/uploads-archive/x')).toBe(false);
  });
});

describe('the installation settings', () => {
  it('refuses a key that is not one of the application\'s', async () => {
    const res = mockRes();
    await updateSettings(
      { body: { audit_report_schedule: 'attacker@example.org' } } as any,
      res
    );
    expect(res.statusCode).toBe(400);
  });

  it('accepts a key that is one of the application\'s', async () => {
    if (!dbAvailable) return;
    const res = mockRes();
    await updateSettings({ body: { timezone: 'UTC' } } as any, res);
    expect(res.statusCode).toBe(200);
  });
});
