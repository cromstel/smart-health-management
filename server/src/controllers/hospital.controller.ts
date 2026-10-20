import type { Response } from 'express';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * Columns a client may change through PUT /api/hospitals/:id.
 *
 * The update used to build its SET clause from every key of the request body,
 * which allowed mass assignment of any column of the table, including the
 * public identifier `hospital_id`.
 */
const ALLOWED_UPDATE_FIELDS = [
  'name',
  'address',
  'city',
  'state',
  'zip_code',
  'phone',
  'email',
  'status',
];

/** The client posts camelCase for the postal code, the column is snake_case. */
const FIELD_ALIASES: Record<string, string> = {
  zipCode: 'zip_code',
};

const HOSPITAL_STATUSES = ['active', 'inactive'];

/** Unambiguous alphabet for generated public identifiers (no I, O, 0 or 1). */
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Raised for input the caller can correct; answered with 400, not 500. */
class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

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
 * name or one of its documented aliases. `undefined` means "not supplied".
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

/** Path parameters are strings; only a positive integer can address a row. */
const parseId = (value: unknown): number | null => {
  const asString = String(value ?? '');
  if (!/^\d+$/.test(asString)) return null;
  const parsed = Number(asString);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const readRequiredText = (value: unknown, label: string, maxLength: number): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InvalidInputError(`${label} is required`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new InvalidInputError(`${label} is too long`);
  }
  return text;
};

const readOptionalText = (value: unknown, maxLength: number, label: string): string | null => {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (text.length > maxLength) {
    throw new InvalidInputError(`${label} is too long`);
  }
  return text === '' ? null : text;
};

export const getHospitals = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [hospitals] = await pool.query('SELECT * FROM hospitals ORDER BY id');
    res.json(hospitals);
  } catch (error) {
    console.error('Get hospitals error:', error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
};

export const getHospitalById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const hospitalId = parseId(id);

    if (hospitalId === null) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const [hospitals] = await pool.query('SELECT * FROM hospitals WHERE id = ?', [hospitalId]);
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

export const getHospitalDepartments = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const hospitalId = parseId(id);

    if (hospitalId === null) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const [departments] = await pool.query(
      'SELECT * FROM departments WHERE hospital_id = ? ORDER BY id',
      [hospitalId]
    );
    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
};

export const createHospital = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name = readRequiredText(readField(body, 'name'), 'Hospital name', 255);
    const address = readOptionalText(readField(body, 'address'), 2000, 'Address');
    const city = readOptionalText(readField(body, 'city'), 100, 'City');
    const state = readOptionalText(readField(body, 'state'), 100, 'State');
    const zipCode = readOptionalText(readField(body, 'zip_code'), 20, 'Zip code');
    const phone = readOptionalText(readField(body, 'phone'), 20, 'Phone');
    const email = readOptionalText(readField(body, 'email'), 255, 'Email');

    const statusValue = readField(body, 'status');
    let status = 'active';
    if (statusValue !== undefined && statusValue !== null && statusValue !== '') {
      status = String(statusValue).trim().toLowerCase();
      if (!HOSPITAL_STATUSES.includes(status)) {
        throw new InvalidInputError(`Status must be one of: ${HOSPITAL_STATUSES.join(', ')}`);
      }
    }

    // hospitals.id is a BIGINT UNSIGNED AUTO_INCREMENT column: a uuid cannot
    // be written to it. The public identifier lives in hospitals.hospital_id
    // and is generated here, because that column is NOT NULL and UNIQUE.
    const insertSql = `INSERT INTO hospitals
        (hospital_id, name, address, city, state, zip_code, phone, email, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const hospitalId = `HOSP-${randomToken(6)}`;
      try {
        const [result] = await pool.query(insertSql, [
          hospitalId,
          name,
          address,
          city,
          state,
          zipCode,
          phone,
          email,
          status,
        ]);

        res.status(201).json({
          message: 'Hospital created successfully',
          id: (result as any).insertId,
          hospitalId,
        });
        return;
      } catch (error) {
        // hospital_id is UNIQUE. A collision is unlikely but not impossible, so
        // retry with a fresh identifier instead of failing the request.
        if (isDuplicateEntry(error) && attempt < 4) continue;
        throw error;
      }
    }

    throw new Error('Unable to allocate a unique hospital identifier');
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create hospital error:', error);
    res.status(500).json({ error: 'Failed to create hospital' });
  }
};

export const updateHospital = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const hospitalId = parseId(id);

    if (hospitalId === null) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    for (const column of ALLOWED_UPDATE_FIELDS) {
      const value = readField(body, column);
      if (value === undefined) continue; // not supplied by the caller

      switch (column) {
        case 'name': {
          updates[column] = readRequiredText(value, 'Hospital name', 255);
          break;
        }
        case 'address': {
          updates[column] = readOptionalText(value, 2000, 'Address');
          break;
        }
        case 'city': {
          updates[column] = readOptionalText(value, 100, 'City');
          break;
        }
        case 'state': {
          updates[column] = readOptionalText(value, 100, 'State');
          break;
        }
        case 'zip_code': {
          updates[column] = readOptionalText(value, 20, 'Zip code');
          break;
        }
        case 'phone': {
          updates[column] = readOptionalText(value, 20, 'Phone');
          break;
        }
        case 'email': {
          const email = readOptionalText(value, 255, 'Email');
          if (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new InvalidInputError('Valid email is required');
          }
          updates[column] = email;
          break;
        }
        case 'status': {
          if (value === null || value === '') {
            updates[column] = 'active';
            break;
          }
          const status = String(value).trim().toLowerCase();
          if (!HOSPITAL_STATUSES.includes(status)) {
            throw new InvalidInputError(`Status must be one of: ${HOSPITAL_STATUSES.join(', ')}`);
          }
          updates[column] = status;
          break;
        }
        default:
          break;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    const [result] = await pool.query(
      `UPDATE hospitals SET ${fields} WHERE id = ?`,
      [...values, hospitalId]
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    res.json({ message: 'Hospital updated successfully' });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update hospital error:', error);
    res.status(500).json({ error: 'Failed to update hospital' });
  }
};

export const deleteHospital = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const hospitalId = parseId(id);

    if (hospitalId === null) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const [result] = await pool.query('DELETE FROM hospitals WHERE id = ?', [hospitalId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    res.json({ message: 'Hospital deleted successfully' });
  } catch (error) {
    console.error('Delete hospital error:', error);
    res.status(500).json({ error: 'Failed to delete hospital' });
  }
};
