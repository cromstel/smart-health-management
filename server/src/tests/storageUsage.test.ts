import { describe, it, expect, vi } from 'vitest'
import { getStorageUsage } from '../controllers/storage.controller.js'

vi.mock('check-disk-space', () => ({
  default: vi.fn(async () => ({ size: 1024 ** 4, free: 900 ** 4 }))
}))

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