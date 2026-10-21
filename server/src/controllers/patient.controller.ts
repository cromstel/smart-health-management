import type { Response } from 'express';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { belongsToTenant } from '../middleware/tenant.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const sensitiveFields = ['first_name', 'last_name', 'phone', 'email', 'address'];

/** Raised for input the caller can correct; answered with 400, not 500. */
class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

/**
 * Columns a client may change through PUT /api/patients/:id.
 *
 * The update used to build its SET clause from every key of the request body.
 * That made mass assignment trivial -- a caller could rewrite `id`,
 * `patient_id` or any other column of the table, and the shape of the
 * generated SQL was driven by untrusted input. The identity columns
 * (`id`, `patient_id`) are deliberately absent from this list.
 */
const ALLOWED_UPDATE_FIELDS = [
  'first_name',
  'last_name',
  'age',
  'gender',
  'phone',
  'email',
  'address',
  'hospital_id',
  'last_visit',
  'status',
];

/**
 * The web client posts snake_case for patients, other clients post
 * camelCase. Both spellings are accepted; anything that is not a known
 * column is ignored.
 */
const FIELD_ALIASES: Record<string, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  hospitalId: 'hospital_id',
  lastVisit: 'last_visit',
};

const GENDERS = ['male', 'female', 'other'];
const PATIENT_STATUSES = ['active', 'inactive'];

/**
 * Column widths the stored value has to fit into. The values are stored hex
 * encoded, so the ciphertext is twice the byte length of the plaintext plus
 * one cipher block.
 */
const COLUMN_WIDTHS: Record<string, number> = {
  first_name: 100,
  last_name: 100,
  email: 255,
  phone: 255,
  address: 65535,
};

/**
 * Every sensitive field is encrypted at rest.
 *
 * `phone` used to be listed here because the column was VARCHAR(20), which
 * could not hold the hex encoded ciphertext. The column has been widened to
 * VARCHAR(255), so the phone number is encrypted like the other fields
 * instead of being stored in the clear.
 */
const PLAINTEXT_COLUMNS: string[] = [];

/**
 * Encrypts a value for storage.
 *
 * A sensitive value is never silently downgraded to plaintext: when the
 * ciphertext does not fit its column the caller gets a clear error instead of
 * a database error.
 */
const encryptForStorage = (value: string, column: string): string => {
  if (PLAINTEXT_COLUMNS.includes(column)) return value;
  const encrypted = encrypt(value);
  if (!encrypted) return value;
  const width = COLUMN_WIDTHS[column];
  if (width !== undefined && encrypted.length > width) {
    throw new InvalidInputError(`${column.replace('_', ' ')} is too long to store securely`);
  }
  return encrypted;
};

/**
 * Decrypts a stored value. A value that was not written as ciphertext (the
 * seeded rows hold plaintext) cannot be decrypted, so it is kept as it is
 * instead of being dropped.
 *
 * The ciphertext is hex encoded AES-256-CBC, so it is at least 32 characters
 * long (one 16 byte block) and has an even length. Checking that first keeps
 * plaintext rows from producing a decryption error for every single read.
 */
const decryptField = (value: string): string => {
  if (!/^[0-9a-f]+$/i.test(value) || value.length < 32 || value.length % 2 !== 0) return value;
  const decrypted = decrypt(value);
  return decrypted ?? value;
};

/** Unambiguous alphabet for generated public identifiers (no I, O, 0 or 1). */
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const randomToken = (length: number): string => {
  let token = '';
  for (let i = 0; i < length; i += 1) {
    token += ID_ALPHABET.charAt(Math.floor(Math.random() * ID_ALPHABET.length));
  }
  return token;
};

const isDuplicateEntry = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'ER_DUP_ENTRY';

/**
 * Reads a field from the request body, accepting either the canonical column
 * name or one of its documented aliases. `undefined` means "not supplied",
 * which is different from an explicit `null`.
 */
const readField = (body: Record<string, unknown>, column: string): unknown => {
  if (Object.prototype.hasOwnProperty.call(body, column)) {
    return body[column];
  }
  for (const [alias, target] of Object.entries(FIELD_ALIASES)) {
    if (target === column && Object.prototype.hasOwnProperty.call(body, alias)) {
      return body[alias];
    }
  }
  return undefined;
};

const hospitalExists = async (hospitalId: number): Promise<boolean> => {
  const [rows] = await pool.query('SELECT 1 FROM hospitals WHERE id = ? LIMIT 1', [hospitalId]);
  return (rows as any[]).length > 0;
};

/**
 * The hospital's numeric key, from either the key or the public code.
 *
 * The records are keyed by the hospital's number, but the people and the
 * clients use the hospital's public code — the one it is addressed by. Both
 * are accepted, and both name the same hospital.
 */
const resolveHospitalKey = async (value: unknown): Promise<number | null> => {
  const asString = String(value ?? '').trim();
  if (asString === '') return null;

  const asNumber = Number(asString);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    return (await hospitalExists(asNumber)) ? asNumber : null;
  }

  const [rows] = await pool.query(
    'SELECT id FROM hospitals WHERE hospital_id = ? LIMIT 1',
    [asString]
  );
  const id = (rows as any[])[0]?.id;
  return id === undefined || id === null ? null : Number(id);
};

/** Path parameters are strings; only a positive integer can address a row. */
const parseId = (value: unknown): number | null => {
  const asString = String(value ?? '');
  if (!/^\d+$/.test(asString)) return null;
  const parsed = Number(asString);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

interface PatientPayload {
  firstName: string;
  lastName: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  hospitalId: number | null;
}

/**
 * Validates the client supplied patient data and returns the values to
 * store. Sensitive fields are encrypted here, so no caller can accidentally
 * write plaintext PHI.
 */
const buildPatientPayload = async (body: Record<string, unknown>): Promise<PatientPayload> => {
  const firstName = readField(body, 'first_name');
  const lastName = readField(body, 'last_name');

  if (typeof firstName !== 'string' || firstName.trim() === '') {
    throw new InvalidInputError('First name is required');
  }
  if (typeof lastName !== 'string' || lastName.trim() === '') {
    throw new InvalidInputError('Last name is required');
  }
  if (firstName.trim().length > 100 || lastName.trim().length > 100) {
    throw new InvalidInputError('Name is too long');
  }

  const ageValue = readField(body, 'age');
  let age: number | null = null;
  if (ageValue !== undefined && ageValue !== null && ageValue !== '') {
    const parsed = Number(ageValue);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 150) {
      throw new InvalidInputError('Age must be a whole number between 0 and 150');
    }
    age = parsed;
  }

  const genderValue = readField(body, 'gender');
  let gender: string | null = null;
  if (genderValue !== undefined && genderValue !== null && genderValue !== '') {
    const normalized = String(genderValue).trim().toLowerCase();
    if (!GENDERS.includes(normalized)) {
      throw new InvalidInputError(`Gender must be one of: ${GENDERS.join(', ')}`);
    }
    gender = normalized;
  }

  const phoneValue = readField(body, 'phone');
  let phone: string | null = null;
  if (phoneValue !== undefined && phoneValue !== null && phoneValue !== '') {
    phone = String(phoneValue);
    if (phone.length > 20) throw new InvalidInputError('Phone number is too long');
  }

  const emailValue = readField(body, 'email');
  let email: string | null = null;
  if (emailValue !== undefined && emailValue !== null && emailValue !== '') {
    email = String(emailValue);
    if (email.length > 255) throw new InvalidInputError('Email is too long');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new InvalidInputError('Valid email is required');
    }
  }

  const addressValue = readField(body, 'address');
  let address: string | null = null;
  if (addressValue !== undefined && addressValue !== null && addressValue !== '') {
    address = String(addressValue);
  }

  const hospitalValue = readField(body, 'hospital_id');
  let hospitalId: number | null = null;
  if (hospitalValue !== undefined && hospitalValue !== null && hospitalValue !== '') {
    hospitalId = await resolveHospitalKey(hospitalValue);
    if (hospitalId === null) {
      throw new InvalidInputError('Hospital not found');
    }
  }

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    age,
    gender,
    phone,
    email,
    address,
    hospitalId,
  };
};

/**
 * Builds the SET clause of an update from a whitelist of columns.
 * Returns an empty object when the request carries no updatable field.
 */
const buildPatientUpdates = async (
  body: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const updates: Record<string, unknown> = {};

  for (const column of ALLOWED_UPDATE_FIELDS) {
    const value = readField(body, column);
    if (value === undefined) continue; // not supplied by the caller

    switch (column) {
      case 'first_name':
      case 'last_name': {
        const text = String(value ?? '').trim();
        if (text === '') throw new InvalidInputError(`${column.replace('_', ' ')} cannot be empty`);
        if (text.length > 100) throw new InvalidInputError(`${column.replace('_', ' ')} is too long`);
        updates[column] = encryptForStorage(text, column);
        break;
      }
      case 'age': {
        if (value === null || value === '') {
          updates[column] = null;
          break;
        }
        const age = Number(value);
        if (!Number.isInteger(age) || age < 0 || age > 150) {
          throw new InvalidInputError('Age must be a whole number between 0 and 150');
        }
        updates[column] = age;
        break;
      }
      case 'gender': {
        if (value === null || value === '') {
          updates[column] = null;
          break;
        }
        const gender = String(value).trim().toLowerCase();
        if (!GENDERS.includes(gender)) {
          throw new InvalidInputError(`Gender must be one of: ${GENDERS.join(', ')}`);
        }
        updates[column] = gender;
        break;
      }
      case 'status': {
        if (value === null || value === '') {
          updates[column] = null;
          break;
        }
        const status = String(value).trim().toLowerCase();
        if (!PATIENT_STATUSES.includes(status)) {
          throw new InvalidInputError(`Status must be one of: ${PATIENT_STATUSES.join(', ')}`);
        }
        updates[column] = status;
        break;
      }
      case 'hospital_id': {
        if (value === null || value === '') {
          updates[column] = null;
          break;
        }
        const hospitalId = Number(value);
        if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
          throw new InvalidInputError('Invalid hospital id');
        }
        if (!(await hospitalExists(hospitalId))) {
          throw new InvalidInputError('Hospital not found');
        }
        updates[column] = hospitalId;
        break;
      }
      case 'last_visit': {
        if (value === null || value === '') {
          updates[column] = null;
          break;
        }
        const date = String(value).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new InvalidInputError('Last visit must be a date in YYYY-MM-DD format');
        }
        updates[column] = date;
        break;
      }
      case 'phone': {
        if (value === null || value === '') {
          updates[column] = null;
          break;
        }
        const phone = String(value);
        if (phone.length > 20) throw new InvalidInputError('Phone number is too long');
        updates[column] = encryptForStorage(phone, 'phone');
        break;
      }
      case 'email': {
        if (value === null || value === '') {
          updates[column] = null;
          break;
        }
        const email = String(value);
        if (email.length > 255) throw new InvalidInputError('Email is too long');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new InvalidInputError('Valid email is required');
        }
        updates[column] = encryptForStorage(email, 'email');
        break;
      }
      case 'address': {
        if (value === null || value === '') {
          updates[column] = null;
          break;
        }
        const address = String(value);
        updates[column] = encryptForStorage(address, 'address');
        break;
      }
      default:
        break;
    }
  }

  return updates;
};

const decryptPatientData = (patient: Record<string, any>) => {
  const decryptedPatient = { ...patient };
  for (const field of sensitiveFields) {
    if (decryptedPatient[field]) {
      decryptedPatient[field] = decryptField(decryptedPatient[field]);
    }
  }
  return decryptedPatient;
};

export const getAllPatients = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { search, status, hospital } = req.query;
    const scope = req.tenant;

    let query = 'SELECT * FROM patients WHERE 1=1';
    const params: any[] = [];

    // The list is confined to the caller's hospital. The `hospital` filter is
    // a request for a particular hospital inside that scope, not a way to
    // choose one: a request for a hospital that is not the caller's is
    // refused by the permission check before the query is built, and the
    // query is narrowed to the caller's own hospital either way.
    if (!scope?.platformWide) {
      query += ' AND hospital_id = ?';
      params.push(scope?.hospitalId ?? -1);
    }

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
      // The filter names a hospital by its public code or by its key. It is
      // resolved to the key, because the column holds the key: a code that
      // was compared with it as a string would match nothing at all.
      const requested = await resolveHospitalKey(hospital);
      if (requested === null) {
        return res.status(404).json({ error: 'Hospital not found' });
      }
      query += ' AND hospital_id = ?';
      params.push(requested);
    }

    // The list is paged. A table of patients is a table of everybody, and
    // answering with the whole of it in one response is how a single request
    // becomes a copy of the installation's records.
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    query += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

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
    const patientId = parseId(id);

    if (patientId === null) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const [patients] = await pool.query(
      'SELECT * FROM patients WHERE id = ?',
      [patientId]
    );

    let patient = (patients as any[])[0];

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // A record that belongs to another hospital is absent for this caller,
    // not forbidden: the answer should not tell a caller that a record
    // exists somewhere it may not look.
    if (!belongsToTenant(req.tenant, patient.hospital_id)) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    patient = decryptPatientData(patient);

    // Get medical history
    const [history] = await pool.query(
      'SELECT * FROM medical_history WHERE patient_id = ?',
      [patientId]
    );

    // Get allergies
    const [allergies] = await pool.query(
      'SELECT * FROM allergies WHERE patient_id = ?',
      [patientId]
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
    const body = (req.body ?? {}) as Record<string, unknown>;
    const payload = await buildPatientPayload(body);

    // A record is created in the caller's own hospital. The hospital in the
    // request is not a choice of where the record belongs: a caller who may
    // see one hospital's records may not write into another's, and the only
    // caller for whom the hospital in the request is honoured is the one
    // whose role is platform-wide.
    const scope = req.tenant;
    if (!scope?.platformWide) {
      payload.hospitalId = scope?.hospitalId ?? null;
    }

    // patients.id is a BIGINT UNSIGNED AUTO_INCREMENT column: a uuid cannot be
    // written to it. The public identifier lives in patients.patient_id, and
    // the generated primary key is taken from the insert result.
    const insertSql = `INSERT INTO patients
        (patient_id, first_name, last_name, age, gender, phone, email, address, hospital_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const patientId = `PAT-${randomToken(6)}`;
      try {
        const [result] = await pool.query(insertSql, [
          patientId,
          encryptForStorage(payload.firstName, 'first_name'),
          encryptForStorage(payload.lastName, 'last_name'),
          payload.age,
          payload.gender,
          payload.phone ? encryptForStorage(payload.phone, 'phone') : null,
          payload.email ? encryptForStorage(payload.email, 'email') : null,
          payload.address ? encryptForStorage(payload.address, 'address') : null,
          payload.hospitalId
        ]);

        res.status(201).json({
          message: 'Patient created successfully',
          id: (result as any).insertId,
          patientId
        });
        return;
      } catch (error) {
        // patient_id is UNIQUE. A collision is unlikely but not impossible, so
        // retry with a fresh identifier instead of failing the request.
        if (isDuplicateEntry(error) && attempt < 4) continue;
        throw error;
      }
    }

    throw new Error('Unable to allocate a unique patient identifier');
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
};

export const updatePatient = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const patientId = parseId(id);

    if (patientId === null) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates = await buildPatientUpdates(body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    // The record is updated where it is AND where the caller's hospital
    // allows. A record that belongs to another hospital is simply not
    // updated, and the answer is the same as for a record that does not
    // exist.
    const scope = req.tenant;
    const params: any[] = [...values, patientId];
    let predicate = '';
    if (!scope?.platformWide) {
      predicate = ' AND hospital_id = ?';
      params.push(scope?.hospitalId ?? -1);
    }

    const [result] = await pool.query(
      `UPDATE patients SET ${fields} WHERE id = ?${predicate}`,
      params
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ message: 'Patient updated successfully' });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
};

export const deletePatient = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const patientId = parseId(id);

    if (patientId === null) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // The record is removed where it is AND where the caller's hospital
    // allows. A record that belongs to another hospital is not removed, and
    // the answer is the same as for a record that does not exist.
    const scope = req.tenant;
    const params: any[] = [patientId];
    let predicate = '';
    if (!scope?.platformWide) {
      predicate = ' AND hospital_id = ?';
      params.push(scope?.hospitalId ?? -1);
    }

    const [result] = await pool.query(`DELETE FROM patients WHERE id = ?${predicate}`, params);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
};

/**
 * Applies a batch of patient changes that were made while the device was
 * offline.
 *
 * The client queued creates, updates and deletes in browser storage when a
 * request could not reach the server, and reported them as saved -- but
 * nothing ever read that queue, so the changes were silently lost. This
 * endpoint applies them, and reports per-operation so the client only drops
 * the entries the server accepted.
 */
export const syncPatients = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];

    if (operations.length === 0) {
      res.json({ message: 'Nothing to sync', results: [] });
      return;
    }

    if (operations.length > 200) {
      res.status(400).json({ error: 'Too many operations in one batch' });
      return;
    }

    const results: Array<{ id: string; action: string; applied: boolean; error?: string }> = [];

    for (const operation of operations) {
      const id = String(operation?.id ?? '');
      const action = String(operation?.action ?? '').toUpperCase();
      const patient = (operation?.patient ?? {}) as Record<string, unknown>;

      try {
        if (action === 'CREATE') {
          // A queued create carries a client-side placeholder id. The record
          // is created with a real identifier, so the mapping back to the
          // placeholder is reported.
          const payload = await buildPatientPayload(stripClientFields(patient));
          const insertSql = `INSERT INTO patients
              (patient_id, first_name, last_name, age, gender, phone, email, address, hospital_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

          let created: { id: number; patientId: string } | null = null;
          for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
            const patientId = `PAT-${randomToken(6)}`;
            try {
              const [result] = await pool.query(insertSql, [
                patientId,
                encryptForStorage(payload.firstName, 'first_name'),
                encryptForStorage(payload.lastName, 'last_name'),
                payload.age,
                payload.gender,
                payload.phone ? encryptForStorage(payload.phone, 'phone') : null,
                payload.email ? encryptForStorage(payload.email, 'email') : null,
                payload.address ? encryptForStorage(payload.address, 'address') : null,
                payload.hospitalId
              ]);
              created = { id: (result as any).insertId, patientId };
            } catch (error) {
              if (isDuplicateEntry(error) && attempt < 4) continue;
              throw error;
            }
          }

          if (!created) throw new Error('Unable to allocate a unique patient identifier');
          results.push({ id, action, applied: true });
        } else if (action === 'UPDATE') {
          const patientId = parseId(id);
          if (patientId === null) {
            results.push({ id, action, applied: false, error: 'Patient not found' });
            continue;
          }
          const updates = await buildPatientUpdates(stripClientFields(patient));
          if (Object.keys(updates).length === 0) {
            results.push({ id, action, applied: false, error: 'No valid fields to update' });
            continue;
          }
          const fields = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
          const values = Object.values(updates);
          const [result] = await pool.query(
            `UPDATE patients SET ${fields} WHERE id = ?`,
            [...values, patientId]
          );
          results.push({
            id,
            action,
            applied: (result as any).affectedRows > 0,
            ...((result as any).affectedRows === 0 ? { error: 'Patient not found' } : {}),
          });
        } else if (action === 'DELETE') {
          const patientId = parseId(id);
          if (patientId === null) {
            results.push({ id, action, applied: false, error: 'Patient not found' });
            continue;
          }
          const [result] = await pool.query('DELETE FROM patients WHERE id = ?', [patientId]);
          results.push({
            id,
            action,
            applied: true,
            ...((result as any).affectedRows === 0 ? { error: 'Patient was already deleted' } : {}),
          });
        } else {
          results.push({ id, action, applied: false, error: 'Unknown operation' });
        }
      } catch (error) {
        // One bad operation must not stop the rest of the batch.
        results.push({
          id,
          action,
          applied: false,
          error: error instanceof Error ? error.message : 'Failed to apply operation',
        });
      }
    }

    const applied = results.filter((r) => r.applied).length;
    res.json({ message: 'Sync complete', applied, failed: results.length - applied, results });
  } catch (error) {
    console.error('Sync patients error:', error);
    res.status(500).json({ error: 'Failed to sync patients' });
  }
};

/**
 * Removes the bookkeeping fields the client adds to a queued record. They are
 * not part of the patient and must not be written to the database.
 */
const stripClientFields = (patient: Record<string, unknown>): Record<string, unknown> => {
  const {
    id: _id,
    isOffline: _isOffline,
    offlineAction: _offlineAction,
    clientUpdatedAt: _clientUpdatedAt,
    ...rest
  } = patient;
  return rest;
};
