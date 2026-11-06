/**
 * Patient vitals domain service.
 *
 * The clinical thresholds used to live only in the browser
 * (src/services/vitalsService.ts), which meant the server stored whatever
 * status the client claimed and the thresholds were only ever enforced on the
 * device that happened to write the record. They are now enforced here, on the
 * server, and the stored `vitals.status` column is always derived by this
 * module -- a client-supplied status is ignored.
 *
 * The threshold values are intentionally identical to the browser copy so the
 * live preview in the log-vitals dialog keeps matching what the server
 * finally stores. The server remains the only authority: the client value is
 * re-derived, never trusted.
 */
import pool from '../config/database.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type VitalStatus = 'normal' | 'elevated' | 'high' | 'critical';
export type AlertSeverity = 'critical' | 'high' | 'elevated';
export type AlertCategory =
  | 'blood_pressure'
  | 'heart_rate'
  | 'temperature'
  | 'oxygen'
  | 'respiratory';

export interface VitalsRecord {
  id: string;
  patientId: string;
  patientName: string;
  recordedAt: string;
  recordedBy: string;
  systolicBp: number;
  diastolicBp: number;
  heartRate: number;
  temperature: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  notes?: string;
  status: VitalStatus;
}

export interface CriticalHealthAlert {
  id: string;
  patientId: string;
  patientName: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  metricLabel: string;
  metricValue: string;
  thresholdLabel: string;
  message: string;
  clinicalGuideline: string;
  recommendedAction: string;
  recordedAt: string;
  recordedBy: string;
  recordId: string;
}

export interface VitalsSummary {
  latestSystolic: number;
  latestDiastolic: number;
  latestHeartRate: number;
  latestTemperature: number;
  latestOxygenSat?: number;
  bpStatus: 'Normal' | 'Elevated' | 'Stage 1' | 'Stage 2' | 'Hypertensive Crisis';
  hrStatus: 'Normal' | 'Bradycardia' | 'Tachycardia';
  tempStatus: 'Normal' | 'Low' | 'Elevated' | 'Fever';
  lastRecordedAt: string;
}

export interface ResolvedPatient {
  /** Numeric primary key of `patients.id`. */
  id: number;
  /** Human readable `patients.patient_id` (e.g. "P-1001"). */
  patientId: string;
  patientName: string;
  /**
   * The hospital the patient belongs to.
   *
   * The readings are the patient's, and the patient belongs to a hospital.
   * This is what confines a caller's view of them to their own hospital.
   */
  hospitalId: number | null;
}

export interface VitalsFilters {
  /** Numeric `patients.id` or the human readable `patients.patient_id`. */
  patientRef?: string | number;
  from?: string;
  to?: string;
  limit?: number;
}

export interface VitalsInput {
  patientId: string;
  patientName?: string;
  recordedAt?: string;
  recordedBy?: string;
  systolicBp: number;
  diastolicBp: number;
  heartRate: number;
  temperature: number;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  notes?: string | null;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const VITALS_SELECT = `
  SELECT
    v.id,
    v.patient_id,
    v.recorded_by,
    v.recorded_by_name,
    v.recorded_at,
    v.systolic_bp,
    v.diastolic_bp,
    v.heart_rate,
    v.temperature,
    v.respiratory_rate,
    v.oxygen_saturation,
    v.notes,
    v.status,
    p.patient_id AS patient_code,
    p.first_name,
    p.last_name
  FROM vitals v
  JOIN patients p ON p.id = v.patient_id
`;

/**
 * Derive the clinical status of a reading.
 *
 * Server-authoritative: this is the only place a `vitals.status` value is
 * produced. A status sent by a client is ignored on write.
 */
export function computeVitalStatus(
  systolic: number,
  diastolic: number,
  heartRate: number,
  tempC: number
): VitalStatus {
  if (systolic >= 180 || diastolic >= 120 || tempC >= 39.5 || heartRate >= 130) {
    return 'critical';
  }
  if (systolic >= 140 || diastolic >= 90 || tempC >= 38.0 || heartRate >= 105 || heartRate < 50) {
    return 'high';
  }
  if (systolic >= 125 || diastolic >= 83 || tempC >= 37.5 || heartRate >= 90) {
    return 'elevated';
  }
  return 'normal';
}

/**
 * Build the alert list for a single reading.
 *
 * Ported verbatim from the browser implementation so a record produces the
 * same clinical alerts wherever it is read.
 */
export function extractRecordAlerts(record: VitalsRecord): CriticalHealthAlert[] {
  const alerts: CriticalHealthAlert[] = [];

  // 1. Blood pressure
  if (record.systolicBp >= 180 || record.diastolicBp >= 120) {
    alerts.push({
      id: `alert-bp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'blood_pressure',
      severity: 'critical',
      title: 'Hypertensive Crisis (Emergency BP)',
      metricLabel: 'Blood Pressure',
      metricValue: `${record.systolicBp}/${record.diastolicBp} mmHg`,
      thresholdLabel: '>=180 / >=120 mmHg',
      message: `Systolic (${record.systolicBp} mmHg) or diastolic (${record.diastolicBp} mmHg) in critical hypertensive crisis range.`,
      clinicalGuideline: 'AHA/ACC Hypertensive Crisis threshold exceeded. High risk of acute end-organ damage.',
      recommendedAction:
        'Immediate emergency physician evaluation required. Initiate acute antihypertensive reduction protocol and monitor telemetry.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.systolicBp >= 140 || record.diastolicBp >= 90) {
    alerts.push({
      id: `alert-bp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'blood_pressure',
      severity: 'high',
      title: 'Stage 2 Hypertension Alert',
      metricLabel: 'Blood Pressure',
      metricValue: `${record.systolicBp}/${record.diastolicBp} mmHg`,
      thresholdLabel: '>=140 / >=90 mmHg',
      message: `Blood pressure reading (${record.systolicBp}/${record.diastolicBp} mmHg) is significantly above normal clinical thresholds.`,
      clinicalGuideline: 'AHA/ACC Stage 2 Hypertension. Sustained elevation requires prompt therapeutic adjustment.',
      recommendedAction:
        'Re-evaluate antihypertensive prescription dosage, check medication adherence, and schedule follow-up recheck within 24-48 hours.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.systolicBp < 90 || record.diastolicBp < 60) {
    alerts.push({
      id: `alert-bp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'blood_pressure',
      severity: 'high',
      title: 'Hypotension Warning (Low BP)',
      metricLabel: 'Blood Pressure',
      metricValue: `${record.systolicBp}/${record.diastolicBp} mmHg`,
      thresholdLabel: '<90 / <60 mmHg',
      message: `Hypotensive blood pressure reading (${record.systolicBp}/${record.diastolicBp} mmHg) detected.`,
      clinicalGuideline: 'Inadequate vascular perfusion risk. Check for orthostatic symptoms or medication side-effects.',
      recommendedAction:
        'Evaluate patient fluid status, check for dizziness/syncope, and review vasodilator/diuretic regimens.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  }

  // 2. Heart rate
  if (record.heartRate >= 125) {
    alerts.push({
      id: `alert-hr-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'heart_rate',
      severity: 'critical',
      title: 'Severe Tachycardia Alert',
      metricLabel: 'Heart Rate',
      metricValue: `${record.heartRate} bpm`,
      thresholdLabel: '>=125 bpm',
      message: `Resting heart rate (${record.heartRate} bpm) is critically elevated.`,
      clinicalGuideline: 'Critical supraventricular/sinus tachycardia threshold.',
      recommendedAction:
        'Perform 12-lead ECG, assess oxygenation, check electrolytes, and evaluate for acute arrhythmias or septic onset.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.heartRate > 100) {
    alerts.push({
      id: `alert-hr-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'heart_rate',
      severity: 'high',
      title: 'Tachycardia Warning',
      metricLabel: 'Heart Rate',
      metricValue: `${record.heartRate} bpm`,
      thresholdLabel: '>100 bpm',
      message: `Heart rate (${record.heartRate} bpm) is above normal resting limits (60-100 bpm).`,
      clinicalGuideline:
        'Elevated cardiac rate. Can indicate pain, fever, dehydration, thyroid disorder, or stress.',
      recommendedAction: 'Re-assess pulse after rest, evaluate temperature and hydration levels.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.heartRate < 50) {
    alerts.push({
      id: `alert-hr-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'heart_rate',
      severity: 'high',
      title: 'Severe Bradycardia Warning',
      metricLabel: 'Heart Rate',
      metricValue: `${record.heartRate} bpm`,
      thresholdLabel: '<50 bpm',
      message: `Heart rate (${record.heartRate} bpm) is significantly below the normal resting baseline.`,
      clinicalGuideline: 'Bradycardia. Check for conduction delay, sick sinus syndrome, or beta-blocker toxicity.',
      recommendedAction:
        'Check blood pressure, evaluate for lightheadedness or fatigue, review cardiac medications.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  }

  // 3. Body temperature
  if (record.temperature >= 39.5) {
    alerts.push({
      id: `alert-temp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'temperature',
      severity: 'critical',
      title: 'Critical Hyperpyrexia Alert',
      metricLabel: 'Body Temperature',
      metricValue: `${record.temperature.toFixed(1)}C (${((record.temperature * 9) / 5 + 32).toFixed(1)}F)`,
      thresholdLabel: '>=39.5C (103.1F)',
      message: `Critically high body temperature (${record.temperature.toFixed(1)}C) recorded.`,
      clinicalGuideline:
        'Severe hyperpyrexia threshold. Risk of febrile convulsions and rapid systemic decompensation.',
      recommendedAction:
        'Administer intravenous/oral antipyretics immediately, institute external cooling methods, and order blood cultures.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.temperature >= 38.0) {
    alerts.push({
      id: `alert-temp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'temperature',
      severity: 'high',
      title: 'High Fever Warning',
      metricLabel: 'Body Temperature',
      metricValue: `${record.temperature.toFixed(1)}C (${((record.temperature * 9) / 5 + 32).toFixed(1)}F)`,
      thresholdLabel: '>=38.0C (100.4F)',
      message: `Elevated febrile temperature (${record.temperature.toFixed(1)}C) detected.`,
      clinicalGuideline: 'Clinical pyrexia. Indicates infectious or inflammatory response.',
      recommendedAction:
        'Investigate potential infection focus, encourage oral/IV hydration, and administer prescribed antipyretics.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.temperature < 35.5) {
    alerts.push({
      id: `alert-temp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'temperature',
      severity: 'high',
      title: 'Hypothermia Warning',
      metricLabel: 'Body Temperature',
      metricValue: `${record.temperature.toFixed(1)}C (${((record.temperature * 9) / 5 + 32).toFixed(1)}F)`,
      thresholdLabel: '<35.5C (95.9F)',
      message: `Subnormal core body temperature (${record.temperature.toFixed(1)}C) detected.`,
      clinicalGuideline: 'Hypothermia risk. Can indicate environmental exposure, sepsis, or metabolic failure.',
      recommendedAction:
        'Apply warm blankets, provide warm fluids if conscious, and repeat core temperature measurement in 15 minutes.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  }

  // 4. Oxygen saturation
  if (record.oxygenSaturation !== undefined && record.oxygenSaturation > 0) {
    if (record.oxygenSaturation < 90) {
      alerts.push({
        id: `alert-spo2-${record.id}`,
        patientId: record.patientId,
        patientName: record.patientName,
        category: 'oxygen',
        severity: 'critical',
        title: 'Critical Hypoxemia (Low SpO2)',
        metricLabel: 'Oxygen Saturation',
        metricValue: `${record.oxygenSaturation}%`,
        thresholdLabel: '<90%',
        message: `Pulse oximetry reading (${record.oxygenSaturation}%) is critically below safe respiratory thresholds.`,
        clinicalGuideline: 'Severe hypoxemia. Immediate tissue hypoxia and respiratory arrest risk.',
        recommendedAction:
          'Start supplemental oxygen therapy immediately via nasal cannula/mask, verify airway patency, and prepare arterial blood gas (ABG).',
        recordedAt: record.recordedAt,
        recordedBy: record.recordedBy,
        recordId: record.id,
      });
    } else if (record.oxygenSaturation < 95) {
      alerts.push({
        id: `alert-spo2-${record.id}`,
        patientId: record.patientId,
        patientName: record.patientName,
        category: 'oxygen',
        severity: 'high',
        title: 'Mild Hypoxemia Warning',
        metricLabel: 'Oxygen Saturation',
        metricValue: `${record.oxygenSaturation}%`,
        thresholdLabel: '<95%',
        message: `Pulse oximetry reading (${record.oxygenSaturation}%) is below optimal target (>=95%).`,
        clinicalGuideline: 'Sub-optimal oxygenation. May indicate respiratory compromise or airway obstruction.',
        recommendedAction:
          'Check sensor positioning, elevate patient head-of-bed, encourage deep breathing exercises, and monitor respiration.',
        recordedAt: record.recordedAt,
        recordedBy: record.recordedBy,
        recordId: record.id,
      });
    }
  }

  return alerts;
}

/**
 * Summarise a set of readings. Mirrors the browser summary shape exactly.
 */
export function computeVitalsSummary(records: VitalsRecord[]): VitalsSummary | null {
  if (!records || records.length === 0) return null;

  const sorted = [...records].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );
  const latest = sorted[0];

  let bpStatus: VitalsSummary['bpStatus'] = 'Normal';
  if (latest.systolicBp >= 180 || latest.diastolicBp >= 120) {
    bpStatus = 'Hypertensive Crisis';
  } else if (latest.systolicBp >= 140 || latest.diastolicBp >= 90) {
    bpStatus = 'Stage 2';
  } else if (latest.systolicBp >= 130 || latest.diastolicBp >= 80) {
    bpStatus = 'Stage 1';
  } else if (latest.systolicBp >= 120 && latest.diastolicBp < 80) {
    bpStatus = 'Elevated';
  }

  let hrStatus: VitalsSummary['hrStatus'] = 'Normal';
  if (latest.heartRate < 60) hrStatus = 'Bradycardia';
  else if (latest.heartRate > 100) hrStatus = 'Tachycardia';

  let tempStatus: VitalsSummary['tempStatus'] = 'Normal';
  if (latest.temperature < 36.0) tempStatus = 'Low';
  else if (latest.temperature >= 38.0) tempStatus = 'Fever';
  else if (latest.temperature >= 37.5) tempStatus = 'Elevated';

  return {
    latestSystolic: latest.systolicBp,
    latestDiastolic: latest.diastolicBp,
    latestHeartRate: latest.heartRate,
    latestTemperature: latest.temperature,
    latestOxygenSat: latest.oxygenSaturation,
    bpStatus,
    hrStatus,
    tempStatus,
    lastRecordedAt: latest.recordedAt,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Format a MySQL DATETIME (or Date) as a local-time ISO 8601 string without a
 * timezone suffix, e.g. "2025-01-10T09:15:00".
 *
 * A local time without an offset is parsed as local time by `new Date()`, so
 * the wall-clock the clinician entered is what the browser shows. Converting
 * through UTC would shift the reading by the server offset.
 */
export function formatLocalIso(value: Date | string | null | undefined): string {
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
  return Number.isNaN(parsed.getTime()) ? text : formatLocalIso(parsed);
}

/**
 * Normalise a client-supplied timestamp into a MySQL DATETIME string.
 *
 * "YYYY-MM-DD HH:mm[:ss]" is taken at face value (that is what the clinician
 * typed); anything else is parsed and rendered in the server's local time.
 */
export function toMysqlDateTime(value?: string | number | Date | null): string {
  if (value === undefined || value === null || value === '') {
    return formatLocalIso(new Date()).replace('T', ' ');
  }
  if (value instanceof Date) {
    return formatLocalIso(value).replace('T', ' ');
  }
  if (typeof value === 'number') {
    return formatLocalIso(new Date(value)).replace('T', ' ');
  }
  const text = String(value).trim();
  const local = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (local) {
    return `${local[1]}-${local[2]}-${local[3]} ${local[4]}:${local[5]}:${local[6] || '00'}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid recordedAt timestamp');
  }
  return formatLocalIso(parsed).replace('T', ' ');
}

function mapVitalsRow(row: any): VitalsRecord {
  const first = row.first_name ?? '';
  const last = row.last_name ?? '';
  const patientName = `${first} ${last}`.trim();
  const record: VitalsRecord = {
    id: String(row.id),
    patientId: row.patient_code,
    patientName,
    recordedAt: formatLocalIso(row.recorded_at),
    recordedBy: row.recorded_by_name || 'Unknown clinician',
    systolicBp: Number(row.systolic_bp),
    diastolicBp: Number(row.diastolic_bp),
    heartRate: Number(row.heart_rate),
    temperature: Number(row.temperature),
    status: row.status as VitalStatus,
  };
  if (row.respiratory_rate !== null && row.respiratory_rate !== undefined) {
    record.respiratoryRate = Number(row.respiratory_rate);
  }
  if (row.oxygen_saturation !== null && row.oxygen_saturation !== undefined) {
    record.oxygenSaturation = Number(row.oxygen_saturation);
  }
  if (row.notes !== null && row.notes !== undefined && row.notes !== '') {
    record.notes = String(row.notes);
  }
  return record;
}

/**
 * Resolve a patient reference to a patient row.
 *
 * Accepts either the numeric `patients.id` or the human readable
 * `patients.patient_id` ("P-1001"). The browser historically used the human
 * readable form, so both are supported on input; every response uses the
 * human readable form for `patientId`.
 */
export async function resolvePatient(reference: string | number): Promise<ResolvedPatient | null> {
  const raw = String(reference ?? '').trim();
  if (!raw) return null;

  const byCode = await pool.query<RowDataPacket[]>(
    `SELECT id, patient_id, first_name, last_name, hospital_id FROM patients WHERE patient_id = ? LIMIT 1`,
    [raw]
  );
  if (byCode[0].length > 0) {
    const row = byCode[0][0];
    return {
      id: Number(row.id),
      patientId: row.patient_id,
      patientName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
      hospitalId: row.hospital_id === null || row.hospital_id === undefined ? null : Number(row.hospital_id),
    };
  }

  if (/^\d+$/.test(raw)) {
    const byId = await pool.query<RowDataPacket[]>(
      `SELECT id, patient_id, first_name, last_name, hospital_id FROM patients WHERE id = ? LIMIT 1`,
      [Number(raw)]
    );
    if (byId[0].length > 0) {
      const row = byId[0][0];
      return {
        id: Number(row.id),
        patientId: row.patient_id,
        patientName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
        hospitalId: row.hospital_id === null || row.hospital_id === undefined ? null : Number(row.hospital_id),
      };
    }
  }

  return null;
}

function buildWhere(filters: VitalsFilters): { clauses: string[]; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.from) {
    clauses.push('v.recorded_at >= ?');
    params.push(toMysqlDateTime(filters.from));
  }
  if (filters.to) {
    clauses.push('v.recorded_at <= ?');
    params.push(toMysqlDateTime(filters.to));
  }

  return { clauses, params };
}

/**
 * List readings, newest first.
 */
export async function listVitals(filters: VitalsFilters = {}): Promise<VitalsRecord[]> {
  const { clauses, params } = buildWhere(filters);
  let sql = VITALS_SELECT;
  const where: string[] = [...clauses];

  if (filters.patientRef) {
    const patient = await resolvePatient(filters.patientRef);
    if (!patient) return [];
    where.push('v.patient_id = ?');
    params.push(patient.id);
  }

  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  sql += ' ORDER BY v.recorded_at DESC, v.id DESC LIMIT ?';
  params.push(limit);

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows.map(mapVitalsRow);
}

/**
 * Latest-reading summary for one patient.
 */
export async function getPatientVitalsSummary(patientRef: string | number): Promise<VitalsSummary | null> {
  const records = await listVitals({ patientRef, limit: 100 });
  return computeVitalsSummary(records);
}

/**
 * Alerts for the most recent reading of one patient.
 */
export async function getPatientAlerts(
  patientRef: string | number
): Promise<CriticalHealthAlert[]> {
  const records = await listVitals({ patientRef, limit: 1 });
  if (records.length === 0) return [];
  return extractRecordAlerts(records[0]);
}

/**
 * Active alerts across every patient: the latest reading of each patient is
 * evaluated and its alerts are merged, critical first.
 */
export async function getAllActiveAlerts(hospitalId?: number | null): Promise<CriticalHealthAlert[]> {
  // One query: the latest reading of every patient. The subquery keeps the
  // "latest per patient" rule in SQL instead of fetching the whole table and
  // grouping in memory.
  //
  // The alerts are a hospital's alerts: the readings are the patients', and
  // the patients belong to hospitals. The list is also bounded, because the
  // table of readings grows without limit and the list is read whole.
  const scope =
    hospitalId === undefined
      ? { sql: '', params: [] as unknown[] }
      : { sql: ' AND p.hospital_id = ?', params: [hospitalId] as unknown[] };
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       v.id,
       v.patient_id,
       v.recorded_by,
       v.recorded_by_name,
       v.recorded_at,
       v.systolic_bp,
       v.diastolic_bp,
       v.heart_rate,
       v.temperature,
       v.respiratory_rate,
       v.oxygen_saturation,
       v.notes,
       v.status,
       p.patient_id AS patient_code,
       p.first_name,
       p.last_name
     FROM vitals v
     JOIN patients p ON p.id = v.patient_id
     JOIN (
       SELECT patient_id, MAX(recorded_at) AS latest_at
       FROM vitals
       GROUP BY patient_id
     ) latest
       ON latest.patient_id = v.patient_id
      AND latest.latest_at = v.recorded_at
     WHERE 1 = 1${scope.sql}
     ORDER BY v.recorded_at DESC
     LIMIT 500`,
    scope.params
  );

  const alerts: CriticalHealthAlert[] = [];
  for (const row of rows) {
    alerts.push(...extractRecordAlerts(mapVitalsRow(row)));
  }

  return alerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
  });
}

/**
 * Record a reading. The status is always derived here; any status sent by the
 * client is ignored.
 */
export async function createVital(
  input: VitalsInput,
  recorder?: { id?: number; name?: string }
): Promise<VitalsRecord | null> {
  const patient = await resolvePatient(input.patientId);
  if (!patient) return null;

  const status = computeVitalStatus(
    input.systolicBp,
    input.diastolicBp,
    input.heartRate,
    input.temperature
  );

  const recordedAt = toMysqlDateTime(input.recordedAt);
  const recordedByName = (recorder?.name || input.recordedBy || '').trim().slice(0, 255) || 'Unknown clinician';

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO vitals
      (patient_id, recorded_by, recorded_by_name, recorded_at, systolic_bp, diastolic_bp,
       heart_rate, temperature, respiratory_rate, oxygen_saturation, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patient.id,
      recorder?.id ?? null,
      recordedByName,
      recordedAt,
      input.systolicBp,
      input.diastolicBp,
      input.heartRate,
      input.temperature,
      input.respiratoryRate ?? null,
      input.oxygenSaturation ?? null,
      input.notes ? String(input.notes).slice(0, 2000) : null,
      status,
    ]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `${VITALS_SELECT} WHERE v.id = ? LIMIT 1`,
    [result.insertId]
  );
  return rows.length > 0 ? mapVitalsRow(rows[0]) : null;
}

/**
 * Correct a reading. Only the provided fields are changed; the status is
 * re-derived from the resulting values.
 */
export async function updateVital(
  id: string | number,
  input: Partial<VitalsInput>
): Promise<VitalsRecord | null> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;

  const [existingRows] = await pool.query<RowDataPacket[]>(
    `${VITALS_SELECT} WHERE v.id = ? LIMIT 1`,
    [numericId]
  );
  if (existingRows.length === 0) return null;

  const existing = mapVitalsRow(existingRows[0]);

  const systolic = input.systolicBp ?? existing.systolicBp;
  const diastolic = input.diastolicBp ?? existing.diastolicBp;
  const heartRate = input.heartRate ?? existing.heartRate;
  const temperature = input.temperature ?? existing.temperature;
  const status = computeVitalStatus(systolic, diastolic, heartRate, temperature);

  const recordedAt = input.recordedAt ? toMysqlDateTime(input.recordedAt) : undefined;
  const recordedByName = input.recordedBy
    ? String(input.recordedBy).trim().slice(0, 255) || null
    : undefined;
  const respiratoryRate =
    input.respiratoryRate === undefined ? undefined : input.respiratoryRate;
  const oxygenSaturation = input.oxygenSaturation === undefined ? undefined : input.oxygenSaturation;
  const notes = input.notes === undefined ? undefined : input.notes;

  await pool.query(
    `UPDATE vitals SET
       recorded_at = COALESCE(?, recorded_at),
       recorded_by_name = COALESCE(?, recorded_by_name),
       systolic_bp = ?,
       diastolic_bp = ?,
       heart_rate = ?,
       temperature = ?,
       respiratory_rate = ?,
       oxygen_saturation = ?,
       notes = ?,
       status = ?
     WHERE id = ?`,
    [
      recordedAt ?? null,
      recordedByName ?? null,
      systolic,
      diastolic,
      heartRate,
      temperature,
      respiratoryRate === undefined ? existing.respiratoryRate ?? null : respiratoryRate,
      oxygenSaturation === undefined ? existing.oxygenSaturation ?? null : oxygenSaturation,
      notes === undefined ? existing.notes ?? null : notes ? String(notes).slice(0, 2000) : null,
      status,
      numericId,
    ]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `${VITALS_SELECT} WHERE v.id = ? LIMIT 1`,
    [numericId]
  );
  return rows.length > 0 ? mapVitalsRow(rows[0]) : null;
}

/**
 * Remove a reading. Returns false when the record does not exist.
 */
export async function deleteVital(id: string | number): Promise<boolean> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return false;
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM vitals WHERE id = ?', [numericId]);
  return result.affectedRows > 0;
}

/**
 * Look up the display name of the authenticated user, used as the default
 * "recorded by" attribution.
 */
export async function getClinicianName(userId?: number): Promise<string | null> {
  if (!userId) return null;
  const [rows] = await pool.query<RowDataPacket[]>('SELECT name FROM users WHERE id = ? LIMIT 1', [
    userId,
  ]);
  return rows.length > 0 ? rows[0].name : null;
}
