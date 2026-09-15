import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthRequest } from '../middleware/auth.js'
import { resetUserPassword, generateTemporaryPassword } from '../controllers/superAdmin.controller.js'

vi.mock('../config/database.js', () => {
  return {
    default: {
      getConnection: vi.fn()
    }
  }
})

const pool: any = (await import('../config/database.js')).default

const VALID_USER_ID = '42'

function makeConn(): any {
  return {
    query: vi.fn(),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn()
  }
}

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function adminReq(userId = VALID_USER_ID, body: any = {}) {
  return {
    user: { id: 'admin-1', email: 'superadmin@smarthealth.com', role: 'Super Admin' },
    headers: { 'user-agent': 'vitest' },
    ip: '127.0.0.1',
    params: { userId },
    body
  } as unknown as AuthRequest
}

describe('generateTemporaryPassword', () => {
  it('generates 16-char passwords by default that satisfy the complexity policy', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTemporaryPassword()
      expect(pw).toHaveLength(16)
      expect(pw).toMatch(/[A-Z]/) // upper
      expect(pw).toMatch(/[a-z]/) // lower
      expect(pw).toMatch(/[0-9]/) // digit
      expect(pw).toMatch(/[^A-Za-z0-9]/) // special
    }
  })

  it('never violates the minimum length policy regardless of requested length', () => {
    expect(generateTemporaryPassword(4)).toHaveLength(8)
    expect(generateTemporaryPassword(8)).toHaveLength(8)
  })

  it('does not produce ambiguous glyphs and generates distinct values', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const pw = generateTemporaryPassword()
      expect(pw).not.toMatch(/[01OIl]/)
      seen.add(pw)
    }
    expect(seen.size).toBe(50)
  })
})

describe('resetUserPassword controller', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects without an authenticated user', async () => {
    const req = { params: { userId: VALID_USER_ID }, body: {} } as unknown as AuthRequest
    const res = mockRes()
    await resetUserPassword(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
  })

  it('rejects resetting your own account through the admin path', async () => {
    const req = adminReq('admin-1')
    const res = mockRes()
    await resetUserPassword(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].error).toContain('cannot reset your own password')
    // No DB calls should happen at all
    expect(pool.getConnection).not.toHaveBeenCalled()
  })

  it('returns 404 when the target user does not exist', async () => {
    const conn = makeConn()
    conn.query.mockResolvedValueOnce([[]]) // SELECT user - empty
    pool.getConnection.mockResolvedValue(conn)
    const res = mockRes()
    await resetUserPassword(adminReq() as any, res as any)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' })
    expect(conn.release).toHaveBeenCalled()
  })

  it('resets password, unlocks the account, forces change, and logs (no 2FA clear)', async () => {
    const conn = makeConn()
    conn.query
      .mockResolvedValueOnce([[{ id: VALID_USER_ID, email: 'doctor@smarthealth.com' }]]) // SELECT target
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE credentials
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT audit
    pool.getConnection.mockResolvedValue(conn)

    const res = mockRes()
    await resetUserPassword(adminReq() as any, res as any)

    expect(res.status).not.toHaveBeenCalledWith(401)
    expect(res.status).not.toHaveBeenCalledWith(404)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toMatchObject({ message: 'Password reset successfully', mustChange: true, twoFactorDisabled: false })
    expect(payload.temporaryPassword).toMatch(/[A-Z]/)
    expect(payload.temporaryPassword).toMatch(/[a-z]/)
    expect(payload.temporaryPassword).toMatch(/[0-9]/)
    expect(payload.temporaryPassword).toMatch(/[^A-Za-z0-9]/)

    // Credential update must unlock + force change
    const baseUpdate = conn.query.mock.calls.find((c: any[]) => c[0].includes('password_must_change'))
    expect(baseUpdate).toBeTruthy()
    expect(baseUpdate[0]).toContain('SET password = ?')
    expect(baseUpdate[0]).toContain("login_attempts = 0")
    expect(baseUpdate[0]).toContain("status = 'active'")

    // audit details must never contain the temporary password
    const auditInsert = conn.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO audit_logs'))
    expect(auditInsert).toBeTruthy()
    const details = auditInsert[1][1] as string
    expect(details).toContain('doctor@smarthealth.com')
    expect(details).not.toContain(payload.temporaryPassword)

    // transaction committed, release called
    expect(conn.commit).toHaveBeenCalled()
    expect(conn.release).toHaveBeenCalled()

    // No 2FA-clear statement in this branch
    const clear2fa = conn.query.mock.calls.find((c: any[]) => c[0].includes('totp_secret = NULL'))
    expect(clear2fa).toBeFalsy()
  })

  it('clears totp_secret + recovery_codes and flags it when clear_two_factor is true', async () => {
    const conn = makeConn()
    conn.query
      .mockResolvedValueOnce([[{ id: VALID_USER_ID, email: 'locked@smarthealth.com' }]]) // SELECT target
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE credentials
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE clear 2FA
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT audit
    pool.getConnection.mockResolvedValue(conn)

    const res = mockRes()
    await resetUserPassword(adminReq(VALID_USER_ID, { clear_two_factor: true }) as any, res as any)

    const payload = res.json.mock.calls[0][0]
    expect(payload.twoFactorDisabled).toBe(true)

    const clear2fa = conn.query.mock.calls.find((c: any[]) => c[0].includes('totp_secret = NULL'))
    expect(clear2fa).toBeTruthy()
    expect(clear2fa[0]).toContain('recovery_codes = NULL')

    const auditInsert = conn.query.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO audit_logs'))
    expect((auditInsert[1][1] as string)).toContain('2FA cleared')
  })
})