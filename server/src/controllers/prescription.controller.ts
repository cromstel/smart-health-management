import type { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import pool from '../config/database.js'
import type { AuthRequest } from '../middleware/auth.js'
import { validatePrescription } from '../services/drugInteractions.service.js'

const toStatus = (s: string) => {
  const val = String(s || '').toLowerCase()
  if (['new', 'created'].includes(val)) return 'new'
  if (['dispensed', 'fulfilled'].includes(val)) return 'dispensed'
  if (['cancelled', 'canceled'].includes(val)) return 'cancelled'
  return 'new'
}

export const listPrescriptions = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { patient_id } = req.query as any
    let sql = 'SELECT * FROM prescriptions'
    const params: any[] = []
    if (patient_id) { sql += ' WHERE patient_id = ?'; params.push(patient_id) }
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (e) {
    console.error('List prescriptions error:', e)
    res.status(500).json({ error: 'Failed to list prescriptions' })
  }
}

export const getPrescription = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params
    const [rows] = await pool.query('SELECT * FROM prescriptions WHERE id = ?', [id])
    const p = (rows as any[])[0]
    if (!p) { res.status(404).json({ error: 'Prescription not found' }); return }
    res.json(p)
  } catch (e) {
    console.error('Get prescription error:', e)
    res.status(500).json({ error: 'Failed to get prescription' })
  }
}

export const createPrescription = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { patient_id, doctor_id, medicine_id, dose, frequency, quantity, notes } = req.body
    const id = uuidv4()

    // Basic safety validations
    const [meds] = await pool.query('SELECT * FROM medicines_inventory WHERE id = ?', [medicine_id])
    const med = (meds as any[])[0]
    if (!med) { res.status(400).json({ error: 'Invalid medicine' }); return }
    if (new Date(med.expiry_date) < new Date()) { res.status(400).json({ error: 'Medicine expired' }); return }

    const validation = await validatePrescription({ patient_id, medicine_category: med.category })
    if (validation.severity === 'high') {
      res.status(400).json({ error: 'Contraindicated combination', severity: validation.severity, conflicts: validation.conflicts })
      return
    }

    await pool.query(
      'INSERT INTO prescriptions (id, patient_id, doctor_id, medicine_id, dose, frequency, quantity, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patient_id, doctor_id, medicine_id, dose, frequency, quantity, 'new', notes]
    )

    await pool.query('INSERT INTO audit_logs (user_id, action, module, record_id, new_value) VALUES (?, ?, ?, ?, ?)', [req.user?.id, 'create', 'pharmacy', id, JSON.stringify({ patient_id, medicine_id })])
    const response: any = { id }
    if (validation.severity === 'medium' || validation.severity === 'low') {
      response.warnings = { severity: validation.severity, conflicts: validation.conflicts }
    }
    res.status(201).json(response)
  } catch (e) {
    console.error('Create prescription error:', e)
    res.status(500).json({ error: 'Failed to create prescription' })
  }
}

export const updatePrescription = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params
    const updates = req.body
    if (updates.status) updates.status = toStatus(updates.status)
    if (updates.medicine_id || updates.patient_id) {
      const [meds] = await pool.query('SELECT category FROM medicines_inventory WHERE id = ?', [updates.medicine_id])
      const medCat = (meds as any[])[0]?.category
      if (medCat) {
        const validation = await validatePrescription({ patient_id: updates.patient_id, medicine_category: medCat })
        if (validation.severity === 'high') {
          res.status(400).json({ error: 'Contraindicated combination', severity: validation.severity, conflicts: validation.conflicts })
          return
        }
        updates._warnings = validation.severity !== 'none' ? validation : undefined
      }
    }
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = [...Object.values(updates), id]
    await pool.query(`UPDATE prescriptions SET ${fields} WHERE id = ?`, values)
    await pool.query('INSERT INTO audit_logs (user_id, action, module, record_id, new_value) VALUES (?, ?, ?, ?, ?)', [req.user?.id, 'update', 'pharmacy', id, JSON.stringify(updates)])
    res.json({ message: 'Prescription updated', warnings: updates._warnings })
  } catch (e) {
    console.error('Update prescription error:', e)
    res.status(500).json({ error: 'Failed to update prescription' })
  }
}

export const deletePrescription = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM prescriptions WHERE id = ?', [id])
    await pool.query('INSERT INTO audit_logs (user_id, action, module, record_id) VALUES (?, ?, ?, ?)', [req.user?.id, 'delete', 'pharmacy', id])
    res.json({ message: 'Prescription deleted' })
  } catch (e) {
    console.error('Delete prescription error:', e)
    res.status(500).json({ error: 'Failed to delete prescription' })
  }
}