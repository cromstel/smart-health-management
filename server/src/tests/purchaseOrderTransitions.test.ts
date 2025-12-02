import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { updatePurchaseOrder } from '../controllers/purchaseOrder.controller'

function makeRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn(() => res as Response)
  ;(res as any).json = vi.fn(() => res as Response)
  return res as Response
}

vi.mock('../config/database.js', () => {
  const state: any = { status: 'pending' }
  return {
    default: {
      getConnection: async () => ({
        beginTransaction: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
        query: vi.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT status FROM purchase_orders')) return Promise.resolve([[{ status: state.status }]])
          if (sql.includes('UPDATE purchase_orders SET status')) { state.status = params[0]; return Promise.resolve([[]]) }
          if (sql.includes('SELECT * FROM purchase_order_items')) return Promise.resolve([[{ medicine_id: 'm1', quantity: 5 }]])
          if (sql.includes('UPDATE medicines_inventory SET')) return Promise.resolve([[]])
          return Promise.resolve([[]])
        }),
        release: vi.fn()
      })
    }
  }
})

describe('Purchase Order transitions', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('allows valid transitions', async () => {
    const req = { params: { id: 'po1' }, body: { status: 'submitted' } } as any as AuthRequest
    const res = makeRes()
    await updatePurchaseOrder(req, res)
    expect((res.status as any)).not.toHaveBeenCalledWith(400)
    const req2 = { params: { id: 'po1' }, body: { status: 'approved' } } as any as AuthRequest
    await updatePurchaseOrder(req2, res)
    const req3 = { params: { id: 'po1' }, body: { status: 'fulfilled' } } as any as AuthRequest
    await updatePurchaseOrder(req3, res)
  })

  it('blocks invalid transitions', async () => {
    const req = { params: { id: 'poX' }, body: { status: 'fulfilled' } } as any as AuthRequest
    const res = makeRes()
    await updatePurchaseOrder(req, res)
    expect((res.status as any)).toHaveBeenCalledWith(400)
  })
})