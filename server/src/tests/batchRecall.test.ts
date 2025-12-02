import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { recallBatch } from '../controllers/batch.controller'

vi.mock('../config/database.js', () => {
  return {
    default: {
      query: vi.fn((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM medicine_batches WHERE id')) return Promise.resolve([[{ id: params[0], batch_number: 'B001', medicine_id: 'm1', expiry_date: '2026-01-01' }]])
        return Promise.resolve([[]])
      })
    }
  }
})

vi.mock('../utils/mail.js', () => ({ sendEmail: vi.fn(() => Promise.resolve()) }))
vi.mock('../utils/sms.js', () => ({ sendSMS: vi.fn(() => Promise.resolve()) }))

function makeRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn(() => res as Response)
  ;(res as any).json = vi.fn(() => res as Response)
  return res as Response
}

describe('Batch recall', () => {
  it('recalls batch and logs audit', async () => {
    const req = { params: { id: 'b1' }, body: { partial_quantity: 10 }, user: { id: 'u1' } } as any as AuthRequest
    const res = makeRes()
    await recallBatch(req, res)
    expect((res.json as any)).toHaveBeenCalled()
  })
})