import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthRequest } from '../middleware/auth.js'
import { enforcePasswordChange } from '../middleware/auth.js'
import * as authController from '../controllers/auth.controller.js'

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

describe('Password Enforcement', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('blocks requests when password change required and postpone limit reached', async () => {
    pool.query.mockResolvedValueOnce([[{ password_must_change: 1, password_postpone_count: 3 }]])
    const req = { user: { id: '1' }, originalUrl: '/api/dashboard/stats', baseUrl: '/api/dashboard', path: '/stats' } as unknown as AuthRequest
    const res = mockRes()
    const next = vi.fn()
    await enforcePasswordChange(req, res as any, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Password change required' })
    expect(next).not.toHaveBeenCalled()
  })

  it('allows exempt routes', async () => {
    pool.query.mockResolvedValueOnce([[{ password_must_change: 1, password_postpone_count: 10 }]])
    const req = { user: { id: '1' }, originalUrl: '/api/auth/me', baseUrl: '/api/auth', path: '/me' } as unknown as AuthRequest
    const res = mockRes()
    const next = vi.fn()
    await enforcePasswordChange(req, res as any, next)
    expect(next).toHaveBeenCalled()
  })
})

describe('Postpone Password Change', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects postpone for Super Admin with default password', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: '1', password: '$2b$10$hash', role: 'Super Admin', password_must_change: 1, password_postpone_count: 0 }]])
    const req = { user: { id: '1' }, body: {}, headers: {}, ip: '127.0.0.1' } as unknown as AuthRequest
    const res = mockRes()
    await authController.postponePasswordChange(req, res as any)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Super Admins must change default password immediately' })
  })
})