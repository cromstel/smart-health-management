import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';

// The mailer is replaced so the test never touches a real SMTP server and
// so the reset link (the only place the raw token exists) can be captured.
const { sentEmails } = vi.hoisted(() => ({ sentEmails: [] as any[] }));

vi.mock('../utils/mail.js', () => ({
  sendEmail: vi.fn(async (options: any) => {
    sentEmails.push(options);
  }),
}));

import pool from '../config/database.js';
import { forgotPassword, resetPassword, meetsPasswordPolicy } from '../controllers/auth.controller.js';

const TEST_EMAIL = 'pwreset.agent@test.local';
const ORIGINAL_PASSWORD = 'Original@2026';
const NEW_PASSWORD = 'BrandNew@2026';

let userId = 0;

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(body: any = {}, extra: any = {}) {
  return {
    body,
    ip: '127.0.0.1',
    headers: { 'user-agent': 'vitest' },
    ...extra,
  } as any;
}

/** The raw token only ever exists in the delivered email. */
function tokenFromEmail(email: any): string {
  const match = /token=([0-9a-f]{64})/.exec(email.text);
  expect(match, 'the reset email must carry a 64 character token').toBeTruthy();
  return match![1];
}

const resetRows = async () => {
  const [rows] = await pool.query(
    'SELECT * FROM password_resets WHERE user_id = ? ORDER BY id',
    [userId]
  );
  return rows as any[];
};

beforeAll(async () => {
  // Make sure the mail path is taken, whatever the ambient environment says.
  process.env.SMTP_HOST = 'smtp.test.local';
  process.env.SMTP_USER = 'test-user';
  process.env.SMTP_PASS = 'test-pass';

  const hashed = await bcrypt.hash(ORIGINAL_PASSWORD, 10);
  const [result] = await pool.query(
    `INSERT INTO users (email, password, name, role_id, hospital_id, password_must_change)
     VALUES (?, ?, ?, 4, 1, 1)`,
    [TEST_EMAIL, hashed, 'Password Reset Agent']
  );
  userId = (result as any).insertId;
});

afterAll(async () => {
  await pool.query('DELETE FROM audit_logs WHERE user_id = ?', [userId]);
  await pool.query('DELETE FROM users WHERE id = ?', [userId]);
  await pool.end();
});

beforeEach(() => {
  sentEmails.length = 0;
});

describe('password policy helper', () => {
  it('accepts a password that satisfies the length rule and three dimensions', () => {
    // length + lower + number
    expect(meetsPasswordPolicy('lowercase123')).toBe(true);
    // length + upper + lower + number + special
    expect(meetsPasswordPolicy('Passw0rd!')).toBe(true);
    // length + lower + special
    expect(meetsPasswordPolicy('longenough!')).toBe(true);
  });

  it('rejects short or too-simple passwords', () => {
    // Four character classes but too short: the length is not negotiable.
    expect(meetsPasswordPolicy('Ab1!')).toBe(false);
    // Long enough but only one character class.
    expect(meetsPasswordPolicy('alllowercase')).toBe(false);
    expect(meetsPasswordPolicy(undefined)).toBe(false);
    expect(meetsPasswordPolicy(12345678)).toBe(false);
  });
});

describe('POST /auth/forgot-password', () => {
  it('stores only the hash of the token and never the raw token', async () => {
    const res = mockRes();
    await forgotPassword(mockReq({ email: TEST_EMAIL }), res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toEqual({
      message: 'If the email exists, a reset link has been sent',
    });

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe(TEST_EMAIL);

    const rawToken = tokenFromEmail(sentEmails[0]);

    const rows = await resetRows();
    expect(rows).toHaveLength(1);

    const row = rows[0];
    // The stored value is the SHA-256 digest, not the token itself.
    expect(row.token_hash).toBe(createHash('sha256').update(rawToken).digest('hex'));
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.ip_address).toBe('127.0.0.1');
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now());

    // The raw token is nowhere in the table.
    const [leak] = await pool.query(
      `SELECT COUNT(*) AS c FROM password_resets
        WHERE CONCAT(token_hash, ' ', COALESCE(ip_address, ''), ' ', COALESCE(used_at, '')) LIKE ?`,
      [`%${rawToken}%`]
    );
    expect((leak as any[])[0].c).toBe(0);
  });

  it('answers an unknown address with the same generic response and sends nothing', async () => {
    const res = mockRes();
    await forgotPassword(mockReq({ email: 'nobody.here@test.local' }), res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toEqual({
      message: 'If the email exists, a reset link has been sent',
    });
    expect(sentEmails).toHaveLength(0);

    const [rows] = await pool.query(
      `SELECT COUNT(*) AS c FROM password_resets pr
        JOIN users u ON u.id = pr.user_id
       WHERE u.email = ?`,
      ['nobody.here@test.local']
    );
    expect((rows as any[])[0].c).toBe(0);
  });

  it('invalidates the previous unused reset link when a new one is requested', async () => {
    const before = (await resetRows()).length;

    const first = mockRes();
    await forgotPassword(mockReq({ email: TEST_EMAIL }), first);
    const second = mockRes();
    await forgotPassword(mockReq({ email: TEST_EMAIL }), second);

    const rows = await resetRows();
    expect(rows).toHaveLength(before + 2);

    const stillUsable = rows.filter((row) => row.used_at === null);
    expect(stillUsable).toHaveLength(1);

    // The first link was burned, so it can no longer be redeemed.
    const firstToken = tokenFromEmail(sentEmails[0]);
    const res = mockRes();
    await resetPassword(mockReq({ token: firstToken, password: NEW_PASSWORD }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/already been used/i);
  });
});

describe('POST /auth/reset-password', () => {
  it('rejects an unknown token', async () => {
    const res = mockRes();
    await resetPassword(mockReq({ token: 'f'.repeat(64), password: NEW_PASSWORD }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/invalid or expired/i);
  });

  it('rejects a token that does not meet the complexity policy', async () => {
    const res = mockRes();
    await resetPassword(mockReq({ token: 'a'.repeat(64), password: 'weak' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/complexity/i);
  });

  it('rejects an expired token', async () => {
    const expiredToken = 'e'.repeat(64);
    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at, ip_address)
       VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 1 HOUR), '127.0.0.1')`,
      [userId, createHash('sha256').update(expiredToken).digest('hex')]
    );

    const res = mockRes();
    await resetPassword(mockReq({ token: expiredToken, password: NEW_PASSWORD }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/expired/i);
  });

  it('sets the new password, clears the change flag and burns the token', async () => {
    const request = mockRes();
    await forgotPassword(mockReq({ email: TEST_EMAIL }), request);
    const rawToken = tokenFromEmail(sentEmails[0]);

    const res = mockRes();
    await resetPassword(mockReq({ token: rawToken, password: NEW_PASSWORD }), res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toEqual({ message: 'Password reset successfully' });

    // The token is single use.
    const rows = await resetRows();
    const used = rows.find((row) => row.used_at !== null);
    expect(used).toBeTruthy();

    // The new password is the one that is stored.
    const [users] = await pool.query(
      'SELECT password, password_must_change FROM users WHERE id = ?',
      [userId]
    );
    const user = (users as any[])[0];
    expect(await bcrypt.compare(NEW_PASSWORD, user.password)).toBe(true);
    expect(await bcrypt.compare(ORIGINAL_PASSWORD, user.password)).toBe(false);
    expect(user.password_must_change).toBe(0);

    // Replaying the same link is rejected.
    const replay = mockRes();
    await resetPassword(mockReq({ token: rawToken, password: 'Another@2026' }), replay);
    expect(replay.status).toHaveBeenCalledWith(400);
    expect(replay.json.mock.calls[0][0].error).toMatch(/already been used/i);
  });
});
