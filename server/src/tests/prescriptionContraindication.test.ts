import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { createPrescription, updatePrescription } from '../controllers/prescription.controller'

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))

vi.mock('../config/database.js', () => ({
  default: {
    query: (...args: any[]) => queryMock(...args),
  },
}))

function makeRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn(() => res as Response)
  ;(res as any).json = vi.fn(() => res as Response)
  ;(res as any).send = vi.fn(() => res as Response)
  return res as Response
}

const MEDICINE = {
  id: 'med-1',
  medicine_name: 'Aspirin',
  category: 'NSAID',
  expiry_date: null,
}

describe('Prescription contraindication handling', () => {
  beforeEach(() => {
    queryMock.mockReset()
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM medicines_inventory')) return [[MEDICINE]]
      if (sql.includes('FROM contraindications')) {
        return [[{ id: 1, category_a: 'NSAID', category_b: 'Antibiotic', severity: 'moderate' }]]
      }
      if (sql.includes('existing_category')) return [[{ existing_category: 'Antibiotic' }]]
      if (sql.includes('FROM prescriptions WHERE id')) {
        return [[{ patient_id: 1, medicine_id: 'med-1' }]]
      }
      return [{ insertId: 1, affectedRows: 1 }]
    })
  })

  it('creates a prescription and reports a stored "moderate" rule as "medium"', async () => {
    const req = {
      body: {
        patient_id: 1,
        doctor_id: 1,
        medicine_id: 'med-1',
        dose: '10mg',
        frequency: 'daily',
        quantity: 30,
      },
      user: { id: '2' },
    } as any as AuthRequest
    const res = makeRes()

    await createPrescription(req, res)

    expect((res.status as any)).toHaveBeenCalledWith(201)
    const payload = (res.json as any).mock.calls[0][0]
    // The DB stores the severity as 'moderate'; the API reports it as 'medium'.
    expect(payload.warnings.severity).toBe('medium')
    expect(payload.warnings.conflicts).toHaveLength(1)
    expect(payload.warnings.conflicts[0].severity).toBe('medium')
  })

  it('rejects a high severity contraindication', async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM medicines_inventory')) return [[MEDICINE]]
      if (sql.includes('FROM contraindications')) {
        return [[{ id: 1, category_a: 'NSAID', category_b: 'Antibiotic', severity: 'high' }]]
      }
      if (sql.includes('existing_category')) {
        return [[{ existing_category: 'Antibiotic' }]]
      }
      return [{ insertId: 1, affectedRows: 1 }]
    })

    const req = {
      body: {
        patient_id: 1,
        doctor_id: 1,
        medicine_id: 'med-1',
        dose: '10mg',
        frequency: 'daily',
        quantity: 30,
      },
      user: { id: '2' },
    } as any as AuthRequest
    const res = makeRes()

    await createPrescription(req, res)

    expect((res.status as any)).toHaveBeenCalledWith(400)
    const payload = (res.json as any).mock.calls[0][0]
    expect(payload.error).toBe('Contraindicated combination')
  })

  it('accepts a medicine without an expiry date', async () => {
    const req = {
      body: {
        patient_id: 1,
        doctor_id: 1,
        medicine_id: 'med-1',
        dose: '10mg',
        frequency: 'daily',
        quantity: 30,
      },
      user: { id: '2' },
    } as any as AuthRequest
    const res = makeRes()

    await createPrescription(req, res)

    expect((res.status as any)).toHaveBeenCalledWith(201)
  })

  it('never writes an internal marker column on update', async () => {
    const req = {
      params: { id: 'pres-1' },
      body: { dose: '20mg', quantity: 60 },
      user: { id: '2' },
    } as any as AuthRequest
    const res = makeRes()

    await updatePrescription(req, res)

    expect((res.status as any)).not.toHaveBeenCalledWith(400)
    const updateCall = queryMock.mock.calls.find((c) => String(c[0]).includes('UPDATE prescriptions SET'))
    expect(updateCall).toBeDefined()
    expect(String(updateCall![0])).not.toContain('_warnings')
    expect(String(updateCall![0])).toContain('dose = ?')
    expect(String(updateCall![0])).toContain('quantity = ?')
  })
})
