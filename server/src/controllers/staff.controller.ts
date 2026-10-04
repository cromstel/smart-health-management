import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const sensitiveFields = ['first_name', 'last_name', 'email', 'phone'];

const decryptStaffData = (staffMember: Record<string, any>) => {
  const decryptedStaff = { ...staffMember };
  for (const field of sensitiveFields) {
    if (decryptedStaff[field]) {
      decryptedStaff[field] = decrypt(decryptedStaff[field]);
    }
  }
  return decryptedStaff;
};

export const getStaff = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { role, hospitalId } = req.query;
    // No join to roles: the staff table stores the role name directly in its
    // `role` column (see schema.sql) and has no role_id. Joining on
    // s.role_id = r.id threw ER_BAD_FIELD_ERROR, so every read of /api/staff
    // answered 500. s.* already carries the role, aliased below for the
    // client-facing field name.
    let query = `
      SELECT s.*, s.role as role_name, h.name as hospital_name
      FROM staff s
      LEFT JOIN hospitals h ON s.hospital_id = h.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (role) {
      query += ' AND s.role = ?';
      params.push(role);
    }

    if (hospitalId) {
      query += ' AND s.hospital_id = ?';
      params.push(hospitalId);
    }

    const [staff] = await pool.query(query, params);
    const decryptedStaff = (staff as any[]).map(decryptStaffData);
    res.json(decryptedStaff);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

export const getStaffById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [staff] = await pool.query(
      `SELECT s.*, s.role as role_name, h.name as hospital_name
       FROM staff s
       LEFT JOIN hospitals h ON s.hospital_id = h.id
       WHERE s.id = ?`,
      [id]
    );
    let staffMember = (staff as any[])[0];

    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    staffMember = decryptStaffData(staffMember);
    res.json(staffMember);
  } catch (error) {
    console.error('Get staff by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
};

export const createStaff = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    let { firstName, lastName, email, phone } = req.body;
    const { roleId, hospitalId, departmentId, status } = req.body;
    const id = uuidv4();

    // Encrypt sensitive fields
    firstName = encrypt(firstName) || firstName;
    lastName = encrypt(lastName) || lastName;
    email = encrypt(email) || email;
    phone = encrypt(phone) || phone;

    // staff.role holds the role name (a string), not a foreign key. Writing
    // role_id here would have thrown ER_BAD_FIELD_ERROR on staff creation.
    await pool.query(
      `INSERT INTO staff (id, first_name, last_name, email, phone, role, hospital_id, department_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, firstName, lastName, email, phone, roleId ?? req.body.role ?? null, hospitalId, departmentId, status]
    );
    res.status(201).json({ message: 'Staff created successfully', id });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Failed to create staff' });
  }
};

export const updateStaff = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields: string[] = [];
    const values: any[] = [];

    for (const key in updates) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        let value = updates[key];
        if (sensitiveFields.includes(key)) {
          value = encrypt(value) || value;
        }
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    values.push(id);

    await pool.query(
      `UPDATE staff SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    res.json({ message: 'Staff updated successfully' });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Failed to update staff' });
  }
};

export const deleteStaff = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM staff WHERE id = ?', [id]);
    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Failed to delete staff' });
  }
};