/**
 * Audit log service.
 *
 * The audit trail used to be a localStorage array in the browser
 * (src/contexts/AuditContext.tsx), which a user could erase with one
 * DevTools call. The `audit_logs` table is the record of truth; this module
 * reads it and writes to it.
 *
 * The super-admin controller has its own copy of the read query
 * (controllers/superAdmin.controller.ts). This module holds the shared shape
 * so the ordinary-user endpoint and the super-admin endpoint can read the
 * same trail without two divergent SQL definitions.
 */
import pool from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface AuditLogFilters {
  limit: number;
  offset: number;
  userId?: number;
  module?: string;
  action?: string;
  from?: string;
  to?: string;
  /** Free-text search across action, module, record id and actor name. */
  search?: string;
}

/**
 * The shape the browser consumes.
 *
 * Field names are camelCase on purpose: the audit trail is read by
 * src/pages/AuditLogsPage.tsx, src/components/dashboard/
 * RecentActivityWidget.tsx and src/components/dashboard/
 * AuditLogOperationsChart.tsx, which all read `userId`, `userName`,
 * `action`, `module`, `recordId`, `oldValue`, `newValue` and `timestamp`.
 */
export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  module: string;
  recordId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  /** ISO-8601 creation time. */
  timestamp: string;
}

export interface AuditLogWriteInput {
  userId: number;
  userName: string | null;
  action: string;
  module: string;
  recordId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogSummary {
  range: string;
  from: string;
  to: string;
  total: number;
  /** One entry per day in the range, oldest first. */
  buckets: Array<{ date: string; count: number }>;
  byModule: Array<{ module: string; count: number }>;
  byAction: Array<{ action: string; count: number }>;
}

export interface AuditReportSchedule {
  enabled: boolean;
  emails: string;
  frequency: string;
  format: string;
  modules: string[];
  lastUpdated: string;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export const AUDIT_REPORT_SCHEDULE_KEY = 'audit_report_schedule';

export const DEFAULT_AUDIT_REPORT_SCHEDULE: AuditReportSchedule = {
  enabled: true,
  emails: 'admin-records@smarthospital.org',
  frequency: 'monthly',
  format: 'csv',
  modules: ['patients', 'vitals'],
  lastUpdated: new Date(0).toISOString(),
};

function toDateTime(value: string): string {
  const local = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/);
  if (local) return `${local[1]}-${local[2]}-${local[3]} ${local[4]}:${local[5]}:${local[6] || '00'}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ` +
    `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`
  );
}

function buildWhere(filters: AuditLogFilters): { where: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.userId !== undefined) {
    clauses.push('al.user_id = ?');
    params.push(filters.userId);
  }
  if (filters.module) {
    clauses.push('al.module = ?');
    params.push(filters.module);
  }
  if (filters.action) {
    clauses.push('al.action = ?');
    params.push(filters.action);
  }
  if (filters.from) {
    clauses.push('al.created_at >= ?');
    params.push(toDateTime(filters.from));
  }
  if (filters.to) {
    clauses.push('al.created_at <= ?');
    params.push(toDateTime(filters.to));
  }
  if (filters.search) {
    clauses.push('(al.action LIKE ? OR al.module LIKE ? OR al.record_id LIKE ? OR al.user_name LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }

  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

/**
 * Reads a page of the audit trail.
 */
export async function fetchAuditLogs(filters: AuditLogFilters): Promise<{
  logs: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}> {
  const { where, params } = buildWhere(filters);
  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       al.id,
       al.user_id,
       al.action,
       al.module,
       al.record_id,
       al.old_value,
       al.new_value,
       al.ip_address,
       al.user_agent,
       al.created_at,
       al.user_name,
       u.email AS user_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id${where}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM audit_logs al${where}`,
    params
  );

  const logs: AuditLogEntry[] = rows.map((row: any) => ({
    id: String(row.id),
    userId: row.user_id === null || row.user_id === undefined ? null : String(row.user_id),
    userName: row.user_name ?? row.user_name ?? null,
    userEmail: row.user_email ?? null,
    action: row.action,
    module: row.module,
    recordId: row.record_id ?? null,
    oldValue: row.old_value ?? null,
    newValue: row.new_value ?? null,
    ipAddress: row.ip_address ?? null,
    userAgent: row.user_agent ?? null,
    timestamp:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));

  return {
    logs,
    total: Number(countRows?.[0]?.count ?? 0),
    limit,
    offset,
  };
}

/**
 * The most recent entries, newest first.
 */
export async function fetchRecentAuditLogs(
  filters: { userId?: number; limit?: number }
): Promise<AuditLogEntry[]> {
  const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 100);
  const params: any[] = [];
  let where = '';

  if (filters.userId !== undefined) {
    where = ' WHERE al.user_id = ?';
    params.push(filters.userId);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       al.id,
       al.user_id,
       al.action,
       al.module,
       al.record_id,
       al.old_value,
       al.new_value,
       al.ip_address,
       al.user_agent,
       al.created_at,
       al.user_name,
       u.email AS user_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id${where}
     ORDER BY al.created_at DESC
     LIMIT ?`,
    [...params, limit]
  );

  return rows.map((row: any) => ({
    id: String(row.id),
    userId: row.user_id === null || row.user_id === undefined ? null : String(row.user_id),
    userName: row.user_name ?? null,
    userEmail: row.user_email ?? null,
    action: row.action,
    module: row.module,
    recordId: row.record_id ?? null,
    oldValue: row.old_value ?? null,
    newValue: row.new_value ?? null,
    ipAddress: row.ip_address ?? null,
    userAgent: row.user_agent ?? null,
    timestamp:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

/**
 * Counts the trail per day for the operations chart.
 */
export async function fetchAuditLogSummary(filters: {
  userId?: number;
  range: string;
  days: number;
}): Promise<AuditLogSummary> {
  const params: any[] = [filters.days];
  let where = ' WHERE al.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';

  if (filters.userId !== undefined) {
    where += ' AND al.user_id = ?';
    params.push(filters.userId);
  }

  const [dayRows] = await pool.query<RowDataPacket[]>(
    `SELECT CAST(DATE(al.created_at) AS CHAR) AS day, COUNT(*) AS count
       FROM audit_logs al${where}
      GROUP BY DATE(al.created_at)
      ORDER BY day ASC`,
    params
  );

  const [moduleRows] = await pool.query<RowDataPacket[]>(
    `SELECT al.module, COUNT(*) AS count
       FROM audit_logs al${where}
      GROUP BY al.module
      ORDER BY count DESC`,
    params
  );

  const [actionRows] = await pool.query<RowDataPacket[]>(
    `SELECT al.action, COUNT(*) AS count
       FROM audit_logs al${where}
      GROUP BY al.action
      ORDER BY count DESC
      LIMIT 25`,
    params
  );

  const to = new Date();
  const from = new Date(to.getTime() - filters.days * 24 * 60 * 60 * 1000);

  return {
    range: filters.range,
    from: from.toISOString(),
    to: to.toISOString(),
    total: dayRows.reduce((sum: number, row: any) => sum + Number(row.count ?? 0), 0),
    buckets: dayRows.map((row: any) => ({
      date: String(row.day),
      count: Number(row.count ?? 0),
    })),
    byModule: moduleRows.map((row: any) => ({
      module: String(row.module ?? ''),
      count: Number(row.count ?? 0),
    })),
    byAction: actionRows.map((row: any) => ({
      action: String(row.action ?? ''),
      count: Number(row.count ?? 0),
    })),
  };
}

/**
 * Writes one entry into the trail.
 *
 * The actor, the timestamp and the request metadata come from the server;
 * only the action, the module and the values are supplied by the client.
 */
export async function createAuditLog(input: AuditLogWriteInput): Promise<AuditLogEntry> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO audit_logs
       (user_id, user_name, action, module, record_id, old_value, new_value, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.userName,
      input.action,
      input.module,
      input.recordId ?? null,
      input.oldValue ?? null,
      input.newValue ?? null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
    ]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       al.id,
       al.user_id,
       al.action,
       al.module,
       al.record_id,
       al.old_value,
       al.new_value,
       al.ip_address,
       al.user_agent,
       al.created_at,
       al.user_name,
       u.email AS user_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.id = ?
     LIMIT 1`,
    [result.insertId]
  );

  const row: any = rows[0];
  return {
    id: String(row.id),
    userId: row.user_id === null || row.user_id === undefined ? null : String(row.user_id),
    userName: row.user_name ?? null,
    userEmail: row.user_email ?? null,
    action: row.action,
    module: row.module,
    recordId: row.record_id ?? null,
    oldValue: row.old_value ?? null,
    newValue: row.new_value ?? null,
    ipAddress: row.ip_address ?? null,
    userAgent: row.user_agent ?? null,
    timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

/**
 * Reads the report schedule configuration.
 */
export async function getAuditReportSchedule(): Promise<AuditReportSchedule> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT setting_value, updated_at FROM settings WHERE setting_key = ? LIMIT 1',
    [AUDIT_REPORT_SCHEDULE_KEY]
  );

  const row: any = rows[0];
  if (!row || !row.setting_value) {
    return { ...DEFAULT_AUDIT_REPORT_SCHEDULE };
  }

  try {
    const parsed = JSON.parse(row.setting_value);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_AUDIT_REPORT_SCHEDULE.enabled,
      emails:
        typeof parsed.emails === 'string' ? parsed.emails : DEFAULT_AUDIT_REPORT_SCHEDULE.emails,
      frequency:
        typeof parsed.frequency === 'string'
          ? parsed.frequency
          : DEFAULT_AUDIT_REPORT_SCHEDULE.frequency,
      format: typeof parsed.format === 'string' ? parsed.format : DEFAULT_AUDIT_REPORT_SCHEDULE.format,
      modules: Array.isArray(parsed.modules)
        ? parsed.modules.filter((m: unknown): m is string => typeof m === 'string')
        : DEFAULT_AUDIT_REPORT_SCHEDULE.modules,
      lastUpdated:
        typeof parsed.lastUpdated === 'string'
          ? parsed.lastUpdated
          : row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : String(row.updated_at ?? ''),
    };
  } catch {
    return { ...DEFAULT_AUDIT_REPORT_SCHEDULE };
  }
}

/**
 * Stores the report schedule configuration.
 */
export async function saveAuditReportSchedule(
  schedule: AuditReportSchedule,
  updatedBy: number | null
): Promise<AuditReportSchedule> {
  const payload = JSON.stringify(schedule);

  await pool.query(
    `INSERT INTO settings (setting_key, setting_value, category, updated_by, updated_at)
     VALUES (?, ?, 'audit', ?, NOW())
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value),
                             category = VALUES(category),
                             updated_by = VALUES(updated_by),
                             updated_at = NOW()`,
    [AUDIT_REPORT_SCHEDULE_KEY, payload, updatedBy]
  );

  return { ...schedule };
}

/**
 * Whether a user may read the audit trail of everybody.
 *
 * Mirrors the permission check in middleware/auth.ts: the "all" module and
 * the "superAdmin" module both grant the view action.
 */
export async function canViewAllAuditLogs(userId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.module, p.can_view AS allowed
     FROM users u
     JOIN permissions p ON p.role_id = u.role_id
     WHERE u.id = ? AND p.module IN ('all', 'superAdmin')`,
    [userId]
  );

  return rows.some((row: any) => Number(row.allowed) === 1);
}

/**
 * The display name of a user, stored alongside the audit entry so the trail
 * still reads correctly if the user is later removed.
 */
export async function getUserDisplayName(userId: number): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT name FROM users WHERE id = ? LIMIT 1', [
    userId,
  ]);
  return rows[0]?.name ?? null;
}
