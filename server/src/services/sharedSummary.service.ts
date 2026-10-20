/**
 * Shared patient summary service.
 *
 * A share link is a single-purpose, time-limited bearer credential: the
 * recipient is not logged in, so the token itself is the authorisation. It is
 * generated with crypto.randomBytes (URL safe, 256 bits of entropy), stored
 * hashed-free but never logged, and expires after a configurable window.
 */
import crypto from 'crypto';
import pool from '../config/database.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { listVitals, resolvePatient } from './vitals.service.js';

export interface SharedAppointment {
  id: string;
  appointment_id: string;
  appointment_date: string;
  appointment_time: string;
  doctor_name: string;
  department: string;
  type: string;
  status: string;
  notes?: string;
}

export interface SharedSummaryPayload {
  patientId: string;
  patientName: string;
  expiresAt: string;
  appointments: SharedAppointment[];
  /**
   * The vitals readings the shared summary displays. They belong to the
   * shared patient only -- no other patient is ever included.
   */
  vitals: Awaited<ReturnType<typeof listVitals>>;
}

export interface CreatedShareLink {
  token: string;
  expiresAt: string;
  url: string;
}

const DEFAULT_TTL_HOURS = 24;
const MAX_TTL_HOURS = 168;

export function getShareTtlHours(): number {
  const raw = Number(process.env.SHARED_SUMMARY_TTL_HOURS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_HOURS;
  return Math.min(raw, MAX_TTL_HOURS);
}

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function formatTime(value: Date | string): string {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  const text = String(value);
  const match = text.match(/(\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : text;
}

function formatDate(value: Date | string): string {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const text = String(value);
  const match = text.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

/**
 * Create a share link for a patient.
 *
 * The patient is resolved from either the numeric id or the human readable
 * `patients.patient_id`, and the stored name always comes from the patient
 * row -- never from the request body.
 */
export async function createShareLink(
  patientRef: string,
  sharedBy?: number
): Promise<CreatedShareLink | null> {
  const patient = await resolvePatient(patientRef);
  if (!patient) return null;

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + getShareTtlHours() * 60 * 60 * 1000);

  await pool.query<ResultSetHeader>(
    `INSERT INTO shared_summaries (token, patient_id, patient_name, shared_by, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [token, patient.id, patient.patientName, sharedBy ?? null, expiresAt]
  );

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    url: `/shared/patient-summary/${token}`,
  };
}

/**
 * Read a shared summary by token.
 *
 * Returns null for an unknown, revoked or expired token. A successful read
 * increments `access_count` and stamps `last_accessed_at`.
 */
export async function readSharedSummary(
  token: string
): Promise<SharedSummaryPayload | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       s.id AS share_id,
       s.expires_at,
       s.patient_id,
       s.patient_name,
       p.patient_id AS patient_code,
       p.first_name,
       p.last_name
     FROM shared_summaries s
     JOIN patients p ON p.id = s.patient_id
     WHERE s.token = ? AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [token]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  const patientName =
    row.patient_name || `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();

  await pool.query(
    `UPDATE shared_summaries
     SET access_count = access_count + 1, last_accessed_at = NOW()
     WHERE id = ?`,
    [row.share_id]
  );

  const [apptRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       a.id,
       a.appointment_id,
       a.appointment_date,
       a.appointment_time,
       COALESCE(CONCAT(s.first_name, ' ', s.last_name), 'Unassigned') AS doctor_name,
       COALESCE(d.name, 'General') AS department,
       a.type,
       a.status,
       a.notes
     FROM appointments a
     LEFT JOIN staff s ON s.id = a.doctor_id
     LEFT JOIN departments d ON d.id = a.department_id
     WHERE a.patient_id = ?
       AND a.appointment_date >= CURDATE()
       AND a.status = 'scheduled'
     ORDER BY a.appointment_date ASC, a.appointment_time ASC
     LIMIT 20`,
    [row.patient_id]
  );

  const appointments: SharedAppointment[] = apptRows.map((appt: any) => {
    const item: SharedAppointment = {
      id: String(appt.id),
      appointment_id: appt.appointment_id,
      appointment_date: formatDate(appt.appointment_date),
      appointment_time: formatTime(appt.appointment_time),
      doctor_name: appt.doctor_name,
      department: appt.department,
      type: appt.type || 'Consultation',
      status: appt.status,
    };
    if (appt.notes) item.notes = appt.notes;
    return item;
  });

  const vitals = await listVitals({ patientRef: String(row.patient_id), limit: 20 });

  return {
    patientId: row.patient_code,
    patientName,
    expiresAt: toIso(row.expires_at),
    appointments,
    vitals,
  };
}

/**
 * Revoke a share link. Returns false when the token is unknown.
 */
export async function revokeShareLink(token: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE shared_summaries SET revoked_at = NOW() WHERE token = ? AND revoked_at IS NULL`,
    [token]
  );
  return result.affectedRows > 0;
}
