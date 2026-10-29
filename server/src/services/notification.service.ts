/**
 * Notification service.
 *
 * The notification inbox used to be a hardcoded array in the browser
 * (src/contexts/NotificationContext.tsx seeded five fake records and kept
 * them in localStorage). Everything here is server-side and backed by the
 * `notifications` table, so the inbox is per-user, survives a cache clear and
 * can be read from any device.
 *
 * Two responsibilities live here:
 *
 *  1. CRUD over a single user's inbox (list / create / read / update /
 *     delete). Every query is scoped to `user_id`, so one user can never see
 *     or mutate another user's notifications.
 *
 *  2. The scanner, which derives notifications from real clinical data
 *     (appointments, prescriptions, pharmacy inventory, vitals). The scanner
 *     is idempotent: each candidate alert carries a dedupe key that is
 *     claimed in `notification_dedupe` (UNIQUE on user_id + dedupe_key)
 *     before the notification row is written, so the same alert is never
 *     produced twice - not on a second device, not after a cache clear, and
 *     not when two requests race. The unique index makes the claim atomic;
 *     a duplicate-key error means "someone else already claimed it" and the
 *     alert is skipped.
 */
import pool from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export type NotificationType =
  | 'upcoming_appointment'
  | 'pending_confirmation'
  | 'vitals_alert'
  | 'inventory_alert'
  | 'prescription_refill'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationStatus = 'pending' | 'confirmed' | 'resolved' | 'dismissed';

export const NOTIFICATION_TYPES: NotificationType[] = [
  'upcoming_appointment',
  'pending_confirmation',
  'vitals_alert',
  'inventory_alert',
  'prescription_refill',
  'system',
];

export const NOTIFICATION_PRIORITIES: NotificationPriority[] = ['low', 'normal', 'high', 'urgent'];

export const NOTIFICATION_STATUSES: NotificationStatus[] = [
  'pending',
  'confirmed',
  'resolved',
  'dismissed',
];

/**
 * The shape the browser context consumes. Field names match the frontend
 * `NotificationItem` type exactly so the context does not have to translate.
 */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  /** ISO-8601 creation time. */
  timestamp: string;
  /** Epoch milliseconds, kept because the frontend sorts on it. */
  createdAt: number;
  read: boolean;
  appointmentId?: string;
  patientName?: string;
  patientId?: string;
  doctorName?: string;
  appointmentTime?: string;
  status?: NotificationStatus;
  actionUrl?: string;
}

export interface NotificationFilters {
  unread?: boolean;
  status?: NotificationStatus;
  type?: NotificationType;
  limit?: number;
  offset?: number;
}

export interface NotificationCreateInput {
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message?: string;
  status?: NotificationStatus;
  patientId?: number | null;
  patientName?: string | null;
  appointmentId?: number | null;
  doctorName?: string | null;
  appointmentTime?: string | null;
  actionUrl?: string | null;
  data?: unknown;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * How far ahead an appointment must be starting to raise the "starting soon"
 * alert. The old browser implementation used the same 15 minute window.
 */
export const APPOINTMENT_ALERT_WINDOW_MINUTES = 15;

/**
 * A refill alert is raised when the course has this many days left or fewer.
 */
export const REFILL_ALERT_REMAINING_DAYS = 5;

/**
 * An abnormal vitals reading stays alert-worthy for this long.
 */
export const VITALS_ALERT_WINDOW_HOURS = 24;

/**
 * In-process throttle for the scan that runs on every inbox read. The dedupe
 * table already makes the scan idempotent; the throttle just avoids running
 * four aggregate queries every time the inbox is polled. `force` (the
 * explicit POST /scan endpoint) bypasses it.
 */
const SCAN_THROTTLE_MS = 10_000;
const lastScanAt = new Map<number, number>();

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return new Date().toISOString();
}

function mapRow(row: any): NotificationItem {
  const createdAtIso = toIso(row.created_at);
  return {
    id: String(row.id),
    type: row.type as NotificationType,
    priority: (row.priority || 'normal') as NotificationPriority,
    title: row.title,
    message: row.message ?? '',
    timestamp: createdAtIso,
    createdAt: new Date(createdAtIso).getTime(),
    read: row.read_at !== null && row.read_at !== undefined,
    appointmentId: row.appointment_id === null || row.appointment_id === undefined
      ? undefined
      : String(row.appointment_id),
    patientName: row.patient_name ?? undefined,
    patientId: row.patient_id === null || row.patient_id === undefined
      ? undefined
      : String(row.patient_id),
    doctorName: row.doctor_name ?? undefined,
    appointmentTime: row.appointment_time ?? undefined,
    status: (row.status || 'pending') as NotificationStatus,
    actionUrl: row.action_url ?? undefined,
  };
}

/**
 * Claims a dedupe key for a user.
 *
 * Returns true when the caller owns the alert (and must therefore create
 * the notification), false when the key was already claimed. The insert is
 * the atomic step: the unique index on (user_id, dedupe_key) means two
 * concurrent scans cannot both win.
 */
async function claimDedupeKey(userId: number, dedupeKey: string): Promise<boolean> {
  try {
    await pool.query('INSERT INTO notification_dedupe (user_id, dedupe_key) VALUES (?, ?)', [
      userId,
      dedupeKey,
    ]);
    return true;
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') return false;
    throw error;
  }
}

async function insertNotification(
  userId: number,
  input: NotificationCreateInput
): Promise<number> {
  const data = input.data === undefined || input.data === null
    ? null
    : JSON.stringify(input.data);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO notifications
       (user_id, type, priority, title, message, status, patient_id, patient_name,
        appointment_id, doctor_name, appointment_time, action_url, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      input.type,
      input.priority ?? 'normal',
      input.title,
      input.message ?? '',
      input.status ?? 'pending',
      input.patientId ?? null,
      input.patientName ?? null,
      input.appointmentId ?? null,
      input.doctorName ?? null,
      input.appointmentTime ?? null,
      input.actionUrl ?? null,
      data,
    ]
  );

  return result.insertId;
}

/**
 * Reads a page of the caller's inbox, newest first.
 */
export async function listNotifications(
  userId: number,
  filters: NotificationFilters = {}
): Promise<{ notifications: NotificationItem[]; total: number; limit: number; offset: number }> {
  const clauses: string[] = ['user_id = ?'];
  const params: any[] = [userId];

  if (filters.unread) {
    clauses.push('read_at IS NULL');
  }
  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.type) {
    clauses.push('type = ?');
    params.push(filters.type);
  }

  const where = ` WHERE ${clauses.join(' AND ')}`;
  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, type, priority, title, message, status, read_at, patient_id, patient_name,
            appointment_id, doctor_name, appointment_time, action_url, data, created_at
       FROM notifications${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM notifications${where}`,
    params
  );

  return {
    notifications: rows.map((row: any) => mapRow(row)),
    total: Number(countRows?.[0]?.count ?? 0),
    limit,
    offset,
  };
}

/**
 * Reads one notification that belongs to the given user.
 */
export async function getNotification(
  userId: number,
  notificationId: number
): Promise<NotificationItem | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, type, priority, title, message, status, read_at, patient_id, patient_name,
            appointment_id, doctor_name, appointment_time, action_url, data, created_at
       FROM notifications
      WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );

  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function createNotification(
  userId: number,
  input: NotificationCreateInput
): Promise<NotificationItem> {
  const id = await insertNotification(userId, input);
  const created = await getNotification(userId, id);
  if (!created) {
    throw new Error('Notification could not be read back after creation');
  }
  return created;
}

/**
 * Marks one notification read. Idempotent: a notification that is already
 * read keeps its original read timestamp.
 */
export async function markNotificationRead(
  userId: number,
  notificationId: number
): Promise<NotificationItem | null> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?',
    [notificationId, userId]
  );

  if (result.affectedRows === 0) return null;
  return getNotification(userId, notificationId);
}

/**
 * Marks every unread notification of the caller read.
 */
export async function markAllNotificationsRead(
  userId: number
): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
    [userId]
  );
  return result.affectedRows;
}

/**
 * Updates the workflow status of one notification (pending / confirmed /
 * resolved / dismissed).
 */
export async function updateNotificationStatus(
  userId: number,
  notificationId: number,
  status: NotificationStatus
): Promise<NotificationItem | null> {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE notifications SET status = ? WHERE id = ? AND user_id = ?',
    [status, notificationId, userId]
  );

  if (result.affectedRows === 0) return null;
  return getNotification(userId, notificationId);
}

export async function deleteNotification(
  userId: number,
  notificationId: number
): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    'DELETE FROM notifications WHERE id = ? AND user_id = ?',
    [notificationId, userId]
  );
  return result.affectedRows > 0;
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

export interface ScannerScope {
  userId: number;
  hospitalId: number | null;
  departmentId: number | null;
  /** The staff record linked to this user, when the user is also staff. */
  staffId: number | null;
  /** Whether the user may see pharmacy inventory alerts. */
  canViewInventory: boolean;
}

export interface ScanResult {
  created: number;
  byType: Record<string, number>;
}

/**
 * What a scanner reports: how many notifications it created, per type.
 */
type ScannerCounts = Record<string, number>;

/**
 * Resolves what the calling user is allowed to be alerted about.
 *
 * The scope is read from the user row rather than trusted from the request,
 * so a client cannot widen it.
 */
export async function resolveScannerScope(userId: number): Promise<ScannerScope> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id,
            u.hospital_id,
            u.department_id,
            s.id AS staff_id,
            (
              SELECT COUNT(*)
                FROM permissions p
               WHERE p.role_id = u.role_id
                 AND p.module IN ('all', 'pharmacy', 'inventory')
                 AND p.can_view = 1
            ) AS inventory_access
       FROM users u
       LEFT JOIN staff s ON s.user_id = u.id
      WHERE u.id = ?
      LIMIT 1`,
    [userId]
  );

  const row: any = rows[0];
  if (!row) {
    return {
      userId,
      hospitalId: null,
      departmentId: null,
      staffId: null,
      canViewInventory: false,
    };
  }

  return {
    userId,
    hospitalId: row.hospital_id === null || row.hospital_id === undefined ? null : Number(row.hospital_id),
    departmentId:
      row.department_id === null || row.department_id === undefined ? null : Number(row.department_id),
    staffId: row.staff_id === null || row.staff_id === undefined ? null : Number(row.staff_id),
    canViewInventory: Number(row.inventory_access ?? 0) > 0,
  };
}

/**
 * Builds the hospital / own-staff predicate shared by the clinical scans.
 */
function buildClinicalScope(
  scope: ScannerScope,
  patientAlias: string,
  appointmentAlias: string | null
): { sql: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];

  if (scope.hospitalId !== null) {
    clauses.push(`${patientAlias}.hospital_id = ?`);
    params.push(scope.hospitalId);
  }
  if (scope.staffId !== null && appointmentAlias) {
    clauses.push(`${appointmentAlias}.doctor_id = ?`);
    params.push(scope.staffId);
  }

  if (clauses.length === 0) return { sql: '', params: [] };
  return { sql: ` AND (${clauses.join(' OR ')})`, params };
}

/**
 * Alerts for appointments that start within the next 15 minutes.
 *
 * Rule:
 *  - the appointment is still `scheduled` (not completed, not cancelled);
 *  - it starts within APPOINTMENT_ALERT_WINDOW_MINUTES minutes of now;
 *  - it belongs to the caller's hospital, or to the caller's own staff
 *    record.
 *
 * One alert per appointment, deduped on `appt-15min:<appointment_id>`. The
 * public appointment_id (not the numeric primary key) is used so the dedupe
 * key is stable and readable.
 *
 * The alert type follows whether a clinician has been assigned yet:
 *  - no doctor assigned -> `pending_confirmation` (nobody owns the booking
 *    yet, it still needs to be accepted);
 *  - doctor assigned     -> `upcoming_appointment` (get ready).
 */
async function scanUpcomingAppointments(scope: ScannerScope): Promise<ScannerCounts> {
  const scopeFilter = buildClinicalScope(scope, 'p', 'a');
  const params: any[] = [
    ...scopeFilter.params,
  ];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id,
            a.appointment_id,
            CAST(a.appointment_date AS CHAR) AS appointment_date,
            CAST(a.appointment_time AS CHAR) AS appointment_time,
            a.type,
            a.doctor_id,
            p.id AS patient_id,
            p.first_name AS patient_first_name,
            p.last_name AS patient_last_name,
            s.first_name AS doctor_first_name,
            s.last_name AS doctor_last_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN staff s ON s.id = a.doctor_id
      WHERE a.status = 'scheduled'
        AND TIMESTAMP(a.appointment_date, a.appointment_time) > NOW()
        AND TIMESTAMP(a.appointment_date, a.appointment_time) <= DATE_ADD(NOW(), INTERVAL ${APPOINTMENT_ALERT_WINDOW_MINUTES} MINUTE)${scopeFilter.sql}
      ORDER BY a.appointment_date ASC, a.appointment_time ASC
      LIMIT 100`,
    params
  );

  const counts: ScannerCounts = { upcoming_appointment: 0, pending_confirmation: 0 };

  for (const row of rows as any[]) {
    const dedupeKey = `appt-15min:${row.appointment_id}`;
    if (!(await claimDedupeKey(scope.userId, dedupeKey))) continue;

    const patientName = `${row.patient_first_name ?? ''} ${row.patient_last_name ?? ''}`.trim();
    const doctorName = row.doctor_first_name || row.doctor_last_name
      ? `Dr. ${row.doctor_first_name ?? ''} ${row.doctor_last_name ?? ''}`.trim()
      : null;
    const appointmentTime = `${row.appointment_date} ${row.appointment_time}`.trim();
    const hasDoctor = row.doctor_id !== null && row.doctor_id !== undefined;

    const type: NotificationType = hasDoctor ? 'upcoming_appointment' : 'pending_confirmation';

    await insertNotification(scope.userId, {
      type,
      priority: hasDoctor ? 'urgent' : 'high',
      title: hasDoctor
        ? `Starting soon: ${patientName}`
        : `Appointment awaiting confirmation: ${patientName}`,
      message: hasDoctor
        ? `${patientName} has a ${row.type || 'consultation'} with ${doctorName} at ${appointmentTime}.`
        : `${patientName} has a ${row.type || 'consultation'} at ${appointmentTime} and no clinician has been assigned yet.`,
      status: hasDoctor ? 'confirmed' : 'pending',
      patientId: Number(row.patient_id),
      patientName,
      appointmentId: Number(row.id),
      doctorName,
      appointmentTime,
      actionUrl: `/appointments?search=${encodeURIComponent(patientName)}`,
      data: { source: 'scanner', rule: 'appt-15min', dedupeKey },
    });

    counts[type] += 1;
  }

  return counts;
}

/**
 * Alerts for prescriptions that are close to running out of their course and
 * whose medicine is at or below the low-stock threshold.
 *
 * Rule (all conditions must hold):
 *  - the prescription is `new` or `dispensed` (not cancelled);
 *  - its medicine exists in `medicines_inventory`;
 *  - `medicines_inventory.stock_level <= medicines_inventory.low_stock_threshold`;
 *  - the course has REFILL_ALERT_REMAINING_DAYS days left or fewer, and the
 *    course has not run out yet (remaining days >= 0).
 *
 * Course length: `prescriptions.duration_days` when set (migration 004).
 * When it is NULL the length is derived from `quantity` and `frequency`:
 * doses per day is read from the frequency text (once/twice/thrice daily,
 * every N hours), and the course is `quantity / dosesPerDay` days. A
 * prescription with neither a duration nor a usable quantity/frequency is
 * skipped rather than guessed at.
 */
export function derivePrescriptionDurationDays(
  durationDays: number | null | undefined,
  frequency: string | null | undefined,
  quantity: number | null | undefined
): number | null {
  if (durationDays !== null && durationDays !== undefined && Number.isFinite(Number(durationDays))) {
    const value = Number(durationDays);
    if (value > 0) return value;
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const freq = (frequency ?? '').toLowerCase();
  let dosesPerDay = 1;
  if (freq.includes('every')) {
    const match = freq.match(/every\s*(\d+)\s*hour/);
    if (match) {
      const hours = Number(match[1]);
      if (hours > 0) dosesPerDay = Math.max(1, Math.round(24 / hours));
    }
  } else if (freq.includes('three times') || freq.includes('thrice') || freq.includes('tid')) {
    dosesPerDay = 3;
  } else if (freq.includes('twice') || freq.includes('bid')) {
    dosesPerDay = 2;
  } else if (freq.includes('four times') || freq.includes('qid')) {
    dosesPerDay = 4;
  } else if (freq.includes('once') || freq.includes('daily') || freq.includes('od')) {
    dosesPerDay = 1;
  }

  const days = Math.floor(qty / dosesPerDay);
  return days > 0 ? days : null;
}

async function scanPrescriptionRefills(scope: ScannerScope): Promise<ScannerCounts> {
  const scopeFilter = buildClinicalScope(scope, 'p', null);
  const params: any[] = [...scopeFilter.params];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT pr.id,
            pr.quantity,
            pr.frequency,
            pr.status,
            pr.created_at,
            pr.duration_days,
            p.id AS patient_id,
            p.first_name AS patient_first_name,
            p.last_name AS patient_last_name,
            mi.id AS medicine_id,
            mi.medicine_name,
            mi.stock_level,
            mi.low_stock_threshold
       FROM prescriptions pr
       JOIN patients p ON p.id = pr.patient_id
       JOIN medicines_inventory mi ON mi.id = pr.medicine_id
      WHERE pr.status IN ('new', 'dispensed')
        AND mi.stock_level <= mi.low_stock_threshold${scopeFilter.sql}
      ORDER BY pr.created_at ASC
      LIMIT 200`,
    params
  );

  let created = 0;
  const now = Date.now();

  for (const row of rows as any[]) {
    const durationDays = derivePrescriptionDurationDays(
      row.duration_days,
      row.frequency,
      row.quantity
    );
    if (durationDays === null) continue;

    const createdAt = new Date(row.created_at).getTime();
    if (Number.isNaN(createdAt)) continue;

    const elapsedDays = Math.floor((now - createdAt) / (24 * 60 * 60 * 1000));
    const remainingDays = durationDays - elapsedDays;

    if (remainingDays > REFILL_ALERT_REMAINING_DAYS || remainingDays < 0) continue;

    const dedupeKey = `refill:${row.id}`;
    if (!(await claimDedupeKey(scope.userId, dedupeKey))) continue;

    const patientName = `${row.patient_first_name ?? ''} ${row.patient_last_name ?? ''}`.trim();
    const stockLevel = Number(row.stock_level ?? 0);
    const threshold = Number(row.low_stock_threshold ?? 0);

    await insertNotification(scope.userId, {
      type: 'prescription_refill',
      priority: remainingDays <= 2 ? 'high' : 'normal',
      title: `Prescription refill due in ${remainingDays} day${remainingDays === 1 ? '' : 's'}`,
      message: `${patientName}'s course of ${row.medicine_name} has ${remainingDays} day${remainingDays === 1 ? '' : 's'} left. Pharmacy stock: ${stockLevel} (low-stock threshold ${threshold}).`,
      status: 'pending',
      patientId: Number(row.patient_id),
      patientName,
      actionUrl: `/prescriptions?search=${encodeURIComponent(patientName)}`,
      data: {
        source: 'scanner',
        rule: 'prescription-refill',
        dedupeKey,
        prescriptionId: row.id,
        remainingDays,
        durationDays,
        stockLevel,
        lowStockThreshold: threshold,
      },
    });

    created += 1;
  }

  return { prescription_refill: created };
}

/**
 * Alerts for medicines at or below their low-stock threshold.
 *
 * Rule: `medicines_inventory.stock_level <= medicines_inventory.low_stock_threshold`
 * and the threshold is greater than zero (a threshold of zero means "no
 * threshold configured", not "everything is out of stock").
 *
 * Only users who may view the pharmacy module get these alerts.
 */
async function scanInventoryAlerts(scope: ScannerScope): Promise<ScannerCounts> {
  if (!scope.canViewInventory) return { inventory_alert: 0 };

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id,
            medicine_name,
            stock_level,
            low_stock_threshold,
            supplier
       FROM medicines_inventory
      WHERE low_stock_threshold > 0
        AND stock_level <= low_stock_threshold
      ORDER BY stock_level ASC
      LIMIT 50`
  );

  let created = 0;

  for (const row of rows as any[]) {
    const dedupeKey = `inv-low:${row.id}`;
    if (!(await claimDedupeKey(scope.userId, dedupeKey))) continue;

    const stockLevel = Number(row.stock_level ?? 0);
    const threshold = Number(row.low_stock_threshold ?? 0);

    await insertNotification(scope.userId, {
      type: 'inventory_alert',
      priority: stockLevel === 0 ? 'high' : 'normal',
      title: `Low stock: ${row.medicine_name}`,
      message: `${row.medicine_name} is at ${stockLevel} unit${stockLevel === 1 ? '' : 's'}; the low-stock threshold is ${threshold}.${row.supplier ? ` Supplier: ${row.supplier}.` : ''}`,
      status: 'pending',
      actionUrl: '/inventory-reports',
      data: {
        source: 'scanner',
        rule: 'inventory-low-stock',
        dedupeKey,
        medicineId: row.id,
        stockLevel,
        lowStockThreshold: threshold,
      },
    });

    created += 1;
  }

  return { inventory_alert: created };
}

/**
 * Alerts for abnormal vitals readings.
 *
 * The vitals module belongs to another agent, so this query reads the
 * `vitals` table directly instead of importing from it. It is read-only and
 * touches no vitals service code.
 *
 * Rule: `vitals.status IN ('elevated', 'high', 'critical')` and the reading
 * was recorded within VITALS_ALERT_WINDOW_HOURS hours, for a patient in the
 * caller's hospital (or the caller's own staff patients).
 */
async function scanVitalsAlerts(scope: ScannerScope): Promise<ScannerCounts> {
  const scopeFilter = buildClinicalScope(scope, 'p', null);
  const params: any[] = [...scopeFilter.params];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT v.id,
            v.patient_id,
            v.recorded_at,
            v.systolic_bp,
            v.diastolic_bp,
            v.heart_rate,
            v.temperature,
            v.oxygen_saturation,
            v.status,
            p.first_name AS patient_first_name,
            p.last_name AS patient_last_name
       FROM vitals v
       JOIN patients p ON p.id = v.patient_id
      WHERE v.status IN ('elevated', 'high', 'critical')
        AND v.recorded_at >= DATE_SUB(NOW(), INTERVAL ${VITALS_ALERT_WINDOW_HOURS} HOUR)${scopeFilter.sql}
      ORDER BY v.recorded_at DESC
      LIMIT 50`,
    params
  );

  let created = 0;

  for (const row of rows as any[]) {
    const dedupeKey = `vitals:${row.id}`;
    if (!(await claimDedupeKey(scope.userId, dedupeKey))) continue;

    const patientName = `${row.patient_first_name ?? ''} ${row.patient_last_name ?? ''}`.trim();
    const readings = [
      `BP ${row.systolic_bp}/${row.diastolic_bp} mmHg`,
      `HR ${row.heart_rate} bpm`,
      row.temperature !== null && row.temperature !== undefined ? `Temp ${row.temperature} C` : null,
      row.oxygen_saturation !== null && row.oxygen_saturation !== undefined
        ? `SpO2 ${row.oxygen_saturation}%`
        : null,
    ].filter(Boolean);

    await insertNotification(scope.userId, {
      type: 'vitals_alert',
      priority: row.status === 'critical' ? 'urgent' : 'high',
      title: `Abnormal vitals (${row.status}): ${patientName}`,
      message: `${patientName} recorded ${readings.join(', ')}.`,
      status: 'pending',
      patientId: Number(row.patient_id),
      patientName,
      actionUrl: `/patients?search=${encodeURIComponent(patientName)}`,
      data: {
        source: 'scanner',
        rule: 'vitals-abnormal',
        dedupeKey,
        vitalsId: row.id,
        status: row.status,
        recordedAt: toIso(row.recorded_at),
      },
    });

    created += 1;
  }

  return { vitals_alert: created };
}

/**
 * Runs every scanner and returns how many notifications were created.
 *
 * Safe to call repeatedly: each alert is claimed in `notification_dedupe`
 * before it is written, so a second run creates nothing new.
 */
export async function scanNotifications(
  userId: number,
  options: { force?: boolean } = {}
): Promise<ScanResult> {
  const force = options.force === true;

  if (!force) {
    const last = lastScanAt.get(userId);
    if (last !== undefined && Date.now() - last < SCAN_THROTTLE_MS) {
      return { created: 0, byType: {} };
    }
  }

  const scope = await resolveScannerScope(userId);

  const byType: Record<string, number> = {
    upcoming_appointment: 0,
    pending_confirmation: 0,
    vitals_alert: 0,
    inventory_alert: 0,
    prescription_refill: 0,
  };

  let created = 0;

  const scanners: Array<(s: ScannerScope) => Promise<ScannerCounts>> = [
    scanUpcomingAppointments,
    scanPrescriptionRefills,
    scanInventoryAlerts,
    scanVitalsAlerts,
  ];

  for (const scanner of scanners) {
    const counts = await scanner(scope);
    for (const [type, count] of Object.entries(counts)) {
      created += count;
      if (type in byType) {
        byType[type] += count;
      }
    }
  }

  lastScanAt.set(userId, Date.now());

  return { created, byType };
}
