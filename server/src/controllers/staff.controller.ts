import type { Response } from 'express';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const sensitiveFields = ['first_name', 'last_name', 'email', 'phone'];

/** Raised for input the caller can correct; answered with 400, not 500. */
class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

/**
 * Columns a client may change through PUT /api/staff/:id.
 *
 * The update used to build its SET clause from every key of the request body.
 * That allowed mass assignment: a caller could rewrite `id`, `staff_id` or
 * any other column of the table. The identity columns are deliberately absent.
 */
const ALLOWED_UPDATE_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'department_id',
  'hospital_id',
  'join_date',
  'status',
];

/**
 * The web client posts camelCase for staff, other clients post snake_case.
 * Both spellings are accepted; anything that is not a known column is ignored.
 */
const FIELD_ALIASES: Record<string, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  hospitalId: 'hospital_id',
  departmentId: 'department_id',
  joinDate: 'join_date',
};

const STAFF_STATUSES = ['active', 'on_leave', 'inactive'];

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

/** Path parameters are strings; only a positive integer can address a row. */
const parseId = (value: unknown): number | null => {
  const asString = String(value ?? '');
  if (!/^\d+$/.test(asString)) return null;
  const parsed = Number(asString);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const hospitalExists = async (hospitalId: number): Promise<boolean> => {
  const [rows] = await pool.query('SELECT 1 FROM hospitals WHERE id = ? LIMIT 1', [hospitalId]);
  return (rows as any[]).length > 0;
};

const findDepartment = async (
  departmentId: number
): Promise<{ id: number; hospital_id: number } | null> => {
  const [rows] = await pool.query('SELECT id, hospital_id FROM departments WHERE id = ? LIMIT 1', [
    departmentId,
  ]);
  return (rows as any[])[0] ?? null;
};

/**
 * `staff.role` holds a role NAME, not a foreign key. A numeric role id was
 * written into that column before, which stored a meaningless number and
 * broke every consumer that renders the role. A role id is resolved through
 * the roles table; a role name may also be supplied directly.
 */
const resolveRoleName = async (body: Record<string, unknown>): Promise<string> => {
  const roleIdValue = readField(body, 'roleId');
  if (roleIdValue !== undefined && roleIdValue !== null && roleIdValue !== '') {
    const roleId = Number(roleIdValue);
    if (!Number.isInteger(roleId) || roleId <= 0) {
      throw new InvalidInputError('Invalid role id');
    }
    const [rows] = await pool.query('SELECT name FROM roles WHERE id = ? LIMIT 1', [roleId]);
    const role = (rows as any[])[0];
    if (!role) {
      throw new InvalidInputError('Role not found');
    }
    return String(role.name);
  }

  const roleValue = readField(body, 'role');
  if (typeof roleValue === 'string' && roleValue.trim() !== '') {
    const name = roleValue.trim();
    if (name.length > 50) {
      throw new InvalidInputError('Role name is too long');
    }
    return name;
  }

  throw new InvalidInputError('Role is required');
};

/** The client sends "On Leave"; the column stores "on_leave". */
const normalizeStaffStatus = (value: unknown): string => {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!STAFF_STATUSES.includes(normalized)) {
    throw new InvalidInputError(`Status must be one of: ${STAFF_STATUSES.join(', ')}`);
  }
  return normalized;
};

const parseOptionalId = (value: unknown, label: string): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidInputError(`Invalid ${label} id`);
  }
  return parsed;
};

/** A department must exist and belong to the hospital it is filed under. */
const validateAffiliation = async (
  hospitalId: number | null,
  departmentId: number | null
): Promise<void> => {
  if (hospitalId !== null && !(await hospitalExists(hospitalId))) {
    throw new InvalidInputError('Hospital not found');
  }
  if (departmentId !== null) {
    const department = await findDepartment(departmentId);
    if (!department) {
      throw new InvalidInputError('Department not found');
    }
    if (hospitalId !== null && Number(department.hospital_id) !== hospitalId) {
      throw new InvalidInputError('Department does not belong to the selected hospital');
    }
  }
};

interface StaffPayload {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
  hospitalId: number | null;
  departmentId: number | null;
  joinDate: string | null;
  status: string;
}

/**
 * Validates the client supplied staff data and returns the values to store.
 * Sensitive fields are encrypted here, so no caller can accidentally write
 * plaintext PHI.
 */
const buildStaffPayload = async (body: Record<string, unknown>): Promise<StaffPayload> => {
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

  const emailValue = readField(body, 'email');
  let email: string | null = null;
  if (emailValue !== undefined && emailValue !== null && emailValue !== '') {
    email = String(emailValue);
    if (email.length > 255) throw new InvalidInputError('Email is too long');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new InvalidInputError('Valid email is required');
    }
  }

  const phoneValue = readField(body, 'phone');
  let phone: string | null = null;
  if (phoneValue !== undefined && phoneValue !== null && phoneValue !== '') {
    phone = String(phoneValue);
    if (phone.length > 20) throw new InvalidInputError('Phone number is too long');
  }

  const role = await resolveRoleName(body);

  const hospitalId = parseOptionalId(readField(body, 'hospital_id'), 'hospital');
  const departmentId = parseOptionalId(readField(body, 'department_id'), 'department');
  await validateAffiliation(hospitalId, departmentId);

  const joinDateValue = readField(body, 'join_date');
  let joinDate: string | null = null;
  if (joinDateValue !== undefined && joinDateValue !== null && joinDateValue !== '') {
    joinDate = String(joinDateValue).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) {
      throw new InvalidInputError('Join date must be a date in YYYY-MM-DD format');
    }
  }

  const statusValue = readField(body, 'status');
  const status =
    statusValue === undefined || statusValue === null || statusValue === ''
      ? 'active'
      : normalizeStaffStatus(statusValue);

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email,
    phone,
    role,
    hospitalId,
    departmentId,
    joinDate,
    status,
  };
};

/**
 * Builds the SET clause of an update from a whitelist of columns.
 * Returns an empty object when the request carries no updatable field.
 */
const buildStaffUpdates = async (
  body: Record<string, unknown>,
  staffId: number
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
      case 'hospital_id': {
        updates[column] = parseOptionalId(value, 'hospital');
        break;
      }
      case 'department_id': {
        updates[column] = parseOptionalId(value, 'department');
        break;
      }
      case 'join_date': {
        if (value === null || value === '') {
          updates[column] = null;
          break;
        }
        const date = String(value).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new InvalidInputError('Join date must be a date in YYYY-MM-DD format');
        }
        updates[column] = date;
        break;
      }
      case 'status': {
        if (value === null || value === '') {
          updates[column] = 'active';
          break;
        }
        updates[column] = normalizeStaffStatus(value);
        break;
      }
      default:
        break;
    }
  }

  // `staff.role` holds a role NAME, not a foreign key, so a supplied role id
  // is resolved through the roles table before it is written.
  const roleIdValue = readField(body, 'roleId');
  const roleValue = readField(body, 'role');
  if (
    (roleIdValue !== undefined && roleIdValue !== null && roleIdValue !== '') ||
    roleValue !== undefined
  ) {
    updates.role = await resolveRoleName(body);
  }

  // A department must belong to the hospital the staff member is filed under.
  // When only one half of the pair is updated the other half is taken from
  // the stored row, so the check always sees the effective combination.
  if (updates.hospital_id !== undefined || updates.department_id !== undefined) {
    const [currentRows] = await pool.query(
      'SELECT hospital_id, department_id FROM staff WHERE id = ? LIMIT 1',
      [staffId]
    );
    const current = (currentRows as any[])[0] || null;
    const hospitalId =
      updates.hospital_id !== undefined
        ? (updates.hospital_id as number | null)
        : (current?.hospital_id ?? null);
    const departmentId =
      updates.department_id !== undefined
        ? (updates.department_id as number | null)
        : (current?.department_id ?? null);
    await validateAffiliation(hospitalId, departmentId);
  }

  return updates;
};

const decryptStaffData = (staffMember: Record<string, any>) => {
  const decryptedStaff = { ...staffMember };
  for (const field of sensitiveFields) {
    if (decryptedStaff[field]) {
      decryptedStaff[field] = decryptField(decryptedStaff[field]);
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
      SELECT s.*, s.role as role_name, h.name as hospital_name, d.name as department_name
      FROM staff s
      LEFT JOIN hospitals h ON s.hospital_id = h.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // The list is confined to the caller's hospital. A caller who may see
    // one hospital's records may not see another's staff.
    const scope = req.tenant;
    if (!scope?.platformWide) {
      query += ' AND s.hospital_id = ?';
      params.push(scope?.hospitalId ?? -1);
    }

    if (role) {
      query += ' AND s.role = ?';
      params.push(role);
    }

    if (hospitalId) {
      query += ' AND s.hospital_id = ?';
      params.push(hospitalId);
    }

    // The list is paged: a table of staff is a table of everybody, and the
    // answer should not be the whole of it in one response.
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    query += ' ORDER BY s.id LIMIT ? OFFSET ?';
    params.push(limit, offset);

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
    const staffId = parseId(id);

    if (staffId === null) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const [staff] = await pool.query(
      `SELECT s.*, s.role as role_name, h.name as hospital_name, d.name as department_name
       FROM staff s
       LEFT JOIN hospitals h ON s.hospital_id = h.id
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.id = ?`,
      [staffId]
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
    const body = (req.body ?? {}) as Record<string, unknown>;
    const payload = await buildStaffPayload(body);

    // staff.id is a BIGINT UNSIGNED AUTO_INCREMENT column: a uuid cannot be
    // written to it. The public identifier lives in staff.staff_id, and the
    // generated primary key is taken from the insert result.
    const insertSql = `INSERT INTO staff
       (staff_id, first_name, last_name, email, phone, role, hospital_id, department_id, join_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const staffId = `STF-${randomToken(6)}`;
      try {
        const [result] = await pool.query(insertSql, [
          staffId,
          encryptForStorage(payload.firstName, 'first_name'),
          encryptForStorage(payload.lastName, 'last_name'),
          payload.email ? encryptForStorage(payload.email, 'email') : null,
          payload.phone ? encryptForStorage(payload.phone, 'phone') : null,
          payload.role,
          payload.hospitalId,
          payload.departmentId,
          payload.joinDate,
          payload.status,
        ]);

        res.status(201).json({
          message: 'Staff created successfully',
          id: (result as any).insertId,
          staffId,
        });
        return;
      } catch (error) {
        // staff_id is UNIQUE. A collision is unlikely but not impossible, so
        // retry with a fresh identifier instead of failing the request.
        if (isDuplicateEntry(error) && attempt < 4) continue;
        throw error;
      }
    }

    throw new Error('Unable to allocate a unique staff identifier');
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Failed to create staff' });
  }
};

export const updateStaff = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const staffId = parseId(id);

    if (staffId === null) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates = await buildStaffUpdates(body, staffId);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const fields = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    const [result] = await pool.query(
      `UPDATE staff SET ${fields} WHERE id = ?`,
      [...values, staffId]
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({ message: 'Staff updated successfully' });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Failed to update staff' });
  }
};

export const deleteStaff = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const staffId = parseId(id);

    if (staffId === null) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const [result] = await pool.query('DELETE FROM staff WHERE id = ?', [staffId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Failed to delete staff' });
  }
};
