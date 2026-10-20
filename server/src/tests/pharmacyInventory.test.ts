import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { createPharmacyItem, updatePharmacyItem } from '../controllers/pharmacy.controller'
import { checkStockAndCreatePurchaseOrders } from '../services/inventory.service'

const { queryMock, connectionMock } = vi.hoisted(() => {
  const queryMock = vi.fn()
  const connectionMock = {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
    query: vi.fn(),
  }
  return { queryMock, connectionMock }
})

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args: any[]) => queryMock(...args),
    getConnection: vi.fn(async () => connectionMock),
  },
}))

function makeRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn(() => res as Response)
  res.setHeader = vi.fn()
  ;(res as any).json = vi.fn(() => res as Response)
  ;(res as any).send = vi.fn(() => res as Response)
  return res as Response
}

describe('Pharmacy inventory writes', () => {
  beforeEach(() => {
    queryMock.mockReset()
    queryMock.mockResolvedValue([{ insertId: 1, affectedRows: 1 }])
  })

  it('persists category and supplier id on create', async () => {
    const req = {
      body: {
        medicineName: 'Aspirin',
        category: 'NSAID',
        supplier: 'Acme Pharma',
        supplierId: 7,
        stockLevel: 120,
        lowStockThreshold: 20,
        expiryDate: '2030-01-31',
        unitPrice: 4.5,
        storageLocation: 'Shelf A1',
      },
    } as any as AuthRequest
    const res = makeRes()

    await createPharmacyItem(req, res)

    expect((res.status as any)).toHaveBeenCalledWith(201)
    expect(queryMock).toHaveBeenCalledTimes(1)

    const [sql, params] = queryMock.mock.calls[0]
    expect(String(sql)).toContain('category')
    expect(String(sql)).toContain('supplier_id')
    expect(params).toEqual([
      expect.any(String),
      'Aspirin',
      'NSAID',
      'Acme Pharma',
      7,
      120,
      20,
      '2030-01-31',
      4.5,
      'Shelf A1',
    ])
  })

  it('rejects a create without a medicine name', async () => {
    const req = { body: { category: 'NSAID' } } as any as AuthRequest
    const res = makeRes()

    await createPharmacyItem(req, res)

    expect((res.status as any)).toHaveBeenCalledWith(400)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('only writes whitelisted columns on update', async () => {
    const req = {
      params: { id: 'med-1' },
      body: {
        stock_level: 42,
        // Neither of these may reach the SQL: `id` is the primary key and an
        // unknown key would otherwise become a column name.
        id: 'hijacked',
        unknown_column: 'boom',
      },
    } as any as AuthRequest
    const res = makeRes()

    await updatePharmacyItem(req, res)

    expect((res.status as any)).not.toHaveBeenCalledWith(400)
    const [sql, params] = queryMock.mock.calls[0]
    const setClause = String(sql).split('SET')[1].split('WHERE')[0]
    expect(setClause).toContain('stock_level = ?')
    expect(setClause).not.toContain('id = ?')
    expect(setClause).not.toContain('unknown_column')
    expect(params).toEqual([42, 'med-1'])
  })

  it('rejects an update that carries no updatable field', async () => {
    const req = { params: { id: 'med-1' }, body: { id: 'hijacked' } } as any as AuthRequest
    const res = makeRes()

    await updatePharmacyItem(req, res)

    expect((res.status as any)).toHaveBeenCalledWith(400)
    expect(queryMock).not.toHaveBeenCalled()
  })
})

describe('Low stock purchase order job', () => {
  beforeEach(() => {
    queryMock.mockReset()
    connectionMock.query.mockReset()
    connectionMock.commit.mockReset()
    connectionMock.rollback.mockReset()
    connectionMock.release.mockReset()
  })

  it('reads the real inventory columns and writes a pending order', async () => {
    queryMock.mockResolvedValue([
      [
        {
          id: 'med-1',
          medicine_name: 'Aspirin',
          stock_level: 3,
          low_stock_threshold: 10,
          unit_price: '2.50',
          supplier_id: 5,
        },
      ],
    ])
    connectionMock.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO purchase_orders')) return [{ insertId: 31, affectedRows: 1 }]
      return [{ insertId: 1, affectedRows: 1 }]
    })

    await checkStockAndCreatePurchaseOrders()

    const [selectSql] = queryMock.mock.calls[0]
    expect(String(selectSql)).toContain('medicine_name')
    expect(String(selectSql)).toContain('stock_level')
    expect(String(selectSql)).not.toContain('mi.name')
    expect(String(selectSql)).not.toContain('mi.quantity')

    const orderInsert = connectionMock.query.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO purchase_orders')
    )!
    const [orderSql, orderParams] = orderInsert
    // `id` is BIGINT UNSIGNED AUTO_INCREMENT: the generated key is used.
    expect(String(orderSql)).not.toMatch(/INSERT INTO purchase_orders\s*\(\s*id/)
    expect(orderParams).toContain('pending')
    // No tenant context on the cron job: hospital_id is written as NULL and
    // never faked.
    expect(orderParams).toContain(null)
    expect(orderParams[1]).toBeNull()

    const itemInsert = connectionMock.query.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO purchase_order_items')
    )!
    const [itemSql, itemParams] = itemInsert
    expect(String(itemSql)).toContain('medicine_name')
    expect(String(itemSql)).toContain('total')
    // quantity follows the item threshold (10 * 2 - 3 = 17) and the price
    // comes from the inventory row, not a hard coded 10.
    expect(itemParams).toEqual([31, 'med-1', 'Aspirin', 17, 2.5, 42.5])
    expect(connectionMock.commit).toHaveBeenCalled()
  })

  it('skips low stock items without a supplier', async () => {
    queryMock.mockResolvedValue([
      [
        {
          id: 'med-2',
          medicine_name: 'Paracetamol',
          stock_level: 1,
          low_stock_threshold: 5,
          unit_price: '1.00',
          supplier_id: null,
        },
      ],
    ])

    await checkStockAndCreatePurchaseOrders()

    expect(connectionMock.query).not.toHaveBeenCalled()
  })
})
