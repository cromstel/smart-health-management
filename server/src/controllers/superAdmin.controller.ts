// server/src/controllers/superAdmin.controller.ts

import { Request, Response } from 'express';
import child_process from 'child_process';
const { exec } = child_process;

import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { validationResult } from 'express-validator';
import type { AuthRequest } from '../middleware/auth.js';
import pool from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  getBackupDirectory,
  getDbConfig,
  listBackups,
  runDatabaseBackup,
} from '../services/backup.service.js';
import { getScheduledJobStatuses } from '../services/cron.service.js';

/** Version this build reports when nothing has been persisted yet. */
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

/** Setting key under which the running version is persisted. */
const SYSTEM_VERSION_KEY = 'system.version';

/**
 * The steps a real upgrade would perform. They are reported as a plan only:
 * the endpoint does not run them.
 */
const UPGRADE_STEPS = [
  'Take a verified database backup and confirm that it restores',
  'Apply the pending migrations from server/migrations/ in order',
  'Build and install the target application version',
  'Restart the API and worker processes',
  'Run the post-upgrade smoke checks (health, login, clinical read paths)',
];

// Aliases charsets that avoid visually ambiguous glyphs (no 0/O/1/I/l).
const TEMP_PW_ALPHABETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  digit: '23456789',
  special: '!@#$%^&*-_=+?'
};
const pickChar = (set: string): string => set[randomInt(set.length)];

// Cryptographically random temporary password that always satisfies the
// complexity policy (>= 8 chars, upper+lower+number+special).
export const generateTemporaryPassword = (length = 16): string => {
  const len = Math.max(length, 8);
  const required = [
    pickChar(TEMP_PW_ALPHABETS.upper),
    pickChar(TEMP_PW_ALPHABETS.lower),
    pickChar(TEMP_PW_ALPHABETS.digit),
    pickChar(TEMP_PW_ALPHABETS.special)
  ];
  const all = Object.values(TEMP_PW_ALPHABETS).join('');
  while (required.length < len) required.push(pickChar(all));
  // Fisher–Yates shuffle using crypto randomInt (not Math.random).
  for (let i = required.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [required[i], required[j]] = [required[j], required[i]];
  }
  return required.join('');
};

// Get system status and statistics
export const getSystemStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    
    // Get total counts from various tables
    const [userCount] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM users'
    );
    const [hospitalCount] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM hospitals'
    );
    const [patientCount] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM patients'
    );
    const [appointmentCount] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM appointments'
    );
    
    // Get database size. The schema name is a bound parameter rather than
    // string interpolation: it was previously hardcoded to the pre-rename
    // `smart_health_manager`, so the health endpoint reported size for a
    // database that no longer exists, and interpolating a value into SQL is a
    // pattern worth not repeating even for an env-derived name.
    const [dbSize] = await connection.execute<RowDataPacket[]>(
      `SELECT
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
       FROM information_schema.tables
       WHERE table_schema = ?`,
      [process.env.DB_NAME || 'smart_medicare']
    );
    
    connection.release();
    
    res.status(200).json({
      status: 'OK',
      message: 'System is running',
      statistics: {
        totalUsers: userCount[0].count,
        totalHospitals: hospitalCount[0].count,
        totalPatients: patientCount[0].count,
        totalAppointments: appointmentCount[0].count,
        databaseSize: dbSize[0].size_mb || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    console.error('Error fetching system status:', _error);
    res.status(500).json({ error: 'Failed to fetch system status' });
  }
};

// Get all users with their roles
export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    
    const [users] = await connection.query<RowDataPacket[]>(
      `SELECT 
        u.id, u.email, u.name, u.status, u.last_login, u.created_at,
        r.name as role_name, r.description as role_description
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );
    
    connection.release();
    
    res.status(200).json({ users });
  } catch (_error) {
    console.error('Error fetching users:', _error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get all hospitals with statistics
export const getAllHospitals = async (_req: Request, res: Response): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    
    const [hospitals] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM hospitals ORDER BY created_at DESC`
    );
    
    connection.release();
    
    res.status(200).json({ hospitals });
  } catch (_error) {
    console.error('Error fetching hospitals:', _error);
    res.status(500).json({ error: 'Failed to fetch hospitals' });
  }
};

// Get system audit logs
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const connection = await pool.getConnection();
    
    const [logs] = await connection.query<RowDataPacket[]>(
      `SELECT 
        al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)]
    );
    
    const [totalCount] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM audit_logs'
    );
    
    connection.release();
    
    res.status(200).json({
      logs,
      total: totalCount[0].count,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (_error) {
    console.error('Error fetching audit logs:', _error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

// Trigger system backup
export const triggerBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;

    // The actual work lives in the backup service so the scheduler can run
    // exactly the same routine without faking an HTTP request.
    const result = await runDatabaseBackup({
      triggeredBy: authReq.user?.id ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] || null,
    });

    if (!result.success) {
      res.status(500).json({ error: 'Failed to trigger backup', details: result.error });
      return;
    }

    res.status(200).json({
      message: 'System backup created successfully',
      backupPath: result.backupPath,
      fileName: result.fileName,
      sizeBytes: result.sizeBytes,
      timestamp: result.timestamp
    });
  } catch (_error) {
    console.error('Error triggering backup:', _error);
    res.status(500).json({ error: 'Failed to trigger backup' });
  }
};

export const restoreBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { backupFileName } = req.body;
    if (!backupFileName) {
      res.status(400).json({ error: 'Backup file name is required' });
      return;
    }

    // Path-traversal guard: allow plain file names only.
    if (!/^[a-zA-Z0-9._-]+$/.test(backupFileName)) {
      res.status(400).json({ error: 'Invalid backup file name' });
      return;
    }

    const { username, password, database, host, port } = getDbConfig();
    const backupPath = path.join(getBackupDirectory(), backupFileName);

    // Check if backup file exists
    try {
      await fs.access(backupPath);
    } catch (_error) {
      res.status(404).json({ error: 'Backup file not found' });
      return;
    }

    // Drop existing database and then restore.
    // Password passed via MYSQL_PWD env (never on the command line / process list).
    const dropDbCommand = `mysql -h ${host} -P ${port} -u ${username} -e "DROP DATABASE IF EXISTS \`${database}\`; CREATE DATABASE \`${database}\`;"`;
    const restoreCommand = `mysql -h ${host} -P ${port} -u ${username} ${database} < "${backupPath}"`;

    await new Promise<void>((resolve, reject) => {
      exec(dropDbCommand, { env: { ...process.env, MYSQL_PWD: password } }, (error, _stdout, stderr) => {
        if (error) {
          console.error(`exec error (dropDb): ${error}`);
          return reject(error);
        }
        if (stderr) {
          console.error(`stderr (dropDb): ${stderr}`);
        }
        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      exec(restoreCommand, { env: { ...process.env, MYSQL_PWD: password } }, (error, _stdout, stderr) => {
        if (error) {
          console.error(`exec error (restore): ${error}`);
          return reject(error);
        }
        if (stderr) {
          console.error(`stderr (restore): ${stderr}`);
        }
        resolve();
      });
    });

    const authReq = req as AuthRequest;
    if (authReq.user) {
      const connection = await pool.getConnection();
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, module, new_value, ip_address)
         VALUES (?, 'restore', 'system', ?, ?)`,
        [authReq.user.id, `System restored from backup: ${backupFileName}`, req.ip]
      );
      connection.release();
    }

    res.status(200).json({
      message: 'System restored successfully from backup',
      backupFileName,
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    console.error('Error restoring backup:', _error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
};

/**
 * Real health report.
 *
 * The old implementation returned a hardcoded "OK" and acquired a pool
 * connection it never released, so every call leaked one of the ten pool
 * slots. The report now measures the database round trip, the process
 * footprint and the scheduled jobs, and it says "degraded" when the database
 * cannot be reached.
 */
export const getSystemHealth = async (_req: Request, res: Response): Promise<void> => {
  let database: { status: string; latencyMs: number | null; error: string | null };

  try {
    // `pool.query` borrows and returns a connection on its own, so no slot
    // is held and none can leak.
    const startedAt = Date.now();
    await pool.query('SELECT 1');
    database = { status: 'connected', latencyMs: Date.now() - startedAt, error: null };
  } catch (error) {
    database = {
      status: 'unreachable',
      latencyMs: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const memory = process.memoryUsage();
  const jobs = getScheduledJobStatuses();
  const healthy = database.status === 'connected';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'OK' : 'DEGRADED',
    database: healthy ? 'Connected' : 'Unreachable',
    message: healthy
      ? 'System is healthy'
      : 'System is degraded: the database is unreachable',
    timestamp: new Date().toISOString(),
    checks: {
      database,
      server: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          rssMb: Math.round((memory.rss / 1024 / 1024) * 10) / 10,
          heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
          heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 10) / 10,
        },
      },
      scheduler: {
        started: jobs.length > 0,
        jobCount: jobs.length,
      },
      scheduledJobs: jobs,
    },
  });
};

export const getBackups = async (_req: Request, res: Response): Promise<void> => {
  try {
    // A missing backup directory means no backups have been taken yet, which is
    // a normal state for a fresh install -- not a failure.
    const backups = await listBackups();
    res.status(200).json({ backups });
  } catch (error) {
    console.error('Error getting backups:', error);
    res.status(500).json({ error: 'Failed to get backups' });
  }
};



/**
 * Reports an upgrade plan.
 *
 * The old implementation wrote an audit row and answered "System upgrade
 * initiated" without upgrading anything: no version was applied, no state
 * was persisted and there was no rollback. The endpoint is now honest about
 * what it does -- it persists the version that is actually running, reports
 * the steps a real upgrade would perform, and labels the response as a dry
 * run so nobody reads it as a completed upgrade.
 */
export const triggerUpgrade = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { version, description } = req.body as { version?: string; description?: string };

    if (!version || typeof version !== 'string' || !version.trim()) {
      res.status(400).json({ error: 'Version is required' });
      return;
    }

    const authReq = req as AuthRequest;
    const currentVersion = await persistCurrentVersion(authReq.user?.id ?? null);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, new_value, ip_address)
       VALUES (?, 'upgrade_plan', 'system', ?, ?)`,
      [
        authReq.user?.id ?? null,
        `Upgrade plan generated: running version ${currentVersion}, requested target ${version}. No upgrade was applied.`,
        req.ip ?? null,
      ]
    );

    res.status(200).json({
      message: 'Upgrade plan generated. No upgrade was performed (dry run).',
      dryRun: true,
      applied: false,
      currentVersion,
      targetVersion: version.trim(),
      description: description || null,
      steps: UPGRADE_STEPS,
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    console.error('Error generating upgrade plan:', _error);
    res.status(500).json({ error: 'Failed to generate upgrade plan' });
  }
};

/**
 * Reads the running version and stores it under `system.version` so it can
 * be read back later.
 */
const persistCurrentVersion = async (userId: string | null): Promise<string> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT setting_value FROM super_admin_settings WHERE setting_key = ? LIMIT 1',
    [SYSTEM_VERSION_KEY]
  );

  const stored = (rows as any[])[0]?.setting_value;
  const currentVersion = typeof stored === 'string' && stored.trim() ? stored.trim() : APP_VERSION;

  await upsertSuperAdminSetting(SYSTEM_VERSION_KEY, currentVersion, 'system', userId);

  return currentVersion;
};

/**
 * Upserts a super-admin setting.
 *
 * `updated_by` is a foreign key to users, so a reference to a user that no
 * longer exists falls back to NULL instead of failing the write.
 */
const upsertSuperAdminSetting = async (
  settingKey: string,
  settingValue: string,
  category: string,
  userId: string | null
): Promise<void> => {
  const sql =
    `INSERT INTO super_admin_settings (setting_key, setting_value, category, updated_by, updated_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       setting_value = VALUES(setting_value),
       category = VALUES(category),
       updated_by = VALUES(updated_by),
       updated_at = NOW()`;

  try {
    await pool.query(sql, [settingKey, settingValue, category, userId]);
  } catch (error) {
    console.error(
      'Could not attribute the setting update to a user, retrying without it:',
      error instanceof Error ? error.message : String(error)
    );
    await pool.query(sql, [settingKey, settingValue, category, null]);
  }
};

/**
 * Get system settings.
 *
 * Both stores are returned: `settings` holds the general system
 * configuration, `super_admin_settings` holds the operator-owned values. The
 * identifiers are prefixed with their source table, because the two tables
 * have independent auto-increment sequences and a bare row id is ambiguous.
 */
export const getSystemSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [settings] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM settings ORDER BY category, setting_key'
    );

    const [superSettings] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM super_admin_settings ORDER BY category, setting_key'
    );

    const merged = new Map<string, any>();

    for (const row of settings as any[]) {
      merged.set(row.setting_key, {
        ...row,
        id: `settings:${row.id}`,
        source: 'settings',
      });
    }

    // The operator store wins when both tables hold the same key.
    for (const row of superSettings as any[]) {
      merged.set(row.setting_key, {
        ...row,
        id: `super_admin_settings:${row.id}`,
        source: 'super_admin_settings',
      });
    }

    const result = Array.from(merged.values()).sort(
      (a, b) =>
        String(a.category ?? '').localeCompare(String(b.category ?? '')) ||
        String(a.setting_key).localeCompare(String(b.setting_key))
    );

    res.status(200).json({ settings: result });
  } catch (_error) {
    console.error('Error fetching system settings:', _error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
};

/**
 * Updates a system setting by its row id.
 *
 * The existing PATCH /settings/:id route keeps working against the
 * `settings` table.
 */
export const updateSystemSetting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { setting_value } = req.body;

    if (setting_value === undefined || setting_value === null) {
      res.status(400).json({ error: 'Setting value is required' });
      return;
    }

    const connection = await pool.getConnection();

    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE settings SET setting_value = ? WHERE id = ?',
      [String(setting_value), id]
    );

    if (result.affectedRows === 0) {
      connection.release();
      res.status(404).json({ error: 'Setting not found' });
      return;
    }

    // Log the action
    const authReq = req as AuthRequest;
    if (authReq.user) {
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, module, new_value, ip_address)
         VALUES (?, ?, ?, ?, ?)`,
        [authReq.user.id, 'update', 'settings', `Updated setting ${id} to ${setting_value}`, req.ip]
      );
    }

    connection.release();

    res.status(200).json({ message: 'Setting updated successfully' });
  } catch (_error) {
    console.error('Error updating system setting:', _error);
    res.status(500).json({ error: 'Failed to update system setting' });
  }
};

/**
 * Creates or updates a system setting.
 *
 * This is the endpoint the super-admin console actually calls
 * (PUT /settings with `{ key, value }`). The console sends the identifier of
 * the row it is editing, so the key is resolved in three ways:
 *
 *   1. "<table>:<id>"  -- the prefixed identifier returned by GET /settings
 *   2. a setting_key  -- a row in super_admin_settings with that key
 *   3. a numeric id   -- a row in the legacy settings table
 *
 * A key that matches nothing is created in super_admin_settings. The value
 * is written to both stores, so the general configuration and the operator
 * store never disagree about the same key.
 */
export const upsertSystemSetting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0]?.msg ?? 'Invalid request' });
      return;
    }

    const key = String(req.body.key).trim();
    const value = req.body.value === undefined || req.body.value === null
      ? ''
      : String(req.body.value);

    const target = await resolveSettingTarget(key);

    if (!target) {
      await upsertSuperAdminSetting(key, value, 'general', req.user?.id ?? null);

      await pool.query(
        `INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address)
         VALUES (?, 'create', 'settings', ?, ?, ?)`,
        [req.user?.id ?? null, key, `Created setting ${key}`, req.ip ?? null]
      );

      res.status(200).json({
        message: 'Setting saved successfully',
        key,
        value,
      });
      return;
    }

    // Both stores are written, so the value is the same wherever it is read
    // from -- including after the console starts addressing the row by the
    // other table's identifier.
    await pool.query(
      'UPDATE settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
      [value, target.settingKey]
    );
    await upsertSuperAdminSetting(target.settingKey, value, target.category ?? 'general', req.user?.id ?? null);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address)
       VALUES (?, 'update', 'settings', ?, ?, ?)`,
      [
        req.user?.id ?? null,
        target.settingKey,
        `Updated setting ${target.settingKey}`,
        req.ip ?? null,
      ]
    );

    res.status(200).json({
      message: 'Setting updated successfully',
      key: target.settingKey,
      value,
    });
  } catch (_error) {
    console.error('Error saving system setting:', _error);
    res.status(500).json({ error: 'Failed to save system setting' });
  }
};

interface SettingTarget {
  settingKey: string;
  category: string | null;
}

/** Resolves the key of a PUT /settings request to a concrete setting. */
const resolveSettingTarget = async (key: string): Promise<SettingTarget | null> => {
  const composite = /^(settings|super_admin_settings):(\d+)$/.exec(key);
  if (composite) {
    const table = composite[1] as 'settings' | 'super_admin_settings';
    const id = Number(composite[2]);
    if (table === 'settings') {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT id, setting_key, category FROM settings WHERE id = ? LIMIT 1',
        [id]
      );
      if (rows.length) {
        return { settingKey: rows[0].setting_key, category: rows[0].category };
      }
    } else {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT id, setting_key, category FROM super_admin_settings WHERE id = ? LIMIT 1',
        [id]
      );
      if (rows.length) {
        return { settingKey: rows[0].setting_key, category: rows[0].category };
      }
    }
    return null;
  }

  const [superRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, setting_key, category FROM super_admin_settings WHERE setting_key = ? LIMIT 1',
    [key]
  );
  if (superRows.length) {
    return { settingKey: superRows[0].setting_key, category: superRows[0].category };
  }

  if (/^\d+$/.test(key)) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, setting_key, category FROM settings WHERE id = ? LIMIT 1',
      [Number(key)]
    );
    if (rows.length) {
      return { settingKey: rows[0].setting_key, category: rows[0].category };
    }
  }

  return null;
};

// Manage user status (activate/deactivate/lock)
export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive', 'locked'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value' });
      return;
    }

    if (req.user?.id === userId && status !== 'active') {
      res.status(400).json({ error: 'You cannot deactivate or lock your own account.' });
      return;
    }
    
    const connection = await pool.getConnection();
    
    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, userId]
    );
    
    if (result.affectedRows === 0) {
      connection.release();
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // Log the action
    const authReq = req as AuthRequest;
    if (authReq.user) {
      // audit_logs has no `details` column (see schema.sql); the free-text
      // field is `new_value`. Inserting into `details` threw
      // ER_BAD_FIELD_ERROR, so the status change rolled back with a 500 and the
      // row never updated.
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, module, new_value, ip_address)
         VALUES (?, 'update', 'users', ?, ?)`,
        [authReq.user.id, `Updated user ${userId} status to ${status}`, req.ip]
      );
    }
    
    connection.release();
    
    res.status(200).json({ message: 'User status updated successfully' });
  } catch (_error) {
    console.error('Error updating user status:', _error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

// Operator/super-admin password reset — the safety net for accounts locked out
// by a lost authenticator with all recovery codes burned.
export const resetUserPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0]?.msg ?? 'Invalid request' });
      return;
    }

    const { userId } = req.params;
    const clearTwoFactor = req.body.clear_two_factor === true;

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Prevent an operator from resetting their own account through this path:
    // self-service must keep going through the (stricter) change-password flow.
    if (userId === req.user.id) {
      res.status(400).json({
        error: 'You cannot reset your own password via admin reset. Use the profile change-password flow instead.'
      });
      return;
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT id, email FROM users WHERE id = ?',
        [userId]
      );
      if (rows.length === 0) {
        connection.release();
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const targetEmail = String(rows[0].email ?? userId);

      // Temporary password is returned to the operator exactly once and is
      // NEVER written to audit_logs.
      const tempPassword = generateTemporaryPassword();
      const hashed = await bcrypt.hash(tempPassword, 12);

      await connection.beginTransaction();
      await connection.query(
        `UPDATE users
         SET password = ?, password_must_change = TRUE, password_changed_at = NULL,
             login_attempts = 0, status = 'active', locked_until = NULL
         WHERE id = ?`,
        [hashed, userId]
      );
      if (clearTwoFactor) {
        // Resolving a lost-authenticator lockout: drop TOTP, recovery codes,
        // and any registered passkeys so the user can log in again with just
        // the temp password.
        await connection.query(
          'UPDATE users SET totp_secret = NULL, recovery_codes = NULL WHERE id = ?',
          [userId]
        );
        await connection.query(
          'DELETE FROM webauthn_credentials WHERE user_id = ?',
          [userId]
        );
      }
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, module, new_value, ip_address)
         VALUES (?, 'reset_password', 'users', ?, ?)`,
        [
          req.user.id,
          `Admin reset password for ${targetEmail} (${userId})${clearTwoFactor ? '; 2FA cleared' : ''}`,
          req.ip
        ]
      );
      await connection.commit();
      connection.release();

      res.status(200).json({
        message: 'Password reset successfully',
        temporaryPassword: tempPassword,
        mustChange: true,
        twoFactorDisabled: clearTwoFactor
      });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (_error) {
    console.error('Error resetting user password:', _error);
    res.status(500).json({ error: 'Failed to reset user password' });
  }
};
