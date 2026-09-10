import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { sendEmail } from '../utils/mail.js';
import { sendSms } from '../utils/sms.js';

export const getBatches = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [batches] = await pool.query(`
      SELECT mb.*, mi.medicine_name
      FROM medicine_batches mb
      LEFT JOIN medicines_inventory mi ON mb.medicine_id = mi.id
      ORDER BY mb.created_at DESC
    `);
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

export const updateBatch = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    await pool.query(`UPDATE medicine_batches SET ${fields} WHERE id = ?`, values);
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
  try {
    const { id } = req.params;
    const { partial_quantity } = req.body;

    const [batches] = await pool.query('SELECT * FROM medicine_batches WHERE id = ?', [id]);
    const batch = (batches as any[])[0];

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    if (partial_quantity && partial_quantity > 0) {
      const recallQuantity = Math.min(partial_quantity, batch.quantity);
      const newQuantity = batch.quantity - recallQuantity;

      await pool.query('UPDATE medicine_batches SET quantity = ?, recalled = ? WHERE id = ?', [newQuantity, newQuantity === 0, id]);

      if (newQuantity === 0) {
        await pool.query('UPDATE medicines_inventory SET stock_level = stock_level - ? WHERE id = ?', [recallQuantity, batch.medicine_id]);
      }

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
    }

    await pool.query('UPDATE medicine_batches SET recalled = TRUE, quantity = 0 WHERE id = ?', [id]);
    await pool.query('UPDATE medicines_inventory SET stock_level = stock_level - ? WHERE id = ?', [batch.quantity, batch.medicine_id]);

    if (process.env.ADMIN_EMAIL) {
      try {
        await sendEmail({
          to: process.env.ADMIN_EMAIL,
          subject: `Batch Recall: ${batch.batch_number}`,
          text: `Batch ${batch.batch_number} has been fully recalled. Quantity: ${batch.quantity}.`,
          html: `<p>Batch <strong>${batch.batch_number}</strong> has been fully recalled.</p><p>Quantity: ${batch.quantity}.</p>`,
        });
      } catch (_e) {
        // Email failures are non-blocking
      }
    }

    if (process.env.ADMIN_PHONE) {
      try {
        await sendSms(process.env.ADMIN_PHONE, `Batch ${batch.batch_number} fully recalled. Qty: ${batch.quantity}`);
      } catch (_e) {
        // SMS failures are non-blocking
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, new_value)
       VALUES (?, 'recall', 'pharmacy', ?, ?)`,
      [req.user?.id || null, id, JSON.stringify({ partial_quantity: batch.quantity, remaining: 0 })]
    );

    res.json({ message: 'Batch recalled successfully', recalledQuantity: batch.quantity, remainingQuantity: 0 });
  } catch (error) {
    console.error('Recall batch error:', error);
    res.status(500).json({ error: 'Failed to recall batch' });
  }
};