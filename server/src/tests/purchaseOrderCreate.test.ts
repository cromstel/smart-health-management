import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { createPurchaseOrder, updatePurchaseOrder } from '../controllers/purchaseOrder.controller'

const { connectionMock, queryMock } = vi.hoisted(() => {
  const queryMock = vi.fn()
  const connectionMock = {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
    query: queryMock,
  }
  return { connectionMock, queryMock }
})

vi.mock('../config/database.js', () => ({
  default: {
    getConnection: vi.fn(async () => connectionMock),
    query: vi.fn(),
  },
}))

function makeRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn(() => res as Response)
  ;(res as any).json = vi.fn(() => res as Response)
  ;(res as any).send = vi.fn(() => res as Response)
  return res as Response
}

const MEDICINES = [
  { id: 'med-1', medicine_name: 'Aspirin' },
  { id: 'med-2', medicine_name: 'Paracetamol' },
]

describe('Purchase order creation', () => {
  beforeEach(() => {
    queryMock.mockReset()
    connectionMock.beginTransaction.mockReset()
    connectionMock.commit.mockReset()
    connectionMock.rollback.mockReset()
    connectionMock.release.mockReset()
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, medicine_name FROM medicines_inventory')) {
        return [MEDICINES]
      }
      if (sql.includes('INSERT INTO purchase_orders')) {
        return [{ insertId: 77, affectedRows: 1 }]
      }
      if (sql.includes('INSERT INTO purchase_order_items')) {
        return [{ insertId: 1, affectedRows: 1 }]
      }
      return [{ affectedRows: 1 }]
    })
  })

  it('creates an order with a generated business key and resolved line items', async () => {
    const req = {
      body: {
        supplier_id: 3,
        order_date: '2026-10-20',
        expected_delivery_date: '2026-10-27',
        items: [
          { medicine_id: 'med-1', quantity: 10, unit_price: 2.5 },
          { medicine_id: 'med-2', quantity: 4, unit_price: 5 },
        ],
      },
      user: { id: '2', hospital_id: '1', email: 'admin@smarthealth.com', role: 'admin' },
    } as any as AuthRequest
    const res = makeRes()

    await createPurchaseOrder(req, res)

    expect((res.status as any)).toHaveBeenCalledWith(201)
    const payload = (res.json as any).mock.calls[0][0]
    expect(payload.id).toBe(77)
    expect(payload.order_id).toMatch(/^PO-\d{8}-[0-9A-F]{6}$/)
    expect(payload.total_amount).toBe(45)

    const orderInsert = queryMock.mock.calls.find((c) => String(c[0]).includes('INSERT INTO purchase_orders'))!
    const [sql, params] = orderInsert
    // `id` is BIGINT UNSIGNED AUTO_INCREMENT and must never be written by hand.
    expect(String(sql)).not.toMatch(/INSERT INTO purchase_orders\s*\(\s*id/)
    expect(String(sql)).toContain('order_id')
    expect(String(sql)).toContain('hospital_id')
    expect(String(sql)).toContain('created_by')
    // status is an ENUM with lowercase values only.
    expect(params).toContain('pending')
    expect(params).toContain(1) // hospital_id from the session
    expect(params).toContain(2) // created_by from the session

    const itemInserts = queryMock.mock.calls.filter((c) => String(c[0]).includes('INSERT INTO purchase_order_items'))
    expect(itemInserts).toHaveLength(2)
    const [itemSql, itemParams] = itemInserts[0]
    expect(String(itemSql)).toContain('medicine_name')
    expect(String(itemSql)).toContain('total')
    expect(itemParams).toEqual([77, 'med-1', 'Aspirin', 10, 2.5, 25])
  })

  it('rejects a line item with an unknown medicine', async () => {
    const req = {
      body: {
        supplier_id: 3,
        order_date: '2026-10-20',
        items: [{ medicine_id: 'does-not-exist', quantity: 1, unit_price: 1 }],
      },
      user: { id: '2', hospital_id: '1' },
    } as any as AuthRequest
    const res = makeRes()

    await createPurchaseOrder(req, res)

    expect((res.status as any)).toHaveBeenCalledWith(400)
    expect(connectionMock.rollback).toHaveBeenCalled()
  })

  it('never writes a request body key straight into the purchase order SET clause', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT status FROM purchase_orders')) {
        return [[{ status: 'pending' }]]
      }
      return [{ affectedRows: 1 }]
    })

    const req = {
      params: { id: '77' },
      body: { status: 'ordered', hospital_id: 999, order_id: 'PO-HACKED', created_by: 42 },
      user: { id: '2', hospital_id: '1' },
    } as any as AuthRequest
    const res = makeRes()

    await updatePurchaseOrder(req, res)

    const setStatements = queryMock.mock.calls
      .map((c) => String(c[0]))
      .filter((sql) => sql.includes('UPDATE purchase_orders SET'))
    for (const sql of setStatements) {
      expect(sql).not.toContain('hospital_id')
      expect(sql).not.toContain('order_id')
      expect(sql).not.toContain('created_by')
    }
  })
})
