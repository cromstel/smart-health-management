import { describe, it, expect, vi, beforeEach } from 'vitest'
import { predictPatientLoads } from '../services/patientLoadPrediction.service'

vi.mock('../config/database.js', () => {
  return {
    default: {
      query: vi.fn((sql: string) => {
        if (sql.includes('FROM appointments')) {
          return Promise.resolve([[
            { day: 'Monday', count: 24 },
            { day: 'Tuesday', count: 28 },
            { day: 'Wednesday', count: 30 },
            { day: 'Thursday', count: 26 },
            { day: 'Friday', count: 35 },
            { day: 'Saturday', count: 12 },
            { day: 'Sunday', count: 10 }
          ]])
        }
        return Promise.resolve([[]])
      })
    }
  }
})

describe('predictPatientLoads', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns 7-day predictions with numbers', async () => {
    const result = await predictPatientLoads()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(7)
    for (const r of result) {
      expect(typeof r.day).toBe('string')
      expect(typeof r.predictedLoad).toBe('number')
    }
  })
})
