import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';

export const getHospitals = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [hospitals] = await pool.query('SELECT * FROM hospitals');
    res.json(hospitals);
  } catch (error) {
    console.error('Get hospitals error:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
};

export const getHospitalById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [hospitals] = await pool.query('SELECT * FROM hospitals WHERE id = ?', [id]);
    const hospital = (hospitals as any[])[0];

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    res.json(hospital);
  } catch (error) {
    console.error('Get hospital by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch hospital' });
  }
};

export const createHospital = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { name, address, city, state, zipCode, phone, email } = req.body;
    const id = uuidv4();
    await pool.query(
      `INSERT INTO hospitals (id, name, address, city, state, zip_code, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, address, city, state, zipCode, phone, email]
    );
    res.status(201).json({ message: 'Hospital created successfully', id });
  } catch (error) {
    console.error('Create hospital error:', error);
    res.status(500).json({ error: 'Failed to create hospital' });
  }
};

export const updateHospital = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    await pool.query(
      `UPDATE hospitals SET ${fields} WHERE id = ?`,
      values
    );
    res.json({ message: 'Hospital updated successfully' });
  } catch (error) {
    console.error('Update hospital error:', error);
    res.status(500).json({ error: 'Failed to update hospital' });
  }
};

export const deleteHospital = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM hospitals WHERE id = ?', [id]);
    res.json({ message: 'Hospital deleted successfully' });
  } catch (error) {
    console.error('Delete hospital error:', error);
    res.status(500).json({ error: 'Failed to delete hospital' });
  }
};