import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import type { AuthRequest } from '../middleware/auth.js'
import * as authController from '../controllers/auth.controller.js'
import { currentToken, verifyToken, generateSecret, base32Encode, base32Decode } from '../utils/totp.js'

vi.mock('../config/database.js', () => {
  return {
    default: {
      query: vi.fn()
    }
  }
})

// Demo seed used everywhere in the SPA + seed.sql (base32 of JBSWY3DPEHPK3PXP)
const DEMO_SECRET = 'GEZDGNBVGY3TQOJQ'

const pool: any = (await import('../config/database.js')).default

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('TOTP utility', () => {
  it('round-trips base32 encode/decode', () => {
    const secret = generateSecret()
    expect(base32Decode(secret)).toHaveLength(20)
    expect(base32Encode(base32Decode(secret))).toBe(secret)
  })

  it('verifies the current code for a known secret', () => {
    const code = currentToken(DEMO_SECRET)
    expect(code).toMatch(/^\d{6}$/)
    expect(verifyToken(DEMO_SECRET, code)).toBe(true)
  })

  it('rejects a wrong code', () => {
    const code = currentToken(DEMO_SECRET)
    const bad = code === '000000' ? '000001' : '000000'
    expect(verifyToken(DEMO_SECRET, bad)).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(verifyToken(DEMO_SECRET, '12345')).toBe(false)  // too short
    expect(verifyToken(DEMO_SECRET, 'abcdef')).toBe(false) // non-numeric
    expect(verifyToken(DEMO_SECRET, '')).toBe(false)
  })

  it('rejects stale codes outside the tolerance window', () => {
    const now = Math.floor(Date.now() / 1000 / 30)
    // 10 minutes (20 steps) in the past — well outside the ±1 step window
    const stale = computeStaleCode(now - 20)
    expect(verifyToken(DEMO_SECRET, stale)).toBe(false)
  })
})

// Local helper to produce a code for an arbitrary step (mirrors TOTP math used
// by the implementation under test so we can assert old codes are rejected).
function computeStaleCode(step: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = DEMO_SECRET.replace(/[\s=]+/g, '')
  let bits = ''
  for (const ch of clean) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const data = Buffer.alloc(8)
  data.writeUInt32BE(0, 0)
  data.writeUInt32BE(step >>> 0, 4)
  const hmac = crypto.createHmac('sha1', key).update(data).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (code % 10 ** 6).toString().padStart(6, '0')
}

describe('verifyTwoFactor controller', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects without an authenticated user', async () => {
    const req = {} as AuthRequest
    const res = mockRes()
    await authController.verifyTwoFactor(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
  })

  it('rejects a malformed code', async () => {
    const req = { user: { id: '1', email: 'admin@smarthealth.com', role: 'Admin' }, body: { code: '12' } } as unknown as AuthRequest
    const res = mockRes()
    await authController.verifyTwoFactor(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid code' })
  })

  it('rejects a user without a TOTP secret', async () => {
    pool.query.mockResolvedValueOnce([[{ id: '1', totp_secret: null }]])
    const req = { user: { id: '1', email: 'plain@smarthealth.com', role: 'Patient' }, body: { code: '123456' } } as unknown as AuthRequest
    const res = mockRes()
    await authController.verifyTwoFactor(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Two-factor authentication is not enabled for this account' })
  })

  it('rejects an invalid TOTP code', async () => {
    pool.query.mockResolvedValueOnce([[{ id: '1', role_id: 2, email: 'admin@smarthealth.com', name: 'Admin', totp_secret: DEMO_SECRET }]])
    const req = { user: { id: '1', email: 'admin@smarthealth.com', role: 'Admin' }, body: { code: '000000' } } as unknown as AuthRequest
    const res = mockRes()
    await authController.verifyTwoFactor(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired authentication code' })
  })

  it('issues a full token and user for a valid TOTP code', async () => {
    const now = Math.floor(Date.now() / 1000 / 30)
    const validCode = computeStaleCode(now)
    pool.query
      .mockResolvedValueOnce([[{ id: '1', role_id: 2, email: 'admin@smarthealth.com', name: 'Admin', totp_secret: DEMO_SECRET }]]) // SELECT user
      .mockResolvedValueOnce([[{ name: 'Admin' }]]) // SELECT role
      .mockResolvedValueOnce([[{ module: 'users', can_view: 1, can_add: 1, can_edit: 1, can_delete: 1 }]]) // SELECT perms
    const req = { user: { id: '1', email: 'admin@smarthealth.com', role: 'Admin' }, body: { code: validCode } } as unknown as AuthRequest
    const res = mockRes()
    await authController.verifyTwoFactor(req as any, res as any)
    expect(res.status).not.toHaveBeenCalledWith(401)
    const payload = res.json.mock.calls[0][0]
    expect(payload).toHaveProperty('token')
    expect(payload.user).toMatchObject({ id: '1', email: 'admin@smarthealth.com', role: 'Admin' })
    expect(payload.user.permissions).toContain('users:view')
  })
})