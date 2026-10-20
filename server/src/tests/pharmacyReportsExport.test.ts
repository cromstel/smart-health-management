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

  it('returns a PDF document', async () => {
    const req = { query: { reportType: 'expiry_dates', format: 'pdf' }, headers: {} } as any as AuthRequest
    const res = makeRes()
    await generatePharmacyReport(req, res)
    // The PDF branch is implemented: no error status, the right headers and a
    // real PDF payload are sent back.
    expect((res.status as any)).not.toHaveBeenCalled()
    expect((res.setHeader as any)).toHaveBeenCalledWith('Content-Type', 'application/pdf')
    expect((res.setHeader as any)).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="pharmacy_expiry_dates.pdf"'
    )
    const payload = (res.send as any).mock.calls[0][0]
    expect(Buffer.isBuffer(payload)).toBe(true)
    expect(payload.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
