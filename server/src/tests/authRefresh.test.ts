import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import pool from '../config/database.js';
import { refreshToken } from '../controllers/auth.controller.js';
import { authenticate, hashToken, requirePermission } from '../middleware/auth.js';
import { getSecret } from '../config/env.js';

const JWT_SECRET = getSecret('JWT_SECRET', 'dev-only-jwt-secret');

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

/** The seeded clinician: hospital HOSP-001, department 1. */
const DOCTOR_ID = 3;
const DOCTOR_EMAIL = 'doctor@smarthealth.com';

/**
 * Every test gets its own token. Two tokens signed with the same payload in
 * the same second are byte identical, and the revocation cache is keyed by
 * the token digest, so a shared token would let one test's cached verdict
 * answer another test's question.
 */
const signToken = (payload: Record<string, unknown> = {}) =>
  jwt.sign(
    { id: DOCTOR_ID, email: DOCTOR_EMAIL, role: 'doctor', hospital_id: 'HOSP-001', ...payload },
    JWT_SECRET,
    { expiresIn: '10m' } as jwt.SignOptions
  );

beforeAll(async () => {
  const [rows] = await pool.query('SELECT id, email FROM users WHERE id = ?', [DOCTOR_ID]);
  expect(rows.length, 'the seeded clinician must exist for this test').toBe(1);
});

afterAll(async () => {
  await pool.query('DELETE FROM revoked_tokens WHERE user_id = ?', [DOCTOR_ID]);
  await pool.end();
});

describe('POST /auth/refresh', () => {
  it('rebuilds the payload from the database and keeps the hospital scope', async () => {
    const original = signToken({ nonce: randomUUID() });

    const res = mockRes();
    await refreshToken({ body: { token: original } } as any, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.status).not.toHaveBeenCalledWith(401);
    const newToken = res.json.mock.calls[0][0].token;
    expect(typeof newToken).toBe('string');

    const decoded = jwt.decode(newToken) as Record<string, unknown>;
    expect(decoded.id).toBe(DOCTOR_ID);
    expect(decoded.email).toBe(DOCTOR_EMAIL);
    expect(decoded.role).toBe('doctor');
    // The scope fields are read from the database, not copied from the
    // incoming token, and they used to be dropped entirely.
    expect(decoded.hospital_id).toBe('HOSP-001');
    expect(decoded.department_id).toBe('1');
  });

  it('produces a token the scoped routes accept (no "Missing hospital context")', async () => {
    const original = signToken({ nonce: randomUUID() });

    const refreshRes = mockRes();
    await refreshToken({ body: { token: original } } as any, refreshRes);
    const newToken = refreshRes.json.mock.calls[0][0].token;

    const req: any = { headers: { authorization: `Bearer ${newToken}` }, query: {} };
    const authRes = mockRes();
    const next = vi.fn();
    await authenticate(req, authRes, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.hospital_id).toBe('HOSP-001');

    const permRes = mockRes();
    const permNext = vi.fn();
    await requirePermission('patients', 'view')(req, permRes, permNext);
    expect(permRes.json).not.toHaveBeenCalledWith({ error: 'Missing hospital context' });
    expect(permNext).toHaveBeenCalled();
  });

  it('rejects a missing token', async () => {
    const res = mockRes();
    await refreshToken({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/token is required/i);
  });

  it('rejects a token for a user that no longer exists', async () => {
    const orphan = jwt.sign(
      { id: 999999, email: 'ghost@test.local', role: 'doctor', nonce: randomUUID() },
      JWT_SECRET,
      { expiresIn: '10m' } as jwt.SignOptions
    );
    const res = mockRes();
    await refreshToken({ body: { token: orphan } } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a revoked token', async () => {
    const revokedToken = signToken({ nonce: randomUUID() });

    await pool.query(
      'INSERT INTO revoked_tokens (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
      [hashToken(revokedToken), DOCTOR_ID]
    );

    const res = mockRes();
    await refreshToken({ body: { token: revokedToken } } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error).toMatch(/revoked/i);
  });
});
