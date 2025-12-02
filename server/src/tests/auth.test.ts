import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextFunction, Response } from 'express'
import { requirePermission } from '../middleware/auth'

vi.mock('../config/database.js', () => {
  return {
    default: {
      query: vi.fn(async (sql: string, args: any[]) => {
        if (sql.includes("WHERE u.id = ? AND p.module = 'all'")) {
          return [[{ allowed: 0 }]]
        }
        if (sql.includes('WHERE u.id = ? AND p.module = ?')) {
          const module = args[1]
          if (module === 'appointments') return [[{ allowed: 1 }]]
          if (module === 'patients') return [[{ allowed: 1 }]]
          return [[{ allowed: 0 }]]
        }
        return [[]]
      })
    }
  }
})

function makeReq(user: any, extra: any = {}) {
  return { user, ...extra }
}

function makeRes() {
  const res: Partial<Response> = {}
  ;(res.status as any) = vi.fn(() => res)
  ;(res.json as any) = vi.fn(() => res)
  return res as Response
}

const next: NextFunction = vi.fn()

describe('requirePermission auth + hospital validation', () => {
  beforeEach(() => {
    ;(next as any).mockClear()
  })

  it('returns 401 when user missing', async () => {
    const req = makeReq(undefined)
    const res = makeRes()
    const mw = requirePermission('appointments', 'view')
    await mw(req as any, res, next)
    expect((res.status as any)).toHaveBeenCalledWith(401)
  })

  it('allows view when hospital matches', async () => {
    const req = makeReq({ id: 'u1', hospital_id: 'h1' }, { query: { hospital: 'h1' } })
    const res = makeRes()
    const mw = requirePermission('appointments', 'view')
    await mw(req as any, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('blocks view when hospital mismatches', async () => {
    const req = makeReq({ id: 'u1', hospital_id: 'h1' }, { query: { hospital: 'h2' } })
    const res = makeRes()
    const mw = requirePermission('appointments', 'view')
    await mw(req as any, res, next)
    expect((res.status as any)).toHaveBeenCalledWith(403)
    expect((res.json as any)).toHaveBeenCalledWith({ error: 'Hospital mismatch' })
  })

  // Note: all:view override is validated in dedicated middleware tests

  it('returns 500 on internal errors', async () => {
    vi.doMock('../config/database.js', () => ({
      default: {
        query: vi.fn(async () => { throw new Error('db error') })
      }
    }))
    const { requirePermission: rp } = await import('../middleware/auth')
    const req = makeReq({ id: 'u1', hospital_id: 'h1' })
    const res = makeRes()
    const mw = rp('appointments', 'view')
    await mw(req as any, res, next)
    expect((res.status as any)).toHaveBeenCalledWith(500)
  })
})
