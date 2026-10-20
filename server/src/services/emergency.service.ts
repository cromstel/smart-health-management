/**
 * Emergency triage board and ER bed state.
 *
 * The emergency board used to be two hardcoded arrays in the browser
 * (src/components/emergency/EmergencyModeModule.tsx): three invented patients
 * and six invented bays. Nothing was persisted, so a bed allocation vanished
 * on reload and a code-blue broadcast was a toast message that contacted
 * nobody. This module is the single authority for the board state:
 *
 * - `emergency_beds` holds the physical bay list and who is in it.
 * - `emergency_admissions` holds the active episode of care.
 *
 * Invariants this module maintains:
 *
 * 1. A bed that is `occupied` points at exactly one patient
 *    (`emergency_beds.patient_id`) and at the active admission of that
 *    patient (`emergency_admissions.bed_id`). Both are written in the same
 *    transaction, so the two tables cannot drift apart.
 * 2. A bed is never handed to a second patient while it is occupied; that is
 *    refused with a 409 rather than silently reassigned.
 * 3. Releasing a bed (or discharging a patient) clears the admission link.
 *    A bed that a patient has just left goes to `cleaning`, not straight back
 *    to `available`: it has to be turned over before the next patient.
 * 4. A patient has at most one active admission. Admitting a patient who is
 *    already on the board is refused instead of producing a second row.
 *
 * Display formatting (blood pressure strings, "8 mins ago", title-case bed
 * status) is deliberately NOT done here: the API returns raw values and the
 * browser renders them, so there is exactly one place that decides how a
 * value looks.
 */
import pool from '../config/database.js';
import { decrypt } from '../utils/encryption.js';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type TriageLevel = 'RED' | 'AMBER' | 'GREEN' | 'YELLOW';
export type BedStatus = 'occupied' | 'available' | 'cleaning';
export type AdmissionStatus = 'admitted' | 'discharged' | 'deceased';

export const TRIAGE_LEVELS: readonly TriageLevel[] = ['RED', 'AMBER', 'GREEN', 'YELLOW'];
export const BED_STATUSES: readonly BedStatus[] = ['occupied', 'available', 'cleaning'];

/**
 * The bays a fresh install starts with. `id` is the primary key of
 * `emergency_beds` (VARCHAR(32)), `label` is what the board shows.
 */
const DEFAULT_BEDS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'ER-BAY-01', label: 'Bay 01 (Trauma)' },
  { id: 'ER-BAY-02', label: 'Bay 02 (Resus)' },
  { id: 'ER-BAY-03', label: 'Bay 03 (Trauma)' },
  { id: 'ER-BAY-04', label: 'Bay 04 (General)' },
  { id: 'ER-BAY-05', label: 'Bay 05 (General)' },
  { id: 'ER-BAY-06', label: 'Bay 06 (Isolation)' },
];

/**
 * Fallback trauma hotline. Overridable per deployment with the
 * `EMERGENCY_HOTLINE` environment variable, or per installation with the
 * `emergency.hotline` entry in the `settings` table.
 */
const DEFAULT_HOTLINE = 'Ext. 911 / 4402';

/**
 * Error type for the business rules. The controller turns `status` into the
 * HTTP status code, so the service never touches the HTTP layer.
 */
export class EmergencyServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'EmergencyServiceError';
    this.status = status;
    this.code = code;
  }
}

export interface BedRecord {
  id: string;
  label: string;
  /** Lower-case database enum. The browser renders the title-case label. */
  status: BedStatus;
  /** `patients.patient_id` of the occupant, e.g. "P-1002". */
  patient: string | null;
  patientName: string | null;
  triage: string | null;
}

export interface BoardPatient {
  /** `patients.patient_id` (the human readable code, e.g. "P-1002"). */
  id: string;
  /** `patients.id`, the numeric key the other tables reference. */
  patientId: number;
  /** `emergency_admissions.id`. */
  admissionId: number;
  name: string;
  age: number | null;
  gender: string | null;
  triageLevel: TriageLevel;
  /** Free-text presenting condition (stored in `condition_note`). */
  condition: string | null;
  /** Bed id, e.g. "ER-BAY-01". */
  bed: string | null;
  bedLabel: string | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  spo2: number | null;
  /** Local ISO timestamp of the admission, e.g. "2026-10-20T09:15:00". */
  admittedAt: string;
}

export interface AdmissionRecord {
  id: number;
  patientId: number;
  patientCode: string;
  patientName: string;
  triageLevel: TriageLevel;
  condition: string | null;
  bedId: string | null;
  bedLabel: string | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  spo2: number | null;
  status: AdmissionStatus;
  admittedAt: string;
  dischargedAt: string | null;
}

export interface PatientOption {
  id: number;
  patientId: string;
  name: string;
  age: number | null;
  gender: string | null;
}

export interface TriageBoard {
  patients: BoardPatient[];
  beds: BedRecord[];
  hotline: string;
  generatedAt: string;
}

export interface UpdateBedInput {
  id: string;
  status: BedStatus;
  patientId?: string | null;
  triage?: TriageLevel | null;
}

export interface CreateAdmissionInput {
  patientId: string;
  triageLevel: TriageLevel;
  condition?: string | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRate?: number | null;
  temperature?: number | null;
  respiratoryRate?: number | null;
  spo2?: number | null;
  bedId?: string | null;
  /** The clinician who took the readings, when known. */
  recordedBy?: number | null;
  recordedByName?: string | null;
}

export interface UpdateAdmissionInput {
  triageLevel?: TriageLevel | null;
  condition?: string | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRate?: number | null;
  spo2?: number | null;
}

export interface CodeBlueInput {
  patientId?: string | null;
  note?: string | null;
}

export interface CodeBlueResult {
  /** Id of the `audit_logs` row that records the event. */
  auditId: number;
  action: 'CODE_BLUE_BROADCAST';
  module: 'emergency';
  /** The patient the broadcast was for, when one was given. */
  patientId: string | null;
  recordedAt: string;
  recordedBy: string | null;
  /**
   * Always false: this deployment has no outbound emergency-service
   * integration, so no ambulance, dispatcher or paging gateway was
   * contacted. The response must not pretend otherwise.
   */
  dispatched: false;
  integration: 'none';
  message: string;
  hotline: string;
}

interface PatientRef {
  id: number;
  code: string;
  name: string;
}

type QueryFn = (sql: string, values: unknown[]) => Promise<RowDataPacket[]>;

const poolQuery: QueryFn = async (sql, values) => {
  const [rows] = await pool.query<RowDataPacket[]>(sql, values);
  return rows;
};

const connectionQuery = (connection: PoolConnection): QueryFn => async (sql, values) => {
  const [rows] = await connection.query<RowDataPacket[]>(sql, values);
  return rows;
};

/**
 * Runs `work` inside a transaction.
 *
 * The bed and the admission are two rows in two tables, and they have to
 * agree with each other afterwards. A single transaction is what makes that
 * possible: either both are written or neither is.
 */
const withTransaction = async <T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Renders a MySQL DATETIME as a local-time ISO string without a timezone
 * suffix ("2026-10-20T09:15:00"). A local time without an offset is parsed
 * as local time by `new Date()`, so the browser shows the wall clock the
 * server recorded instead of a shifted one.
 */
export function toLocalIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(
      value.getHours()
    )}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (match) return `${match[1]}T${match[2]}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : toLocalIso(parsed);
}

function mapPatient(row: RowDataPacket): PatientRef {
  return {
    id: Number(row.id),
    code: String(row.patient_id),
    name: patientName(row),
  };
}

/**
 * The display name of a patient.
 *
 * `patients.first_name` and `patients.last_name` are stored encrypted (the
 * patient controller writes them through `utils/encryption`), so reading the
 * column raw returns the ciphertext. Rows that were inserted as plain text
 * (the seed, and rows written while encryption was not configured) are
 * recognised by their shape and passed through unchanged -- the same rule
 * the patient controller uses.
 */
function decryptField(value: string): string {
  if (!/^[0-9a-f]+$/i.test(value) || value.length < 32 || value.length % 2 !== 0) return value;
  const decrypted = decrypt(value);
  return decrypted ?? value;
}

function patientName(row: RowDataPacket): string {
  const first = row.first_name ? decryptField(String(row.first_name)) : '';
  const last = row.last_name ? decryptField(String(row.last_name)) : '';
  return `${first} ${last}`.trim();
}

/**
 * Resolves a patient reference to a row. Accepts the human readable
 * `patients.patient_id` ("P-1002") or the numeric `patients.id`.
 */
async function findPatient(query: QueryFn, reference: string): Promise<PatientRef | null> {
  const raw = String(reference ?? '').trim();
  if (!raw) return null;

  const byCode = await query(
    'SELECT id, patient_id, first_name, last_name FROM patients WHERE patient_id = ? LIMIT 1',
    [raw]
  );
  if (byCode.length > 0) return mapPatient(byCode[0]);

  if (/^\d+$/.test(raw)) {
    const byId = await query(
      'SELECT id, patient_id, first_name, last_name FROM patients WHERE id = ? LIMIT 1',
      [Number(raw)]
    );
    if (byId.length > 0) return mapPatient(byId[0]);
  }

  return null;
}

function mapBedRow(row: RowDataPacket): BedRecord {
  const hasPatient = row.patient_code !== null && row.patient_code !== undefined;
  return {
    id: String(row.id),
    label: String(row.label),
    status: String(row.status) as BedStatus,
    patient: hasPatient ? String(row.patient_code) : null,
    patientName: hasPatient ? patientName(row) : null,
    triage: row.triage_level === null || row.triage_level === undefined ? null : String(row.triage_level),
  };
}

function mapAdmissionRow(row: RowDataPacket): AdmissionRecord {
  return {
    id: Number(row.admission_id),
    patientId: Number(row.patient_id),
    patientCode: String(row.patient_code),
    patientName: patientName(row),
    triageLevel: String(row.triage_level) as TriageLevel,
    condition: row.condition_note === null || row.condition_note === undefined ? null : String(row.condition_note),
    bedId: row.bed_id === null || row.bed_id === undefined ? null : String(row.bed_id),
    bedLabel: row.bed_label === null || row.bed_label === undefined ? null : String(row.bed_label),
    systolicBp: row.systolic_bp === null || row.systolic_bp === undefined ? null : Number(row.systolic_bp),
    diastolicBp:
      row.diastolic_bp === null || row.diastolic_bp === undefined ? null : Number(row.diastolic_bp),
    heartRate: row.heart_rate === null || row.heart_rate === undefined ? null : Number(row.heart_rate),
    spo2: row.spo2 === null || row.spo2 === undefined ? null : Number(row.spo2),
    status: String(row.status) as AdmissionStatus,
    admittedAt: toLocalIso(row.admitted_at),
    dischargedAt: row.discharged_at ? toLocalIso(row.discharged_at) : null,
  };
}

const ADMISSION_SELECT = `
  SELECT
    a.id AS admission_id,
    a.patient_id,
    a.triage_level,
    a.condition_note,
    a.bed_id,
    a.systolic_bp,
    a.diastolic_bp,
    a.heart_rate,
    a.spo2,
    a.status,
    a.admitted_at,
    a.discharged_at,
    p.patient_id AS patient_code,
    p.first_name,
    p.last_name,
    b.label AS bed_label
  FROM emergency_admissions a
  JOIN patients p ON p.id = a.patient_id
  LEFT JOIN emergency_beds b ON b.id = a.bed_id
`;

/**
 * Creates the default bay list when the table is empty.
 *
 * Idempotent (`INSERT IGNORE`) and cheap: this only runs when the bed list
 * came back empty, so it happens on a fresh install and after the table was
 * emptied underneath a running server -- never on an ordinary request.
 */
export async function ensureDefaultBeds(): Promise<void> {
  const rows = await poolQuery('SELECT COUNT(*) AS total FROM emergency_beds', []);
  const total = Number((rows[0] as RowDataPacket | undefined)?.total ?? 0);
  if (total > 0) return;

  const values = DEFAULT_BEDS.map((bed) => [bed.id, bed.label]);
  await pool.query('INSERT IGNORE INTO emergency_beds (id, label) VALUES ?', [values]);
}

const BED_SELECT = `
  SELECT b.id, b.label, b.status, b.triage_level, b.patient_id,
         p.patient_id AS patient_code, p.first_name, p.last_name
    FROM emergency_beds b
    LEFT JOIN patients p ON p.id = b.patient_id
`;

/** The current bed list, with the occupant of every bay. */
export async function listBeds(): Promise<BedRecord[]> {
  let rows = await poolQuery(`${BED_SELECT} ORDER BY b.id`, []);

  if (rows.length === 0) {
    // A fresh install, or a table that was emptied underneath this server:
    // put the default bays back so the board stays usable.
    await ensureDefaultBeds();
    rows = await poolQuery(`${BED_SELECT} ORDER BY b.id`, []);
  }

  return rows.map(mapBedRow);
}

async function getBedById(id: string): Promise<BedRecord | null> {
  const rows = await poolQuery(`${BED_SELECT} WHERE b.id = ? LIMIT 1`, [id]);
  return rows.length > 0 ? mapBedRow(rows[0]) : null;
}

/**
 * The active admissions, joined to the patient and to the latest vitals
 * reading of that patient.
 *
 * The vitals join picks the most recent reading per patient with a window
 * function, so the board is one query instead of one query per patient. A
 * patient without a reading gets nulls -- the board never invents a number.
 */
export async function listActiveAdmissions(): Promise<BoardPatient[]> {
  const rows = await poolQuery(
    `SELECT
        a.id AS admission_id,
        a.patient_id,
        a.triage_level,
        a.condition_note,
        a.bed_id,
        a.admitted_at,
        p.patient_id AS patient_code,
        p.first_name,
        p.last_name,
        p.age,
        p.gender,
        b.label AS bed_label,
        vit.systolic_bp,
        vit.diastolic_bp,
        vit.heart_rate,
        vit.oxygen_saturation
      FROM emergency_admissions a
      JOIN patients p ON p.id = a.patient_id
      LEFT JOIN emergency_beds b ON b.id = a.bed_id
      LEFT JOIN (
        SELECT patient_id, systolic_bp, diastolic_bp, heart_rate, oxygen_saturation
          FROM (
            SELECT patient_id,
                   systolic_bp,
                   diastolic_bp,
                   heart_rate,
                   oxygen_saturation,
                   ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY recorded_at DESC, id DESC) AS rn
              FROM vitals
          ) ranked
         WHERE ranked.rn = 1
      ) vit ON vit.patient_id = a.patient_id
      WHERE a.status = 'admitted'
      ORDER BY FIELD(a.triage_level, 'RED', 'AMBER', 'YELLOW', 'GREEN'), a.admitted_at ASC, a.id ASC`,
    []
  );

  return rows.map((row) => ({
    id: String(row.patient_code),
    patientId: Number(row.patient_id),
    admissionId: Number(row.admission_id),
    name: patientName(row),
    age: row.age === null || row.age === undefined ? null : Number(row.age),
    gender: row.gender === null || row.gender === undefined ? null : String(row.gender),
    triageLevel: String(row.triage_level) as TriageLevel,
    condition:
      row.condition_note === null || row.condition_note === undefined ? null : String(row.condition_note),
    bed: row.bed_id === null || row.bed_id === undefined ? null : String(row.bed_id),
    bedLabel: row.bed_label === null || row.bed_label === undefined ? null : String(row.bed_label),
    systolicBp: row.systolic_bp === null || row.systolic_bp === undefined ? null : Number(row.systolic_bp),
    diastolicBp:
      row.diastolic_bp === null || row.diastolic_bp === undefined ? null : Number(row.diastolic_bp),
    heartRate: row.heart_rate === null || row.heart_rate === undefined ? null : Number(row.heart_rate),
    spo2:
      row.oxygen_saturation === null || row.oxygen_saturation === undefined
        ? null
        : Number(row.oxygen_saturation),
    admittedAt: toLocalIso(row.admitted_at),
  }));
}

/**
 * The trauma hotline shown on the board.
 *
 * Order: the `emergency.hotline` setting (per installation), then the
 * `EMERGENCY_HOTLINE` environment variable (per deployment), then the
 * built-in default.
 */
export async function getHotline(): Promise<string> {
  try {
    const rows = await poolQuery(
      "SELECT setting_value FROM settings WHERE setting_key = 'emergency.hotline' LIMIT 1",
      []
    );
    const value = rows[0]?.setting_value;
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  } catch {
    // The settings table is optional for this module: fall through.
  }
  const fromEnv = process.env.EMERGENCY_HOTLINE;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv.trim();
  return DEFAULT_HOTLINE;
}

/** The whole board in one response: active admissions plus the bed list. */
export async function getTriageBoard(): Promise<TriageBoard> {
  const [patients, beds, hotline] = await Promise.all([
    listActiveAdmissions(),
    listBeds(),
    getHotline(),
  ]);
  return { patients, beds, hotline, generatedAt: toLocalIso(new Date()) };
}

/**
 * The options the admit form needs: the real patient list and the beds.
 *
 * The patient list is scoped to the caller's hospital when the caller has
 * one. The hospital in the token is the hospital *code* ("HOSP-001"), so it
 * is resolved to the numeric id the `patients` table stores.
 */
export async function listAdmissionOptions(hospitalCode?: string | null): Promise<{
  patients: PatientOption[];
  beds: BedRecord[];
  hotline: string;
}> {
  const params: unknown[] = [];
  let hospitalFilter = '';
  const code = String(hospitalCode ?? '').trim();
  if (code) {
    hospitalFilter = ' AND p.hospital_id = (SELECT h.id FROM hospitals h WHERE h.hospital_id = ?)';
    params.push(code);
  }

  const rows = await poolQuery(
    `SELECT p.id, p.patient_id, p.first_name, p.last_name, p.age, p.gender
       FROM patients p
      WHERE p.status = 'active'${hospitalFilter}
      ORDER BY p.last_name, p.first_name
      LIMIT 500`,
    params
  );

  const patients: PatientOption[] = rows.map((row) => ({
    id: Number(row.id),
    patientId: String(row.patient_id),
    name: patientName(row),
    age: row.age === null || row.age === undefined ? null : Number(row.age),
    gender: row.gender === null || row.gender === undefined ? null : String(row.gender),
  }));

  const beds = await listBeds();
  const hotline = await getHotline();
  return { patients, beds, hotline };
}

/**
 * Changes the state of a bed and keeps `emergency_admissions.bed_id` in
 * step with it, inside one transaction.
 *
 * - `status: 'occupied'` allocates the bay. It needs `patientId`; the
 *   patient must have an active admission, and the bay must not already
 *   hold a different patient.
 * - `status: 'available' | 'cleaning'` releases the bay: the occupant is
 *   cleared and any admission that pointed at it is unlinked.
 */
export async function updateBed(input: UpdateBedInput): Promise<BedRecord> {
  const bedId = String(input.id ?? '').trim();
  if (!bedId) {
    throw new EmergencyServiceError('Bed id is required', 400, 'BED_ID_REQUIRED');
  }

  await withTransaction(async (connection) => {
    const query = connectionQuery(connection);

    const bedRows = await query(
      `SELECT id, label, status, triage_level, patient_id
         FROM emergency_beds
        WHERE id = ?
        FOR UPDATE`,
      [bedId]
    );
    if (bedRows.length === 0) {
      throw new EmergencyServiceError('Bed not found', 404, 'BED_NOT_FOUND');
    }
    const bed = bedRows[0];

    if (input.status === 'occupied') {
      const patient = await findPatient(query, String(input.patientId ?? ''));
      if (!patient) {
        throw new EmergencyServiceError('Patient not found', 404, 'PATIENT_NOT_FOUND');
      }
      if (bed.patient_id !== null && Number(bed.patient_id) !== patient.id) {
        throw new EmergencyServiceError(
          'Bed is already occupied by another patient',
          409,
          'BED_ALREADY_OCCUPIED'
        );
      }
      if (String(bed.status) === 'cleaning') {
        // A bay that is still being turned over is not ready for a patient.
        // It has to be released back to 'available' first.
        throw new EmergencyServiceError(
          'Bed is still being cleaned and cannot take a patient yet',
          409,
          'BED_NOT_READY'
        );
      }

      const admissionRows = await query(
        `SELECT id, bed_id, triage_level
           FROM emergency_admissions
          WHERE patient_id = ? AND status = 'admitted'
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE`,
        [patient.id]
      );
      if (admissionRows.length === 0) {
        throw new EmergencyServiceError(
          'Patient has no active admission to allocate a bed to',
          409,
          'NO_ACTIVE_ADMISSION'
        );
      }
      const admission = admissionRows[0];

      // Moving a patient to another bay frees the bay they came from, but it
      // still needs turnover, so it goes to `cleaning` rather than straight
      // back into circulation.
      if (admission.bed_id && String(admission.bed_id) !== bedId) {
        await connection.query(
          `UPDATE emergency_beds
              SET status = 'cleaning', patient_id = NULL, triage_level = NULL
            WHERE id = ?`,
          [String(admission.bed_id)]
        );
      }

      await connection.query(
        `UPDATE emergency_beds
            SET status = 'occupied', patient_id = ?, triage_level = ?
          WHERE id = ?`,
        [patient.id, input.triage ?? String(admission.triage_level), bedId]
      );
      await connection.query('UPDATE emergency_admissions SET bed_id = ? WHERE id = ?', [
        bedId,
        Number(admission.id),
      ]);
    } else {
      await connection.query(
        `UPDATE emergency_beds
            SET status = ?, patient_id = NULL, triage_level = NULL
          WHERE id = ?`,
        [input.status, bedId]
      );
      await connection.query('UPDATE emergency_admissions SET bed_id = NULL WHERE bed_id = ?', [bedId]);
    }
  });

  const bed = await getBedById(bedId);
  if (!bed) {
    throw new EmergencyServiceError('Bed not found', 404, 'BED_NOT_FOUND');
  }
  return bed;
}

/**
 * Admits a patient: creates the active admission and, when a bay is given,
 * allocates it in the same transaction.
 */
export async function createAdmission(input: CreateAdmissionInput): Promise<AdmissionRecord> {
  const patient = await findPatient(poolQuery, String(input.patientId ?? ''));
  if (!patient) {
    throw new EmergencyServiceError('Patient not found', 404, 'PATIENT_NOT_FOUND');
  }

  const admissionId = await withTransaction(async (connection) => {
    const query = connectionQuery(connection);

    const activeRows = await query(
      `SELECT id FROM emergency_admissions
        WHERE patient_id = ? AND status = 'admitted'
        LIMIT 1
        FOR UPDATE`,
      [patient.id]
    );
    if (activeRows.length > 0) {
      throw new EmergencyServiceError(
        'Patient already has an active admission',
        409,
        'ALREADY_ADMITTED'
      );
    }

    const bedId = input.bedId ? String(input.bedId).trim() : null;
    if (bedId) {
      const bedRows = await query(
        'SELECT id, patient_id FROM emergency_beds WHERE id = ? FOR UPDATE',
        [bedId]
      );
      if (bedRows.length === 0) {
        throw new EmergencyServiceError('Bed not found', 404, 'BED_NOT_FOUND');
      }
      const bed = bedRows[0];
      if (bed.patient_id !== null && Number(bed.patient_id) !== patient.id) {
        throw new EmergencyServiceError(
          'Bed is already occupied by another patient',
          409,
          'BED_ALREADY_OCCUPIED'
        );
      }
    }

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO emergency_admissions
        (patient_id, triage_level, condition_note, bed_id, systolic_bp, diastolic_bp,
         heart_rate, spo2, status, admitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admitted', NOW())`,
      [
        patient.id,
        input.triageLevel,
        input.condition ? String(input.condition).slice(0, 255) : null,
        bedId,
        input.systolicBp ?? null,
        input.diastolicBp ?? null,
        input.heartRate ?? null,
        input.spo2 ?? null,
      ]
    );

    if (bedId) {
      await connection.query(
        `UPDATE emergency_beds
            SET status = 'occupied', patient_id = ?, triage_level = ?
          WHERE id = ?`,
        [patient.id, input.triageLevel, bedId]
      );
    }

    // The readings taken at admission are recorded as a vitals entry, so the
    // board and the clinical record show the same numbers. Without this the
    // board showed no vitals for a patient whose admission had them.
    const hasVitals =
      input.systolicBp != null &&
      input.diastolicBp != null &&
      input.heartRate != null &&
      input.temperature != null;
    if (hasVitals) {
      await connection.query(
        `INSERT INTO vitals
            (patient_id, recorded_by, recorded_by_name, recorded_at, systolic_bp,
             diastolic_bp, heart_rate, temperature, respiratory_rate,
             oxygen_saturation, notes, status)
           VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patient.id,
          input.recordedBy ?? null,
          input.recordedByName ?? null,
          input.systolicBp,
          input.diastolicBp,
          input.heartRate,
          input.temperature,
          input.respiratoryRate ?? null,
          input.spo2 ?? null,
          `Emergency admission (${input.triageLevel})${input.condition ? `: ${input.condition}` : ''}`,
          input.triageLevel === 'RED' ? 'critical' : 'elevated',
        ]
      );
    }

    return result.insertId;
  });

  const admission = await getAdmissionById(admissionId);
  if (!admission) {
    throw new EmergencyServiceError('Admission could not be read back', 500, 'ADMISSION_READ_BACK_FAILED');
  }
  return admission;
}

/** Reads a single admission. */
export async function getAdmissionById(id: number | string): Promise<AdmissionRecord | null> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  const rows = await poolQuery(`${ADMISSION_SELECT} WHERE a.id = ? LIMIT 1`, [numericId]);
  return rows.length > 0 ? mapAdmissionRow(rows[0]) : null;
}

/**
 * Updates the triage level, the presenting condition or the recorded
 * vitals of an admission. Only the fields that are present are written.
 *
 * When the admission holds a bed, the bay's triage label follows, so the
 * bed matrix and the patient card never disagree.
 */
export async function updateAdmission(
  id: number | string,
  input: UpdateAdmissionInput
): Promise<AdmissionRecord> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new EmergencyServiceError('Invalid admission id', 400, 'INVALID_ADMISSION_ID');
  }

  await withTransaction(async (connection) => {
    const query = connectionQuery(connection);

    const existingRows = await query(
      `SELECT id, bed_id, status FROM emergency_admissions WHERE id = ? FOR UPDATE`,
      [numericId]
    );
    if (existingRows.length === 0) {
      throw new EmergencyServiceError('Admission not found', 404, 'ADMISSION_NOT_FOUND');
    }
    const existing = existingRows[0];

    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.triageLevel !== undefined && input.triageLevel !== null) {
      sets.push('triage_level = ?');
      params.push(input.triageLevel);
    }
    if (input.condition !== undefined) {
      sets.push('condition_note = ?');
      params.push(input.condition ? String(input.condition).slice(0, 255) : null);
    }
    if (input.systolicBp !== undefined) {
      sets.push('systolic_bp = ?');
      params.push(input.systolicBp ?? null);
    }
    if (input.diastolicBp !== undefined) {
      sets.push('diastolic_bp = ?');
      params.push(input.diastolicBp ?? null);
    }
    if (input.heartRate !== undefined) {
      sets.push('heart_rate = ?');
      params.push(input.heartRate ?? null);
    }
    if (input.spo2 !== undefined) {
      sets.push('spo2 = ?');
      params.push(input.spo2 ?? null);
    }

    if (sets.length > 0) {
      params.push(numericId);
      await connection.query(
        `UPDATE emergency_admissions SET ${sets.join(', ')} WHERE id = ?`,
        params
      );
    }

    if (input.triageLevel && existing.bed_id) {
      await connection.query('UPDATE emergency_beds SET triage_level = ? WHERE id = ?', [
        input.triageLevel,
        String(existing.bed_id),
      ]);
    }
  });

  const admission = await getAdmissionById(numericId);
  if (!admission) {
    throw new EmergencyServiceError('Admission not found', 404, 'ADMISSION_NOT_FOUND');
  }
  return admission;
}

/**
 * Discharges a patient: the admission is closed and the bay they were in
 * goes to `cleaning` (it has to be turned over before the next patient).
 */
export async function dischargeAdmission(id: number | string): Promise<{
  admission: AdmissionRecord;
  bed: BedRecord | null;
}> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new EmergencyServiceError('Invalid admission id', 400, 'INVALID_ADMISSION_ID');
  }

  const bedId = await withTransaction(async (connection) => {
    const query = connectionQuery(connection);

    const rows = await query(
      `SELECT id, bed_id, status FROM emergency_admissions WHERE id = ? FOR UPDATE`,
      [numericId]
    );
    if (rows.length === 0) {
      throw new EmergencyServiceError('Admission not found', 404, 'ADMISSION_NOT_FOUND');
    }
    const admission = rows[0];
    if (String(admission.status) !== 'admitted') {
      throw new EmergencyServiceError(
        'Admission is not active and cannot be discharged again',
        409,
        'ADMISSION_NOT_ACTIVE'
      );
    }

    const releasedBedId =
      admission.bed_id === null || admission.bed_id === undefined ? null : String(admission.bed_id);

    await connection.query(
      `UPDATE emergency_admissions
          SET status = 'discharged', discharged_at = NOW(), bed_id = NULL
        WHERE id = ?`,
      [numericId]
    );

    if (releasedBedId) {
      await connection.query(
        `UPDATE emergency_beds
            SET status = 'cleaning', patient_id = NULL, triage_level = NULL
          WHERE id = ?`,
        [releasedBedId]
      );
    }

    return releasedBedId;
  });

  const admission = await getAdmissionById(numericId);
  if (!admission) {
    throw new EmergencyServiceError('Admission not found', 404, 'ADMISSION_NOT_FOUND');
  }
  const bed = bedId ? await getBedById(bedId) : null;
  return { admission, bed };
}

/**
 * Records a code-blue broadcast.
 *
 * The event is written to `audit_logs` with the action
 * `CODE_BLUE_BROADCAST`, the module `emergency` and the patient code as the
 * record id, because a code blue is a clinical event that has to be
 * reconstructable afterwards.
 *
 * There is no outbound emergency-service integration in this deployment, so
 * nothing is dispatched and the result says exactly that: `dispatched` is
 * false and the message states that the clinical team has to be paged
 * manually. Reporting a dispatch that did not happen would be worse than
 * reporting none.
 */
export async function recordCodeBlue(
  input: CodeBlueInput,
  actor: { userId?: number | null; userName?: string | null; ipAddress?: string | null; userAgent?: string | null }
): Promise<CodeBlueResult> {
  let patientCode: string | null = null;

  const reference = String(input.patientId ?? '').trim();
  if (reference) {
    const patient = await findPatient(poolQuery, reference);
    if (!patient) {
      throw new EmergencyServiceError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    }
    patientCode = patient.code;
  }

  const payload = JSON.stringify({
    patientId: patientCode,
    note: input.note ? String(input.note).slice(0, 255) : null,
    source: 'emergency-board',
    dispatched: false,
  });

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO audit_logs
      (user_id, action, module, record_id, user_name, new_value, ip_address, user_agent)
     VALUES (?, 'CODE_BLUE_BROADCAST', 'emergency', ?, ?, ?, ?, ?)`,
    [
      actor.userId ?? null,
      patientCode,
      actor.userName ?? null,
      payload,
      actor.ipAddress ?? null,
      actor.userAgent ?? null,
    ]
  );

  const hotline = await getHotline();

  return {
    auditId: Number(result.insertId),
    action: 'CODE_BLUE_BROADCAST',
    module: 'emergency',
    patientId: patientCode,
    recordedAt: toLocalIso(new Date()),
    recordedBy: actor.userName ?? null,
    dispatched: false,
    integration: 'none',
    message:
      'Code blue recorded in the audit trail. No external emergency-service dispatch is configured on this deployment, so no ambulance or paging gateway was contacted: the resuscitation team has to be paged manually.',
    hotline,
  };
}

/**
 * The display name of the authenticated user, used as the audit attribution.
 */
export async function getActorName(userId?: number | null): Promise<string | null> {
  if (!userId) return null;
  const rows = await poolQuery('SELECT name FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows.length > 0 ? String(rows[0].name) : null;
}
