import type { Response } from 'express'
import pool from '../config/database.js'
import type { AuthRequest } from '../middleware/auth.js'
import { v4 as uuidv4 } from 'uuid'
import { sendEmail } from '../utils/mail.js'
import { sendSms } from '../utils/sms.js'

export const getBatches = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { medicineId } = req.query as any
    let sql = 'SELECT * FROM medicine_batches'
    const params: any[] = []
    if (medicineId) {
      sql += ' WHERE medicine_id = ?'
      params.push(medicineId)
    }
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (_e) {
    console.error('Get batches error:', _e)
    res.status(500).json({ error: 'Failed to fetch batches' })
  }
}

export const createBatch = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { medicine_id, batch_number, expiry_date, quantity } = req.body
    const id = uuidv4()
    await pool.query(
      'INSERT INTO medicine_batches (id, medicine_id, batch_number, expiry_date, quantity, recalled) VALUES (?, ?, ?, ?, ?, ?)',
      [id, medicine_id, batch_number, expiry_date, quantity, false]
    )
    res.status(201).json({ id })
  } catch (_e) {
    console.error('Create batch error:', _e)
    res.status(500).json({ error: 'Failed to create batch' })
  }
}

export const updateBatch = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params
    const updates = req.body
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = [...Object.values(updates), id]
    await pool.query(`UPDATE medicine_batches SET ${fields} WHERE id = ?`, values)
    res.json({ message: 'Batch updated' })
  } catch (_e) {
    console.error('Update batch error:', _e)
    res.status(500).json({ error: 'Failed to update batch' })
  }
}

export const recallBatch = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params
    const { partial_quantity } = req.body
    const [rows] = await pool.query('SELECT * FROM medicine_batches WHERE id = ?', [id])
    const batch = (rows as any[])[0]
    if (!batch) {
      res.status(404).json({ error: 'Batch not found' })
      return
    }
    await pool.query('UPDATE medicine_batches SET recalled = 1 WHERE id = ?', [id])

    // Notification targets: use env or fallback
    const toEmail = process.env.ADMIN_EMAIL
    const toPhone = process.env.ADMIN_PHONE
    const subject = `Batch Recall: ${batch.batch_number}`
    const body = `Batch ${batch.batch_number} for medicine ${batch.medicine_id} recalled.${partial_quantity ? ` Partial quantity: ${partial_quantity}.` : ''}`
    try { if (toEmail) await sendEmail({ to: toEmail, subject, text: body, html: `<p>${body}</p>` }) } catch (_e) { /* Ignore email sending errors */ }
    try { if (toPhone) await sendSms(toPhone, body) } catch (_e) { /* Ignore SMS sending errors */ }

    // Audit log
    const userId = req.user?.id
    await pool.query('INSERT INTO audit_logs (user_id, action, module, record_id, new_value) VALUES (?, ?, ?, ?, ?)', [userId, 'recall', 'pharmacy', id, JSON.stringify({ partial_quantity })])

    res.json({ message: 'Batch recalled' })
  } catch (_e) {
    console.error('Recall batch error:', _e)
    res.status(500).json({ error: 'Failed to recall batch' })
  }
}

export const expiredBatches = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [rows] = await pool.query('SELECT * FROM medicine_batches WHERE expiry_date < CURDATE() AND recalled = 0')
    res.json(rows)
  } catch (e) {
    console.error('Expired batches error:', e)
    res.status(500).json({ error: 'Failed to fetch expired batches' })
  }
}