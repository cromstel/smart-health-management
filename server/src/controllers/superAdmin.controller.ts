// server/src/controllers/superAdmin.controller.ts

import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import child_process from 'child_process';
const { spawn } = child_process;

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import type { AuthRequest } from '../middleware/auth.js';
import pool from '../config/database.js';
import config from '../../config/config.json';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// Rate limiter for expensive operations
const systemOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 system operations per windowMs
  message: 'Too many system operations from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

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
    // Apply rate limiting
    await systemOperationLimiter(req as any, res as any, () => {});

    const env = process.env.NODE_ENV || 'development';
    const dbConfig = (config as any)[env];

    if (!dbConfig) {
      res.status(500).json({ error: 'Database configuration not found for environment' });
      return;
    }

    const { username, password, database, host, port } = dbConfig;

    // Validate database config values to prevent injection
    if (typeof username !== 'string' || typeof password !== 'string' ||
        typeof database !== 'string' || typeof host !== 'string' ||
        typeof port !== 'number') {
      res.status(500).json({ error: 'Invalid database configuration' });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    await fsPromises.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `backup_${timestamp}.sql`);

    // Use spawn with array arguments to prevent shell injection
    await new Promise<void>((resolve, reject) => {
      const mysqldump = spawn('mysqldump', [
        '-h', host,
        '-P', port.toString(),
        '-u', username,
        `-p${password}`, // Note: Password is passed in command, but validated above
        database
      ]);

      const output = fs.createWriteStream(backupPath);
      mysqldump.stdout.pipe(output);

      mysqldump.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`mysqldump exited with code ${code}`));
        } else {
          resolve();
        }
      });

      mysqldump.on('error', reject);
    });

    const authReq = req as AuthRequest;
    if (authReq.user) {
      const connection = await pool.getConnection();
      await connection.query(
        `INSERT INTO audit_logs (id, user_id, action, module, details, ip_address)
         VALUES (UUID(), ?, 'backup', 'system', ?, ?)`,
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
      try {
        const connection = await pool.getConnection();
        await connection.query(
          `INSERT INTO audit_logs (id, user_id, action, module, details, ip_address)` +
          ` VALUES (UUID(), ?, ?, ?, ?, ?)`,
          [authReq.user.id, 'backup_failed', 'system', `System backup failed: ${(_error as Error).message}`, req.ip]
        );
        connection.release();
      } catch (logError) {
        console.error('Error logging backup failure:', logError);
      }
    }
  }
};

export const restoreBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    // Apply rate limiting
    await systemOperationLimiter(req as any, res as any, () => {});

    const { backupFileName } = req.body;
    if (!backupFileName) {
      res.status(400).json({ error: 'Backup file name is required' });
      return;
    }

    // Sanitize backup file name to prevent path traversal
    const sanitizedBackupFileName = path.basename(backupFileName);
    if (sanitizedBackupFileName !== backupFileName) {
      res.status(400).json({ error: 'Invalid backup file name' });
      return;
    }

    const env = process.env.NODE_ENV || 'development';
    const dbConfig = (config as any)[env];

    if (!dbConfig) {
      res.status(500).json({ error: 'Database configuration not found for environment' });
      return;
    }

    const { username, password, database, host, port } = dbConfig;

    // Validate database config values to prevent injection
    if (typeof username !== 'string' || typeof password !== 'string' ||
        typeof database !== 'string' || typeof host !== 'string' ||
        typeof port !== 'number') {
      res.status(500).json({ error: 'Invalid database configuration' });
      return;
    }

    const backupPath = path.join(process.cwd(), 'backups', sanitizedBackupFileName);

    // Ensure backup path is within the backups directory
    const backupsDir = path.resolve(process.cwd(), 'backups');
    const resolvedBackupPath = path.resolve(backupPath);
    if (!resolvedBackupPath.startsWith(backupsDir)) {
      res.status(400).json({ error: 'Invalid backup file path' });
      return;
    }

    // Check if backup file exists
    try {
      await fsPromises.access(backupPath);
    } catch (_error) {
      res.status(404).json({ error: 'Backup file not found' });
      return;
    }

    // Drop existing database and then restore using spawn for security
    await new Promise<void>((resolve, reject) => {
      const mysql = spawn('mysql', [
        '-h', host,
        '-P', port.toString(),
        '-u', username,
        `-p${password}`,
        '-e', `DROP DATABASE IF EXISTS ${database}; CREATE DATABASE ${database};`
      ]);

      mysql.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`mysql drop/create exited with code ${code}`));
        } else {
          resolve();
        }
      });

      mysql.on('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      const mysql = spawn('mysql', [
        '-h', host,
        '-P', port.toString(),
        '-u', username,
        `-p${password}`,
        database
      ]);

      const input = fs.createReadStream(backupPath);
      input.pipe(mysql.stdin);

      mysql.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`mysql restore exited with code ${code}`));
        } else {
          resolve();
        }
      });

      mysql.on('error', reject);
    });

    const authReq = req as AuthRequest;
    if (authReq.user) {
      const connection = await pool.getConnection();
      await connection.query(
        `INSERT INTO audit_logs (id, user_id, action, module, details, ip_address)
         VALUES (UUID(), ?, 'restore', 'system', ?, ?)`,
        [authReq.user.id, `System restored from backup: ${sanitizedBackupFileName}`, req.ip]
      );
      connection.release();
    }

    res.status(200).json({
      message: 'System restored successfully from backup',
      backupFileName: sanitizedBackupFileName,
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
    const files = await fsPromises.readdir(backupDir);
    const backups = await Promise.all(
      files
        .filter((file: string) => file.endsWith('.sql'))
        .map(async (file: string) => {
          const stats = await fsPromises.stat(path.join(backupDir, file));
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
        `INSERT INTO audit_logs (id, user_id, action, module, details, ip_address)
         VALUES (UUID(), ?, 'upgrade', 'system', ?, ?)`,
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
        `INSERT INTO audit_logs (id, user_id, action, module, details, ip_address)
         VALUES (UUID(), ?, 'update', 'settings', ?, ?)`,
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
        `INSERT INTO audit_logs (id, user_id, action, module, details, ip_address)
         VALUES (UUID(), ?, 'update', 'users', ?, ?)`,
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
