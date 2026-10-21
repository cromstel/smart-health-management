import pool from '../config/database.js';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Dispensing events -- the movement log of the pharmacy.
 *
 * Every unit that leaves the shelf is recorded here. The event log is what
 * the inventory forecast uses to derive a real burn rate instead of a
 * constant, so a dispense that is not recorded is a dispense the forecast
 * cannot see.
 */

export const DISPENSING_EVENT_LIMIT_DEFAULT = 100;
export const DISPENSING_EVENT_LIMIT_MAX = 500;

/** Error carrying the HTTP status the controller should answer with. */
export class DispensingEventError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'DispensingEventError';
    this.status = status;
  }
}

export interface DispensingEventRecord {
  id: number;
  prescriptionId: string | null;
  patientId: number | null;
  patientCode: string | null;
  patientName: string | null;
  medicineId: string | null;
  medicineName: string | null;
  quantity: number;
  dispensedBy: number | null;
  dispensedByName: string | null;
  dispensedAt: string;
  notes: string | null;
  createdAt: string | null;
}

export interface DispensingEventFilters {
  patientId?: number | null;
  medicineId?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number | null;
  /**
   * The hospital the records are confined to.
   *
   * Undefined means no confinement, which is what the platform-wide caller
   * gets. A number confines the records to that hospital.
   */
  hospitalId?: number | null;
}

const SELECT_EVENT = `
  SELECT
    de.id             AS id,
    de.prescription_id AS prescriptionId,
    de.patient_id     AS patientId,
    p.patient_id      AS patientCode,
    CONCAT(p.first_name, ' ', p.last_name) AS patientName,
    de.medicine_id    AS medicineId,
    de.medicine_name  AS medicineName,
    de.quantity       AS quantity,
    de.dispensed_by   AS dispensedBy,
    u.name            AS dispensedByName,
    DATE_FORMAT(de.dispensed_at, '%Y-%m-%d %H:%i:%s') AS dispensedAt,
    de.notes          AS notes,
    DATE_FORMAT(de.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
  FROM dispensing_events de
  LEFT JOIN patients p ON p.id = de.patient_id
  LEFT JOIN users u ON u.id = de.dispensed_by
`;

/** Formats a JS date as a MySQL DATETIME literal in the server's timezone. */
const toMysqlDateTime = (value: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
    `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  );
};

/**
 * A `from`/`to` bound may be a plain date (YYYY-MM-DD) or a full timestamp.
 * A plain date used as `to` covers the whole day.
 */
const toBoundary = (value: string, endOfDay: boolean): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return endOfDay ? `${value} 23:59:59` : `${value} 00:00:00`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new DispensingEventError(`Invalid date boundary: ${value}`, 400);
  }
  return toMysqlDateTime(parsed);
};

/** Lists dispensing events, newest first. */
export const listDispensingEvents = async (
  filters: DispensingEventFilters = {}
): Promise<DispensingEventRecord[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  // The events are the patients', and the patients belong to hospitals.
  if (filters.hospitalId !== undefined) {
    where.push('p.hospital_id = ?');
    params.push(filters.hospitalId);
  }

  if (filters.patientId) {
    where.push('de.patient_id = ?');
    params.push(filters.patientId);
  }

  if (filters.medicineId) {
    where.push('de.medicine_id = ?');
    params.push(filters.medicineId);
  }

  if (filters.from) {
    where.push('de.dispensed_at >= ?');
    params.push(toBoundary(filters.from, false));
  }

  if (filters.to) {
    where.push('de.dispensed_at <= ?');
    params.push(toBoundary(filters.to, true));
  }

  const limit = Math.min(
    Math.max(Number(filters.limit ?? DISPENSING_EVENT_LIMIT_DEFAULT) || DISPENSING_EVENT_LIMIT_DEFAULT, 1),
    DISPENSING_EVENT_LIMIT_MAX
  );
  params.push(limit);

  const sql = `${SELECT_EVENT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY de.dispensed_at DESC, de.id DESC
    LIMIT ?`;

  const [rows] = await pool.query(sql, params);
  return rows as DispensingEventRecord[];
};

/** Reads a single dispensing event, or null when it does not exist. */
export const getDispensingEvent = async (
  id: number
): Promise<DispensingEventRecord | null> => {
  const [rows] = await pool.query(`${SELECT_EVENT} WHERE de.id = ? LIMIT 1`, [id]);
  const list = rows as DispensingEventRecord[];
  return list.length ? list[0] : null;
};

export interface CreateDispensingEventInput {
  prescriptionId?: string | null;
  patientId: number;
  medicineId: string;
  quantity: number;
  notes?: string | null;
  dispensedAt?: string | null;
  dispensedBy?: number | null;
  /**
   * The hospital the record is confined to.
   *
   * Undefined means no confinement, which is what the platform-wide caller
   * gets. A number refuses a dispense for a patient of another hospital.
   */
  hospitalId?: number | null;
}

/**
 * Records a dispense.
 *
 * The medicine name is resolved from the inventory (the event log keeps the
 * name it was dispensed under, so a later rename does not rewrite history),
 * and the dispensing user is the authenticated caller.
 */
export const createDispensingEvent = async (
  input: CreateDispensingEventInput
): Promise<DispensingEventRecord> => {
  const [patientRows] = await pool.query(
    'SELECT id, hospital_id FROM patients WHERE id = ? LIMIT 1',
    [input.patientId]
  );
  const patient = (patientRows as RowDataPacket[])[0];
  if (!patient) {
    throw new DispensingEventError(`Patient ${input.patientId} was not found`, 404);
  }
  // A dispense is recorded against a patient of the caller's own hospital.
  if (
    input.hospitalId !== undefined &&
    Number(patient.hospital_id ?? -1) !== Number(input.hospitalId)
  ) {
    throw new DispensingEventError(`Patient ${input.patientId} was not found`, 404);
  }

  const [medicineRows] = await pool.query(
    'SELECT id, medicine_name FROM medicines_inventory WHERE id = ? LIMIT 1',
    [input.medicineId]
  );
  const medicine = (medicineRows as RowDataPacket[])[0];
  if (!medicine) {
    throw new DispensingEventError(`Medicine ${input.medicineId} was not found`, 404);
  }

  let dispensedAt = toMysqlDateTime(new Date());
  if (input.dispensedAt) {
    const parsed = new Date(input.dispensedAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new DispensingEventError('dispensedAt must be a valid date', 400);
    }
    dispensedAt = toMysqlDateTime(parsed);
  }

  const [result] = await pool.query(
    `INSERT INTO dispensing_events
       (prescription_id, patient_id, medicine_id, medicine_name, quantity, dispensed_by, dispensed_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.prescriptionId ?? null,
      input.patientId,
      input.medicineId,
      String(medicine.medicine_name),
      input.quantity,
      input.dispensedBy ?? null,
      dispensedAt,
      input.notes ?? null,
    ]
  );

  const id = Number((result as { insertId: number }).insertId);
  const record = await getDispensingEvent(id);
  if (!record) {
    throw new DispensingEventError('Failed to create the dispensing event', 500);
  }
  return record;
};

/** Removes a dispensing event. */
export const deleteDispensingEvent = async (id: number): Promise<void> => {
  const [result] = await pool.query('DELETE FROM dispensing_events WHERE id = ?', [id]);
  const affected = (result as { affectedRows?: number })?.affectedRows ?? 0;
  if (!affected) {
    throw new DispensingEventError('Dispensing event not found', 404);
  }
};
