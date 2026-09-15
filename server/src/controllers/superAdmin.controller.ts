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

// DB coordinates for backup/restore tooling (env-only; no hardcoded credentials).
const getDbConfig = (): { username: string; password: string; database: string; host: string; port: number } => ({
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_health_manager',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10)
});

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
    
    // Get database size
    const [dbSize] = await connection.query<RowDataPacket[]>(
      `SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
       FROM information_schema.tables
       WHERE table_schema = 'smart_health_manager'`
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
    const { username, password, database, host, port } = getDbConfig();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `backup_${timestamp}.sql`);

    // Password passed via MYSQL_PWD env (never on the command line / process list).
    const command = `mysqldump -h ${host} -P ${port} -u ${username} ${database} > "${backupPath}"`;

    await new Promise<void>((resolve, reject) => {
      exec(command, { env: { ...process.env, MYSQL_PWD: password } }, (error, _stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return reject(error);
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }
        console.log(`stdout: ${_stdout}`);
        resolve();
      });
    });

    const authReq = req as AuthRequest;
    if (authReq.user) {
      const connection = await pool.getConnection();
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, module, details, ip_address)
         VALUES (?, 'backup', 'system', ?, ?)`,
        [authReq.user.id, `System backup created: ${backupPath}`, req.ip]
      );
      connection.release();
    }

    res.status(200).json({
      message: 'System backup created successfully',
      backupPath,
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    console.error('Error triggering backup:', _error);
    res.status(500).json({ error: 'Failed to trigger backup' });
    const authReq = req as AuthRequest;
    if (authReq.user) {
      const connection = await pool.getConnection();
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, module, details, ip_address)` +
        ` VALUES (?, ?, ?, ?, ?)`,
        [authReq.user.id, 'backup_failed', 'system', `System backup failed: ${(_error as Error).message}`, req.ip]
      );
      connection.release();
    }
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
    const backupPath = path.join(process.cwd(), 'backups', backupFileName);

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
        `INSERT INTO audit_logs (user_id, action, module, details, ip_address)
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

export const getSystemHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Basic health check: database connection
    await pool.getConnection();

    // Placeholder for more advanced health metrics
    // In a real application, you might check CPU, memory, disk, other services
    res.status(200).json({
      status: 'OK',
      database: 'Connected',
      message: 'System is healthy',
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    console.error('Error getting system health:', _error);
    res.status(500).json({ error: 'Failed to get system health', details: (_error as Error).message });
  }
};

export const getBackups = async (_req: Request, res: Response): Promise<void> => {
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    const files = await fs.readdir(backupDir);
    const backups = await Promise.all(
      files
        .filter(file => file.endsWith('.sql'))
        .map(async file => {
          const stats = await fs.stat(path.join(backupDir, file));
          return {
            name: file,
            size: stats.size,
            createdAt: stats.birthtime,
          };
        })
    );
    res.status(200).json({ backups });
  } catch (error) {
    console.error('Error getting backups:', error);
    res.status(500).json({ error: 'Failed to get backups' });
  }
};



// Trigger system upgrade
export const triggerUpgrade = async (req: Request, res: Response): Promise<void> => {
  try {
    const { version, description } = req.body;
    
    if (!version) {
      res.status(400).json({ error: 'Version is required' });
      return;
    }
    
    // Log the upgrade action
    const authReq = req as AuthRequest;
    if (authReq.user) {
      const connection = await pool.getConnection();
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, module, details, ip_address)
         VALUES (?, 'upgrade', 'system', ?, ?)`,
        [
          authReq.user.id,
          `System upgrade initiated to version ${version}: ${description || 'No description'}`,
          req.ip
        ]
      );
      connection.release();
    }
    
    res.status(200).json({
      message: 'System upgrade initiated',
      version,
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    console.error('Error triggering upgrade:', _error);
    res.status(500).json({ error: 'Failed to trigger upgrade' });
  }
};

// Get system settings
export const getSystemSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    
    const [settings] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM settings ORDER BY category, setting_key'
    );
    
    connection.release();
    
    res.status(200).json({ settings });
  } catch (_error) {
    console.error('Error fetching system settings:', _error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
};

// Update system setting
export const updateSystemSetting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { setting_value } = req.body;
    
    if (!setting_value) {
      res.status(400).json({ error: 'Setting value is required' });
      return;
    }
    
    const connection = await pool.getConnection();
    
    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE settings SET setting_value = ? WHERE id = ?',
      [setting_value, id]
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
        `INSERT INTO audit_logs (user_id, action, module, details, ip_address)
         VALUES (?, 'update', 'settings', ?, ?)`,
        [authReq.user.id, `Updated setting ${id} to ${setting_value}`, req.ip]
      );
    }
    
    connection.release();
    
    res.status(200).json({ message: 'Setting updated successfully' });
  } catch (_error) {
    console.error('Error updating system setting:', _error);
    res.status(500).json({ error: 'Failed to update system setting' });
  }
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
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, module, details, ip_address)
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
        `INSERT INTO audit_logs (user_id, action, module, details, ip_address)
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
