import type { Response } from 'express';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { rescheduleReminderJob } from '../services/reminderScheduler.service.js';

export const getSettings = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [settingsRows] = await pool.query(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (?, ?, ?, ?, ?, ?, ?)`,
              ['systemName', 'timezone', 'language', 'currency', 'darkMode', 'autoSave', 'reminder_schedule']
    );

    const settings = (settingsRows as any[]).reduce((acc, row) => {
      if (row.setting_key === 'darkMode' || row.setting_key === 'autoSave') {
        acc[row.setting_key] = row.setting_value === 'true';
      } else {
        acc[row.setting_key] = row.setting_value;
      }
      return acc;
    }, {});

    res.status(200).json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const updateSettings = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const updates = req.body; // may include reminder_schedule
    const updatePromises = Object.entries(updates).map(([key, value]) => {
      // Convert boolean values to strings for consistent database storage
      const storedValue = typeof value === 'boolean' ? value.toString() : value;
      return pool.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, storedValue, storedValue]
      );
    });
    await Promise.all(updatePromises);

    // If reminder_schedule changed, reschedule the job
    if (Object.prototype.hasOwnProperty.call(updates, 'reminder_schedule')) {
      rescheduleReminderJob(updates.reminder_schedule as string);
    }

    res.status(200).json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};