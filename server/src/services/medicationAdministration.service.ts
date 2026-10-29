import pool from '../config/database.js';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

/**
 * Medication administration records (MAR).
 *
 * The table `medication_administrations` is the system of record for a
 * scheduled dose. Everything the pharmacy compliance screen used to keep in
 * a hardcoded React array is now derived from here.
 *
 * Status vocabulary: the database enum is lower case
 * (`pending` | `administered` | `overdue` | `missed`) and this service keeps
 * it that way -- every other enum in the API is lower case. The client
 * component maps it to the Title Case labels its own type uses.
 */

export const MEDICATION_ADMINISTRATION_STATUSES = [
  'pending',
  'administered',
  'overdue',
  'missed',
] as const;

export type MedicationAdministrationStatus =
  (typeof MEDICATION_ADMINISTRATION_STATUSES)[number];

/** Error carrying the HTTP status the controller should answer with. */
export class MedicationAdministrationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'MedicationAdministrationError';
    this.status = status;
  }
}

export interface MedicationAdministrationFilters {
  patientId?: number | null;
  status?: MedicationAdministrationStatus | null;
  date?: string | null;
  assignedStaffId?: number | null;
  limit?: number | null;
  /**
   * The hospital the records are confined to.
   *
   * Undefined means no confinement, which is what the platform-wide caller
   * gets. A number confines the records to that hospital.
   */
  hospitalId?: number | null;
}

/** The record shape the API returns -- the field names the UI already uses. */
export interface MedicationAdministrationRecord {
  id: number;
  patientId: number;
  patientCode: string;
  patientName: string;
  medicineId: string | null;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  status: MedicationAdministrationStatus;
  assignedStaffId: number | null;
  assignedStaff: string | null;
  criticalNotes: string | null;
  administeredAt: string | null;
}

export interface MedicationAdministrationOptions {
  patients: Array<{
    patientId: number;
    patientCode: string;
    patientName: string;
    hospitalId: number | null;
  }>;
  staff: Array<{
    staffId: number;
    staffCode: string;
    staffName: string;
    role: string;
    userId: number | null;
    hospitalId: number | null;
  }>;
}

/**
 * The number of units a dose consumes.
 *
 * `dosage` is free text ("2 Tablets", "10 Units"). The leading number is the
 * unit count; anything else falls back to a single unit so a sign-off always
 * moves stock by at least one.
 */
export const parseDosageQuantity = (dosage: string | null | undefined): number => {
  if (dosage === null || dosage === undefined) return 1;
  const match = /^\s*(\d+(?:\.\d+)?)/.exec(String(dosage));
  if (!match) return 1;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.round(parsed));
};

/** Formats a JS date as a MySQL DATETIME literal in the server's timezone. */
export const toMysqlDateTime = (value: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
    `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  );
};

/** Parses an ISO 8601 string (or a MySQL datetime) into a Date. */
export const parseDateTime = (value: string): Date | null => {
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  // `2026-10-20 14:00:00` is not parseable in every runtime; normalise it.
  const normalised = String(value).replace(' ', 'T');
  const parsed = new Date(normalised);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * A user id is only usable as a foreign key when it is a positive integer.
 * A malformed token therefore leaves `administered_by` NULL instead of
 * failing the whole sign-off.
 */
export const toNullableUserId = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const SELECT_RECORD = `
  SELECT
    ma.id                  AS id,
    ma.patient_id          AS patientId,
    p.patient_id           AS patientCode,
    CONCAT(p.first_name, ' ', p.last_name) AS patientName,
    ma.medicine_id         AS medicineId,
    ma.medicine_name       AS medicineName,
    ma.dosage              AS dosage,
    DATE_FORMAT(ma.scheduled_time, '%Y-%m-%d %H:%i:%s') AS scheduledTime,
    CASE
      WHEN ma.status = 'pending' AND ma.scheduled_time < NOW() THEN 'overdue'
      ELSE ma.status
    END                   AS status,
    ma.assigned_staff_id   AS assignedStaffId,
    COALESCE(CONCAT(s.first_name, ' ', s.last_name), ma.assigned_staff_name) AS assignedStaff,
    ma.critical_notes      AS criticalNotes,
    DATE_FORMAT(ma.administered_at, '%Y-%m-%d %H:%i:%s') AS administeredAt
  FROM medication_administrations ma
  JOIN patients p ON p.id = ma.patient_id
  LEFT JOIN staff s ON s.id = ma.assigned_staff_id
`;

/**
 * Persists the overdue transition.
 *
 * Overdue is derived server side: a dose that is still `pending` after its
 * scheduled time has passed is overdue. The derivation happens in the read
 * query as well, so the answer is correct even if this write has not run
 * yet -- but persisting it keeps the stored enum honest for reporting.
 */
export const markOverdueAdministrations = async (
  executor: Pick<PoolConnection, 'query'> = pool
): Promise<number> => {
  const [result] = await executor.query(
    `UPDATE medication_administrations
     SET status = 'overdue'
     WHERE status = 'pending' AND scheduled_time < NOW()`
  );
  const affected = (result as { affectedRows?: number })?.affectedRows ?? 0;
  return affected;
};

/** Lists the administration records, newest scheduled time first. */
export const listMedicationAdministrations = async (
  filters: MedicationAdministrationFilters = {}
): Promise<MedicationAdministrationRecord[]> => {
  await markOverdueAdministrations();

  const where: string[] = [];
  const params: unknown[] = [];

  // The records are the patient's, and the patient belongs to a hospital. A
  // caller is confined to the records of their own hospital.
  if (filters.hospitalId !== undefined) {
    where.push('p.hospital_id = ?');
    params.push(filters.hospitalId);
  }

  if (filters.patientId) {
    where.push('ma.patient_id = ?');
    params.push(filters.patientId);
  }

  if (filters.assignedStaffId) {
    where.push('ma.assigned_staff_id = ?');
    params.push(filters.assignedStaffId);
  }

  if (filters.status) {
    where.push(
      `(CASE WHEN ma.status = 'pending' AND ma.scheduled_time < NOW() THEN 'overdue' ELSE ma.status END) = ?`
    );
    params.push(filters.status);
  }

  if (filters.date) {
    const dayStart = `${filters.date} 00:00:00`;
    where.push('ma.scheduled_time >= ? AND ma.scheduled_time < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(dayStart, dayStart);
  }

  const limit = Math.min(Math.max(Number(filters.limit ?? 200) || 200, 1), 1000);
  params.push(limit);

  const sql = `${SELECT_RECORD}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ma.scheduled_time DESC, ma.id DESC
    LIMIT ?`;

  const [rows] = await pool.query(sql, params);
  return rows as MedicationAdministrationRecord[];
};

/** Reads a single administration record, or null when it does not exist. */
export const getMedicationAdministration = async (
  id: number,
  hospitalId?: number | null
): Promise<MedicationAdministrationRecord | null> => {
  const scope = hospitalId === undefined ? '' : ' AND p.hospital_id = ?';
  const params = hospitalId === undefined ? [id] : [id, hospitalId];
  const [rows] = await pool.query(`${SELECT_RECORD} WHERE ma.id = ?${scope} LIMIT 1`, params);
  const rows_ = rows as MedicationAdministrationRecord[];
  return rows_.length ? rows_[0] : null;
};

/**
 * The data the schedule form needs: the patients that can be dosed and the
 * staff a dose can be assigned to.
 */
export const getMedicationAdministrationOptions = async (
  hospitalId?: number | null
): Promise<MedicationAdministrationOptions> => {
  // The schedule form offers the patients of the caller's own hospital and
  // the staff of that hospital, and nobody else's.
  const scope = hospitalId === undefined ? '' : ' AND hospital_id = ?';
  const params = hospitalId === undefined ? [] : [hospitalId];

  const [patientRows] = await pool.query(
    `SELECT id AS patientId, patient_id AS patientCode,
            CONCAT(first_name, ' ', last_name) AS patientName, hospital_id AS hospitalId
     FROM patients
     WHERE status = 'active'${scope}
     ORDER BY last_name, first_name
     LIMIT 500`,
    params
  );

  const [staffRows] = await pool.query(
    `SELECT id AS staffId, staff_id AS staffCode,
            CONCAT(first_name, ' ', last_name) AS staffName, role, user_id AS userId, hospital_id AS hospitalId
     FROM staff
     WHERE status = 'active'${scope}
     ORDER BY last_name, first_name
     LIMIT 500`,
    params
  );

  return {
    patients: patientRows as MedicationAdministrationOptions['patients'],
    staff: staffRows as MedicationAdministrationOptions['staff'],
  };
};

interface PatientRow extends RowDataPacket {
  id: number;
  patient_id: string;
  first_name: string;
  last_name: string;
  hospital_id: number | null;
}

/** Resolves a patient by primary key, accepting the business code as well. */
const resolvePatient = async (
  executor: Pick<PoolConnection, 'query'>,
  patientId: number
): Promise<PatientRow> => {
  const [rows] = await executor.query(
    'SELECT id, patient_id, first_name, last_name, hospital_id FROM patients WHERE id = ? LIMIT 1',
    [patientId]
  );
  const patient = (rows as PatientRow[])[0];
  if (!patient) {
    throw new MedicationAdministrationError(`Patient ${patientId} was not found`, 404);
  }
  return patient;
};

interface MedicineRow extends RowDataPacket {
  id: string;
  medicine_name: string;
  stock_level: number | null;
}

const resolveMedicine = async (
  executor: Pick<PoolConnection, 'query'>,
  medicineId: string
): Promise<MedicineRow> => {
  const [rows] = await executor.query(
    'SELECT id, medicine_name, stock_level FROM medicines_inventory WHERE id = ? LIMIT 1',
    [medicineId]
  );
  const medicine = (rows as MedicineRow[])[0];
  if (!medicine) {
    throw new MedicationAdministrationError(`Medicine ${medicineId} was not found`, 404);
  }
  return medicine;
};

interface StaffRow extends RowDataPacket {
  id: number;
  first_name: string;
  last_name: string;
}

const resolveStaff = async (
  executor: Pick<PoolConnection, 'query'>,
  staffId: number
): Promise<StaffRow> => {
  const [rows] = await executor.query(
    'SELECT id, first_name, last_name FROM staff WHERE id = ? LIMIT 1',
    [staffId]
  );
  const staff = (rows as StaffRow[])[0];
  if (!staff) {
    throw new MedicationAdministrationError(`Staff member ${staffId} was not found`, 404);
  }
  return staff;
};

export interface CreateMedicationAdministrationInput {
  patientId: number;
  medicineId: string;
  dosage: string;
  scheduledTime: string;
  assignedStaffId?: number | null;
  criticalNotes?: string | null;
  /** The hospital the record is confined to. Undefined means no confinement. */
  hospitalId?: number | null;
}

/**
 * The hospital the record's patient belongs to, refused when it is another.
 *
 * A record is reached by its own number, and a number is not a secret. The
 * record therefore says whose it is, and a record that belongs to another
 * hospital is not found.
 */
const assertRecordHospital = async (
  id: number,
  hospitalId: number | null | undefined
): Promise<void> => {
  if (hospitalId === undefined) return;
  const [rows] = await pool.query(
    `SELECT p.hospital_id AS hospitalId
       FROM medication_administrations ma
       JOIN patients p ON p.id = ma.patient_id
      WHERE ma.id = ?
      LIMIT 1`,
    [id]
  );
  const row = (rows as any[])[0];
  if (!row || Number(row.hospitalId) !== Number(hospitalId)) {
    throw new MedicationAdministrationError('Medication administration not found', 404);
  }
};

/** Schedules a dose. The medicine name is resolved from the inventory. */
export const createMedicationAdministration = async (
  input: CreateMedicationAdministrationInput
): Promise<MedicationAdministrationRecord> => {
  const scheduled = parseDateTime(input.scheduledTime);
  if (!scheduled) {
    throw new MedicationAdministrationError('scheduledTime must be a valid date', 400);
  }

  const patient = await resolvePatient(pool, input.patientId);
  if (input.hospitalId !== undefined && Number((patient as any).hospital_id) !== Number(input.hospitalId)) {
    throw new MedicationAdministrationError(`Patient ${input.patientId} was not found`, 404);
  }
  const medicine = await resolveMedicine(pool, input.medicineId);

  let assignedStaffName: string | null = null;
  if (input.assignedStaffId) {
    const staff = await resolveStaff(pool, input.assignedStaffId);
    assignedStaffName = `${staff.first_name} ${staff.last_name}`;
  }

  const [result] = await pool.query(
    `INSERT INTO medication_administrations
       (patient_id, medicine_id, medicine_name, dosage, scheduled_time, status,
        assigned_staff_id, assigned_staff_name, critical_notes)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      patient.id,
      medicine.id,
      medicine.medicine_name,
      input.dosage,
      toMysqlDateTime(scheduled),
      input.assignedStaffId ?? null,
      assignedStaffName,
      input.criticalNotes ?? null,
    ]
  );

  const id = Number((result as { insertId: number }).insertId);
  const record = await getMedicationAdministration(id);
  if (!record) {
    throw new MedicationAdministrationError('Failed to create the administration record', 500);
  }
  return record;
};

export interface UpdateMedicationAdministrationInput {
  status?: MedicationAdministrationStatus | null;
  criticalNotes?: string | null;
  assignedStaffId?: number | null;
  dosage?: string | null;
  scheduledTime?: string | null;
}

/**
 * Updates the mutable parts of a record.
 *
 * The `administered` status is deliberately NOT settable here: it is the
 * sign-off action, and it is the only path that moves stock. Letting it be
 * set through the generic update would create records that claim a dose was
 * given while the inventory still shows the full quantity.
 */
export const updateMedicationAdministration = async (
  id: number,
  input: UpdateMedicationAdministrationInput,
  hospitalId?: number | null
): Promise<MedicationAdministrationRecord> => {
  await assertRecordHospital(id, hospitalId);
  const existing = await getMedicationAdministration(id);
  if (!existing) {
    throw new MedicationAdministrationError('Medication administration not found', 404);
  }

  if (input.status === 'administered') {
    throw new MedicationAdministrationError(
      'Use the sign-off endpoint to mark a dose as administered',
      400
    );
  }

  // A signed off dose has already moved the stock. Reopening it would let a
  // second sign-off decrement the inventory again, so the status of an
  // administered record is frozen.
  if (existing.status === 'administered' && input.status) {
    throw new MedicationAdministrationError(
      'An administered dose cannot be reopened',
      400
    );
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.status !== undefined && input.status !== null) {
    sets.push('status = ?');
    params.push(input.status);
  }

  if (input.criticalNotes !== undefined) {
    sets.push('critical_notes = ?');
    params.push(input.criticalNotes);
  }

  if (input.dosage !== undefined && input.dosage !== null) {
    sets.push('dosage = ?');
    params.push(input.dosage);
  }

  if (input.scheduledTime !== undefined && input.scheduledTime !== null) {
    const scheduled = parseDateTime(input.scheduledTime);
    if (!scheduled) {
      throw new MedicationAdministrationError('scheduledTime must be a valid date', 400);
    }
    sets.push('scheduled_time = ?');
    params.push(toMysqlDateTime(scheduled));
  }

  if (input.assignedStaffId !== undefined) {
    if (input.assignedStaffId === null) {
      sets.push('assigned_staff_id = NULL');
      sets.push('assigned_staff_name = NULL');
    } else {
      const staff = await resolveStaff(pool, input.assignedStaffId);
      sets.push('assigned_staff_id = ?');
      sets.push('assigned_staff_name = ?');
      params.push(staff.id, `${staff.first_name} ${staff.last_name}`);
    }
  }

  if (sets.length) {
    params.push(id);
    await pool.query(
      `UPDATE medication_administrations SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
  }

  const record = await getMedicationAdministration(id);
  if (!record) {
    throw new MedicationAdministrationError('Medication administration not found', 404);
  }
  return record;
};

/** Removes a record. */
export const deleteMedicationAdministration = async (
  id: number,
  hospitalId?: number | null
): Promise<void> => {
  await assertRecordHospital(id, hospitalId);
  const [result] = await pool.query('DELETE FROM medication_administrations WHERE id = ?', [id]);
  const affected = (result as { affectedRows?: number })?.affectedRows ?? 0;
  if (!affected) {
    throw new MedicationAdministrationError('Medication administration not found', 404);
  }
};

export interface SignOffResult {
  record: MedicationAdministrationRecord;
  quantity: number;
  stockAfter: number;
}

/**
 * Records that a dose was given and moves the stock.
 *
 * Everything happens in one transaction: the administration row is locked,
 * the inventory row is locked, the stock is decremented and the record is
 * marked administered. The stock is REFUSED, not clamped, when there is not
 * enough of the medicine on the shelf -- a sign-off that would drive the
 * inventory negative is rejected and the whole transaction is rolled back, so
 * the administration stays pending and the clinical picture stays true.
 */
export const signOffMedicationAdministration = async (
  id: number,
  actorId: number | null,
  requestedQuantity?: number | null,
  hospitalId?: number | null
): Promise<SignOffResult> => {
  let connection: PoolConnection | null = null;
  let committed = false;

  try {
    await assertRecordHospital(id, hospitalId);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, patient_id, medicine_id, medicine_name, dosage, status, scheduled_time
       FROM medication_administrations
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );
    const record = (rows as RowDataPacket[])[0];
    if (!record) {
      throw new MedicationAdministrationError('Medication administration not found', 404);
    }
    if (record.status === 'administered') {
      throw new MedicationAdministrationError(
        'This administration has already been signed off',
        409
      );
    }
    if (!record.medicine_id) {
      throw new MedicationAdministrationError(
        'Cannot sign off an administration without a medicine to decrement',
        400
      );
    }

    // The quantity comes from the request, then from the record, and only
    // then from the dosage text. Parsing the text is the last resort
    // because a dose written in words ("one tablet") has no number in it.
    const quantity =
      requestedQuantity && Number(requestedQuantity) > 0
        ? Math.trunc(Number(requestedQuantity))
        : record.quantity && Number(record.quantity) > 0
          ? Math.trunc(Number(record.quantity))
          : parseDosageQuantity(record.dosage);

    const [stockRows] = await connection.query(
      'SELECT id, stock_level FROM medicines_inventory WHERE id = ? FOR UPDATE',
      [record.medicine_id]
    );
    const stock = (stockRows as RowDataPacket[])[0];
    if (!stock) {
      throw new MedicationAdministrationError(
        `Medicine ${record.medicine_id} was not found in the inventory`,
        404
      );
    }

    const current = Number(stock.stock_level ?? 0);
    if (current < quantity) {
      throw new MedicationAdministrationError(
        `Insufficient stock for ${record.medicine_name}: ${current} unit(s) available, ${quantity} required`,
        409
      );
    }

    await connection.query(
      'UPDATE medicines_inventory SET stock_level = stock_level - ? WHERE id = ?',
      [quantity, record.medicine_id]
    );

    await connection.query(
      `UPDATE medication_administrations
       SET status = 'administered', administered_at = NOW(), administered_by = ?
       WHERE id = ?`,
      [actorId, id]
    );

    await connection.commit();
    committed = true;

    const updated = await getMedicationAdministration(id);
    if (!updated) {
      throw new MedicationAdministrationError('Medication administration not found', 404);
    }

    return { record: updated, quantity, stockAfter: current - quantity };
  } catch (error) {
    if (connection && !committed) {
      await connection.rollback().catch(() => undefined);
    }
    throw error;
  } finally {
    connection?.release();
  }
};
