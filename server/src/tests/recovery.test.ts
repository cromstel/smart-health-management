import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthRequest } from '../middleware/auth.js'
import * as authController from '../controllers/auth.controller.js'
import { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode } from '../utils/totp.js'

vi.mock('../config/database.js', () => {
  return {
    default: {
      query: vi.fn()
    }
  }
})

const pool: any = (await import('../config/database.js')).default

const VALID_CODE = 'ABCDE-FGHJK'
const WASTED = '12345-6789A'

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function userRow(recoveryCodes: string) {
  return {
    id: '1',
    role_id: 2,
    email: 'admin@smarthealth.com',
    name: 'Admin User',
    totp_secret: 'GEZDGNBVGY3TQOJQ', // 2FA enabled
    recovery_codes: recoveryCodes,
  }
}

describe('recovery code utilities', () => {
  it('generates the requested count in XXXXX-XXXXX format', () => {
    const codes = generateRecoveryCodes(10)
    expect(codes).toHaveLength(10)
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/)
      // No ambiguous characters (0/O/1/I/L) in the alphabet
      expect(c).not.toMatch(/[01OIL]/)
    }
  })

  it('generates distinct codes', () => {
    const codes = generateRecoveryCodes(25)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('hashes deterministically and case-insensitively', () => {
    expect(hashRecoveryCode(VALID_CODE)).toBe(hashRecoveryCode(VALID_CODE))
    expect(hashRecoveryCode('abcde-fghjk')).toBe(hashRecoveryCode(VALID_CODE))
    expect(hashRecoveryCode(VALID_CODE)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('verifies a matching code and rejects wrong/malformed ones', () => {
    const hashes = [hashRecoveryCode(VALID_CODE)]
    expect(verifyRecoveryCode(hashes, VALID_CODE)).toBe(true)
    expect(verifyRecoveryCode(hashes, WASTED)).toBe(false)
    expect(verifyRecoveryCode(hashes, '')).toBe(false)
    expect(verifyRecoveryCode(hashes, VALID_CODE.toLowerCase())).toBe(true)
  })
})

describe('verifyRecovery controller', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects without an authenticated user', async () => {
    const req = {} as AuthRequest
    const res = mockRes()
    await authController.verifyRecovery(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
  })

  it('rejects a malformed recovery code', async () => {
    const req = { user: { id: '1', email: 'admin@smarthealth.com', role: 'Admin' }, body: { code: 'ABCDE' } } as unknown as AuthRequest
    const res = mockRes()
    await authController.verifyRecovery(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Recovery code must be in XXXXX-XXXXX format' })
  })

  it('rejects a user without 2FA enabled', async () => {
    pool.query.mockResolvedValueOnce([[{ ...userRow('[]'), totp_secret: null }]])
    const req = { user: { id: '1', email: 'plain@smarthealth.com', role: 'Patient' }, body: { code: VALID_CODE } } as unknown as AuthRequest
    const res = mockRes()
    await authController.verifyRecovery(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Two-factor authentication is not enabled for this account' })
  })

  it('rejects when no recovery codes are stored', async () => {
    pool.query.mockResolvedValueOnce([[userRow('[]')]])
    const req = { user: { id: '1', email: 'admin@smarthealth.com', role: 'Admin' }, headers: { 'user-agent': 'vitest' }, body: { code: VALID_CODE } } as unknown as AuthRequest
    const res = mockRes()
    await authController.verifyRecovery(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'No recovery codes are available for this account' })
  })

  it('rejects a code that does not match any stored hash', async () => {
    pool.query.mockResolvedValueOnce([[userRow(JSON.stringify([hashRecoveryCode(VALID_CODE)]))]])
    const req = { user: { id: '1', email: 'admin@smarthealth.com', role: 'Admin' }, body: { code: WASTED } } as unknown as AuthRequest
    const res = mockRes()
    await authController.verifyRecovery(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or already used recovery code' })
  })

  it('issues a full session for a valid code and burns it (single-use)', async () => {
    pool.query
      .mockResolvedValueOnce([[userRow(JSON.stringify([hashRecoveryCode(VALID_CODE), hashRecoveryCode(WASTED)]))]]) // SELECT user
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE burn
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // audit INSERT
      .mockResolvedValueOnce([[{ name: 'Admin' }]]) // SELECT role
      .mockResolvedValueOnce([[{ module: 'users', can_view: 1, can_add: 1, can_edit: 1, can_delete: 1 }]]) // SELECT perms
    const req = { user: { id: '1', email: 'admin@smarthealth.com', role: 'Admin' }, headers: { 'user-agent': 'vitest' }, body: { code: VALID_CODE } } as unknown as AuthRequest
    const res = mockRes()
    await authController.verifyRecovery(req as any, res as any)

    expect(res.status).not.toHaveBeenCalledWith(401)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toHaveProperty('token')
    expect(payload.user).toMatchObject({ id: '1', email: 'admin@smarthealth.com', role: 'Admin' })
    expect(payload.user.permissions).toContain('users:view')

    // The burned code's hash must be gone from the persisted list
    const update = pool.query.mock.calls.find((c: any[]) => c[0].includes('UPDATE users'))
    expect(update).toBeTruthy()
    const stored = JSON.parse(update[1][0])
    expect(stored).toHaveLength(1)
    expect(stored[0]).toBe(hashRecoveryCode(WASTED))
    expect(stored[0]).not.toBe(hashRecoveryCode(VALID_CODE))
  })

  it('handles mysql2 auto-parsed JSON arrays (not just string columns)', async () => {
    pool.query
      .mockResolvedValueOnce([[{ ...userRow('[]'), recovery_codes: [hashRecoveryCode(VALID_CODE)] }]]) // already-parsed array
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ name: 'Admin' }]])
      .mockResolvedValueOnce([[{ module: 'users', can_view: 1, can_add: 1, can_edit: 1, can_delete: 1 }]])
    const req = { user: { id: '1', email: 'admin@smarthealth.com', role: 'Admin' }, headers: { 'user-agent': 'vitest' }, body: { code: VALID_CODE } } as unknown as AuthRequest
    const res = mockRes()
    await authController.verifyRecovery(req as any, res as any)
    expect(res.status).not.toHaveBeenCalledWith(401)
    expect(res.json.mock.calls[0][0]).toHaveProperty('token')
  })
})