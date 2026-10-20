/**
 * Server maintenance service.
 *
 * Holds the work that more than one caller needs:
 *
 *  1. `runDatabaseBackup()` — the mysqldump routine. It used to live inside
 *     the super-admin controller, which forced the scheduler to fabricate a
 *     fake Express request/response pair to call it. That fake request had no
 *     `ip` and no `user`, so the nightly tick threw before it wrote anything
 *     and no audit row was produced. The work lives here now and takes plain
 *     parameters, so both the HTTP controller and the cron service can call
 *     it.
 *
 *  2. `cleanupExpiredAuthRecords()` — the periodic purge of expired rows in
 *     `revoked_tokens` and `password_resets`. Both tables are append-heavy
 *     and would otherwise grow without bound.
 *
 * Backups are written to `server/backups` (overridable with `BACKUP_DIR`),
 * which is covered by the `server/backups/` ignore rule: a dump contains the
 * whole database, so it must never be committed.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import type { ResultSetHeader } from 'mysql2';

const here = path.dirname(fileURLToPath(import.meta.url));
// services/ -> src/ -> server/
const serverRoot = path.resolve(here, '..', '..');

export interface DbConfig {
  username: string;
  password: string;
  database: string;
  host: string;
  port: number;
}

export interface BackupFile {
  name: string;
  size: string;
  createdAt: Date;
}

export interface BackupResult {
  success: boolean;
  fileName: string | null;
  backupPath: string | null;
  sizeBytes: number | null;
  timestamp: string;
  error: string | null;
}

export interface BackupOptions {
  /** users.id of the operator, or null for a scheduled run. */
  triggeredBy?: string | number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** DB coordinates for the dump/restore tooling (env-only; no hardcoded credentials). */
export const getDbConfig = (): DbConfig => ({
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_medicare',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
});

/**
 * Directory that receives database dumps. Defaults to `server/backups`,
 * resolved from this module's location rather than the process CWD so the
 * path is the same no matter where the API was started from.
 */
export const getBackupDirectory = (): string => {
  const configured = process.env.BACKUP_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(serverRoot, 'backups');
};

/** Lists the available dumps, newest first. A missing directory is not an error. */
export const listBackups = async (): Promise<BackupFile[]> => {
  const backupDir = getBackupDirectory();

  let files: string[];
  try {
    files = await fsPromises.readdir(backupDir);
  } catch {
    return [];
  }

  const entries = await Promise.all(
    files
      .filter((file) => file.endsWith('.sql'))
      .map(async (file): Promise<BackupFile> => {
        const stats = await fsPromises.stat(path.join(backupDir, file));
        return {
          name: file,
          size: String(stats.size),
          createdAt: stats.birthtimeMs > 0 ? stats.birthtime : stats.mtime,
        };
      })
  );

  return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

/**
 * Writes the audit trail for a backup attempt. Never throws: a failed audit
 * write must not turn a successful backup into a failure, and it must not
 * mask the real error either.
 */
const writeBackupAuditLog = async (params: {
  success: boolean;
  fileName: string | null;
  userId: string | number | null;
  ipAddress: string | null;
  userAgent: string | null;
  error?: string | null;
}): Promise<void> => {
  const description = params.success
    ? `System backup created: ${params.fileName ?? 'unknown'}`
    : `System backup failed: ${params.error ?? 'unknown error'}`;

  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, module, new_value, ip_address, user_agent)
       VALUES (?, ?, 'system', ?, ?, ?)`,
      [
        params.userId ?? null,
        params.success ? 'backup' : 'backup_failed',
        description,
        params.ipAddress ?? null,
        params.userAgent ?? null,
      ]
    );
  } catch (error) {
    console.error(
      '[backup] could not write the backup audit row:',
      error instanceof Error ? error.message : String(error)
    );
  }
};

/**
 * Runs `mysqldump` and streams the dump straight to a file.
 *
 * The dump binary is invoked without a shell (no interpolation of host,
 * user or database name into a command line) and the database password is
 * passed through the `MYSQL_PWD` environment variable so it never appears in
 * the process list.
 */
export const runDatabaseBackup = async (options: BackupOptions = {}): Promise<BackupResult> => {
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const backupDir = getBackupDirectory();
  const fileName = `backup_${stamp}.sql`;
  const backupPath = path.join(backupDir, fileName);
  const { username, password, database, host, port } = getDbConfig();

  try {
    await fsPromises.mkdir(backupDir, { recursive: true });

    const dumpBinary = process.env.MYSQLDUMP_BIN?.trim() || 'mysqldump';
    const args = [
      '--host', host,
      '--port', String(port),
      '--user', username,
      '--single-transaction',
      database,
    ];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(dumpBinary, args, {
        env: { ...process.env, MYSQL_PWD: password },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      const output = fs.createWriteStream(backupPath);
      let stderr = '';

      child.stdout.pipe(output);
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });

      child.on('error', (error) => {
        output.destroy();
        reject(
          error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? new Error(`Backup tool "${dumpBinary}" was not found on this host`)
            : error
        );
      });

      child.on('close', (code) => {
        output.end(() => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`mysqldump exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
          }
        });
      });
    });

    const stats = await fsPromises.stat(backupPath);

    await writeBackupAuditLog({
      success: true,
      fileName,
      userId: options.triggeredBy ?? null,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
    });

    return {
      success: true,
      fileName,
      backupPath,
      sizeBytes: stats.size,
      timestamp: startedAt.toISOString(),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // A partial dump is worse than none: remove it so it can never be
    // restored by mistake.
    await fsPromises.unlink(backupPath).catch(() => undefined);

    console.error('[backup] database backup failed:', message);

    await writeBackupAuditLog({
      success: false,
      fileName: null,
      userId: options.triggeredBy ?? null,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      error: message,
    });

    return {
      success: false,
      fileName: null,
      backupPath: null,
      sizeBytes: null,
      timestamp: startedAt.toISOString(),
      error: message,
    };
  }
};

/**
 * Removes rows that can no longer be useful: revoked tokens whose expiry has
 * passed, expired reset links, and reset links that were already redeemed
 * more than a day ago (kept briefly as a weak audit trail).
 */
export const cleanupExpiredAuthRecords = async (): Promise<{
  revokedTokens: number;
  passwordResets: number;
}> => {
  const [revoked] = await pool.query<ResultSetHeader>(
    'DELETE FROM revoked_tokens WHERE expires_at <= NOW()'
  );

  const [resets] = await pool.query<ResultSetHeader>(
    `DELETE FROM password_resets
      WHERE expires_at <= NOW()
         OR (used_at IS NOT NULL AND used_at <= NOW() - INTERVAL 1 DAY)`
  );

  return {
    revokedTokens: revoked.affectedRows ?? 0,
    passwordResets: resets.affectedRows ?? 0,
  };
};
