import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextFunction, Response } from 'express'
import { requirePermission } from '../middleware/auth'

/**
 * Whether the database fails.
 *
 * The check has to answer 500 when the database is unreachable, and it has
 * to be that the database is unreachable rather than the mock that is
 * arranged to say so: the flag is read by the mock, so the same code path is
 * exercised either way.
 */
let databaseFails = false;

vi.mock('../config/database.js', () => {
  return {
    default: {
      query: vi.fn(async (sql: string, args: any[]) => {
        if (databaseFails) throw new Error('db error')
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

/**
 * A request as the authentication middleware leaves it.
 *
 * The tenant scope is worked out from the account's own row when the request
 * is authenticated, and it is what the permission check confines the request
 * to. A request that names a hospital is checked against that scope; it is
 * not the scope.
 */
function makeReq(user: any, extra: any = {}) {
  const tenant = extra.tenant ?? {
    hospitalId: 1,
    hospitalCode: 'h1',
    platformWide: false,
  }
  return { user, tenant, query: {}, body: {}, params: {}, ...extra }
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
    const req = makeReq({ id: 'u1', hospital_id: 'h1' }, { query: { hospital: '1' } })
    const res = makeRes()
    const mw = requirePermission('appointments', 'view')
    await mw(req as any, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('allows view when the request names the hospital by its code', async () => {
    const req = makeReq({ id: 'u1', hospital_id: 'h1' }, { query: { hospital: 'h1' } })
    const res = makeRes()
    const mw = requirePermission('appointments', 'view')
    await mw(req as any, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('blocks view when hospital mismatches', async () => {
    const req = makeReq({ id: 'u1', hospital_id: 'h1' }, { query: { hospital: '2' } })
    const res = makeRes()
    const mw = requirePermission('appointments', 'view')
    await mw(req as any, res, next)
    expect((res.status as any)).toHaveBeenCalledWith(403)
    expect((res.json as any)).toHaveBeenCalledWith({ error: 'Hospital mismatch' })
  })

  it('allows a request that names no hospital at all', async () => {
    // The scope is the caller's own, so a request that names nothing is
    // already inside it. A request that named another hospital would not be.
    const req = makeReq({ id: 'u1', hospital_id: 'h1' })
    const res = makeRes()
    const mw = requirePermission('appointments', 'view')
    await mw(req as any, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('refuses a caller whose account belongs to no hospital', async () => {
    const req = makeReq({ id: 'u1' }, { tenant: { hospitalId: null, hospitalCode: null, platformWide: false } })
    const res = makeRes()
    const mw = requirePermission('patients', 'view')
    await mw(req as any, res, next)
    expect((res.status as any)).toHaveBeenCalledWith(403)
    expect((res.json as any)).toHaveBeenCalledWith({ error: 'Missing hospital context' })
  })

  it('lets a platform-wide caller through without a hospital', async () => {
    const req = makeReq({ id: 'u1' }, { tenant: { hospitalId: null, hospitalCode: null, platformWide: true } })
    const res = makeRes()
    const mw = requirePermission('patients', 'view')
    await mw(req as any, res, next)
    expect(next).toHaveBeenCalled()
  })

  // Note: all:view override is validated in dedicated middleware tests

  it('returns 500 on internal errors', async () => {
    databaseFails = true;
    try {
      const req = makeReq({ id: 'u1', hospital_id: 'h1' })
      const res = makeRes()
      const mw = requirePermission('appointments', 'view')
      await mw(req as any, res, next)
      expect((res.status as any)).toHaveBeenCalledWith(500)
    } finally {
      databaseFails = false
    }
  })
})
