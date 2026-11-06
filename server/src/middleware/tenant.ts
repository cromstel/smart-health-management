import type { TenantScope } from './auth.js';
import pool from '../config/database.js';
import type { RowDataPacket } from 'mysql2';

/**
 * Confining a query to the caller's hospital.
 *
 * The clinical records do not carry a hospital of their own: a note, a set of
 * observations, a prescription and a document all belong to a patient, and
 * the patient carries the hospital. So a query over them is confined by
 * joining the patient and narrowing on the patient's hospital.
 *
 * The scope comes from the account's own row, never from the request. A
 * request that names a hospital is checked against this scope; it is not the
 * scope.
 *
 * A caller with no hospital is confined to nothing. The predicate is given a
 * value that matches no row, so the answer is an empty list rather than the
 * whole table, and an account whose hospital has not been set up yet sees
 * nothing rather than everything.
 *
 * A caller whose role holds the platform-wide permission is not confined:
 * that role is the one that is meant to see across the installation. The
 * clinical workforce is.
 */

/** A value that no row's hospital key can be, used when the scope is empty. */
const NO_HOSPITAL = -1;

/**
 * The hospital the caller's records belong to, for a query that already
 * joins the patient.
 *
 * @param scope the caller's tenant scope
 * @param alias the alias the patient table is joined under
 * @param params the query's parameters, to which the hospital is added
 */
export const tenantPredicate = (
  scope: TenantScope | undefined,
  alias: string,
  params: unknown[]
): string => {
  if (scope?.platformWide) return '';
  params.push(scope?.hospitalId ?? NO_HOSPITAL);
  return ` AND ${alias}.hospital_id = ?`;
};

/**
 * The hospital the caller's records belong to, for a query that does not yet
 * join the patient.
 *
 * The join and the predicate are returned together, because a query that
 * joins the patient without narrowing on it is exactly the query this is
 * meant to prevent.
 *
 * @param scope the caller's tenant scope
 * @param alias the alias the patient table is joined under
 * @param table the table being queried, qualified by its alias
 * @param params the query's parameters, to which the hospital is added
 */
export const tenantPatientJoin = (
  scope: TenantScope | undefined,
  alias: string,
  table: string,
  params: unknown[]
): { join: string; predicate: string } => {
  if (scope?.platformWide) return { join: '', predicate: '' };
  params.push(scope?.hospitalId ?? NO_HOSPITAL);
  return {
    join: ` JOIN patients ${alias} ON ${alias}.id = ${table}.patient_id`,
    predicate: ` AND ${alias}.hospital_id = ?`,
  };
};

/**
 * Whether a record belongs to the caller's hospital.
 *
 * Used where the record has already been read and the question is whether it
 * may be shown. A record whose hospital is not the caller's is treated as
 * absent rather than refused, so that the answer does not tell a caller that
 * a record exists in another hospital.
 */
export const belongsToTenant = (
  scope: TenantScope | undefined,
  recordHospitalId: number | null | undefined
): boolean => {
  if (scope?.platformWide) return true;
  if (scope?.hospitalId === null || scope?.hospitalId === undefined) return false;
  return Number(recordHospitalId) === Number(scope.hospitalId);
};

/**
 * Whether a patient's record belongs to the caller's hospital.
 *
 * The clinical records are all reached through a patient, and a patient
 * carries the hospital. So a note, an observation, a prescription, a
 * dispensing event, a document and a shared summary are all confined by
 * asking which hospital the patient belongs to.
 *
 * A patient that does not exist, and a patient that belongs to another
 * hospital, are the same answer: it is not the caller's.
 */
export const patientBelongsToTenant = async (
  patientId: number,
  scope: TenantScope | undefined
): Promise<boolean> => {
  if (scope?.platformWide) return true;
  const [rows] = await pool.query<(RowDataPacket & { hospital_id: number | null })[]>(
    'SELECT hospital_id FROM patients WHERE id = ? LIMIT 1',
    [patientId]
  );
  const record = (rows as any[])[0];
  if (!record) return false;
  return belongsToTenant(scope, record.hospital_id);
};
