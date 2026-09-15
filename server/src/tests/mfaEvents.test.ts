import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthRequest } from '../middleware/auth.js'
import { getMfaEvents } from '../controllers/auth.controller.js'

vi.mock('../config/database.js', () => {
  return {
    default: {
      query: vi.fn()
    }
  }
})

const pool: any = (await import('../config/database.js')).default

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('getMfaEvents controller', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects without an authenticated user', async () => {
    const req = {} as AuthRequest
    const res = mockRes()
    await getMfaEvents(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
  })

  it('returns only the authenticated user\u2019s 2FA events, newest first', async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 'evt-2',
        action: 'mfa_totp_changed',
        new_value: JSON.stringify({ enabled: true, recovery_codes: 10 }),
        ip_address: '10.0.0.1',
        created_at: '2026-09-11T10:00:00.000Z'
      },
      {
        id: 'evt-1',
        action: 'mfa_recovery_used',
        new_value: JSON.stringify({ remaining: 9 }),
        ip_address: '10.0.0.2',
        created_at: '2026-09-10T09:30:00.000Z'
      }
    ]])

    const req = {
      user: { id: 'u-1', email: 'admin@smarthealth.com', role: 'Admin' },
      headers: { 'user-agent': 'vitest' }
    } as unknown as AuthRequest
    const res = mockRes()
    await getMfaEvents(req as any, res as any)

    expect(res.status).not.toHaveBeenCalledWith(500)
    const payload = res.json.mock.calls[0][0]

    // The query is scoped to the caller's user id + MFA actions only.
    const { calls } = pool.query.mock
    const sql = calls[0][0] as string
    expect(sql).toContain('WHERE user_id = ?')
    expect(sql).toContain('AND action IN')
    expect(calls[0][1]).toEqual(['u-1'])
    expect(sql).toMatch(/mfa_totp_changed.*mfa_totp_disabled.*mfa_recovery_used/)

    // Ordering and parsing.
    expect(payload.events).toHaveLength(2)
    expect(payload.events[0].action).toBe('mfa_totp_changed')
    expect(payload.events[0].details).toMatchObject({ enabled: true, recovery_codes: 10 })
    expect(payload.events[1].details).toMatchObject({ remaining: 9 })
    expect(payload.events[1].ip).toBe('10.0.0.2')
    expect(payload.events[0].createdAt).toBe('2026-09-11T10:00:00.000Z')
  })

  it('returns an empty list when there are no events', async () => {
    pool.query.mockResolvedValueOnce([[]])
    const req = {
      user: { id: 'u-1', email: 'noop@smarthealth.com', role: 'Patient' },
      headers: { 'user-agent': 'vitest' }
    } as unknown as AuthRequest
    const res = mockRes()
    await getMfaEvents(req as any, res as any)
    expect(res.status).not.toHaveBeenCalledWith(500)
    expect(res.json.mock.calls[0][0]).toEqual({ events: [] })
  })

  it('tolerates unparseable new_value payloads', async () => {
    pool.query.mockResolvedValueOnce([[
      {
        id: 'evt-x',
        action: 'mfa_totp_disabled',
        new_value: 'not-json',
        ip_address: null,
        created_at: '2026-09-11T10:00:00.000Z'
      }
    ]])
    const req = {
      user: { id: 'u-1', email: 'admin@smarthealth.com', role: 'Admin' },
      headers: { 'user-agent': 'vitest' }
    } as unknown as AuthRequest
    const res = mockRes()
    await getMfaEvents(req as any, res as any)
    const payload = res.json.mock.calls[0][0]
    expect(payload.events[0].action).toBe('mfa_totp_disabled')
    expect(payload.events[0].details).toBeNull()
  })
})