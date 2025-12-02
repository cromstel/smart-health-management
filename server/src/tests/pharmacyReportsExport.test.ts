import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { generatePharmacyReport } from '../controllers/pharmacy.controller'

vi.mock('../config/database.js', () => {
  return { default: { query: vi.fn(() => Promise.resolve([[{ medicine_name: 'A', stock_level: 1 }]])) } }
})

function makeRes() {
  const chunks: any[] = []
  const res: Partial<Response> = {}
  res.setHeader = vi.fn()
  res.status = vi.fn(() => res as Response)
  ;(res as any).json = vi.fn((b) => { chunks.push(b); return res as Response })
  ;(res as any).send = vi.fn((b) => { chunks.push(b); return res as Response })
  return res as Response
}

describe('Pharmacy report exports', () => {
  it('returns CSV', async () => {
    const req = { query: { reportType: 'stock_levels', format: 'csv' }, headers: {} } as any as AuthRequest
    const res = makeRes()
    await generatePharmacyReport(req, res)
    expect((res.send as any)).toHaveBeenCalled()
  })

  it('returns XLSX (CSV payload)', async () => {
    const req = { query: { reportType: 'low_stock', format: 'xlsx' }, headers: {} } as any as AuthRequest
    const res = makeRes()
    await generatePharmacyReport(req, res)
    expect((res.send as any)).toHaveBeenCalled()
  })

  it('returns 501 for PDF', async () => {
    const req = { query: { reportType: 'expiry_dates', format: 'pdf' }, headers: {} } as any as AuthRequest
    const res = makeRes()
    await generatePharmacyReport(req, res)
    expect((res.status as any)).toHaveBeenCalledWith(501)
    expect((res.json as any)).toHaveBeenCalledWith({ error: 'PDF reporting is not implemented' })
  })
})