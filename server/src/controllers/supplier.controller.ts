import type { Response } from 'express';
import type { ResultSetHeader } from 'mysql2';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';

export const getSuppliers = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [suppliers] = await pool.query('SELECT * FROM suppliers');
    res.json(suppliers);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
};

export const getSupplierById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [suppliers] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [id]);
    const supplier = (suppliers as any[])[0];

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json(supplier);
  } catch (error) {
    console.error('Get supplier by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
};

export const createSupplier = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { name, contact_person, email, phone, address } = req.body;
    // `suppliers.id` is a BIGINT AUTO_INCREMENT key, so the id is generated
    // by the database. A uuid was being written into it, which the column
    // rejected, so every supplier create failed.
    const [result] = await pool.query(
      'INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)',
      [name, contact_person ?? null, email ?? null, phone ?? null, address ?? null]
    );
    res.status(201).json({ message: 'Supplier created successfully', id: (result as ResultSetHeader).insertId });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
};

// Only these columns may be changed through the API. Without a whitelist any
// request key became a column, which allowed writes to `id` and `name`.
const ALLOWED_SUPPLIER_UPDATES = new Set([
  'name',
  'contact_person',
  'email',
  'phone',
  'address',
]);

export const updateSupplier = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body ?? {};

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_SUPPLIER_UPDATES.has(key)) continue;
      fields.push(`${key} = ?`);
      values.push(value === '' ? null : value);
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No updatable fields provided' });
      return;
    }

    await pool.query(
      `UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id]
    );
    res.json({ message: 'Supplier updated successfully' });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
};

export const deleteSupplier = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
};