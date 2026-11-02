import type { Response } from 'express';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';

export interface UserPreference {
  id: number;
  user_id: number;
  category: string;
  preference_key: string;
  preference_value: string | null;
  updated_at: string;
  created_at: string;
}

export const getPreferences = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const [rows] = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = ? ORDER BY category, preference_key',
      [userId]
    );
    const grouped: Record<string, Record<string, string | null>> = {};
    for (const row of rows as UserPreference[]) {
      if (!grouped[row.category]) grouped[row.category] = {};
      grouped[row.category][row.preference_key] = row.preference_value;
    }
    res.status(200).json(grouped);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
};

export const setPreference = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { category, key, value } = req.body as { category?: string; key?: string; value?: string | null };
    if (!category || !key) {
      res.status(400).json({ error: 'Missing category or key' });
      return;
    }
    await pool.query(
      `INSERT INTO user_preferences (user_id, category, preference_key, preference_value)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE preference_value = ?`,
      [userId, category, key, value, value]
    );
    res.status(200).json({ message: 'Preference saved' });
  } catch (error) {
    console.error('Set preference error:', error);
    res.status(500).json({ error: 'Failed to save preference' });
  }
};

export const deletePreference = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { category, key } = req.params as { category?: string; key?: string };
    if (!category || !key) {
      res.status(400).json({ error: 'Missing category or key' });
      return;
    }
    await pool.query(
      'DELETE FROM user_preferences WHERE user_id = ? AND category = ? AND preference_key = ?',
      [userId, category, key]
    );
    res.status(200).json({ message: 'Preference removed' });
  } catch (error) {
    console.error('Delete preference error:', error);
    res.status(500).json({ error: 'Failed to delete preference' });
  }
};
