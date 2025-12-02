import type { Response } from 'express';
import { v4 as uuidv4, validate as validateUUID } from 'uuid';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { cacheService, CacheKeys } from '../services/cache.service.js';

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
    // Strict validation for query parameters to prevent type confusion attacks
    const search = req.query.search;
    if (search !== undefined) {
      if (typeof search !== 'string') {
        return res.status(400).json({ error: 'Invalid search parameter: must be a string' });
      }
      if (search.length > 100) {
        return res.status(400).json({ error: 'Invalid search parameter: must be a string with max length 100' });
      }
    }
    const status = req.query.status;
    if (status !== undefined) {
      if (typeof status !== 'string') {
        return res.status(400).json({ error: 'Invalid status parameter: must be a string' });
      }
      if (!['active', 'inactive', 'discharged'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status parameter: must be active, inactive, or discharged' });
      }
    }
    const hospital = req.query.hospital;
    if (hospital !== undefined) {
      if (typeof hospital !== 'string') {
        return res.status(400).json({ error: 'Invalid hospital parameter: must be a string' });
      }
      if (hospital.length > 50) {
        return res.status(400).json({ error: 'Invalid hospital parameter: must be a valid hospital ID' });
      }
    }
    
    let query = 'SELECT * FROM patients WHERE 1=1';
    const params: (string | number)[] = [];

    if (search && search.trim().length > 0) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR patient_id LIKE ?)';
      const searchTerm = `%${search.trim()}%`;
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

    // Validate UUID format
    if (!validateUUID(id)) {
      return res.status(400).json({ error: 'Invalid patient ID format' });
    }

    // Check cache first
    const cacheKey = `patient:${id}`;
    const cachedPatient = await cacheService.get<any>(cacheKey);
    if (cachedPatient) {
      return res.json(cachedPatient);
    }

    // Optimized: Fetch patient data, medical history, and allergies in parallel
    const [patients, history, allergies] = await Promise.all([
      pool.query('SELECT * FROM patients WHERE id = ?', [id]),
      pool.query('SELECT * FROM medical_history WHERE patient_id = ? ORDER BY diagnosis_date DESC', [id]),
      pool.query('SELECT * FROM allergies WHERE patient_id = ? ORDER BY created_at DESC', [id]),
    ]);

    let patient = (patients as any[])[0];

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    patient = decryptPatientData(patient);

    const result = {
      ...patient,
      medicalHistory: history[0] as any[],
      allergies: allergies[0] as any[],
    };

    // Cache the result for 5 minutes
    await cacheService.set(cacheKey, result, 300);

    res.json(result);
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
};

export const createPatient = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { firstName, lastName, phone, email, address, age, gender, hospitalId } = req.body;

    // Comprehensive input validation
    if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0 || firstName.length > 50) {
      return res.status(400).json({ error: 'First name is required and must be a non-empty string (max 50 chars)' });
    }
    if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0 || lastName.length > 50) {
      return res.status(400).json({ error: 'Last name is required and must be a non-empty string (max 50 chars)' });
    }
    if (!phone || typeof phone !== 'string' || !/^\+?[\d\s-()]{10,15}$/.test(phone.trim())) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }
    if (!address || typeof address !== 'string' || address.trim().length === 0 || address.length > 255) {
      return res.status(400).json({ error: 'Address is required and must be a non-empty string (max 255 chars)' });
    }
    if (age !== undefined && (typeof age !== 'number' || age < 0 || age > 150 || !Number.isInteger(age))) {
      return res.status(400).json({ error: 'Age must be a valid integer between 0 and 150' });
    }
    if (!gender || typeof gender !== 'string' || !['male', 'female', 'other'].includes(gender.toLowerCase())) {
      return res.status(400).json({ error: 'Gender is required and must be male, female, or other' });
    }
    if (!hospitalId || typeof hospitalId !== 'string' || hospitalId.length > 50) {
      return res.status(400).json({ error: 'Valid hospital ID is required' });
    }

    const patientId = `P${String(Date.now()).slice(-6)}`;
    const id = uuidv4();

    // Sanitize and encrypt sensitive fields
    const sanitizedFirstName = firstName.trim();
    const sanitizedLastName = lastName.trim();
    const sanitizedPhone = phone.trim();
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedAddress = address.trim();
    const sanitizedGender = gender.toLowerCase();

    // Encrypt sensitive fields
    const encryptedFirstName = encrypt(sanitizedFirstName);
    const encryptedLastName = encrypt(sanitizedLastName);
    const encryptedPhone = encrypt(sanitizedPhone);
    const encryptedEmail = encrypt(sanitizedEmail);
    const encryptedAddress = encrypt(sanitizedAddress);

    await pool.query(
      `INSERT INTO patients (id, patient_id, first_name, last_name, age, gender, phone, email, address, hospital_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, patientId, encryptedFirstName, encryptedLastName, age, sanitizedGender, encryptedPhone, encryptedEmail, encryptedAddress, hospitalId]
    );

    // Invalidate patients list cache
    await cacheService.invalidatePattern(CacheKeys.patients());

    res.status(201).json({ message: 'Patient created successfully', id, patientId });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
};

export const updatePatient = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!validateUUID(id)) {
      return res.status(400).json({ error: 'Invalid patient ID format' });
    }

    const updates = req.body;

    // Define allowed fields for updates (whitelist)
    const allowedFields = [
      'first_name', 'last_name', 'phone', 'email', 'address', 'age', 'gender', 'status', 'hospital_id'
    ];

    const fields: string[] = [];
    const values: any[] = [];

    for (const key in updates) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        if (!allowedFields.includes(key)) {
          return res.status(400).json({ error: `Field '${key}' is not allowed for update` });
        }

        let value = updates[key];
        if (sensitiveFields.includes(key)) {
          value = encrypt(value);
        }
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    values.push(id);

    await pool.query(
      `UPDATE patients SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    // Invalidate patient cache
    await cacheService.del(`patient:${id}`);
    await cacheService.invalidatePattern(CacheKeys.patients());

    res.json({ message: 'Patient updated successfully' });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
};

export const deletePatient = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!validateUUID(id)) {
      return res.status(400).json({ error: 'Invalid patient ID format' });
    }

    await pool.query('DELETE FROM patients WHERE id = ?', [id]);

    // Invalidate patient cache
    await cacheService.del(`patient:${id}`);
    await cacheService.invalidatePattern(CacheKeys.patients());

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
};