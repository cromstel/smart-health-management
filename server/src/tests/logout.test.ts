import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createHash, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

import pool from '../config/database.js';
import { login, logout } from '../controllers/auth.controller.js';
import { authenticate, hashToken } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { getSecret } from '../config/env.js';

const TEST_EMAIL = 'logout.agent@test.local';
const TEST_PASSWORD = 'Logout@2026';

let userId = 0;
let token = '';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

/** Runs the auth middleware against a token and reports what it decided. */
async function runAuthenticate(bearer: string) {
  const req: any = { headers: { authorization: `Bearer ${bearer}` }, query: {} };
  const res = mockRes();
  const next = vi.fn();
  await authenticate(req, res, next);
  return { req, res, next };
}

beforeAll(async () => {
  const hashed = await bcrypt.hash(TEST_PASSWORD, 10);
  const [result] = await pool.query(
    `INSERT INTO users (email, password, name, role_id, hospital_id, password_must_change)
     VALUES (?, ?, ?, 4, 1, 0)`,
    [TEST_EMAIL, hashed, 'Logout Agent']
  );
  userId = (result as any).insertId;

  const res = mockRes();
  await login({ body: { email: TEST_EMAIL, password: TEST_PASSWORD } } as any, res);
  token = res.json.mock.calls[0][0].token;
});

afterAll(async () => {
  await pool.query('DELETE FROM audit_logs WHERE user_id = ?', [userId]);
  await pool.query('DELETE FROM revoked_tokens WHERE user_id = ?', [userId]);
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  await pool.end();
});

describe('POST /auth/logout', () => {
  it('revokes the presented token and stores only its hash', async () => {
    expect(token).toBeTruthy();

    const decoded = jwt.decode(token) as { id: number; exp: number };
    const req: any = {
      headers: { authorization: `Bearer ${token}` },
      query: {},
      ip: '127.0.0.1',
      user: { id: String(decoded.id), email: TEST_EMAIL, role: 'patient' },
    };
    const res = mockRes();

    await logout(req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toEqual({ message: 'Logged out successfully' });

    const [rows] = await pool.query(
      'SELECT * FROM revoked_tokens WHERE user_id = ?',
      [userId]
    );
    const revoked = rows as any[];
    expect(revoked).toHaveLength(1);
    expect(revoked[0].token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(revoked[0].token_hash).not.toBe(token);
    expect(new Date(revoked[0].expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('makes the revoked token unusable for the next request', async () => {
    const { req, res, next } = await runAuthenticate(token);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error).toMatch(/revoked/i);
    expect(req.user).toBeUndefined();
  });

  it('leaves other sessions alone', async () => {
    const freshToken = jwt.sign(
      {
        id: userId,
        email: TEST_EMAIL,
        role: 'patient',
        hospital_id: 'HOSP-001',
        nonce: randomUUID(),
      },
      getSecret('JWT_SECRET', 'dev-only-jwt-secret'),
      { expiresIn: '10m' } as jwt.SignOptions
    );

    const { req, res, next } = await runAuthenticate(freshToken);

    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(next).toHaveBeenCalled();
    expect(req.user.email).toBe(TEST_EMAIL);
  });

  it('is safe to call twice for the same token', async () => {
    const decoded = jwt.decode(token) as { id: number };
    const req: any = {
      headers: { authorization: `Bearer ${token}` },
      query: {},
      ip: '127.0.0.1',
      user: { id: String(decoded.id), email: TEST_EMAIL, role: 'patient' },
    };
    const res = mockRes();

    await logout(req, res);

    expect(res.json.mock.calls[0][0]).toEqual({ message: 'Logged out successfully' });
  });
});

describe('token hashing helper', () => {
  it('produces a stable sha256 digest and never the token itself', () => {
    const digest = hashToken('a.b.c');
    expect(digest).toBe(createHash('sha256').update('a.b.c').digest('hex'));
    expect(digest).toHaveLength(64);
    expect(digest).not.toContain('a.b.c');
  });
});
