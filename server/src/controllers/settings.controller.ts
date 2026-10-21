import type { Response } from 'express';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * The settings the application exposes.
 *
 * The list is the same for reading and for writing. A write used to take
 * every key the request carried and store it, so a caller could write any
 * setting the application reads -- including the ones that decide where
 * reports are sent and what the emergency line is -- across the whole
 * installation. The settings table is global, so a setting is the
 * installation's, and a caller who can write one is writing it for
 * everybody.
 */
export const SETTINGS_KEYS = [
  'systemName',
  'timezone',
  'language',
  'currency',
  'darkMode',
  'autoSave',
] as const;

/** The settings that hold a truth value rather than a string. */
const BOOLEAN_SETTINGS = new Set<string>(['darkMode', 'autoSave']);

export const getSettings = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const placeholders = SETTINGS_KEYS.map(() => '?').join(', ');
    const [settingsRows] = await pool.query(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${placeholders})`,
      [...SETTINGS_KEYS]
    );

    const settings = (settingsRows as any[]).reduce((acc, row) => {
      if (BOOLEAN_SETTINGS.has(row.setting_key)) {
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
    const body = (req.body ?? {}) as Record<string, unknown>;

    // A key that is not one of the application's settings is refused rather
    // than stored. The table is the application's, and the application's
    // settings are the list above.
    const unknownKeys = Object.keys(body).filter((key) => !(SETTINGS_KEYS as readonly string[]).includes(key));
    if (unknownKeys.length > 0) {
      res.status(400).json({
        error: 'Unknown setting',
        details: unknownKeys.map((key) => `${key} is not a setting of this application`),
      });
      return;
    }

    const entries = Object.entries(body);
    if (entries.length === 0) {
      res.status(400).json({ error: 'No settings supplied' });
      return;
    }

    // The writes happen together or not at all: a settings screen that half
    // applied is worse than one that did not apply.
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const [key, value] of entries) {
        // Boolean values are stored as strings, so the column holds one kind
        // of value rather than two.
        const storedValue = typeof value === 'boolean' ? value.toString() : String(value);
        await connection.query(
          'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          [key, storedValue, storedValue]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.status(200).json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};
