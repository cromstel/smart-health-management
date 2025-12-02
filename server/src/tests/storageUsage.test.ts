import { describe, it, expect, vi } from 'vitest'
import { getStorageUsage } from '../controllers/storage.controller.js'

function createMockRes() {
  const res: any = {}
  res.statusCode = 200
  res.status = vi.fn(function (this: any, code: number) { this.statusCode = code; return this })
  res.json = vi.fn((payload: any) => { res.payload = payload; return res })
  res.setHeader = vi.fn()
  return res
}

describe('Storage usage endpoint', () => {
  it('returns usage metrics', async () => {
    const req: any = {}
    const res = createMockRes()
    await getStorageUsage(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload).toBeDefined()
    expect(typeof res.payload.usedBytes).toBe('number')
    expect(res.payload.uploadsDir).toMatch(/uploads/)
  })
})