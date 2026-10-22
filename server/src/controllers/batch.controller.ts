import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { PoolConnection } from 'mysql2/promise';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { sendEmail } from '../utils/mail.js';
import { sendSms } from '../utils/sms.js';

export const getBatches = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    // Optional filter by medicine, so a caller that only needs one medicine's
    // lots does not have to fetch and filter every batch in the system.
    const { medicineId } = req.query;
    const params: unknown[] = [];
    let filter = '';
    if (medicineId) {
      filter = ' WHERE mb.medicine_id = ?';
      params.push(medicineId);
    }

    const [batches] = await pool.query(
      `SELECT mb.*, mi.medicine_name
       FROM medicine_batches mb
       LEFT JOIN medicines_inventory mi ON mb.medicine_id = mi.id${filter}
       ORDER BY mb.created_at DESC`,
      params
    );
    res.json(batches);
  } catch (error) {
    console.error('Get batches error:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
};

export const getBatchById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [batches] = await pool.query('SELECT * FROM medicine_batches WHERE id = ?', [id]);
    const batch = (batches as any[])[0];

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (error) {
    console.error('Get batch by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
};

export const createBatch = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { medicineId, batchNumber, expiryDate, quantity } = req.body;
    const id = uuidv4();

    await pool.query(
      'INSERT INTO medicine_batches (id, medicine_id, batch_number, expiry_date, quantity) VALUES (?, ?, ?, ?, ?)',
      [id, medicineId, batchNumber, expiryDate, quantity]
    );

    res.status(201).json({ message: 'Batch created successfully', id });
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
};

/**
 * The names a client may use for a batch field.
 *
 * The route validates the names the client sends, and the client sends the
 * camel-case spelling. The whitelist held the column names, so the batch
 * number and the expiry date were dropped on every edit -- the client was
 * told the edit had been saved, and the two fields it had changed were not.
 *
 * The values of this map are the columns that may be written. A key that is
 * not in it is not a column of the batch and is ignored.
 */
const BATCH_FIELD_ALIASES: Record<string, string> = {
  batchNumber: 'batch_number',
  batch_number: 'batch_number',
  expiryDate: 'expiry_date',
  expiry_date: 'expiry_date',
  quantity: 'quantity',
  recalled: 'recalled',
};

export const updateBatch = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body ?? {};

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(updates)) {
      const column = BATCH_FIELD_ALIASES[key];
      if (!column) continue;
      fields.push(`${column} = ?`);
      values.push(value);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No updatable fields provided' });
      return;
    }

    await pool.query(`UPDATE medicine_batches SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    res.json({ message: 'Batch updated successfully' });
  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json({ error: 'Failed to update batch' });
  }
};

export const deleteBatch = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM medicine_batches WHERE id = ?', [id]);
    res.json({ message: 'Batch deleted successfully' });
  } catch (error) {
    console.error('Delete batch error:', error);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
};

export const recallBatch = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  let connection: PoolConnection | null = null;
  let settled = false;
  try {
    const { id } = req.params;
    const { partial_quantity } = req.body;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // The batch is read with a lock, so that two recalls of the same batch
    // cannot both read the same quantity and both take the whole of it. The
    // stock and the batch move together, in one transaction: a recall that
    // failed halfway left the batch recalled and the stock still counting the
    // recalled units as on the shelf.
    const [batches] = await connection.query(
      'SELECT * FROM medicine_batches WHERE id = ? FOR UPDATE',
      [id]
    );
    const batch = (batches as any[])[0];

    if (!batch) {
      await connection.rollback();
      settled = true;
      return res.status(404).json({ error: 'Batch not found' });
    }

    // The units on the shelf are counted by the batch, and the recall takes
    // them off it. The stock on hand is checked first, so that a recall
    // larger than the stock is refused with an explanation rather than
    // driving the count below nothing.
    const [stockRows] = await connection.query(
      'SELECT stock_level FROM medicines_inventory WHERE id = ? FOR UPDATE',
      [batch.medicine_id]
    );
    const stockHeld = Number((stockRows as any[])[0]?.stock_level ?? 0);

    const requested = partial_quantity && Number(partial_quantity) > 0
      ? Math.min(Number(partial_quantity), Number(batch.quantity))
      : Number(batch.quantity);
    const recallQuantity = Number(batch.quantity) > 0 ? requested : 0;

    if (recallQuantity > stockHeld) {
      await connection.rollback();
      settled = true;
      return res.status(409).json({
        error: `Only ${stockHeld} unit(s) of this medicine are on hand, so ${recallQuantity} cannot be recalled.`,
      });
    }

    const newQuantity = Number(batch.quantity) - recallQuantity;

    await connection.query(
      'UPDATE medicine_batches SET quantity = ?, recalled = ? WHERE id = ?',
      [newQuantity, newQuantity === 0, id]
    );

    if (recallQuantity > 0) {
      await connection.query(
        'UPDATE medicines_inventory SET stock_level = stock_level - ? WHERE id = ?',
        [recallQuantity, batch.medicine_id]
      );
    }

    await connection.commit();
    settled = true;
    connection.release();
    connection = null;

    if (process.env.ADMIN_EMAIL) {
      try {
        await sendEmail({
          to: process.env.ADMIN_EMAIL,
          subject: `Batch Recall: ${batch.batch_number}`,
          text: `Batch ${batch.batch_number} has been recalled. Quantity recalled: ${recallQuantity}. Remaining: ${newQuantity}.`,
          html: `<p>Batch <strong>${batch.batch_number}</strong> has been recalled.</p><p>Quantity recalled: ${recallQuantity}. Remaining: ${newQuantity}.</p>`,
        });
      } catch (_e) {
        // Email failures are non-blocking
      }
    }

    if (process.env.ADMIN_PHONE) {
      try {
        await sendSms(process.env.ADMIN_PHONE, `Batch ${batch.batch_number} recalled. Qty: ${recallQuantity}`);
      } catch (_e) {
        // SMS failures are non-blocking
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, new_value)
       VALUES (?, 'recall', 'pharmacy', ?, ?)`,
      [req.user?.id || null, id, JSON.stringify({ partial_quantity: recallQuantity, remaining: newQuantity })]
    );

    return res.json({ message: 'Batch recalled successfully', recalledQuantity: recallQuantity, remainingQuantity: newQuantity });
  } catch (error) {
    if (connection && !settled) {
      try {
        await connection.rollback();
      } catch {
        // The transaction is already gone; the failure that brought us here is
        // the one worth reporting.
      }
    }
    console.error('Recall batch error:', error);
    res.status(500).json({ error: 'Failed to recall batch' });
  } finally {
    if (connection) connection.release();
  }
};