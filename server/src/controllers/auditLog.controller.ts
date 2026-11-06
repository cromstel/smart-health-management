/**
 * Audit log controller for ordinary users.
 *
 * The super-admin trail lives behind the `superAdmin` permission
 * (GET /api/super-admin/audit-logs). This endpoint gives every authenticated
 * user a way to read the audit trail: users who may administer the platform
 * see the whole trail, everyone else sees only their own actions.
 *
 * It is also the write endpoint. The browser used to keep its own audit
 * array in localStorage, which any user could erase with one DevTools call;
 * writes now go to the `audit_logs` table. The actor, the timestamp and the
 * request metadata are derived from the request, never from the body.
 */
import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { AuthRequest } from '../middleware/auth.js';
import * as auditLogService from '../services/auditLog.service.js';

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

/**
 * The numeric user id from the JWT.
 */
function resolveUserId(req: AuthRequest, res: Response): number | null {
  const userId = Number(req.user?.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

/**
 * JSON.stringify that cannot throw on a circular structure.
 */
function safeStringify(value: unknown): string | null {
  const seen = new WeakSet<object>();

  try {
    const serialised = JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      if (typeof val === 'bigint') return val.toString();
      if (typeof val === 'function') return '[Function]';
      return val;
    });
    return serialised ?? null;
  } catch {
    return null;
  }
}

/**
 * Normalises an audit value into the TEXT column.
 *
 * Strings are stored as they are (the audit pages render them as text), and
 * anything else - objects, arrays, numbers - is serialised to JSON. The
 * frontend sends whatever detail object a call site happens to have, so the
 * value can be of any shape.
 */
function toAuditText(value: unknown): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  return safeStringify(value);
}

/**
 * GET /api/audit-logs
 *
 * Query: limit, offset, and the optional filters userId, module, action,
 * search, from, to.
 */
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const query = req.query as Record<string, string | undefined>;
    const canViewAll = await auditLogService.canViewAllAuditLogs(userId);

    const requestedUserId = query.userId ? Number(query.userId) : undefined;

    const result = await auditLogService.fetchAuditLogs({
      limit: query.limit ? Number(query.limit) : 100,
      offset: query.offset ? Number(query.offset) : 0,
      // A user without the audit-log view permission is always scoped to their
      // own actions, whatever they asked for.
      userId: canViewAll ? requestedUserId : userId,
      module: query.module,
      action: query.action,
      search: query.search,
      from: query.from,
      to: query.to,
    });

    res.status(200).json({
      ...result,
      scope: canViewAll ? 'all' : 'self',
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

/**
 * GET /api/audit-logs/summary?range=7d|14d|30d
 *
 * Counts bucketed by date, for the operations chart.
 */
export const getAuditLogSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const query = req.query as Record<string, string | undefined>;
    const range = query.range ?? '7d';
    const days = range === '30d' ? 30 : range === '14d' ? 14 : 7;

    const canViewAll = await auditLogService.canViewAllAuditLogs(userId);

    const summary = await auditLogService.fetchAuditLogSummary({
      userId: canViewAll ? undefined : userId,
      range,
      days,
    });

    res.status(200).json(summary);
  } catch (error) {
    console.error('Error fetching audit log summary:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch audit log summary' });
  }
};

/**
 * GET /api/audit-logs/recent?limit=10
 */
export const getRecentAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const query = req.query as Record<string, string | undefined>;
    const canViewAll = await auditLogService.canViewAllAuditLogs(userId);

    const logs = await auditLogService.fetchRecentAuditLogs({
      userId: canViewAll ? undefined : userId,
      limit: query.limit ? Number(query.limit) : 10,
    });

    res.status(200).json({ logs, scope: canViewAll ? 'all' : 'self' });
  } catch (error) {
    console.error('Error fetching recent audit logs:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch recent audit logs' });
  }
};

/**
 * POST /api/audit-logs
 *
 * Body: { action, module, recordId?, oldValue?, newValue?, details? }
 *
 * The actor, the display name, the timestamp and the request metadata
 * (ip address, user agent) are stamped by the server.
 */
export const createAuditLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const body = (req.body ?? {}) as Record<string, unknown>;

    // Anything the caller sends that is not a known column is kept as part of
    // the detail payload, so a call site can pass an arbitrary object without
    // the server having to know its shape.
    const knownKeys = new Set(['action', 'module', 'recordId', 'oldValue', 'newValue', 'details']);
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!knownKeys.has(key)) extra[key] = value;
    }

    const suppliedDetails = body.details;
    const details: Record<string, unknown> =
      suppliedDetails && typeof suppliedDetails === 'object' && !Array.isArray(suppliedDetails)
        ? { ...(suppliedDetails as Record<string, unknown>) }
        : {};
    if (Object.keys(extra).length > 0) {
      details.details = { ...(details.details as Record<string, unknown> | undefined), ...extra };
    }

    const newValueSource = body.newValue !== undefined && body.newValue !== null
      ? body.newValue
      : Object.keys(details).length > 0
        ? details
        : null;

    const entry = await auditLogService.createAuditLog({
      userId,
      userName: await auditLogService.getUserDisplayName(userId),
      action: String(body.action),
      module: String(body.module),
      recordId: body.recordId === undefined || body.recordId === null ? null : String(body.recordId),
      oldValue: toAuditText(body.oldValue),
      newValue: toAuditText(newValueSource),
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

    res.status(201).json(entry);
  } catch (error) {
    console.error('Error creating audit log:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to create audit log' });
  }
};

/**
 * GET /api/audit-logs/report-schedule
 */
export const getAuditReportSchedule = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const schedule = await auditLogService.getAuditReportSchedule();
    res.status(200).json(schedule);
  } catch (error) {
    console.error(
      'Error fetching audit report schedule:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Failed to fetch audit report schedule' });
  }
};

/**
 * PUT /api/audit-logs/report-schedule
 */
export const updateAuditReportSchedule = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const body = (req.body ?? {}) as Record<string, unknown>;

    const current = await auditLogService.getAuditReportSchedule();

    const schedule: auditLogService.AuditReportSchedule = {
      enabled:
        body.enabled === undefined ? current.enabled : Boolean(body.enabled),
      emails: typeof body.emails === 'string' ? body.emails : current.emails,
      frequency: typeof body.frequency === 'string' ? body.frequency : current.frequency,
      format: typeof body.format === 'string' ? body.format : current.format,
      modules: Array.isArray(body.modules)
        ? body.modules.filter((m: unknown): m is string => typeof m === 'string')
        : current.modules,
      lastUpdated: new Date().toISOString(),
    };

    const saved = await auditLogService.saveAuditReportSchedule(schedule, userId);
    res.status(200).json(saved);
  } catch (error) {
    console.error(
      'Error updating audit report schedule:',
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ error: 'Failed to update audit report schedule' });
  }
};
