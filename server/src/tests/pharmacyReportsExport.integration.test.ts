import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { generatePharmacyReport } from '../controllers/pharmacy.controller'
vi.mock('../services/reportFormatters/xlsx.js', () => ({ buildXlsx: vi.fn(() => Buffer.from('xlsx')) }))
vi.mock('../services/reportFormatters/pdf.js', () => ({ buildPDF: vi.fn(() => ({ pipe: () => {}, end: () => {} })) }))

vi.mock('../config/database.js', () => ({ default: { query: vi.fn(() => Promise.resolve([[{ medicine_name: 'A', stock_level: 1, unit_price: 2.5 }]])) } }))

function makeRes() {
  const res: Partial<Response> = {}
  const buf: any[] = []
  res.setHeader = vi.fn()
  res.status = vi.fn(() => res as Response)
  ;(res as any).json = vi.fn((b) => { buf.push(b); return res as Response })
  ;(res as any).send = vi.fn((b) => { buf.push(b); return res as Response })
  ;(res as any).end = vi.fn(() => res as Response)
  return res as Response
}

describe('Pharmacy Reports binary formats', () => {
  it('serves XLSX with Accept header', async () => {
    const req = { query: { reportType: 'stock_levels' }, headers: { accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } } as any as AuthRequest
    const res = makeRes()
    await generatePharmacyReport(req, res)
    expect((res.setHeader as any)).toHaveBeenCalledWith('Content-Type', expect.stringContaining('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
    expect((res.send as any)).toHaveBeenCalled()
  })

  it('returns 501 for PDF with Accept header', async () => {
    const req = { query: { reportType: 'low_stock' }, headers: { accept: 'application/pdf' } } as any as AuthRequest
    const res = makeRes()
    await generatePharmacyReport(req, res)
    expect((res.status as any)).toHaveBeenCalledWith(501)
    expect((res.json as any)).toHaveBeenCalledWith({ error: 'PDF reporting is not implemented' })
  })
})