import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { requirePermission } from '../../middleware/auth'

vi.mock('../../config/database.js', () => {
  return {
    default: {
      query: vi.fn((sql: string, _params: any[]) => {
        if (String(sql).includes("p.module = 'all'")) {
          return Promise.resolve([[{ allowed: 0 }]])
        }
        return Promise.resolve([[{ allowed: 1 }]])
      }),
      getConnection: vi.fn()
    }
  }
})

function makeReq(user: any, extras: Partial<Request> = {}): any {
  return { user, query: {}, body: {}, params: {}, ...extras }
}

function makeRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn(() => res as Response)
  ;(res as any).json = vi.fn(() => res as Response)
  return res as Response
}

const next: NextFunction = vi.fn()

describe('requirePermission hospital scoping', () => {
  beforeEach(() => {
    ;(next as any).mockClear()
  })

  it('allows when hospital matches', async () => {
    const req = makeReq({ id: 'u1', hospital_id: 'h1' }, { query: { hospital: 'h1' } })
    const res = makeRes()
    const mw = requirePermission('patients', 'view')
    await mw(req as any, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('blocks when hospital mismatches', async () => {
    const req = makeReq({ id: 'u1', hospital_id: 'h1' }, { query: { hospital: 'h2' } })
    const res = makeRes()
    const mw = requirePermission('patients', 'view')
    await mw(req as any, res, next)
    expect((res.status as any)).toHaveBeenCalledWith(403)
  })

  it('blocks when hospital missing', async () => {
    const req = makeReq({ id: 'u1', hospital_id: undefined }, { query: { hospital: 'h1' } })
    const res = makeRes()
    const mw = requirePermission('staff', 'edit')
    await mw(req as any, res, next)
    expect((res.status as any)).toHaveBeenCalledWith(403)
  })
})