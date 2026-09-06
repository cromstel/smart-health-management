import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const sensitiveFields = ['first_name', 'last_name', 'phone', 'email', 'address'];

const decryptPatientData = (patient: Record<string, any>) => {
  const decryptedPatient = { ...patient };
  for (const field of sensitiveFields) {
    if (decryptedPatient[field]) {
      decryptedPatient[field] = decrypt(decryptedPatient[field]);
    }
  }
  return decryptedPatient;
};

export const getAllPatients = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { search, status, hospital } = req.query;
    
    let query = 'SELECT * FROM patients WHERE 1=1';
    const params: any[] = [];

    if (search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR patient_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (hospital) {
      query += ' AND hospital_id = ?';
      params.push(hospital);
    }

    query += ' ORDER BY created_at DESC';

    const [patients] = await pool.query(query, params);
    const decryptedPatients = (patients as any[]).map(decryptPatientData);
    res.json(decryptedPatients);
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
};

export const getPatientById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const [patients] = await pool.query(
      'SELECT * FROM patients WHERE id = ?',
      [id]
    );

    let patient = (patients as any[])[0];

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    patient = decryptPatientData(patient);

    // Get medical history
    const [history] = await pool.query(
      'SELECT * FROM medical_history WHERE patient_id = ?',
      [id]
    );

    // Get allergies
    const [allergies] = await pool.query(
      'SELECT * FROM allergies WHERE patient_id = ?',
      [id]
    );

    res.json({
      ...patient,
      medicalHistory: history,
      allergies
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
};

export const createPatient = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    let { firstName, lastName, phone, email, address } = req.body;
    const { age, gender, hospitalId } = req.body;

    const patientId = `P${String(Date.now()).slice(-6)}`;
    const id = uuidv4();

    // Encrypt sensitive fields
    firstName = encrypt(firstName) || firstName;
    lastName = encrypt(lastName) || lastName;
    phone = encrypt(phone) || phone;
    email = encrypt(email) || email;
    address = encrypt(address) || address;

    await pool.query(
      `INSERT INTO patients (id, patient_id, first_name, last_name, age, gender, phone, email, address, hospital_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, patientId, firstName, lastName, age, gender, phone, email, address, hospitalId]
    );

    res.status(201).json({ message: 'Patient created successfully', id, patientId });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
};

export const updatePatient = async (req: AuthRequest, res: Response): Promise<Response | void> => {
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
      `UPDATE patients SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: 'Patient updated successfully' });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
};

export const deletePatient = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM patients WHERE id = ?', [id]);

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
};