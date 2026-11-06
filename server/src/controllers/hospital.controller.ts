import type { Response } from 'express';
import pool from '../config/database.js';
import { randomToken, isDuplicateEntry } from '../utils/identifiers.js';
import { hasSubdomainShape, isReservedSubdomain } from '../utils/subdomains.js';
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

/** Raised for input the caller can correct; answered with 400, not 500. */
class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

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

/**
 * The shape of a subdomain.
 *
 * A subdomain becomes the first label of a hostname (`<sub>.medicare.example.com`),
 * so it may only hold letters, numbers and hyphens, and may not start or end
 * with a hyphen. The platform's own names are refused too: a hospital holding
 * one would sit in front of the route it shadows.
 */
const readSubdomain = (value: unknown, label: string): string | null => {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim().toLowerCase();
  if (!hasSubdomainShape(text)) {
    throw new InvalidInputError(
      `${label} must be 2-100 characters of letters, numbers and hyphens, and cannot start or end with a hyphen`
    );
  }
  if (isReservedSubdomain(text)) {
    throw new InvalidInputError(`${label} is reserved by the platform`);
  }
  return text;
};

/** The shape of a full custom domain (`portal.example.org`). */
const DOMAIN_PATTERN =
  /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

const readDomain = (value: unknown, label: string): string | null => {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim().toLowerCase();
  if (!DOMAIN_PATTERN.test(text)) {
    throw new InvalidInputError(`${label} must be a valid domain, for example portal.example.org`);
  }
  return text;
};

/**
 * Whether a subdomain is already claimed by a different hospital.
 *
 * The column carries a UNIQUE index, so the check mirrors it: the value must
 * belong to no other row. `excludeHospitalId` is the row being edited.
 */
const subdomainInUse = async (
  subdomain: string,
  excludeHospitalId: number | null
): Promise<boolean> => {
  const [rows] = await pool.query(
    'SELECT id FROM hospitals WHERE subdomain = ? AND (? IS NULL OR id != ?) LIMIT 1',
    [subdomain, excludeHospitalId, excludeHospitalId]
  );
  return (rows as any[]).length > 0;
};

/** Whether a custom domain is already claimed by a different hospital. */
const domainInUse = async (
  domain: string,
  excludeHospitalId: number | null
): Promise<boolean> => {
  const [rows] = await pool.query(
    'SELECT id FROM hospitals WHERE domain = ? AND (? IS NULL OR id != ?) LIMIT 1',
    [domain, excludeHospitalId, excludeHospitalId]
  );
  return (rows as any[]).length > 0;
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
    const subdomain = readSubdomain(readField(body, 'subdomain'), 'Subdomain');
    const domain = readDomain(readField(body, 'domain'), 'Domain');

    // Both columns carry a UNIQUE index. Claiming a value another hospital
    // already holds is a conflict the caller can correct, not a server fault.
    if (subdomain !== null && (await subdomainInUse(subdomain, null))) {
      return res.status(409).json({ error: 'That subdomain is already taken' });
    }
    if (domain !== null && (await domainInUse(domain, null))) {
      return res.status(409).json({ error: 'That domain is already taken' });
    }

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
        (hospital_id, name, address, city, state, zip_code, phone, email, status, subdomain, domain)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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
          subdomain,
          domain,
        ]);

        res.status(201).json({
          message: 'Hospital created successfully',
          id: (result as any).insertId,
          hospitalId,
        });
        return;
      } catch (error) {
        // hospital_id is UNIQUE. A collision is unlikely but not impossible,
        // so retry with a fresh identifier instead of failing the request.
        // A subdomain or domain collision is different: it is a real conflict
        // the caller must resolve, and a fresh hospital identifier will not
        // change it — answer 409 instead of retrying.
        if (isDuplicateEntry(error)) {
          if (subdomain !== null && (await subdomainInUse(subdomain, null))) {
            return res.status(409).json({ error: 'That subdomain is already taken' });
          }
          if (domain !== null && (await domainInUse(domain, null))) {
            return res.status(409).json({ error: 'That domain is already taken' });
          }
          if (attempt < 4) continue;
        }
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

/**
 * Updates a hospital's subdomain and/or custom domain.
 *
 * A dedicated endpoint rather than a field of PUT /api/hospitals/:id: both
 * columns carry a UNIQUE index, so every write has to re-validate the shape
 * and re-check the value against every other row. Keeping it here means that
 * logic lives in one place and the general update path cannot reach it.
 */
export const updateSubdomain = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const hospitalId = parseId(id);

    if (hospitalId === null) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const subdomain = readSubdomain(body.subdomain, 'Subdomain');
    const domain = readDomain(body.domain, 'Domain');

    if (subdomain === null && domain === null) {
      return res.status(400).json({ error: 'Provide a subdomain, a domain, or both' });
    }

    const [existing] = await pool.query('SELECT id FROM hospitals WHERE id = ?', [hospitalId]);
    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    if (subdomain !== null && (await subdomainInUse(subdomain, hospitalId))) {
      return res.status(409).json({ error: 'That subdomain is already taken' });
    }
    if (domain !== null && (await domainInUse(domain, hospitalId))) {
      return res.status(409).json({ error: 'That domain is already taken' });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    if (subdomain !== null) {
      updates.push('subdomain = ?');
      values.push(subdomain);
    }
    if (domain !== null) {
      updates.push('domain = ?');
      values.push(domain);
    }

    await pool.query(`UPDATE hospitals SET ${updates.join(', ')} WHERE id = ?`, [
      ...values,
      hospitalId,
    ]);

    res.json({ message: 'Hospital addressing updated successfully' });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update hospital subdomain error:', error);
    res.status(500).json({ error: 'Failed to update hospital addressing' });
  }
};
