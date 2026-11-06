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

/**
 * The statuses a client may set on a prescription.
 *
 * `dispensed` is not one of them. That status is what the dispensing record
 * is made of, and the dispensing record is the only path that moves the
 * stock off the shelf. A prescription that could be marked as dispensed
 * without one left the inventory showing the medicine as still on the shelf
 * while the prescription said it had been given out.
 */
const CLIENT_SETTABLE_STATUSES = ['new', 'cancelled'] as const

/**
 * Columns a client may write on `prescriptions`.
 * The request body is never used to build the SET clause directly -- the old
 * code copied every key, including the internal `_warnings` marker, straight
 * into the SQL and every update failed with ER_BAD_FIELD_ERROR.
 */
const PRESCRIPTION_UPDATE_FIELDS = [
  'patient_id',
  'doctor_id',
  'medicine_id',
  'dose',
  'frequency',
  'quantity',
  'status',
  'notes',
] as const

export const listPrescriptions = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { patient_id } = req.query as any
    // The prescriptions are the patients', and the patients belong to
    // hospitals. The list is confined to the caller's own hospital, and it is
    // paged: a table of prescriptions is a table of everybody's medicines.
    let sql = 'SELECT pr.* FROM prescriptions pr JOIN patients p ON p.id = pr.patient_id WHERE 1 = 1'
    const params: any[] = []
    if (!req.tenant?.platformWide) {
      sql += ' AND p.hospital_id = ?'
      params.push(req.tenant?.hospitalId ?? -1)
    }
    if (patient_id) { sql += ' AND pr.patient_id = ?'; params.push(patient_id) }
    const limit = Math.min(Math.max(Number((req.query as any).limit) || 100, 1), 500)
    const offset = Math.max(Number((req.query as any).offset) || 0, 0)
    sql += ' ORDER BY pr.created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)
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
    // A prescription of another hospital is not found for this caller.
    const params: any[] = [id]
    let predicate = ''
    if (!req.tenant?.platformWide) {
      predicate = ' AND p.hospital_id = ?'
      params.push(req.tenant?.hospitalId ?? -1)
    }
    const [rows] = await pool.query(
      `SELECT pr.* FROM prescriptions pr JOIN patients p ON p.id = pr.patient_id WHERE pr.id = ?${predicate}`,
      params
    )
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
    const { patient_id, doctor_id, medicine_id, dose, frequency, quantity, duration_days, notes } = req.body
    const id = uuidv4()

    // Basic safety validations
    const [meds] = await pool.query('SELECT * FROM medicines_inventory WHERE id = ?', [medicine_id])
    const med = (meds as any[])[0]
    if (!med) { res.status(400).json({ error: 'Invalid medicine' }); return }
    // A medicine without an expiry date is not expired. The old check turned a
    // NULL expiry_date into 1970-01-01 and rejected every such medicine.
    if (med.expiry_date) {
      const expiry = new Date(med.expiry_date)
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        res.status(400).json({ error: 'Medicine expired' })
        return
      }
    }

    // Contraindication check against the patient's other active prescriptions.
    // `medicines_inventory.category` is what the rules are keyed on, so it
    // has to be populated for the check to be able to match anything.
    const validation = await validatePrescription({ patient_id, medicine_category: med.category })
    if (validation.severity === 'high') {
      res.status(400).json({ error: 'Contraindicated combination', severity: validation.severity, conflicts: validation.conflicts })
      return
    }

    await pool.query(
      'INSERT INTO prescriptions (id, patient_id, doctor_id, medicine_id, dose, frequency, quantity, duration_days, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patient_id, doctor_id ?? null, medicine_id, dose, frequency, quantity, duration_days ?? null, 'new', notes ?? null]
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
    const body = (req.body ?? {}) as Record<string, any>

    const [existingRows] = await pool.query('SELECT patient_id, medicine_id FROM prescriptions WHERE id = ?', [id])
    const existing = (existingRows as any[])[0]
    if (!existing) { res.status(404).json({ error: 'Prescription not found' }); return }

    const allowedFields = PRESCRIPTION_UPDATE_FIELDS.filter(
      (field) => body[field] !== undefined
    )
    if (allowedFields.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' })
      return
    }

    const updates: Record<string, any> = {}
    for (const field of allowedFields) updates[field] = body[field]
    if (updates.status) {
      const requested = toStatus(updates.status)
      if (!(CLIENT_SETTABLE_STATUSES as readonly string[]).includes(requested)) {
        // The dispensing record is what moves the stock. A prescription
        // cannot be marked as dispensed on its own, or the inventory would
        // say the medicine is still on the shelf while the prescription said
        // it had been given out.
        res.status(400).json({
          error: `Status cannot be set to ${requested}. A prescription is marked as dispensed by the dispensing record.`,
        })
        return
      }
      updates.status = requested
    }

    // Re-run the contraindication check whenever the medicine or the patient
    // changes. The patient and medicine of the stored record are used when
    // the request only patches one of them.
    const patientId = updates.patient_id ?? existing.patient_id
    const medicineId = updates.medicine_id ?? existing.medicine_id
    let warnings: any = undefined

    const [meds] = await pool.query('SELECT category FROM medicines_inventory WHERE id = ?', [medicineId])
    const medCat = (meds as any[])[0]?.category
    if (medCat) {
      const validation = await validatePrescription({ patient_id: patientId, medicine_category: medCat })
      if (validation.severity === 'high') {
        res.status(400).json({ error: 'Contraindicated combination', severity: validation.severity, conflicts: validation.conflicts })
        return
      }
      warnings = validation.severity !== 'none' ? validation : undefined
    }

    const fields = allowedFields.map((field) => `${field} = ?`).join(', ')
    const values = allowedFields.map((field) => updates[field])
    await pool.query(`UPDATE prescriptions SET ${fields} WHERE id = ?`, [...values, id])
    await pool.query('INSERT INTO audit_logs (user_id, action, module, record_id, new_value) VALUES (?, ?, ?, ?, ?)', [req.user?.id, 'update', 'pharmacy', id, JSON.stringify(updates)])
    res.json({ message: 'Prescription updated', warnings })
  } catch (e) {
    console.error('Update prescription error:', e)
    res.status(500).json({ error: 'Failed to update prescription' })
  }
}

/**
 * A refill restarts the course.
 *
 * The refill tracker used to rewrite the prescribed date in the browser's own
 * copy of the prescription list, so the server never learned that the course
 * had been renewed and the tracker kept counting from the original date.
 * The date is reset on the record itself here.
 */
export const refillPrescription = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params

    const [rows] = await pool.query('SELECT id, patient_id, medicine_id, duration_days FROM prescriptions WHERE id = ?', [id])
    const prescription = (rows as any[])[0]
    if (!prescription) { res.status(404).json({ error: 'Prescription not found' }); return }

    // The prescribed date is the course start, so it is moved to today. The
    // quantity is topped back up to the prescribed amount.
    await pool.query(
      'UPDATE prescriptions SET created_at = NOW(), status = ?, quantity = CASE WHEN quantity > 0 THEN quantity ELSE 1 END WHERE id = ?',
      ['new', id]
    )

    await pool.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value) VALUES (?, ?, ?, ?, ?)',
      [req.user?.id, 'refill', 'pharmacy', id, JSON.stringify({ prescriptionId: id })]
    )

    res.json({ message: 'Prescription refilled', id, refilledAt: new Date().toISOString() })
  } catch (e) {
    console.error('Refill prescription error:', e)
    res.status(500).json({ error: 'Failed to refill prescription' })
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
