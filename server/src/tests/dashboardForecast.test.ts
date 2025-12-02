import { describe, it, expect, vi } from 'vitest'
import { getFinancialForecast } from '../controllers/dashboard.controller'

function resMock() {
  const res: any = {}
  res.statusCode = 200
  res.status = vi.fn(function (this: any, code: number) { this.statusCode = code; return this })
  res.json = vi.fn((payload: any) => { res.payload = payload; return res })
  return res
}

vi.mock('../config/database.js', () => {
  return {
    default: {
      query: vi.fn(() => Promise.resolve([[
        { month: '2025-06', revenue: 1000 },
        { month: '2025-07', revenue: 1200 },
        { month: '2025-08', revenue: 1100 },
        { month: '2025-09', revenue: 1150 },
        { month: '2025-10', revenue: 1300 },
        { month: '2025-11', revenue: 1400 }
      ]]))
    }
  }
})

describe('getFinancialForecast', () => {
  it('computes next month forecast from history', async () => {
    const req: any = {}
    const res = resMock()
    await getFinancialForecast(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload?.forecast?.nextMonth).toBeGreaterThan(0)
  })
})
