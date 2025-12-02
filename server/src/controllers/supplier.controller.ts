import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
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
    const id = uuidv4();
    await pool.query(
      'INSERT INTO suppliers (id, name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, contact_person, email, phone, address]
    );
    res.status(201).json({ message: 'Supplier created successfully', id });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
};

export const updateSupplier = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    await pool.query(
      `UPDATE suppliers SET ${fields} WHERE id = ?`,
      values
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