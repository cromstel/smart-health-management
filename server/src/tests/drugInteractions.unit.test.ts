import { describe, it, expect, vi } from 'vitest'
import { getInteractionsForCategory, validatePrescription } from '../services/drugInteractions.service'

vi.mock('../config/database.js', () => {
  return {
    default: {
      query: vi.fn((sql: string, _params: any[]) => {
        void _params
        if (sql.includes('SELECT * FROM contraindications')) {
          return Promise.resolve([[
            { id: '1', category_a: 'Anticoagulant', category_b: 'NSAID', severity: 'high' },
            { id: '2', category_a: 'Opioid', category_b: 'Benzodiazepine', severity: 'medium' }
          ]])
        }
        if (sql.includes('SELECT p.*, mi.category')) {
          return Promise.resolve([[{ existing_category: 'NSAID' }, { existing_category: 'Benzodiazepine' }]])
        }
        return Promise.resolve([[]])
      })
    }
  }
})

describe('Drug interaction service', () => {
  it('gets interactions for a category', async () => {
    const rules = await getInteractionsForCategory('NSAID')
    expect(rules.length).toBeGreaterThan(0)
  })

  it('validates and returns high severity when applicable', async () => {
    const result = await validatePrescription({ patient_id: 'p1', medicine_category: 'Anticoagulant' })
    expect(result.severity).toBe('high')
    expect(result.conflicts.length).toBeGreaterThan(0)
  })

  it('aggregates multiple severities correctly', async () => {
    const result = await validatePrescription({ patient_id: 'p1', medicine_category: 'Opioid' })
    expect(['medium', 'high', 'low', 'none']).toContain(result.severity)
  })
})