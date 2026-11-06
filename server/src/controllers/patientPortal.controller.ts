import { Response } from 'express';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * The patient portal.
 *
 * Every record here belongs to one hospital, and the caller only ever sees
 * their own. The hospital is resolved per request — never once at module
 * load — because the same process serves every tenant:
 *
 *  1. the subdomain the request arrived on (`req.hospitalId`, set by the
 *     subdomain resolver), when the portal is reached through a tenant
 *     address like `clinic.medicare.example.com`;
 *  2. otherwise the tenant scope carried by the session (`req.tenant`), so
 *     a patient who signs in on the main address still sees their own
 *     hospital's records.
 *
 * With neither, the request is refused: a portal that cannot say which
 * hospital it is showing must not guess.
 */
interface PortalRequest extends AuthRequest {
  /** The hospital the request's hostname resolved to, when it resolved. */
  hospitalId?: number | null;
}

/** The hospital this request is confined to, or null when it cannot be known. */
const resolveHospitalId = (req: PortalRequest): number | null => {
  if (typeof req.hospitalId === 'number' && Number.isSafeInteger(req.hospitalId) && req.hospitalId > 0) {
    return req.hospitalId;
  }
  const tenantId = req.tenant?.hospitalId;
  if (typeof tenantId === 'number' && Number.isSafeInteger(tenantId) && tenantId > 0) {
    return tenantId;
  }
  return null;
};

/**
 * The patient row behind the signed-in account, confined to one hospital.
 *
 * A patient account is linked to its record by email: `patients` carries no
 * `user_id` column, so the account's address is the only join the schema
 * offers. The hospital predicate runs first, so a row belonging to another
 * tenant is never considered.
 */
const findPatientRecord = async (
  email: string,
  hospitalId: number
): Promise<Record<string, unknown> | null> => {
  const [rows] = await pool.query(
    `SELECT id, patient_id, first_name, last_name, age, gender, email, phone, address,
            status, last_visit, created_at, hospital_id
       FROM patients
      WHERE email = ? AND hospital_id = ?
      LIMIT 1`,
    [email, hospitalId]
  );
  return (rows as any[])[0] ?? null;
};

/**
 * Reads the caller and the hospital, or answers the request itself.
 *
 * Returns the resolved patient row and hospital on success; having already
 * replied when it returns null.
 */
const openPortal = async (
  req: PortalRequest,
  res: Response
): Promise<{ record: Record<string, unknown>; hospitalId: number } | null> => {
  const email = req.user?.email;
  if (!email) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const hospitalId = resolveHospitalId(req);
  if (hospitalId === null) {
    res.status(403).json({
      error:
        'This portal is served per hospital. Open it from your hospital address, or sign in from an account assigned to a hospital.',
    });
    return null;
  }

  const record = await findPatientRecord(email, hospitalId);
  if (!record) {
    res.status(404).json({
      error: 'No patient record at this hospital matches the signed-in account.',
    });
    return null;
  }

  return { record, hospitalId };
};

export const getMyPortal = async (req: PortalRequest, res: Response): Promise<Response | void> => {
  try {
    const opened = await openPortal(req, res);
    if (!opened) return;
    res.json({ record: opened.record });
  } catch (error) {
    console.error('Patient portal load error:', error);
    res.status(500).json({ error: 'Failed to load portal' });
  }
};

export const getMyAppointments = async (
  req: PortalRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const opened = await openPortal(req, res);
    if (!opened) return;

    const [rows] = await pool.query(
      `SELECT a.id, a.appointment_id, a.appointment_date, a.appointment_time, a.type,
              a.status, a.notes, a.created_at
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
        WHERE a.patient_id = ? AND p.hospital_id = ?
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
        LIMIT 100`,
      [opened.record.id, opened.hospitalId]
    );
    res.json({ appointments: rows });
  } catch (error) {
    console.error('Patient portal appointments error:', error);
    res.status(500).json({ error: 'Failed to load appointments' });
  }
};

export const getMySharedSummaries = async (
  req: PortalRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const opened = await openPortal(req, res);
    if (!opened) return;

    const [rows] = await pool.query(
      `SELECT s.id, s.patient_name, s.expires_at, s.access_count, s.created_at
         FROM shared_summaries s
         JOIN patients p ON p.id = s.patient_id
        WHERE s.patient_id = ? AND p.hospital_id = ? AND s.revoked_at IS NULL
        ORDER BY s.created_at DESC
        LIMIT 100`,
      [opened.record.id, opened.hospitalId]
    );
    res.json({ summaries: rows });
  } catch (error) {
    console.error('Patient portal summaries error:', error);
    res.status(500).json({ error: 'Failed to load summaries' });
  }
};
